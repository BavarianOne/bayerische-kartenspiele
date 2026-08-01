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

# Konfiguration - Metzgerien in Landshut, Ergolding und Umgebung
METZGERIEN = [
    {"name": "Metzgerei Brandl", "city": "Landshut", "website": "https://www.metzgerei-brandl.de"},
    {"name": "Metzgerei Rümenapf", "city": "Ergolding", "website": "https://www.metzgerei-ruemenapf.de"},
    {"name": "Metzgerei Wasner", "city": "Landshut", "website": "https://www.metzgereiwasner.de/angebote/"},
    {"name": "Metzgerei Tristlhof", "city": "Landshut", "website": ""},
    {"name": "Metzgerei Hahn", "city": "Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
]

def fetch_brandl_offers() -> List[Dict]:
    """Holt Angebote von Metzgerei Brandl (PDF-basiert) - ALLE zukünftigen Wochen"""
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
        
        # Finde ALLE PDF-Links für Angebote
        pdf_pattern = r'href="(/uploads/media/[^"]*angebot-vom-[^"]*\.pdf)"'
        pdf_links = re.findall(pdf_pattern, html)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_pdf_links = []
        for link in pdf_links:
            if link not in seen:
                seen.add(link)
                unique_pdf_links.append(link)
        
        print(f"  Brandl: {len(unique_pdf_links)} eindeutige PDF-Wochen gefunden")
        
        # Parse ALLE PDFs (jede Woche)
        for pdf_link in unique_pdf_links:
            pdf_url = "https://www.metzgerei-brandl.de" + pdf_link
            print(f"  Brandl PDF: {pdf_url}")
            
            try:
                pdf_req = urllib.request.Request(pdf_url, headers={'User-Agent': 'Mozilla/5.0'})
                pdf_response = urllib.request.urlopen(pdf_req, timeout=30)
                pdf_data = pdf_response.read()
                
                with pdfplumber.open(io.BytesIO(pdf_data)) as pdf:
                    # Extrahiere Gültigkeitsdatum aus dem Header (vor dem Parsen der Angebote)
                    gueltig_bis = ""
                    for page in pdf.pages:
                        text = page.extract_text()
                        if text:
                            date_match = re.search(r'(\d{2}\.\d{2}\.\s*-\s*\d{2}\.\d{2}\.\d{2})', text)
                            if date_match:
                                gueltig_bis = date_match.group(1).split('-')[-1].strip()
                                break
                    
                    # Jetzt parse die Angebote mit dem gefundenen Datum
                    for page in pdf.pages:
                        text = page.extract_text()
                        if text:
                            lines = text.split('\n')
                            for line in lines:
                                line = line.strip()
                                match = re.search(r'^(.+?)\s+(\d+,\d{2})\s*€', line)
                                if match:
                                    name = match.group(1).strip()
                                    preis = match.group(2) + " €"
                                    name = re.sub(r'\s+\d+\s*g\s*$', '', name, flags=re.IGNORECASE)
                                    if name and len(name) > 2:
                                        angebote.append({
                                            "typ": name,
                                            "preis": preis,
                                            "gueltig_bis": gueltig_bis,
                                            "beschreibung": f"Wochenangebot - Landshut (gültig bis {gueltig_bis})" if gueltig_bis else "Wochenangebot - Landshut",
                                            "website": "https://www.metzgerei-brandl.de"
                                        })
            except Exception as e:
                print(f"  Fehler bei Brandl PDF {pdf_url}: {e}")
                continue
                
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
    """Holt Angebote von Metzgerei Rümenapf (HTML-Tabellen) - NUR ZUKÜNFTIGE Wochen"""
    angebote = []
    
    try:
        url = "https://www.metzgerei-ruemenapf.de/"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=30)
        html = response.read().decode('utf-8')
        
        # Finde ALLE Angebots-Abschnitte
        # Pattern: <h2>Angebot v. DD.MM.YYYY - DD.MM.YYYY</h2><table class="angebote">...</table>
        angebot_sections = re.findall(r'<h2>(Angebot v\.[^<]+)</h2>\s*<table class="angebote">(.*?)</table>', html, re.DOTALL)
        
        print(f"  Rümenapf: {len(angebot_sections)} Wochen insgesamt gefunden")
        
        # Heute als Vergleichsdatum
        heute = datetime.now().date()
        
        # Parse ALLE Wochen, aber filter vergangene
        zukuenftige_wochen = 0
        for date_header, table_html in angebot_sections:
            print(f"  Rümenapf: {date_header}")
            
            # Extrahiere Gültigkeitsdatum (Ende der Woche)
            gueltig_bis_str = date_header.split('-')[-1].strip().replace('Angebot v.', '').strip()
            
            # Parse Datum für Vergleich (Format: DD.MM.YYYY)
            try:
                gueltig_bis = datetime.strptime(gueltig_bis_str, "%d.%m.%Y").date()
            except ValueError:
                print(f"  Warnung: Ungültiges Datumsformat '{gueltig_bis_str}', überspringe Woche")
                continue
            
            # NUR WOCHEN DIE NOCH NICHT VORBEI SIND (gueltig_bis >= heute)
            if gueltig_bis < heute:
                print(f"  -> Überspringe vergangene Woche (bis {gueltig_bis_str})")
                continue
            
            zukuenftige_wochen += 1
            print(f"  -> Nimm Woche (bis {gueltig_bis_str})")
            
            # Extrahiere Zeilen aus der Tabelle
            rows = re.findall(r'<tr[^>]*>.*?</tr>', table_html, re.DOTALL)
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
                            "gueltig_bis": gueltig_bis_str,
                            "beschreibung": f"Wochenangebot - Ergolding (gültig bis {gueltig_bis_str})",
                            "website": "https://www.metzgerei-ruemenapf.de"
                        })
        
        print(f"  Rümenapf: {zukuenftige_wochen} zukünftige Wochen genommen")
                
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

def fetch_wasner_offers() -> List[Dict]:
    """Holt Angebote von Metzgerei Wasner (nur Bild-Links, daher Hinweis)"""
    # Wasner bietet Angebote nur als JPG-Flyer an - kein strukturierter Text
    # Wir geben einen Link-Hinweis zurück
    return [{
        "typ": "📸 Wochenangebote als Flyer-Bilder (KW 30/31)",
        "preis": "",
        "gueltig_bis": "01.08.2026",
        "beschreibung": "Filiale Landshut: Am alten Viehmarkt 5, 84028 Landshut | Angebote nur als Bilder verfügbar - siehe Website",
        "website": "https://www.metzgereiwasner.de/angebote/"
    }]

def fetch_tristlhof_offers() -> List[Dict]:
    """Statische Angebote für Metzgerei Tristlhof (manuell gepflegt)"""
    # Angebote für 03.08.2026 - 08.08.2026
    return [
        {"typ": "frische Hähnchenbrust (natur oder gewürzt)", "preis": "1,49 € / 100 g", "gueltig_bis": "08.08.2026", "beschreibung": "frisch und eiweißreich - Wochenangebot - Landshut", "website": ""},
        {"typ": "Salami-Aufschnitt (gut gemischt, gut gereift)", "preis": "1,99 € / 100 g", "gueltig_bis": "08.08.2026", "beschreibung": "Frisch aus Stadler's Wurstküche - Wochenangebot - Landshut", "website": ""},
        {"typ": "Dicke oder Regensburger (hausgemacht, frisch vom Rauch)", "preis": "1,19 € / 100 g", "gueltig_bis": "08.08.2026", "beschreibung": "Wochenangebot - Landshut", "website": ""},
        {"typ": "Leberkäse (täglich frisch)", "preis": "1,19 € / 100 g", "gueltig_bis": "08.08.2026", "beschreibung": "Wochenangebot - Landshut", "website": ""},
        {"typ": "🥩 Hackfleischtag (Mo): Mageres Schwein & Rind", "preis": "4,98 € / 500 g", "gueltig_bis": "08.08.2026", "beschreibung": "Aktionstag Montag - Landshut", "website": ""},
        {"typ": "🥩 Haxentag (Sa): Frisch & kross", "preis": "0,79 € / 100 g", "gueltig_bis": "08.08.2026", "beschreibung": "Aktionstag Samstag - Landshut", "website": ""},
    ]

def fetch_hahn_offers() -> List[Dict]:
    """Statische Angebote für Metzgerei Hahn Eggenfelden (OCR aus Bild extrahiert)"""
    # Angebote für KW 31/32 (extrahiert aus ANGEBOTE.png)
    return [
        {"typ": "Färsen-Hackfleisch", "preis": "12,00 € / kg (500g = 6,00 €)", "gueltig_bis": "08.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        {"typ": "Frischwurst-Aufschnitt", "preis": "9,90 € / kg (500g = 4,95 €)", "gueltig_bis": "08.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        {"typ": "Gyros-Pfanne", "preis": "10,99 €", "gueltig_bis": "08.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        {"typ": "Lyoner-Stange", "preis": "3,99 €", "gueltig_bis": "08.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        {"typ": "Schweinelendchen im Ganzen", "preis": "6,99 €", "gueltig_bis": "08.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        {"typ": "Rauchfrische Wiener", "preis": "10,49 €", "gueltig_bis": "08.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        {"typ": "Unsere Scharfen", "preis": "9,99 €", "gueltig_bis": "08.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        {"typ": "Grillfleisch", "preis": "Preis auf Anfrage", "gueltig_bis": "08.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        {"typ": "Ententeile gefroren", "preis": "Preis auf Anfrage", "gueltig_bis": "08.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        {"typ": "Fisch gefroren", "preis": "Preis auf Anfrage", "gueltig_bis": "08.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        {"typ": "Sauerkonserven", "preis": "Preis auf Anfrage", "gueltig_bis": "08.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
    ]

def fetch_offers(metzger: Dict) -> List[Dict]:
    """Dispatcher für den richtigen Scraper"""
    name = metzger.get("name", "")
    if "Brandl" in name:
        return fetch_brandl_offers()
    elif "Rümenapf" in name or "Ruemenapf" in name:
        return fetch_ruemenapf_offers()
    elif "Wasner" in name:
        return fetch_wasner_offers()
    elif "Tristlhof" in name:
        return fetch_tristlhof_offers()
    elif "Hahn" in name:
        return fetch_hahn_offers()
    else:
        return []

def scrape_metzger_websites() -> Dict[str, List[Dict]]:
    """Hauptfunktion zum Sammeln aller Angebote"""
    alle_angebote = {}
    
    for metzger in METZGERIEN:
        print(f"Scanning: {metzger['name']} ({metzger['city']})....")
        angebote = fetch_offers(metzger)
        alle_angebote[metzger["name"]] = angebote
        print(f"  -> {len(angebote)} Angebote gefunden")
    
    return alle_angebote

def generate_html(angebote: Dict[str, List[Dict]], output_file: str = "metzger-angebote.html"):
    """Generiert eine HTML-Seite mit allen Angeboten, gruppiert nach Wochen"""
    
    timestamp = datetime.now().strftime("%d.%m.%Y %H:%M Uhr")
    
    # Farbpalette für Wochen-Abgrenzung
    WEEK_COLORS = [
        {"bg": "#fff3e0", "border": "#ff9800", "header_bg": "#ffe0b2", "header_text": "#e65100"},  # Orange
        {"bg": "#e8f5e9", "border": "#4caf50", "header_bg": "#c8e6c9", "header_text": "#1b5e20"},  # Grün
        {"bg": "#e3f2fd", "border": "#2196f3", "header_bg": "#bbdefb", "header_text": "#0d47a1"},  # Blau
        {"bg": "#fce4ec", "border": "#e91e63", "header_bg": "#f8bbd0", "header_text": "#880e4f"},  # Pink
        {"bg": "#f3e5f5", "border": "#9c27b0", "header_bg": "#e1bee7", "header_text": "#4a148c"},  # Violett
        {"bg": "#e0f2f1", "border": "#009688", "header_bg": "#b2dfdb", "header_text": "#004d40"},  # Teal
    ]
    
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
        .week-section {{
            margin: 20px 0;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }}
        .week-header {{
            padding: 15px 20px;
            font-weight: bold;
            font-size: 1.1em;
            color: white;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
        }}
        .week-content {{
            padding: 15px 20px;
        }}
        .angebot {{
            background: #fff8dc;
            border-left: 4px solid #d4af37;
            padding: 12px 15px;
            margin: 10px 0;
            border-radius: 0 8px 8px 0;
            transition: transform 0.2s, box-shadow 0.2s;
        }}
        .angebot:hover {{
            transform: translateX(5px);
            box-shadow: 2px 2px 8px rgba(0,0,0,0.1);
        }}
        .angebot-header {{
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 5px;
        }}
        .angebot-name {{
            font-weight: bold;
            color: #8b4513;
            font-size: 1.05em;
        }}
        .angebot-preis {{
            font-weight: bold;
            color: #d4af37;
            font-size: 1.1em;
            background: #8b4513;
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
        }}
        .angebot-desc {{
            font-size: 0.85em;
            color: #666;
            margin-top: 4px;
        }}
        .angebot-link {{
            display: inline-block;
            margin-top: 8px;
            padding: 4px 12px;
            background: #8b4513;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-size: 0.85em;
            transition: background 0.2s;
        }}
        .angebot-link:hover {{
            background: #a0522d;
        }}
        .last-update {{
            text-align: center;
            color: #666;
            font-size: 0.9em;
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
        }}
        .empty-week {{
            text-align: center;
            color: #999;
            font-style: italic;
            padding: 20px;
        }}
    </style>
</head>
<body>
    <!-- WhatsApp Teilen Buttons - ganz oben -->
    <div class="top-share-banner" style="background-color: #f0f2f5; padding: 12px; text-align: center; border-bottom: 1px solid #ddd; margin-bottom: 20px; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
  
  <!-- Button 1: Nur Link -->
  <button onclick="shareLinkOnly()" style="background-color: #25D366; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-weight: bold; cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">
    🔗 Nur Link teilen
  </button>

  <!-- Button 2: Inhalt teilen -->
  <button onclick="shareFullContent()" style="background-color: #128C7E; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-weight: bold; cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">
    📱 Inhalt & Angebote teilen
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
    try {{
      await navigator.share(shareData);
    }} catch (err) {{
      console.log('Teilen abgebrochen:', err);
    }}
  }} else {{
    const fallbackUrl = `https://wa.me/?text=${{encodeURIComponent(shareData.text + ' ' + shareData.url)}}`;
    window.open(fallbackUrl, '_blank');
  }}
}}

// Funktion 2: Inhalt + Link teilen
async function shareFullContent() {{
  const contentElement = document.getElementById('angebote-inhalt');
  let bodyText = "";
  
  if (contentElement) {{
    bodyText = contentElement.innerText.trim();
  }} else {{
    bodyText = "Schau dir diese aktuellen Angebote an!";
  }}

  const fullMessage = `${{bodyText}}\n\n👉 Hier online ansehen:\n${{window.location.href}}`;

  if (navigator.share) {{
    try {{
      await navigator.share({{
        title: document.title,
        text: fullMessage
      }});
    }} catch (err) {{
      console.log('Teilen abgebrochen:', err);
    }}
  }} else {{
    const fallbackUrl = `https://wa.me/?text=${{encodeURIComponent(fullMessage)}}`;
    window.open(fallbackUrl, '_blank');
  }}
}}
</script>

    <h1>🥩 Metzger-Angebote aus Bayern</h1>
    <p style="text-align: center; color: #666;">Automatisch aktualisierte Angebote von regionalen Metzgerien</p>
    
    <div class="last-update">
        Letzte Aktualisierung: {timestamp}
    </div>

    <!-- Container für alle Angebote (für WhatsApp Teilen) -->
    <div id="angebote-inhalt">
"""

    for metzger_name, angebote_list in angebote.items():
        stadt = next((m.get("city", "") for m in METZGERIEN if m["name"] == metzger_name), "")
        
        # Gruppiere Angebote nach Gültigkeitsdatum (Woche)
        wochen = {}
        for angebot in angebote_list:
            gueltig = angebot.get('gueltig_bis', '')
            if gueltig not in wochen:
                wochen[gueltig] = []
            wochen[gueltig].append(angebot)
        
        # Sortiere Wochen nach Datum
        sorted_weeks = sorted(wochen.items(), key=lambda x: x[0] if x[0] else 'zzz')
        
        html_content += f"""
    <div class="metzger-card">
        <div class="metzger-name">{metzger_name}</div>
        <div class="city">📍 {stadt}</div>
"""
        
        if not sorted_weeks or (len(sorted_weeks) == 1 and not sorted_weeks[0][0]):
            # Fallback für Metzgereien ohne Wochen-Datumsangabe (z.B. Wasner)
            html_content += f"""
        <div class="week-section" style="border-left: 4px solid #8b4513;">
            <div class="week-header" style="background: #8b4513;">Aktuelle Angebote</div>
            <div class="week-content">
"""
            for angebot in angebote_list:
                gueltig = f"Gültig bis: {angebot['gueltig_bis']}" if angebot.get('gueltig_bis') else ""
                website_link = f'<a href="{angebot["website"]}" target="_blank" rel="noopener" class="angebot-link">Zur Website</a>' if angebot.get('website') else ""
                html_content += f"""
            <div class="angebot">
                <div class="angebot-header">
                    <span class="angebot-name">{angebot['typ']}</span>
                    <span class="angebot-preis">{angebot['preis']}</span>
                </div>
                <div class="angebot-desc">{angebot['beschreibung']}</div>
                {f'<div>{website_link}</div>' if website_link else ''}
            </div>
"""
            html_content += """
            </div>
        </div>
"""
        else:
            # Normale Wochen-Anzeige
            for week_idx, (gueltig_bis, wochen_angebote) in enumerate(sorted_weeks):
                color = WEEK_COLORS[week_idx % len(WEEK_COLORS)]
                
                # Versuche Wochenanfang aus Beschreibung zu extrahieren
                wochen_beschreibung = f"Woche bis {gueltig_bis}"
                if wochen_angebote and 'beschreibung' in wochen_angebote[0]:
                    desc = wochen_angebote[0]['beschreibung']
                    # Suche nach Datumsbereich in Beschreibung
                    import re
                    date_range = re.search(r'(\d{2}\.\d{2}\.\s*-\s*\d{2}\.\d{2}\.\d{2})', desc)
                    if date_range:
                        wochen_beschreibung = date_range.group(1)
                
                html_content += f"""
        <div class="week-section" style="border-left: 5px solid {color['border']};">
            <div class="week-header" style="background: {color['border']};">{wochen_beschreibung}</div>
            <div class="week-content" style="background: {color['bg']};">
"""
                for angebot in wochen_angebote:
                    gueltig = f"Gültig bis: {angebot['gueltig_bis']}" if angebot.get('gueltig_bis') else ""
                    website_link = f'<a href="{angebot["website"]}" target="_blank" rel="noopener" class="angebot-link">Zur Website</a>' if angebot.get('website') else ""
                    html_content += f"""
                <div class="angebot">
                    <div class="angebot-header">
                        <span class="angebot-name">{angebot['typ']}</span>
                        <span class="angebot-preis">{angebot['preis']}</span>
                    </div>
                    <div class="angebot-desc">{angebot['beschreibung']}</div>
                    {f'<div>{website_link}</div>' if website_link else ''}
                </div>
"""
                html_content += """
            </div>
        </div>
"""
        
        html_content += "    </div>\n"

    html_content += """
</div>

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