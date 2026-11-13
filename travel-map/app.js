// Places I've Been — a personal travel map.
// Data is stored in the browser's localStorage; use Export/Import to back it up or move it.
(function () {
  'use strict';

  const STORAGE_KEY = 'travel-map.places.v1';
  const NOMINATIM = 'https://nominatim.openstreetmap.org';

  // ---------- State ----------
  let places = load();
  const markers = new Map(); // id -> Leaflet marker

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
    } catch (e) {
      alert('Could not save to browser storage. Use Export to keep a copy of your data.');
    }
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---------- Map ----------
  const map = L.map('map', { worldCopyJump: true, minZoom: 2 }).setView([25, 10], 2);
  // CARTO basemap tiles (free, no key). Unlike tile.openstreetmap.org, they also load
  // when index.html is opened straight from disk (file://), which sends no Referer.
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);

  const pinIcon = L.divIcon({
    className: 'pin-icon',
    html: '<span></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -20],
  });

  map.on('click', async (e) => {
    const { lat, lng } = e.latlng;
    const place = {
      id: uid(),
      name: 'Looking up…',
      country: '',
      countryCode: '',
      lat: round(lat),
      lng: round(lng),
      date: '',
      notes: '',
      addedAt: new Date().toISOString(),
    };
    const marker = addMarker(place);
    try {
      const info = await reverseGeocode(lat, lng);
      Object.assign(place, info);
    } catch (err) {
      place.name = `Pin at ${place.lat}, ${place.lng}`;
    }
    places.push(place);
    save();
    render();
    marker.setLatLng([place.lat, place.lng]);
    openEditor(place.id);
  });

  function addMarker(place) {
    const marker = L.marker([place.lat, place.lng], { icon: pinIcon, title: place.name }).addTo(map);
    marker.on('click', () => openEditor(place.id));
    markers.set(place.id, marker);
    return marker;
  }

  function openEditor(id) {
    const place = places.find((p) => p.id === id);
    const marker = markers.get(id);
    if (!place || !marker) return;

    const form = document.getElementById('popup-template').content.firstElementChild.cloneNode(true);
    form.name.value = place.name;
    form.country.value = place.country;
    form.date.value = place.date || '';
    form.notes.value = place.notes || '';

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const newCountry = form.country.value.trim();
      if (newCountry !== place.country) place.countryCode = guessCode(newCountry);
      place.name = form.name.value.trim() || place.name;
      place.country = newCountry;
      place.date = form.date.value;
      place.notes = form.notes.value.trim();
      save();
      render();
      marker.closePopup();
    });
    form.querySelector('.delete').addEventListener('click', () => removePlace(id));

    marker.unbindPopup();
    marker.bindPopup(form, { minWidth: 240 }).openPopup();
  }

  function removePlace(id) {
    const marker = markers.get(id);
    if (marker) map.removeLayer(marker);
    markers.delete(id);
    places = places.filter((p) => p.id !== id);
    save();
    render();
  }

  // If the user types a country name by hand, reuse a code we already know for it.
  function guessCode(countryName) {
    const match = places.find((p) => p.country.toLowerCase() === countryName.toLowerCase() && p.countryCode);
    return match ? match.countryCode : '';
  }

  const round = (n) => Math.round(n * 1e5) / 1e5;

  // ---------- Geocoding (free, no key) ----------
  function bestName(addr, fallback) {
    return (
      addr.city || addr.town || addr.village || addr.hamlet || addr.municipality ||
      addr.suburb || addr.county || addr.state || addr.region || fallback || 'Unnamed place'
    );
  }

  // Nominatim is tried first; if it refuses (it can when the page is opened from disk),
  // Photon (photon.komoot.io, also free and keyless) is used instead.
  const PHOTON = 'https://photon.komoot.io';

  async function getJson(url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // Convert a Photon GeoJSON feature to the Nominatim-like shape the rest of the app uses.
  function fromPhoton(f) {
    const p = f.properties || {};
    const [lon, lat] = f.geometry.coordinates;
    const label = [p.name, p.city !== p.name ? p.city : '', p.state, p.country].filter(Boolean).join(', ');
    return {
      name: p.name || p.city || '',
      display_name: label || `${lat}, ${lon}`,
      lat: String(lat),
      lon: String(lon),
      address: {
        city: p.city || (['city', 'town', 'village', 'hamlet'].includes(p.osm_value) ? p.name : ''),
        county: p.county,
        state: p.state,
        country: p.country || '',
        country_code: (p.countrycode || '').toLowerCase(),
      },
    };
  }

  async function reverseGeocode(lat, lng) {
    let addr, fallbackName;
    try {
      const data = await getJson(
        `${NOMINATIM}/reverse?format=jsonv2&zoom=10&addressdetails=1&accept-language=en&lat=${lat}&lon=${lng}`
      );
      if (data.error) throw new Error(data.error);
      addr = data.address || {};
      fallbackName = data.name;
    } catch (err) {
      const data = await getJson(`${PHOTON}/reverse?lang=en&lat=${lat}&lon=${lng}`);
      if (!data.features || !data.features.length) throw new Error('no result');
      const r = fromPhoton(data.features[0]);
      addr = r.address;
      fallbackName = r.name;
    }
    return {
      name: bestName(addr, fallbackName),
      country: addr.country || '',
      countryCode: (addr.country_code || '').toLowerCase(),
    };
  }

  async function search(query) {
    const q = encodeURIComponent(query);
    try {
      return await getJson(`${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=6&accept-language=en&q=${q}`);
    } catch (err) {
      const data = await getJson(`${PHOTON}/api/?lang=en&limit=6&q=${q}`);
      return (data.features || []).map(fromPhoton);
    }
  }

  // ---------- Search UI ----------
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');

  searchForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const q = searchInput.value.trim();
    if (!q) return;
    searchResults.hidden = false;
    searchResults.innerHTML = '<li class="muted">Searching…</li>';
    try {
      const results = await search(q);
      searchResults.innerHTML = '';
      if (!results.length) {
        searchResults.innerHTML = '<li class="muted">No matches found.</li>';
        return;
      }
      for (const r of results) {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = r.display_name;
        btn.addEventListener('click', () => addFromSearch(r));
        li.appendChild(btn);
        searchResults.appendChild(li);
      }
    } catch (err) {
      searchResults.innerHTML = '<li class="muted">Search is unavailable right now. You can still click the map.</li>';
    }
  });

  document.addEventListener('click', (ev) => {
    if (!searchForm.contains(ev.target)) searchResults.hidden = true;
  });

  function addFromSearch(r) {
    const addr = r.address || {};
    const place = {
      id: uid(),
      name: r.name || bestName(addr, r.display_name.split(',')[0]),
      country: addr.country || '',
      countryCode: (addr.country_code || '').toLowerCase(),
      lat: round(parseFloat(r.lat)),
      lng: round(parseFloat(r.lon)),
      date: '',
      notes: '',
      addedAt: new Date().toISOString(),
    };
    places.push(place);
    save();
    addMarker(place);
    render();
    searchResults.hidden = true;
    searchInput.value = '';
    map.flyTo([place.lat, place.lng], 6, { duration: 1 });
    map.once('moveend', () => openEditor(place.id));
  }

  // ---------- Sidebar ----------
  const placesList = document.getElementById('places-list');
  const countriesList = document.getElementById('countries-list');
  const placesEmpty = document.getElementById('places-empty');
  const filterInput = document.getElementById('filter-input');

  filterInput.addEventListener('input', render);

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
      document.getElementById('panel-places').hidden = tab.dataset.tab !== 'places';
      document.getElementById('panel-countries').hidden = tab.dataset.tab !== 'countries';
    });
  });

  const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
  const flag = (code) =>
    code && code.length === 2
      ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)))
      : '📍';

  function focusPlace(id) {
    const p = places.find((x) => x.id === id);
    if (!p) return;
    map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 6), { duration: 0.8 });
    map.once('moveend', () => openEditor(id));
  }

  function render() {
    // Stats
    const countries = groupByCountry();
    const continents = new Set(
      places.map((p) => window.CONTINENT_BY_CODE[p.countryCode]).filter(Boolean)
    );
    document.getElementById('stat-places').textContent = places.length;
    document.getElementById('stat-countries').textContent = countries.filter((c) => c.name !== 'Unknown').length;
    document.getElementById('stat-continents').textContent = continents.size;

    // Alphabetical list of places
    const filter = filterInput.value.trim().toLowerCase();
    const sorted = [...places]
      .filter((p) => !filter || p.name.toLowerCase().includes(filter) || p.country.toLowerCase().includes(filter))
      .sort((a, b) => collator.compare(a.name, b.name));

    placesList.innerHTML = '';
    let currentLetter = '';
    for (const p of sorted) {
      const letter = (p.name[0] || '#').toUpperCase();
      if (letter !== currentLetter) {
        currentLetter = letter;
        const h = document.createElement('li');
        h.className = 'letter';
        h.textContent = letter;
        placesList.appendChild(h);
      }
      placesList.appendChild(placeRow(p));
    }
    placesEmpty.hidden = places.length > 0;
    placesEmpty.textContent = places.length
      ? ''
      : 'No places yet. Click anywhere on the map or search above to add your first pin.';
    if (places.length && !sorted.length) {
      placesEmpty.hidden = false;
      placesEmpty.textContent = 'No places match that filter.';
    }

    // By-country counts
    countriesList.innerHTML = '';
    for (const c of countries) {
      const li = document.createElement('li');
      li.className = 'country';
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.innerHTML = `<span class="flag">${flag(c.code)}</span><span class="cname"></span><span class="count">${c.places.length}</span>`;
      summary.querySelector('.cname').textContent = c.name;
      details.appendChild(summary);
      const inner = document.createElement('ul');
      inner.className = 'sublist';
      c.places.forEach((p) => inner.appendChild(placeRow(p, true)));
      details.appendChild(inner);
      li.appendChild(details);
      countriesList.appendChild(li);
    }
    if (!countries.length) {
      countriesList.innerHTML = '<li class="empty">Countries you visit will be counted here.</li>';
    }

    // Keep marker tooltips in sync with names
    for (const p of places) {
      const m = markers.get(p.id);
      if (m) m.options.title = p.name;
    }
  }

  function placeRow(p, compact) {
    const li = document.createElement('li');
    li.className = 'place';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.addEventListener('click', () => focusPlace(p.id));
    const name = document.createElement('span');
    name.className = 'pname';
    name.textContent = p.name;
    btn.appendChild(name);
    const meta = document.createElement('span');
    meta.className = 'pmeta';
    const parts = [];
    if (!compact) parts.push(`${flag(p.countryCode)} ${p.country || 'Unknown country'}`);
    if (p.date) parts.push(formatMonth(p.date));
    meta.textContent = parts.join(' · ');
    btn.appendChild(meta);
    li.appendChild(btn);
    return li;
  }

  function formatMonth(value) {
    const [y, m] = value.split('-').map(Number);
    if (!y || !m) return value;
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }

  function groupByCountry() {
    const groups = new Map();
    for (const p of places) {
      const name = p.country || 'Unknown';
      if (!groups.has(name)) groups.set(name, { name, code: p.countryCode, places: [] });
      const g = groups.get(name);
      if (!g.code && p.countryCode) g.code = p.countryCode;
      g.places.push(p);
    }
    const list = [...groups.values()];
    list.forEach((g) => g.places.sort((a, b) => collator.compare(a.name, b.name)));
    // Most-visited first, then alphabetical
    return list.sort((a, b) => b.places.length - a.places.length || collator.compare(a.name, b.name));
  }

  // ---------- Export / Import / Clear ----------
  document.getElementById('export-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(places, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `places-ive-been-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById('import-input').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data)) throw new Error('not a list');
      const known = new Set(places.map((p) => p.id));
      let added = 0;
      for (const raw of data) {
        if (typeof raw.lat !== 'number' || typeof raw.lng !== 'number') continue;
        const p = {
          id: raw.id && !known.has(raw.id) ? String(raw.id) : uid(),
          name: String(raw.name || 'Unnamed place'),
          country: String(raw.country || ''),
          countryCode: String(raw.countryCode || '').toLowerCase(),
          lat: raw.lat,
          lng: raw.lng,
          date: String(raw.date || ''),
          notes: String(raw.notes || ''),
          addedAt: raw.addedAt || new Date().toISOString(),
        };
        known.add(p.id);
        places.push(p);
        addMarker(p);
        added++;
      }
      save();
      render();
      alert(`Imported ${added} place${added === 1 ? '' : 's'}.`);
    } catch (err) {
      alert('That file could not be imported. Choose a JSON file made with Export.');
    }
    ev.target.value = '';
  });

  document.getElementById('clear-btn').addEventListener('click', () => {
    if (!places.length) return;
    if (!confirm(`Remove all ${places.length} places? Export first if you want a backup.`)) return;
    markers.forEach((m) => map.removeLayer(m));
    markers.clear();
    places = [];
    save();
    render();
  });

  // ---------- Boot ----------
  places.forEach(addMarker);
  render();
  if (places.length) {
    map.fitBounds(L.latLngBounds(places.map((p) => [p.lat, p.lng])).pad(0.3), { maxZoom: 5 });
  }
})();
