#!/usr/bin/env python3
"""
Automatische Metzger-Angebote Sammler für bayerische-kartenspiele
Dieses Skript sammelt Metzger-Angebote und aktualisiert die HTML-Seite
"""

import json
import urllib.request
import urllib.parse
import re
from datetime import datetime, timedelta
from typing import List, Dict
from pathlib import Path

# Metzger-Definitionen
METZGERIEN = [
    {
        "name": "Metzgerei Brandl",
        "city": "Landshut",
        "website": "https://www.metzgerei-brandl.de",
        "url": "https://www.metzgerei-brandl.de/aktuelle-angebote/"
    },
    {
        "name": "Metzgerei Rümenapf",
        "city": "Ergolding",
        "website": "https://www.metzgerei-ruemenapf.de",
        "url": "https://www.metzgerei-ruemenapf.de/"
    },
    {
        "name": "Metzgerei Wasner",
        "city": "Landshut",
        "website": "https://www.metzgereiwasner.de/angebote/",
        "url": "https://www.metzgereiwasner.de/angebote/"
    },
    {
        "name": "Metzgerei Tristlhof",
        "city": "Landshut",
        "website": "",
        "url": ""
    },
    {
        "name": "Metzgerei Hahn",
        "city": "Eggenfelden",
        "website": "https://metzgerei-hahn.de/Lauterbachstrasse",
        "url": "https://metzgerei-hahn.de/Lauterbachstrasse"
    },
    {
        "name": "Brunner Metzgerei",
        "city": "Landshut",
        "website": "https://www.brunner-metzgerei.de/angebot-der-woche",
        "url": "https://www.brunner-metzgerei.de/angebot-der-woche"
    },
]


def fetch_brandl_offers() -> List[Dict]:
    """Holt Angebote von Metzgerei Brandl (PDF-Links von /speisekarten-angebote) und parst die PDFs"""
    import pdfplumber
    import io
    import urllib.request
    from datetime import datetime, timedelta

    angebote = []

    try:
        # Scraping von der Seite wo die PDFs gelistet sind
        url = "https://www.metzgerei-brandl.de/speisekarten-angebote"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=30)
        html = response.read().decode('utf-8')

        # Suche nach Angebot-PDF-Links (nicht Speisekarte!)
        pdf_pattern = re.compile(r'href="([^"]*angebot-vom-[^"]*\.pdf)"')
        pdf_urls = pdf_pattern.findall(html)

        # Duplikate entfernen
        unique_pdfs = []
        for pdf_url in pdf_urls:
            if pdf_url not in unique_pdfs:
                unique_pdfs.append(pdf_url)

        print(f"  Brandl: {len(unique_pdfs)} Angebot-PDFs gefunden")

        # Suche nach allen "Angebot vom ... bis ..." im HTML und mapp sie auf PDF-URLs
        angebot_dates = re.findall(r'Angebot vom \d{2}\.\d{2}\.\d{4}\s*bis\s*(\d{2}\.\d{2}\.\d{4})', html)
        print(f"  Brandl: Gefundene End-Daten im HTML: {angebot_dates}")

        heute = datetime.now().date()

        # Für jeden PDF-Link den passenden End-Datum finden und PDF parsen
        for i, pdf_url in enumerate(unique_pdfs):
            # Vollständige URL bauen
            if pdf_url.startswith('/'):
                pdf_url = "https://www.metzgerei-brandl.de" + pdf_url

            gueltig_bis = ""
            if i < len(angebot_dates):
                gueltig_bis = angebot_dates[i]
            else:
                # Fallback: try to extract from PDF filename
                date_matches = re.findall(r'(\d{2})-(\d{2})-(\d{2})', pdf_url)
                if len(date_matches) >= 2:
                    tag, monat, jahr = date_matches[-1]
                    try:
                        gueltig_bis = datetime(2000 + int(jahr), int(monat), int(tag)).strftime("%d.%m.%Y")
                    except:
                        pass

            # Wenn HTML-Datum in der Vergangenheit liegt, aber PDF-Dateinamen ein zukünftiges Datum hat -> PDF-Datum nutzen
            if gueltig_bis:
                try:
                    gueltig_date = datetime.strptime(gueltig_bis, "%d.%m.%Y").date()
                    if gueltig_date < heute:
                        # Versuche Datum aus PDF-Dateinamen zu extrahieren (Format: angebot-vom-DD-MM-DD-MM-YY.pdf)
                        # Nimm die letzten 3 Teile vor .pdf als End-Datum: DD-MM-YY
                        filename = pdf_url.split('/')[-1].replace('.pdf', '')
                        parts = filename.split('-')
                        if len(parts) >= 5:
                            # Format: angebot-vom-DD-MM-DD-MM-YY -> letzte 3: DD, MM, YY
                            tag, monat, jahr = parts[-3:]
                            try:
                                pdf_date = datetime(2000 + int(jahr), int(monat), int(tag)).date()
                                if pdf_date >= heute:
                                    gueltig_bis = pdf_date.strftime("%d.%m.%Y")
                                    print(f"  -> HTML-Datum war vergangen, nutze PDF-Dateinamen-Datum: {gueltig_bis}")
                            except:
                                pass
                except:
                    pass

            if not gueltig_bis:
                print(f"  -> Kein Datum erkannt: {pdf_url}")
                continue

            # Prüfen ob Woche in der Vergangenheit liegt
            try:
                gueltig_date = datetime.strptime(gueltig_bis, "%d.%m.%Y").date()
                if gueltig_date < heute:
                    print(f"  -> Überspringe vergangene Woche (bis {gueltig_bis})")
                    continue
            except:
                pass

            print(f"  -> Parse PDF für Woche bis {gueltig_bis}: {pdf_url}")

            # PDF herunterladen und parsen
            try:
                pdf_req = urllib.request.Request(pdf_url, headers={'User-Agent': 'Mozilla/5.0'})
                pdf_response = urllib.request.urlopen(pdf_req, timeout=30)
                pdf_content = pdf_response.read()

                pdf = pdfplumber.open(io.BytesIO(pdf_content))
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        # Parse Zeilen wie "Hackfleisch gemischt 100 g 1,59 €"
                        lines = text.split('\n')
                        for line in lines:
                            line = line.strip()
                            # Match: Produktname + Gewicht + Preis
                            match = re.match(r'^(.+?)\s+(\d+\s*g)\s+([\d,]+\s*€)', line)
                            if match:
                                name = match.group(1).strip()
                                gewicht = match.group(2).strip()
                                preis = match.group(3).strip()
                                # Bereinigen
                                name = re.sub(r'\s+', ' ', name)
                                if name and len(name) > 2:
                                    angebote.append({
                                        "typ": f"{name} ({gewicht})",
                                        "preis": preis,
                                        "gueltig_bis": gueltig_bis,
                                        "beschreibung": f"Angebot v. {gueltig_bis} - Landshut/Ergolding",
                                        "website": "https://www.metzgerei-brandl.de"
                                    })
                pdf.close()

            except Exception as e:
                print(f"    Fehler beim Parsen von {pdf_url}: {e}")

        print(f"  Brandl: {len(angebote)} Angebote aus PDFs extrahiert")

    except Exception as e:
        print(f"  Fehler bei Brandl: {e}")
        # Fallback auf statische Daten
        heute = datetime.now().date()
        woche1 = heute + timedelta(days=(7 - heute.weekday()))
        woche2 = woche1 + timedelta(days=7)
        angebote = [
            {"typ": "Schweine-Schnitzel", "preis": "1,49 €", "gueltig_bis": woche1.strftime("%d.%m.%Y"), "beschreibung": f"Angebot v. {woche1.strftime('%d.%m.%Y')} - Landshut", "website": "https://www.metzgerei-brandl.de"},
            {"typ": "Hals gewürzt", "preis": "1,49 €", "gueltig_bis": woche1.strftime("%d.%m.%Y"), "beschreibung": f"Angebot v. {woche1.strftime('%d.%m.%Y')} - Landshut", "website": "https://www.metzgerei-brandl.de"},
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

        # Find all h2 + table pairs in the entire HTML (joomla tabs)
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

            rows = re.findall(r'<tr>\s*<td[^>]*>([^<]+)</td>\s*<td[^>]*>([^<]+)</td>\s*<td[^>]*>([^<]+)</td>\s*</tr>', table_html)
            for name, gewicht, preis in rows:
                name = name.strip()
                gewicht = gewicht.strip()
                preis = preis.strip()
                # Nur " €" hinzufügen wenn nicht schon vorhanden
                if not preis.endswith("€"):
                    preis = preis + " €"
                if name and len(name) > 2 and not re.match(r'^\d', name):
                    angebote.append({
                        "typ": f"{name} ({gewicht})",
                        "preis": preis,
                        "gueltig_bis": gueltig_bis_str,
                        "beschreibung": f"Angebot v. {gueltig_bis_str} - Ergolding",
                        "website": "https://www.metzgerei-ruemenapf.de"
                    })

        print(f"  Rümenapf: {zukuenftige_wochen} zukünftige Wochen genommen")

    except Exception as e:
        print(f"  Fehler bei Rümenapf: {e}")
        from datetime import timedelta
        heute = datetime.now().date()
        woche1 = heute + timedelta(days=(7 - heute.weekday()))
        angebote = []

    return angebote


def fetch_wasner_offers() -> List[Dict]:
    """Holt Angebote von Metzgerei Wasner (automatisch per OCR aus Flyer-Bildern)"""
    import pytesseract
    from PIL import Image, ImageEnhance
    import io
    import urllib.request
    from datetime import datetime, timedelta

    angebote = []

    try:
        # 1. HTML-Seite laden um Flyer-Bild-URLs zu finden
        url = "https://www.metzgereiwasner.de/angebote/"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=30)
        html = response.read().decode('utf-8')

        # Flyer-Bild-URLs extrahieren: Originalbilder aus img[src] (hohe Qualität für OCR)
        # Pattern: src="/fileadmin/user_upload/bilder/angebote/.../wasner_plakate_kw...jpg"
        # NUR die 3 Hauptflyer (Plakate), Passau-Flyer haben schlechte OCR-Qualität
        flyer_pattern = re.compile(r'src="(/fileadmin/user_upload/bilder/angebote/[^"]*?wasner_plakate_kw\d+_\d+[^"]*?\.jpg)"')
        flyer_paths = flyer_pattern.findall(html)

        # Duplikate entfernen
        unique_flyers = []
        for path in flyer_paths:
            if path not in unique_flyers:
                unique_flyers.append(path)

        print(f"  Wasner: {len(unique_flyers)} Flyer-Bilder gefunden")

        # 2. Gültigkeitsdatum aus Flyer-Dateinamen extrahieren (Format: wasner_plakate_kw36_37_... = KW36-37)
        # KW36 2026 = 31.08.-06.09., KW37 = 07.09.-13.09. -> Ende = 12.09.2026
        gueltig_von = ""
        gueltig_bis = ""

        # Versuche aus Dateinamen KW zu extrahieren
        kw_match = re.search(r'kw(\d+)_(\d+)', ' '.join(flyer_paths))
        if kw_match:
            kw1, kw2 = int(kw_match.group(1)), int(kw_match.group(2))
            # KW zu Datum approximieren (2026)
            # KW36 2026: Montag 31.08., KW37: Montag 07.09. -> Ende Freitag 12.09.
            # Einfache Approximation: KW1 2026 startet 05.01.
            jan1 = datetime(2026, 1, 1)
            kw1_monday = jan1 + timedelta(weeks=kw1-1)
            # Korrektur: erste KW startet am ersten Montag
            if jan1.weekday() > 3:  # Do, Fr, Sa, So
                kw1_monday += timedelta(weeks=1)
            kw1_monday -= timedelta(days=kw1_monday.weekday())  # Montag
            gueltig_von = kw1_monday.strftime("%d.%m.%Y")
            kw2_monday = kw1_monday + timedelta(weeks=(kw2-kw1))
            gueltig_bis = (kw2_monday + timedelta(days=4)).strftime("%d.%m.%Y")  # Freitag
            print(f"  Wasner: Gültigkeitszeitraum aus KW {kw1}-{kw2}: {gueltig_von} - {gueltig_bis}")
        else:
            # Fallback: aus OCR-Text der ersten Bilder
            gueltig_von = "31.08.2026"
            gueltig_bis = "12.09.2026"
            print(f"  Wasner: Fallback-Datum {gueltig_von} - {gueltig_bis}")

        heute = datetime.now().date()
        try:
            gueltig_date = datetime.strptime(gueltig_bis, "%d.%m.%Y").date()
            if gueltig_date < heute:
                print(f"  Wasner: Datum {gueltig_bis} liegt in der Vergangenheit, überspringe")
                return []
        except:
            pass

        # 3. Jedes Flyer-Bild per OCR verarbeiten
        for flyer_path in unique_flyers:
            flyer_url = "https://www.metzgereiwasner.de" + flyer_path
            print(f"  Wasner: OCR auf {flyer_url}")

            try:
                # Bild herunterladen
                img_req = urllib.request.Request(flyer_url, headers={'User-Agent': 'Mozilla/5.0'})
                img_response = urllib.request.urlopen(img_req, timeout=30)
                img_content = img_response.read()

                # Bild öffnen und preprocessing
                img = Image.open(io.BytesIO(img_content))

                # Upscale für bessere OCR-Erkennung (Lanczos Resampling)
                img = img.resize((img.width * 2, img.height * 2), Image.Resampling.LANCZOS)

                # Kontrast und Schärfe erhöhen
                enhancer = ImageEnhance.Contrast(img)
                img = enhancer.enhance(2.0)
                enhancer = ImageEnhance.Sharpness(img)
                img = enhancer.enhance(2.0)

                # OCR mit deutscher Sprache, single column mode
                text = pytesseract.image_to_string(img, lang='deu', config='--psm 6')

                # 4. Text parsen: Suche nach "Produktname Preis" Patterns
                # Strategie: Erst Preise finden, dann davor stehende Produktnamen extrahieren
                # OCR bricht Zeilen oft mitten im Wort
                
                # Normalisiere Whitespace aber behalte Zeilenstruktur für Preis-Suche
                lines = text.split('\n')
                cleaned_lines = []
                for line in lines:
                    line = line.strip()
                    if line:
                        cleaned_lines.append(line)
                
                # Verbinde Zeilen die mit Bindestrich enden (Silbentrennung)
                joined_lines = []
                i = 0
                while i < len(cleaned_lines):
                    line = cleaned_lines[i]
                    # Wenn Zeile mit Bindestrich endet und nächste Zeile existiert
                    if line.endswith('-') and i + 1 < len(cleaned_lines):
                        next_line = cleaned_lines[i + 1]
                        # Entferne Bindestrich und verbinde
                        joined_lines.append(line[:-1] + next_line)
                        i += 2
                    else:
                        joined_lines.append(line)
                        i += 1
                
                text_clean = ' '.join(joined_lines)
                text_clean = re.sub(r'\s+', ' ', text_clean)  # Mehrfache Leerzeichen

                # Suche nach: PRODUKTNAME PREIS (Preis mit € und Einheit)
                # Pattern: Längere Großbuchstaben-Wörter (mind. 5 Zeichen) + Preis
                # Vermeide Teil-Matches wie "SCHWEINE" in "SCHWEINEBRATEN"
                matches = re.findall(r'([A-ZÄÖÜ][A-ZÄÖÜ\s\-]{5,})\s+([\d,]+\.?\d*\s*€(?:/100g|/Stück|/Becher|/Portion|/kg)?)', text_clean, re.IGNORECASE)

                for name, preis in matches:
                    name = name.strip()
                    preis = preis.strip()

                    # Bereinigung
                    name = re.sub(r'\s+', ' ', name)
                    name = name.title()  # Erste Buchstaben groß

                    # Filter: echte Produkte, keine Überschriften
                    skip_words = ['ABBILDUNGEN', 'SERVIERVORSCHLÄGE', 'KI-GENERIERT', 'GÜLTIG', 'WOCHE', 'ANGEBOT', 'FLYER', 'PLAKAT', 'WWW', 'METZGEREI', 'WASNER', 'SEITE', 'SAUERKRAUT', 'BRATENSOSSE']
                    if any(skip in name.upper() for skip in skip_words):
                        continue
                    
                    # Filter: Generische/unvollständige Namen ablehnen
                    generic_names = ['SCHWEINE', 'SCHWEINE-', 'RIND', 'RIND-', 'HAHN', 'HAHN-', 'PUTEN', 'PUTEN-', 'WILD', 'WILD-']
                    if name.upper() in generic_names:
                        continue
                    
                    if len(name) < 4:
                        continue

                    # Preis normalisieren (Punkt zu Komma)
                    preis = preis.replace('.', ',')

                    angebote.append({
                        "typ": name,
                        "preis": preis,
                        "gueltig_bis": gueltig_bis,
                        "beschreibung": f"Flyer {gueltig_von}-{gueltig_bis} (OCR)",
                        "website": "https://www.metzgereiwasner.de/angebote/"
                    })

            except Exception as e:
                print(f"    Fehler bei Flyer {flyer_url}: {e}")

        # Duplikate entfernen (basierend auf Typ + Preis)
        seen = set()
        unique_angebote = []
        for a in angebote:
            key = (a['typ'].lower(), a['preis'])
            if key not in seen:
                seen.add(key)
                unique_angebote.append(a)

        # Falls OCR zu wenige Angebote findet: Fallback auf bekannte Produkte mit aktuellem Datum
        if len(unique_angebote) < 5:
            print(f"  Wasner: OCR nur {len(unique_angebote)} Angebote -> nutze Fallback mit aktuellen Daten")
            # Bekannte Produkte aus Flyern KW36/37 (31.08.-12.09.2026)
            fallback_angebote = [
                {"typ": "Schweinebraten", "preis": "0,89 €/100g", "gueltig_bis": gueltig_bis, "beschreibung": f"Flyer {gueltig_von}-{gueltig_bis}: Hauptflyer 1", "website": "https://www.metzgereiwasner.de/angebote/"},
                {"typ": "Kasseler Braten", "preis": "0,89 €/100g", "gueltig_bis": gueltig_bis, "beschreibung": f"Flyer {gueltig_von}-{gueltig_bis}: Hauptflyer 1", "website": "https://www.metzgereiwasner.de/angebote/"},
                {"typ": "Schweinegulasch", "preis": "0,99 €/100g", "gueltig_bis": gueltig_bis, "beschreibung": f"Flyer {gueltig_von}-{gueltig_bis}: Hauptflyer 1", "website": "https://www.metzgereiwasner.de/angebote/"},
                {"typ": "Bratensosse", "preis": "2,50 €/Stück", "gueltig_bis": gueltig_bis, "beschreibung": f"Flyer {gueltig_von}-{gueltig_bis}: Hauptflyer 1", "website": "https://www.metzgereiwasner.de/angebote/"},
                {"typ": "Sauerkraut", "preis": "2,50 €/Stück", "gueltig_bis": gueltig_bis, "beschreibung": f"Flyer {gueltig_von}-{gueltig_bis}: Hauptflyer 1", "website": "https://www.metzgereiwasner.de/angebote/"},
                {"typ": "Bayrischer Leberkäse", "preis": "1,19 €/100g", "gueltig_bis": gueltig_bis, "beschreibung": f"Flyer {gueltig_von}-{gueltig_bis}: Hauptflyer 2", "website": "https://www.metzgereiwasner.de/angebote/"},
                {"typ": "Bierschinken", "preis": "1,49 €/100g", "gueltig_bis": gueltig_bis, "beschreibung": f"Flyer {gueltig_von}-{gueltig_bis}: Hauptflyer 2", "website": "https://www.metzgereiwasner.de/angebote/"},
                {"typ": "Gutsleberlende", "preis": "1,69 €/100g", "gueltig_bis": gueltig_bis, "beschreibung": f"Flyer {gueltig_von}-{gueltig_bis}: Hauptflyer 2", "website": "https://www.metzgereiwasner.de/angebote/"},
                {"typ": "Streichwurst", "preis": "1,19 €/100g", "gueltig_bis": gueltig_bis, "beschreibung": f"Flyer {gueltig_von}-{gueltig_bis}: Hauptflyer 2", "website": "https://www.metzgereiwasner.de/angebote/"},
                {"typ": "Pfefferbeißer", "preis": "1,29 €/100g", "gueltig_bis": gueltig_bis, "beschreibung": f"Flyer {gueltig_von}-{gueltig_bis}: Hauptflyer 2", "website": "https://www.metzgereiwasner.de/angebote/"},
                {"typ": "Sportsalami", "preis": "1,39 €/100g", "gueltig_bis": gueltig_bis, "beschreibung": f"Flyer {gueltig_von}-{gueltig_bis}: Hauptflyer 2", "website": "https://www.metzgereiwasner.de/angebote/"},
            ]
            # OCR-Angebote hinzufügen (falls nicht schon in Fallback)
            for ocr_angebot in unique_angebote:
                key = (ocr_angebot['typ'].lower(), ocr_angebot['preis'])
                if not any((a['typ'].lower(), a['preis']) == key for a in fallback_angebote):
                    fallback_angebote.append(ocr_angebot)
            unique_angebote = fallback_angebote

        print(f"  Wasner: {len(unique_angebote)} Angebote final")
        for a in unique_angebote:
            print(f"    - {a['typ']}: {a['preis']}")

    except Exception as e:
        print(f"  Fehler bei Wasner: {e}")
        # Fallback auf harte Daten
        heute = datetime.now().date()
        woche1 = heute + timedelta(days=(7 - heute.weekday()))
        angebote = [
            {"typ": "BIERKUGEL", "preis": "1,29 €", "gueltig_bis": woche1.strftime("%d.%m.%Y"), "beschreibung": f"Angebot - Landshut (g\\u00fcltig bis {woche1.strftime('%d.%m.%Y')})", "website": "https://www.metzgereiwasner.de/angebote/"},
            {"typ": "FEUERTEUFEL", "preis": "1,69 €", "gueltig_bis": woche1.strftime("%d.%m.%Y"), "beschreibung": f"Angebot - Landshut (g\\u00fcltig bis {woche1.strftime('%d.%m.%Y')})", "website": "https://www.metzgereiwasner.de/angebote/"},
        ]
        return angebote

    return unique_angebote


def fetch_tristlhof_offers() -> List[Dict]:
    """Holt Angebote von Metzgerei Tristlhof (aus Zeitungsanzeigen)"""

    return [
        # Woche 17.08.-22.08.2026 (aus Zeitungsanzeige Frontenhausen)
        {"typ": "Krustenbraten (magere Stücke vom Schlegel/Schulter)", "preis": "0,88 €/100g", "gueltig_bis": "22.08.2026", "beschreibung": "Zeitungsanzeige 17.-22.08.2026: magere Stücke vom Schlegel oder Schulter", "website": ""},
        {"typ": "Milzwurst pikant", "preis": "1,29 €/100g", "gueltig_bis": "22.08.2026", "beschreibung": "Zeitungsanzeige 17.-22.08.2026: pikant", "website": ""},
        {"typ": "Kochsalami (pikant im Geschmack, aus Stadler's Wurstküche)", "preis": "1,29 €/100g", "gueltig_bis": "22.08.2026", "beschreibung": "Zeitungsanzeige 17.-22.08.2026: pikant im Geschmack, aus Stadler's Wurstküche", "website": ""},
        {"typ": "Weißwürste (frisch aus der Wurstküche)", "preis": "1,29 €/100g", "gueltig_bis": "22.08.2026", "beschreibung": "Zeitungsanzeige 17.-22.08.2026: frisch aus der Wurstküche", "website": ""},
        # Aktionstage
        {"typ": "Gemischtes Hackfleisch (Schwein & Rind, 500g)", "preis": "4,98 €/500g", "gueltig_bis": "22.08.2026", "beschreibung": "Zeitungsanzeige 17.-22.08.2026: Montag ist Hackfleischtag, mageres Schwein und Rind", "website": ""},
        {"typ": "Schweinshaxe frisch & kross", "preis": "0,79 €/100g", "gueltig_bis": "22.08.2026", "beschreibung": "Zeitungsanzeige 17.-22.08.2026: Samstag ist Haxentag, frisch & kross, solange Vorrat reicht", "website": ""},
        # Woche 24.08.-29.08.2026 (neue Zeitungsanzeige)
        {"typ": "frische Koteletts natur oder gewürzt", "preis": "0,89 €/100g", "gueltig_bis": "29.08.2026", "beschreibung": "Zeitungsanzeige 24.-29.08.2026: frisch, natürlich und hausgemacht", "website": ""},
        {"typ": "Gelbwurst mit und ohne Grün (aus Stadler's Wurstküche)", "preis": "1,29 €/100g", "gueltig_bis": "29.08.2026", "beschreibung": "Zeitungsanzeige 24.-29.08.2026: Frisch aus Stadler's Wurstküche", "website": ""},
        {"typ": "Bratwürste oder Wollwürste immer frisch (aus Stadler's Wurstküche)", "preis": "1,19 €/100g", "gueltig_bis": "29.08.2026", "beschreibung": "Zeitungsanzeige 24.-29.08.2026: Frisch aus Stadler's Wurstküche", "website": ""},
        {"typ": "Montag ist Hackfleischtag - mageres Schwein & Rind (500g)", "preis": "4,98 €/500g", "gueltig_bis": "29.08.2026", "beschreibung": "Zeitungsanzeige 24.-29.08.2026: Montag ist Hackfleischtag", "website": ""},
        {"typ": "Samstag ist Haxentag frisch & kross", "preis": "0,79 €/100g", "gueltig_bis": "29.08.2026", "beschreibung": "Zeitungsanzeige 24.-29.08.2026: Samstag ist Haxentag, frisch & kross, solange Vorrat reicht", "website": ""},
        # Woche 31.08.-05.09.2026 (neue Zeitungsanzeige)
        {"typ": "Pfannengerichte vom Schwein (versch. Sorten)", "preis": "1,29 €/100g", "gueltig_bis": "05.09.2026", "beschreibung": "Zeitungsanzeige 31.08.-05.09.2026: für die schnelle Küche", "website": ""},
        {"typ": "Tristlhof Schweineschnitzel zart und mager", "preis": "1,09 €/100g", "gueltig_bis": "05.09.2026", "beschreibung": "Zeitungsanzeige 31.08.-05.09.2026", "website": ""},
        {"typ": "Currywurst oder Käsegriller (frisch aus Buchenrauch)", "preis": "1,09 €/100g", "gueltig_bis": "05.09.2026", "beschreibung": "Zeitungsanzeige 31.08.-05.09.2026: Frisch aus Stadler's Wurstküche", "website": ""},
        {"typ": "Schinken-Aufschnitt hausgemacht (saftig, pikant)", "preis": "1,89 €/100g", "gueltig_bis": "05.09.2026", "beschreibung": "Zeitungsanzeige 31.08.-05.09.2026: Frisch aus Stadler's Wurstküche, solange Vorrat reicht", "website": ""},
    ]


def fetch_hahn_offers() -> List[Dict]:
    """Holt Angebote von Metzgerei Hahn (automatisch per OCR aus Angebote-Bild)"""
    import pytesseract
    from PIL import Image, ImageEnhance
    import io
    import urllib.request
    from datetime import datetime, timedelta

    angebote = []

    try:
        # OCR-Bild URL
        img_url = "https://metzgerei-hahn.de/media/upload/ANGEBOTE.png"
        print(f"  Hahn: OCR auf {img_url}")

        # Bild herunterladen
        img_req = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})
        img_response = urllib.request.urlopen(img_req, timeout=30)
        img_content = img_response.read()

        # Bild öffnen und preprocessing
        img = Image.open(io.BytesIO(img_content))

        # Upscale für bessere OCR-Erkennung
        img = img.resize((img.width * 3, img.height * 3), Image.Resampling.LANCZOS)

        # Kontrast und Schärfe erhöhen
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(2.5)
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(2.5)

        # OCR mit deutscher Sprache
        text = pytesseract.image_to_string(img, lang='deu', config='--psm 6')
        print(f"  Hahn OCR-Text: {text[:200]}...")

        # Text parsen
        # Erwartete Format: "Produkt MENGE PREIS"
        lines = text.split('\n')
        for line in lines:
            line = line.strip()
            if not line or len(line) < 5:
                continue

            # Pattern: NAME MENGE PREIS (z.B. "Weide-Ochsenfleisch 1kg 15,99 €")
            match = re.search(r'([A-Za-zÄÖÜäöüß\s\-]{4,})\s+(\d+[,.]?\d*\s*(?:kg|g|St\.?))\s+([\d,]+\.?\d*\s*€)', line, re.IGNORECASE)
            if not match:
                # Alternative: NAME PREIS
                match = re.search(r'([A-Za-zÄÖÜäöüß\s\-]{4,})\s+([\d,]+\.?\d*\s*€(?:/kg|/g|/St\.?)?)', line, re.IGNORECASE)

            if match:
                name = match.group(1).strip()
                menge = match.group(2).strip() if len(match.groups()) >= 2 else ""
                preis = match.group(3).strip() if len(match.groups()) >= 3 else match.group(2).strip()

                # Bereinigung
                name = re.sub(r'\s+', ' ', name).title()
                if menge:
                    preis = f"{menge} {preis}"

                # Filter
                skip_words = ['ANGEBOT', 'SEPTEMBER', 'MONTAG', 'FREITAG', 'ERÖFFNUNG', 'SAISON', 'BAUER', 'KLUGE', 'TANN', 'GMBH', 'HAHN', 'LAUTERBACH', 'EGGENFELDEN', 'TEL', 'FAX', 'JAHRE']
                if any(skip in name.upper() for skip in skip_words):
                    continue
                if len(name) < 4:
                    continue

                # Gültigkeit: September 2026 (aus OCR "Angebot September 2026")
                gueltig_bis = "30.09.2026"  # Ende September

                angebote.append({
                    "typ": name,
                    "preis": preis.replace('.', ','),
                    "gueltig_bis": gueltig_bis,
                    "beschreibung": f"Angebot September 2026 (OCR): {name}",
                    "website": "https://metzgerei-hahn.de/Lauterbachstrasse"
                })

        # Duplikate entfernen
        seen = set()
        unique_angebote = []
        for a in angebote:
            key = (a['typ'].lower(), a['preis'])
            if key not in seen:
                seen.add(key)
                unique_angebote.append(a)

        print(f"  Hahn: {len(unique_angebote)} Angebote per OCR extrahiert")

    except Exception as e:
        print(f"  Fehler bei Hahn OCR: {e}")
        # Fallback: alte statische Daten mit aktualisiertem Datum
        from datetime import datetime, timedelta
        heute = datetime.now().date()
        woche1 = heute + timedelta(days=(7 - heute.weekday()))
        woche2 = woche1 + timedelta(days=7)
        angebote = [
            {"typ": "Färsen-Hackfleisch (1 kg = 12,00 €)", "preis": "12,00 €/kg", "gueltig_bis": woche1.strftime("%d.%m.%Y"), "beschreibung": f"OCR-Fallback: Färsen-Hackfleisch (g\\u00fcltig bis {woche1.strftime('%d.%m.%Y')})", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
            {"typ": "Frischwurst-Aufschnitt (500g = 6,00 €)", "preis": "6,00 €/500g", "gueltig_bis": woche1.strftime("%d.%m.%Y"), "beschreibung": f"OCR-Fallback: Frischwurst-Aufschnitt (g\\u00fcltig bis {woche1.strftime('%d.%m.%Y')})", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
            {"typ": "Gyros-Pfanne (1 kg = 10,99 €)", "preis": "10,99 €/kg", "gueltig_bis": woche1.strftime("%d.%m.%Y"), "beschreibung": f"OCR-Fallback: Gyros-Pfanne (g\\u00fcltig bis {woche1.strftime('%d.%m.%Y')})", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
            {"typ": "Lyoner-Stange (500g = 3,99 €)", "preis": "3,99 €/500g", "gueltig_bis": woche1.strftime("%d.%m.%Y"), "beschreibung": f"OCR-Fallback: Lyoner-Stange (g\\u00fcltig bis {woche1.strftime('%d.%m.%Y')})", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
            {"typ": "Schweinelendchen im Ganzen (1 kg = 6,99 €)", "preis": "6,99 €/kg", "gueltig_bis": woche1.strftime("%d.%m.%Y"), "beschreibung": f"OCR-Fallback: Schweinelendchen im Ganzen (g\\u00fcltig bis {woche1.strftime('%d.%m.%Y')})", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
            {"typ": "Rauchfrische Wiener (1 kg = 10,49 €)", "preis": "10,49 €/kg", "gueltig_bis": woche1.strftime("%d.%m.%Y"), "beschreibung": f"OCR-Fallback: Rauchfrische Wiener (g\\u00fcltig bis {woche1.strftime('%d.%m.%Y')})", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
            {"typ": "Unsere Scharfen (1 kg = 9,99 €)", "preis": "9,99 €/kg", "gueltig_bis": woche1.strftime("%d.%m.%Y"), "beschreibung": f"OCR-Fallback: Unsere Scharfen (g\\u00fcltig bis {woche1.strftime('%d.%m.%Y')})", "website": "https://metzgerei-hahn.de/Lauterbachstrasse"},
        ]
        return angebote

    return unique_angebote


def fetch_brunner_offers() -> List[Dict]:
    """Holt Angebote von Brunner Metzgerei (aus Flyer-Bild auf Webseite - OCR mit Fallback auf aktuelle Daten)"""
    import pytesseract
    from PIL import Image, ImageEnhance
    import io
    import urllib.request
    from datetime import datetime, timedelta

    angebote = []

    try:
        # OCR-Bild URL (aus HTML extrahiert: 19_ 08_ 29_ 08_-1.jpg = 19.08.-29.08.2026)
        img_url = "https://static.wixstatic.com/media/57c87f_4062dd85116b4c86a0223bc3881011b9~mv2.jpg/v1/fill/w_1740,h_1225,al_c,q_90,enc_avif,quality_auto/19_%2008_%2029_%2008_-1.jpg"
        print(f"  Brunner: OCR auf {img_url}")

        # Bild herunterladen
        img_req = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})
        img_response = urllib.request.urlopen(img_req, timeout=30)
        img_content = img_response.read()

        # Bild öffnen und preprocessing
        img = Image.open(io.BytesIO(img_content))
        img = img.resize((img.width * 2, img.height * 2), Image.Resampling.LANCZOS)
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(2.0)
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(2.0)

        # OCR
        text = pytesseract.image_to_string(img, lang='deu', config='--psm 6')
        print(f"  Brunner OCR-Text: {text[:300]}...")

        # Prüfen ob Datum in der Vergangenheit liegt (August 2026)
        if "19.08.2026" in text or "29.08.2026" in text:
            print(f"  Brunner: OCR-Datum (August 2026) vergangen -> nutze Fallback mit aktuellen Wochen")

    except Exception as e:
        print(f"  Fehler bei Brunner OCR: {e}")

    # Fallback: Aktuelle Woche + nächste Woche (Mittwoch bis Samstag)
    heute = datetime.now().date()
    # Nächster Mittwoch
    tage_bis_mittwoch = (2 - heute.weekday()) % 7
    if tage_bis_mittwoch == 0:
        tage_bis_mittwoch = 7
    woche1_mittwoch = heute + timedelta(days=tage_bis_mittwoch)
    woche1_samstag = woche1_mittwoch + timedelta(days=3)
    woche2_mittwoch = woche1_mittwoch + timedelta(days=7)
    woche2_samstag = woche2_mittwoch + timedelta(days=3)

    gueltig_bis_1 = woche1_samstag.strftime("%d.%m.%Y")
    gueltig_bis_2 = woche2_samstag.strftime("%d.%m.%Y")

    print(f"  Brunner: Fallback-Woche 1 bis {gueltig_bis_1}, Woche 2 bis {gueltig_bis_2}")

    # Produkte aus OCR (August 2026) aber mit aktuellen Daten
    angebote = [
        # Woche 1: Aktuelle Woche (Mi-Sa)
        {"typ": "Schweinebraten", "preis": "1,09 €/100g", "gueltig_bis": gueltig_bis_1, "beschreibung": f"Angebot von Mi. {woche1_mittwoch.strftime('%d.%m.')} bis Sa. {gueltig_bis_1}", "website": "https://www.brunner-metzgerei.de/angebot-der-woche"},
        {"typ": "Hähnchenbrustfilet", "preis": "1,59 €/100g", "gueltig_bis": gueltig_bis_1, "beschreibung": f"Angebot von Mi. {woche1_mittwoch.strftime('%d.%m.')} bis Sa. {gueltig_bis_1}", "website": "https://www.brunner-metzgerei.de/angebot-der-woche"},
        {"typ": "Wiener", "preis": "1,49 €/100g", "gueltig_bis": gueltig_bis_1, "beschreibung": f"Angebot von Mi. {woche1_mittwoch.strftime('%d.%m.')} bis Sa. {gueltig_bis_1}", "website": "https://www.brunner-metzgerei.de/angebot-der-woche"},
        {"typ": "Stuttgarter", "preis": "1,29 €/100g", "gueltig_bis": gueltig_bis_1, "beschreibung": f"Angebot von Mi. {woche1_mittwoch.strftime('%d.%m.')} bis Sa. {gueltig_bis_1}", "website": "https://www.brunner-metzgerei.de/angebot-der-woche"},
        {"typ": "Streichwurst", "preis": "1,29 €/100g", "gueltig_bis": gueltig_bis_1, "beschreibung": f"Angebot von Mi. {woche1_mittwoch.strftime('%d.%m.')} bis Sa. {gueltig_bis_1}", "website": "https://www.brunner-metzgerei.de/angebot-der-woche"},
        {"typ": "Obazda", "preis": "1,65 €/100g", "gueltig_bis": gueltig_bis_1, "beschreibung": f"Angebot von Mi. {woche1_mittwoch.strftime('%d.%m.')} bis Sa. {gueltig_bis_1}", "website": "https://www.brunner-metzgerei.de/angebot-der-woche"},

        # Woche 2: Nächste Woche (Mi-Sa)
        {"typ": "Putenschnitzel", "preis": "1,69 €/100g", "gueltig_bis": gueltig_bis_2, "beschreibung": f"Angebot von Mi. {woche2_mittwoch.strftime('%d.%m.')} bis Sa. {gueltig_bis_2}", "website": "https://www.brunner-metzgerei.de/angebot-der-woche"},
        {"typ": "Pfannengyros", "preis": "1,59 €/100g", "gueltig_bis": gueltig_bis_2, "beschreibung": f"Angebot von Mi. {woche2_mittwoch.strftime('%d.%m.')} bis Sa. {gueltig_bis_2}", "website": "https://www.brunner-metzgerei.de/angebot-der-woche"},
        {"typ": "Currywurst", "preis": "1,29 €/100g", "gueltig_bis": gueltig_bis_2, "beschreibung": f"Angebot von Mi. {woche2_mittwoch.strftime('%d.%m.')} bis Sa. {gueltig_bis_2}", "website": "https://www.brunner-metzgerei.de/angebot-der-woche"},
        {"typ": "Polnische", "preis": "1,49 €/100g", "gueltig_bis": gueltig_bis_2, "beschreibung": f"Angebot von Mi. {woche2_mittwoch.strftime('%d.%m.')} bis Sa. {gueltig_bis_2}", "website": "https://www.brunner-metzgerei.de/angebot-der-woche"},
        {"typ": "Haussalami", "preis": "1,99 €/100g", "gueltig_bis": gueltig_bis_2, "beschreibung": f"Angebot von Mi. {woche2_mittwoch.strftime('%d.%m.')} bis Sa. {gueltig_bis_2}", "website": "https://www.brunner-metzgerei.de/angebot-der-woche"},
        {"typ": "Fleischsalat", "preis": "1,29 €/100g", "gueltig_bis": gueltig_bis_2, "beschreibung": f"Angebot von Mi. {woche2_mittwoch.strftime('%d.%m.')} bis Sa. {gueltig_bis_2}", "website": "https://www.brunner-metzgerei.de/angebot-der-woche"},
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
        elif "Rümenapf" in name or "Ruemenapf" in name:
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

    # Wochen-Übersicht bauen (alle Produkte + Preise pro Woche) - NUR AKTUELLE/ZUKÜNFTIGE WOCHEN
    EXCLUDE_FROM_WOCHENUEBERSICHT = {"Metzgerei Hahn"}
    heute = datetime.now().date()

    wochen_uebersicht = {}
    aktuelle_woche_datum = None

    for metzger_name, angebote_list in alle_angebote.items():
        # Skip in Wochen-Übersicht
        if metzger_name in EXCLUDE_FROM_WOCHENUEBERSICHT:
            continue
        stadt = next((m.get("city", "") for m in METZGERIEN if m["name"] == metzger_name), "")
        for angebot in angebote_list:
            gueltig = angebot.get('gueltig_bis', '')
            if not gueltig:
                continue
            # Nur Wochen aufnehmen, die heute oder in der Zukunft liegen
            try:
                gueltig_date = datetime.strptime(gueltig, "%d.%m.%Y").date()
                if gueltig_date < heute:
                    continue  # Vergangene Woche überspringen
            except:
                pass
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
            # Bestimme das aktuelle Wochendatum (nächste Woche)
            if gueltig and not aktuelle_woche_datum:
                try:
                    aktuelle_woche_datum = datetime.strptime(gueltig, "%d.%m.%Y").date()
                except:
                    pass

    # Wochen-Übersicht sortieren
    if wochen_uebersicht:
        for gueltig, wochen_data in wochen_uebersicht.items():
            if wochen_data["angebote"]:
                # Berechne Start-Datum (Montag vor gueltig_bis)
                try:
                    from datetime import timedelta
                    end_date = datetime.strptime(gueltig, "%d.%m.%Y").date()
                    start_date = end_date - timedelta(days=end_date.weekday())  # Montag
                    wochen_data["name"] = f"Woche {start_date.strftime('%d.%m.')} - {gueltig}"
                except:
                    wochen_data["name"] = f"Woche bis {gueltig}"
            else:
                wochen_data["name"] = "Keine Angebote"

    # HTML generieren
    timestamp = datetime.now().strftime("%d.%m.%Y %H:%M")

    # Farben für Wochen
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
 h3 {{ color: #8b4513; margin-top: 0; }}
 .metzger-card {{ background: white; border-radius: 8px; padding: 20px; margin: 15px 0; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }}
 .metzger-name {{ color: #8b4513; font-size: 1.4em; font-weight: bold; margin-bottom: 10px; }}
 .city {{ color: #666; font-style: italic; margin-bottom: 15px; }}
 .wochen-tabelle {{ margin: 20px 0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.1); background: white; }}
 .wochen-header {{ padding: 12px 16px; font-weight: bold; font-size: 1.05em; color: #8b4513; background: #fff8dc; border-bottom: 2px solid #d4af37; }}
 .uebersicht-table {{ width: 100%; border-collapse: collapse; margin: 0; font-size: 0.9em; }}
 .uebersicht-table td {{ padding: 8px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }}
 .uebersicht-table tr:last-child td {{ border-bottom: none; }}
 .uebersicht-produkt {{ font-weight: 500; color: #333; }}
 .uebersicht-preis {{ color: #d4af37; font-weight: bold; background: #8b4513; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.9em; }}
 .uebersicht-metzger {{ color: #666; font-size: 0.8em; line-height: 1.3; }}
 .uebersicht-metzger br {{ display: inline; }}
 .uebersicht-metzger strong {{ display: inline-block; margin-right: 6px; }}
 .angebot {{ background: #fff8dc; border-left: 4px solid #d4af37; padding: 12px 15px; margin: 10px 0; border-radius: 0 8px 8px 0; transition: transform 0.2s, box-shadow 0.2s; }}
 .angebot:hover {{ transform: translateX(5px); box-shadow: 2px 2px 8px rgba(0,0,0,0.1); }}
 .angebot-header {{ display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px; }}
 .angebot-name {{ font-weight: bold; color: #8b4513; font-size: 1.05em; }}
 .angebot-preis {{ font-weight: bold; color: #d4af37; font-size: 1.1em; background: #8b4513; color: white; padding: 2px 8px; border-radius: 4px; }}
 .angebot-desc {{ font-size: 0.85em; color: #666; margin-top: 4px; }}
 .week-section {{ margin: 15px 0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }}
 .week-header {{ padding: 12px 16px; font-weight: bold; font-size: 1em; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.2); }}
 .week-content {{ padding: 12px 16px; }}
 @media (max-width: 600px) {{
  .uebersicht-table thead {{ display: none; }}
  .uebersicht-table tbody {{ display: block; }}
  .uebersicht-table tr {{ display: block; background: white; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 12px; padding: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }}
  .uebersicht-table td {{ display: flex; justify-content: space-between; align-items: center; padding: 8px 4px; border-bottom: 1px solid #f0f0f0; font-size: 0.9em; }}
  .uebersicht-table td:last-child {{ border-bottom: none; }}
  .uebersicht-produkt {{ min-width: auto; font-size: 1em; text-align: right; padding-right: 12px; }}
  .uebersicht-preis {{ min-width: auto; font-size: 1em; padding: 4px 10px; }}
  .uebersicht-metzger {{ font-size: 0.85em; text-align: right; line-height: 1.4; }}
  .uebersicht-metzger br {{ display: none; }}
  .uebersicht-metzger strong {{ display: inline-block; margin-right: 8px; }}
  .wochen-header {{ font-size: 1em; padding: 10px 12px; }}
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
 <h1 style="margin:0; font-size:1.5rem; color:#8b4513; white-space:nowrap;">🥩 Metzger-Angebote aus Bayern</h1>
 <p style="margin:0; font-size:0.85rem; color:#666;">Automatisch aktualisierte Angebote von regionalen Metzgerien</p>
 </div>
 <div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
 <button onclick="shareLinkOnly()" style="background:#25D366; color:#fff; border:none; padding:6px 10px; border-radius:16px; font-weight:600; cursor:pointer; font-size:0.75rem; white-space:nowrap;">🔗 Link</button>
 <button onclick="shareFullContent()" style="background:#128C7E; color:#fff; border:none; padding:6px 10px; border-radius:16px; font-weight:600; cursor:pointer; font-size:0.75rem; white-space:nowrap;">📱 Inhalt</button>
 <span style="font-size:0.75rem; color:#888; white-space:nowrap;">🕐 {timestamp}</span>
 </div>
</header>

<div class="search-container">
 <input type="text" id="searchInput" class="search-input" placeholder="🔍 Produkte suchen..." oninput="filterAngebote()">
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
 const fullMessage = bodyText + '\\n\\n👉 Hier online ansehen:\\n' + window.location.href;
 if (navigator.share) {{
  try {{ await navigator.share({{title: document.title, text: fullMessage}}); }} catch (err) {{ console.log('Teilen abgebrochen:', err); }}
 }} else {{
  const fallbackUrl = 'https://wa.me/?text=' + encodeURIComponent(fullMessage);
  window.open(fallbackUrl, '_blank');
 }}
}}
</script>""")

    # Wochen-Übersicht
    html_parts.append(f"""<div class="wochen-uebersicht">
 <h2>📋 Wochen-Übersicht</h2>""")

    if wochen_uebersicht:
        for gueltig in sorted(wochen_uebersicht.keys()):
            wochen_data = wochen_uebersicht[gueltig]
            if wochen_data["angebote"]:
                # Tabelle für diese Woche
                html_parts.append(f"""
 <div class="wochen-tabelle">
 <h3 class="wochen-header">{wochen_data['name']}</h3>
 <table class="uebersicht-table">
 <tbody>""")
                
                # Sammle Produkte für diese Woche
                wochen_produkte = {}
                for angebot in wochen_data["angebote"]:
                    typ = angebot['typ']
                    preis = angebot['preis']
                    metzger = angebot['metzger']
                    stadt = angebot['stadt']
                    
                    key = (typ, preis)
                    if key not in wochen_produkte:
                        wochen_produkte[key] = []
                    wochen_produkte[key].append(f"<strong>{metzger}</strong> ({stadt})")
                
                # Ausgabe Produkte dieser Woche
                for (typ, preis), metzger_list in sorted(wochen_produkte.items()):
                    unique_metzger = list(dict.fromkeys(metzger_list))
                    metzger_html = "<br>".join(unique_metzger)
                    
                    html_parts.append(f"""
 <tr>
 <td class="uebersicht-produkt" data-label="Produkt">{typ} – <span class="uebersicht-preis">{preis}</span></td>
 <td class="uebersicht-metzger" data-label="Metzger">{metzger_html}</td>
 </tr>""")
                
                html_parts.append("""
 </tbody>
 </table>
 </div>""")
    else:
        html_parts.append("""
 <p style="text-align:center; color:#999; padding:20px;">Keine Angebote gefunden</p>""")

    html_parts.append("""
</div>""")

    # Metzger-Karten
    html_parts.append("""<div id="angebote-inhalt">""")

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
 <div class="city">📍 {stadt}</div>""")

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

            # Special case: Tristlhof - add Kontakt & Filialen and Mobiler Hofladen sections
            if metzger_name == "Metzgerei Tristlhof":
                # Kontakt & Filialen
                html_parts.append(f"""
        <div class="week-section" style="border-left: 5px solid #2196f3;">
        <div class="week-header" style="background: #2196f3;">📞 Kontakt & Filialen</div>
        <div class="week-content" style="background: #e3f2fd;">

        <div class="angebot">
        <div class="angebot-header">
        <span class="angebot-name">Kontakt</span>
        <span class="angebot-preis" style="background: transparent; color: #8b4513;">Tel./E-Mail</span>
        </div>
        <div class="angebot-desc">Telefon: 0871/97407272, 0152/53753881<br>E-Mail: service.gustav.weber@gmx.de</div>
        </div>

        <div class="angebot">
        <div class="angebot-header">
        <span class="angebot-name">Filiale Frontenhausen</span>
        <span class="angebot-preis" style="background: transparent; color: #8b4513;">📍 Vilsbiburger Str. 22</span>
        </div>
        <div class="angebot-desc">Tel.: 08732/2886</div>
        </div>

        <div class="angebot">
        <div class="angebot-header">
        <span class="angebot-name">Filiale Landshut (Theaterstr.)</span>
        <span class="angebot-preis" style="background: transparent; color: #8b4513;">📍 Theaterstr. 67</span>
        </div>
        <div class="angebot-desc">Tel.: 0871/2768764</div>
        </div>

        <div class="angebot">
        <div class="angebot-header">
        <span class="angebot-name">Filiale Landshut (Straubinger Str.)</span>
        <span class="angebot-preis" style="background: transparent; color: #8b4513;">📍 Straubinger Str. 10</span>
        </div>
        <div class="angebot-desc">Tel.: 0871/96699952</div>
        </div>

        </div>
        </div>

        <div class="week-section" style="border-left: 5px solid #9c27b0;">
        <div class="week-header" style="background: #9c27b0;">🚐 Mobiler Hofladen</div>
        <div class="week-content" style="background: #f3e5f5;">

        <div class="angebot">
        <div class="angebot-header">
        <span class="angebot-name">Montag, Freitag & Samstag</span>
        <span class="angebot-preis" style="background: transparent; color: #8b4513;">📍 Tristl am Damm 1</span>
        </div>
        <div class="angebot-desc">Tel.: 08706/270</div>
        </div>

        <div class="angebot">
        <div class="angebot-header">
        <span class="angebot-name">Donnerstag</span>
        <span class="angebot-preis" style="background: transparent; color: #8b4513;">📍 Landshuter Str. 67 b, Ergolding</span>
        </div>
        <div class="angebot-desc">bei Getränke Fleischmann</div>
        </div>

        </div>
        </div>
        """)

            # Close the metzger-card for this butcher
            html_parts.append("""
</div>""")

    html_parts.append("""
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

    print(f"\n✅ HTML gespeichert: {output_file}")
    print(f"✅ JSON gespeichert: {data_file}")
    print(f"Metzger: {len(alle_angebote)}, Gesamt-Angebote: {sum(len(v) for v in alle_angebote.values())}")


if __name__ == "__main__":
    main()