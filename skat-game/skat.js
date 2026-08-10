// ========================================
// skat.js – Main entry point
// ============================================

// Global error handlers FIRST
window.addEventListener('error', (e) => {
    console.error('[Skat] Global error:', e.message, e.filename, e.lineno, e.colno, e.error);
    // Show error on screen for debugging
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:10px;left:10px;background:#d32f2f;color:white;padding:1rem;z-index:10000;max-width:90%;font-family:monospace;font-size:0.8rem;';
    div.textContent = `ERROR: ${e.message}\n${e.filename}:${e.lineno}:${e.colno}`;
    document.body.appendChild(div);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('[Skat] Unhandled promise rejection:', e.reason);
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:10px;left:10px;background:#d32f2f;color:white;padding:1rem;z-index:10000;max-width:90%;font-family:monospace;font-size:0.8rem;';
    div.textContent = `PROMISE REJECTION: ${e.reason}`;
    document.body.appendChild(div);
});

console.log('[Skat] skat.js loaded, waiting for DOM...');

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
    console.log('[Skat] DOMContentLoaded - starting init');
    init();
});

async function init() {
    try {
        console.log('[Skat] Creating Game instance...');
        // Create game instance
        game = new Game({
            playerNames: ['Du', 'Gegner 1', 'Gegner 2'],
            aiDifficulty: 'normal'
        });
        console.log('[Skat] Game instance created:', game);
        
        console.log('[Skat] Creating UI...');
        // Create UI
        ui = new UI(game);
        console.log('[Skat] UI created:', ui);
        
        // Make globally accessible for inline handlers
        window.game = game;
        window.ui = ui;
        
        console.log('[Skat] Creating Tutorial...');
        // Create Tutorial
        tutorial = new Tutorial(ui);
        window.tutorial = tutorial;
        console.log('[Skat] Tutorial created:', tutorial);
        
        // Load preferences
        const prefs = Storage.getPreferences();
        applyPreferences(prefs);
        
        // Check for saved game
        const savedGame = Storage.loadGame();
        if (savedGame && confirm('Gespeichertes Spiel fortsetzen?')) {
            console.log('[Skat] Saved game found:', savedGame);
        }
        
        // Start with tutorial
        console.log('[Skat] Starting tutorial...');
        tutorial.start();
        console.log('[Skat] Tutorial started');
        
        // Listen for game events
        game.on('gameOver', (result) => {
            Storage.recordGame(result);
        });
        
        // Auto-save game state periodically
        setInterval(() => {
            if (game.currentPhase !== 'DEALING' && game.currentPhase !== 'GAME_OVER') {
                Storage.saveGame(game.getState());
            }
        }, 30000);
        
        console.log('[Skat] Initialized successfully!');
        
    } catch (error) {
        console.error('[Skat] Initialization failed:', error);
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