#!/usr/bin/env python3
"""
Metzger-Angebote Scraper
Prüft Websites auf aktuelle Angebote und aktualisiert all.json
"""

import json
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from pathlib import Path
import sys

sys.path.insert(0, '/root/bayerische-kartenspiele')

JSON_FILE = Path('/root/bayerische-kartenspiele/data/metzger/all.json')

METZGER_URLS = {
    'wasner': 'https://www.metzgereiwasner.de/angebote/',
    'brandl': 'https://www.metzgerei-brandl.de/',
    'brunner': 'https://www.brunner-metzgerei.de/angebot-der-woche',
    'ruemenapf': 'https://www.metzgerei-ruemenapf.de/',
    'tristlhof': 'https://www.metzgerei-tristlhof.de/',
    'hahn': 'https://metzgerei-hahn.de/',
}

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'de-DE,de;q=0.9',
}

def load_json():
    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(data):
    data['scraped_at'] = datetime.now().isoformat()
    with open(JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def fetch_page(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        print(f"  ❌ Fehler beim Laden von {url}: {e}")
        return None

def parse_ruemenapf(html):
    """Rümenapf hat klare Tabellen-Struktur"""
    soup = BeautifulSoup(html, 'html.parser')
    angebote = []
    
    for table in soup.find_all('table', class_='angebote'):
        for row in table.find_all('tr'):
            tds = row.find_all('td')
            if len(tds) >= 3:
                name = tds[0].get_text(strip=True)
                gewicht = tds[1].get_text(strip=True)
                preis = tds[2].get_text(strip=True)
                if name and preis:
                    angebote.append({
                        'name': name,
                        'gewicht': gewicht,
                        'preis': preis
                    })
    return angebote

def parse_brandl(html):
    """Brandl - prüfen ob Angebote-Seite existiert"""
    soup = BeautifulSoup(html, 'html.parser')
    # Brandl hat oft keine strukturierten Angebote
    angebote = []
    # Suche nach Preisen
    text = soup.get_text()
    # Einfache Suche nach Preis-Mustern
    preise = re.findall(r'([\w\s]+)\s+(\d+[,.]\d{2}\s*€)', text)
    for match in preise[:10]:
        angebote.append({'name': match[0].strip(), 'preis': match[1].strip()})
    return angebote

def parse_brunner(html):
    """Brunner - Wix-Seite, schwer zu scrapen"""
    # Wix-Seiten sind JS-lastig, schwer zu scrapen ohne Browser
    return []

def parse_ruemenapf_from_url():
    url = METZGER_URLS['ruemenapf']
    html = fetch_page(url)
    if html:
        return parse_ruemenapf(html)
    return []

def check_and_update():
    data = load_json()
    updated = False
    
    print("🔍 Prüfe Metzger-Websites auf neue Angebote...")
    
    # Rümenapf - funktioniert gut
    print("\n📍 Prüfe Rümenapf...")
    ruemenapf_angebote = parse_ruemenapf_from_url()
    if ruemenapf_angebote:
        print(f"  ✅ {len(ruemenapf_angebote)} Angebote gefunden")
        for m in data['metzgereien']:
            if m['id'] == 'ruemenapf':
                # Vergleiche mit bestehenden
                alte = m['angebote'][0]['produkte'] if m['angebote'] else []
                neue = [{'name': a['name'], 'preis': a['preis']} for a in ruemenapf_angebote]
                if str(alte) != str(neue):
                    m['angebote'][0]['produkte'] = neue
                    m['angebote'][0]['gueltig'] = datetime.now().strftime('%d.%m.%Y - %d.%m.%Y')
                    updated = True
                    print(f"  🔄 Aktualisiert: {len(neue)} Produkte")
                else:
                    print(f"  ✓ Keine Änderungen")
                break
    
    # Für andere Metzger: manuelle Prüfung nötig
    print("\n⚠️  Andere Metzger (Brandl, Brunner, Hahn, Tristlhof):")
    print("  - Websites sind JavaScript-lastig oder haben keine strukturierten Angebote")
    print("  - Empfehlung: Manuelle Prüfung oder OCR für Flyer-Bilder")
    
    if updated:
        save_json(data)
        print("\n✅ all.json aktualisiert und gespeichert")
    else:
        print("\n✓ Keine Änderungen notwendig")
    
    return updated

if __name__ == '__main__':
    check_and_update()