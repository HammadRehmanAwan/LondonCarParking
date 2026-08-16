# London Parking Finder 🅿️

A lightweight web app for finding **free parking areas** and **resident permit /
controlled parking zones (CPZs)** across London.

## Features

- **Interactive map** of London (Leaflet + OpenStreetMap/CARTO tiles).
- **Free parking search** — queries live OpenStreetMap data (via the Overpass
  API) for car parks and parking areas tagged as fee-free in the current map
  view, lists them in the sidebar, and links each one to driving directions.
- **Permit zone (CPZ) layer** — indicative outlines of well-known controlled
  parking zones across 20+ boroughs, each with its typical controlled hours and
  a link to the borough's official parking pages.
- **"Free right now" calculator** — permit zones are normally free to everyone
  outside their controlled hours. The map recolours zones green when they are
  uncontrolled at the current (or a chosen) day and time, so you can see at a
  glance where you could park for free this evening or on Sunday.
- **Place search** (Nominatim geocoding, biased to Greater London) and
  **use-my-location** support.
- Responsive layout that works on mobile.

## Running it

It's a static site — no build step or backend required.

```bash
# from the repo root, any static server works, e.g.:
python3 -m http.server 8000
# then open http://localhost:8000
```

Or simply open `index.html` in a browser (an internet connection is needed for
map tiles, search and the free-parking data).

## Project structure

```
index.html      – page layout and controls
css/styles.css  – styling (dark theme, responsive)
js/data.js      – indicative CPZ/permit-zone dataset (boundaries + hours)
js/app.js       – map, time logic, Overpass/Nominatim integration
```

## Data & accuracy

- Free-parking markers come from **OpenStreetMap** (`amenity=parking` with
  `fee=no`) — community-maintained data, refreshed live on every scan.
- CPZ boundaries and hours in `js/data.js` are **simplified and indicative**.
  Boroughs change zones and hours frequently; every zone popup links to the
  council's own parking pages for confirmation.
- None of this is legal advice — **always read the signs on the street** before
  leaving your car.
