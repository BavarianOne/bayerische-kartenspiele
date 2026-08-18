const CONFIG = {
  LAT: '48.5763411758753',
  LON: '12.1714786340021',
  ORT: '84030+Ergolding',
  DEFAULT_RADIUS: 5,
  FUELS: [3, 5, 7],
  UI: { REFRESH: 30 * 60 * 1000, NIGHT_START: 22, NIGHT_END: 6 },
};

const DB_NAME = 'spritalarm';
const DB_VER = 1;

let db;
let activeFuel = 3;
let stationsByFuel = { diesel: [], e10: [], e5: [] };

const els = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

document.addEventListener('DOMContentLoaded', () => {
  initDB().then(() => {
    loadConfig();
    bindUI();
    bindTabs();
    render();
    refreshPrices();
    registerSW();
    window.addEventListener('focus', onFocus);
  });
});

async function initDB() {
  db = await idb.open(DB_NAME, DB_VER, (db) => {
    if (!db.objectStoreNames.contains('config')) db.createObjectStore('config', { keyPath: 'key' });
    if (!db.objectStoreNames.contains('favorites')) db.createObjectStore('favorites', { keyPath: 'key' });
    if (!db.objectStoreNames.contains('history')) {
      const store = db.createObjectStore('history', { keyPath: 'key' });
      store.createIndex('ts', 'ts');
    }
    if (!db.objectStoreNames.contains('prices')) db.createObjectStore('prices', { keyPath: 'key' });
  });
}

async function dbPut(store, value) {
  await idb.idbPut(db, store, value);
}
async function dbGet(store, key) {
  return idb.idbGet(db, store, key);
}
async function dbGetAll(store) {
  return idb.idbGetAll(db, store);
}
async function dbDelete(store, key) {
  return idb.idbDelete(db, store, key);
}
async function dbClear(store) {
  return idb.idbClear(db, store);
}

async function loadConfig() {
  const saved = (await dbGet('config', 'location'))?.value;
  if (saved) {
    CONFIG.LAT = saved.LAT ?? CONFIG.LAT;
    CONFIG.LON = saved.LON ?? CONFIG.LON;
    CONFIG.ORT = saved.ORT ?? CONFIG.ORT;
    CONFIG.DEFAULT_RADIUS = saved.radius ?? CONFIG.DEFAULT_RADIUS;
  }
  const nf = await dbGet('config', 'ui');
  if (nf) Object.assign(CONFIG.UI, nf.value);
}

async function onFocus() {
  await refreshPrices();
}

async function refreshPrices() {
  if (await isNight()) {
    showToast('Nachtmodus – keine Aktualisierung', 'info');
    renderCached();
    return;
  }
  showToast('Aktualisiere Preise…', 'info');
  try {
    const data = await fetchAllFuelTypes(CONFIG.LAT, CONFIG.LON, CONFIG.ORT, CONFIG.DEFAULT_RADIUS);
    stationsByFuel = data;
    await storePrices();
    await detectAlarms();
    render();
    showToast('Preise aktualisiert ✔', 'success');
  } catch (err) {
    console.error(err);
    showToast(err.message, 'error');
    renderCached();
  }
}

async function storePrices() {
  const ts = Date.now();
  for (const [fuel, list] of Object.entries(stationsByFuel)) {
    for (const s of list) {
      const key = `${s.key}:${fuel}`;
      const prev = (await dbGet('prices', key))?.price ?? null;
      await dbPut('prices', { key, ts, fuel, stationKey: s.key, name: s.name, price: s.price, lat: s.lat, lon: s.lon, address: s.address, prevPrice: prev });
      await dbPut('history', { key: `${key}__${ts}`, stationKey: s.key, fuel, ts, price: s.price });
    }
  }
}

async function detectAlarms() {
  const prefs = (await dbGet('config', 'alarms'))?.value || { enabled: true, dropPct: 2, absolute: null, favsOnly: false };
  if (!prefs.enabled) return;
  const favs = new Set((await dbGetAll('favorites') || []).map((x) => x.key));
  const alarmed = [];
  for (const [fuel, list] of Object.entries(stationsByFuel)) {
    for (const s of list) {
      if (prefs.favsOnly && !favs.has(s.key)) continue;
      const prev = (await dbGet('prices', `${s.key}:${fuel}`))?.prevPrice;
      if (prev == null || s.price == null) continue;
      const drop = ((prev - s.price) / prev) * 100;
      const belowAbs = prefs.absolute != null && s.price <= prefs.absolute;
      if (drop >= prefs.dropPct || belowAbs) {
        alarmed.push({ s, drop, prev, fuel, belowAbs });
      }
    }
  }
  const badge = document.getElementById('alarmBadge');
  if (alarmed.length) {
    sendAlarmNotification(alarmed);
    badge.textContent = String(alarmed.length);
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

function sendAlarmNotification(alarms) {
  if (Notification.permission !== 'granted') return;
  const body = alarms.map((a) => `${a.s.name}: ${FUEL_LABEL[a.fuel]} jetzt ${a.s.price.toFixed(3)}€`).join('\n');
  try { new Notification('Preisalarm', { body, tag: 'spritalarm', renotify: true }); } catch {}
}

async function isNight() {
  const h = new Date().getHours();
  const start = CONFIG.UI.NIGHT_START ?? 22;
  const end = CONFIG.UI.NIGHT_END ?? 6;
  return h >= start || h < end;
}

function renderCached() {
  const cached = localStorage.getItem('spritalarm.cached');
  if (cached) {
    try { stationsByFuel = JSON.parse(cached); } catch {}
  }
  render();
}

async function render() {
  localStorage.setItem('spritalarm.cached', JSON.stringify(stationsByFuel));
  const list = stationsByFuel[FUEL_MAP[activeFuel]] || [];
  const favs = new Set((await dbGetAll('favorites') || []).map((x) => x.key));
  const sortBy = document.getElementById('sortSelect')?.value || 'price';
  const favOnly = document.getElementById('favOnlyCheck')?.checked || false;
  let items = list.filter((s) => (favOnly ? favs.has(s.key) : true));
  if (sortBy === 'price') items = sortByPrice(items);
  else if (sortBy === 'distance') items = sortByDistance(items);
  else items = sortByName(items);

  const listEl = document.getElementById('stationList');
  if (!items.length) {
    listEl.innerHTML = '';
    document.getElementById('emptyState').hidden = false;
    return;
  }
  document.getElementById('emptyState').hidden = true;
  listEl.innerHTML = items.map((s) => stationCardHTML(s, favs.has(s.key))).join('');
  attachCardActions();
  updateAvgPrice(items);
}

function sortByPrice(items) { return [...items].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)); }
function sortByDistance(items) { return [...items].sort((a, b) => parseFloat(a.radius) - parseFloat(b.radius)); }
function sortByName(items) { return [...items].sort((a, b) => a.name.localeCompare(b.name)); }

function stationCardHTML(s, isFav) {
  const price = s.price != null ? `${s.price.toFixed(3)}€` : '–';
  const meta = [s.distance, s.address].filter(Boolean).join(' · ');
  return `
    <li class="station-card${isFav ? ' fav' : ''}" data-key="${s.key}">
      <div class="card-main">
        <div>
          <h3 class="card-title">${escapeHtml(s.name)}</h3>
          <p class="card-meta">${escapeHtml(meta)}</p>
        </div>
        <div class="card-price">
          <div class="price-value">${price}</div>
          <div class="price-hint">${FUEL_LABEL[activeFuel]}</div>
        </div>
      </div>
      <div class="card-actions">
        <button class="btn-fav${isFav ? ' active' : ''}" data-action="fav">${isFav ? '★' : '☆'}</button>
        <button class="btn-secondary" data-action="navigate" data-lat="${s.lat}" data-lon="${s.lon}" data-name="${escapeAttr(s.name)}">🧭</button>
      </div>
    </li>`;
}

function attachCardActions() {
  document.querySelectorAll('.station-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'fav') toggleFavorite(card);
      else if (action === 'navigate') {
        const { lat, lon, name } = btn.dataset;
        window.open(`https://maps.apple.com/?daddr=${lat},${lon}`);
      }
    });
  });
}

async function toggleFavorite(card) {
  const key = card.dataset.key;
  const existing = await dbGet('favorites', key);
  if (existing) {
    await dbDelete('favorites', key);
    card.classList.remove('fav');
    const btn = card.querySelector('.btn-fav');
    btn.textContent = '☆';
    btn.classList.remove('active');
  } else {
    await dbPut('favorites', { key, ts: Date.now() });
    card.classList.add('fav');
    const btn = card.querySelector('.btn-fav');
    btn.textContent = '★';
    btn.classList.add('active');
  }
}

function updateAvgPrice(items) {
  const prices = items.map((s) => s.price).filter(Boolean);
  if (!prices.length) return;
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const el = document.getElementById(`${FUEL_MAP[activeFuel]}Avg`);
  if (el) el.textContent = `Ø ${avg.toFixed(3)}€`;
}

function bindTabs() {
  document.querySelectorAll('.fuel-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.fuel-tab').forEach((t) => t.setAttribute('aria-selected', 'false'));
      tab.setAttribute('aria-selected', 'true');
      activeFuel = parseInt(tab.dataset.fuel, 10);
      render();
    });
  });
}

function bindUI() {
  document.getElementById('refreshBtn')?.addEventListener('click', () => refreshPrices());
  document.getElementById('sortSelect')?.addEventListener('change', () => render());
  document.getElementById('favOnlyCheck')?.addEventListener('change', () => render());
  bindSettings();
}

function bindSettings() {
  const modal = document.getElementById('settingsModal');
  document.getElementById('settingsBtn')?.addEventListener('click', () => modal?.showModal());
  modal?.querySelector('[value="default"]')?.addEventListener('click', saveSettings);

  document.getElementById('latInput')?.addEventListener('input', (e) => { CONFIG.LAT = e.target.value; });
  document.getElementById('lonInput')?.addEventListener('input', (e) => { CONFIG.LON = e.target.value; });
  document.getElementById('radiusInput')?.addEventListener('input', (e) => { CONFIG.DEFAULT_RADIUS = parseInt(e.target.value, 10); });
  document.getElementById('useCurrentLocation')?.addEventListener('click', useGeoLocation);

  document.getElementById('clearDataBtn')?.addEventListener('click', async () => {
    if (confirm('Alle lokalen Daten löschen?')) {
      await dbClear('history');
      await dbClear('prices');
      showToast('Daten gelöscht', 'info');
    }
  });

  if (document.getElementById('latInput')) document.getElementById('latInput').value = CONFIG.LAT;
  if (document.getElementById('lonInput')) document.getElementById('lonInput').value = CONFIG.LON;
  if (document.getElementById('radiusInput')) document.getElementById('radiusInput').value = String(CONFIG.DEFAULT_RADIUS);
}

async function saveSettings() {
  await dbPut('config', { key: 'location', LAT: CONFIG.LAT, LON: CONFIG.LON, ORT: CONFIG.ORT, radius: CONFIG.DEFAULT_RADIUS });
  await dbPut('config', { key: 'ui', value: CONFIG.UI });
  document.getElementById('settingsModal')?.close();
  refreshPrices();
}

async function useGeoLocation() {
  if (!navigator.geolocation) return showToast('Geolocation nicht verfügbar', 'error');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      CONFIG.LAT = String(pos.coords.latitude);
      CONFIG.LON = String(pos.coords.longitude);
      document.getElementById('latInput').value = CONFIG.LAT;
      document.getElementById('lonInput').value = CONFIG.LON;
      showToast('Standort aktualisiert', 'success');
    },
    (err) => showToast(err.message, 'error')
  );
}

function showToast(text, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = text;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function escapeHtml(str) { return String(str ?? '').replace(/[&<>"]+/g, (c) => ({ '&': '&', '<': '<', '>': '>', '"': '"' }[c])); }
function escapeAttr(str) { return escapeHtml(str); }

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    console.log('SW registered', reg);
    if ('periodicSync' in reg) {
      try { await reg.periodicSync.register('fuel-prices', { minInterval: 30 * 60 * 1000 }); } catch {}
    }
  } catch (err) {
    console.warn('SW nicht registrierbar:', err);
  }
}