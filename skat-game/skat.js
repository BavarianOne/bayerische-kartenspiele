// ========================================
// skat.js – Main entry point
// ============================================

import { Game } from './js/Game.js';
import { UI } from './js/UI.js';
import { Tutorial } from './js/Tutorial.js';
import { Storage } from './js/Storage.js';

// Global instances
let game = null;
let ui = null;
let tutorial = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    try {
        // Create game instance
        game = new Game({
            playerNames: ['Du', 'Gegner 1', 'Gegner 2'],
            aiDifficulty: 'normal'
        });
        
        // Create UI
        ui = new UI(game);
        
        // Make globally accessible for inline handlers
        window.game = game;
        window.ui = ui;
        
        // Create Tutorial
        tutorial = new Tutorial(ui);
        window.tutorial = tutorial;
        
        // Load preferences
        const prefs = Storage.getPreferences();
        applyPreferences(prefs);
        
        // Check for saved game
        const savedGame = Storage.loadGame();
        if (savedGame && confirm('Gespeichertes Spiel fortsetzen?')) {
            // TODO: Restore game state
            console.log('Saved game found:', savedGame);
        }
        
        // Start with tutorial
        tutorial.start();
        
        // Listen for game events
        game.on('gameOver', (result) => {
            Storage.recordGame(result);
        });
        
        // Auto-save game state periodically
        setInterval(() => {
            if (game.currentPhase !== 'DEALING' && game.currentPhase !== 'GAME_OVER') {
                Storage.saveGame(game.getState());
            }
        }, 30000); // Every 30 seconds
        
        console.log('Skat initialized successfully!');
        
    } catch (error) {
        console.error('Failed to initialize Skat:', error);
        showError('Fehler beim Starten: ' + error.message);
    }
}

function applyPreferences(prefs) {
    // Apply theme
    if (prefs.theme) {
        document.body.classList.add('theme-' + prefs.theme);
    }
    
    // Apply animation speed
    if (prefs.cardAnimationSpeed) {
        document.documentElement.style.setProperty(
            '--transition-normal', 
            prefs.cardAnimationSpeed === 'fast' ? '0.15s' : 
            prefs.cardAnimationSpeed === 'slow' ? '0.5s' : '0.3s'
        );
    }
    
    // Sound
    if (prefs.soundEnabled === false) {
        // TODO: Disable sounds
    }
}

function showError(message) {
    const div = document.createElement('div');
    div.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: #d32f2f; color: white; padding: 1rem 2rem;
        border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 10000; font-size: 1.1rem;
    `;
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 5000);
}

// Export for debugging
window.SkatGame = { Game, UI, Tutorial, Storage };

// Service Worker registration for offline support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
            // SW optional, ignore errors
        });
    });
}