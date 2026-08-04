#!/usr/bin/env python3
"""
Weekli.de Scraper für Grundnahrungsmittel (Milch, Butter, Käse, etc.)
Extrahiert Angebote von EDEKA, REWE, Lidl, Aldi, Penny, Kaufland, Norma
"""

import requests
import json
import re
import os
from datetime import datetime
from pathlib import Path

# Konfiguration
SUPERMARKETS = {
    'edeka': {'name': 'EDEKA', 'url': 'https://www.weekli.de/supermaerkte/edeka/alle-angebote', 'category': 'Supermarkt'},
    'rewe': {'name': 'REWE', 'url': 'https://www.weekli.de/supermaerkte/rewe/alle-angebote', 'category': 'Supermarkt'},
    'lidl': {'name': 'Lidl', 'url': 'https://www.weekli.de/discounter/lidl/alle-angebote', 'category': 'Discounter'},
    'aldi-sued': {'name': 'ALDI SÜD', 'url': 'https://www.weekli.de/discounter/aldi-sued/alle-angebote', 'category': 'Discounter'},
    'aldi-nord': {'name': 'ALDI Nord', 'url': 'https://www.weekli.de/discounter/aldi-nord/alle-angebote', 'category': 'Discounter'},
    'penny': {'name': 'PENNY', 'url': 'https://www.weekli.de/discounter/penny/alle-angebote', 'category': 'Discounter'},
    'kaufland': {'name': 'Kaufland', 'url': 'https://www.weekli.de/supermaerkte/kaufland/alle-angebote', 'category': 'Supermarkt'},
    'norma': {'name': 'NORMA', 'url': 'https://www.weekli.de/discounter/norma/alle-angebote', 'category': 'Discounter'},
}

# Suchbegriffe für Grundnahrungsmittel
KEYWORDS = {
    'Milch & Milchprodukte': ['milch', 'vollmilch', 'teilentrahmt', 'fettarm', 'h-milch', 'haltbar'],
    'Butter, Margarine & Streichfette': ['butter', 'margarine', 'streichfett', 'pflanzenfett', 'butterschmalz'],
    'Käse & Quark': ['käse', 'quark', 'topfen', 'frischkäse', 'schnittkäse', 'hartkäse', 'weichkäse', 'mozzarella', 'gouda', 'emmentaler'],
    'Joghurt, Quark & Desserts': ['joghurt', 'skyr', 'grießbrei', 'pudding', 'dessert', 'quarkspeise'],
    'Eier': ['ei', 'eier', 'freilandei', 'bodenei', 'bio-ei'],
    'Brot & Backwaren': ['brot', 'brötchen', 'toast', 'vollkornbrot', 'roggenbrot', 'dinkelbrot'],
    'Fleisch & Wurst (Supermarkt)': ['fleisch', 'wurst', 'aufschnitt', 'schinken', 'salami', 'bratwurst', 'leberkäse'],
    'Obst & Gemüse': ['apfel', 'banane', 'tomate', 'gurke', 'kartoffel', 'zwiebel', 'karotte', 'salat', 'paprika'],
    'Getränke': ['wasser', 'saft', 'limonade', 'cola', 'bier', 'wein', 'schorle'],
    'Vorrat & Trockenprodukte': ['mehl', 'zucker', 'reis', 'nudeln', 'öl', 'essig', 'salz', 'gewürz', 'konserve'],
}

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'de-DE,de;q=0.9',
}

OUTPUT_DIR = Path('/root/bayerische-kartenspiele/data')
OUTPUT_DIR.mkdir(exist_ok=True)

OUTPUT_FILE = OUTPUT_DIR / 'lebensmittel-angebote.json'
MANUAL_FILE = OUTPUT_DIR / 'lebensmittel-manual.json'


def extract_json_ld(html):
    """Extrahiert JSON-LD aus HTML"""
    pattern = r'<script type="application/ld\+json">(.*?)</script>'
    matches = re.findall(pattern, html, re.DOTALL)
    for match in matches:
        try:
            data = json.loads(match.strip())
            return data
        except json.JSONDecodeError:
            continue
    return None


def categorize_product(name):
    """Kategorisiert Produkt basierend auf Namen"""
    name_lower = name.lower()
    for category, keywords in KEYWORDS.items():
        for kw in keywords:
            if kw in name_lower:
                return category
    return 'Sonstiges'


def parse_weekli_offers(html, market_key, market_info):
    """Parst Angebote von einer Weekli-Seite"""
    data = extract_json_ld(html)
    if not data:
        print(f"  ⚠️ Kein JSON-LD gefunden für {market_info['name']}")
        return []

    offers = []
    
    # JSON-LD Structure durchsuchen
    def find_offers(obj):
        if isinstance(obj, dict):
            if obj.get('@type') == 'ItemList' and 'itemListElement' in obj:
                for element in obj['itemListElement']:
                    item = element.get('item', {})
                    if item.get('@type') in ['Product', 'CreativeWork']:
                        name = item.get('name', '')
                        if not name:
                            continue
                        
                        # Preis extrahieren
                        price = None
                        old_price = None
                        offers_data = item.get('offers', {})
                        if isinstance(offers_data, dict):
                            price = offers_data.get('price')
                            old_price = offers_data.get('priceValidUntil')  # manchmal hier
                        elif isinstance(offers_data, list) and offers_data:
                            price = offers_data[0].get('price')
                        
                        # Gültigkeit
                        valid_from = None
                        valid_to = None
                        if isinstance(offers_data, dict):
                            valid_from = offers_data.get('validFrom')
                            valid_to = offers_data.get('validThrough')
                        
                        # Bild
                        image = item.get('image', '')
                        if isinstance(image, list):
                            image = image[0] if image else ''
                        
                        # Händler
                        retailer = market_info['name']
                        publisher = item.get('publisher', {})
                        if isinstance(publisher, dict):
                            retailer = publisher.get('name', retailer)
                        
                        # URL
                        url = item.get('url', '')
                        
                        offers.append({
                            'id': f"{market_key}_{len(offers)}",
                            'name': name,
                            'category': categorize_product(name),
                            'price': price,
                            'old_price': old_price,
                            'currency': 'EUR',
                            'retailer': retailer,
                            'retailer_key': market_key,
                            'retailer_category': market_info['category'],
                            'valid_from': valid_from,
                            'valid_to': valid_to,
                            'image': image,
                            'url': url,
                            'scraped_at': datetime.now().isoformat(),
                        })
            
            # Rekursiv weiter suchen
            for v in obj.values():
                find_offers(v)
        elif isinstance(obj, list):
            for item in obj:
                find_offers(item)
    
    find_offers(data)
    return offers


def scrape_market(market_key, market_info):
    """Scraped einen einzelnen Markt"""
    print(f"🔍 Scrape {market_info['name']}...")
    try:
        resp = requests.get(market_info['url'], headers=HEADERS, timeout=30)
        resp.raise_for_status()
        offers = parse_weekli_offers(resp.text, market_key, market_info)
        print(f"  ✅ {len(offers)} Angebote gefunden")
        return offers
    except Exception as e:
        print(f"  ❌ Fehler bei {market_info['name']}: {e}")
        return []


def load_manual_offers():
    """Lädt manuelle Zusatz-Angebote"""
    if MANUAL_FILE.exists():
        with open(MANUAL_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []


def save_offers(all_offers):
    """Speichert alle Angebote"""
    # Nach Kategorien gruppieren
    by_category = {}
    for offer in all_offers:
        cat = offer['category']
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(offer)
    
    # Nach Wochen gruppieren (gültig ab Datum)
    by_week = {}
    for offer in all_offers:
        week_key = 'Unbekannt'
        if offer['valid_from']:
            try:
                dt = datetime.fromisoformat(offer['valid_from'].replace('Z', '+00:00'))
                week_key = f"Woche {dt.strftime('%V')} ({dt.strftime('%d.%m.')}-{(dt.replace(day=dt.day+6)).strftime('%d.%m.%Y')})"
            except:
                pass
        if week_key not in by_week:
            by_week[week_key] = []
        by_week[week_key].append(offer)
    
    output = {
        'meta': {
            'scraped_at': datetime.now().isoformat(),
            'total_offers': len(all_offers),
            'categories': list(by_category.keys()),
            'retailers': list(set(o['retailer'] for o in all_offers)),
        },
        'by_category': by_category,
        'by_week': by_week,
        'all_offers': all_offers,
    }
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n💾 Gespeichert: {OUTPUT_FILE}")
    print(f"   Kategorien: {len(by_category)}")
    print(f"   Wochen: {len(by_week)}")
    print(f"   Gesamt: {len(all_offers)} Angebote")


def main():
    print("🚀 Starte Weekli.de Scraper für Grundnahrungsmittel")
    print("=" * 60)
    
    all_offers = []
    
    # Alle Märkte scrapen
    for market_key, market_info in SUPERMARKETS.items():
        offers = scrape_market(market_key, market_info)
        all_offers.extend(offers)
    
    # Manuelle Angebote hinzufügen
    manual_offers = load_manual_offers()
    if manual_offers:
        print(f"\n📝 Füge {len(manual_offers)} manuelle Angebote hinzu...")
        all_offers.extend(manual_offers)
    
    # Speichern
    save_offers(all_offers)
    
    print("\n✅ Fertig!")


if __name__ == '__main__':
    main()