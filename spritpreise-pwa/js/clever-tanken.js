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