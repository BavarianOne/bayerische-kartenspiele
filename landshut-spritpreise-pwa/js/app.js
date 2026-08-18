const CONFIG = {
  DATA_URL: 'data/prices.json',
};

let stationsByFuel = { diesel: [], e10: [], e5: [] };

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  registerSW();
});

async function loadData() {
  try {
    const res = await fetch(CONFIG.DATA_URL, { headers: { 'Accept': 'application/json' }, cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    if (!payload?.fuels) throw new Error('Keine Fuels-Daten');
    
    stationsByFuel = payload.fuels;
    updateTimestamps(payload);
    updateStats(payload);
    renderTable();
  } catch (err) {
    console.error('Fehler beim Laden:', err);
    showError(err.message);
  }
}

function updateTimestamps(payload) {
  const workflowRunAt = payload.workflowRunAt;
  const fetchedAt = payload.fetchedAt;
  
  const formatTime = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };
  
  const workflowEl = document.getElementById('workflowRunAt');
  const fetchedEl = document.getElementById('fetchedAt');
  
  if (workflowEl && workflowRunAt) {
    workflowEl.textContent = `🔄 Letzter GitHub Actions Run: ${formatTime(workflowRunAt)} UTC`;
  }
  if (fetchedEl && fetchedAt) {
    fetchedEl.textContent = `Datenstand: ${formatTime(fetchedAt)}`;
  }
}

function updateStats(payload) {
  const fuels = payload.fuels || {};
  const container = document.getElementById('stats');
  if (!container) return;
  
  const dieselPrices = (fuels.diesel || []).map(s => s.price).filter(Boolean);
  const e10Prices = (fuels.e10 || []).map(s => s.price).filter(Boolean);
  const e5Prices = (fuels.e5 || []).map(s => s.price).filter(Boolean);
  
  function statsHtml(prices, label, colorClass) {
    if (!prices.length) return `<span class="stat-item ${colorClass}">${label}: –</span>`;
    const avg = prices.reduce((a,b) => a+b, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return `<span class="stat-item ${colorClass}">${label}: Ø ${avg.toFixed(3)} € | Min ${min.toFixed(3)} € | Max ${max.toFixed(3)} €</span>`;
  }
  
  container.innerHTML = `
    ${statsHtml(dieselPrices, 'Diesel', 'price-diesel')}
    <br>${statsHtml(e10Prices, 'Super E10', 'price-e10')}
    <br>${statsHtml(e5Prices, 'Super E5', 'price-e5')}
  `;
}

function renderTable() {
  const dieselStations = { ...stationsByFuel.diesel.reduce((acc, s) => { acc[s.name] = s; return acc; }, {}) };
  const e10Stations = { ...stationsByFuel.e10.reduce((acc, s) => { acc[s.name] = s; return acc; }, {}) };
  const e5Stations = { ...stationsByFuel.e5.reduce((acc, s) => { acc[s.name] = s; return acc; }, {}) };
  
  const allNames = new Set();
  [...stationsByFuel.diesel, ...stationsByFuel.e10, ...stationsByFuel.e5].forEach(s => allNames.add(s.name));
  
  const sortedNames = [...allNames].sort((a, b) => {
    const pa = dieselStations[a]?.price ?? 999;
    const pb = dieselStations[b]?.price ?? 999;
    return pa - pb;
  });
  
  const tbody = document.getElementById('stationTbody');
  if (!tbody) return;
  
  tbody.innerHTML = sortedNames.map(name => {
    const d = dieselStations[name] || {};
    const e10 = e10Stations[name] || {};
    const e5 = e5Stations[name] || {};
    
    const addr = STATION_ADDRESSES[name] || '';
    
    function priceHtml(price, cssClass) {
      if (price == null) return `<span class="price-main no-price">–</span>`;
      return `<span class="price-main ${cssClass}">${price.toFixed(3)} €</span>`;
    }
    
    return `<tr>
      <td class="station-name">${name}<br><span class="station-address">${addr}</span></td>
      <td><div class="price-cell">${priceHtml(d.price, 'price-diesel')}</div></td>
      <td><div class="price-cell">${priceHtml(e10.price, 'price-e10')}</div></td>
      <td><div class="price-cell">${priceHtml(e5.price, 'price-e5')}</div></td>
    </tr>`;
  }).join('');
}

const STATION_ADDRESSES = {
  "SIT": "Podewilsstr. 12, 84034 Landshut",
  "Sprint": "Neue Regensburger Str. 37, 84034 Landshut",
  "ESSO": "Siemensstr. 19, 84034 Landshut",
  "ARAL": "Niedermayerstr. 54, 84034 Landshut",
  "Shell": "Weickmannshöhe 1, 84034 Landshut",
  "TotalEnergies": "Oberndorfer Str. 23a, 84034 Landshut",
  "AGIP ENI": "Luitpoldstr. 55, 84034 Landshut",
  "AVIA": "Veldener Str. 52, 84034 Landshut",
};

function showError(msg) {
  const tbody = document.getElementById('stationTbody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 40px; color: #cc0000;">Fehler: ${msg}</td></tr>`;
  }
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/landshut-spritpreise-pwa/sw.js', { scope: '/landshut-spritpreise-pwa/' })
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.warn('SW registration failed:', err));
  }
}