# Spritpreise & Metzger-Angebote - Implementierungs-Dokumentation

## Überblick
Zwei separate statische HTML-Seiten, die automatisch via GitHub Actions / Cron aktualisiert werden:
1. **landshut-spritpreise.html** - Kraftstoffpreise Landshut (Diesel, E10, E5)
2. **metzger-angebote.html** - Wochenangebote von 6 Metzgereien

Beide deployen auf GitHub Pages: `https://bavarianone.github.io/bayerische-kartenspiele/`

---

## 1. SPRITPREISE (Fuel Prices)

### Architektur
```
.github/workflows/spritpreise.yml     # GitHub Actions Workflow (alle 30 Min, 07-20:30 MESZ)
.github/workflows/fetch_prices.py     # Holt Preise von clever-tanken.de
generate_landshut_spritpreise.py      # Generiert HTML aus data/prices.json + data/history.json
data/prices.json                      # Aktuelle Preise (wird jedes Mal überschrieben)
data/history.json                     # Historische Preise (wächst kontinuierlich)
landshut-spritpreise.html             # Output: statische HTML-Seite
```

### Datenquelle
- **clever-tanken.de** Tankstellen-Liste API
- Parameter: `lat=48.5763`, `lon=12.1715`, `ort=84030+Ergolding`, `r=5km`
- Spritsorten: Diesel(3), E10(5), E5(7)

### Features in HTML
- **Pro Tankstelle & Sorte**: TT (Tages-Tief), TH (Tages-Hoch), WT (Wochen-Tief), WH (Wochen-Hoch)
- **Sparklines**: Inline SVG (normalisierte Preise 0-1)
- **Trend-Indikatoren**: 📈 steigend, 📉 fallend, ➡️ stabil
- **Deutsche Ortszeit**: Europe/Berlin (automatisch MESZ/MEZ)
- **Expliziter Pages-Deploy**: Trigger via GitHub API nach Push

### Wichtige Fixes
1. **Relative Pfade**: `Path(__file__).resolve().parent` statt `/root/...` für CI-Kompatibilität
2. **Zeitzone**: `ZoneInfo("Europe/Berlin")` für lokale Zeit statt UTC
3. **Datetime-Vergleich**: Offset-aware → naive UTC normalisieren vor Sortierung
4. **Missing Files**: Graceful handling wenn data/ noch nicht existiert
5. **Pages Deploy**: Expliziter `workflow_dispatch` via API nach jedem Push
6. **Supermarkt-Tankstelle**: Nicht mehr filtern (war in Exclude-Liste)

### Workflow Schedule
```yaml
cron: "*/30 5-18 * * *"  # Alle 30 Min, 05:00-18:30 UTC = 07:00-20:30 MESZ
```

---

## 2. METZGER-ANGEBOTE (Butcher Offers)

### Architektur
```
metzger-angebote.py                   # Hauptskript (Scraping + HTML-Generierung)
metzger-angebote.html                 # Output: statische HTML-Seite
metzger-angebote-data.json            # Rohdaten für Debugging
Cron Job: metzger-angebote-daily-update  # Täglich 06:00 via Hermes cron
```

### 6 Metzgereien & Datenquellen

| Metzger | Ort | Quelle | Methode |
|---------|-----|--------|---------|
| Metzgerei Brandl | Landshut | PDF-Links auf `/speisekarten-angebote` (User-Link: `/aktuelle-angebote/`) | HTML-Parsing + statisches Mapping |
| Metzgerei Rümenapf | Ergolding | Joomla-Tabs auf Website | HTML-Tabellen-Parsing (alle 3 Wochen) |
| Metzgerei Wasner | Landshut | Flyer-Bilder auf `/angebote/` | OCR (pytesseract) + manuelle Preise |
| Metzgerei Tristlhof | Landshut | Zeitungsanzeige (manuell) | Statisch hardcoded |
| Metzgerei Hahn | Eggenfelden | OCR aus `ANGEBOTE.png` | OCR (pytesseract) |
| Brunner Metzgerei | Landshut | Flyer-Bilder auf Website | OCR + manuelle Preise |

### Features in HTML
- **Wochen-Übersicht**: Pro Woche separate Tabelle mit Start- und Enddatum (Mo-So)
- **Metzger-Karten**: Jeder Metzger eigene Card mit Wochen-Sektionen
- **Deduplizierung**: Gleiches Produkt + Preis = einmal pro Woche, alle Metzger aufgeführt
- **Nur echte Preise**: "Angebotspreis" Platzhalter werden entfernt
- **Suche**: Client-seitiges Filtern via JS
- **Teilen**: Web Share API + WhatsApp Fallback
- **Hahn aus Wochen-Übersicht**: Nur in eigener Card (wenig/unkregelmäßige Angebote)

### Wichtige Fixes
1. **Brandl URL**: Scraping von `/speisekarten-angebote`, User-Link ist `/aktuelle-angebote/`
2. **Brandl Datums-Parsing**: Aus Link-Text "Angebot vom DD.MM.YYYY bis DD.MM.YYYY" im HTML
3. **Rümenapf**: Parsed alle 3 Joomla-Tabs, nimmt nur zukünftige Wochen
4. **Wasner**: OCR von 3 Hauptflyern + 4 Passau-Flyern, nur Items mit echten Preisen
5. **Hahn**: OCR aus `https://metzgerei-hahn.de/media/upload/ANGEBOTE.png` (10 Produkte!)
6. **Tristlhof**: Nur Zeitungsanzeige 17.-22.08.2026, keine Platzhalter für nächste Woche
7. **Logo-Bilder entfernt**: Nur Hahn hatte OCR-Bild, andere Logos entfernt (gingen nicht)

### Cron Job
```bash
Schedule: "0 6 * * *"  # Täglich 06:00
Command: python3 metzger-angebote.py
Auto-commit & push to GitHub
```

---

## 3. DEPLOYMENT & AUTOMATISMUS

### GitHub Pages
- Source: `master` branch, `/ (root)`
- Auto-deploy auf Push to master
- URLs:
  - `https://bavarianone.github.io/bayerische-kartenspiele/landshut-spritpreise.html`
  - `https://bavarianone.github.io/bayerische-kartenspiele/metzger-angebote.html`

### GitHub Actions (Spritpreise)
- `.github/workflows/spritpreise.yml` → `fetch_prices.py` → `generate_landshut_spritpreise.py` → commit/push
- Expliziter Pages-Deploy via `workflow_dispatch` API

### Hermes Cron (Metzger)
- Job: `metzger-angebote-daily-update` (ID: `1db78c71e6c8`)
- Schedule: `0 6 * * *` (täglich 06:00)
- Führt `metzger-angebote.py` aus, commit/push

---

## 4. DATEIEN-ÜBERSICHT

```
/root/bayerische-kartenspiele/
├── .github/workflows/
│   ├── spritpreise.yml           # Fuel prices workflow
│   ├── fetch_prices.py           # Clever-tanken scraper
│   └── deploy-pages.yml          # Pages deploy workflow
├── generate_landshut_spritpreise.py  # Fuel HTML generator
├── metzger-angebote.py               # Butcher scraper + generator
├── data/
│   ├── prices.json               # Current fuel prices
│   └── history.json              # Historical fuel prices (~1300+ entries)
├── landshut-spritpreise.html     # Fuel output
├── metzger-angebote.html         # Butcher output
├── metzger-angebote-data.json    # Butcher raw data
└── landshut-fuel-history.json    # Initial history import
```

---

## 5. HÄUFIGE PROBLEME & LÖSUNGEN

| Problem | Lösung |
|---------|--------|
| CI: Permission denied `/root/...` | Relative Pfade via `Path(__file__).resolve().parent` |
| Datetime-Vergleich fehlschlägt | Alle timestamps zu naive UTC normalisieren |
| Zeitzone UTC statt lokal | `ZoneInfo("Europe/Berlin")` nutzen |
| Pages deploy nicht getriggert | Expliziter `workflow_dispatch` API Call nach Push |
| Brandl 404 | URL korrigiert zu `/speisekarten-angebote` |
| Rümenapf nur 0 Angebote | Alle Joomla-Tabs parsen, nicht nur ersten |
| Wasner "Angebotspreis" | Nur Items mit echten Preisen behalten |
| Hahn keine Angebote | OCR von ANGEBOTE.png Bild |
| Tristlhof falsche Woche | Nur Zeitungsanzeige, keine Platzhalter |
| Pages deploy verzögert | Expliziter Trigger + Wartezeit ~1-2 Min |

---

## 6. NEUE METZGER HINZUFÜGEN

1. In `METZGERIEN` List in `metzger-angebote.py` eintragen
2. `fetch_<name>_offers()` Funktion implementieren
3. In `main()` Dispatch-Logik erweitern
3. Falls OCR nötig: `pytesseract` + `PIL` nutzen
4. Test: `python3 metzger-angebote.py`
5. Commit & Push → Auto-Deploy

---

## 7. KONTAKT & REPO

- **Repo**: `https://github.com/BavarianOne/bayerische-kartenspiele`
- **Actions**: `https://github.com/BavarianOne/bayerische-kartenspiele/actions`
- **Pages**: `https://bavarianone.github.io/bayerische-kartenspiele/`

---

*Stand: 19.08.2026 - Voll funktionsfähig, beide Systeme laufen automatisiert* 🌸