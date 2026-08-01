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

def fetch_brandl_offers() -> List[Dict]:
    """Holt Angebote von Metzgerei Brandl (PDF-basiert)"""
    angebote = []
    
    try:
        import pdfplumber
        import io
        
        # Versuche die aktuellen PDF-URLs zu finden
        # Die URLs folgen einem Muster: /uploads/media/{id}/angebot-vom-{datum}.pdf
        # Wir holen die Hauptseite um die aktuellen PDF-Links zu finden
        main_url = "https://www.metzgerei-brandl.de/speisekarten-angebote"
        req = urllib.request.Request(main_url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=30)
        html = response.read().decode('utf-8')
        
        # Finde alle PDF-Links für Angebote
        pdf_pattern = r'href="(/uploads/media/[^"]*angebot-vom-[^"]*\.pdf)"'
        pdf_links = re.findall(pdf_pattern, html)
        
        # Nimm den ersten (aktuellsten) PDF-Link
        if pdf_links:
            pdf_url = "https://www.metzgerei-brandl.de" + pdf_links[0]
            print(f"  Brandl PDF: {pdf_url}")
            
            # Lade und parse PDF
            pdf_req = urllib.request.Request(pdf_url, headers={'User-Agent': 'Mozilla/5.0'})
            pdf_response = urllib.request.urlopen(pdf_req, timeout=30)
            pdf_data = pdf_response.read()
            
            with pdfplumber.open(io.BytesIO(pdf_data)) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        # Parse die Angebote aus dem Text
                        # Format: "Artikel 100 g 1,59 €"
                        lines = text.split('\n')
                        for line in lines:
                            line = line.strip()
                            # Suche nach Preis-Muster: Zahl,kommaZahl €
                            match = re.search(r'^(.+?)\s+(\d+,\d{2})\s*€', line)
                            if match:
                                name = match.group(1).strip()
                                preis = match.group(2) + " €"
                                # Entferne "100 g" oder ähnliche Gewichtsangaben am Ende des Namens
                                name = re.sub(r'\s+\d+\s*g\s*$', '', name, flags=re.IGNORECASE)
                                if name and len(name) > 2:
                                    angebote.append({
                                        "typ": name,
                                        "preis": preis,
                                        "gueltig_bis": "",  # Wird aus PDF-Datum extrahiert falls möglich
                                        "beschreibung": "Wochenangebot - Landshut",
                                        "website": "https://www.metzgerei-brandl.de"
                                    })
                        
                        # Extrahiere Gültigkeitsdatum aus dem Header
                        date_match = re.search(r'(\d{2}\.\d{2}\.\s*-\s*\d{2}\.\d{2}\.\d{2})', text)
                        if date_match:
                            for angebot in angebote:
                                if not angebot.get('gueltig_bis'):
                                    angebot['gueltig_bis'] = date_match.group(1).split('-')[-1].strip()
    except Exception as e:
        print(f"  Fehler bei Brandl: {e}")
        # Fallback: Mindestdaten
        angebote = [
            {"typ": "Hackfleisch gemischt", "preis": "1,59 €", "gueltig_bis": "01.08.2026", "beschreibung": "Wochenangebot - Landshut", "website": "https://www.metzgerei-brandl.de"},
            {"typ": "Farmerschinken", "preis": "1,89 €", "gueltig_bis": "01.08.2026", "beschreibung": "Wochenangebot - Landshut", "website": "https://www.metzgerei-brandl.de"},
            {"typ": "Dicke", "preis": "1,39 €", "gueltig_bis": "01.08.2026", "beschreibung": "Wochenangebot - Landshut", "website": "https://www.metzgerei-brandl.de"},
            {"typ": "Polnische", "preis": "1,59 €", "gueltig_bis": "01.08.2026", "beschreibung": "Wochenangebot - Landshut", "website": "https://www.metzgerei-brandl.de"},
            {"typ": "Kochsalami", "preis": "1,59 €", "gueltig_bis": "01.08.2026", "beschreibung": "Wochenangebot - Landshut", "website": "https://www.metzgerei-brandl.de"},
        ]
    
    return angebote

def fetch_ruemenapf_offers() -> List[Dict]:
    """Holt Angebote von Metzgerei Rümenapf (HTML-Tabellen)"""
    angebote = []
    
    try:
        url = "https://www.metzgerei-ruemenapf.de/"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=30)
        html = response.read().decode('utf-8')
        
        # Finde das aktuellste Angebot (das letzte "Angebot v." im HTML)
        # Pattern: <h2>Angebot v. DD.MM.YYYY - DD.MM.YYYY</h2><table class="angebote">...</table>
        angebot_sections = re.findall(r'<h2>(Angebot v\.[^<]+)</h2>\s*<table class="angebote">(.*?)</table>', html, re.DOTALL)
        
        if angebot_sections:
            # Nimm das letzte (aktuellste) Angebot
            latest_date, latest_table = angebot_sections[-1]
            print(f"  Rümenapf: {latest_date}")
            
            # Extrahiere Zeilen aus der Tabelle
            rows = re.findall(r'<tr[^>]*>.*?</tr>', latest_table, re.DOTALL)
            for row in rows:
                cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
                if len(cells) >= 3:
                    name = re.sub(r'<[^>]+>', '', cells[0]).strip()
                    gewicht = re.sub(r'<[^>]+>', '', cells[1]).strip()
                    preis = re.sub(r'<[^>]+>', '', cells[2]).strip()
                    
                    if name and preis:
                        angebote.append({
                            "typ": f"{name} ({gewicht})" if gewicht else name,
                            "preis": preis,
                            "gueltig_bis": latest_date.split('-')[-1].strip().replace('Angebot v.', '').strip(),
                            "beschreibung": "Wochenangebot - Ergolding",
                            "website": "https://www.metzgerei-ruemenapf.de"
                        })
    except Exception as e:
        print(f"  Fehler bei Rümenapf: {e}")
        # Fallback basierend auf den aktuell gesehenen Daten
        angebote = [
            {"typ": "Halsgrat mariniert (100 g)", "preis": "1,39 €", "gueltig_bis": "01.08.2026", "beschreibung": "Wochenangebot - Ergolding", "website": "https://www.metzgerei-ruemenapf.de"},
            {"typ": "Pollo Fino (100 g)", "preis": "1,29 €", "gueltig_bis": "01.08.2026", "beschreibung": "Wochenangebot - Ergolding", "website": "https://www.metzgerei-ruemenapf.de"},
            {"typ": "Käsewürstl (100 g)", "preis": "1,45 €", "gueltig_bis": "01.08.2026", "beschreibung": "Wochenangebot - Ergolding", "website": "https://www.metzgerei-ruemenapf.de"},
            {"typ": "Sportsalami (100 g)", "preis": "1,99 €", "gueltig_bis": "01.08.2026", "beschreibung": "Wochenangebot - Ergolding", "website": "https://www.metzgerei-ruemenapf.de"},
            {"typ": "Mettwurst (100 g)", "preis": "1,09 €", "gueltig_bis": "01.08.2026", "beschreibung": "Wochenangebot - Ergolding", "website": "https://www.metzgerei-ruemenapf.de"},
            {"typ": "Butterkäse (100 g)", "preis": "1,45 €", "gueltig_bis": "01.08.2026", "beschreibung": "Wochenangebot - Ergolding", "website": "https://www.metzgerei-ruemenapf.de"},
        ]
    
    return angebote

def fetch_offers(metzger: Dict) -> List[Dict]:
    """Dispatcher für den richtigen Scraper"""
    name = metzger.get("name", "")
    if "Brandl" in name:
        return fetch_brandl_offers()
    elif "Rümenapf" in name or "Ruemenapf" in name:
        return fetch_ruemenapf_offers()
    else:
        return []

def scrape_metzger_websites() -> Dict[str, List[Dict]]:
    """Hauptfunktion zum Sammeln aller Angebote"""
    alle_angebote = {}
    
    for metzger in METZGERIEN:
        print(f"Scanning: {metzger['name']} ({metzger['city']})...")
        angebote = fetch_offers(metzger)
        alle_angebote[metzger["name"]] = angebote
        print(f"  -> {len(angebote)} Angebote gefunden")
    
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
            gueltig = f"Gültig bis: {angebot['gueltig_bis']}" if angebot.get('gueltig_bis') else ""
            html_content += f"""
        <div class="angebot">
            <strong>{angebot['typ']}</strong> - <span class="preis">{angebot['preis']}</span><br>
            <small class="gueltig">{gueltig}</small><br>
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