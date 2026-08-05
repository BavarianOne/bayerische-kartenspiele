// SCHAFKOPF 2 DEBUG - Copy & paste into browser Console (F12) AFTER clicking "Neues Spiel"
(function() {
    console.log('=== DEBUG START ===');
    
    // 1. gameState prüfen
    console.log('gameState:', typeof gameState !== 'undefined' ? '✅ exists' : '❌ MISSING');
    if (typeof gameState !== 'undefined') {
        console.log('  phase:', gameState.phase);
        console.log('  dealer:', gameState.dealer);
        console.log('  hands:', gameState.hands.map(h => h.length));
        console.log('  hand-0 cards:', gameState.hands[0].map(c => `${c.rank}-${c.suit}`));
    }
    
    // 2. DOM Container prüfen
    console.log('\n=== DOM CONTAINERS ===');
    for (let i = 0; i < 4; i++) {
        const container = document.getElementById(`hand-${i}`);
        console.log(`  hand-${i}:`, container ? `✅ found (${container.innerHTML.length} chars)` : '❌ MISSING');
        if (container) {
            const cards = container.querySelectorAll('[class*="card"]');
            console.log(`    cards in DOM: ${cards.length}`);
            if (cards.length > 0) {
                console.log(`    first card classes:`, cards[0].className);
            }
        }
    }
    
    // 3. renderAllHands manuell aufrufen
    console.log('\n=== MANUAL RENDER TEST ===');
    try {
        if (typeof renderAllHands === 'function') {
            renderAllHands();
            console.log('  renderAllHands() ✅ executed');
        } else {
            console.log('  renderAllHands ❌ NOT A FUNCTION');
        }
    } catch (e) {
        console.error('  renderAllHands ERROR:', e);
    }
    
    // 4. Nach render prüfen
    setTimeout(() => {
        for (let i = 0; i < 4; i++) {
            const container = document.getElementById(`hand-${i}`);
            if (container) {
                const cards = container.querySelectorAll('[class*="card"]');
                console.log(`  hand-${i} after render: ${cards.length} cards`);
            }
        }
    }, 100);
    
    // 4. Event listener auf New Game Button prüfen
    console.log('\n=== BUTTON CHECK ===');
    const btn = document.getElementById('new-game-btn');
    console.log('  new-game-btn:', btn ? '✅' : '❌');
    if (btn) console.log('  onclick:', btn.onclick ? 'set' : 'none', '| disabled:', btn.disabled);
    
    console.log('\n=== DEBUG END ===');
})();