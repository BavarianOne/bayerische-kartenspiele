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
        from typing import List, Dict
        # Hole die Hauptseite um die aktuellen Flyer-Links zu finden
        main_url = "https://www.metzgereiwasner.de/angebote/"
        req = urllib.request.Request(main_url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=30)
        html = response.read().decode('utf-8')
        # Finde alle Wochen-Flyer Bilder (Haupt-Landshut Angebot)
        flyer_pattern = r'<img[^>]*src="([^"]*wasner_plakate_kw\d+_\d+[^"]*\.(?:jpg|jpeg|png))"[^>]*>'
        flyer_urls = re.findall(flyer_pattern, html)
        # Falls keine gefunden, suche allgemeiner nach Angebotsbildern
        if not flyer_urls:
            flyer_pattern = r'<img[^>]*src="([^"]*angebote[^"]*\.(?:jpg|jpeg|png))"[^>]*>'
            flyer_urls = re.findall(flyer_pattern, html)
        print(f"  Wasner: {len(flyer_urls)} Flyer-Bilder gefunden")
        # Heute als Vergleichsdatum
        heute = datetime.now().date()
        zukuenftige_flyer = 0
        for flyer_url in flyer_urls[:3]:  # Maximal 3 Flyer verarbeiten
            if not flyer_url.startswith('http'):
                flyer_url = 'https://www.metzgereiwasner.de' + flyer_url
            print(f"  Wasner Flyer: {flyer_url}")
            # Extrahiere Datum aus URL falls möglich (wasner_plakate_kw32_33_a1_v01_cc_260708.jpg)
            date_match = re.search(r'wasner_plakate_kw(\d+)_(\d+)', flyer_url)
            gueltig_bis_str = ""
            if date_match:
                kw_start, kw_end = date_match.groups()
                # Approximiere: KW 32 etwa Anfang August
                # Für jetzt: verwende aktuelle Woche + 2 Wochen als Gültigkeit
                # In echter Implementierung würde man das Datum aus dem Bild OCR extrahieren
                gueltig_bis_str = "15.08.2026"  # Platzhalter - wäre besser aus OCR
            try:
                # Bild herunterladen
                img_req = urllib.request.Request(flyer_url, headers={'User-Agent': 'Mozilla/5.0'})
                img_response = urllib.request.urlopen(img_req, timeout=30)
                img_data = img_response.read()
                # Temporäre Datei
                with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as img_file:
                    img_file.write(img_data)
                    img_path = img_file.name
                try:
                    # OCR mit Tesseract
                    txt_path = img_path.replace('.jpg', '')
                    result = subprocess.run(['tesseract', img_path, txt_path, '-l', 'deu'],
                                          capture_output=True, check=True, timeout=30)
                    # OCR-Text lesen
                    with open(txt_path + '.txt', 'r', encoding='utf-8') as f:
                        ocr_text = f.read()
                    print(f"  Wasner OCR-Text gelesen ({len(ocr_text)} Zeichen)")
                    print(f"  OCR-Text: {repr(ocr_text)}")
                    # Parse OCR-Text für Fleisch und Wurst Produkte
                    # Filtere aus: Mittagessen, Tagesgericht, etc.
                    # Wir arbeiten mit dem GESAMTEN OCR-Text, nicht zeilenweise
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
                        'nudelsalat', 'obazda', 'oktoberfest',
                        'geschwollene'
                    ]

                    # 1. Finde ALLE Preise im gesamten OCR-Text (mit Position)
                    preis_matches = list(re.finditer(r'(\d+[,.]\d{2})', ocr_text))
                    preise = [(m.group(1).replace(',', '.') + ' €', m.start(), m.end()) for m in preis_matches]

                    # 2. Finde ALLE Produkt-Keywords im gesamten OCR-Text (mit Position)
                    produkt_positionen = []
                    for keyword in fleisch_wurst_keywords:
                        pattern = r'(?:' + re.escape(keyword) + r')'
                        for match in re.finditer(pattern, ocr_text.lower()):
                            start, end = match.span()
                            # Erweitere um das ganze Wort im Original-Text
                            orig_start = start
                            orig_end = end
                            # Erweitere nach links (Buchstaben, Bindestriche, Zahlen)
                            while orig_start > 0 and (ocr_text[orig_start-1].isalpha() or ocr_text[orig_start-1] in '-0123456789'):
                                orig_start -= 1
                            # Erweitere nach rechts (Buchstaben, Bindestriche, Zahlen)
                            while orig_end < len(ocr_text) and (ocr_text[orig_end].isalpha() or ocr_text[orig_end] in '-0123456789'):
                                orig_end += 1
                            wort = ocr_text[orig_start:orig_end]
                            # Prüfe ob dieses Wort NICHT ein Ausschluss-Wort ist
                            wort_lower = wort.lower()
                            is_ausgeschlossen = any(aus in wort_lower for aus in ausschluss_keywords)
                            if not is_ausgeschlossen:
                                produkt_positionen.append((wort, orig_start, orig_end))

                    # Dedupliziere Produkte (behalte früheste Position)
                    unique_produkte = {}
                    for wort, start, end in produkt_positionen:
                        key = wort.lower()
                        if key not in unique_produkte or start < unique_produkte[key][1]:
                            unique_produkte[key] = (wort, start, end)

                    produkte = [(v[0], v[1], v[2]) for v in unique_produkte.values()]
                    produkte.sort(key=lambda x: x[1])  # Sortiere nach Position

                    if produkte and preise:
                        # Pairing: Für jedes Produkt, finde den nächsten Preis NACH dem Produkt
                        for produkt_name, prod_start, prod_end in produkte:
                            # Finde Preis nach dem Produkt (innerhalb von ca. 200 Zeichen)
                            passender_preis = "Preis auf Anfrage"
                            for preis_str, preis_start, preis_end in preise:
                                if preis_start > prod_end and (preis_start - prod_end) < 200:  # Preis kommt nach Produkt, max 200 Zeichen weg
                                    passender_preis = preis_str
                                    break

                            # Bereinige Produktnamen
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
                        # Produkte aber keine Preise
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
                    # Cleanup
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
        # Fallback zum ursprünglichen Hinweis
        angebote = [{
            "typ": "������������� Wochenangebote als Flyer-Bilder",
            "preis": "",
            "gueltig_bis": "15.08.2026",
            "beschreibung": "Filiale Landshut: Am alten Viehmarkt 5, 84028 Landshut | Angebote nur als Bilder verfügbar - siehe Website",
            "website": "https://www.metzgereiwasner.de/angebote/"
        }]
    # Falls nichts gefunden, aber wir wollten etwas zurückgeben
    if not angebote:
        angebote = [{
            "typ": "������������� Wochenangebote als Flyer-Bilder",
            "preis": "",
            "gueltig_bis": "15.08.2026",
            "beschreibung": "Filiale Landshut: Am alten Viehmarkt 5, 84028 Landshut | OCR der Bilder lief, aber keine Fleisch/Wurst-Produkte erkannt",
            "website": "https://www.metzgereiwasner.de/angebote/"
        }]
    return angebote