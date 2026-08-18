#!/usr/bin/env python3
"""
Update Landshut fuel prices by scraping clever-tanken.de
Saves data to spritpreise-pwa/data/prices.json for the PWA
"""

import json
import re
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Dict, List, Optional


# Configuration
CONFIG = {
    "LAT": "48.5763411758753",
    "LON": "12.1714786340021",
    "ORT": "84030+Ergolding",
    "DEFAULT_RADIUS": 5,
    "FUELS": [3, 5, 7],  # 3=diesel, 5=e10, 7=e5
}

FUEL_MAP = {3: "diesel", 5: "e10", 7: "e5"}
FUEL_LABEL = {3: "Diesel", 5: "Super E10", 7: "Super E5"}

# Regex to parse addPoi() calls from clever-tanken.de
ADD_POI_REGEX = re.compile(
    r"addPoi\('([^']+)',\s*'([^']+)',\s*'([^']*)',\s*'([^']*)',\s*[^,]+,\s*\d+,\s*\d+,\s*\d+(?:,\s*'([^']+)')?\)"
)


def hash_key(lat: str, lon: str, name: str) -> str:
    """Generate a hash key like the JS version"""
    seed = f"{lat}|{lon}|{name}"
    h = 0
    for ch in seed:
        h = (31 * h + ord(ch)) & 0xFFFFFFFF
    # Convert to signed 32-bit int like JS
    if h >= 2**31:
        h -= 2**32
    return f"ct_{h}"


def parse_add_poi(text: str) -> List[Dict]:
    """Parse addPoi calls from clever-tanken HTML"""
    results = []
    for match in ADD_POI_REGEX.finditer(text):
        lat_s, lon_s, addr, name, price = match.groups()
        # Skip non-station entries
        if name in ["Standort", "Supermarkt-Tankstelle"]:
            continue
        lat = lat_s.replace(",", ".")
        lon = lon_s.replace(",", ".")
        price_val = None
        if price:
            try:
                price_val = float(price.replace(",", "."))
            except ValueError:
                pass
        results.append({
            "key": hash_key(lat, lon, name),
            "lat": lat,
            "lon": lon,
            "address": addr or None,
            "name": name,
            "radius": "0",  # clever-tanken doesn't provide radius in addPoi
            "price": price_val,
        })
    return results


def fetch_station_list(lat: str, lon: str, ort: str, spritsorte: int, radius: int) -> List[Dict]:
    """Fetch station list for one fuel type from clever-tanken.de"""
    url = (
        f"https://www.clever-tanken.de/tankstelle_liste"
        f"?lat={urllib.parse.quote(lat)}"
        f"&lon={urllib.parse.quote(lon)}"
        f"&ort={urllib.parse.quote(ort)}"
        f"&spritsorte={spritsorte}"
        f"&r={radius}"
    )
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; SpritAlarm/1.0)",
            "Accept-Language": "de-DE,de;q=0.9",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            text = response.read().decode("utf-8")
        return parse_add_poi(text)
    except Exception as e:
        print(f"  Fehler bei Spritsorte {spritsorte}: {e}")
        return []


def fetch_all_fuel_types(lat: str, lon: str, ort: str, radius: int) -> Dict[str, List[Dict]]:
    """Fetch all fuel types"""
    results = {}
    for sprit in CONFIG["FUELS"]:
        fuel_type = FUEL_MAP[sprit]
        print(f"  Lade {FUEL_LABEL[sprit]}...")
        stations = fetch_station_list(lat, lon, ort, sprit, radius)
        results[fuel_type] = stations
        print(f"    -> {len(stations)} Tankstellen gefunden")
    return results


def main():
    print("=== Landshut Fuel Price Update ===")
    print(f"Standort: {CONFIG['ORT']} ({CONFIG['LAT']}, {CONFIG['LON']})")
    print(f"Radius: {CONFIG['DEFAULT_RADIUS']} km")
    print()

    # Fetch all fuel types
    fuels_data = fetch_all_fuel_types(
        CONFIG["LAT"], CONFIG["LON"], CONFIG["ORT"], CONFIG["DEFAULT_RADIUS"]
    )

    # Prepare output
    output = {
        "fetchedAt": datetime.utcnow().isoformat() + "Z",
        "location": {
            "lat": CONFIG["LAT"],
            "lon": CONFIG["LON"],
            "ort": CONFIG["ORT"],
            "radius": CONFIG["DEFAULT_RADIUS"],
        },
        "fuels": fuels_data,
    }

    # Save to PWA data directory
    output_path = "/root/bayerische-kartenspiele/spritpreise-pwa/data/prices.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print()
    print(f"✅ Gespeichert: {output_path}")
    for fuel_type, stations in fuels_data.items():
        prices = [s["price"] for s in stations if s["price"] is not None]
        if prices:
            avg = sum(prices) / len(prices)
            print(f"  {fuel_type}: {len(stations)} Stationen, Ø {avg:.3f} €")
        else:
            print(f"  {fuel_type}: {len(stations)} Stationen, keine Preise")


if __name__ == "__main__":
    main()