#!/bin/bash
# Update-Script für Lebensmittel-Angebote
# Führt Scraper aus, committet und pusht Änderungen

set -e

cd /root/bayerische-kartenspiele

echo "🔄 Starte Lebensmittel-Angebote Update..."
echo "================================================"

# 1. Scraper ausführen
echo "📥 Führe Scraper aus..."
python3 scraper/weekli_scraper.py

# 2. Prüfen ob Daten geändert
if git diff --quiet data/lebensmittel-angebote.json; then
    echo "✅ Keine Änderungen an den Daten"
else
    echo "📝 Änderungen erkannt - committe..."
    
    # Git config falls nicht gesetzt
    git config user.email "bot@bayerische-kartenspiele" 2>/dev/null || true
    git config user.name "Auto-Updater" 2>/dev/null || true
    
    # Commit
    git add data/lebensmittel-angebote.json
    git commit -m "🤖 Auto-Update: Lebensmittel-Angebote $(date '+%d.%m.%Y %H:%M')"
    
    # Push (wenn nicht blockiert)
    echo "🚀 Pushe zu GitHub..."
    if git push origin master 2>&1 | grep -q "blocked"; then
        echo "⚠️ Push blockiert (Background Review) - manuell nötig:"
        echo "   cd /root/bayerische-kartenspiele && git push origin master"
    else
        echo "✅ Push erfolgreich"
    fi
fi

echo "================================================"
echo "✅ Update abgeschlossen: $(date '+%d.%m.%Y %H:%M')"