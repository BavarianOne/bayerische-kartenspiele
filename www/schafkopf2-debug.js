// ============================================
// SCHAFKOPF 2 - DEBUG SCRIPT
// Copy & paste this into browser DevTools Console (F12)
// ============================================

(function() {
    console.log('=== SCHAFKOPF 2 DEBUG ===');
    
    // 1. Check gameState
    if (typeof gameState === 'undefined') {
        console.error('❌ gameState not found - script not loaded or different scope');
        return;
    }
    console.log('✅ gameState found:', gameState);
    console.log('  Phase:', gameState.phase);
    console.log('  Dealer:', gameState.dealer);
    console.log('  Round:', gameState.round);
    console.log('  Hands:', gameState.hands.map(h => h.length));
    console.log('  Bid Order:', gameState.bidOrder);
    console.log('  Current Bid Index:', gameState.currentBidIndex);
    console.log('  Current Player:', gameState.currentPlayer);
    
    // 2. Check DOM elements
    console.log('\n=== DOM CHECK ===');
    for (let i = 0; i < 4; i++) {
        const container = document.getElementById(`hand-${i}`);
        const area = document.getElementById(`player-${i}-area`);
        const label = document.querySelector(`#player-${i}-area .player-label`);
        console.log(`  Player ${i}: hand-${i} ${container ? '✅' : '❌'}, area ${area ? '✅' : '❌'}, label ${label ? '✅' : '❌'}`);
        if (container) {
            const cards = container.querySelectorAll('[class*="card "]');
            console.log(`    Cards in DOM: ${cards.length}`);
            if (cards.length > 0) {
                console.log(`    First card classes: ${cards[0].className}`);
            }
        }
    }
    
    // 3. Check render functions
    console.log('\n=== FUNCTION CHECK ===');
    console.log('  renderCard:', typeof renderCard);
    console.log('  renderHand:', typeof renderHand);
    console.log('  renderAllHands:', typeof renderAllHands);
    console.log('  startNewGame:', typeof startNewGame);
    console.log('  createDeck:', typeof createDeck);
    console.log('  dealCards:', typeof dealCards);
    
    // 4. Test card creation
    console.log('\n=== CARD TEST ===');
    try {
        const deck = createDeck();
        console.log('  createDeck():', deck.length, 'cards');
        const shuffled = shuffleDeck([...deck]);
        console.log('  shuffleDeck(): OK');
        const hands = dealCards(shuffled, 0);
        console.log('  dealCards(dealer=0):', hands.map(h => h.length));
        console.log('  Hand 0:', hands[0].map(c => `${c.rank}-${c.suit}`));
    } catch (e) {
        console.error('  ❌ Error in card functions:', e);
    }
    
    // 5. Check for console errors
    console.log('\n=== CONSOLE ERRORS ===');
    const originalError = console.error;
    let errorCount = 0;
    console.error = function(...args) {
        errorCount++;
        originalError.apply(console, args);
    };
    setTimeout(() => {
        if (errorCount === 0) console.log('  No console errors detected');
    }, 100);
    
    // 6. Manual render test
    console.log('\n=== MANUAL RENDER TEST ===');
    try {
        renderAllHands();
        console.log('  renderAllHands() executed');
        for (let i = 0; i < 4; i++) {
            const container = document.getElementById(`hand-${i}`);
            if (container) {
                const cards = container.querySelectorAll('[class*="card "]');
                console.log(`  hand-${i} now has ${cards.length} cards`);
            }
        }
    } catch (e) {
        console.error('  ❌ renderAllHands failed:', e);
    }
    
    console.log('\n=== DEBUG COMPLETE ===');
})();