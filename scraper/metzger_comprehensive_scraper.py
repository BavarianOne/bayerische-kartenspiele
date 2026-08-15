
#!/usr/bin/env python3
"""
Umfassender Metzger-Scraper für alle 6 Metzger - KOMPLETTE VERSION
Strategien:
- Wasner: OCR-Pipeline (Flyer-Bilder) - FUNKTIONIERT
- Rümenapf: HTML-Table-Parsing - FUNKTIONIERT (Encoding fix)
- Brandl: PDF-Parsing (pdfplumber) - FUNKTIONIERT
- Brunner: HTML-Parsing (Fallback ohne Playwright) - NEU
- Hahn: OCR für Flyer-Bilder - VORBEREITET
- Tristlhof: Manuelle Daten - FUNKTIONIERT
"""

import json
import re
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Any
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Paths
BASE_DIR = Path('/root/bayerische-kartenspiele')
DATA_DIR = BASE_DIR / 'data' / 'metzger'
SCRAPER_DIR = BASE_DIR / 'scraper'
WASNER_RAW_DIR = DATA_DIR / 'wasner_raw'
ALL_JSON = DATA_DIR / 'all.json'

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
WASNER_RAW_DIR.mkdir(parents=True, exist_ok=True)

# Try imports
try:
    import requests
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False

try:
    from playwright.sync_api import sync_playwright
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False

try:
    import pytesseract
    from PIL import Image
    HAS_TESSERACT = True
except ImportError:
    HAS_TESSERACT = False

# Metzger-Konfiguration
METZGER_CONFIG = {
    'wasner': {
        'name': 'Metzgerei Wasner',
        'city': 'Landshut',
        'url': 'https://www.metzgereiwasner.de/angebote/',
        'strategy': 'ocr',
        'flyer_dir': WASNER_RAW_DIR,
        'structured_file': WASNER_RAW_DIR / 'structured_offers.json',
    },
    'ruemenapf': {
        'name': 'Metzgerei Rümenapf',
        'city': 'Ergolding',
        'url': 'https://www.metzgerei-ruemenapf.de/',
        'strategy': 'html_table',
    },
    'brandl': {
        'name': 'Metzgerei Brandl',
        'city': 'Landshut',
        'url': 'https://www.metzgerei-brandl.de/speisekarten-angebote',
        'strategy': 'pdf',
        'pdf_base': 'https://www.metzgerei-brandl.de',
    },
    'brunner': {
        'name': 'Brunner Metzgerei',
        'city': 'Landshut',
        'url': 'https://www.brunner-metzgerei.de/angebot-der-woche',
        'strategy': 'html_fallback',  # Ohne Playwright
    },
    'hahn': {
        'name': 'Metzgerei Hahn',
        'city': 'Eggenfelden',
        'url': 'https://metzgerei-hahn.de/Lauterbachstrasse',
        'strategy': 'ocr',
        'flyer_dir': DATA_DIR / 'hahn_raw',
    },
    'tristlhof': {
        'name': 'Metzgerei Tristlhof',
        'city': 'Landshut',
        'url': '',
        'strategy': 'manual',
        'manual_data': {
            'kontakt': {
                'telefon': ['0871/97407272', '0152/53753881'],
                'email': 'service.gustav.weber@gmx.de',
            },
            'filialen': [
                {'name': 'Frontenhausen', 'adresse': 'Vilsbiburger Str. 22', 'tel': '08732/2886'},
                {'name': 'Landshut Theaterstr.', 'adresse': 'Theaterstr. 67', 'tel': '0871/2768764'},
                {'name': 'Landshut Straubinger Str.', 'adresse': 'Straubinger Str. 10', 'tel': '0871/96699952'},
            ],
            'mobile': [
                {'tag': 'Montag, Freitag & Samstag', 'ort': 'Tristl am Damm 1', 'tel': '08706/270'},
                {'tag': 'Donnerstag', 'ort': 'Landshuter Str. 67 b, Ergolding bei Getränke Fleischmann'},
            ],
            'angebote': [
                {'name': 'Krustenbraten', 'preis': '', 'desc': 'magere Stücke von Schlegel oder Schulter'},
                {'name': 'Milzwurst pikant', 'preis': '', 'desc': 'Frisch aus Stadler\'s Wurstküche'},
                {'name': 'Kochsalami pikant im Geschmack', 'preis': '1,29 €', 'desc': ''},
                {'name': 'Weißwürste frisch aus der Wurstküche', 'preis': '1,29 €', 'desc': ''},
                {'name': '🥩 Hackfleischtag (Montag)', 'preis': '500 g 4,98 €', 'desc': 'mageres Schwein und Rind'},
                {'name': '🥩 Haxentag (Samstag)', 'preis': '100 g 0,79 €', 'desc': 'frisch & kross'},
                {'name': 'Weitere Angebote', 'preis': '100 g 0,88 €', 'desc': ''},
                {'name': 'Weitere Angebote', 'preis': '100 g 1,29 €', 'desc': ''},
                {'name': 'Weitere Angebote', 'preis': '100 g 1,29 €', 'desc': ''},
            ],
        },
    },
}

class BaseScraper:
    """Basisklasse für alle Scraper"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.name = config['name']
        self.session = requests.Session() if HAS_BS4 else None
        if self.session:
            self.session.headers.update({
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'de-DE,de;q=0.9',
            })
    
    def fetch(self, url: str) -> Optional[str]:
        """Lädt HTML-Seite herunter"""
        if not self.session:
            logger.error(f"[{self.name}] Keine requests-Session verfügbar")
            return None
        try:
            resp = self.session.get(url, timeout=20)
            resp.raise_for_status()
            return resp.text
        except Exception as e:
            logger.error(f"[{self.name}] Fehler beim Laden von {url}: {e}")
            return None
    
    def parse(self, html: str) -> List[Dict]:
        raise NotImplementedError
    
    def run(self) -> List[Dict]:
        url = self.config.get('url', '')
        if not url:
            logger.warning(f"[{self.name}] Keine URL konfiguriert")
            return []
        
        logger.info(f"[{self.name}] Lade {url}")
        html = self.fetch(url)
        if not html:
            return []
        
        angebote = self.parse(html)
        logger.info(f"[{self.name}] {len(angebote)} Angebote gefunden")
        return angebote


class WasnerScraper(BaseScraper):
    """Wasner nutzt bestehende OCR-Pipeline"""
    
    def parse(self, html: str) -> List[Dict]:
        structured_file = self.config.get('structured_file')
        if structured_file and structured_file.exists():
            try:
                with open(structured_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                angebote = data.get('angebote', [])
                logger.info(f"[{self.name}] {len(angebote)} OCR-Angebote geladen")
                return angebote
            except Exception as e:
                logger.error(f"[{self.name}] Fehler beim Laden OCR-Daten: {e}")
        return []


class RuemenapfScraper(BaseScraper):
    """Rümenapf: HTML-Table-Parsing mit Encoding-Fix"""
    
    def parse(self, html: str) -> List[Dict]:
        if not HAS_BS4:
            return []
        
        # Fix encoding issues in HTML
        html = html.replace('â€"', '—').replace('â€œ', '"').replace('â€', '"')
        html = html.replace('â‚¬', '€').replace('Ã¤', 'ä').replace('Ã¶', 'ö').replace('Ã¼', 'ü')
        html = html.replace('ÃŸ', 'ß').replace('Ã„', 'Ä').replace('Ã–', 'Ö').replace('Ãœ', 'Ü')
        
        soup = BeautifulSoup(html, 'html.parser')
        angebote = []
        
        # Suche nach Tabellen mit Angeboten
        for table in soup.find_all('table'):
            for row in table.find_all('tr'):
                tds = row.find_all('td')
                if len(tds) >= 2:
                    name = tds[0].get_text(strip=True)
                    preis = tds[1].get_text(strip=True) if len(tds) > 1 else ''
                    gewicht = tds[2].get_text(strip=True) if len(tds) > 2 else ''
                    if name and (preis or gewicht):
                        angebote.append({
                            'name': name,
                            'preis': preis,
                            'gewicht': gewicht,
                        })
        
        # Falls keine Tabelle mit Header, versuche alle Tabellen mit Klassen
        if not angebote:
            for table in soup.find_all('table', class_=re.compile(r'angebot|preis|product|table', re.I)):
                for row in table.find_all('tr'):
                    tds = row.find_all('td')
                    if len(tds) >= 2:
                        name = tds[0].get_text(strip=True)
                        preis = tds[1].get_text(strip=True) if len(tds) > 1 else ''
                        gewicht = tds[2].get_text(strip=True) if len(tds) > 2 else ''
                        if name and (preis or gewicht):
                            angebote.append({
                                'name': name,
                                'preis': preis,
                                'gewicht': gewicht,
                            })
        
        # Fallback: alle Tabellen
        if not angebote:
            for table in soup.find_all('table'):
                for row in table.find_all('tr'):
                    tds = row.find_all('td')
                    if len(tds) >= 2:
                        name = tds[0].get_text(strip=True)
                        preis = tds[1].get_text(strip=True) if len(tds) > 1 else ''
                        gewicht = tds[2].get_text(strip=True) if len(tds) > 2 else ''
                        if name and (preis or gewicht):
                            angebote.append({
                                'name': name,
                                'preis': preis,
                                'gewicht': gewicht,
                            })
        
        return angebote


class BrandlScraper(BaseScraper):
    """Brandl: PDF-Parsing"""
    
    def parse(self, html: str) -> List[Dict]:
        if not HAS_PDFPLUMBER:
            logger.warning(f"[{self.name}] pdfplumber nicht verfügbar")
            return []
        
        angebote = []
        pdf_base = self.config.get('pdf_base', '')
        
        # Finde PDF-Links
        pdf_pattern = r'href="(/uploads/media/[^"]*angebot[^"]*\.pdf)"'
        pdf_links = re.findall(pdf_pattern, html)
        
        seen = set()
        unique_links = []
        for link in pdf_links:
            if link not in seen:
                seen.add(link)
                unique_links.append(link)
        
        logger.info(f"[{self.name}] {len(unique_links)} PDF-Links gefunden")
        
        for link in unique_links[:5]:
            pdf_url = pdf_base + link
            try:
                resp = self.session.get(pdf_url, timeout=30)
                resp.raise_for_status()
                
                import io
                with pdfplumber.open(io.BytesIO(resp.content)) as pdf:
                    for page in pdf.pages:
                        text = page.extract_text()
                        if text:
                            lines = text.split('\n')
                            for line in lines:
                                price_matches = re.findall(r'(.+?)\s+(\d+[,.]\d{2}\s*€)', line)
                                for match in price_matches:
                                    angebote.append({
                                        'name': match[0].strip(),
                                        'preis': match[1].strip(),
                                    })
            except Exception as e:
                logger.warning(f"[{self.name}] Fehler bei PDF {pdf_url}: {e}")
        
        return angebote


class BrunnerScraper(BaseScraper):
    """Brunner: HTML-Parsing ohne Playwright (Fallback)"""
    
    def parse(self, html: str) -> List[Dict]:
        if not HAS_BS4:
            return []
        
        soup = BeautifulSoup(html, 'html.parser')
        angebote = []
        
        # Versuche verschiedene Selektoren für Wix-Seiten
        selectors = [
            '[data-hook="product-item"]',
            '.product-item',
            '.offer-item',
            '[class*="product"]',
            '[class*="offer"]',
            'table tr',
            '.comp-k00b8w8i',  # Wix-spezifisch
        ]
        
        for selector in selectors:
            elements = soup.select(selector)
            if elements:
                logger.info(f"[{self.name}] {len(elements)} Elemente mit '{selector}' gefunden")
                for el in elements[:20]:
                    text = el.get_text(strip=True)
                    if text and len(text) > 3:
                        price_match = re.search(r'(.+?)\s+(\d+[,.]\d{2}\s*€)', text)
                        if price_match:
                            angebote.append({
                                'name': price_match.group(1).strip(),
                                'preis': price_match.group(2).strip(),
                            })
                        else:
                            angebote.append({'name': text, 'preis': ''})
                break
        
        # Fallback: Suche nach Preisen im gesamten Text
        if not angebote:
            text = soup.get_text()
            price_matches = re.findall(r'([\w\s\-\(\)]+?)\s+(\d+[,.]\d{2}\s*€)', text)
            for match in price_matches[:20]:
                angebote.append({
                    'name': match[0].strip(),
                    'preis': match[1].strip(),
                })
        
        return angebote


class HahnScraper(BaseScraper):
    """Hahn: OCR für Flyer-Bilder"""
    
    def run(self) -> List[Dict]:
        flyer_dir = self.config.get('flyer_dir')
        if not flyer_dir or not flyer_dir.exists():
            logger.warning(f"[{self.name}] Kein Flyer-Verzeichnis: {flyer_dir}")
            return []
        
        angebote = []
        
        if not HAS_TESSERACT:
            logger.warning(f"[{self.name}] Tesseract nicht verfügbar")
            return angebote
        
        image_extensions = {'.jpg', '.jpeg', '.png', '.svg', '.webp'}
        for img_file in sorted(flyer_dir.iterdir()):
            if img_file.suffix.lower() in image_extensions:
                try:
                    img = Image.open(img_file)
                    text = pytesseract.image_to_string(img, lang='deu')
                    
                    lines = text.split('\n')
                    for line in lines:
                        price_match = re.search(r'(.+?)\s+(\d+[,.]\d{2}\s*€)', line)
                        if price_match:
                            angebote.append({
                                'name': price_match.group(1).strip(),
                                'preis': price_match.group(2).strip(),
                                'source_image': img_file.name,
                            })
                except Exception as e:
                    logger.warning(f"[{self.name}] OCR-Fehler bei {img_file}: {e}")
        
        return angebote


class TristlhofScraper(BaseScraper):
    """Tristlhof: Manuelle Daten"""
    
    def run(self) -> List[Dict]:
        manual = self.config.get('manual_data', {})
        angebote = manual.get('angebote', [])
        logger.info(f"[{self.name}] {len(angebote)} manuelle Angebote geladen")
        return angebote


# Scraper-Registry
SCRAPER_CLASSES = {
    'wasner': WasnerScraper,
    'ruemenapf': RuemenapfScraper,
    'brandl': BrandlScraper,
    'brunner': BrunnerScraper,
    'hahn': HahnScraper,
    'tristlhof': TristlhofScraper,
}


def load_all_json() -> Dict:
    if ALL_JSON.exists():
        with open(ALL_JSON, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    return {
        'scraped_at': datetime.now().isoformat(),
        'source': 'auto-scraper',
        'metzgereien': [
            {'id': k, 'name': v['name'], 'city': v['city'], 'url': v.get('url', ''), 'angebote': []}
            for k, v in METZGER_CONFIG.items()
        ],
    }


def save_all_json(data: Dict):
    data['scraped_at'] = datetime.now().isoformat()
    with open(ALL_JSON, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def week_key() -> str:
    today = datetime.now()
    monday = today - timedelta(days=today.weekday())
    friday = monday + timedelta(days=4)
    return monday.strftime('%d.%m.%Y') + ' - ' + friday.strftime('%d.%m.%Y')


def update_metzger(data: Dict, metzger_id: str, neue_angebote: List[Dict]) -> bool:
    for m in data['metzgereien']:
        if m['id'] == metzger_id:
            alte = m['angebote'][0]['produkte'] if m['angebote'] else []
            neue = [{'name': a.get('name', ''), 'preis': a.get('preis', '')} for a in neue_angebote]
            
            if str(alte) != str(neue):
                m['angebote'].insert(0, {
                    'typ': 'Wochenangebote',
                    'gueltig': week_key(),
                    'produkte': neue_angebote,
                    'scraped_at': datetime.now().isoformat(),
                })
                m['angebote'] = m['angebote'][:10]
                logger.info(f"[{metzger_id}] Aktualisiert: {len(neue)} Produkte")
                return True
            else:
                logger.info(f"[{metzger_id}] Keine Änderungen")
            break
    return False


def run_all_scrapers():
    logger.info("=" * 60)
    logger.info("STARTE UMFASSENDEN METZGER-SCRAPER")
    logger.info("=" * 60)
    
    data = load_all_json()
    updated_any = False
    
    for metzger_id, config in METZGER_CONFIG.items():
        logger.info(f"\n--- {config['name']} ---")
        
        scraper_class = SCRAPER_CLASSES.get(metzger_id)
        if not scraper_class:
            logger.warning(f"Kein Scraper für {metzger_id}")
            continue
        
        try:
            scraper = scraper_class(config)
            angebote = scraper.run()
            
            if angebote:
                if update_metzger(data, metzger_id, angebote):
                    updated_any = True
            else:
                logger.warning(f"[{config['name']}] Keine Angebote gefunden")
                
        except Exception as e:
            logger.error(f"[{config['name']}] Unerwarteter Fehler: {e}")
    
    if updated_any:
        save_all_json(data)
        logger.info("\n✅ all.json aktualisiert und gespeichert")
    else:
        logger.info("\n✓ Keine Änderungen notwendig")
    
    logger.info("=" * 60)
    logger.info("SCRAPER-LAUF BEENDET")
    logger.info("=" * 60)


if __name__ == '__main__':
    run_all_scrapers()
