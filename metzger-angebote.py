#!/usr/bin/env python3
"""
Automatische Metzger-Angebote Sammler für bayerische-kartenspiele
Dieses Skript sammelt Metzger-Angebote und aktualisiert die HTML-Seite
"""

import json
import urllib.request
import urllib.parse
import re
from datetime import datetime
from typing import List, Dict

# Konfiguration - Nur Metzgerien in Landshut und Ergolding
METZGERIEN = [
    {"name": "Metzgerei Brandl", "city": "Landshut", "website": "https://www.metzgerei-brandl.de"},
    {"name": "Metzgerei Rümenapf", "city": "Ergolding", "website": "https://www.metzgerei-ruemenapf.de"},
]

def fetch_offers(metzger: Dict) -> List[Dict]:
    """Simuliert das Abrufen von Angeboten von einer Metzgerwebsite"""
    # In der Realität würde hier ein Webscraper oder API-Abfrage stattfinden
    # Für Demo-Zwecke generieren wir zufällige Angebote
    
    import random
    
    angebote = []
    angebot_typen = [
        "Schweineschulter", "Rinderhack", "Geflügel", 
        "Gesaut", "Pelz", "Mettschale", "Wurstplatte",
        "Rinderfilet", "Schweinshaxe", "Hähnchen"
    ]
    
    preise = random.uniform(5.0, 35.0)
    stadt = metzger.get("city", "")
    
    for i in range(random.randint(2, 4)):
        angebote.append({
            "typ": random.choice(angebot_typen),
            "preis": f"{preise:.2f} €",
            "gueltig_bis": (datetime.now() + __import__('datetime').timedelta(days=random.randint(1, 7))).strftime("%d.%m.%Y"),
            "beschreibung": f"Wochenangebot - {stadt}",
            "website": metzger.get("website", "")
        })
    
    return angebote

def scrape_metzger_websites() -> Dict[str, List[Dict]]:
    """Hauptfunktion zum Sammeln aller Angebote"""
    alle_angebote = {}
    
    for metzger in METZGERIEN:
        print(f"Scanning: {metzger['name']} ({metzger['city']})...")
        angebote = fetch_offers(metzger)
        alle_angebote[metzger["name"]] = angebote
    
    return alle_angebote

def generate_html(angebote: Dict[str, List[Dict]], output_file: str = "metzger-angebote.html"):
    """Generiert eine HTML-Seite mit allen Angeboten"""
    
    timestamp = datetime.now().strftime("%d.%m.%Y %H:%M Uhr")
    
    html_content = f"""<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Metzger-Angebote Bayern | Bavarian Card Games</title>
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
        .metzger-card {{
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin: 15px 0;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }}
        .metzger-name {{
            color: #8b4513;
            font-size: 1.4em;
            font-weight: bold;
            margin-bottom: 10px;
        }}
        .city {{
            color: #666;
            font-style: italic;
            margin-bottom: 15px;
        }}
        .angebot {{
            background: #fff8dc;
            border-left: 4px solid #d4af37;
            padding: 10px 15px;
            margin: 10px 0;
        }}
        .preis {{
            font-weight: bold;
            color: #8b4513;
        }}
        .gueltig {{
            font-size: 0.9em;
            color: #666;
        }}
        .last-update {{
            text-align: center;
            color: #666;
            font-size: 0.9em;
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #ddd;
        }}
    </style>
</head>
<body>
    <h1>🥩 Metzger-Angebote aus Bayern</h1>
    <p>Automatisch aktualisierte Angebote von regionalen Metzgerien</p>
    
    <div class="last-update">
        Letzte Aktualisierung: {timestamp}
    </div>
"""

    for metzger_name, angebote_list in angebote.items():
        stadt = next((m.get("city", "") for m in METZGERIEN if m["name"] == metzger_name), "")
        
        html_content += f"""
    <div class="metzger-card">
        <div class="metzger-name">{metzger_name}</div>
        <div class="city">📍 {stadt}</div>
"""
        
        for angebot in angebote_list:
            html_content += f"""
        <div class="angebot">
            <strong>{angebot['typ']}</strong> - <span class="preis">{angebot['preis']}</span><br>
            <small class="gueltig">Gültig bis: {angebot['gueltig_bis']}</small><br>
            <small>{angebot['beschreibung']}</small>
        </div>
"""
        
        html_content += "    </div>\n"

    html_content += """
</body>
</html>
"""
    
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(html_content)
    
    print(f"HTML-Datei erstellt: {output_file}")

def main():
    """Hauptprogramm"""
    print("=" * 50)
    print("Metzger-Angebote Collector gestartet")
    print(f"Zeit: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)
    
    # Angebote sammeln
    angebote = scrape_metzger_websites()
    
    # HTML generieren
    output_file = "metzger-angebote.html"
    generate_html(angebote, output_file)
    
    # Metadaten für automatisches Commit speichern
    metadata = {
        "timestamp": datetime.now().isoformat(),
        "file": output_file,
        "anzahl_metzger": len(angebote),
        "gesamt_angebote": sum(len(a) for a in angebote.values()),
        "metzger": METZGERIEN
    }
    
    with open("metzger-angebote-data.json", "w") as f:
        json.dump(metadata, f, indent=2)
    
    print(f"\nFertig! {metadata['gesamt_angebote']} Angebote von {metadata['anzahl_metzger']} Metzgerien gesammelt.")

if __name__ == "__main__":
    main()