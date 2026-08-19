from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

# Find repo root (works both locally and in CI)
REPO_ROOT = Path(__file__).resolve()
while REPO_ROOT != REPO_ROOT.parent and not (REPO_ROOT / ".git").exists():
    REPO_ROOT = REPO_ROOT.parent
DATA_PATH = REPO_ROOT / "spritpreise-pwa" / "data" / "prices.json"
HISTORY_PATH = REPO_ROOT / "spritpreise-pwa" / "data" / "history.json"

LAT = "48.5763411758753"
LON = "12.1714786340021"
ORT = "84030+Ergolding"
RADIUS = 5
SPRITSORTE = {3: "diesel", 5: "e10", 7: "e5"}

FUEL_LABEL = {3: "Diesel", 5: "Super E10", 7: "Super E5"}


def hash_key(lat: str, lon: str, name: str) -> str:
    """Generate a hash key matching the JS version"""
    seed = f"{lat}|{lon}|{name}"
    h = 0
    for ch in seed:
        h = (31 * h + ord(ch)) & 0xFFFFFFFF
    if h >= 2**31:
        h -= 2**32
    return f"ct_{h}"


def fetch_spritsorte(spritsorte: int) -> list[dict]:
    url = (
        f"https://www.clever-tanken.de/tankstelle_liste?"
        f"lat={LAT}&lon={LON}&ort={ORT}&spritsorte={spritsorte}&r={RADIUS}"
    )
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; SpritAlarm/1.0)",
        "Accept-Language": "de-DE,de;q=0.9",
    }
    with httpx.Client(timeout=30, follow_redirects=True, headers=headers) as client:
        response = client.get(url)
        response.raise_for_status()
        text = response.text
    return parse_addpoi(text)


def parse_addpoi(text: str) -> list[dict]:
    import re

    pattern = re.compile(
        r"addPoi\('([^']+)',\s*'([^']+)',\s*'([^']*)',\s*'([^']*)',"
        r"\s*([^,]+),\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*'([^']+)')?\)"
    )
    stations = []
    seen = set()
    for match in pattern.finditer(text):
        lat_s, lon_s, addr, name, _nullish, _id_a, _id_b, radius, price = match.groups()
        if name in {"Standort", "Supermarkt-Tankstelle"}:
            continue
        key = (lat_s, lon_s, name)
        if key in seen:
            continue
        seen.add(key)
        stations.append(
            {
                "lat": lat_s.replace(",", "."),
                "lon": lon_s.replace(",", "."),
                "address": addr or None,
                "name": name,
                "radius": radius,
                "price": float(price.replace(",", ".")) if price else None,
            }
        )
    return stations


def load_history():
    """Load existing history from file"""
    if HISTORY_PATH.exists():
        try:
            with open(HISTORY_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            pass
    return {"entries": []}


def main() -> None:
    now = datetime.now(timezone.utc)
    payload = {
        "fetchedAt": now.isoformat(),
        "workflowRunAt": now.isoformat(),
        "location": {
            "lat": LAT,
            "lon": LON,
            "ort": ORT,
            "radius": RADIUS,
        },
        "fuels": {},
    }
    
    # Load existing history
    history = load_history()
    all_entries = history.get("entries", [])
    
    for sprit, fuel_key in SPRITSORTE.items():
        stations = fetch_spritsorte(sprit)
        payload["fuels"][fuel_key] = stations
        
        # Add to history
        for s in stations:
            if s["price"] is not None:
                station_key = f"{s['name']}|{s['lat']}|{s['lon']}"
                all_entries.append({
                    "timestamp": now.isoformat(),
                    "station_key": station_key,
                    "fuel": FUEL_LABEL[sprit],
                    "price": s["price"]
                })
    
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    
    # Save updated history
    HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    HISTORY_PATH.write_text(json.dumps({"entries": all_entries}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    
    print(f"Wrote {DATA_PATH} at {now.isoformat()}")
    print(f"History entries: {len(all_entries)}")


if __name__ == "__main__":
    main()