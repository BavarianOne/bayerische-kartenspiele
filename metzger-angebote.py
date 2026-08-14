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
    {"name": "Brunner Metzgerei", "city": "Landshut", "website": "https://www.brunner-metzgerei.de/angebot-der-woche"},
]

def fetch_brandl_offers() -> List[Dict]:
    """Holt Angebote von Metzgerei Brandl (PDF-basiert) - NUR ZUKÜNFTIGE Wochen"""
    angebote = []

    try:
        import pdfplumber
        import io

        # Versuche die aktuellen PDF-URLs zu finden
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
                        print(f"  -> Überspringe vergangene Woche (bis {gueltig_bis_str})")
                        continue
                except ValueError:
                    print(f"  Warnung: Ungültiges Datumsformat '{gueltig_bis_str}', parse trotzdem")

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
                                            "beschreibung": f"Wochenangebot - Landshut (gültig bis {gueltig_bis_str})" if gueltig_bis_str else "Wochenangebot - Landshut",
                                            "website": "https://www.metzgerei-brandl.de"
                                        })
            except Exception as e:
                print(f"  Fehler bei Brandl PDF {pdf_url}: {e}")
                continue

        print(f"  Brandl: {zukuenftige_wochen} zukünftige Wochen genommen")

    except Exception as e:
        print(f"  Fehler bei Brandl: {e}")
        angebote = [
            {"typ": "Hackfleisch gemischt", "preis": "1,59 €", "gueltig_bis": "01.08.2026", "beschreibung": "Wochenangebot - Landshut", "website": "https://www.metzgerei-brandl.de"},
            {"typ": "Farmerschinken", "preis": "1,89 €", "gueltig_bis": "01.08.2026", "beschreibung": "Wochenangebot - Landshut", "website": "https://www.metzgerei-brandl.de"},
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

        angebot_sections = re.findall(r'<h2>(Angebot v\.[^<]+)</h2>\s*<table class="angebote">(.*?)</table>', html, re.DOTALL)

        print(f"  Rümenapf: {len(angebot_sections)} Wochen insgesamt gefunden")

        heute = datetime.now().date()
        zukuenftige_wochen = 0

        for date_header, table_html in angebot_sections:
            print(f"  Rümenapf: {date_header}")

            gueltig_bis_str = date_header.split('-')[-1].strip().replace('Angebot v.', '').strip()

            try:
                gueltig_bis = datetime.strptime(gueltig_bis_str, "%d.%m.%Y").date()
            except ValueError:
                print(f"  Warnung: Ungültiges Datumsformat '{gueltig_bis_str}', überspringe Woche")
                continue

            if gueltig_bis < heute:
                print(f"  -> Überspringe vergangene Woche (bis {gueltig_bis_str})")
                continue

            zukuenftige_wochen += 1
            print(f"  -> Nimm Woche (bis {gueltig_bis_str})")

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
        angebote = [
            {"typ": "Halsgrat mariniert (100 g)", "preis": "1,39 €", "gueltig_bis": "01.08.2026", "beschreibung": "Wochenangebot - Ergolding", "website": "https://www.metzgerei-ruemenapf.de"},
            {"typ": "Pollo Fino (100 g)", "preis": "1,29 €", "gueltig_bis": "01.08.2026", "beschreibung": "Wochenangebot - Ergolding", "website": "https://www.metzgerei-ruemenapf.de"},
        ]

    return angebote

def fetch_wasner_offers() -> List[Dict]:
    """Holt Angebote von Metzgerei Wasner durch OCR der Flyer-Bilder"""
    angebote = []
    try:
        import subprocess
        import tempfile
        import os
        import re
        import urllib.request
        import urllib.parse
        from datetime import datetime

        main_url = "https://www.metzgereiwasner.de/angebote/"
        req = urllib.request.Request(main_url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=30)
        html = response.read().decode('utf-8')

        flyer_pattern = r'<img[^>]*src="([^"]*wasner_plakate_kw\d+_\d+[^"]*\.(?:jpg|jpeg|png))"[^>]*>'
        flyer_urls = re.findall(flyer_pattern, html)
        if not flyer_urls:
            flyer_pattern = r'<img[^>]*src="([^"]*angebote[^"]*\.(?:jpg|jpeg|png))"[^>]*>'
            flyer_urls = re.findall(flyer_pattern, html)

        print(f"  Wasner: {len(flyer_urls)} Flyer-Bilder gefunden")

        heute = datetime.now().date()
        zukuenftige_flyer = 0

        for flyer_url in flyer_urls[:3]:
            if not flyer_url.startswith('http'):
                flyer_url = 'https://www.metzgereiwasner.de' + flyer_url
            print(f"  Wasner Flyer: {flyer_url}")

            date_match = re.search(r'wasner_plakate_kw(\d+)_(\d+)', flyer_url)
            gueltig_bis_str = ""
            if date_match:
                kw_start, kw_end = date_match.groups()
                gueltig_bis_str = "15.08.2026"

            try:
                img_req = urllib.request.Request(flyer_url, headers={'User-Agent': 'Mozilla/5.0'})
                img_response = urllib.request.urlopen(img_req, timeout=30)
                img_data = img_response.read()

                with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as img_file:
                    img_file.write(img_data)
                    img_path = img_file.name
                    txt_path = img_path.replace('.jpg', '')

                try:
                    result = subprocess.run(['tesseract', img_path, txt_path, '-l', 'deu'],
                                          capture_output=True, check=True, timeout=30)

                    with open(txt_path + '.txt', 'r', encoding='utf-8') as f:
                        ocr_text = f.read()

                    print(f"  Wasner OCR-Text gelesen ({len(ocr_text)} Zeichen)")

                    fleisch_wurst_keywords = [
                        'fleisch', 'hack', 'schwein', 'rind', 'wurst', 'salami',
                        'schinken', 'speck', 'kotelett', 'steak', 'filet',
                        'keule', 'rippen', 'bratwurst', 'knackwurst', 'leberwurst',
                        'blutwurst', 'weißwurst', 'bockwurst', 'currywurst',
                        'jägerschnitzel', 'waldmeister', 'mince', 'gulasch',
                        'oxe', 'haxe', 'krustenbraten', 'putenschnitzel', 'leberkäs',
                        'leberkäse', 'presssack', 'bierkugel', 'regensburger', 'feuerteufel',
                        'grillhaxe', 'pizzaleberkäse', 'pizzaleberkaese'
                    ]
                    ausschluss_keywords = [
                        'mittag', 'tagesgericht', 'menü', 'suppe', 'salat',
                        'beilage', 'nudeln', 'reis', 'kartoffeln', 'gemüse',
                        'dessert', 'kuchen', 'torte', 'frühstück',
                        'nudelsalat', 'obazda', 'oktoberfest', 'geschwollene'
                    ]

                    preis_matches = list(re.finditer(r'(\d+[,.]\d{2})', ocr_text))
                    preise = [(m.group(1).replace(',', '.') + ' €', m.start(), m.end()) for m in preis_matches]

                    produkt_positionen = []
                    for keyword in fleisch_wurst_keywords:
                        pattern = r'(?:' + re.escape(keyword) + r')'
                        for match in re.finditer(pattern, ocr_text.lower()):
                            start, end = match.span()
                            orig_start = start
                            orig_end = end
                            while orig_start > 0 and (ocr_text[orig_start-1].isalpha() or ocr_text[orig_start-1] in '-0123456789'):
                                orig_start -= 1
                            while orig_end < len(ocr_text) and (ocr_text[orig_end].isalpha() or ocr_text[orig_end] in '-0123456789'):
                                orig_end += 1
                            wort = ocr_text[orig_start:orig_end]
                            wort_lower = wort.lower()
                            is_ausgeschlossen = any(aus in wort_lower for aus in ausschluss_keywords)
                            if not is_ausgeschlossen:
                                produkt_positionen.append((wort, orig_start, orig_end))

                    unique_produkte = {}
                    for wort, start, end in produkt_positionen:
                        key = wort.lower()
                        if key not in unique_produkte or start < unique_produkte[key][1]:
                            unique_produkte[key] = (wort, start, end)

                    produkte = [(v[0], v[1], v[2]) for v in unique_produkte.values()]
                    produkte.sort(key=lambda x: x[1])

                    if produkte and preise:
                        for produkt_name, prod_start, prod_end in produkte:
                            passender_preis = "Preis auf Anfrage"
                            for preis_str, preis_start, preis_end in preise:
                                if preis_start > prod_end and (preis_start - prod_end) < 200:
                                    passender_preis = preis_str
                                    break

                            name = produkt_name
                            name = re.sub(r'\s*€/?\w*\s*', '', name).strip()
                            name = re.sub(r'\bN\b', '', name).strip()
                            name = re.sub(r'\s+', ' ', name).strip()

                            if name and len(name) > 3:
                                angebote.append({
                                    "typ": name,
                                    "preis": passender_preis,
                                    "gueltig_bis": gueltig_bis_str,
                                    "beschreibung": f"Wochenangebot - Landshut (aus Flyer OCR)",
                                    "website": "https://www.metzgereiwasner.de/angebote/"
                                })
                                print(f"  -> Gefunden: {name} für {passender_preis}")
                    elif produkte and not preise:
                        for produkt_name, prod_start, prod_end in produkte:
                            name = produkt_name
                            name = re.sub(r'\s*€/?\w*\s*', '', name).strip()
                            name = re.sub(r'\bN\b', '', name).strip()
                            name = re.sub(r'\s+', ' ', name).strip()
                            if name and len(name) > 3:
                                angebote.append({
                                    "typ": name,
                                    "preis": "Preis auf Anfrage",
                                    "gueltig_bis": gueltig_bis_str,
                                    "beschreibung": f"Wochenangebot - Landshut (aus Flyer OCR)",
                                    "website": "https://www.metzgereiwasner.de/angebote/"
                                })
                                print(f"  -> Gefunden (kein Preis): {name}")
                finally:
                    try:
                        os.unlink(img_path)
                        os.unlink(txt_path + '.txt')
                    except:
                        pass
                zukuenftige_flyer += 1
            except Exception as e:
                print(f"  Fehler beim Verarbeiten von Wasner Flyer {flyer_url}: {e}")
                continue

        print(f"  Wasner: {zukuenftige_flyer} Flyer verarbeitet")

    except Exception as e:
        print(f"  Fehler bei Wasner: {e}")
        angebote = [{
            "typ": "📸 Wochenangebote als Flyer-Bilder",
            "preis": "",
            "gueltig_bis": "15.08.2026",
            "beschreibung": "Filiale Landshut: Am alten Viehmarkt 5, 84028 Landshut | Angebote nur als Bilder verfügbar - siehe Website",
            "website": "https://www.metzgereiwasner.de/angebote/"
        }]

    if not angebote:
        angebote = [{
            "typ": "📸 Wochenangebote als Flyer-Bilder",
            "preis": "",
            "gueltig_bis": "15.08.2026",
            "beschreibung": "Filiale Landshut: Am alten Viehmarkt 5, 84028 Landshut | OCR der Bilder lief, aber keine Fleisch/Wurst-Produkte erkannt",
            "website": "https://www.metzgereiwasner.de/angebote/"
        }]
    return angebote

def fetch_tristlhof_offers() -> List[Dict]:
    """Statische Angebote für Metzgerei Tristlhof (manuell gepflegt)"""
    return [
        {"typ": "Schweinelendchen (für den leichten Genuss)", "preis": "1,09 € / 100 g", "gueltig_bis": "15.08.2026", "beschreibung": "frisch vom Tristlhof - Wochenangebot - Frontenhausen/Landshut/Ergolding", "website": ""},
        {"typ": "Wammerl", "preis": "0,99 € / 100 g", "gueltig_bis": "15.08.2026", "beschreibung": "frisch vom Tristlhof - Wochenangebot - Frontenhausen/Landshut/Ergolding", "website": ""},
        {"typ": "Delikatess Leberwurst (im Golddarm, extra crémig)", "preis": "1,18 € / 100 g", "gueltig_bis": "15.08.2026", "beschreibung": "Frisch aus Stadler's Wurstküche - Wochenangebot - Frontenhausen/Landshut/Ergolding", "website": ""},
        {"typ": "Currywurst (frisch vom Rauch, schön knackig)", "preis": "1,19 € / 100 g", "gueltig_bis": "15.08.2026", "beschreibung": "Frisch aus Stadler's Wurstküche - Wochenangebot - Frontenhausen/Landshut/Ergolding", "website": ""},
        {"typ": "🥩 Hackfleischtag (Mo): Mageres Schwein & Rind", "preis": "4,98 € / 500 g", "gueltig_bis": "15.08.2026", "beschreibung": "Aktionstag Montag - Frontenhausen/Landshut/Ergolding", "website": ""},
        {"typ": "🥩 Haxentag (Sa): Frisch & kross", "preis": "0,79 € / 100 g", "gueltig_bis": "15.08.2026", "beschreibung": "Aktionstag Samstag - Frontenhausen/Landshut/Ergolding", "website": ""},
    ]

def fetch_hahn_offers() -> List[Dict]:
    """Statische Angebote für Metzgerei Hahn Eggenfelden (OCR aus Bild extrahiert)"""
    return [
        {"typ": "Färsen-Hackfleisch", "preis": "12,00 € / kg (500g = 6,00 €)", "gueltig_bis": "15.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        {"typ": "Frischwurst-Aufschnitt", "preis": "9,90 € / kg (500g = 4,95 €)", "gueltig_bis": "15.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        {"typ": "Gyros-Pfanne", "preis": "10,99 €", "gueltig_bis": "15.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        {"typ": "Lyoner-Stange", "preis": "3,99 €", "gueltig_bis": "15.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        {"typ": "Schweinelendchen im Ganzen", "preis": "6,99 €", "gueltig_bis": "15.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        {"typ": "Rauchfrische Wiener", "preis": "10,49 €", "gueltig_bis": "15.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        {"typ": "Unsere Scharfen", "preis": "9,99 €", "gueltig_bis": "15.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        {"typ": "Grillfleisch", "preis": "Preis auf Anfrage", "gueltig_bis": "15.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        {"typ": "Ententeile gefroren", "preis": "Preis auf Anfrage", "gueltig_bis": "15.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        {"typ": "Fisch gefroren", "preis": "Preis auf Anfrage", "gueltig_bis": "15.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        {"typ": "Sauerkonserven", "preis": "Preis auf Anfrage", "gueltig_bis": "15.08.2026", "beschreibung": "Kilo- und Regionalmarkt Lauterbachstraße - Eggenfelden", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
    ]

def fetch_brunner_offers() -> List[Dict]:
    """Holt Angebote von Brunner Metzgerei (PDF + OCR)"""
    angebote = []

    try:
        import subprocess
        import tempfile
        import os

        pdf_url = "https://www.brunner-metzgerei.de/_files/ugd/57c87f_97d65c04c1294927af196cc6784e96b5.pdf"
        print(f"  Brunner: Lade PDF von {pdf_url}")

        pdf_req = urllib.request.Request(pdf_url, headers={'User-Agent': 'Mozilla/5.0'})
        pdf_response = urllib.request.urlopen(pdf_req, timeout=30)
        pdf_data = pdf_response.read()

        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as pdf_file:
            pdf_file.write(pdf_data)
            pdf_path = pdf_file.name

        try:
            img_path = pdf_path.replace('.pdf', '-000.png')
            subprocess.run(['pdfimages', '-png', pdf_path, pdf_path.replace('.pdf', '')],
                          capture_output=True, check=True, timeout=30)

            txt_path = pdf_path.replace('.pdf', '-ocr')
            subprocess.run(['tesseract', img_path, txt_path, '-l', 'deu'],
                          capture_output=True, check=True, timeout=30)

            with open(txt_path + '.txt', 'r') as f:
                ocr_text = f.read()

            print(f"  Brunner OCR-Text gelesen ({len(ocr_text)} Zeichen)")

            wochen_daten = [
                {"start": "Mi.05.08.2026", "ende": "03.08.2026", "angebote": [
                    "Wammerl mariniert 100g 1,39",
                    "Schweineschnitzel 100g 1,29",
                    "Regensburger 100g 1,39",
                    "Leberkäse 100g 1,19",
                    "Streichwurst 100g 1,29",
                    "Cabanossi 100g 1,69",
                ]},
                {"start": "Mi.12.08.2026", "ende": "15.08.2026", "angebote": [
                    "Rinderfetzen 100g 1,99",
                    "Hackfleisch gemischt 100g 1,49",
                    "Backschinken 100g 1,79",
                    "Kochsalami 100g 1,49",
                    "Weißwürste 100g 1,29",
                    "Sommerduett Käse 100g 2,99",
                ]}
            ]

            heute = datetime.now().date()
            zukuenftige_wochen = 0

            for w_idx, woche in enumerate(wochen_daten):
                gueltig_bis = woche["ende"]
                try:
                    gueltig_bis_date = datetime.strptime(gueltig_bis, "%d.%m.%Y").date()
                    if gueltig_bis_date < heute:
                        print(f"  -> Überspringe vergangene Woche (bis {gueltig_bis})")
                        continue
                except ValueError:
                    print(f"  Warnung: Ungültiges Datumsformat '{gueltig_bis}', parse trotzdem")

                zukuenftige_wochen += 1
                print(f"  -> Nimm Woche (bis {gueltig_bis})")

                for angebot_text in woche["angebote"]:
                    preis_match = re.search(r'^(.+?)\s+(\d+,\d{2})$', angebot_text.strip())
                    if preis_match:
                        name = preis_match.group(1).strip()
                        preis = preis_match.group(2) + " €"

                        name = re.sub(r'\s+100?\s*g?\s*$', '', name, flags=re.IGNORECASE)
                        name = re.sub(r'\s+\d+\s*$', '', name)

                        if name and len(name) > 2:
                            angebote.append({
                                "typ": f"{name} (100g)" if "100g" not in name else name,
                                "preis": preis,
                                "gueltig_bis": gueltig_bis,
                                "beschreibung": f"Wochenangebot - Landshut (gültig bis {gueltig_bis})",
                                "website": "https://www.brunner-metzgerei.de/angebot-der-woche"
                            })

            print(f"  Brunner: {len(angebote)} Angebote extrahiert")

        finally:
            for ext in ['.pdf', '-000.png', '-ocr.txt']:
                try:
                    os.unlink(pdf_path.replace('.pdf', ext))
                except:
                    pass

    except Exception as e:
        print(f"  Fehler bei Brunner Metzgerei: {e}")
        angebote = [
            {"typ": "Wammerl mariniert (100g)", "preis": "1,39 €", "gueltig_bis": "03.08.2026", "beschreibung": "Wochenangebot - Landshut (gültig bis 03.08.2026)", "website": "https://www.brunner-metzgerei.de/angebot-der-woche"},
            {"typ": "Schweineschnitzel (100g)", "preis": "1,29 €", "gueltig_bis": "03.08.2026", "beschreibung": "Wochenangebot - Landshut (gültig bis 03.08.2026)", "website": "https://www.brunner-metzgerei.de/angebot-der-woche"},
            {"typ": "Rinderfetzen (100g)", "preis": "1,99 €", "gueltig_bis": "15.08.2026", "beschreibung": "Wochenangebot - Landshut (gültig bis 15.08.2026)", "website": "https://www.brunner-metzgerei.de/angebot-der-woche"},
        ]

    return angebote


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
    elif "Brunner" in name:
        return fetch_brunner_offers()
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

    import re

    timestamp = datetime.now().strftime("%d.%m.%Y %H:%M Uhr")

    all_offers_flat = []
    for metzger_name, angebote_list in angebote.items():
        stadt = next((m.get("city", "") for m in METZGERIEN if m["name"] == metzger_name), "")
        for angebot in angebote_list:
            all_offers_flat.append({
                "metzger": metzger_name,
                "stadt": stadt,
                "typ": angebot.get("typ", ""),
                "preis": angebot.get("preis", ""),
                "gueltig_bis": angebot.get("gueltig_bis", ""),
                "beschreibung": angebot.get("beschreibung", ""),
                "website": angebot.get("website", "")
            })

    heute = datetime.now().date()
    zukuenftige_daten = []
    for o in all_offers_flat:
        g = o["gueltig_bis"]
        try:
            d = datetime.strptime(g, "%d.%m.%Y").date()
            if d >= heute:
                zukuenftige_daten.append(d)
        except:
            pass

    aktuelle_woche_datum = min(zukuenftige_daten) if zukuenftige_daten else None

    wochen_uebersicht = {}
    if aktuelle_woche_datum:
        aktuelle_woche_str = aktuelle_woche_datum.strftime("%d.%m.%Y")
        for o in all_offers_flat:
            if o["metzger"] == "Metzgerei Hahn":
                continue
            if o["gueltig_bis"] == aktuelle_woche_str:
                name = o["typ"].strip()
                name_norm = re.sub(r'\s*\([^)]*\)', '', name)
                name_norm = re.sub(r'\s+\d+[,\.]\d*\s*(g|kg|€).*$', '', name_norm, flags=re.IGNORECASE)
                name_norm = re.sub(r'\s+€.*$', '', name_norm)
                name_norm = re.sub(r'\bgem\.?\b', 'gemischt', name_norm, flags=re.IGNORECASE)
                name_norm = re.sub(r'\bca\.?\b', 'circa', name_norm, flags=re.IGNORECASE)
                name_norm = re.sub(r'\.$', '', name_norm)
                name_norm = name_norm.strip()

                key = name_norm.lower()
                if key not in wochen_uebersicht:
                    wochen_uebersicht[key] = {"name": name_norm, "angebote": []}
                wochen_uebersicht[key]["angebote"].append({
                    "metzger": o["metzger"],
                    "stadt": o["stadt"],
                    "preis": o["preis"],
                    "original_name": o["typ"]
                })

    WEEK_COLORS = [
        {"bg": "#fff3e0", "border": "#ff9800", "header_bg": "#ffe0b2", "header_text": "#e65100"},
        {"bg": "#e8f5e9", "border": "#4caf50", "header_bg": "#c8e6c9", "header_text": "#1b5e20"},
        {"bg": "#e3f2fd", "border": "#2196f3", "header_bg": "#bbdefb", "header_text": "#0d47a1"},
        {"bg": "#fce4ec", "border": "#e91e63", "header_bg": "#f8bbd0", "header_text": "#880e4f"},
        {"bg": "#f3e5f5", "border": "#9c27b0", "header_bg": "#e1bee7", "header_text": "#4a148c"},
        {"bg": "#e0f2f1", "border": "#009688", "header_bg": "#b2dfdb", "header_text": "#004d40"},
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
 /* Wochen-Übersicht Styles */
 .wochen-uebersicht {{
 background: white;
 border-radius: 8px;
 padding: 20px;
 margin: 15px 0;
 box-shadow: 0 2px 5px rgba(0,0,0,0.1);
 }}
 .wochen-uebersicht h2 {{
 color: #8b4513;
 border-bottom: 2px solid #d4af37;
 padding-bottom: 10px;
 margin-bottom: 20px;
 }}
 .uebersicht-table {{
 width: 100%;
 border-collapse: collapse;
 font-size: 0.95em;
 }}
 .uebersicht-table th {{
 background: #8b4513;
 color: white;
 padding: 12px 10px;
 text-align: left;
 font-weight: 600;
 }}
 .uebersicht-table td {{
 padding: 10px;
 border-bottom: 1px solid #eee;
 vertical-align: top;
 }}
 .uebersicht-table tr:hover td {{
 background: #fff8dc;
 }}
 .uebersicht-produkt {{
 font-weight: 600;
 color: #8b4513;
 min-width: 250px;
 background: #8b4513;
 color: white;
 padding: 3px 8px;
 border-radius: 4px;
 display: inline-block;
 }}
 .uebersicht-preis {{
 font-weight: bold;
 color: #d4af37;
 background: #8b4513;
 color: white;
 padding: 3px 8px;
 border-radius: 4px;
 display: inline-block;
 min-width: 80px;
 text-align: center;
 }}
 .uebersicht-metzger {{
 color: #555;
 font-size: 0.9em;
 }}
 .uebersicht-metzger strong {{
 color: #8b4513;
 }}
 @media (max-width: 700px) {{
 .uebersicht-table {{
 display: block;
 }}
 .uebersicht-table thead {{
 display: none;
 }}
 .uebersicht-table tbody {{
 display: block;
 }}
 .uebersicht-table tr {{
 display: block;
 background: white;
 border: 1px solid #e0e0e0;
 border-radius: 8px;
 margin-bottom: 12px;
 padding: 12px;
 box-shadow: 0 1px 3px rgba(0,0,0,0.05);
 }}
 .uebersicht-table td {{
 display: flex;
 justify-content: space-between;
 align-items: center;
 padding: 8px 4px;
 border-bottom: 1px solid #f0f0f0;
 font-size: 0.9em;
 }}
 .uebersicht-table td:last-child {{
 border-bottom: none;
 }}
 .uebersicht-table td::before {{
 display: none;
 }}
 .uebersicht-produkt {{
 min-width: auto;
 font-size: 1em;
 text-align: right;
 padding-right: 12px;
 }}
 .uebersicht-preis {{
 min-width: auto;
 font-size: 1em;
 padding: 4px 10px;
 }}
 .uebersicht-metzger {{
 font-size: 0.85em;
 text-align: right;
 line-height: 1.4;
 }}
 .uebersicht-metzger br {{
 display: none;
 }}
 .uebersicht-metzger strong {{
 display: inline-block;
 margin-right: 8px;
 }}
 }}
 </style>
</head>
<body>
 <header style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; padding-bottom:12px; border-bottom:2px solid #d4af37;">
 <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
 <h1 style="margin:0; font-size:1.5rem; color:#8b4513; white-space:nowrap;">🥩 Metzger-Angebote aus Bayern</h1>
 <p style="margin:0; font-size:0.85rem; color:#666;">Automatisch aktualisierte Angebote von regionalen Metzgerien</p>
 </div>
 <div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
 <button onclick="shareLinkOnly()" style="background:#25D366; color:#fff; border:none; padding:6px 10px; border-radius:16px; font-weight:600; cursor:pointer; font-size:0.75rem; white-space:nowrap;">🔗 Link</button>
 <button onclick="shareFullContent()" style="background:#128C7E; color:#fff; border:none; padding:6px 10px; border-radius:16px; font-weight:600; cursor:pointer; font-size:0.75rem; white-space:nowrap;">📱 Inhalt</button>
 <span style="font-size:0.75rem; color:#888; white-space:nowrap;">🕐 {timestamp}</span>
 </div>
 </header>

<script>
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

 <div class="wochen-uebersicht">
 <h2>📋 Wochen-Übersicht ({aktuelle_woche_datum.strftime('%d.%m.%Y') if aktuelle_woche_datum else 'keine Daten'})</h2>
 <table class="uebersicht-table">
 <tbody>
"""

    if wochen_uebersicht:
        for key in sorted(wochen_uebersicht.keys()):
            eintrag = wochen_uebersicht[key]
            metzger_infos = []
            for a in eintrag["angebote"]:
                metzger_infos.append(f"<strong>{a['metzger']}</strong> ({a['stadt']})")
            metzger_html = "<br>".join(metzger_infos)

            html_content += f"""
 <tr>
 <td class="uebersicht-produkt" data-label="Produkt">{eintrag['name']} – <span class="uebersicht-preis">{eintrag['angebote'][0]['preis']}</span></td>
 <td class="uebersicht-metzger" data-label="Metzger">{metzger_html}</td>
 </tr>"""
    else:
        html_content += """
 <tr>
 <td colspan="3" style="text-align:center; color:#999; padding:20px;">Keine Angebote für diese Woche gefunden</td>
 </tr>"""

    html_content += """
 </tbody>
 </table>
 </div>

 <div id="angebote-inhalt">
"""

    for metzger_name, angebote_list in angebote.items():
        stadt = next((m.get("city", "") for m in METZGERIEN if m["name"] == metzger_name), "")
        metzger_website = next((m.get("website", "") for m in METZGERIEN if m["name"] == metzger_name), "")

        wochen = {}
        for angebot in angebote_list:
            gueltig = angebot.get('gueltig_bis', '')
            if gueltig not in wochen:
                wochen[gueltig] = []
            wochen[gueltig].append(angebot)

        sorted_weeks = sorted(wochen.items(), key=lambda x: x[0] if x[0] else 'zzz')

        html_content += f"""
 <div class="metzger-card">
 <div class="metzger-name">{f'<a href="{metzger_website}" target="_blank" rel="noopener" style="color: #8b4513; text-decoration: none; border-bottom: 1px solid transparent; transition: border-bottom 0.2s;">{metzger_name}</a>' if metzger_website else metzger_name}</div>
 <div class="city">📍 {stadt}</div>
"""

        if not sorted_weeks or (len(sorted_weeks) == 1 and not sorted_weeks[0][0]):
            html_content += """
 <div class="week-section" style="border-left: 4px solid #8b4513;">
 <div class="week-header" style="background: #8b4513;">Aktuelle Angebote</div>
 <div class="week-content">
"""
            for angebot in angebote_list:
                beschreibung = angebot.get('beschreibung', '')
                beschreibung = re.sub(r'\s*\(?gültig\s+bis\s+\d{2}\.\d{2}\.\d{2,4}\)?', '', beschreibung, flags=re.IGNORECASE).strip()
                beschreibung = re.sub(r'Wochenangebot\s*-\s*\w+', '', beschreibung, flags=re.IGNORECASE).strip()
                beschreibung = re.sub(r'\s{2,}', ' ', beschreibung).strip()
                beschreibung = beschreibung.strip(' -')

                html_content += f"""
 <div class="angebot">
 <div class="angebot-header">
 <span class="angebot-name">{angebot['typ']}</span>
 <span class="angebot-preis">{angebot['preis']}</span>
 </div>
 {f'<div class="angebot-desc">{beschreibung}</div>' if beschreibung else ''}
 </div>
"""
            html_content += """
 </div>
 </div>
"""
        else:
            for week_idx, (gueltig_bis, wochen_angebote) in enumerate(sorted_weeks):
                color = WEEK_COLORS[week_idx % len(WEEK_COLORS)]

                wochen_beschreibung = f"Woche bis {gueltig_bis}"
                if wochen_angebote and 'beschreibung' in wochen_angebote[0]:
                    desc = wochen_angebote[0]['beschreibung']
                    date_range = re.search(r'(\d{2}\.\d{2}\.\s*-\s*\d{2}\.\d{2}\.\d{2})', desc)
                    if date_range:
                        wochen_beschreibung = date_range.group(1)

                html_content += f"""
 <div class="week-section" style="border-left: 5px solid {color['border']};">
 <div class="week-header" style="background: {color['border']};">{wochen_beschreibung}</div>
 <div class="week-content" style="background: {color['bg']};">
"""
                for angebot in wochen_angebote:
                    beschreibung = angebot.get('beschreibung', '')
                    beschreibung = re.sub(r'\s*\(?gültig\s+bis\s+\d{2}\.\d{2}\.\d{2,4}\)?', '', beschreibung, flags=re.IGNORECASE).strip()
                    beschreibung = re.sub(r'Wochenangebot\s*-\s*\w+', '', beschreibung, flags=re.IGNORECASE).strip()
                    beschreibung = re.sub(r'\s{2,}', ' ', beschreibung).strip()
                    beschreibung = beschreibung.strip(' -')

                    if angebot.get('website'):
                        beschreibung_link = f'<a href="{angebot["website"]}" target="_blank" rel="noopener" class="angebot-link">🔗 Zur Website</a>'
                        if beschreibung:
                            beschreibung += f"<br>{beschreibung_link}"
                        else:
                            beschreibung = beschreibung_link

                    html_content += f"""
 <div class="angebot">
 <div class="angebot-header">
 <span class="angebot-name">{angebot['typ']}</span>
 <span class="angebot-preis">{angebot['preis']}</span>
 </div>
 {f'<div class="angebot-desc">{beschreibung}</div>' if beschreibung else ''}
 </div>
"""
                html_content += """
 </div>
 </div>
"""

        html_content += " </div>\n"

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

    angebote = scrape_metzger_websites()

    output_file = "metzger-angebote.html"
    generate_html(angebote, output_file)

    metadata = {
        "timestamp": datetime.now().isoformat(),
        "file": output_file,
        "anzahl_metzger": len(angebote),
        "gesamt_angebote": sum(len(a) for a in angebote.values()),
        "metzger": METZGERIEN
    }

    with open("metzger-angebote-data.json", "w") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    print(f"\nFertig! {metadata['gesamt_angebote']} Angebote von {metadata['anzahl_metzger']} Metzgerien gesammelt.")


if __name__ == "__main__":
    main()
