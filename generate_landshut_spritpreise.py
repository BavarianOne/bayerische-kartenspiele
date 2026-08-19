#!/usr/bin/env python3
"""
Generiert landshut-spritpreise.html aus data/prices.json
Zeigt auch letzten Workflow-Run (workflowRunAt) an
Enthält: TT/TH/WT/WH, Sparklines, Trend-Indikatoren
"""

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from collections import defaultdict
try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

# German timezone (handles DST automatically)
LOCAL_TZ = ZoneInfo("Europe/Berlin")

# Find repo root (works both locally and in CI)
REPO_ROOT = Path(__file__).resolve().parent
DATA_FILE = REPO_ROOT / "data" / "prices.json"
HISTORY_FILE = REPO_ROOT / "data" / "history.json"
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


def load_prices():
    if not DATA_FILE.exists():
        return {"fuels": {}, "fetchedAt": "", "workflowRunAt": "", "location": {}}
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def load_history():
    if not HISTORY_FILE.exists():
        return {"entries": []}
    with open(HISTORY_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def format_iso_to_de(iso_str):
    """Konvertiert ISO-Timestamp zu deutschem Format (Lokalzeit)"""
    try:
        dt = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
        # Convert UTC to German local time
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt_local = dt.astimezone(LOCAL_TZ)
        return dt_local.strftime("%d.%m.%Y %H:%M") + " Uhr"
    except:
        return iso_str


def compute_price_stats(history_entries, station_name, fuel, lat=None, lon=None):
    """Compute TT, TH, WT, WH, trend, and sparkline data for a station+fuel"""
    # Filter entries for this station+fuel - match by name and optionally lat/lon
    def matches(entry):
        if entry["station_key"].startswith(f"{station_name}|"):
            if lat and lon:
                # Extract lat/lon from station_key
                parts = entry["station_key"].split("|")
                if len(parts) >= 3:
                    entry_lat = float(parts[1])
                    entry_lon = float(parts[2])
                    return abs(entry_lat - float(lat)) < 0.001 and abs(entry_lon - float(lon)) < 0.001
            return True
        return False
    
    entries = [
        {"ts": datetime.fromisoformat(e["timestamp"]).replace(tzinfo=None) if datetime.fromisoformat(e["timestamp"]).tzinfo is None else datetime.fromisoformat(e["timestamp"]).astimezone(timezone.utc).replace(tzinfo=None), "price": e["price"]}
        for e in history_entries
        if matches(e) and e["fuel"] == fuel
    ]
    entries.sort(key=lambda x: x["ts"])
    
    if not entries:
        return None
    
    prices = [e["price"] for e in entries]
    
    # Group by date
    by_date = defaultdict(list)
    for e in entries:
        date_key = e["ts"].date()
        by_date[date_key].append(e["price"])
    
    # Today's stats (TT/TH)
    today = entries[-1]["ts"].date() if entries[-1]["ts"].tzinfo is None else entries[-1]["ts"].astimezone(timezone.utc).date()
    today_prices = by_date.get(today, [])
    tt = min(today_prices) if today_prices else None
    th = max(today_prices) if today_prices else None
    
    # Weekly stats (last 7 days) (WT/WH)
    week_ago = today - timedelta(days=6)
    week_prices = []
    for date, day_prices in by_date.items():
        if date >= week_ago:
            week_prices.extend(day_prices)
    wt = min(week_prices) if week_prices else None
    wh = max(week_prices) if week_prices else None
    
    # Trend: compare latest vs previous
    trend = 'stable'
    if len(prices) >= 2:
        if prices[-1] < prices[-2]:
            trend = 'down'
        elif prices[-1] > prices[-2]:
            trend = 'up'
    
    # Sparkline data (last 30 points, normalized 0-1)
    spark_data = prices[-30:]
    if len(spark_data) >= 2:
        mn, mx = min(spark_data), max(spark_data)
        if mx > mn:
            sparkline = [(p - mn) / (mx - mn) for p in spark_data]
        else:
            sparkline = [0.5] * len(spark_data)
    else:
        sparkline = [0.5]
    
    return {
        'tt': tt, 'th': th, 'wt': wt, 'wh': wh,
        'trend': trend,
        'current': prices[-1] if prices else None,
        'sparkline': sparkline,
        'history_count': len(prices)
    }


def render_sparkline_svg(spark_data, trend):
    """Render inline SVG sparkline"""
    if not spark_data or len(spark_data) < 2:
        return ''
    width = 60
    height = 20
    points = []
    for i, v in enumerate(spark_data):
        x = (i / (len(spark_data) - 1)) * width
        y = height - v * height
        points.append(f"{x},{y}")
    points_str = " ".join(points)
    trend_color = '#c62828' if trend == 'up' else '#2e7d32' if trend == 'down' else '#757575'
    return f'<svg class="sparkline" width="{width}" height="{height}" viewBox="0 0 {width} {height}"><polyline fill="none" stroke="{trend_color}" stroke-width="1.5" points="{points_str}" /></svg>'


def render_stat_badges(stats):
    """Render TT/TH/WT/WH badges"""
    if not stats:
        return ''
    badges = []
    if stats['tt'] is not None:
        badges.append(f'<span class="stat-badge stat-tt" title="Tages-Tief">TT {stats["tt"]:.3f}</span>')
    if stats['th'] is not None:
        badges.append(f'<span class="stat-badge stat-th" title="Tages-Hoch">TH {stats["th"]:.3f}</span>')
    if stats['wt'] is not None:
        badges.append(f'<span class="stat-badge stat-wt" title="Wochen-Tief">WT {stats["wt"]:.3f}</span>')
    if stats['wh'] is not None:
        badges.append(f'<span class="stat-badge stat-wh" title="Wochen-Hoch">WH {stats["wh"]:.3f}</span>')
    return " ".join(badges)


def render_trend_indicator(trend):
    """Render trend arrow"""
    icons = {'up': '▲', 'down': '▼', 'stable': '●'}
    colors = {'up': '#c62828', 'down': '#2e7d32', 'stable': '#757575'}
    labels = {'up': 'steigend', 'down': 'fallend', 'stable': 'stabil'}
    return f'<span class="trend-indicator trend-{trend}" style="color: {colors[trend]}" title="{labels[trend]}">{icons[trend]}</span>'


def build_station_table(data, history):
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
    
    # Sortiert nach Diesel-Preis (günstigste zuerst), None ans Ende
    sorted_names = sorted(all_names, key=lambda n: diesel_stations.get(n, {}).get("price", 999) or 999)
    
    rows = []
    for name in sorted_names:
        d = diesel_stations.get(name, {})
        e10 = e10_stations.get(name, {})
        e5 = e5_stations.get(name, {})
        
        # Adresse bestimmen
        if name == "ESSO":
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
        
        # Compute stats for each fuel type
        diesel_stats = compute_price_stats(history.get("entries", []), name, "Diesel", 
                                          d.get("lat"), d.get("lon"))
        e10_stats = compute_price_stats(history.get("entries", []), name, "Super E10",
                                       e10.get("lat"), e10.get("lon"))
        e5_stats = compute_price_stats(history.get("entries", []), name, "Super E5",
                                      e5.get("lat"), e5.get("lon"))
        
        # Add trend to price headers
        diesel_trend = render_trend_indicator(diesel_stats['trend']) if diesel_stats else ''
        e10_trend = render_trend_indicator(e10_stats['trend']) if e10_stats else ''
        e5_trend = render_trend_indicator(e5_stats['trend']) if e5_stats else ''
        
        # Per-fuel stats rows
        diesel_sparkline = render_sparkline_svg(diesel_stats['sparkline'], diesel_stats['trend']) if diesel_stats else ''
        diesel_badges = render_stat_badges(diesel_stats) if diesel_stats else ''
        e10_sparkline = render_sparkline_svg(e10_stats['sparkline'], e10_stats['trend']) if e10_stats else ''
        e10_badges = render_stat_badges(e10_stats) if e10_stats else ''
        e5_sparkline = render_sparkline_svg(e5_stats['sparkline'], e5_stats['trend']) if e5_stats else ''
        e5_badges = render_stat_badges(e5_stats) if e5_stats else ''
        
        row = f"""<tr>
    <td class="station-name">{name}<br><span class="station-address">{addr}</span></td>
    <td><div class="price-cell">{price_html(diesel_price, "price-diesel")} {diesel_trend}</div></td>
    <td><div class="price-cell">{price_html(e10_price, "price-e10")} {e10_trend}</div></td>
    <td><div class="price-cell">{price_html(e5_price, "price-e5")} {e5_trend}</div></td>
</tr>
<tr class="stats-row">
    <td colspan="4">
        <div class="card-stats">
            <div class="fuel-stats fuel-diesel">
                <span class="fuel-label">Diesel:</span>
                {diesel_sparkline}
                <div class="stat-badges">{diesel_badges}</div>
            </div>
            <div class="fuel-stats fuel-e10">
                <span class="fuel-label">E10:</span>
                {e10_sparkline}
                <div class="stat-badges">{e10_badges}</div>
            </div>
            <div class="fuel-stats fuel-e5">
                <span class="fuel-label">E5:</span>
                {e5_sparkline}
                <div class="stat-badges">{e5_badges}</div>
            </div>
        </div>
    </td>
</tr>"""
        rows.append(row)
    
    return "\n".join(rows)


def generate_html():
    data = load_prices()
    history = load_history()
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
    
    table_rows = build_station_table(data, history)
    
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
        
        /* Stats row */
        .stats-row td {{
            padding: 8px 12px;
            background: #fafafa;
            border-top: 1px solid #eee;
            border-bottom: 1px solid #eee;
        }}
        
        /* Sparkline */
        .sparkline {{
            display: inline-block;
            width: 60px;
            height: 20px;
            vertical-align: middle;
            margin-right: 8px;
        }}
        
        /* Stat badges */
        .stat-badges {{
            display: inline-flex;
            flex-wrap: wrap;
            gap: 6px;
        }}
        .stat-badge {{
            font-size: 0.7rem;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            white-space: nowrap;
        }}
        .stat-tt {{ background: #2e7d32; color: #fff; }}
        .stat-th {{ background: #c62828; color: #fff; }}
        .stat-wt {{ background: #1565c0; color: #fff; }}
        .stat-wh {{ background: #e65100; color: #fff; }}
        
        /* Trend indicator */
        .trend-indicator {{
            font-size: 0.85rem;
            font-weight: 700;
            margin-left: 6px;
            vertical-align: middle;
        }}
        .trend-up {{ color: #c62828; }}
        .trend-down {{ color: #2e7d32; }}
        .trend-stable {{ color: #757575; }}
        
        /* Per-fuel stats */
        .fuel-stats {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-right: 16px;
            padding: 4px 8px;
            background: #f0f0f0;
            border-radius: 6px;
        }}
        .fuel-label {{
            font-size: 0.7rem;
            font-weight: 700;
            color: #555;
            margin-right: 4px;
        }}
        .fuel-diesel .fuel-label {{ color: #0066cc; }}
        .fuel-e10 .fuel-label {{ color: #cc6600; }}
        .fuel-e5 .fuel-label {{ color: #009933; }}
        
        .legend {{ display: flex; gap: 20px; padding: 15px 20px; background: #f8f9fa; font-size: 0.8rem; flex-wrap: wrap; justify-content: center; }}
        .legend-item {{ display: flex; align-items: center; gap: 6px; }}
        .legend-color {{ width: 12px; height: 12px; border-radius: 3px; }}
        footer {{ text-align: center; padding: 15px; color: #666; font-size: 0.75rem; }}
        @media (max-width: 700px) {{
            th, td {{ padding: 6px 8px; font-size: 0.75rem; }}
            th:first-child, td:first-child {{ width: 110px; }}
            .station-name {{ font-size: 0.85rem; }}
            .station-address {{ font-size: 0.65rem; }}
            .sparkline {{ width: 100%; height: 18px; margin: 4px 0; }}
            .stat-badges {{ width: 100%; }}
            .fuel-stats {{ 
                display: block; 
                margin: 4px 0; 
                padding: 6px 8px; 
            }}
            .fuel-label {{
                display: inline-block;
                margin-bottom: 4px;
            }}
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
            🔄 Letzter GitHub Actions Run: {workflow_run_de}
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
    print(f"   History entries: {len(history.get('entries', []))}")


if __name__ == "__main__":
    generate_html()