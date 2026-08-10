// ========================================
// Storage.js – localStorage persistence
// ============================================

export class Storage {
    static PREFIX = 'skat_';

    /**
     * Save current game state
     * @param {Object} state - Game state from game.getState()
     */
    static saveGame(state) {
        try {
            const saveData = {
                ...state,
                timestamp: Date.now(),
                version: '1.0'
            };
            localStorage.setItem(this.PREFIX + 'currentGame', JSON.stringify(saveData));
            return true;
        } catch (e) {
            console.error('Failed to save game:', e);
            return false;
        }
    }

    /**
     * Load saved game state
     * @returns {Object|null}
     */
    static loadGame() {
        try {
            const data = localStorage.getItem(this.PREFIX + 'currentGame');
            if (!data) return null;
            
            const saveData = JSON.parse(data);
            
            // Check if save is not too old (24 hours)
            if (Date.now() - saveData.timestamp > 24 * 60 * 60 * 1000) {
                this.clearGame();
                return null;
            }
            
            return saveData;
        } catch (e) {
            console.error('Failed to load game:', e);
            return null;
        }
    }

    /**
     * Clear saved game
     */
    static clearGame() {
        localStorage.removeItem(this.PREFIX + 'currentGame');
    }

    /**
     * Save statistics
     * @param {Object} stats
     */
    static saveStats(stats) {
        try {
            const existing = this.getStats();
            const updated = { ...existing, ...stats, lastPlayed: Date.now() };
            localStorage.setItem(this.PREFIX + 'stats', JSON.stringify(updated));
            return true;
        } catch (e) {
            console.error('Failed to save stats:', e);
            return false;
        }
    }

    /**
     * Get statistics
     * @returns {Object}
     */
    static getStats() {
        try {
            const data = localStorage.getItem(this.PREFIX + 'stats');
            if (!data) return this._defaultStats();
            return { ...this._defaultStats(), ...JSON.parse(data) };
        } catch (e) {
            console.error('Failed to load stats:', e);
            return this._defaultStats();
        }
    }

    _defaultStats() {
        return {
            gamesPlayed: 0,
            gamesWon: 0,
            gamesLost: 0,
            totalScore: 0,
            bestScore: 0,
            worstScore: 0,
            grandGames: 0,
            nullGames: 0,
            suitGames: 0,
            handGames: 0,
            schneiderCount: 0,
            schwarzCount: 0,
            highestBid: 0,
            lastPlayed: 0
        };
    }

    /**
     * Record a completed game
     * @param {Object} gameResult - From game.gameResult
     */
    static recordGame(gameResult) {
        const stats = this.getStats();
        stats.gamesPlayed++;
        stats.totalScore += gameResult.score;
        
        if (gameResult.won) {
            stats.gamesWon++;
            stats.bestScore = Math.max(stats.bestScore, gameResult.score);
        } else {
            stats.gamesLost++;
            stats.worstScore = Math.min(stats.worstScore, gameResult.score);
        }
        
        // Track game type
        const gt = gameResult.gameType || 'unknown';
        if (gt === 'grand') stats.grandGames++;
        else if (gt === 'null' || gt === 'null_ouvert') stats.nullGames++;
        else stats.suitGames++;
        
        if (gameResult.hand) stats.handGames++;
        if (gameResult.schneider) stats.schneiderCount++;
        if (gameResult.schwarz) stats.schwarzCount++;
        
        stats.lastPlayed = Date.now();
        
        this.saveStats(stats);
    }

    /**
     * Save user preferences
     * @param {Object} prefs
     */
    static savePreferences(prefs) {
        try {
            const existing = this.getPreferences();
            localStorage.setItem(this.PREFIX + 'prefs', JSON.stringify({ ...existing, ...prefs }));
            return true;
        } catch (e) {
            console.error('Failed to save preferences:', e);
            return false;
        }
    }

    /**
     * Get user preferences
     * @returns {Object}
     */
    static getPreferences() {
        try {
            const data = localStorage.getItem(this.PREFIX + 'prefs');
            if (!data) return this._defaultPreferences();
            return { ...this._defaultPreferences(), ...JSON.parse(data) };
        } catch (e) {
            console.error('Failed to load preferences:', e);
            return this._defaultPreferences();
        }
    }

    static _defaultPreferences() {
        return {
            aiDifficulty: 'normal',
            cardAnimationSpeed: 'normal', // 'slow', 'normal', 'fast'
            showCardValues: true,
            autoSortHand: true,
            confirmDiscard: true,
            soundEnabled: true,
            theme: 'classic', // 'classic', 'dark', 'high-contrast'
            language: 'de'
        };
    }

    /**
     * Clear all data
     */
    static clearAll() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(this.PREFIX));
        keys.forEach(k => localStorage.removeItem(k));
    }

    /**
     * Export all data as JSON (for backup)
     * @returns {string}
     */
    static exportData() {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.PREFIX)) {
                data[key] = localStorage.getItem(key);
            }
        }
        return JSON.stringify(data, null, 2);
    }

    /**
     * Import data from JSON
     * @param {string} json
     */
    static importData(json) {
        try {
            const data = JSON.parse(json);
            for (const [key, value] of Object.entries(data)) {
                if (key.startsWith(this.PREFIX)) {
                    localStorage.setItem(key, value);
                }
            }
            return true;
        } catch (e) {
            console.error('Failed to import data:', e);
            return false;
        }
    }
}