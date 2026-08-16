#!/usr/bin/env python3
import json
from datetime import datetime
from pathlib import Path

ALL_JSON = Path("/root/bayerische-kartenspiele/data/metzger/all.json")
HTML_FILE = Path("/root/bayerische-kartenspiele/metzger-angebote.html")

def load_data():
    with open(ALL_JSON, "r", encoding="utf-8") as f:
        return json.load(f)

def build_week_overview(data):
    metzger_data = {}
    for m in data.get("metzgereien", []):
        name = m.get("name", "Unknown")
        city = m.get("city", "")
        offers = []
        for a in m.get("angebote", []):
            if isinstance(a, dict):
                for p in a.get("produkte", []):
                    if isinstance(p, dict):
                        name = p.get("name", "")
                        price = p.get("preis", "")
                        if name:
                            offers.append({"name": name, "price": price, "desc": ""})
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

def build_wo(metzger_data):
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
    for name, (metzger, price) in sorted(all_products.items(), key=lambda x: x[0].lower()):
        wo_rows.append("<tr><td class="uebersicht-produkt" data-label="Produkt"><div class="uebersicht-produkt-name">" + name + " - <span class="uebersicht-preis">" + price + "</span></div><div class="uebersicht-metzger-small">" + metzger + "</div></td></tr>")
    return "<div class="wochen-uebersicht"><h2>Wochen-Uebersicht (17.08.2026 - 22.08.2026)</h2><table class="uebersicht-table"><tbody>" + "".join(wo_rows) + "</tbody></table></div>"

def build_cards(metzger_data):
    correct_order = ["Metzgerei Wasner", "Metzgerei Brandl", "Brunner Metzgerei", "Metzgerei R\u00fcmenapf", "Metzgerei Hahn", "Metzgerei Tristlhof"]
    cards = []
    for name in correct_order:
        if name not in metzger_data:
            continue
        data = metzger_data[name]
        city = data.get("city", "")
        offers = data["offers"]
        lines = []
        for o in offers:
            if o["price"]:
                lines.append("<div class="angebot"><div class="angebot-header"><span class="angebot-name">" + o["name"] + "</span><span class="angebot-preis">" + o["price"] + "</span></div></div>")
            else:
                lines.append("<div class="angebot"><div class="angebot-header"><span class="angebot-name">" + o["name"] + "</span></div></div>")
        content = "
".join(lines)
        if name == "Metzgerei Tristlhof":
            card = "<div class="metzger-card"><div class="metzger-name">Metzgerei Tristlhof</div><div class="city">Landshut</div><p><strong>Kontakt:</strong></p><p>Tel: 0871/97407272, 0152/53753881<br>Email: service.gustav.weber@gmx.de</p><p><strong>Filialen & Oeffnungszeiten:</strong></p><p>Frontenhausen, Vilsbiburger Str. 22, Tel.: 08732/2886</p><p>Landshut Theaterstr., Theaterstr. 67, Tel.: 0871/2768764</p><p>Landshut Straubinger Str., Straubinger Str. 10, Tel.: 0871/96699952</p><p>Mobil Hofladen: Montag, Freitag & Samstag, Tristl am Damm 1, Tel.: 08706/270</p><p>Donnerstag: Landshuter Str. 67 b, Ergolding bei Getraenke Fleischmann</p><hr><div class="week-section" style="border-left: 5px solid #ff9800;"><div class="week-header" style="background: #ff9800;">Woche vom 17.08.2026 - 22.08.2026</div><div class="week-content" style="background: #fff3e0;">" + "
".join(["<div class="angebot"><div class="angebot-header"><span class="angebot-name">" + o["name"] + "</span></div></div>" if not o["price"] else "<div class="angebot"><div class="angebot-header"><span class="angebot-name">" + o["name"] + "</span><span class="angebot-preis">" + o["price"] + "</span></div></div>" for o in [{"name": "Krustenbraten", "price": "", "desc": ""}, {"name": "Milzwurst pikant", "price": "", "desc": ""}, {"name": "Kochsalami pikant im Geschmack", "price": "1,29 €", "desc": ""}, {"name": "Weisswuerste frisch aus der Wurstkueche", "price": "1,29 €", "desc": ""}, {"name": "Hackfleischtag (Montag)", "price": "500 g 4,98 €", "desc": ""}, {"name": "Haxentag (Samstag)", "price": "100 g 0,79 €", "desc": ""}]) + "</div></div></div></div></div>"
        else:
            offers = metzger_data[name]["offers"]
            lines = []
            for o in data["offers"]:
                if o["price"]:
                    lines.append("<div class="angebot"><div class="angebot-header"><span class="angebot-name">" + o["name"] + "</span><span class="angebot-preis">" + o["price"] + "</span></div></div>")
                else:
                    lines.append("<div class="angebot"><div class="angebot-header"><span class="angebot-name">" + o["name"] + "</span></div></div>")
            card = "<div class="metzger-card"><div class="metzger-name">" + name + "</div><div class="city">" + data.get("city", "") + "</div><div class="week-section" style="border-left: 5px solid #ff9800;"><div class="week-header" style="background: #ff9800;">Woche vom 17.08.2026 - 22.08.2026</div><div class="week-content" style="background: #fff3e0;">" + "
".join(["<div class="angebot"><div class="angebot-header"><span class="angebot-name">" + o["name"] + "</span><span class="angebot-preis">" + o["price"] + "</span></div></div>" if o["price"] else "<div class="angebot"><div class="angebot-header"><span class="angebot-name">" + o["name"] + "</span></div></div>" for o in data["offers"]) + "</div></div></div>"
        return cards

# This is getting too complex for inline - let me just run the regen properly
print("Script too complex for inline - run via terminal")

