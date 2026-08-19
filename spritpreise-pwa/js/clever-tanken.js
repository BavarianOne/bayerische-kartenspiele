export const FUEL_MAP = { 3: 'diesel', 5: 'e10', 7: 'e5' };
export const FUEL_LABEL = { 3: 'Diesel', 5: 'Super E10', 7: 'Super E5' };
export const FUEL_ICON = { 3: '🛢', 5: '🚗', 7: '⛽' };
export const FUEL_SPRITSORTE = { diesel: 3, e10: 5, e5: 7 };

const addPoiRegex = /addPoi\('([^']+)',\s*'([^']+)',\s*'([^']*)',\s*'([^']*)',\s*([^,]+),\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*'([^']+)')?\)/g;

function parseAddPoi(text) {
  const out = [];
  let m;
  addPoiRegex.lastIndex = 0;
  while ((m = addPoiRegex.exec(text))) {
    const [all, latS, lonS, addr, name, _nullish, _idA, _idB, radius, price] = m;
    if (['Standort', 'Supermarkt-Tankstelle'].includes(name)) continue;
    out.push({
      key: hashKey({ lat: latS.replace(',', '.'), lon: lonS.replace(',', '.'), name }),
      lat: latS.replace(',', '.'),
      lon: lonS.replace(',', '.'),
      address: addr || null,
      name,
      radius,
      price: price ? parseFloat(price.replace(',', '.')) : null,
    });
  }
  return out;
}

export async function fetchStationList(lat, lon, ort, spritsorte = 3, radius = 5) {
  const url = `https://www.clever-tanken.de/tankstelle_liste?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&ort=${encodeURIComponent(ort)}&spritsorte=${spritsorte}&r=${radius}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SpritAlarm/1.0)', 'Accept-Language': 'de-DE,de;q=0.9' } });
  if (!res.ok) throw new Error(`Tankstellenliste fehlgeschlagen: ${res.status}`);
  const text = await res.text();
  return parseAddPoi(text);
}

export async function fetchAllFuelTypes(lat, lon, ort, radius = 5) {
  const results = {};
  for (const sprit of [3, 5, 7]) {
    const list = await fetchStationList(lat, lon, ort, sprit, radius);
    const type = FUEL_MAP[sprit];
    results[type] = list;
  }
  return results;
}

export function hashKey({ lat, lon, name }) {
  const seed = `${lat}|${lon}|${name}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return `ct_${h}`;
}

// Compute price statistics (TT, TH, WT, WH) and sparkline data
export function computePriceStats(historyEntries, stationKey, fuel, stationLat, stationLon) {
  // Filter entries for this station+fuel - match by name prefix and optionally lat/lon
  const entries = historyEntries
    .filter(e => {
      if (e.fuel !== fuel) return false;
      if (!e.station_key.startsWith(`${stationKey}|`)) return false;
      if (stationLat && stationLon) {
        const parts = e.station_key.split('|');
        if (parts.length >= 3) {
          const entryLat = parseFloat(parts[1]);
          const entryLon = parseFloat(parts[2]);
          return Math.abs(entryLat - stationLat) < 0.001 && Math.abs(entryLon - stationLon) < 0.001;
        }
        return false;
      }
      return true;
    })
    .map(e => ({ ts: new Date(e.timestamp), price: e.price }))
    .sort((a, b) => a.ts - b.ts);
  
  if (!entries.length) return null;
  
  const prices = entries.map(e => e.price);
  
  // Group by date
  const byDate = new Map();
  for (const { ts, price } of entries) {
    const dateKey = ts.toISOString().split('T')[0];
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey).push(price);
  }
  
  // Today's stats (TT/TH)
  const today = entries[entries.length - 1].ts.toISOString().split('T')[0];
  const todayPrices = byDate.get(today) || [];
  const tt = todayPrices.length ? Math.min(...todayPrices) : null;
  const th = todayPrices.length ? Math.max(...todayPrices) : null;
  
  // Weekly stats (last 7 days) (WT/WH)
  const weekAgo = new Date(entries[entries.length - 1].ts);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];
  
  let weekPrices = [];
  for (const [date, dayPrices] of byDate) {
    if (date >= weekAgoStr) weekPrices.push(...dayPrices);
  }
  const wt = weekPrices.length ? Math.min(...weekPrices) : null;
  const wh = weekPrices.length ? Math.max(...weekPrices) : null;
  
  // Trend: compare latest vs previous
  let trend = 'stable';
  if (prices.length >= 2) {
    if (prices[prices.length - 1] < prices[prices.length - 2]) trend = 'down';
    else if (prices[prices.length - 1] > prices[prices.length - 2]) trend = 'up';
  }
  
  // Sparkline data (last 30 points, normalized 0-1)
  const sparkData = prices.slice(-30);
  let sparkline = [0.5];
  if (sparkData.length >= 2) {
    const mn = Math.min(...sparkData);
    const mx = Math.max(...sparkData);
    if (mx > mn) {
      sparkline = sparkData.map(p => (p - mn) / (mx - mn));
    } else {
      sparkline = sparkData.map(() => 0.5);
    }
  }
  
  return {
    tt, th, wt, wh,
    trend,
    current: prices[prices.length - 1],
    sparkline,
    historyCount: prices.length
  };
}