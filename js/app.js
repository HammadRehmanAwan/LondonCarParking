/* London Parking Finder — map logic */
(function () {
  "use strict";

  const LONDON_CENTER = [51.5074, -0.1278];
  const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
  const MIN_SCAN_ZOOM = 13;

  // ---------- Map setup ----------

  const map = L.map("map", { zoomControl: true }).setView(LONDON_CENTER, 12);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' +
      ' &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  }).addTo(map);

  const cpzLayer = L.layerGroup().addTo(map);
  const freeParkingLayer = L.layerGroup().addTo(map);
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
      const color = controlled ? "#ef4444" : highlightFree ? "#22c55e" : "#ef4444";
      L.polygon(zone.polygon, {
        color: color,
        weight: 2,
        fillColor: color,
        fillOpacity: controlled ? 0.18 : 0.12,
        dashArray: controlled ? null : "6 6",
      })
        .bindPopup(zonePopupHtml(zone, controlled))
        .addTo(cpzLayer);
    });
  }

  // ---------- Free parking via Overpass (OpenStreetMap) ----------

  let scanning = false;

  function overpassQuery(bounds) {
    const bbox = [
      bounds.getSouth(),
      bounds.getWest(),
      bounds.getNorth(),
      bounds.getEast(),
    ].join(",");
    return (
      "[out:json][timeout:25];(" +
      'node["amenity"="parking"]["fee"="no"](' + bbox + ");" +
      'way["amenity"="parking"]["fee"="no"](' + bbox + ");" +
      'relation["amenity"="parking"]["fee"="no"](' + bbox + ");" +
      ");out center tags 120;"
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

  function parkingPopupHtml(name, tags, lat, lon) {
    const meta = describeParking(tags);
    return (
      '<div class="popup-title">' + name + "</div>" +
      '<div class="popup-row"><span class="popup-status-free">Marked fee-free on OpenStreetMap</span></div>' +
      (meta ? '<div class="popup-row">' + meta + "</div>" : "") +
      '<div class="popup-row"><a href="https://www.google.com/maps/dir/?api=1&destination=' +
      lat + "," + lon + '" target="_blank" rel="noopener">Directions</a></div>' +
      '<div class="popup-row"><span class="label">Community data — check signs on arrival.</span></div>'
    );
  }

  const freeIcon = L.divIcon({
    className: "",
    html:
      '<div style="background:#22c55e;color:#052e16;font-weight:800;border-radius:50%;' +
      'width:26px;height:26px;display:flex;align-items:center;justify-content:center;' +
      'border:2px solid #052e16;box-shadow:0 1px 4px rgba(0,0,0,.6);font-size:13px;">P</div>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

  function renderResultsList(items) {
    resultsList.innerHTML = "";
    resultsTitle.textContent = "Free parking found (" + items.length + ")";
    if (!items.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent =
        "No fee-free car parks mapped in this view. Try another area, or park in a " +
        "permit zone outside its controlled hours (green zones on the map).";
      resultsList.appendChild(li);
      return;
    }
    items.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML =
        '<span class="result-name">' + item.name + "</span>" +
        '<span class="badge free-badge">FREE</span>' +
        (item.meta ? '<div class="result-meta">' + item.meta + "</div>" : "");
      li.addEventListener("click", () => {
        map.setView([item.lat, item.lon], 17);
        item.marker.openPopup();
      });
      resultsList.appendChild(li);
    });
  }

  async function scanForFreeParking() {
    if (scanning) return;
    if (!$("layer-free").checked) {
      $("layer-free").checked = true;
      map.addLayer(freeParkingLayer);
    }
    if (map.getZoom() < MIN_SCAN_ZOOM) {
      setStatus("Zoom in a little further, then scan again (the search area is too large).", true);
      return;
    }

    scanning = true;
    setStatus("Searching OpenStreetMap for free parking in this area…");
    try {
      const data = await fetchOverpass(overpassQuery(map.getBounds()));
      freeParkingLayer.clearLayers();
      const items = [];

      (data.elements || []).forEach((el) => {
        const lat = el.lat != null ? el.lat : el.center && el.center.lat;
        const lon = el.lon != null ? el.lon : el.center && el.center.lon;
        if (lat == null || lon == null) return;
        const tags = el.tags || {};
        const name = tags.name || "Free parking";
        const marker = L.marker([lat, lon], { icon: freeIcon })
          .bindPopup(parkingPopupHtml(name, tags, lat, lon))
          .addTo(freeParkingLayer);
        items.push({ name, meta: describeParking(tags), lat, lon, marker });
      });

      items.sort((a, b) => a.name.localeCompare(b.name));
      renderResultsList(items);
      setStatus(
        items.length
          ? ""
          : "Nothing marked fee-free here on OpenStreetMap — the list has other suggestions."
      );
    } catch (err) {
      setStatus("Could not reach the OpenStreetMap parking service — please try again shortly.", true);
    } finally {
      scanning = false;
    }
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
      goToAndScan([Number(place.lat), Number(place.lon)], 15);
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
        goToAndScan(latlng, 15);
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

  useNowCheckbox.addEventListener("change", () => {
    const useNow = useNowCheckbox.checked;
    daySelect.disabled = useNow;
    timeSelect.disabled = useNow;
    renderZones();
  });
  daySelect.addEventListener("change", renderZones);
  timeSelect.addEventListener("change", renderZones);

  $("layer-cpz").addEventListener("change", renderZones);
  $("layer-cpz-free-now").addEventListener("change", renderZones);
  $("layer-free").addEventListener("change", (e) => {
    if (e.target.checked) map.addLayer(freeParkingLayer);
    else map.removeLayer(freeParkingLayer);
  });

  // Keep the "right now" colouring fresh.
  setInterval(() => {
    if (useNowCheckbox.checked) renderZones();
  }, 60 * 1000);

  // Initialise the day selector to today for convenience.
  daySelect.value = String(new Date().getDay());
  renderZones();
})();
