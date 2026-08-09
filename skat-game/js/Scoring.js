// ========================================
// Scoring.js – Punkteberechnung (vollständige Skat-Regeln)
// ============================================

/**
 * Berechnet den Endscore für ein Skat-Spiel
 * 
 * Regeln:
 * - Gewonnen: Reizwert × (1 + Matadore + Hand + Schneider + Schwarz + Ouvert)
 * - Verloren: -Reizwert × 2 × (1 + Matadore + Hand + Schneider + Schwarz + Ouvert)
 * - Null: Festwerte (23, 35, 46, 59) positiv bei Gewinn, negativ bei Verlust
 * - Ramsch: Augen zählen negativ, Jungfrau = doppelt
 */

export function calculateScore(params) {
    const {
        gameValue,      // Reizwert (berechneter Spielwert)
        won,            // boolean: Solist gewonnen?
        schneider,      // boolean: Schneider gemacht/erlitten
        schwarz,        // boolean: Schwarz gemacht/erlitten
        hand,           // boolean: Handspiel
        ouvert,         // boolean: Ouvert
        gameType,       // 'suit', 'grand', 'null', 'null_ouvert', 'ramsch'
        matadors = 0,   // Anzahl Matadore (für Anzeige)
        declarerPoints = 0, // Augen des Solisten
        opponentPoints = 0  // Augen der Gegner
    } = params;

    // Null-Spiele haben feste Werte
    if (gameType === 'null' || gameType === 'null_ouvert') {
        const nullValues = {
            'null': { simple: 23, hand: 35, ouvert: 46, hand_ouvert: 59 },
            'null_ouvert': { simple: 46, hand: 59, ouvert: 46, hand_ouvert: 59 }
        };
        
        let baseValue;
        if (hand && ouvert) baseValue = 59;
        else if (hand) baseValue = 35;
        else if (ouvert) baseValue = 46;
        else baseValue = 23;
        
        return won ? baseValue : -baseValue * 2;
    }

    // Ramsch: Augen zählen negativ
    if (gameType === 'ramsch') {
        // Wer wenigste Augen hat, gewinnt (negativ = gut)
        // Jungfrau (kein Stich) = doppelt
        // Einfache Implementierung: Minuspunkte = Augen
        return -declarerPoints; // Negativ = gut für Solisten
    }

    // Normale Spiele (Farbspiel, Grand)
    // Multiplikator: 1 (Spiel) + Matadore + Hand + Schneider + Schwarz + Ouvert
    let multiplier = 1; // Grundspiel
    
    multiplier += matadors || 0;
    if (hand) multiplier += 1;
    if (schneider) multiplier += 1;
    if (schwarz) multiplier += 1;
    if (ouvert) multiplier += 1;

    const score = gameValue * multiplier;
    
    return won ? score : -score * 2; // Verloren = doppelt negativ
}

/**
 * Berechnet detaillierte Score-Aufschlüsselung für UI
 */
export function calculateScoreDetails(params) {
    const {
        gameValue,
        won,
        schneider,
        schwarz,
        hand,
        ouvert,
        gameType,
        matadors = 0,
        declarerPoints = 0,
        opponentPoints = 0
    } = params;

    if (gameType === 'null' || gameType === 'null_ouvert') {
        let baseValue;
        if (hand && ouvert) baseValue = 59;
        else if (hand) baseValue = 35;
        else if (ouvert) baseValue = 46;
        else baseValue = 23;
        
        return {
            total: won ? baseValue : -baseValue * 2,
            breakdown: [
                { label: `Null${hand ? ' Hand' : ''}${ouvert ? ' Ouvert' : ''}`, value: baseValue },
                { label: won ? 'Gewonnen' : 'Verloren (doppelt)', value: won ? baseValue : -baseValue * 2 }
            ],
            won,
            declarerPoints,
            opponentPoints
        };
    }

    if (gameType === 'ramsch') {
        return {
            total: -declarerPoints,
            breakdown: [
                { label: 'Augen (negativ)', value: -declarerPoints }
            ],
            won: declarerPoints <= opponentPoints,
            declarerPoints,
            opponentPoints
        };
    }

    // Normaler Multiplikator
    let multiplier = 1;
    const breakdown = [
        { label: 'Grundspiel', value: 1 }
    ];

    if (matadors > 0) {
        multiplier += matadors;
        breakdown.push({ label: `${matadors} Matador${matadors > 1 ? 'e' : ''}`, value: matadors });
    }
    if (hand) {
        multiplier += 1;
        breakdown.push({ label: 'Hand', value: 1 });
    }
    if (schneider) {
        multiplier += 1;
        breakdown.push({ label: 'Schneider', value: 1 });
    }
    if (schwarz) {
        multiplier += 1;
        breakdown.push({ label: 'Schwarz', value: 1 });
    }
    if (ouvert) {
        multiplier += 1;
        breakdown.push({ label: 'Ouvert', value: 1 });
    }

    const total = gameValue * multiplier;
    const finalScore = won ? total : -total * 2;

    breakdown.push(
        { label: `= Multiplikator`, value: multiplier },
        { label: `× Reizwert (${gameValue})`, value: total },
        { label: won ? 'Gewonnen' : 'Verloren (doppelt)', value: finalScore }
    );

    return {
        total: finalScore,
        breakdown,
        won,
        multiplier,
        declarerPoints,
        opponentPoints,
        schneider: declarerPoints >= 90 || opponentPoints >= 90,
        schwarz: declarerPoints === 120 || opponentPoints === 120
    };
}

/**
 * Prüft Schneider/Schwarz Bedingungen
 */
export function checkSchneiderSchwarz(declarerPoints, opponentPoints, tricksDeclarer, tricksOpponents) {
    return {
        schneider: declarerPoints >= 90 || opponentPoints >= 90,
        schwarz: declarerPoints === 120 || opponentPoints === 120 || 
                 tricksDeclarer === 10 || tricksOpponents.every(t => t === 0)
    };
}

/**
 * Bestimmt Spielausgang für alle Spieltypen
 */
export function determineGameOutcome(gameType, declarerPoints, opponentPoints, tricksDeclarer, tricksOpponents) {
    let won = false;
    let schneider = false;
    let schwarz = false;

    if (gameType === 'null' || gameType === 'null_ouvert') {
        // Null: Solist darf KEINEN Stich machen
        won = tricksDeclarer === 0;
        schwarz = won; // Wenn gewonnen, automatisch schwarz (alle Stiche an Gegner)
        schneider = false; // Kein Schneider bei Null
    } else if (gameType === 'ramsch') {
        // Ramsch: Wenige Augen = gut
        won = declarerPoints <= opponentPoints;
        // Schneider/Schwarz nicht standardmäßig bei Ramsch
    } else {
        // Farbspiel / Grand
        won = declarerPoints >= 61;
        schneider = declarerPoints >= 90 || opponentPoints >= 90;
        schwarz = declarerPoints === 120 || opponentPoints === 120 || 
                  tricksDeclarer === 10 || tricksOpponents.every(t => t === 0);
    }

    return { won, schneider, schwarz };
}

/**
 * Formatiert Score für Anzeige
 */
export function formatScore(score) {
    const sign = score > 0 ? '+' : '';
    return `${sign}${score}`;
}

/**
 * Berechnet Serien-Score (mehrere Spiele)
 */
export function calculateSeriesScore(games) {
    return games.reduce((acc, game) => {
        const details = calculateScoreDetails(game);
        acc.total += details.total;
        acc.games.push({
            ...game,
            score: details.total,
            won: details.won
        });
        if (details.won) acc.won++;
        else acc.lost++;
        return acc;
    }, { total: 0, won: 0, lost: 0, games: [] });
}