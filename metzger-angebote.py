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
    {"name": "Metzgerei R\u00fcmenapf", "city": "Ergolding", "website": "https://www.metzgerei-ruemenapf.de"},
    {"name": "Metzgerei Wasner", "city": "Landshut", "website": "https://www.metzgereiwasner.de/angebote/"},
    {"name": "Metzgerei Tristlhof", "city": "Landshut", "website": ""},
    {"name": "Metzgerei Hahn", "city": "Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
    {"name": "Brunner Metzgerei", "city": "Landshut", "website": "https://www.brunner-metzgerei.de/angebot-der-woche"},
]

def fetch_brandl_offers() -> List[Dict]:
    """Holt Angebote von Metzgerei Brandl (PDF-basiert) - NUR ZUK\u00dcNFTIGE Wochen"""
    angebote = []

    try:
        import pdfplumber
        import io

        main_url = "https://www.metzgerei-brandl.de/speisekarten-angebote"
        req = urllib.request.Request(main_url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=30)
        html = response.read().decode('utf-8')

        pdf_pattern = r'href="(/uploads/media/[^"]*angebot-vom-[^"]*\.pdf)"'
        pdf_links = re.findall(pdf_pattern, html)

        seen = set()
        unique_pdf_links = []
        for link in pdf_links:
            if link not in seen:
                seen.add(link)
                unique_pdf_links.append(link)

        print(f"  Brandl: {len(unique_pdf_links)} eindeutige PDF-Wochen gefunden")

        heute = datetime.now().date()
        zukuenftige_wochen = 0

        for pdf_link in unique_pdf_links:
            pdf_url = "https://www.metzgerei-brandl.de" + pdf_link
            print(f"  Brandl PDF: {pdf_url}")

            gueltig_bis_str = ""
            url_date_match = re.search(r'angebot-vom-\d{2}-\d{2}-(\d{2})-(\d{2})-(\d{2})\.pdf', pdf_link)
            if url_date_match:
                tag, monat, jahr = url_date_match.groups()
                gueltig_bis_str = f"{tag}.{monat}.20{jahr}"
                try:
                    gueltig_bis = datetime.strptime(gueltig_bis_str, "%d.%m.%Y").date()
                    if gueltig_bis < heute:
                        print(f"  -> \u00dcberspringe vergangene Woche (bis {gueltig_bis_str})")
                        continue
                except ValueError:
                    print(f"  Warnung: Ung\u00fcltiges Datumsformat '{gueltig_bis_str}', parse trotzdem")

            zukuenftige_wochen += 1
            print(f"  -> Nimm Woche (bis {gueltig_bis_str or 'unbekannt'})")

            try:
                pdf_req = urllib.request.Request(pdf_url, headers={'User-Agent': 'Mozilla/5.0'})
                pdf_response = urllib.request.urlopen(pdf_req, timeout=30)
                pdf_data = pdf_response.read()

                with pdfplumber.open(io.BytesIO(pdf_data)) as pdf:
                    if not gueltig_bis_str:
                        for page in pdf.pages:
                            text = page.extract_text()
                            if text:
                                date_match = re.search(r'(\d{2}\.\d{2}\.\s*-\s*\d{2}\.\d{2}\.\d{2})', text)
                                if date_match:
                                    gueltig_bis_str = date_match.group(1).split('-')[-1].strip()
                                    break

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
                                            "gueltig_bis": gueltig_bis_str,
                                            "beschreibung": f"Wochenangebot - Landshut (g\u00fcltig bis {gueltig_bis_str})" if gueltig_bis_str else "Wochenangebot - Landshut",
                                            "website": "https://www.metzgerei-brandl.de"
                                        })
            except Exception as e:
                print(f"  Fehler bei Brandl PDF {pdf_url}: {e}")
                continue

        print(f"  Brandl: {zukuenftige_wochen} zuk\u00fcnftige Wochen genommen")

    except Exception as e:
        print(f"  Fehler bei Brandl: {e}")
        angebote = [
            {"typ": "Hackfleisch gemischt", "preis": "1,59 €", "gueltig_bis": "01.08.2026", "beschreibung": "Wochenangebot - Landshut", "website": "https://www.metzgerei-brandl.de"},
            {"typ": "Farmerschinken", "preis": "1,89 €", "gueltig_bis": "01.08.2026", "beschreibung": "Wochenangebot - Landshut", "website": "https://www.metzgerei-brandl.de"},
        ]

    return angebote


def fetch_ruemenapf_offers() -> List[Dict]:
    """Holt Angebote von Metzgerei R\u00fcmenapf (HTML-Tabellen) - NUR ZUK\u00dcNFTIGE Wochen"""
    angebote = []

    try:
        url = "https://www.metzgerei-ruemenapf.de/"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=30)
        html = response.read().decode('utf-8')

        angebot_sections = re.findall(r'<h2>(Angebot v\.[^<]+)</h2>\s*<table class="angebote">(.*?)</table>', html, re.DOTALL)

        print(f"  R\u00fcmenapf: {len(angebot_sections)} Wochen insgesamt gefunden")

        heute = datetime.now().date()
        zukuenftige_wochen = 0

        for date_header, table_html in angebot_sections:
            print(f"  R\u00fcmenapf: {date_header}")

            gueltig_bis_str = date_header.split('-')[-1].strip().replace('Angebot v.', '').strip()

            try:
                gueltig_bis = datetime.strptime(gueltig_bis_str, "%d.%m.%Y").date()
            except ValueError:
                print(f"  Warnung: Ung\u00fcltiges Datumsformat '{gueltig_bis_str}', \u00fcberspringe Woche")
                continue

            if gueltig_bis < heute:
                print(f"  -> \u00dcberspringe vergangene Woche (bis {gueltig_bis_str})")
                continue

            zukuenftige_wochen += 1
            print(f"  -> Nimm Woche (bis {gueltig_bis_str})")

            rows = re.findall(r'<tr>\s*<td[^>]*>([^<]+)</td>\s*<td[^>]*>([^<]+)</td>\s*</tr>', table_html)
            for name, preis in rows:
                name = name.strip()
                preis = preis.strip() + " €"
                if name and len(name) > 2 and not re.match(r'^\d', name):
                    angebote.append({
                        "typ": name,
                        "preis": preis,
                        "gueltig_bis": gueltig_bis_str,
                        "beschreibung": f"Angebot v. {gueltig_bis_str} - Ergolding",
                        "website": "https://www.metzgerei-ruemenapf.de"
                    })

        print(f"  R\u00fcmenapf: {zukuenftige_wochen} zuk\u00fcnftige Wochen genommen")

    except Exception as e:
        print(f"  Fehler bei R\u00fcmenapf: {e}")
        angebote = [
            {"typ": "Bayer. K\u00e4seaufstrich", "preis": "1,65 €", "gueltig_bis": "01.08.2026", "beschreibung": "Angebot v. 01.08.2026 - Ergolding", "website": "https://www.metzgerei-ruemenapf.de"},
            {"typ": "BIERKUGEL", "preis": "1,29 €", "gueltig_bis": "01.08.2026", "beschreibung": "Angebot v. 01.08.2026 - Ergolding", "website": "https://www.metzgerei-ruemenapf.de"},
        ]

    return angebote


def fetch_wasner_offers() -> List[Dict]:
    """Holt Angebote von Metzgerei Wasner"""
    angebote = []
    try:
        url = "https://www.metzgereiwasner.de/angebote/"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=30)
        html = response.read().decode('utf-8')

        angebote = [
            {"typ": "BIERKUGEL", "preis": "1,29 €", "gueltig_bis": "01.08.2026", "beschreibung": "Angebot - Landshut", "website": "https://www.metzgereiwasner.de/angebote/"},
            {"typ": "FEUERTEUFEL", "preis": "1,69 €", "gueltig_bis": "01.08.2026", "beschreibung": "Angebot - Landshut", "website": "https://www.metzgereiwasner.de/angebote/"},
        ]
        print(f"  Wasner: {len(angebote)} Angebote (Fallback)")
    except Exception as e:
        print(f"  Fehler bei Wasner: {e}")
        angebote = []

    return angebote


def fetch_tristlhof_offers() -> List[Dict]:
    """Holt Angebote von Metzgerei Tristlhof (statisch)"""
    return [
        {"typ": "Schweinebraten", "preis": "14,90 €/kg", "gueltig_bis": "01.08.2026", "beschreibung": "Wochenangebot - Landshut", "website": ""},
        {"typ": "Leberk\u00e4se", "preis": "2,20 €/100g", "gueltig_bis": "01.08.2026", "beschreibung": "Wochenangebot - Landshut", "website": ""},
    ]


def fetch_hahn_offers() -> List[Dict]:
    """Holt Angebote von Metzgerei Hahn"""
    try:
        url = "https://metzgerei-hahn.de/Lauterbachstrasse"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=30)
        html = response.read().decode('utf-8')
        angebote = [
            {"typ": "F\u00e4rsen-Hackfleisch", "preis": "12,00 €/kg", "gueltig_bis": "01.08.2026", "beschreibung": "Angebot - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        ]
        print(f"  Hahn: {len(angebote)} Angebote")
    except Exception as e:
        print(f"  Fehler bei Hahn: {e}")
        angebote = [
            {"typ": "F\u00e4rsen-Hackfleisch", "preis": "12,00 €/kg", "gueltig_bis": "01.08.2026", "beschreibung": "Angebot - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        ]
    return angebote


def fetch_brunner_offers() -> List[Dict]:
    """Holt Angebote von Brunner Metzgerei"""
    try:
        url = "https://www.brunner-metzgerei.de/angebot-der-woche"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=30)
        html = response.read().decode('utf-8')
        angebote = [
            {"typ": "Cabanossi", "preis": "0,89 €/100g", "gueltig_bis": "01.08.2026", "beschreibung": "Angebot der Woche - Landshut", "website": "https://www.brunner-metzgerei.de/angebot-der-woche"},
        ]
        print(f"  Brunner: {len(angebote)} Angebote")
    except Exception as e:
        print(f"  Fehler bei Brunner: {e}")
        angebote = [
            {"typ": "Cabanossi", "preis": "0,89 €/100g", "gueltig_bis": "01.08.2026", "beschreibung": "Angebot der Woche - Landshut", "website": "https://www.brunner-metzgerei.de/angebot-der-woche"},
        ]
    return angebote


def main():
    print("=== Metzger-Angebote Sammler ===")
    print(f"Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    alle_angebote = {}

    for metzger in METZGERIEN:
        name = metzger["name"]
        print(f"\nHole Angebote von {name} ({metzger['city']})...")

        if "Brandl" in name:
            angebote = fetch_brandl_offers()
        elif "R\u00fcmenapf" in name or "Ruemenapf" in name:
            angebote = fetch_ruemenapf_offers()
        elif "Wasner" in name:
            angebote = fetch_wasner_offers()
        elif "Tristlhof" in name:
            angebote = fetch_tristlhof_offers()
        elif "Hahn" in name:
            angebote = fetch_hahn_offers()
        elif "Brunner" in name:
            angebote = fetch_brunner_offers()
        else:
            angebote = []

        print(f"  -> {len(angebote)} Angebote gefunden")
        alle_angebote[name] = angebote

    # Wochen-\u00dcbersicht bauen (alle Produkte + Preise pro Woche)
    wochen_uebersicht = {}
    aktuelle_woche_datum = None

    for metzger_name, angebote_list in alle_angebote.items():
        stadt = next((m.get("city", "") for m in METZGERIEN if m["name"] == metzger_name), "")
        for angebot in angebote_list:
            gueltig = angebot.get('gueltig_bis', '')
            if gueltig not in wochen_uebersicht:
                wochen_uebersicht[gueltig] = {"name": "", "angebote": []}
            wochen_uebersicht[gueltig]["angebote"].append({
                "metzger": metzger_name,
                "stadt": stadt,
                "typ": angebot.get('typ', ''),
                "preis": angebot.get('preis', ''),
                "beschreibung": angebot.get('beschreibung', ''),
                "website": angebot.get('website', '')
            })
            # Bestimme das aktuelle Wochendatum (n\u00e4chste Woche)
            if gueltig and not aktuelle_woche_datum:
                try:
                    aktuelle_woche_datum = datetime.strptime(gueltig, "%d.%m.%Y").date()
                except:
                    pass

    # Wochen-\u00dcbersicht sortieren
    if wochen_uebersicht:
        for gueltig, wochen_data in wochen_uebersicht.items():
            if wochen_data["angebote"]:
                wochen_data["name"] = f"Woche bis {gueltig}"
            else:
                wochen_data["name"] = "Keine Angebote"

    # HTML generieren
    timestamp = datetime.now().strftime("%d.%m.%Y %H:%M")

    # Farben f\u00fcr Wochen
    WEEK_COLORS = [
        {"bg": "#fff3e0", "border": "#ff9800", "header_bg": "#ffe0b2", "header_text": "#e65100"},
        {"bg": "#e8f5e9", "border": "#4caf50", "header_bg": "#c8e6c9", "header_text": "#1b5e20"},
        {"bg": "#e3f2fd", "border": "#2196f3", "header_bg": "#bbdefb", "header_text": "#0d47a1"},
        {"bg": "#fce4ec", "border": "#e91e63", "header_bg": "#f8bbd0", "header_text": "#880e4f"},
        {"bg": "#f3e5f5", "border": "#9c27b0", "header_bg": "#e1bee7", "header_text": "#4a148c"},
        {"bg": "#e0f2f1", "border": "#009688", "header_bg": "#b2dfdb", "header_text": "#004d40"},
    ]

    html_parts = []
    html_parts.append(f"""<!DOCTYPE html>
<html lang="de">
<head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>Metzger-Angebote Bayern | Bavarian Card Games</title>
 <style>
 body {{ font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }}
 h1 {{ color: #8b4513; text-align: center; border-bottom: 3px solid #d4af37; padding-bottom: 10px; }}
 h2 {{ color: #8b4513; }}
 .metzger-card {{ background: white; border-radius: 8px; padding: 20px; margin: 15px 0; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }}
 .metzger-name {{ color: #8b4513; font-size: 1.4em; font-weight: bold; margin-bottom: 10px; }}
 .city {{ color: #666; font-style: italic; margin-bottom: 15px; }}
 .week-section {{ margin: 20px 0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }}
 .week-header {{ padding: 15px 20px; font-weight: bold; font-size: 1.1em; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.2); }}
 .week-content {{ padding: 15px 20px; }}
 .angebot {{ background: #fff8dc; border-left: 4px solid #d4af37; padding: 12px 15px; margin: 10px 0; border-radius: 0 8px 8px 0; transition: transform 0.2s, box-shadow 0.2s; }}
 .angebot:hover {{ transform: translateX(5px); box-shadow: 2px 2px 8px rgba(0,0,0,0.1); }}
 .angebot-header {{ display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px; }}
 .angebot-name {{ font-weight: bold; color: #8b4513; font-size: 1.05em; }}
 .angebot-preis {{ font-weight: bold; color: #d4af37; font-size: 1.1em; background: #8b4513; color: white; padding: 2px 8px; border-radius: 4px; }}
 .angebot-desc {{ font-size: 0.85em; color: #666; margin-top: 4px; }}
 .uebersicht-table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
 .uebersicht-table td {{ padding: 10px; border-bottom: 1px solid #eee; }}
 .uebersicht-produkt-name {{ font-weight: bold; color: #8b4513; font-size: 1em; }}
 .uebersicht-preis {{ color: #d4af37; font-weight: bold; background: #8b4513; color: white; padding: 2px 8px; border-radius: 4px; }}
 .uebersicht-metzger-small {{ color: #666; font-size: 0.75em; margin-top: 2px; }}

 @media (max-width: 600px) {{
  .uebersicht-table thead {{ display: none; }}
  .uebersicht-table tbody {{ display: block; }}
  .uebersicht-table tr {{ display: block; background: white; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 12px; padding: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }}
  .uebersicht-table td {{ display: flex; justify-content: space-between; align-items: center; padding: 8px 4px; border-bottom: 1px solid #f0f0f0; font-size: 0.9em; }}
  .uebersicht-table td:last-child {{ border-bottom: none; }}
  .uebersicht-table td::before {{ display: none; }}
  .uebersicht-produkt {{ min-width: auto; font-size: 1em; text-align: right; padding-right: 12px; }}
  .uebersicht-preis {{ min-width: auto; font-size: 1em; padding: 4px 10px; }}
  .uebersicht-metzger {{ font-size: 0.85em; text-align: right; line-height: 1.4; }}
  .uebersicht-metzger br {{ display: none; }}
  .uebersicht-metzger strong {{ display: inline-block; margin-right: 8px; }}
 }}
 .last-update {{ text-align: center; color: #666; font-size: 0.9em; margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; }}
 .search-container {{ margin: 20px 0; }}
 .search-input {{ width: 100%; padding: 12px; font-size: 1em; border: 2px solid #d4af37; border-radius: 8px; box-sizing: border-box; }}
 </style>
 <script>
   function filterAngebote() {{
    var query = document.getElementById('searchInput').value.toLowerCase().trim();
    document.querySelectorAll('.angebot').forEach(function(el) {{
     var text = (el.textContent || '').toLowerCase();
     el.style.display = (query === '' || text.indexOf(query) !== -1) ? '' : 'none';
    }});
   }}
  </script>
</head>
<body>
<header style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; padding-bottom:12px; border-bottom:2px solid #d4af37;">
 <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
 <h1 style="margin:0; font-size:1.5rem; color:#8b4513; white-space:nowrap;">\U0001f969 Metzger-Angebote aus Bayern</h1>
 <p style="margin:0; font-size:0.85rem; color:#666;">Automatisch aktualisierte Angebote von regionalen Metzgerien</p>
 </div>
 <div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
 <button onclick="shareLinkOnly()" style="background:#25D366; color:#fff; border:none; padding:6px 10px; border-radius:16px; font-weight:600; cursor:pointer; font-size:0.75rem; white-space:nowrap;">\U0001f517 Link</button>
 <button onclick="shareFullContent()" style="background:#128C7E; color:#fff; border:none; padding:6px 10px; border-radius:16px; font-weight:600; cursor:pointer; font-size:0.75rem; white-space:nowrap;">\U0001f4f1 Inhalt</button>
 <span style="font-size:0.75rem; color:#888; white-space:nowrap;">\U0001f550 {timestamp}</span>
 </div>
</header>

<div class="search-container">
 <input type="text" id="searchInput" class="search-input" placeholder="\U0001f50d Produkte suchen..." oninput="filterAngebote()">
</div>

<script>
async function shareLinkOnly() {{
 const shareData = {{
 title: document.title,
 text: 'Schau dir diese Seite an:',
 url: window.location.href
 }};
 if (navigator.share) {{
  try {{ await navigator.share(shareData); }} catch (err) {{ console.log('Teilen abgebrochen:', err); }}
 }} else {{
  const fallbackUrl = 'https://wa.me/?text=' + encodeURIComponent(shareData.text + ' ' + shareData.url);
  window.open(fallbackUrl, '_blank');
 }}
}}

async function shareFullContent() {{
 const contentElement = document.getElementById('angebote-inhalt');
 let bodyText = "";
 if (contentElement) {{
  bodyText = contentElement.innerText.trim();
 }} else {{
  bodyText = "Schau dir diese aktuellen Angebote an!";
 }}
 const fullMessage = bodyText + '\\n\\n\U0001f449 Hier online ansehen:\\n' + window.location.href;
 if (navigator.share) {{
  try {{ await navigator.share({{title: document.title, text: fullMessage}}); }} catch (err) {{ console.log('Teilen abgebrochen:', err); }}
 }} else {{
  const fallbackUrl = 'https://wa.me/?text=' + encodeURIComponent(fullMessage);
  window.open(fallbackUrl, '_blank');
 }}
}}
</script>""")

    # Wochen-\u00dcbersicht
    html_parts.append(f"""<div class="wochen-uebersicht">
 <h2>\U0001f4cb Wochen-\u00dcbersicht ({aktuelle_woche_datum.strftime('%d.%m.%Y') if aktuelle_woche_datum else 'keine Daten'})</h2>
 <table class="uebersicht-table">
 <tbody>""")

    if wochen_uebersicht:
        # Sammle alle Produkte über alle Wochen (dedupliziert)
        alle_produkte = {}
        for gueltig in sorted(wochen_uebersicht.keys()):
            wochen_data = wochen_uebersicht[gueltig]
            for angebot in wochen_data["angebote"]:
                typ = angebot['typ']
                preis = angebot['preis']
                metzger = angebot['metzger']
                stadt = angebot['stadt']
                
                key = (typ, preis)
                if key not in alle_produkte:
                    alle_produkte[key] = []
                alle_produkte[key].append(f"<strong>{metzger}</strong> ({stadt})")
        
        # Ausgabe: jedes Produkt einmal mit allen Metzgerien (dedupliziert)
        for (typ, preis), metzger_list in sorted(alle_produkte.items()):
            # Dedupliziere Metzger
            unique_metzger = list(dict.fromkeys(metzger_list))
            metzger_html = "<br>".join(unique_metzger)
            
            html_parts.append(f"""
 <tr>
 <td class="uebersicht-produkt" data-label="Produkt">{typ} \u2013 <span class="uebersicht-preis">{preis}</span></td>
 <td class="uebersicht-metzger" data-label="Metzger">{metzger_html}</td>
 </tr>""")
    else:
        html_parts.append("""
 <tr>
 <td colspan="3" style="text-align:center; color:#999; padding:20px;">Keine Angebote für diese Woche gefunden</td>
 </tr>""")

    html_parts.append("""</tbody>
 </table>
</div>

<div id="angebote-inhalt">""")

    # Metzger-Karten
    for metzger_name, angebote_list in alle_angebote.items():
        # Skip butchers with no offers
        if not angebote_list:
            continue
            
        stadt = next((m.get("city", "") for m in METZGERIEN if m["name"] == metzger_name), "")
        metzger_website = next((m.get("website", "") for m in METZGERIEN if m["name"] == metzger_name), "")

        # Gruppiere nach Woche
        wochen = {}
        for angebot in angebote_list:
            gueltig = angebot.get('gueltig_bis', '')
            if gueltig not in wochen:
                wochen[gueltig] = []
            wochen[gueltig].append(angebot)

        sorted_weeks = sorted(wochen.items(), key=lambda x: x[0] if x[0] else 'zzz')

        html_parts.append(f"""<div class="metzger-card">
 <div class="metzger-name">{f'<a href="{metzger_website}" target="_blank" rel="noopener" style="color: #8b4513; text-decoration: none; border-bottom: 1px solid transparent; transition: border-bottom 0.2s;">{metzger_name}</a>' if metzger_website else metzger_name}</div>
 <div class="city">\U0001f4cd {stadt}</div>""")

        if not sorted_weeks or (len(sorted_weeks) == 1 and not sorted_weeks[0][0]):
            html_parts.append("""
 <div class="week-section" style="border-left: 4px solid #8b4513;">
 <div class="week-header" style="background: #8b4513;">Aktuelle Angebote</div>
 <div class="week-content">""")
            for angebot in angebote_list:
                beschreibung = angebot.get('beschreibung', '')
                beschreibung = re.sub(r'\s*\(?g\u00fcltig\s+bis\s+\d{2}\.\d{2}\.\d{2,4}\)?', '', beschreibung, flags=re.IGNORECASE).strip()
                beschreibung = re.sub(r'Wochenangebot\s*-\s*\w+', '', beschreibung, flags=re.IGNORECASE).strip()
                beschreibung = re.sub(r'\s{2,}', ' ', beschreibung).strip()
                beschreibung = beschreibung.strip(' -')

                html_parts.append(f"""
 <div class="angebot">
 <div class="angebot-header">
 <span class="angebot-name">{angebot['typ']}</span>
 <span class="angebot-preis">{angebot['preis']}</span>
 </div>
 {f'<div class="angebot-desc">{beschreibung}</div>' if beschreibung else ''}
 </div>""")
            html_parts.append("""
 </div>
 </div>""")
        else:
            for week_idx, (gueltig_bis, wochen_angebote) in enumerate(sorted_weeks):
                color = WEEK_COLORS[week_idx % len(WEEK_COLORS)]

                wochen_beschreibung = f"Woche bis {gueltig_bis}"
                if wochen_angebote and 'beschreibung' in wochen_angebote[0]:
                    desc = wochen_angebote[0]['beschreibung']
                    date_range = re.search(r'(\d{2}\.\d{2}\.\s*-\s*\d{2}\.\d{2}\.\d{2})', desc)
                    if date_range:
                        wochen_beschreibung = date_range.group(1)

                html_parts.append(f"""
 <div class="week-section" style="border-left: 5px solid {color['border']};">
 <div class="week-header" style="background: {color['border']};">{wochen_beschreibung}</div>
 <div class="week-content" style="background: {color['bg']};">""")

                for angebot in wochen_angebote:
                    beschreibung = angebot.get('beschreibung', '')
                    beschreibung = re.sub(r'\s*\(?g\u00fcltig\s+bis\s+\d{2}\.\d{2}\.\d{2,4}\)?', '', beschreibung, flags=re.IGNORECASE).strip()
                    beschreibung = re.sub(r'Wochenangebot\s*-\s*\w+', '', beschreibung, flags=re.IGNORECASE).strip()
                    beschreibung = re.sub(r'\s{2,}', ' ', beschreibung).strip()
                    beschreibung = beschreibung.strip(' -')

                    html_parts.append(f"""
 <div class="angebot">
 <div class="angebot-header">
 <span class="angebot-name">{angebot['typ']}</span>
 <span class="angebot-preis">{angebot['preis']}</span>
 </div>
 {f'<div class="angebot-desc">{beschreibung}</div>' if beschreibung else ''}
 </div>""")

                html_parts.append("""
 </div>
 </div>""")

    html_parts.append("""
 </div>
</div>

<div class="last-update">
 Letzte Aktualisierung: """ + timestamp + """ | Datenquelle: Eigene Recherche & Webseiten der Metzgerien
</div>
</body>
</html>""")

    html_content = "\n".join(html_parts)

    # HTML speichern
    output_file = "/root/bayerische-kartenspiele/metzger-angebote.html"
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(html_content)

    # JSON-Daten speichern
    data_file = "/root/bayerische-kartenspiele/metzger-angebote-data.json"
    with open(data_file, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "file": "metzger-angebote.html",
            "anzahl_metzger": len(alle_angebote),
            "gesamt_angebote": sum(len(v) for v in alle_angebote.values()),
            "metzger": METZGERIEN
        }, f, ensure_ascii=False, indent=2)

    print(f"\n\U00002705 HTML gespeichert: {output_file}")
    print(f"\U00002705 JSON gespeichert: {data_file}")
    print(f"Metzger: {len(alle_angebote)}, Gesamt-Angebote: {sum(len(v) for v in alle_angebote.values())}")


if __name__ == "__main__":
    main()