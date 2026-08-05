#!/usr/bin/env python3
"""
MarktGuru.de Scraper - holt strukturierte Produktangebote via __NEXT_DATA__ JSON
Kein OCR nötig - reiner Text/JSON aus Next.js Server-Side Rendering
"""

import urllib.request
import urllib.parse
import json
import re
from typing import List, Dict, Optional
from datetime import datetime


HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'de-DE,de;q=0.9',
}


def fetch_marktguru_page(url: str) -> Optional[dict]:
    """Holt HTML und extrahiert __NEXT_DATA__ oder application/json Script"""
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        html = urllib.request.urlopen(req, timeout=30).read().decode('utf-8')
        
        # Erst versuchen: <script type="application/json"> (Brand-Seiten)
        match = re.search(r'<script type="application/json">(.*?)</script>', html, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        
        # Fallback: <script id="__NEXT_DATA__"> (Suchseiten)
        match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
        if match:
            return json.loads(match.group(1))
           
    except Exception as e:
        print(f"  ❌ Fehler beim Laden von {url}: {e}")
    return None


def build_brand_url(brand: str) -> str:
    """Baut eine gültige Brand-URL mit URL-Encoding"""
    # marktguru Brand-URLs nutzen kebab-case ohne Leerzeichen/Sonderzeichen
    encoded_brand = brand.lower().replace(' ', '-').replace("'", '').replace('&', '').replace('ü', 'ue').replace('ä', 'ae').replace('ö', 'oe').replace('ß', 'ss')
    return f'https://www.marktguru.de/b/{encoded_brand}'


def build_search_url(search_term: str) -> str:
    """Baut eine gültige Such-URL mit URL-Encoding"""
    encoded_term = urllib.parse.quote(search_term)
    return f'https://www.marktguru.de/angebote?q={encoded_term}'


def extract_offers_from_brand_page(data: dict) -> List[dict]:
    """Extrahiert Angebote von Brand-Seiten (z.B. /b/berchtesgadener-land)"""
    offers = []
    props = data.get('data', {}).get('offers', {}).get('results', [])
    
    for offer in props:
        try:
            offers.append({
                'name': offer['product']['name'],
                'price': offer['price'],
                'old_price': offer.get('oldPrice') if offer.get('oldPrice', 0) > 0 else None,
                'retailer': offer['retailer']['name'],
                'retailer_key': offer['retailer'].get('uniqueName', '').lower().replace(' ', '-'),
                'brand': offer['brand']['name'],
                'unit': offer['unit']['shortName'],
                'volume': offer['volume'],
                'valid_from': offer['validFrom'][:10],
                'valid_to': offer['validTo'][:10],
                'description': offer.get('description', ''),
                'source_url': f"https://www.marktguru.de/angebote?q={offer['product']['name']}",
                'source_note': 'marktguru.de (strukturierte Daten)',
            })
        except KeyError as e:
            print(f"  ⚠️ Ungültiges Angebot übersprungen: {e}")
            continue
    return offers


def extract_offers_from_search_page(data: dict) -> List[dict]:
    """Extrahiert Angebote von Suchseiten (z.B. /angebote?q=butter)"""
    offers = []
    props = data.get('props', {}).get('pageProps', {})
    
    for retailer_group in props.get('content', {}).get('offers', []):
        retailer_name = retailer_group['advertisers'][0]['name']
        retailer_key = retailer_group['advertisers'][0].get('uniqueName', '').lower()
        
        for offer in retailer_group['offers']:
            try:
                offers.append({
                    'name': offer['product']['name'],
                    'price': offer['price'],
                    'old_price': offer.get('oldPrice') if offer.get('oldPrice', 0) > 0 else None,
                    'retailer': retailer_name,
                    'retailer_key': retailer_key,
                    'brand': offer['brand']['name'],
                    'unit': offer['unit']['shortName'],
                    'volume': offer['volume'],
                    'valid_from': offer['validFrom'][:10],
                    'valid_to': offer['validTo'][:10],
                    'description': offer.get('description', ''),
                    'source_url': f"https://www.marktguru.de/angebote?q={offer['product']['name']}",
                    'source_note': 'marktguru.de (strukturierte Daten)',
                })
            except KeyError as e:
                continue
    return offers


# ============================================================
# PRODUKT-KONFIGURATION - nur diese Produkte werden gescrapt
# ============================================================
TARGET_PRODUCTS = {
    'berchtesgadener_milch': {
        'name': 'Berchtesgadener Milch',
        'brands': ['berchtesgadener-land'],
        'search_terms': ['berchtesgadener milch', 'berchtesgadener land milch'],
        'category': 'Milch & Milchprodukte',
    },
    'butter': {
        'name': 'Butter',
        'brands': ['berchtesgadener-land', 'landliebe', 'weihenstephan', 'mueller', 'baerenmarke', 'schwarzwaldmilch', 'ramseier', 'meggle', 'kerrygold'],
        'search_terms': ['butter', 'suessrahmbutter', 'saure rahmbutter', 'kraeuterbutter'],
        'category': 'Butter, Margarine & Streichfette',
    },
    'emmentaler': {
        'name': 'Emmentaler',
        'brands': ['berchtesgadener-land', 'bergader', 'alte-meister', 'hohenloher', 'gmundner', 'sennerei'],
        'search_terms': ['emmentaler', 'emmentaler kaese', 'emmental'],
        'category': 'Käse',
    },
    'almhammer': {
        'name': 'Almhammer / Almdammer',
        'brands': ['almhammer', 'almdammer', 'bergader', 'alte-meister'],
        'search_terms': ['almhammer', 'almdammer', 'almkaese', 'almer kaese'],
        'category': 'Käse',
    },
    'pekannuss': {
        'name': 'Pekannüsse',
        'brands': ['seeberger', 'kluth', 'american-heritage', 'zentis', 'rapunzel', 'dm-bio', 'alnatura'],
        'search_terms': ['pekannuss', 'pekannuesse', 'pecan', 'pecannuesse'],
        'category': 'Nüsse & Kerne',
    },
    'pistazien': {
        'name': 'Pistazien',
        'brands': ['seeberger', 'kluth', 'zentis', 'american-heritage', 'rapunzel', 'dm-bio', 'alnatura', 'pistachio'],
        'search_terms': ['pistazien', 'pistazie', 'pistachio', 'gruene pistazien'],
        'category': 'Nüsse & Kerne',
    },
    'nudeln': {
        'name': 'Nudeln / Pasta',
        'brands': ['barilla', 'birkel', 'de-cecco', 'rummo', 'garofalo', 'vitalis', 'ja', 'gut-guenstig', 'eigner', 'muellers-muehle', 'harta'],
        'search_terms': ['nudeln', 'pasta', 'spaghetti', 'penne', 'fusilli', 'farfalle', 'tagliatelle', 'rigatoni'],
        'category': 'Teigwaren & Reis',
    },
}


def scrape_marktguru_products(
    products: Optional[List[str]] = None,
    retailer_filter: Optional[str] = None
) -> List[dict]:
    """
    Scrapt die konfigurierten Produkte von marktguru.de
    
    Args:
        products: Liste der Produkt-Keys aus TARGET_PRODUCTS (None = alle)
        retailer_filter: Optional - nur bestimmter Händler (z.B. 'edeka', 'rewe', 'lidl')
    
    Returns:
        Liste von Angebots-Dicts
    """
    if products is None:
        products = list(TARGET_PRODUCTS.keys())
    
    all_offers = []
    
    for product_key in products:
        if product_key not in TARGET_PRODUCTS:
            print(f"  ⚠️ Unbekanntes Produkt: {product_key}")
            continue
            
        product_config = TARGET_PRODUCTS[product_key]
        product_name = product_config['name']
        brands = product_config['brands']
        search_terms = product_config['search_terms']
        
        print(f"\n📦 Produkt: {product_name}")
        
        # 1. Brand-Seiten prüfen
        for brand in brands:
            url = build_brand_url(brand)
            print(f"  🔍 Prüfe Marke: {brand}...")
            data = fetch_marktguru_page(url)
            if data:
                offers = extract_offers_from_brand_page(data)
                if retailer_filter:
                    offers = [o for o in offers if retailer_filter.lower() in o['retailer_key'].lower()]
                if offers:
                    all_offers.extend(offers)
                    print(f"    ✅ {len(offers)} Angebote von {brand}")
        
        # 2. Suchseiten für Suchbegriffe
        for search_term in search_terms:
            print(f"  🔍 Suche nach '{search_term}'...")
            search_url = build_search_url(search_term)
            data = fetch_marktguru_page(search_url)
            if data:
                offers = extract_offers_from_search_page(data)
                if retailer_filter:
                    offers = [o for o in offers if retailer_filter.lower() in o['retailer_key'].lower()]
                if offers:
                    all_offers.extend(offers)
                    print(f"    ✅ {len(offers)} Angebote aus Suche '{search_term}'")
    
    # Duplikate entfernen (basierend auf name+retailer+valid_to)
    seen = set()
    unique_offers = []
    for offer in all_offers:
        key = f"{offer['name']}|{offer['retailer']}|{offer['valid_to']}"
        if key not in seen:
            seen.add(key)
            unique_offers.append(offer)
    
    print(f"\n📦 Gesamt: {len(unique_offers)} eindeutige Angebote")
    return unique_offers


def scrape_marktguru_butter(retailer_filter: Optional[str] = None) -> List[dict]:
    """
    Rückwärtskompatibel: Scrapt nur Butter-Angebote
    """
    return scrape_marktguru_products(['butter'], retailer_filter)


def convert_to_manual_format(offers: List[dict]) -> List[dict]:
    """Konvertiert marktguru-Angebote in das Format von lebensmittel-manual.json"""
    manual_offers = []
    for offer in offers:
        # Kategorie basierend auf Produktname/Marken ableiten
        category = 'Sonstiges'
        name_lower = offer['name'].lower()
        brand_lower = offer['brand'].lower()
        
        # Milch & Milchprodukte
        if any(kw in name_lower or kw in brand_lower for kw in ['milch', 'berchtesgadener', 'joghurt', 'skyr', 'topfen', 'buttermilch', 'kaffee-milch', 'kakao', 'eiskaffee', 'speisequark', 'fettarme milch', 'vollmilch', 'weidemilch', 'lactosefrei', 'reis-milch', 'milch reis']):
            category = 'Milch & Milchprodukte'
        # Butter, Margarine & Streichfette
        elif any(kw in name_lower or kw in brand_lower for kw in ['butter', 'streichfett', 'margarine', 'landliebe', 'weihenstephan', 'baerenmarke', 'kerrygold', 'meggle', 'tortenbutter', 'kr\u00e4uterbutter', 'streichzart', 'baguette', 'irische butter', 'irischer', 'schlagsahne', 'koch sahne', 'rahmjoghurt']):
            category = 'Butter, Margarine & Streichfette'
        # Käse
        elif any(kw in name_lower or kw in brand_lower for kw in ['emmentaler', 'almhammer', 'almdammer', 'almzeit', 'kaese', 'k\u00e4se', 'bergader', 'alte meister', 'bonifaz', 'bergbauern k\u00e4se', 'bavaria blu', 'pizzak\u00e4se', 'reibek\u00e4se', 'schnittk\u00e4se', 'original irischer k\u00e4se', 'original irischer cheddar', 'tilsiter', 'ziegenweichk\u00e4se', 'bio k\u00e4sescheiben', 'landk\u00e4se']):
            category = 'Käse'
        # Nüsse & Kerne
        elif any(kw in name_lower or kw in brand_lower for kw in ['pekannuss', 'pecan', 'pistazien', 'pistazie', 'pistachio', 'nuss', 'n\u00fcss', 'seeberger', 'kluth', 'zentis', 'studentenfutter', 'vital-kerne', 'mangostreifen', 'erdbeeren', 'popcorn', 'mango', 'pinienkerne', 'cashew', 'cashewkerne', 'nuss-mix', 'cashew-cranberry', 'macadamias', 'salatveredler', 'feigen', 'aachener', 'fr\u00fchst\u00fccks', 'konfit\u00fcre', 'aufstrich', 'sesamini', 'mandelmus', 'kokosmilch', 'wildheidelbeeren', 'hummus', 'tofu', 'streichcreme', 'tomatenst\u00fccke', 'gem\u00fcsekonserven', 'linsen', 'basmati', 'fr\u00fchlingsrollen', 'dinkel', 'gr\u00fcnkern', 'brot']):
            category = 'Nüsse & Kerne'
        # Teigwaren & Reis
        elif any(kw in name_lower or kw in brand_lower for kw in ['nudeln', 'pasta', 'spaghetti', 'penne', 'fusilli', 'farfalle', 'tagliatelle', 'rigatoni', 'barilla', 'birkel', 'de cecco', 'de-cecco', 'rummo', 'garofalo', 'vitalis', 'eigner', 'muellers', 'harta', 'teigwaren', 'pesto', 'nudel', 'hartweizen', 'eiernudeln', 'frischei', 'lasagne', 'pizzateig', 'kn\u00e4ckebrot']):
            category = 'Teigwaren & Reis'
        
        manual_offers.append({
            'name': offer['name'],
            'category': category,
            'price': offer['price'],
            'currency': 'EUR',
            'retailer': offer['retailer'],
            'retailer_key': offer['retailer_key'],
            'retailer_category': 'Supermarkt' if offer['retailer_key'] in ['edeka', 'rewe', 'kaufland', 'edeka-frischemarkt', 'edeka-foodservice', 'edeka-center', 'nahkauf', 'marktkauf', 'combi', 'hiebers-frische-center', 'scheck-in-center', 'aez', 'handelshof', 'edeka center', 'e center', 'rewe center', 'rewe petz', 'famila-nordwest', 'budni', 'rossmann', 'netto marken-discount', 'penny', 'lidl', 'aldi s\u00fcd', 'aldi nord', 'norma'] else 'Discounter',
            'valid_from': offer['valid_from'] + 'T00:00:00',
            'valid_to': offer['valid_to'] + 'T23:59:59',
            'description': offer['description'] or f"{offer['brand']} - {offer['volume']}{offer['unit']}",
            'source_url': offer['source_url'],
            'source_note': offer['source_note'],
            'manual': False,  # Kennzeichnung: automatisiert von marktguru
        })
    return manual_offers


if __name__ == '__main__':
    import sys
    
    # CLI-Argumente: [retailer_filter] [product1,product2,...]
    retailer = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else None
    products = None
    
    if len(sys.argv) > 2:
        # Produkte als kommaseparierte Liste
        products = sys.argv[2].split(',')
    elif len(sys.argv) > 1 and sys.argv[1].startswith('--products='):
        products = sys.argv[1].split('=')[1].split(',')
    
    if retailer:
        print(f"🎯 Filter: Nur {retailer}")
    if products:
        print(f"🎯 Produkte: {', '.join(products)}")
    
    offers = scrape_marktguru_products(products, retailer)
    manual_offers = convert_to_manual_format(offers)
    
    print(f"\n📋 {len(manual_offers)} Angebote für manual.json:")
    for o in manual_offers:
        print(f"  • {o['name']} - €{o['price']:.2f} - {o['retailer']} - bis {o['valid_to'][:10]} - [{o['category']}]")