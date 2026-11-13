# Places I've Been

A personal world map for marking the places you've visited.

## Features

- **World map with pins.** Click anywhere on the map to drop a pin. The app looks up the city and country for you.
- **Search.** Type a city, landmark or address to find it and pin it.
- **Pin details.** Click a pin to edit its name, country, the month you visited, and notes, or to delete it.
- **Places A–Z.** An alphabetical list grouped by first letter, with a filter box. Click an entry to fly to it on the map.
- **By country.** Each country with the number of places you've pinned there, most-visited first. Expand a country to see its places.
- **Totals.** Counts of places, countries and continents.
- **Export / Import.** Back up your pins to a JSON file and load them again on another browser or device.

## Running it

It's a static site with no build step and no API key.

```bash
cd travel-map
python3 -m http.server 8000
# then open http://localhost:8000
```

You can also open `index.html` directly, or host the folder on GitHub Pages, Netlify, etc.

## How it works

- Map: [Leaflet](https://leafletjs.com/) with Esri World Street Map tiles. They're free, need no key, and load even when `index.html` is opened straight from disk. (OpenStreetMap's and CARTO's tile servers refuse pages opened that way.)
- Offline backup map: if the online map can't load, the app switches to bundled country outlines (`world.js`, from [Natural Earth](https://www.naturalearthdata.com/)), so you always have a world map to pin on.
- Place lookup and search: OpenStreetMap's [Nominatim](https://nominatim.org/) geocoder, falling back to [Photon](https://photon.komoot.io/) if Nominatim refuses the request. Both are free for light personal use.
- Storage: your pins are saved in the browser's `localStorage`. They stay on that browser only, so use **Export** to keep a backup.

### Why not Google Maps?

Google Maps needs a Google Cloud API key with billing enabled. Leaflet + OpenStreetMap gives the same pin-on-a-map experience for free. You could swap Google Maps in later by replacing the map tile code near the top of `app.js`.
