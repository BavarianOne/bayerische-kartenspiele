#!/usr/bin/env python3
"""
Generiert landshut-spritpreise.html aus spritpreise-pwa/data/prices.json
Zeigt auch letzten Workflow-Run (workflowRunAt) an
"""

import json
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path("/root/bayerische-kartenspiele")
DATA_FILE = REPO_ROOT / "spritpreise-pwa" / "data" / "prices.json"
OUTPUT_FILE = REPO_ROOT / "landshut-spritpreise.html"

# Tankstellen-Adressen Mapping (aus clever-tanken)
STATION_ADDRESSES = {
    "SIT": "Podewilsstr. 12, 84034 Landshut",
    "Sprint": "Neue Regensburger Str. 37, 84034 Landshut",
    "ESSO": "Siemensstr. 19, 84034 Landshut",  # wird durch mehrere überschrieben
    "ARAL": "Niedermayerstr. 54, 84034 Landshut",
    "Shell": "Weickmannshöhe 1, 84034 Landshut",
    "TotalEnergies": "Oberndorfer Str. 23a, 84034 Landshut",
    "AGIP ENI": "Luitpoldstr. 55, 84034 Landshut",
    "AVIA": "Veldener Str. 52, 84034 Landshut",
}

# Mehrere ESSO-Stationen unterscheiden
ESSO_ADDRESSES = {
    "ESSO (Siemensstr.)": "Siemensstr. 19, 84034 Landshut",
    "ESSO (Neue Regensburger Str.)": "Neue Regensburger Str. 44, 84034 Landshut",
    "ESSO (Am Aicher Feld)": "Am Aicher Feld 1, 84034 Landshut",
    "ESSO (Luitpoldstr.)": "Luitpoldstr. 34, 84034 Landshut",
    "ESSO (Ludwig-Erhard-Str.)": "Ludwig-Erhard-Str. 14, 84034 Landshut",
    "ESSO (Äußere Parkstr.)": "Äußere Parkstr. 21, 84034 Landshut",
    "ESSO (Hofmark-Aich-Str.)": "Hofmark-Aich-Str. 22, 84034 Landshut",
}

def load_prices():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def format_iso_to_de(iso_str):
    """Konvertiert ISO-Timestamp zu deutschem Format"""
    try:
        dt = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
        return dt.strftime("%d.%m.%Y %H:%M")
    except:
        return iso_str

def build_station_table(data):
    """Baut HTML-Tabelle aus Preisdaten"""
    fuels = data.get("fuels", {})
    diesel_stations = {s["name"]: s for s in fuels.get("diesel", [])}
    e10_stations = {s["name"]: s for s in fuels.get("e10", [])}
    e5_stations = {s["name"]: s for s in fuels.get("e5", [])}
    
    # Alle einzigartigen Stationen sammeln
    all_names = set()
    all_names.update(diesel_stations.keys())
    all_names.update(e10_stations.keys())
    all_names.update(e5_stations.keys())
    
    # Sortiert nach Diesel-Preis (günstigste zuerst)
    sorted_names = sorted(all_names, key=lambda n: diesel_stations.get(n, {}).get("price", 999))
    
    rows = []
    for name in sorted_names:
        d = diesel_stations.get(name, {})
        e10 = e10_stations.get(name, {})
        e5 = e5_stations.get(name, {})
        
        # Adresse bestimmen
        if name == "ESSO":
            # Mehrere ESSO - wir nutzen die erste mit Adresse
            addr = "Siemensstr. 19, 84034 Landshut"
        elif name == "Shell":
            addr = "Weickmannshöhe 1, 84034 Landshut"
        else:
            addr = STATION_ADDRESSES.get(name, "")
        
        diesel_price = d.get("price")
        e10_price = e10.get("price")
        e5_price = e5.get("price")
        
        def price_html(price, css_class):
            if price is None:
                return f'<span class="price-main no-price">–</span>'
            return f'<span class="price-main {css_class}">{price:.3f} €</span>'
        
        row = f"""<tr>
    <td class="station-name">{name}<br><span class="station-address">{addr}</span></td>
    <td><div class="price-cell">{price_html(diesel_price, "price-diesel")}</div></td>
    <td><div class="price-cell">{price_html(e10_price, "price-e10")}</div></td>
    <td><div class="price-cell">{price_html(e5_price, "price-e5")}</div></td>
</tr>"""
        rows.append(row)
    
    return "\n".join(rows)

def generate_html():
    data = load_prices()
    fuels = data.get("fuels", {})
    
    # Timestamps
    workflow_run_at = data.get("workflowRunAt", "")
    fetched_at = data.get("fetchedAt", "")
    
    workflow_run_de = format_iso_to_de(workflow_run_at) if workflow_run_at else "–"
    fetched_de = format_iso_to_de(fetched_at) if fetched_at else "–"
    
    # Stats berechnen
    diesel_prices = [s["price"] for s in fuels.get("diesel", []) if s.get("price")]
    e10_prices = [s["price"] for s in fuels.get("e10", []) if s.get("price")]
    e5_prices = [s["price"] for s in fuels.get("e5", []) if s.get("price")]
    
    def stats_html(prices, label):
        if not prices:
            return f"<span>{label}: –</span>"
        avg = sum(prices) / len(prices)
        min_p = min(prices)
        max_p = max(prices)
        return f'<span>{label}: Ø {avg:.3f} € | Min {min_p:.3f} € | Max {max_p:.3f} €</span>'
    
    stats = f"""
    <div style="text-align:center; margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 8px; font-size: 0.85rem;">
        {stats_html(diesel_prices, "Diesel")}
        <br>{stats_html(e10_prices, "Super E10")}
        <br>{stats_html(e5_prices, "Super E5")}
    </div>
    """
    
    table_rows = build_station_table(data)
    
    html = f"""<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spritpreise Landshut - Diesel, Super E10, Super E5</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }}
        .container {{ max-width: 1000px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }}
        header {{ background: #1a73e8; color: white; padding: 20px; text-align: center; }}
        h1 {{ margin: 0; font-size: 1.5rem; }}
        .updated {{ font-size: 0.85rem; opacity: 0.9; margin-top: 5px; }}
        .workflow-info {{ background: #e8f0fe; color: #1a73e8; padding: 8px 16px; font-size: 0.8rem; text-align: center; border-bottom: 1px solid #d0e3ff; }}
        table {{ width: 100%; border-collapse: collapse; font-size: 0.9rem; table-layout: fixed; }}
        th, td {{ padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; }}
        th {{ background: #f8f9fa; font-weight: 600; color: #333; position: sticky; top: 0; white-space: nowrap; }}
        th:first-child, td:first-child {{ width: 120px; }}
        th:nth-child(2), td:nth-child(2) {{ width: 25%; min-width: 140px; }}
        th:nth-child(3), td:nth-child(3) {{ width: 25%; min-width: 140px; }}
        th:nth-child(4), td:nth-child(4) {{ width: 25%; min-width: 140px; }}
        tr:hover {{ background: #fafafa; }}
        .station-name {{ font-weight: 600; color: #1a73e8; }}
        .station-address {{ font-weight: normal; font-size: 0.75rem; color: #666; display: block; margin-top: 2px; white-space: normal; }}
        .price-cell {{ display: flex; flex-direction: column; gap: 2px; }}
        .price-main {{ font-weight: 700; font-size: 1.05rem; white-space: nowrap; }}
        .price-diesel {{ color: #0066cc; }}
        .price-e10 {{ color: #cc6600; }}
        .price-e5 {{ color: #009933; }}
        .no-price {{ color: #999; font-style: italic; font-size: 1.05rem; }}
        .legend {{ display: flex; gap: 20px; padding: 15px 20px; background: #f8f9fa; font-size: 0.8rem; flex-wrap: wrap; justify-content: center; }}
        .legend-item {{ display: flex; align-items: center; gap: 6px; }}
        .legend-color {{ width: 12px; height: 12px; border-radius: 3px; }}
        footer {{ text-align: center; padding: 15px; color: #666; font-size: 0.75rem; }}
        @media (max-width: 700px) {{
            th, td {{ padding: 6px 8px; font-size: 0.75rem; }}
            th:first-child, td:first-child {{ width: 110px; }}
            .station-name {{ font-size: 0.85rem; }}
            .station-address {{ font-size: 0.65rem; }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>⛽ Spritpreise Landshut</h1>
            <div class="updated">Datenstand: {fetched_de}</div>
        </header>
        <div class="workflow-info">
            🔄 Letzter GitHub Actions Run: {workflow_run_de} UTC
        </div>
        {stats}
        <table>
            <thead>
                <tr>
                    <th>Tankstelle</th>
                    <th>Diesel</th>
                    <th>Super E10</th>
                    <th>Super E5</th>
                </tr>
            </thead>
            <tbody>
{table_rows}
            </tbody>
        </table>
        <div class="legend">
            <div class="legend-item"><span class="legend-color" style="background:#0066cc"></span> Diesel</div>
            <div class="legend-item"><span class="legend-color" style="background:#cc6600"></span> Super E10</div>
            <div class="legend-item"><span class="legend-color" style="background:#009933"></span> Super E5</div>
        </div>
        <footer>
            Datenquelle: <a href="https://www.clever-tanken.de/tankstelle_liste?ort=Landshut" target="_blank">clever-tanken.de</a> (MTS-K)<br>
            Preise können abweichen. Stand: {fetched_de} | Auto-Update alle 30 Min (07-20:30 Uhr)
        </footer>
    </div>
</body>
</html>"""
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(html)
    
    # Unique station count
    all_names = set()
    for fuel_list in fuels.values():
        for s in fuel_list:
            all_names.add(s["name"])
    
    print(f"✅ Generiert: {OUTPUT_FILE}")
    print(f"   Letzter Workflow-Run: {workflow_run_de}")
    print(f"   Datenstand: {fetched_de}")
    print(f"   Stationen: {len(all_names)}")

if __name__ == "__main__":
    generate_html()