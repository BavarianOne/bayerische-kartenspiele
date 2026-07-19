/**
 * Math Quest: Number Kingdom - Main Entry Point
 * Initializes all modules and starts the game
 */

// Import modules (for bundlers)
// import { Storage } from './storage.js';
// import { Audio } from './audio.js';
// import { Challenges } from './challenges.js';
// import { Game } from './game.js';
// import { UI } from './ui.js';
// import { Map } from './map.js';

// Global initialization
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Math Quest: Number Kingdom - Starting...');
    
    // Safety timeout: force hide loading screen after 10 seconds
    const loadingTimeout = setTimeout(() => {
        console.warn('Initialization timeout - forcing loading screen to hide');
        const loadingScreen = document.getElementById('loading-screen');
        const app = document.getElementById('app');
        if (loadingScreen) loadingScreen.classList.add('hidden');
        if (app) app.hidden = false;
    }, 10000);
    
    try {
        // Initialize all modules in order
        await initializeGame();
        
        console.log('Game initialized successfully!');
        clearTimeout(loadingTimeout);
    } catch (error) {
        console.error('Failed to initialize game:', error);
        clearTimeout(loadingTimeout);
        showErrorScreen(error);
    }
});

async function initializeGame() {
    // 1. Initialize storage first (loads saved data)
    try {
        Storage.init();
        console.log('Storage initialized');
    } catch (e) {
        console.error('Storage init failed:', e);
        throw new Error('Failed to initialize storage: ' + e.message);
    }
    
    // 2. Initialize UI (animations, styles)
    try {
        UI.init();
        console.log('UI initialized');
    } catch (e) {
        console.error('UI init failed:', e);
        throw new Error('Failed to initialize UI: ' + e.message);
    }
    
    // 3. Initialize audio (non-blocking, doesn't throw on failure)
    try {
        Audio.init(Storage.getSettings());
        console.log('Audio initialized');
    } catch (e) {
        console.warn('Audio init failed (non-fatal):', e);
        // Audio failure is non-fatal, continue without sound
    }
    
    // 4. Initialize map
    try {
        Map.init();
        console.log('Map initialized');
    } catch (e) {
        console.error('Map init failed:', e);
        throw new Error('Failed to initialize map: ' + e.message);
    }
    
    // 5. Challenges module is a pure utility/data module - no initialization needed
    console.log('Challenges module loaded (no init required)');
    
    // 6. Setup global error handling
    try {
        setupErrorHandling();
    } catch (e) {
        console.warn('Error handling setup failed:', e);
    }
    
    // 7. Setup service worker for offline support
    try {
        registerServiceWorker();
    } catch (e) {
        console.warn('Service worker registration failed:', e);
    }
    
    // 8. Handle first visit
    try {
        handleFirstVisit();
    } catch (e) {
        console.warn('First visit handling failed:', e);
    }
    
    // 9. Start update loop for time-based events
    try {
        startUpdateLoop();
    } catch (e) {
        console.warn('Update loop failed:', e);
    }
    
    // 10. Initialize game (core logic, binds events, shows menu)
    try {
        await Game.init();
        console.log('Game initialized');
    } catch (e) {
        console.error('Game init failed:', e);
        throw new Error('Failed to initialize game: ' + e.message);
    }
}

function setupErrorHandling() {
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
        // Don't show error screen for minor errors
        if (event.error && event.error.message.includes('Non-Error promise rejection')) {
            return;
        }
        // Could send to error tracking service here
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled rejection:', event.reason);
        event.preventDefault();
    });
}

async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            // Use relative path for file:// protocol compatibility
            const registration = await navigator.serviceWorker.register('./sw.js', {
                scope: './'
            });
            console.log('Service Worker registered:', registration.scope);
            
            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateAvailable();
                    }
                });
            });
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
    }
}

function showUpdateAvailable() {
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
        <span class="achievement-icon">🔄</span>
        <div class="achievement-text">
            <span class="achievement-name">Update Available</span>
            <span class="achievement-desc">Refresh to get the latest version</span>
        </div>
        <button class="btn btn-sm" onclick="location.reload()">Refresh</button>
    `;
    toast.style.maxWidth = '300px';
    
    const container = document.getElementById('achievement-toasts');
    if (container) {
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
    }
}

function handleFirstVisit() {
    const hasVisited = localStorage.getItem('mathquest_visited');
    if (!hasVisited) {
        localStorage.setItem('mathquest_visited', 'true');
        
        // Show welcome modal
        setTimeout(() => {
            showWelcomeModal();
        }, 1000);
    }
}

function showWelcomeModal() {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content welcome-modal">
            <h2>🎉 Welcome to Math Quest!</h2>
            <p>Embark on an adventure through 5 magical worlds and become a Math Legend!</p>
            <div class="welcome-features">
                <div class="feature">🌊 <strong>Ocean Cove</strong> - Counting & Addition</div>
                <div class="feature">🌲 <strong>Number Forest</strong> - Addition & Subtraction</div>
                <div class="feature">☁️ <strong>Cloud Kingdom</strong> - Multiplication & Shapes</div>
                <div class="feature">🧊 <strong>Ice Palace</strong> - Division & Patterns</div>
                <div class="feature">🚀 <strong>Space Station</strong> - Advanced Challenges</div>
            </div>
            <p class="welcome-tip">💡 Tap the <strong>Play</strong> button to start your journey!</p>
            <button class="btn btn-primary btn-lg" onclick="this.closest('.modal').remove(); Audio.playSound('click');">Let's Go!</button>
        </div>
    `;
    document.body.appendChild(modal);
    Audio.playSound('achievement');
}

function startUpdateLoop() {
    // Check for heart recovery every minute
    setInterval(() => {
        if (Game.getState().currentScreen !== 'challenge') {
            Storage.recoverHearts();
            Game.updateMenuUI(Storage.getProfile());
        }
    }, 60000);
    
    // Check daily reward reset at midnight
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 0 && now.getMinutes() < 5) {
            Storage.resetDailyClaim();
            Game.checkDailyReward();
        }
    }, 60000);
    
    // Save progress periodically
    setInterval(() => {
        Storage.saveProgress();
    }, 30000);
}

function showErrorScreen(error) {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.innerHTML = `
            <div class="loading-content error">
                <div class="error-icon">⚠️</div>
                <h2>Oops! Something went wrong</h2>
                <p>The game failed to load properly.</p>
                <details style="margin: 1rem 0; text-align: left; max-width: 300px; margin-left: auto; margin-right: auto;">
                    <summary>Error Details</summary>
                    <pre style="background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 4px; font-size: 0.75rem; overflow: auto;">${error.message}\n${error.stack}</pre>
                </details>
                <button class="btn btn-primary btn-lg" onclick="location.reload()">Reload Game</button>
                <button class="btn btn-secondary" onclick="Storage.clearAllData(); location.reload();">Reset Data & Reload</button>
            </div>
        `;
    }
}

// Global functions for inline event handlers
window.Game = Game;
window.Storage = Storage;
window.Audio = Audio;
window.Challenges = Challenges;
window.UI = UI;
window.Map = Map;

// Handle page unload
window.addEventListener('beforeunload', () => {
    Storage.saveProgress();
    Audio.destroy();
});

// Handle focus/blur for audio
window.addEventListener('focus', () => {
    if (Audio.audioContext && Audio.audioContext.state === 'suspended') {
        Audio.audioContext.resume();
    }
});

window.addEventListener('blur', () => {
    // Optionally pause music when tab is not active
    // Audio.pauseMusic();
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initializeGame };
}