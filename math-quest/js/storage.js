/**
 * Math Quest: Number Kingdom - Storage Module
 * Handles all data persistence using localStorage
 */

const Storage = (function() {
    'use strict';

    const STORAGE_KEYS = {
        PROFILE: 'mathquest_profile',
        PROGRESS: 'mathquest_progress',
        SETTINGS: 'mathquest_settings',
        STATS: 'mathquest_stats',
        ACHIEVEMENTS: 'mathquest_achievements',
        DAILY: 'mathquest_daily'
    };

    // Default data structures
    const DEFAULT_PROFILE = {
        name: 'Young Mathematician',
        avatar: '🧙‍♂️',
        level: 1,
        xp: 0,
        xpToNext: 100,
        coins: 0,
        hearts: 3,
        maxHearts: 3,
        streak: 0,
        lastPlayed: null,
        equippedAvatar: '🧙‍♂️',
        ownedAvatars: ['🧙‍♂️', '🧙‍♀️', '🧝‍♂️', '🧝‍♀️', '🤖', '🦸‍♂️', '🦸‍♀️', '🧚‍♂️', '🧚‍♀️', '👨‍🚀', '👩‍🚀', '🧑‍🔬'],
        ownedThemes: ['default'],
        equippedTheme: 'default'
    };

    const DEFAULT_PROGRESS = {
        currentWorld: 1,
        currentLevel: 1,
        totalLevelsCompleted: 0,
        totalStars: 0,
        worlds: {
            1: { unlocked: true, levels: {} },
            2: { unlocked: false, levels: {} },
            3: { unlocked: false, levels: {} },
            4: { unlocked: false, levels: {} },
            5: { unlocked: false, levels: {} }
        }
    };

    const DEFAULT_SETTINGS = {
        soundEnabled: true,
        musicEnabled: true,
        soundVolume: 0.7,
        musicVolume: 0.5,
        hapticsEnabled: true,
        reducedMotion: false,
        highContrast: false,
        dyslexicFont: false,
        colorBlindMode: 'none', // none, protanopia, deuteranopia, tritanopia
        language: 'en',
        showHints: true,
        autoAdvance: false,
        difficulty: 'adaptive' // easy, normal hard
    };

    const DEFAULT_STATS = {
        totalQuestions: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        perfectLevels: 0,
        totalPlayTime: 0, // in seconds
        sessionsPlayed: 0,
        longestStreak: 0,
        coinsEarned: 0,
        coinsSpent: 0,
        hintsUsed: 0,
        byType: {
            counting: { correct: 0, total: 0 },
            addition: { correct: 0, total: 0 },
            subtraction: { correct: 0, total: 0 },
            multiplication: { correct: 0, total: 0 },
            division: { correct: 0, total: 0 },
            numberLine: { correct: 0, total: 0 },
            patterns: { correct: 0, total: 0 },
            shapes: { correct: 0, total: 0 },
            comparison: { correct: 0, total: 0 },
            wordProblems: { correct: 0, total: 0 }
        },
        byWorld: {
            1: { correct: 0, total: 0, time: 0 },
            2: { correct: 0, total: 0, time: 0 },
            3: { correct: 0, total: 0, time: 0 },
            4: { correct: 0, total: 0, time: 0 },
            5: { correct: 0, total: 0, time: 0 }
        }
    };

    const DEFAULT_ACHIEVEMENTS = {
        first_steps: { id: 'first_steps', name: 'First Steps', desc: 'Complete your first level', icon: '👣', unlocked: false, unlockedAt: null },
        math_novice: { id: 'math_novice', name: 'Math Novice', desc: 'Complete Ocean Cove', icon: '🌊', unlocked: false, unlockedAt: null },
        math_explorer: { id: 'math_explorer', name: 'Math Explorer', desc: 'Complete Number Forest', icon: '🌲', unlocked: false, unlockedAt: null },
        math_scholar: { id: 'math_scholar', name: 'Math Scholar', desc: 'Complete Cloud Kingdom', icon: '☁️', unlocked: false, unlockedAt: null },
        math_master: { id: 'math_master', name: 'Math Master', desc: 'Complete Ice Palace', icon: '🧊', unlocked: false, unlockedAt: null },
        math_legend: { id: 'math_legend', name: 'Math Legend', desc: 'Complete Space Station', icon: '🚀', unlocked: false, unlockedAt: null },
        perfect_10: { id: 'perfect_10', name: 'Perfect 10', desc: 'Get 3 stars on 10 levels', icon: '⭐', unlocked: false, unlockedAt: null },
        streak_10: { id: 'streak_10', name: 'Hot Streak', desc: 'Get a 10 answer streak', icon: '🔥', unlocked: false, unlockedAt: null },
        streak_20: { id: 'streak_20', name: 'Blazing Streak', desc: 'Get a 20 answer streak', icon: '🔥🔥', unlocked: false, unlockedAt: null },
        streak_50: { id: 'streak_50', name: 'Unstoppable', desc: 'Get a 50 answer streak', icon: '🔥🔥🔥', unlocked: false, unlockedAt: null },
        coin_collector: { id: 'coin_collector', name: 'Coin Collector', desc: 'Collect 1,000 coins', icon: '💰', unlocked: false, unlockedAt: null },
        coin_hoarder: { id: 'coin_hoarder', name: 'Coin Hoarder', desc: 'Collect 5,000 coins', icon: '💰💰', unlocked: false, unlockedAt: null },
        speed_demon: { id: 'speed_demon', name: 'Speed Demon', desc: 'Answer 10 questions in under 3 seconds each', icon: '⚡', unlocked: false, unlockedAt: null },
        night_owl: { id: 'night_owl', name: 'Night Owl', desc: 'Play after 10 PM', icon: '🦉', unlocked: false, unlockedAt: null },
        early_bird: { id: 'early_bird', name: 'Early Bird', desc: 'Play before 7 AM', icon: '🐦', unlocked: false, unlockedAt: null },
        weekend_warrior: { id: 'weekend_warrior', name: 'Weekend Warrior', desc: 'Play on Saturday and Sunday', icon: '⚔️', unlocked: false, unlockedAt: null },
        comeback_kid: { id: 'comeback_kid', name: 'Comeback Kid', desc: 'Complete a level after losing 2 hearts', icon: '💪', unlocked: false, unlockedAt: null },
        collector: { id: 'collector', name: 'Collector', desc: 'Unlock 5 avatars', icon: '🎨', unlocked: false, unlockedAt: null }
    };

    const DEFAULT_DAILY = {
        lastClaimed: null,
        streak: 0,
        claimedToday: false
    };

    // Initialize storage
    function init() {
        // Migrate old data if needed
        migrateData();
        
        // Clean up and ensure all keys have valid data
        // This handles corrupted localStorage from previous versions
        const keysToValidate = [
            { key: STORAGE_KEYS.PROFILE, default: DEFAULT_PROFILE, validator: getProfile },
            { key: STORAGE_KEYS.PROGRESS, default: DEFAULT_PROGRESS, validator: getProgress },
            { key: STORAGE_KEYS.SETTINGS, default: DEFAULT_SETTINGS, validator: getSettings },
            { key: STORAGE_KEYS.STATS, default: DEFAULT_STATS, validator: getStats },
            { key: STORAGE_KEYS.ACHIEVEMENTS, default: DEFAULT_ACHIEVEMENTS, validator: getAchievements },
            { key: STORAGE_KEYS.DAILY, default: DEFAULT_DAILY, validator: getDaily }
        ];
        
        keysToValidate.forEach(({ key, default: def, validator }) => {
            const stored = localStorage.getItem(key);
            // Check if key doesn't exist or has invalid data
            if (!stored || stored === "undefined" || stored === "null" || stored === "") {
                console.warn(`Storage: Resetting corrupted/missing key: ${key}`);
                localStorage.removeItem(key);
            }
            // Validate the data can be parsed correctly
            try {
                const data = validator();
                if (!data || typeof data !== 'object') {
                    console.warn(`Storage: Invalid data structure for key: ${key}`);
                    localStorage.removeItem(key);
                }
            } catch (e) {
                console.warn(`Storage: Error validating key ${key}, resetting:`, e.message);
                localStorage.removeItem(key);
            }
        });
        
        // Ensure all keys exist with valid data
        if (!localStorage.getItem(STORAGE_KEYS.PROFILE)) {
            saveProfile(DEFAULT_PROFILE);
        }
        if (!localStorage.getItem(STORAGE_KEYS.PROGRESS)) {
            saveProgress(DEFAULT_PROGRESS);
        }
        if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
            saveSettings(DEFAULT_SETTINGS);
        }
        if (!localStorage.getItem(STORAGE_KEYS.STATS)) {
            saveStats(DEFAULT_STATS);
        }
        if (!localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS)) {
            saveAchievements(DEFAULT_ACHIEVEMENTS);
        }
        if (!localStorage.getItem(STORAGE_KEYS.DAILY)) {
            saveDaily(DEFAULT_DAILY);
        }
        
        // Apply settings to document
        applySettings(getSettings());
        
        console.log('Storage initialized');
    }

    // Data migration for version updates
    function migrateData() {
        const version = localStorage.getItem('mathquest_version') || '0';
        const currentVersion = '1.0.0';
        
        if (version === currentVersion) return;
        
        // Migration logic would go here for future versions
        localStorage.setItem('mathquest_version', currentVersion);
    }

    // Helper to validate if data is valid JSON object
    function isValidJSON(data) {
        if (data === null || data === undefined || data === "undefined" || data === "") {
            return false;
        }
        try {
            const parsed = JSON.parse(data);
            return typeof parsed === 'object' && parsed !== null;
        } catch (e) {
            return false;
        }
    }

// Generic get/set helpers
function get(key, defaultValue = null) {
  try {
    const data = localStorage.getItem(key);
    // Handle null, undefined, or the string "undefined"
    if (data === null || data === undefined || data === "undefined" || data === "") {
      return defaultValue;
    }
    // Try to parse - if it fails, return default
    try {
      const parsed = JSON.parse(data);
      // Ensure parsed data is an object (not array, string, number, etc.)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        console.warn('Storage: Invalid data type for key:', key, '- resetting to default');
        return defaultValue;
      }
      return parsed;
    } catch (parseError) {
      console.warn('Storage: JSON parse error for key:', key, '- resetting to default. Error:', parseError.message);
      // Clean up corrupted data
      localStorage.removeItem(key);
      return defaultValue;
    }
  } catch (e) {
    console.error('Storage get error:', e);
    return defaultValue;
  }
}

    function set(key, value) {
        try {
            // Don't store undefined values - they become the string "undefined"
            if (value === undefined) {
                console.warn('Attempted to store undefined value for key:', key);
                return false;
            }
            // Don't store null values - they become "null" string
            if (value === null) {
                console.warn('Attempted to store null value for key:', key);
                return false;
            }
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    }

    // Profile methods
    function getProfile() {
        return get(STORAGE_KEYS.PROFILE, DEFAULT_PROFILE);
    }

    function saveProfile(profile) {
        return set(STORAGE_KEYS.PROFILE, profile);
    }

    function updateProfile(updates) {
        const profile = getProfile();
        const updated = { ...profile, ...updates };
        saveProfile(updated);
        return updated;
    }

    function addXP(amount) {
        const profile = getProfile();
        profile.xp += amount;
        
        // Level up check
        while (profile.xp >= profile.xpToNext) {
            profile.xp -= profile.xpToNext;
            profile.level++;
            profile.xpToNext = Math.floor(profile.xpToNext * 1.5);
            profile.maxHearts = Math.min(5, 3 + Math.floor(profile.level / 5));
            profile.hearts = profile.maxHearts; // Refill hearts on level up
        }
        
        saveProfile(profile);
        return profile;
    }

    function addCoins(amount) {
        const profile = getProfile();
        profile.coins += amount;
        const stats = getStats();
        stats.coinsEarned += amount;
        saveStats(stats);
        saveProfile(profile);
        return profile.coins;
    }

    function spendCoins(amount) {
        const profile = getProfile();
        if (profile.coins >= amount) {
            profile.coins -= amount;
            const stats = getStats();
            stats.coinsSpent += amount;
            saveStats(stats);
            saveProfile(profile);
            return true;
        }
        return false;
    }

    function loseHeart() {
        const profile = getProfile();
        profile.hearts = Math.max(0, profile.hearts - 1);
        saveProfile(profile);
        return profile.hearts;
    }

    function gainHeart() {
        const profile = getProfile();
        profile.hearts = Math.min(profile.maxHearts, profile.hearts + 1);
        saveProfile(profile);
        return profile.hearts;
    }

    function refillHearts() {
        const profile = getProfile();
        profile.hearts = profile.maxHearts;
        saveProfile(profile);
        return profile.hearts;
    }

    function updateStreak(increment = true) {
        const profile = getProfile();
        const today = new Date().toDateString();
        const lastPlayed = profile.lastPlayed ? new Date(profile.lastPlayed).toDateString() : null;
        
        if (increment) {
            if (lastPlayed === today) {
                // Already played today, streak continues
            } else if (lastPlayed === new Date(Date.now() - 86400000).toDateString()) {
                // Played yesterday, increment streak
                profile.streak++;
            } else {
                // Streak broken
                profile.streak = 1;
            }
        }
        
        profile.lastPlayed = new Date().toISOString();
        saveProfile(profile);
        
        // Update stats
        const stats = getStats();
        stats.longestStreak = Math.max(stats.longestStreak, profile.streak);
        saveStats(stats);
        
        return profile.streak;
    }

    function resetStreak() {
        const profile = getProfile();
        profile.streak = 0;
        saveProfile(profile);
        return 0;
    }

    // Progress methods
    function getProgress() {
        return get(STORAGE_KEYS.PROGRESS, DEFAULT_PROGRESS);
    }

    function saveProgress(progress) {
        return set(STORAGE_KEYS.PROGRESS, progress);
    }

    function completeLevel(world, level, stars, perfect = false, timeSpent = 0) {
        const progress = getProgress();
        const worldProgress = progress.worlds[world];
        
        if (!worldProgress) return false;
        
        const levelData = worldProgress.levels[level] || {};
        const wasCompleted = levelData.completed || false;
        const previousStars = levelData.stars || 0;
        
        // Update level data
        worldProgress.levels[level] = {
            completed: true,
            stars: Math.max(previousStars, stars),
            perfect: perfect || levelData.perfect || false,
            bestTime: levelData.bestTime ? Math.min(levelData.bestTime, timeSpent) : timeSpent,
            attempts: (levelData.attempts || 0) + 1,
            lastPlayed: new Date().toISOString()
        };
        
        // Update totals if newly completed
        if (!wasCompleted) {
            progress.totalLevelsCompleted++;
            progress.totalStars += stars;
            
            // Unlock next level
            if (level < 10) {
                worldProgress.levels[level + 1] = worldProgress.levels[level + 1] || {};
                worldProgress.levels[level + 1].unlocked = true;
            } else {
                // World completed, unlock next world
                if (world < 5) {
                    progress.worlds[world + 1] = progress.worlds[world + 1] || { unlocked: false, levels: {} };
                    progress.worlds[world + 1].unlocked = true;
                    progress.worlds[world + 1].levels[1] = { unlocked: true };
                }
            }
            
            // Update current position
            if (world === progress.currentWorld && level === progress.currentLevel) {
                if (level < 10) {
                    progress.currentLevel = level + 1;
                } else if (world < 5) {
                    progress.currentWorld = world + 1;
                    progress.currentLevel = 1;
                }
            }
        } else if (stars > previousStars) {
            progress.totalStars += (stars - previousStars);
        }
        
        saveProgress(progress);
        return { newlyCompleted: !wasCompleted, starsEarned: stars };
    }

    function isLevelUnlocked(world, level) {
        const progress = getProgress();
        const worldProgress = progress.worlds[world];
        if (!worldProgress) return false;
        if (!worldProgress.unlocked) return false;
        if (level === 1) return true;
        return worldProgress.levels[level - 1]?.completed || false;
    }

    function getWorldProgress(world) {
        const progress = getProgress();
        return progress.worlds[world] || { unlocked: false, levels: {} };
    }

    function getCompletedCount(world) {
        const worldProgress = getWorldProgress(world);
        let count = 0;
        for (let i = 1; i <= 10; i++) {
            if (worldProgress.levels[i]?.completed) count++;
        }
        return count;
    }

    function getStars(world) {
        const worldProgress = getWorldProgress(world);
        let stars = 0;
        for (let i = 1; i <= 10; i++) {
            stars += worldProgress.levels[i]?.stars || 0;
        }
        return stars;
    }

    // Settings methods
    function getSettings() {
        return get(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    }

    function saveSettings(settings) {
        const result = set(STORAGE_KEYS.SETTINGS, settings);
        applySettings(settings);
        return result;
    }

    function updateSetting(key, value) {
        const settings = getSettings();
        settings[key] = value;
        saveSettings(settings);
        return settings;
    }

    function applySettings(settings) {
        const body = document.body;
        
        // Reduced motion
        if (settings.reducedMotion) {
            body.classList.add('reduced-motion');
        } else {
            body.classList.remove('reduced-motion');
        }
        
        // High contrast
        if (settings.highContrast) {
            body.classList.add('high-contrast');
        } else {
            body.classList.remove('high-contrast');
        }
        
        // Dyslexic font
        if (settings.dyslexicFont) {
            body.classList.add('dyslexic-font');
        } else {
            body.classList.remove('dyslexic-font');
        }
        
        // Color blind mode
        body.classList.remove('colorblind-protanopia', 'colorblind-deuteranopia', 'colorblind-tritanopia');
        if (settings.colorBlindMode && settings.colorBlindMode !== 'none') {
            body.classList.add(`colorblind-${settings.colorBlindMode}`);
        }
        
        // Dark theme
        if (settings.theme === 'dark') {
            body.classList.add('dark-theme');
        } else {
            body.classList.remove('dark-theme');
        }
        
        // Colorful theme
        if (settings.theme === 'colorful') {
            body.classList.add('colorful-theme');
        } else {
            body.classList.remove('colorful-theme');
        }
    }

    // Stats methods
    function getStats() {
        return get(STORAGE_KEYS.STATS, DEFAULT_STATS);
    }

    function saveStats(stats) {
        return set(STORAGE_KEYS.STATS, stats);
    }

    function recordAnswer(type, world, correct, timeSpent) {
        const stats = getStats();
        stats.totalQuestions++;
        
        if (correct) {
            stats.correctAnswers++;
            stats.byType[type].correct++;
        } else {
            stats.incorrectAnswers++;
        }
        stats.byType[type].total++;
        stats.byWorld[world].total++;
        if (correct) stats.byWorld[world].correct++;
        stats.byWorld[world].time += timeSpent;
        
        saveStats(stats);
        return stats;
    }

    function recordSession(playTime) {
        const stats = getStats();
        stats.sessionsPlayed++;
        stats.totalPlayTime += playTime;
        saveStats(stats);
    }

    function recordHint() {
        const stats = getStats();
        stats.hintsUsed++;
        saveStats(stats);
    }

    function recordPerfectLevel() {
        const stats = getStats();
        stats.perfectLevels++;
        saveStats(stats);
    }

    // Achievements methods
    function getAchievements() {
        return get(STORAGE_KEYS.ACHIEVEMENTS, DEFAULT_ACHIEVEMENTS);
    }

    function saveAchievements(achievements) {
        return set(STORAGE_KEYS.ACHIEVEMENTS, achievements);
    }

    function unlockAchievement(id) {
        const achievements = getAchievements();
        if (achievements[id] && !achievements[id].unlocked) {
            achievements[id].unlocked = true;
            achievements[id].unlockedAt = new Date().toISOString();
            saveAchievements(achievements);
            return achievements[id];
        }
        return null;
    }

    function getUnlockedAchievements() {
        const achievements = getAchievements();
        return Object.values(achievements).filter(a => a.unlocked);
    }

    function getLockedAchievements() {
        const achievements = getAchievements();
        return Object.values(achievements).filter(a => !a.unlocked);
    }

    // Daily reward methods
    function getDaily() {
        return get(STORAGE_KEYS.DAILY, DEFAULT_DAILY);
    }

    function saveDaily(daily) {
        return set(STORAGE_KEYS.DAILY, daily);
    }

    function canClaimDaily() {
        const daily = getDaily();
        const today = new Date().toDateString();
        return daily.lastClaimed !== today;
    }

    function claimDaily() {
        const daily = getDaily();
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        
        if (daily.lastClaimed === yesterday) {
            daily.streak++;
        } else if (daily.lastClaimed !== today) {
            daily.streak = 1;
        }
        
        daily.lastClaimed = today;
        daily.claimedToday = true;
        saveDaily(daily);
        
        // Calculate reward based on streak
        const baseCoins = 50;
        const streakBonus = Math.min(daily.streak * 10, 200);
        const totalCoins = baseCoins + streakBonus;
        
        addCoins(totalCoins);
        
        return { coins: totalCoins, streak: daily.streak };
    }

    function getDailyStreak() {
        return getDaily().streak;
    }

    // Heart recovery (called periodically)
    function recoverHearts() {
        const profile = getProfile();
        const now = Date.now();
        const lastPlayed = profile.lastPlayed ? new Date(profile.lastPlayed).getTime() : 0;
        const hoursSinceLastPlay = (now - lastPlayed) / (1000 * 60 * 60);
        
        // Recover 1 heart per hour, up to max
        const heartsToRecover = Math.floor(hoursSinceLastPlay);
        if (heartsToRecover > 0 && profile.hearts < profile.maxHearts) {
            profile.hearts = Math.min(profile.maxHearts, profile.hearts + heartsToRecover);
            saveProfile(profile);
        }
    }

    // Reset daily claim (for testing or manual reset)
    function resetDailyClaim() {
        const daily = getDaily();
        daily.lastClaimed = null;
        daily.claimedToday = false;
        saveDaily(daily);
    }

    // Shop/Inventory methods
    function purchaseAvatar(avatar) {
        const profile = getProfile();
        if (!profile.ownedAvatars.includes(avatar)) {
            profile.ownedAvatars.push(avatar);
            saveProfile(profile);
            return true;
        }
        return false;
    }

    function equipAvatar(avatar) {
        const profile = getProfile();
        if (profile.ownedAvatars.includes(avatar)) {
            profile.equippedAvatar = avatar;
            saveProfile(profile);
            return true;
        }
        return false;
    }

    function purchaseTheme(theme) {
        const profile = getProfile();
        if (!profile.ownedThemes.includes(theme)) {
            profile.ownedThemes.push(theme);
            saveProfile(profile);
            return true;
        }
        return false;
    }

    function equipTheme(theme) {
        const profile = getProfile();
        if (profile.ownedThemes.includes(theme)) {
            profile.equippedTheme = theme;
            saveProfile(profile);
            applySettings({ ...getSettings(), theme });
            return true;
        }
        return false;
    }

    // Data export/import
    function exportData() {
        return {
            profile: getProfile(),
            progress: getProgress(),
            settings: getSettings(),
            stats: getStats(),
            achievements: getAchievements(),
            daily: getDaily(),
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };
    }

    function importData(data) {
        try {
            if (data.profile) saveProfile(data.profile);
            if (data.progress) saveProgress(data.progress);
            if (data.settings) saveSettings(data.settings);
            if (data.stats) saveStats(data.stats);
            if (data.achievements) saveAchievements(data.achievements);
            if (data.daily) saveDaily(data.daily);
            return true;
        } catch (e) {
            console.error('Import failed:', e);
            return false;
        }
    }

    function clearAllData() {
        Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
        init();
    }

    // Public API
    return {
        init,
        getProfile,
        saveProfile,
        updateProfile,
        addXP,
        addCoins,
        spendCoins,
        loseHeart,
        gainHeart,
        refillHearts,
        updateStreak,
        resetStreak,
        getProgress,
        saveProgress,
        completeLevel,
        isLevelUnlocked,
        getWorldProgress,
        getCompletedCount,
        getStars,
        getSettings,
        saveSettings,
        updateSetting,
        applySettings,
        getStats,
        saveStats,
        recordAnswer,
        recordSession,
        recordHint,
        recordPerfectLevel,
        getAchievements,
        saveAchievements,
        unlockAchievement,
        getUnlockedAchievements,
        getLockedAchievements,
        getDaily,
        saveDaily,
        canClaimDaily,
        claimDaily,
        getDailyStreak,
        recoverHearts,
        resetDailyClaim,
        purchaseAvatar,
        equipAvatar,
        purchaseTheme,
        equipTheme,
        exportData,
        importData,
        clearAllData,
        STORAGE_KEYS
    };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
}