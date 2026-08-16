/* London Parking Finder — map logic */
(function () {
  "use strict";

  const LONDON_CENTER = [51.5074, -0.1278];
  const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
  const TFL_CARPARKS_URL = "https://api.tfl.gov.uk/Place/Type/CarPark";
  const MIN_SCAN_ZOOM = 13;

  const COLOR_FREE = "#22c55e";
  const COLOR_RESTRICTED = "#f59e0b";
  const COLOR_TFL = "#3b82f6";
  const COLOR_CASING = "#0b1220";

  // ---------- Map setup ----------

  const map = L.map("map", { zoomControl: true }).setView(LONDON_CENTER, 12);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' +
      ' &copy; <a href="https://carto.com/attributions">CARTO</a>' +
      ' | Car parks from <a href="https://api.tfl.gov.uk/">TfL Unified API</a>',
    maxZoom: 19,
  }).addTo(map);

  const cpzLayer = L.layerGroup().addTo(map);
  const freeParkingLayer = L.layerGroup().addTo(map);
  const roadLayer = L.layerGroup().addTo(map);
  const tflLayer = L.layerGroup().addTo(map);
  let userMarker = null;

  // ---------- DOM references ----------

  const $ = (id) => document.getElementById(id);
  const searchInput = $("search-input");
  const statusLine = $("status-line");
  const resultsList = $("results-list");
  const resultsTitle = $("results-title");
  const useNowCheckbox = $("use-now");
  const daySelect = $("day-select");
  const timeSelect = $("time-select");

  function setStatus(message, isError) {
    if (!message) {
      statusLine.hidden = true;
      return;
    }
    statusLine.hidden = false;
    statusLine.textContent = message;
    statusLine.style.color = isError ? "var(--red)" : "var(--amber)";
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // ---------- Time handling ----------

  function selectedMoment() {
    if (useNowCheckbox.checked) {
      const now = new Date();
      return { day: now.getDay(), minutes: now.getHours() * 60 + now.getMinutes() };
    }
    const [h, m] = (timeSelect.value || "12:00").split(":").map(Number);
    return { day: Number(daySelect.value), minutes: h * 60 + m };
  }

  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  /** Is the zone controlled (permit/payment required) at the given moment? */
  function isZoneControlled(zone, moment) {
    return zone.hours.some(
      (rule) =>
        rule.days.includes(moment.day) &&
        moment.minutes >= toMinutes(rule.start) &&
        moment.minutes <= toMinutes(rule.end)
    );
  }

  // ---------- OSM opening-hours-style interval parsing ----------
  // Handles the common forms found in parking tags, e.g.
  //   "Mo-Fr 08:30-18:30", "Mo-Sa 08:00-13:00,14:00-18:00", "Su", "Mo,We,Fr 09:00-17:00"

  const DAY_IDX = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };

  function parseDayToken(token) {
    token = token.trim().toLowerCase();
    const m = token.match(/^([a-z]{2})(?:-([a-z]{2}))?$/);
    if (!m || !(m[1] in DAY_IDX)) return null;
    const start = DAY_IDX[m[1]];
    if (!m[2]) return [start];
    if (!(m[2] in DAY_IDX)) return null;
    const end = DAY_IDX[m[2]];
    const days = [];
    for (let d = start; ; d = (d + 1) % 7) {
      days.push(d);
      if (d === end || days.length > 7) break;
    }
    return days;
  }

  function parseClause(clause) {
    clause = clause.trim();
    if (!clause) return null;
    const ranges = [];
    const timeRe = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g;
    let m;
    while ((m = timeRe.exec(clause))) {
      ranges.push([Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])]);
    }
    const dayPart = clause.split(/\d/)[0].trim();
    let days;
    if (dayPart) {
      const tokens = dayPart.split(",").map(parseDayToken);
      if (tokens.some((t) => t === null)) return null; // e.g. "PH" — skip clause
      days = tokens.flat();
    } else {
      days = [0, 1, 2, 3, 4, 5, 6];
    }
    if (!ranges.length) ranges.push([0, 24 * 60]);
    return { days, ranges };
  }

  function parseSpec(spec) {
    const clauses = String(spec).split(";").map(parseClause).filter(Boolean);
    return clauses.length ? clauses : null;
  }

  function specMatches(spec, moment) {
    return spec.some(
      (c) =>
        c.days.includes(moment.day) &&
        c.ranges.some(([s, e]) => moment.minutes >= s && moment.minutes <= e)
    );
  }

  /**
   * Evaluate an OSM ":conditional" tag value like "yes @ (Mo-Sa 08:30-18:30)".
   * Returns the active value string, null when parsed but no rule matches now,
   * or undefined when the tag is absent/unparseable.
   */
  function conditionalValue(raw, moment) {
    if (!raw) return undefined;
    const rules = [];
    for (const part of String(raw).split(";")) {
      const m = part.match(/^\s*([^@]+?)\s*@\s*\(?\s*([^()]+?)\s*\)?\s*$/);
      if (!m) continue;
      const spec = parseSpec(m[2]);
      if (spec) rules.push({ value: m[1].trim(), spec, text: m[2].trim() });
    }
    if (!rules.length) return undefined;
    for (const r of rules) if (specMatches(r.spec, moment)) return r.value;
    return null;
  }

  // ---------- CPZ rendering ----------

  function zonePopupHtml(zone, controlled) {
    const statusHtml = controlled
      ? '<span class="popup-status-controlled">Controlled now — permit or payment required</span>'
      : '<span class="popup-status-free">Free at the selected time (outside controlled hours)</span>';
    return (
      '<div class="popup-title">' + zone.name + "</div>" +
      '<div class="popup-row"><span class="label">Borough:</span> ' + zone.borough + "</div>" +
      '<div class="popup-row"><span class="label">Controlled hours:</span> ' + zone.hoursText + "</div>" +
      '<div class="popup-row">' + statusHtml + "</div>" +
      '<div class="popup-row"><a href="' + zone.url + '" target="_blank" rel="noopener">' +
      "Check the council's parking pages</a></div>" +
      '<div class="popup-row"><span class="label">Boundary shown is approximate — always read the street signs.</span></div>'
    );
  }

  function renderZones() {
    cpzLayer.clearLayers();
    if (!$("layer-cpz").checked) return;

    const moment = selectedMoment();
    const highlightFree = $("layer-cpz-free-now").checked;

    CPZ_ZONES.forEach((zone) => {
      const controlled = isZoneControlled(zone, moment);
      const color = controlled ? "#ef4444" : highlightFree ? COLOR_FREE : "#ef4444";
      L.polygon(zone.polygon, {
        color: color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.06,
        dashArray: controlled ? null : "6 6",
      })
        .bindPopup(zonePopupHtml(zone, controlled))
        .addTo(cpzLayer);
    });
  }

  // ---------- Kerbside (road-level) parking from OpenStreetMap ----------

  const SIDES = ["left", "right", "both"];
  const SIDE_NO_PARKING = ["no", "no_parking", "no_stopping", "no_standing", "separate", "none"];
  const RESTRICTED_CONDITIONS = ["ticket", "residents", "disc", "paid", "customers", "private"];

  /**
   * Read one side of a road's kerbside-parking tags at the chosen moment.
   * Supports the new "parking:left/right/both" scheme, the older
   * "parking:lane:*" scheme, ":conditional" suffixes and
   * "parking:condition:*:time_interval" — so a residents-only street shows
   * as FREE outside its controlled hours.
   * Returns null when that side has no usable parking at that moment.
   */
  function sideInfo(tags, side, moment) {
    const type = tags["parking:" + side] || tags["parking:lane:" + side];
    if (!type || SIDE_NO_PARKING.includes(type)) return null;

    let note = null;

    // Restrictions (no_stopping, loading_only …), possibly time-conditional.
    let restriction = tags["parking:" + side + ":restriction"];
    const restrictionCond = conditionalValue(
      tags["parking:" + side + ":restriction:conditional"], moment
    );
    if (restrictionCond !== undefined) restriction = restrictionCond; // null → lifted now
    if (restriction && restriction !== "none" && restriction !== "no") return null;

    // Fee, possibly time-conditional (e.g. "yes @ (Mo-Sa 08:30-18:30)").
    let fee = tags["parking:" + side + ":fee"] || tags["parking:fee"];
    const feeCondRaw =
      tags["parking:" + side + ":fee:conditional"] || tags["parking:fee:conditional"];
    const feeCond = conditionalValue(feeCondRaw, moment);
    if (feeCond !== undefined) {
      note = "fee rule: " + feeCondRaw;
      if (feeCond !== null) fee = feeCond;
      else if (!fee) fee = "no"; // conditional charge not active now, no base fee
    }

    const access = tags["parking:" + side + ":access"];

    // Old-scheme condition (residents/ticket/…) with optional time interval.
    let condition =
      tags["parking:condition:" + side] || tags["parking:condition:both"];
    const intervalRaw =
      tags["parking:condition:" + side + ":time_interval"] ||
      tags["parking:condition:both:time_interval"];
    let conditionActive = true;
    if (condition && intervalRaw) {
      const spec = parseSpec(intervalRaw);
      if (spec) {
        conditionActive = specMatches(spec, moment);
        note = condition + " " + intervalRaw;
      }
    }

    const maxstay = tags["parking:" + side + ":maxstay"] || tags["parking:maxstay"];

    let status;
    if (access && access !== "yes" && access !== "public") status = "restricted";
    else if (fee === "no" || condition === "free") status = "free";
    else if (fee && fee !== "no") status = "restricted";
    else if (RESTRICTED_CONDITIONS.includes(condition))
      status = conditionActive ? "restricted" : "free"; // outside controlled hours
    else status = "unknown"; // parking mapped, no fee info — usually free, check signs

    return { side, type, fee, access, condition, maxstay, status, note };
  }

  /** Classify a road at a moment: 'free' | 'unknown' | 'restricted' | null. */
  function classifyRoad(tags, moment) {
    const sides = SIDES.map((s) => sideInfo(tags, s, moment)).filter(Boolean);
    if (!sides.length) return null;
    let status = "restricted";
    if (sides.some((s) => s.status === "free")) status = "free";
    else if (sides.some((s) => s.status === "unknown")) status = "unknown";
    return { status, sides };
  }

  function roadPopupHtml(tags, road) {
    const name = escapeHtml(tags.name || "Unnamed road");
    const statusHtml = {
      free:
        '<span class="popup-status-free">Free kerbside parking at the selected time</span>',
      unknown:
        '<span class="popup-status-free">Kerbside parking mapped, no fee recorded — usually free, check signs</span>',
      restricted:
        '<span class="popup-status-controlled">Kerbside parking is permit or paid at the selected time</span>',
    }[road.status];

    const sideRows = road.sides
      .map((s) => {
        const bits = [escapeHtml(s.type.replace(/_/g, " "))];
        if (s.fee) bits.push("fee: " + escapeHtml(s.fee));
        if (s.condition) bits.push(escapeHtml(s.condition));
        if (s.access) bits.push("access: " + escapeHtml(s.access));
        if (s.maxstay) bits.push("max stay " + escapeHtml(s.maxstay));
        if (s.note) bits.push(escapeHtml(s.note));
        return (
          '<div class="popup-row"><span class="label">' +
          s.side + ":</span> " + bits.join(" · ") + "</div>"
        );
      })
      .join("");

    return (
      '<div class="popup-title">' + name + "</div>" +
      '<div class="popup-row">' + statusHtml + "</div>" +
      sideRows +
      '<div class="popup-row"><span class="label">Source: OpenStreetMap kerbside data — always check street signs.</span></div>'
    );
  }

  // ---------- Free car parks via Overpass (OpenStreetMap) ----------

  function overpassQuery(bounds) {
    const bbox = [
      bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast(),
    ].join(",");
    const roadValueRe =
      "lane|street_side|on_kerb|half_on_kerb|shoulder|parallel|diagonal|perpendicular|marked|yes";
    return (
      "[out:json][timeout:30];(" +
      'node["amenity"="parking"]["fee"="no"](' + bbox + ");" +
      'way["amenity"="parking"]["fee"="no"](' + bbox + ");" +
      'way["highway"][~"^parking:(lane:)?(both|left|right)$"~"^(' + roadValueRe + ')"](' + bbox + ");" +
      'way["highway"][~"^parking:condition:(both|left|right)$"~"."](' + bbox + ");" +
      ");out geom 1500;"
    );
  }

  async function fetchOverpass(query) {
    let lastError = null;
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          body: "data=" + encodeURIComponent(query),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        return await response.json();
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("Overpass unavailable");
  }

  function describeParking(tags) {
    const bits = [];
    if (tags.parking) bits.push(tags.parking.replace(/_/g, " "));
    if (tags.access && tags.access !== "yes") bits.push("access: " + tags.access);
    if (tags.capacity) bits.push(tags.capacity + " spaces");
    if (tags.maxstay) bits.push("max stay " + tags.maxstay);
    if (tags.opening_hours) bits.push("open " + tags.opening_hours);
    return bits.join(" · ");
  }

  function carParkPopupHtml(name, metaHtml, statusHtml, sourceNote, lat, lon) {
    return (
      '<div class="popup-title">' + escapeHtml(name) + "</div>" +
      '<div class="popup-row">' + statusHtml + "</div>" +
      (metaHtml ? '<div class="popup-row">' + metaHtml + "</div>" : "") +
      '<div class="popup-row"><a href="https://www.google.com/maps/dir/?api=1&destination=' +
      lat + "," + lon + '" target="_blank" rel="noopener">Directions</a></div>' +
      '<div class="popup-row"><span class="label">' + sourceNote + "</span></div>"
    );
  }

  function makeIcon(bg, fg) {
    return L.divIcon({
      className: "",
      html:
        '<div style="background:' + bg + ";color:" + fg + ';font-weight:800;border-radius:50%;' +
        "width:26px;height:26px;display:flex;align-items:center;justify-content:center;" +
        'border:2px solid ' + fg + ';box-shadow:0 1px 4px rgba(0,0,0,.6);font-size:13px;">P</div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
  }

  const freeIcon = makeIcon(COLOR_FREE, "#052e16");
  const tflIcon = makeIcon(COLOR_TFL, "#0c1a3d");

  // ---------- TfL car parks (second data source) ----------

  let tflCarParksCache = null;

  async function fetchTflCarParks() {
    if (tflCarParksCache) return tflCarParksCache;
    const response = await fetch(TFL_CARPARKS_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    tflCarParksCache = (Array.isArray(data) ? data : []).filter(
      (p) => typeof p.lat === "number" && typeof p.lon === "number"
    );
    return tflCarParksCache;
  }

  // ---------- Scan orchestration ----------

  let scanning = false;
  let lastScan = null; // { osmData, tflData, bounds, problems }
  let lastScanKey = null;

  function roadWeight() {
    const z = map.getZoom();
    return z >= 17 ? 7 : z >= 15 ? 6 : z >= 14 ? 5 : 4;
  }

  function renderResultsList(items) {
    resultsList.innerHTML = "";
    resultsTitle.textContent = "Car parks found (" + items.length + ")";
    if (!items.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent =
        "No car parks found in this view. Look for green roads (free kerbside parking), " +
        "or park in a permit zone outside its controlled hours.";
      resultsList.appendChild(li);
      return;
    }
    items.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML =
        '<span class="result-name">' + escapeHtml(item.name) + "</span>" +
        '<span class="badge ' + (item.free ? "free-badge" : "tfl-badge") + '">' +
        (item.free ? "FREE" : "TfL") + "</span>" +
        (item.meta ? '<div class="result-meta">' + escapeHtml(item.meta) + "</div>" : "");
      li.addEventListener("click", () => {
        map.setView([item.lat, item.lon], 17);
        item.marker.openPopup();
      });
      resultsList.appendChild(li);
    });
  }

  function renderOsmElements(data) {
    freeParkingLayer.clearLayers();
    roadLayer.clearLayers();
    const moment = selectedMoment();
    const weight = roadWeight();
    const carParks = [];
    const roadCounts = { free: 0, unknown: 0, restricted: 0 };

    (data.elements || []).forEach((el) => {
      const tags = el.tags || {};

      if (tags.amenity === "parking") {
        let lat = el.lat, lon = el.lon;
        if (lat == null && el.geometry && el.geometry.length) {
          lat = el.geometry.reduce((s, p) => s + p.lat, 0) / el.geometry.length;
          lon = el.geometry.reduce((s, p) => s + p.lon, 0) / el.geometry.length;
        }
        if (lat == null && el.center) { lat = el.center.lat; lon = el.center.lon; }
        if (lat == null) return;
        const name = tags.name || "Free car park";
        const marker = L.marker([lat, lon], { icon: freeIcon })
          .bindPopup(carParkPopupHtml(
            name,
            escapeHtml(describeParking(tags)),
            '<span class="popup-status-free">Marked fee-free on OpenStreetMap</span>',
            "Source: OpenStreetMap — check signs on arrival.",
            lat, lon
          ))
          .addTo(freeParkingLayer);
        carParks.push({ name, meta: describeParking(tags), lat, lon, marker, free: true });
        return;
      }

      if (tags.highway && el.geometry && el.geometry.length > 1) {
        const road = classifyRoad(tags, moment);
        if (!road) return;
        roadCounts[road.status]++;
        const latlngs = el.geometry.map((p) => [p.lat, p.lon]);
        const color = road.status === "restricted" ? COLOR_RESTRICTED : COLOR_FREE;
        // Dark casing underneath makes the coloured line read like a map overlay.
        L.polyline(latlngs, {
          color: COLOR_CASING, weight: weight + 3, opacity: 0.8,
          lineCap: "round", lineJoin: "round", interactive: false,
        }).addTo(roadLayer);
        L.polyline(latlngs, {
          color: color,
          weight: weight,
          opacity: road.status === "unknown" ? 0.7 : 0.95,
          dashArray: road.status === "unknown"
            ? weight * 1.6 + " " + weight * 2.2
            : null,
          lineCap: "round",
          lineJoin: "round",
        })
          .bindPopup(roadPopupHtml(tags, road))
          .addTo(roadLayer);
      }
    });

    return { carParks, roadCounts };
  }

  function renderTflCarParks(all, bounds) {
    tflLayer.clearLayers();
    const items = [];
    all.forEach((p) => {
      if (!bounds.contains([p.lat, p.lon])) return;
      const name = p.commonName || "Car park";
      const marker = L.marker([p.lat, p.lon], { icon: tflIcon })
        .bindPopup(carParkPopupHtml(
          name, "",
          '<span class="popup-status-tfl">Official TfL car park (usually paid)</span>',
          "Source: Transport for London Unified API.",
          p.lat, p.lon
        ))
        .addTo(tflLayer);
      items.push({ name, meta: "TfL car park", lat: p.lat, lon: p.lon, marker, free: false });
    });
    return items;
  }

  /** Redraw everything from the last fetched data (time change, zoom change). */
  function applyScanData() {
    if (!lastScan) return;
    let carParks = [];
    let roadCounts = null;

    if (lastScan.osmData) {
      const rendered = renderOsmElements(lastScan.osmData);
      carParks = carParks.concat(rendered.carParks);
      roadCounts = rendered.roadCounts;
    }
    if (lastScan.tflData) {
      carParks = carParks.concat(renderTflCarParks(lastScan.tflData, lastScan.bounds));
    }

    carParks.sort((a, b) => (b.free - a.free) || a.name.localeCompare(b.name));
    renderResultsList(carParks);

    const parts = [];
    if (roadCounts) {
      parts.push(
        roadCounts.free + " roads free, " + roadCounts.unknown +
        " likely free (dashed), " + roadCounts.restricted + " permit/paid (amber)"
      );
    }
    if (lastScan.problems.length) parts.push(lastScan.problems.join("; "));
    setStatus(parts.join(" — "));
  }

  async function scanForFreeParking() {
    if (scanning) return;
    if (map.getZoom() < MIN_SCAN_ZOOM) {
      setStatus("Zoom in a little further, then scan again (the search area is too large).", true);
      return;
    }
    const bounds = map.getBounds();
    const key = [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()]
      .map((v) => v.toFixed(3)).join(",");
    if (key === lastScanKey) {
      applyScanData();
      return;
    }

    scanning = true;
    setStatus("Searching OpenStreetMap + TfL for parking in this area…");

    const [osmResult, tflResult] = await Promise.allSettled([
      fetchOverpass(overpassQuery(bounds)),
      fetchTflCarParks(),
    ]);

    const problems = [];
    if (osmResult.status === "rejected") problems.push("OpenStreetMap data unavailable");
    if (tflResult.status === "rejected") problems.push("TfL data unavailable");

    if (osmResult.status === "rejected" && tflResult.status === "rejected") {
      setStatus("Could not reach the parking data services — please try again shortly.", true);
      scanning = false;
      return;
    }

    lastScan = {
      osmData: osmResult.status === "fulfilled" ? osmResult.value : null,
      tflData: tflResult.status === "fulfilled" ? tflResult.value : null,
      bounds: bounds,
      problems: problems,
    };
    lastScanKey = key;
    applyScanData();
    scanning = false;
  }

  // ---------- Search & geolocation ----------

  /** Move the map, then scan once the move (and its animation) has finished. */
  function goToAndScan(latlng, zoom) {
    const target = L.latLng(latlng);
    if (map.getZoom() === zoom && map.getCenter().distanceTo(target) < 5) {
      scanForFreeParking();
      return;
    }
    map.once("moveend", scanForFreeParking);
    map.setView(target, zoom);
  }

  async function searchPlace() {
    const query = searchInput.value.trim();
    if (!query) return;
    setStatus("Searching…");
    try {
      const url =
        NOMINATIM_URL +
        "?format=json&limit=1&countrycodes=gb&viewbox=-0.6,51.75,0.35,51.25&bounded=1&q=" +
        encodeURIComponent(query);
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const results = await response.json();
      if (!results.length) {
        setStatus('No London results for "' + query + '".', true);
        return;
      }
      const place = results[0];
      setStatus("");
      goToAndScan([Number(place.lat), Number(place.lon)], 16);
    } catch (err) {
      setStatus("Search failed — please try again.", true);
    }
  }

  function locateUser() {
    if (!navigator.geolocation) {
      setStatus("Geolocation is not supported by this browser.", true);
      return;
    }
    setStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = [pos.coords.latitude, pos.coords.longitude];
        if (userMarker) userMarker.remove();
        userMarker = L.circleMarker(latlng, {
          radius: 8,
          color: "#38bdf8",
          fillColor: "#38bdf8",
          fillOpacity: 0.9,
        })
          .bindPopup("You are here")
          .addTo(map);
        setStatus("");
        goToAndScan(latlng, 16);
      },
      () => setStatus("Could not get your location — check browser permissions.", true),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // ---------- Wire up controls ----------

  $("search-btn").addEventListener("click", searchPlace);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchPlace();
  });
  $("locate-btn").addEventListener("click", locateUser);
  $("scan-btn").addEventListener("click", scanForFreeParking);

  function onTimeChange() {
    renderZones();
    applyScanData(); // recolour roads for the newly chosen time
  }

  useNowCheckbox.addEventListener("change", () => {
    const useNow = useNowCheckbox.checked;
    daySelect.disabled = useNow;
    timeSelect.disabled = useNow;
    onTimeChange();
  });
  daySelect.addEventListener("change", onTimeChange);
  timeSelect.addEventListener("change", onTimeChange);

  $("layer-cpz").addEventListener("change", renderZones);
  $("layer-cpz-free-now").addEventListener("change", renderZones);

  function bindLayerToggle(checkboxId, layer) {
    $(checkboxId).addEventListener("change", (e) => {
      if (e.target.checked) map.addLayer(layer);
      else map.removeLayer(layer);
    });
  }
  bindLayerToggle("layer-free", freeParkingLayer);
  bindLayerToggle("layer-roads", roadLayer);
  bindLayerToggle("layer-tfl", tflLayer);

  // Auto-refresh the scan as the user pans/zooms (debounced).
  let autoScanTimer = null;
  map.on("moveend", () => {
    if (!$("auto-scan").checked) return;
    if (map.getZoom() < MIN_SCAN_ZOOM) return;
    clearTimeout(autoScanTimer);
    autoScanTimer = setTimeout(scanForFreeParking, 700);
  });

  // Keep line weights sensible when zooming without a re-fetch.
  map.on("zoomend", () => {
    if (lastScan) applyScanData();
  });

  // Keep the "right now" colouring fresh.
  setInterval(() => {
    if (useNowCheckbox.checked) onTimeChange();
  }, 60 * 1000);

  // Initialise the day selector to today for convenience.
  daySelect.value = String(new Date().getDay());
  renderZones();
})();
