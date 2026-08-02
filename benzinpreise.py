#!/usr/bin/env python3
"""
Automatische Benzin- und Dieselpreise Sammler für bayerische-kartenspiele
Holt Tankstellenpreise via Tankerkönig API und erstellt HTML-Seite
Unterstützt mehrere Standorte: Landshut/Ergolding (DE) und Straßwalchen (AT)
"""

import json
import urllib.request
import urllib.parse
import re
from datetime import datetime
from typing import List, Dict, Optional

# ============================================================
# KONFIGURATION - STANDORTE
# ============================================================
# API-Key von https://creativecommons.tankerkoenig.de/ (kostenlos registrieren)
# Demo-Key: 00000000-0000-0000-0000-000000000002 (liefert nur Beispieldaten)
API_KEY = "DEIN_API_KEY_HIER"  # <- HIER EIGENEN KEY EINTRAGEN

# Standorte konfigurieren
STANDORTE = [
    {
        "id": "landshut",
        "name": "Landshut / Ergolding",
        "country": "Deutschland",
        "lat": 48.5296,
        "lng": 12.1616,
        "radius": 10,
        "output_file": "benzinpreise.html",
        "data_file": "benzinpreise-data.json",
    },
    {
        "id": "strasswalchen",
        "name": "Straßwalchen",
        "country": "Österreich",
        "lat": 47.9802,
        "lng": 13.2555,
        "radius": 15,
        "output_file": "benzinpreise-strasswalchen.html",
        "data_file": "benzinpreise-strasswalchen-data.json",
    },
]

# Tankstellen-Marken Farben
BRAND_COLORS = {
    "ARAL": {"bg": "#fff3e0", "border": "#ff9800", "text": "#e65100"},
    "SHELL": {"bg": "#fffde7", "border": "#fdd835", "text": "#f57f17"},
    "ESSEO": {"bg": "#e8f5e9", "border": "#4caf50", "text": "#1b5e20"},
    "TOTAL": {"bg": "#e3f2fd", "border": "#2196f3", "text": "#0d47a1"},
    "AVIA": {"bg": "#fce4ec", "border": "#e91e63", "text": "#880e4f"},
    "OMV": {"bg": "#fff3e0", "border": "#ff9800", "text": "#e65100"},
    "JET": {"bg": "#e0f2f1", "border": "#009688", "text": "#004d40"},
    "HEM": {"bg": "#f3e5f5", "border": "#9c27b0", "text": "#4a148c"},
    "STAR": {"bg": "#fffde7", "border": "#fbc02d", "text": "#f57f17"},
    "ROUTETANK": {"bg": "#e8eaf6", "border": "#3f51b5", "text": "#1a237e"},
    "SB": {"bg": "#efebe9", "border": "#795548", "text": "#3e2723"},
    "FREIE TANKSTELLE": {"bg": "#eceff1", "border": "#607d8b", "text": "#263238"},
    "DEFAULT": {"bg": "#f5f5f5", "border": "#9e9e9e", "text": "#424242"},
}


def get_brand_color(brand: str) -> Dict[str, str]:
    """Gibt Farben für Marke zurück"""
    brand_upper = brand.upper().strip()
    for key in BRAND_COLORS:
        if key in brand_upper or brand_upper in key:
            return BRAND_COLORS[key]
    return BRAND_COLORS["DEFAULT"]


def fetch_tankstellen(standort: Dict) -> List[Dict]:
    """Holt Tankstellen im Umkreis via Tankerkönig API für einen Standort"""
    lat = standort["lat"]
    lng = standort["lng"]
    radius = standort["radius"]
    name = standort["name"]

    if API_KEY == "DEIN_API_KEY_HIER":
        print(f"  [{name}] WARNUNG: Kein API-Key konfiguriert! Nutze Demo-Daten.")
        return get_demo_data(standort)

    url = (
        f"https://creativecommons.tankerkoenig.de/json/list.php"
        f"?lat={lat}&lng={lng}&rad={radius}&sort=dist&type=all&apikey={API_KEY}"
    )

    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=30)
        data = json.loads(response.read().decode('utf-8'))

        if not data.get('ok'):
            print(f"  [{name}] API-Fehler: {data.get('message', 'Unbekannt')}")
            return get_demo_data(standort)

        stations = data.get('stations', [])
        print(f"  [{name}] {len(stations)} Tankstellen gefunden")
        return stations

    except Exception as e:
        print(f"  [{name}] Fehler bei API-Abfrage: {e}")
        return get_demo_data(standort)


def get_demo_data(standort: Dict) -> List[Dict]:
    """Fallback Demo-Daten für den jeweiligen Standort"""
    if standort["id"] == "landshut":
        return get_demo_data_landshut()
    elif standort["id"] == "strasswalchen":
        return get_demo_data_strasswalchen()
    return []


def get_demo_data_landshut() -> List[Dict]:
    """Demo-Daten für Landshut/Ergolding"""
    return [
        {
            "id": "demo-1",
            "name": "ARAL Tankstelle Landshut",
            "brand": "ARAL",
            "street": "Regensburger Str.",
            "houseNumber": "15",
            "place": "Landshut",
            "postCode": 84034,
            "lat": 48.5350,
            "lng": 12.1450,
            "dist": 1.2,
            "e5": 1.789,
            "e10": 1.729,
            "diesel": 1.589,
            "isOpen": True
        },
        {
            "id": "demo-2",
            "name": "Shell Ergolding",
            "brand": "SHELL",
            "street": "Landshuter Str.",
            "houseNumber": "42",
            "place": "Ergolding",
            "postCode": 84030,
            "lat": 48.5900,
            "lng": 12.1550,
            "dist": 2.5,
            "e5": 1.779,
            "e10": 1.719,
            "diesel": 1.579,
            "isOpen": True
        },
        {
            "id": "demo-3",
            "name": "TOTAL Landshut West",
            "brand": "TOTAL",
            "street": "Münchner Str.",
            "houseNumber": "88",
            "place": "Landshut",
            "postCode": 84036,
            "lat": 48.5420,
            "lng": 12.1200,
            "dist": 3.1,
            "e5": 1.759,
            "e10": 1.699,
            "diesel": 1.569,
            "isOpen": True
        },
        {
            "id": "demo-4",
            "name": "Aral Ergolding Nord",
            "brand": "ARAL",
            "street": "Bahnhofstr.",
            "houseNumber": "12",
            "place": "Ergolding",
            "postCode": 84030,
            "lat": 48.5950,
            "lng": 12.1650,
            "dist": 4.2,
            "e5": 1.799,
            "e10": 1.739,
            "diesel": 1.599,
            "isOpen": False
        },
        {
            "id": "demo-5",
            "name": "Freie Tankstelle Altdorf",
            "brand": "FREIE TANKSTELLE",
            "street": "Hauptstr.",
            "houseNumber": "5",
            "place": "Altdorf",
            "postCode": 84032,
            "lat": 48.5700,
            "lng": 12.2100,
            "dist": 5.8,
            "e5": 1.749,
            "e10": 1.689,
            "diesel": 1.559,
            "isOpen": True
        },
        {
            "id": "demo-6",
            "name": "Jet Landshut Süd",
            "brand": "JET",
            "street": "Passauer Str.",
            "houseNumber": "23",
            "place": "Landshut",
            "postCode": 84034,
            "lat": 48.5150,
            "lng": 12.1500,
            "dist": 6.3,
            "e5": 1.739,
            "e10": 1.679,
            "diesel": 1.549,
            "isOpen": True
        },
    ]


def get_demo_data_strasswalchen() -> List[Dict]:
    """Demo-Daten für Straßwalchen, Österreich"""
    return [
        {
            "id": "demo-at-1",
            "name": "OMV Straßwalchen",
            "brand": "OMV",
            "street": "Salzburger Str.",
            "houseNumber": "25",
            "place": "Straßwalchen",
            "postCode": 5204,
            "lat": 47.9810,
            "lng": 13.2560,
            "dist": 0.8,
            "e5": 1.629,
            "e10": 1.579,
            "diesel": 1.519,
            "isOpen": True
        },
        {
            "id": "demo-at-2",
            "name": "Aral Salzburg-Nord",
            "brand": "ARAL",
            "street": "Innsbrucker Bundesstr.",
            "houseNumber": "142",
            "place": "Salzburg",
            "postCode": 5020,
            "lat": 47.8500,
            "lng": 13.0800,
            "dist": 12.5,
            "e5": 1.659,
            "e10": 1.609,
            "diesel": 1.549,
            "isOpen": True
        },
        {
            "id": "demo-at-3",
            "name": "Diskont Tankstelle Neumarkt",
            "brand": "FREIE TANKSTELLE",
            "street": "Hauptstr.",
            "houseNumber": "38",
            "place": "Neumarkt am Wallersee",
            "postCode": 5202,
            "lat": 47.9350,
            "lng": 13.1850,
            "dist": 6.2,
            "e5": 1.599,
            "e10": 1.549,
            "diesel": 1.489,
            "isOpen": True
        },
        {
            "id": "demo-at-4",
            "name": "Shell Seekirchen",
            "brand": "SHELL",
            "street": "Hauptstr.",
            "houseNumber": "55",
            "place": "Seekirchen am Wallersee",
            "postCode": 5201,
            "lat": 47.8900,
            "lng": 13.1500,
            "dist": 9.8,
            "e5": 1.639,
            "e10": 1.589,
            "diesel": 1.529,
            "isOpen": True
        },
        {
            "id": "demo-at-5",
            "name": "BP Tankstelle Obertrum",
            "brand": "OMV",
            "street": "Seestraße",
            "houseNumber": "12",
            "place": "Obertrum am See",
            "postCode": 5162,
            "lat": 47.9200,
            "lng": 13.1300,
            "dist": 11.3,
            "e5": 1.619,
            "e10": 1.569,
            "diesel": 1.509,
            "isOpen": False
        },
    ]


def format_price(price) -> str:
    """Formatiert Preis als String mit 3 Nachkommastellen"""
    if price is False or price is None:
        return "–"
    return f"{float(price):.3f} €"


def generate_html(stationen: List[Dict], standort: Dict, timestamp: str):
    """Generiert HTML-Seite mit Tankstellenpreisen für einen Standort"""

    country = standort["country"]
    name = standort["name"]
    radius = standort["radius"]

    html_content = f"""<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Benzin- & Dieselpreise {name} | Bavarian Card Games</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        h1 {{
            color: #8b4513;
            text-align: center;
            border-bottom: 3px solid #d4af37;
            padding-bottom: 10px;
        }}
        .subtitle {{
            text-align: center;
            color: #666;
            margin-bottom: 20px;
        }}
        .tankstellen-card {{
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin: 15px 0;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }}
        .tankstellen-header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
            flex-wrap: wrap;
            gap: 10px;
        }}
        .tankstellen-name {{
            color: #8b4513;
            font-size: 1.3em;
            font-weight: bold;
        }}
        .tankstellen-brand {{
            font-size: 0.85em;
            padding: 3px 10px;
            border-radius: 12px;
            color: white;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .tankstellen-address {{
            color: #666;
            font-size: 0.9em;
            margin: 5px 0;
        }}
        .tankstellen-dist {{
            color: #2196f3;
            font-size: 0.85em;
            font-weight: bold;
        }}
        .price-table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }}
        .price-table th,
        .price-table td {{
            padding: 12px 15px;
            text-align: center;
            border-bottom: 1px solid #eee;
        }}
        .price-table th {{
            background: #fafafa;
            font-weight: bold;
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .price-table tr:last-child td {{
            border-bottom: none;
        }}
        .price-table tr:hover td {{
            background: #fafafa;
        }}
        .fuel-type {{
            font-weight: bold;
            font-size: 1.1em;
        }}
        .fuel-e5 {{ color: #ff9800; }}
        .fuel-e10 {{ color: #4caf50; }}
        .fuel-diesel {{ color: #2196f3; }}
        .price-value {{
            font-family: 'Courier New', monospace;
            font-size: 1.2em;
            font-weight: bold;
        }}
        .price-value.na {{ color: #999; }}
        .status-badge {{
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: bold;
        }}
        .status-open {{
            background: #e8f5e9;
            color: #2e7d32;
        }}
        .status-closed {{
            background: #ffebee;
            color: #c62828;
        }}
        .last-update {{
            text-align: center;
            color: #666;
            font-size: 0.9em;
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
        }}
        .legend {{
            display: flex;
            justify-content: center;
            gap: 20px;
            margin: 20px 0;
            flex-wrap: wrap;
        }}
        .legend-item {{
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.9em;
            color: #666;
        }}
        .legend-color {{
            width: 20px;
            height: 20px;
            border-radius: 4px;
        }}
        .location-nav {{
            text-align: center;
            margin: 20px 0;
            padding: 15px;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }}
        .location-nav a {{
            display: inline-block;
            margin: 0 10px;
            padding: 8px 16px;
            background: #8b4513;
            color: white;
            text-decoration: none;
            border-radius: 20px;
            font-weight: bold;
            transition: background 0.2s;
        }}
        .location-nav a:hover {{
            background: #a0522d;
        }}
        .location-nav a.current {{
            background: #d4af37;
            color: #8b4513;
        }}
    </style>
</head>
<body>
    <!-- WhatsApp Teilen Buttons -->
    <div class="top-share-banner" style="background-color: #f0f2f5; padding: 12px; text-align: center; border-bottom: 1px solid #ddd; margin-bottom: 20px; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
        <button onclick="shareLinkOnly()" style="background-color: #25D366; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-weight: bold; cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">
            🔗 Nur Link teilen
        </button>
        <button onclick="shareFullContent()" style="background-color: #128C7E; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-weight: bold; cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">
            📱 Inhalt & Preise teilen
        </button>
    </div>

<script>
// Funktion 1: Nur Link teilen
async function shareLinkOnly() {{
    const shareData = {{
        title: document.title,
        text: 'Schau dir diese Seite an:',
        url: window.location.href
    }};
    if (navigator.share) {{
        try {{ await navigator.share(shareData); }}
        catch (err) {{ console.log('Teilen abgebrochen:', err); }}
    }} else {{
        const fallbackUrl = `https://wa.me/?text=${{encodeURIComponent(shareData.text + ' ' + shareData.url)}}`;
        window.open(fallbackUrl, '_blank');
    }}
}}
// Funktion 2: Inhalt + Link teilen
async function shareFullContent() {{
    const contentElement = document.getElementById('preise-inhalt');
    let bodyText = contentElement ? contentElement.innerText.trim() : "Aktuelle Spritpreise!";
    const fullMessage = `${{bodyText}}\\n\\n👉 Hier online ansehen:\\n${{window.location.href}}`;
    if (navigator.share) {{
        try {{ await navigator.share({{ title: document.title, text: fullMessage }}); }}
        catch (err) {{ console.log('Teilen abgebrochen:', err); }}
    }} else {{
        const fallbackUrl = `https://wa.me/?text=${{encodeURIComponent(fullMessage)}}`;
        window.open(fallbackUrl, '_blank');
    }}
}}
</script>

    <h1>⛽ Spritpreise {name}</h1>
    <p class="subtitle">Aktuelle Preise für Super E5, E10 & Diesel · Umkreis {radius} km · {country} · Quelle: Tankerkönig API (MTS-K)</p>

    <div class="location-nav">
        <a href="benzinpreise.html" class="{'current' if standort['id'] == 'landshut' else ''}">🇩🇪 Landshut / Ergolding</a>
        <a href="benzinpreise-strasswalchen.html" class="{'current' if standort['id'] == 'strasswalchen' else ''}">🇦🇹 Straßwalchen (AT)</a>
    </div>

    <div class="legend">
        <div class="legend-item"><div class="legend-color" style="background: #ff9800;"></div>Super E5</div>
        <div class="legend-item"><div class="legend-color" style="background: #4caf50;"></div>Super E10</div>
        <div class="legend-item"><div class="legend-color" style="background: #2196f3;"></div>Diesel</div>
    </div>

    <div class="last-update" style="margin-top: 10px; border-top: none; padding-top: 0;">
        Letzte Aktualisierung: {timestamp}
    </div>

    <!-- Container für alle Preise (für WhatsApp Teilen) -->
    <div id="preise-inhalt">
"""

    for station in stationen:
        brand = station.get('brand', 'UNBEKANNT')
        colors = get_brand_color(brand)
        name_st = station.get('name', 'Ohne Name')
        street = station.get('street', '')
        house_number = station.get('houseNumber', '')
        place = station.get('place', '')
        post_code = station.get('postCode', '')
        dist = station.get('dist', 0)
        is_open = station.get('isOpen', False)

        e5 = station.get('e5')
        e10 = station.get('e10')
        diesel = station.get('diesel')

        address = f"{street} {house_number}, {post_code} {place}".strip(', ')

        status_class = "status-open" if is_open else "status-closed"
        status_text = "🟢 Geöffnet" if is_open else "🔴 Geschlossen"

        html_content += f"""
    <div class="tankstellen-card" style="border-left: 5px solid {colors['border']};">
        <div class="tankstellen-header">
            <div>
                <div class="tankstellen-name">{name_st}</div>
                <span class="tankstellen-brand" style="background: {colors['border']};">{brand}</span>
            </div>
            <div style="text-align: right;">
                <div class="tankstellen-dist">📍 {dist:.1f} km entfernt</div>
                <span class="status-badge {status_class}">{status_text}</span>
            </div>
        </div>
        <div class="tankstellen-address">{address}</div>

        <table class="price-table">
            <thead>
                <tr>
                    <th style="width: 30%;">Kraftstoff</th>
                    <th style="width: 70%;">Preis</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><span class="fuel-type fuel-e5">⛽ Super E5</span></td>
                    <td><span class="price-value {'na' if e5 is False or e5 is None else ''}">{format_price(e5)}</span></td>
                </tr>
                <tr>
                    <td><span class="fuel-type fuel-e10">⛽ Super E10</span></td>
                    <td><span class="price-value {'na' if e10 is False or e10 is None else ''}">{format_price(e10)}</span></td>
                </tr>
                <tr>
                    <td><span class="fuel-type fuel-diesel">⛽ Diesel</span></td>
                    <td><span class="price-value {'na' if diesel is False or diesel is None else ''}">{format_price(diesel)}</span></td>
                </tr>
            </tbody>
        </table>
    </div>
"""

    html_content += f"""
    </div>

    <div class="last-update">
        Datenquelle: <a href="https://creativecommons.tankerkoenig.de" target="_blank" rel="noopener">Tankerkönig API</a> (Markttransparenzstelle für Kraftstoffe MTS-K, Bundeskartellamt) ·
        Lizenz: <a href="https://creativecommons.org/licenses/by/4.0/deed.de" target="_blank" rel="noopener">CC BY 4.0</a> ·
        Stand: {timestamp}
    </div>
</body>
</html>
"""

    with open(standort["output_file"], "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"  HTML-Datei erstellt: {standort['output_file']}")


def main():
    """Hauptprogramm - verarbeitet alle Standorte"""
    print("=" * 60)
    print("Benzin- & Dieselpreise Collector gestartet")
    print(f"Zeit: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    timestamp = datetime.now().strftime("%d.%m.%Y %H:%M Uhr")

    for standort in STANDORTE:
        print(f"\n📍 Verarbeite: {standort['name']} ({standort['country']})")
        print(f"   Koordinaten: {standort['lat']}, {standort['lng']} | Radius: {standort['radius']} km")

        # Tankstellen abfragen
        stationen = fetch_tankstellen(standort)

        if not stationen:
            print(f"   ⚠️  Keine Tankstellen gefunden für {standort['name']}!")
            continue

        # HTML generieren
        generate_html(stationen, standort, timestamp)

        # Metadaten speichern
        metadata = {
            "timestamp": datetime.now().isoformat(),
            "file": standort["output_file"],
            "anzahl_tankstellen": len(stationen),
            "standort": {
                "id": standort["id"],
                "name": standort["name"],
                "country": standort["country"],
                "lat": standort["lat"],
                "lng": standort["lng"],
                "radius": standort["radius"]
            },
        }

        with open(standort["data_file"], "w") as f:
            json.dump(metadata, f, indent=2)

        print(f"   ✅ {len(stationen)} Tankstellen verarbeitet")

    print("\n" + "=" * 60)
    print("Fertig! Alle Standorte verarbeitet.")
    print("=" * 60)


if __name__ == "__main__":
    main()