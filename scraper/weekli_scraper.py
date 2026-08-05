#!/usr/bin/env python3
"""
Weekli.de Scraper - holt nur Prospekt-URLs als Referenz
Strukturierte Produktdaten kommen aus manual.json + marktguru.de (Supermärkte)
"""

import requests
import json
import re
import os
import sys
from datetime import datetime
from pathlib import Path

# Pfad für marktguru_scraper import
sys.path.insert(0, str(Path(__file__).parent))

# Supermärkte mit ihren Weekli-URLs für Prospekt-Links
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

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'de-DE,de;q=0.9',
}

OUTPUT_DIR = Path('/root/bayerische-kartenspiele/data')
OUTPUT_DIR.mkdir(exist_ok=True)

OUTPUT_FILE = OUTPUT_DIR / 'lebensmittel-angebote.json'
MANUAL_FILE = OUTPUT_DIR / 'lebensmittel-manual.json'


def get_prospekt_urls(html, market_key, market_info):
    """Extrahiert Prospekt-URLs aus der Übersichtsseite"""
    prospekts = []
    
    # Finde alle Prospekt-Links
    prospekt_urls = re.findall(r'href="(/prospekt/[^"]+)"', html)
    
    seen = set()
    for url in prospekt_urls:
        full_url = f"https://www.weekli.de{url}"
        if full_url not in seen:
            seen.add(full_url)
            # Extrahiere Titel aus URL oder alt-Text
            title_match = re.search(r'c\d+-d(\d+)', url)
            prospekt_id = title_match.group(1) if title_match else 'unknown'
            
            prospekts.append({
                'id': f"{market_key}_{prospekt_id}",
                'title': f"Prospekt {prospekt_id}",
                'url': full_url,
                'retailer': market_info['name'],
                'retailer_key': market_key,
                'retailer_category': market_info['category'],
                'scraped_at': datetime.now().isoformat(),
            })
    
    return prospekts


def scrape_market(market_key, market_info):
    """Holt Prospekt-URLs für einen Markt"""
    print(f"🔍 Hole Prospekte für {market_info['name']}...")
    try:
        resp = requests.get(market_info['url'], headers={'User-Agent': HEADERS['User-Agent']}, timeout=30)
        resp.raise_for_status()
        prospekts = get_prospekt_urls(resp.text, market_key, market_info)
        print(f"  ✅ {len(prospekts)} Prospekte gefunden")
        return prospekts
    except Exception as e:
        print(f"  ❌ Fehler bei {market_info['name']}: {e}")
        return []


def load_manual_offers():
    """Lädt manuelle Produkt-Angebote"""
    if MANUAL_FILE.exists():
        with open(MANUAL_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []


def load_marktguru_offers():
    """Lädt marktguru-Angebote (automatisch gescrapt)"""
    try:
        from marktguru_scraper import scrape_marktguru_products, convert_to_manual_format
        print("🔍 Lade marktguru Produkt-Angebote (alle konfigurierten Produkte)...")
        offers = scrape_marktguru_products()
        manual_offers = convert_to_manual_format(offers)
        print(f"  ✅ {len(manual_offers)} marktguru-Angebote geladen")
        return manual_offers
    except Exception as e:
        print(f"  ❌ Fehler beim Laden von marktguru: {e}")
        return []


def save_data(all_prospekts, all_offers):
    """Speichert Prospekte und manuelle Angebote"""
    
    # Angebote nach Kategorien gruppieren
    by_category = {}
    for offer in all_offers:
        cat = offer['category']
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(offer)
    
    # Nach Wochen gruppieren
    by_week = {}
    for offer in all_offers:
        week_key = 'Aktuelle Woche'
        if offer.get('valid_from'):
            try:
                dt = datetime.fromisoformat(offer['valid_from'].replace('Z', '+00:00'))
                week_key = f"Woche {dt.strftime('%V')} ({dt.strftime('%d.%m.')}-{(dt.replace(day=min(dt.day+6,28))).strftime('%d.%m.%Y')})"
            except:
                pass
        
        if week_key not in by_week:
            by_week[week_key] = []
        by_week[week_key].append(offer)
    
    output = {
        'meta': {
            'scraped_at': datetime.now().isoformat(),
            'total_prospekts': len(all_prospekts),
            'total_offers': len(all_offers),
            'categories': sorted(list(by_category.keys())),
            'retailers': sorted(list(set(o['retailer'] for o in all_offers))),
        },
        'prospekts': all_prospekts,
        'by_category': by_category,
        'by_week': by_week,
        'offers': all_offers,
    }
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n💾 Gespeichert: {OUTPUT_FILE}")
    print(f"   Prospekte: {len(all_prospekts)}")
    print(f"   Angebote: {len(all_offers)}")


def main():
    print("🚀 Starte Weekli.de Prospekt-Scraper + marktguru.de Produkt-Scraper")
    print("=" * 60)
    
    all_prospekts = []
    
    for market_key, market_info in SUPERMARKETS.items():
        prospekts = scrape_market(market_key, market_info)
        all_prospekts.extend(prospekts)
    
    # Manuelle Produkt-Angebote laden (Supermarkt-Produkte mit Preisen)
    manual_offers = load_manual_offers()
    print(f"\n📝 Lade {len(manual_offers)} manuelle Produkt-Angebote...")
    
    # marktguru-Angebote laden (automatisch gescrapt)
    marktguru_offers = load_marktguru_offers()
    
    # Zusammenführen (marktguru ergänzt manuell, manuell hat Vorrang bei Duplikaten)
    all_offers = manual_offers + marktguru_offers
    
    # Speichern
    save_data(all_prospekts, all_offers)
    print("\n✅ Fertig!")


if __name__ == '__main__':
    main()