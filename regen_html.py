#!/usr/bin/env python3
"""
Regeneriert metzger-angebote.html aus data/metzger/all.json
Mit PWA-Support (Manifest + Service Worker)
"""

import json
from datetime import datetime, timedelta
from pathlib import Path

ALL_JSON = Path("/root/bayerische-kartenspiele/data/metzger/all.json")
HTML_FILE = Path("/root/bayerische-kartenspiele/metzger-angebote.html")


def load_data():
    with open(ALL_JSON, "r", encoding="utf-8") as f:
        return json.load(f)


def week_key():
    today = datetime.now()
    monday = today - timedelta(days=today.weekday())
    friday = monday + timedelta(days=4)
    return monday.strftime('%d.%m.%Y') + ' - ' + friday.strftime('%d.%m.%Y')


def week_key_next():
    today = datetime.now()
    monday = today - timedelta(days=today.weekday()) + timedelta(weeks=1)
    friday = monday + timedelta(days=4)
    return monday.strftime('%d.%m.%Y') + ' - ' + friday.strftime('%d.%m.%Y')


def build_week_overview(data):
    """Baut die Wochen-Übersicht mit allen Produkten aller Metzger"""
    metzger_data = {}
    for m in data.get("metzgereien", []):
        name = m.get("name", "Unknown")
        city = m.get("city", "")
        offers = []
        for a in m.get("angebote", []):
            if isinstance(a, dict):
                for p in a.get("produkte", []):
                    if isinstance(p, dict):
                        prod_name = p.get("name", "")
                        price = p.get("preis", "")
                        if prod_name and price and price.strip() and price.lower() != "k.a.":
                            offers.append({"name": prod_name, "price": price, "desc": ""})
        seen = set()
        unique_offers = []
        for o in offers:
            key = o["name"].lower().strip()
            if key not in seen:
                seen.add(key)
                unique_offers.append(o)
        if unique_offers:
            m_data = {"city": m.get("city", ""), "offers": unique_offers}
            metzger_data[name] = m_data
    return metzger_data


def build_uebersicht_rows(metzger_data):
    """Baut die Zeilen für die Wochen-Übersicht-Tabelle"""
    all_products = {}
    for metzger_name, data in metzger_data.items():
        for offer in data["offers"]:
            name = offer["name"]
            price = offer["price"]
            if price and price.strip() and price.lower() != "k.a.":
                if name not in all_products:
                    all_products[name] = (metzger_name, price)
    
    sorted_products = sorted(all_products.items(), key=lambda x: x[0].lower())
    wo_rows = []
    for name, (metzger, price) in sorted_products:
        wo_rows.append(
            '<tr>'
            f'<td class="uebersicht-produkt" data-label="Produkt">'
            f'<div class="uebersicht-produkt-name">{name} - <span class="uebersicht-preis">{price}</span></div>'
            f'<div class="uebersicht-metzger-small">{metzger}</div>'
            f'</td>'
            '</tr>'
        )
    return "".join(wo_rows)


def build_metzger_cards(data):
    """Baut die einzelnen Metzger-Karten"""
    correct_order = ["Metzgerei Wasner", "Metzgerei Brandl", "Brunner Metzgerei", "Metzgerei Rümenapf", "Metzgerei Tristlhof"]
    cards = []
    
    for name in correct_order:
        # Finde Metzger in Daten
        metzger_entry = None
        for m in data.get("metzgereien", []):
            if m.get("name") == name:
                metzger_entry = m
                break
        if not metzger_entry:
            continue
            
        city = metzger_entry.get("city", "")
        angebote_list = metzger_entry.get("angebote", [])
        
        # Sammle alle Produkte aus allen Wochen
        all_offers = []
        for woche in angebote_list:
            if isinstance(woche, dict):
                for p in woche.get("produkte", []):
                    if isinstance(p, dict):
                        prod_name = p.get("name", "")
                        price = p.get("preis", "")
                        if prod_name:
                            all_offers.append({"name": prod_name, "price": price})
        
        # Duplikate entfernen
        seen = set()
        unique_offers = []
        for o in all_offers:
            key = o["name"].lower().strip()
            if key not in seen:
                seen.add(key)
                unique_offers.append(o)
        
        if not unique_offers:
            continue  # Skip butchers with no offers
        
        lines = []
        for o in unique_offers:
            if o["price"] and o["price"].strip() and o["price"].lower() != "k.a.":
                lines.append(
                    '<div class="angebot">'
                    f'<div class="angebot-header"><span class="angebot-name">{o["name"]}</span>'
                    f'<span class="angebot-preis">{o["price"]}</span></div>'
                    '</div>'
                )
            else:
                lines.append(
                    '<div class="angebot">'
                    f'<div class="angebot-header"><span class="angebot-name">{o["name"]}</span></div>'
                    '</div>'
                )
        
        content = "\n".join(lines)
        
        # Spezielle Behandlung für Tristlhof mit Kontakt-Info
        if name == "Metzgerei Tristlhof":
            card = (
                '<div class="metzger-card">'
                '<div class="metzger-name">Metzgerei Tristlhof</div>'
                '<div class="city">Landshut</div>'
                '<p><strong>Kontakt:</strong></p>'
                '<p>Tel: 0871/97407272, 0152/53753881<br>Email: service.gustav.weber@gmx.de</p>'
                '<p><strong>Filialen & Öffnungszeiten:</strong></p>'
                '<p>Frontenhausen, Vilsbiburger Str. 22, Tel.: 08732/2886</p>'
                '<p>Landshut Theaterstr., Theaterstr. 67, Tel.: 0871/2768764</p>'
                '<p>Landshut Straubinger Str., Straubinger Str. 10, Tel.: 0871/96699952</p>'
                '<p>Mobil Hofladen: Montag, Freitag & Samstag, Tristl am Damm 1, Tel.: 08706/270</p>'
                '<p>Donnerstag: Landshuter Str. 67 b, Ergolding bei Getränke Fleischmann</p>'
                '<hr>'
                f'<div class="week-section" style="border-left: 5px solid #ff9800;">'
                f'<div class="week-header" style="background: #ff9800;">Woche vom {week_key()}</div>'
                f'<div class="week-content" style="background: #fff3e0;">{content}</div>'
                f'</div>'
                '</div>'
            )
        else:
            card = (
                f'<div class="metzger-card">'
                f'<div class="metzger-name">{name}</div>'
                f'<div class="city">{city}</div>'
                f'<div class="week-section" style="border-left: 5px solid #ff9800;">'
                f'<div class="week-header" style="background: #ff9800;">Woche vom {week_key()}</div>'
                f'<div class="week-content" style="background: #fff3e0;">{content}</div>'
                f'</div>'
                '</div>'
            )
        cards.append(card)
    
    return "\n".join(cards)


def generate_html(data):
    """Generiert das vollständige HTML mit PWA-Support"""
    metzger_data = build_week_overview(data)
    uebersicht_rows = build_uebersicht_rows(metzger_data)
    metzger_cards = build_metzger_cards(data)
    timestamp = datetime.now().strftime('%d.%m.%Y %H:%M')
    
    html = f'''<!DOCTYPE html>
<html lang="de">
<head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>Metzger-Angebote Bayern | Bavarian Card Games</title>
 <link rel="manifest" href="metzger-manifest.json">
 <meta name="theme-color" content="#8b4513">
 <meta name="apple-mobile-web-app-capable" content="yes">
 <meta name="apple-mobile-web-app-status-bar-style" content="default">
 <meta name="apple-mobile-web-app-title" content="Metzger-Angebote">
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
.uebersicht-produkt-name {{ display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }}
.uebersicht-metzger-small {{ font-size: 0.75em; color: #666; margin-top: 2px; }}
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
 .uebersicht-produkt-name {{ flex-direction: column; align-items: flex-end; }}
 .uebersicht-metzger-small {{ text-align: right; }}
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
</script>

<div class="wochen-uebersicht">
 <h2>📋 Wochen-Übersicht</h2>
 <div class="wochen-tabelle">
 <h3 class="wochen-header">Woche {week_key()}</h3>
 <table class="uebersicht-table">
 <tbody>
{uebersicht_rows}
 </tbody>
 </table>
 </div>
</div>

<div id="angebote-inhalt">
{metzger_cards}
</div>

<div class="last-update">
 Letzte Aktualisierung: {timestamp}
</div>

<script>
// Service Worker Registration für PWA
if ('serviceWorker' in navigator) {{
  window.addEventListener('load', function() {{
    navigator.serviceWorker.register('sw-metzger.js')
      .then(function(registration) {{
        console.log('Service Worker registriert:', registration.scope);
      }})
      .catch(function(error) {{
        console.log('Service Worker Registrierung fehlgeschlagen:', error);
      }});
  }});
}}
</script>
</body>
</html>'''
    
    return html


def main():
    print("Lade Daten...")
    data = load_data()
    
    print("Generiere HTML...")
    html = generate_html(data)
    
    print(f"Schreibe {HTML_FILE}...")
    with open(HTML_FILE, "w", encoding="utf-8") as f:
        f.write(html)
    
    print("✅ Fertig!")


if __name__ == '__main__':
    main()