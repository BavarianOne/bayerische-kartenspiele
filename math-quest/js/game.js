/**
 * Math Quest: Number Kingdom - Game Module
 * Core game logic, state management, level progression
 */

const Game = (function() {
    'use strict';

    // Game state
    let state = {
        currentScreen: 'loading',
        currentWorld: 1,
        currentLevel: 1,
        questions: [],
        currentQuestionIndex: 0,
        currentQuestion: null,
        answers: [],
        correctCount: 0,
        heartsLost: 0,
        streak: 0,
        maxStreak: 0,
        levelStartTime: 0,
        questionStartTime: 0,
        totalTime: 0,
        isPaused: false,
        isAnswered: false,
        showFeedback: false,
        feedbackCorrect: false,
        hintUsed: false,
        dailyClaimed: false
    };

    // DOM elements cache
    let elements = {};

    // Timers
    let timers = {
        question: null,
        feedback: null,
        autoAdvance: null
    };

    // Constants
    const QUESTIONS_PER_LEVEL = 10;
    const BASE_TIME_PER_QUESTION = 15000; // 15 seconds
    const HEART_RECOVERY_TIME = 300000; // 5 minutes

    const TRANSLATIONS = {
        en: {
            menuPlay: 'Adventure Map',
            menuShop: 'Shop',
            menuProfile: 'Profile',
            menuSettings: 'Settings',
            menuMute: 'Mute',
            menuUnmute: 'Unmute',
            menuSubtitle: 'Learn math through adventure!',
            dailyReward: 'Daily Reward',
            shopTitle: '🏪 Kingdom Shop',
            settingsTitle: '⚙️ Settings',
            pauseTitle: '⏸️ Paused',
            pauseContinue: 'Continue',
            pauseSettings: 'Settings',
            pauseQuit: 'Quit Level'
        },
        de: {
            menuPlay: 'Abenteuer',
            menuShop: 'Shop',
            menuProfile: 'Profil',
            menuSettings: 'Einstellungen',
            menuMute: 'Ton aus',
            menuUnmute: 'Ton an',
            menuSubtitle: 'Lerne Mathe auf deiner Abenteuerreise!',
            dailyReward: 'Tägliche Belohnung',
            shopTitle: '🏪 Königreichs-Shop',
            settingsTitle: '⚙️ Einstellungen',
            pauseTitle: '⏸️ Pausiert',
            pauseContinue: 'Weiter',
            pauseSettings: 'Einstellungen',
            pauseQuit: 'Level verlassen'
        }
    };

    // Initialize game
    async function init() {
        console.log('Initializing game...');
        
        // Cache DOM elements
        cacheElements();
        
        // Bind events
        bindEvents();
        
        // Load profile and progress
        loadGameData();
        
        // Check daily reward
        checkDailyReward();
        
        // Show menu
        showScreen('menu');
        applyLocalization();
        applyMuteButton();
        
        // Hide loading screen and show app
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.classList.add('hidden');
        const app = document.getElementById('app');
        if (app) app.hidden = false;
        
        // Also hide the loading-screen element if it exists (for compatibility)
        const loadingScreenCompat = document.getElementById('loading-screen');
        if (loadingScreenCompat) loadingScreenCompat.hidden = true;
        
        // Start menu music
        Audio.playMusic('menu');
        
        console.log('Game initialized');
    }

    // Cache DOM elements
    function cacheElements() {
        // Screens
        elements.screens = {
            loading: document.getElementById('loading-screen'),
            menu: document.getElementById('screen-menu'),
            map: document.getElementById('screen-map'),
            challenge: document.getElementById('screen-challenge'),
            results: document.getElementById('screen-results'),
            shop: document.getElementById('screen-shop'),
            settings: document.getElementById('screen-settings'),
            profile: document.getElementById('screen-profile')
        };

        // Menu elements
        elements.menu = {
            profileName: document.getElementById('menu-name'),
            profileAvatar: document.getElementById('menu-avatar'),
            profileLevel: document.getElementById('menu-level'),
            profileXP: document.getElementById('menu-xp'),
            profileXPBar: document.getElementById('menu-profile-xp-bar'),
            coins: document.getElementById('menu-coins'),
            hearts: document.getElementById('menu-hearts'),
            streak: document.getElementById('menu-streak'),
            btnPlay: document.getElementById('btn-play') || document.querySelector('[data-action="change-screen"][data-value="map"]'),
            btnShop: document.getElementById('btn-shop') || document.querySelector('[data-action="change-screen"][data-value="shop"]'),
            btnProfile: document.getElementById('btn-profile') || document.querySelector('[data-action="change-screen"][data-value="profile"]'),
            btnSettings: document.getElementById('btn-settings') || document.querySelector('[data-action="change-screen"][data-value="settings"]'),
            btnMute: document.getElementById('btn-mute'),
            btnDaily: document.getElementById('btn-daily') || document.querySelector('[data-action="claim-daily"]'),
            dailyStreak: document.getElementById('daily-streak')
        };

        // Map elements
        elements.map = {
            worldName: document.getElementById('map-world-name'),
            worldProgress: document.getElementById('map-world-progress'),
            progressBar: document.getElementById('map-progress-bar'),
            mapCoins: document.getElementById('map-coins'),
            mapHearts: document.getElementById('map-hearts'),
            mapScene: document.getElementById('map-scene'),
            mapPath: document.getElementById('map-path'),
            mapDecorations: document.getElementById('map-decorations'),
            mapLevels: document.getElementById('map-levels'),
            btnPrevWorld: document.getElementById('btn-prev-world'),
            btnNextWorld: document.getElementById('btn-next-world'),
            btnBack: document.getElementById('btn-map-back')
        };

        // Challenge elements
        elements.challenge = {
            worldName: document.getElementById('challenge-world'),
            levelName: document.getElementById('challenge-level'),
            questionCounter: document.getElementById('challenge-counter'),
            timerRing: document.querySelector('.timer-ring'),
            timerProgress: document.querySelector('.timer-progress'),
            timerText: document.querySelector('.timer-text'),
            questionType: document.getElementById('question-type'),
            questionText: document.getElementById('question-text'),
            questionVisual: document.getElementById('question-visual'),
            answersGrid: document.getElementById('answer-area'),
            numberInput: document.getElementById('number-input-container'),
            numberDisplay: document.getElementById('number-display'),
            numberKeypad: document.getElementById('number-keypad'),
            dragDrop: document.getElementById('drag-drop-container'),
            dropZones: document.getElementById('drop-zones'),
            dragItems: document.getElementById('drag-items'),
            hearts: document.getElementById('hearts-display'),
            streak: document.getElementById('streak-display'),
            progressBar: document.getElementById('progress-bar'),
            btnHint: document.querySelector('[data-action="use-hint"]'),
            btnPause: document.getElementById('pause-modal')
        };

        // Results elements (created dynamically in showResults)
        elements.results = {
            container: document.getElementById('results-container'),
            content: document.getElementById('results-content')
        };

        // Modals
        elements.modals = {
            pause: document.getElementById('pause-modal'),
            settings: document.getElementById('modal-settings'),
            daily: document.getElementById('modal-daily'),
            shop: document.getElementById('modal-shop'),
            achievement: document.getElementById('modal-achievement')
        };

        // Settings elements
        elements.settings = {
            soundEnabled: document.getElementById('setting-sound'),
            musicEnabled: document.getElementById('setting-music'),
            soundVolume: document.getElementById('setting-sound-volume'),
            musicVolume: document.getElementById('setting-music-volume'),
            hapticsEnabled: document.getElementById('setting-haptics'),
            reducedMotion: document.getElementById('setting-reduced-motion'),
            highContrast: document.getElementById('setting-high-contrast'),
            dyslexicFont: document.getElementById('setting-dyslexic-font'),
            colorBlindMode: document.getElementById('setting-colorblind'),
            language: document.getElementById('setting-language'),
            showHints: document.getElementById('setting-hints'),
            autoAdvance: document.getElementById('setting-auto-advance'),
            difficulty: document.getElementById('setting-difficulty'),
            btnReset: document.getElementById('btn-reset-progress'),
            btnExport: document.getElementById('btn-export-data'),
            btnImport: document.getElementById('btn-import-data')
        };

        // Profile elements
        elements.profile = {
            avatar: document.getElementById('profile-avatar-large'),
            name: document.getElementById('profile-name'),
            title: document.getElementById('profile-title'),
            level: document.getElementById('profile-level'),
            xp: document.getElementById('profile-xp'),
            xpBar: document.getElementById('profile-xp-bar'),
            coins: document.getElementById('profile-coins'),
            hearts: document.getElementById('profile-hearts'),
            streak: document.getElementById('profile-streak'),
            achievements: document.getElementById('achievements-grid'),
            stats: document.getElementById('stats-grid'),
            history: document.getElementById('history-list')
        };

        // Shop elements
        elements.shop = {
            content: document.getElementById('shop-content'),
            coins: document.getElementById('shop-coins')
        };

        // Toast containers
        elements.toasts = {
            achievements: document.getElementById('achievement-toasts'),
            offline: document.getElementById('offline-notice')
        };
    }

    // Bind event listeners
    function bindEvents() {
        // Menu buttons
        elements.menu.btnPlay?.addEventListener('click', () => startLevel());
        elements.menu.btnShop?.addEventListener('click', () => showScreen('shop'));
        elements.menu.btnProfile?.addEventListener('click', () => showScreen('profile'));
        elements.menu.btnSettings?.addEventListener('click', () => showScreen('settings'));
        elements.menu.btnMute?.addEventListener('click', toggleMute);
        elements.menu.btnDaily?.addEventListener('click', claimDailyReward);

        // Map buttons
        elements.map.btnPrevWorld?.addEventListener('click', () => changeWorld(-1));
        elements.map.btnNextWorld?.addEventListener('click', () => changeWorld(1));
        elements.map.btnBack?.addEventListener('click', () => showScreen('menu'));

        // Challenge buttons
        elements.challenge.btnHint?.addEventListener('click', useHint);
        elements.challenge.btnPause?.addEventListener('click', pauseGame);

        // Pause modal
        document.getElementById('btn-resume')?.addEventListener('click', resumeGame);
        document.getElementById('btn-restart')?.addEventListener('click', restartLevel);
        document.getElementById('btn-quit')?.addEventListener('click', quitToMap);

        // Results buttons
        document.getElementById('btn-next-level')?.addEventListener('click', nextLevel);
        document.getElementById('btn-replay')?.addEventListener('click', restartLevel);
        document.getElementById('btn-map')?.addEventListener('click', quitToMap);
        document.getElementById('btn-menu')?.addEventListener('click', () => showScreen('menu'));

        // Settings
        bindSettingsEvents();

        // Keyboard support
        document.addEventListener('keydown', handleKeydown);

        // Mute / tablet audio controls
        applyMuteButton();

        // Visibility change (pause when tab hidden)
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Online/offline
        window.addEventListener('online', () => hideOfflineNotice());
        window.addEventListener('offline', () => showOfflineNotice());

        // Touch support for drag-drop
        bindTouchEvents();
    }

    function bindSettingsEvents() {
        const settings = Storage.getSettings();
        
        // Toggles
        Object.keys(settings).forEach(key => {
            const element = elements.settings[key]?.addEventListener('change', (e) => {
                const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                Storage.updateSetting(key, value);
                Audio.updateSettings(Storage.getSettings());
                applySettingsToUI();
            });
        });
        
        // Volume sliders
        elements.settings.soundVolume?.addEventListener('input', (e) => {
            Audio.setSfxVolume(parseFloat(e.target.value));
        });
        elements.settings.musicVolume?.addEventListener('input', (e) => {
            Audio.setMusicVolume(parseFloat(e.target.value));
        });

        // Danger zone
        elements.settings.btnReset?.addEventListener('click', confirmResetProgress);
        elements.settings.btnExport?.addEventListener('click', exportData);
        elements.settings.btnImport?.addEventListener('click', () => document.getElementById('import-file')?.click());
        document.getElementById('import-file')?.addEventListener('change', importData);
    }

    function bindTouchEvents() {
        // Drag and drop touch support
        const dragItems = elements.challenge.dragItems;
        if (dragItems) {
            dragItems.addEventListener('touchstart', handleDragStart, { passive: false });
            dragItems.addEventListener('touchmove', handleDragMove, { passive: false });
            dragItems.addEventListener('touchend', handleDragEnd);
        }
    }

    // Load game data from storage
    function loadGameData() {
        let profile;
        let progress;
        
        try {
            profile = Storage.getProfile();
        } catch (e) {
            console.error('Game: Error loading profile, using defaults:', e);
            profile = { name: 'Young Mathematician', level: 1, coins: 0, hearts: 3, maxHearts: 3, streak: 0, xp: 0, xpToNext: 100, equippedAvatar: '🧙‍♂️' };
        }
        
        try {
            progress = Storage.getProgress();
        } catch (e) {
            console.error('Game: Error loading progress, using defaults:', e);
            progress = { currentWorld: 1, currentLevel: 1, totalLevelsCompleted: 0, totalStars: 0, worlds: {} };
        }
        
        state.currentWorld = progress.currentWorld || 1;
        state.currentLevel = progress.currentLevel || 1;
        
        updateMenuUI(profile);
        updateMapUI();
    }

    // Check daily reward
    function checkDailyReward() {
        const canClaim = Storage.canClaimDaily();
        const streak = Storage.getDailyStreak();
        
        if (elements.menu.btnDaily) {
            elements.menu.btnDaily.classList.toggle('available', canClaim);
        }
        if (elements.menu.dailyStreak) {
            elements.menu.dailyStreak.textContent = `🔥 ${streak}`;
        }
    }

    // Claim daily reward
    function claimDailyReward() {
        if (!Storage.canClaimDaily()) return;
        
        const result = Storage.claimDaily();
        Audio.playSound('coin');
        Audio.playSound('achievement');
        
        // Show reward modal
        showDailyModal(result.coins, result.streak);
        
        // Update UI
        checkDailyReward();
        updateMenuUI(Storage.getProfile());
    }

    // Show daily reward modal
    function showDailyModal(coins, streak) {
        const modal = elements.modals.daily;
        if (!modal) return;
        
        modal.querySelector('.daily-coins').textContent = coins;
        modal.querySelector('.daily-streak').textContent = streak;
        modal.classList.add('show');
        modal.hidden = false;
        
        setTimeout(() => {
            modal.classList.remove('show');
            modal.hidden = true;
        }, 4000);
    }

    // Update menu UI
    function updateMenuUI(profile) {
        if (elements.menu.profileName) elements.menu.profileName.textContent = profile.name;
        if (elements.menu.profileAvatar) elements.menu.profileAvatar.textContent = profile.equippedAvatar;
        if (elements.menu.profileLevel) elements.menu.profileLevel.textContent = profile.level;
        if (elements.menu.coins) elements.menu.coins.textContent = profile.coins;
        if (elements.menu.hearts) elements.menu.hearts.textContent = `${profile.hearts}/${profile.maxHearts}`;
        if (elements.menu.streak) elements.menu.streak.textContent = `🔥 ${profile.streak}`;
        
        // XP bar
        if (elements.menu.profileXP) {
            elements.menu.profileXP.textContent = `${profile.xp}/${profile.xpToNext} XP`;
        }
        if (elements.menu.profileXPBar) {
            const percent = (profile.xp / profile.xpToNext) * 100;
            elements.menu.profileXPBar.style.width = `${percent}%`;
        }
    }

    // Update map UI
    function updateMapUI() {
        let world;
        let progress;
        let worldProgress;
        let profile;
        let completed;
        
        // Get world with error handling
        try {
            world = Challenges.getWorld(state.currentWorld);
        } catch (e) {
            console.error('Game: Error getting world, using defaults:', e);
            world = { id: state.currentWorld, name: `World ${state.currentWorld}`, levels: 10 };
        }
        
        // Get progress with error handling
        try {
            progress = Storage.getProgress();
            worldProgress = progress?.worlds?.[state.currentWorld] || { levels: {} };
        } catch (e) {
            console.error('Game: Error getting progress, using defaults:', e);
            progress = { worlds: {} };
            worldProgress = { levels: {} };
        }
        
        if (elements.map.worldName) {
            elements.map.worldName.textContent = world.name;
        }
        
        // Progress bar
        try {
            completed = Storage.getCompletedCount(state.currentWorld);
        } catch (e) {
            console.error('Game: Error getting completed count:', e);
            completed = 0;
        }
        const total = world.levels || 10;
        const percent = (completed / total) * 100;
        
        if (elements.map.worldProgress) {
            elements.map.worldProgress.textContent = `${completed}/${total} levels`;
        }
        if (elements.map.progressBar) {
            elements.map.progressBar.style.width = `${percent}%`;
        }
        
        // Stats
        try {
            profile = Storage.getProfile();
        } catch (e) {
            console.error('Game: Error getting profile, using defaults:', e);
            profile = { coins: 0, hearts: 3, maxHearts: 3 };
        }
        if (elements.map.mapCoins) elements.map.mapCoins.textContent = profile.coins;
        if (elements.map.mapHearts) elements.map.mapHearts.textContent = `${profile.hearts}/${profile.maxHearts}`;
        
        // Render map
        renderMap(world, worldProgress);
        
        // World navigation
        if (elements.map.btnPrevWorld) {
            elements.map.btnPrevWorld.disabled = state.currentWorld === 1;
        }
        if (elements.map.btnNextWorld) {
            const nextUnlocked = progress?.worlds?.[state.currentWorld + 1]?.unlocked;
            elements.map.btnNextWorld.disabled = state.currentWorld === 5 || !nextUnlocked;
        }
    }

    // Render map with level nodes
    function renderMap(world, worldProgress) {
        const scene = elements.map.mapScene;
        const levelsContainer = elements.map.mapLevels;
        const pathContainer = elements.map.mapPath;
        const decorationsContainer = elements.map.mapDecorations;
        
        if (!scene || !levelsContainer) return;
        
        // Clear
        levelsContainer.innerHTML = '';
        decorationsContainer.innerHTML = '';
        
        // Set world class for styling
        scene.className = 'map-scene';
        scene.classList.add(`world-${world.id}`);
        
        // Generate path
        generatePath(world, worldProgress);
        
        // Generate decorations
        generateDecorations(world);
        
        // Generate level nodes
        for (let i = 1; i <= world.levels; i++) {
            const levelData = worldProgress.levels[i] || {};
            const unlocked = i === 1 || worldProgress.levels[i - 1]?.completed;
            const completed = levelData.completed || false;
            const stars = levelData.stars || 0;
            const isCurrent = (state.currentLevel === i && state.currentWorld === world.id && !completed);
            
            createLevelNode(i, unlocked, completed, stars, isCurrent, world);
        }
        
        // Scroll to current level
        scrollToCurrentLevel();
    }

    // Generate SVG path
    function generatePath(world, worldProgress) {
        const pathContainer = elements.map.mapPath;
        if (!pathContainer) return;
        
        const scene = elements.map.mapScene;
        const width = scene.clientWidth || 320;
        const height = scene.clientHeight || 500;
        
        // Create curved path through levels
        const points = [];
        const padding = 40;
        const usableHeight = height - padding * 2;
        const stepY = usableHeight / (world.levels - 1);
        
        for (let i = 0; i < world.levels; i++) {
            const x = width / 2 + Math.sin(i * 0.5) * (width * 0.25);
            const y = padding + i * stepY;
            points.push({ x, y });
        }
        
        // Generate SVG path
        let pathD = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            const cp1x = points[i-1].x;
            const cp1y = points[i-1].y + (points[i].y - points[i-1].y) * 0.5;
            const cp2x = points[i].x;
            const cp2y = points[i].y - (points[i].y - points[i-1].y) * 0.5;
            pathD += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${points[i].x} ${points[i].y}`;
        }
        
        pathContainer.innerHTML = `
            <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                <path class="path-segment" d="${pathD}" stroke="var(--color-primary)" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        
        // Animate path
        requestAnimationFrame(() => {
            const path = pathContainer.querySelector('.path-segment');
            if (path) {
                const length = path.getTotalLength();
                path.style.strokeDasharray = length;
                path.style.strokeDashoffset = length;
                path.getBoundingClientRect(); // Force reflow
                path.style.transition = 'stroke-dashoffset 1.5s ease-out';
                path.style.strokeDashoffset = 0;
            }
        });
    }

    // Generate decorations
    function generateDecorations(world) {
        const container = elements.map.mapDecorations;
        if (!container) return;
        
        const decorationSets = {
            1: ['🐠', '🐟', '🦀', '🐚', '🪸', '🦑'],
            2: ['🌲', '🌳', '🍄', '🌰', '🦋', '🍃'],
            3: ['☁️', '⭐', '🌙', '☀️', '🌈', '🕊️'],
            4: ['❄️', '🧊', '🐧', '⛄', '🌨️', '🏔️'],
            5: ['🚀', '🪐', '👽', '🛸', '🌟', '🛰️']
        };
        
        const decos = decorationSets[world.id] || decorationSets[1];
        const scene = elements.map.mapScene;
        const width = scene.clientWidth || 320;
        const height = scene.clientHeight || 500;
        
        for (let i = 0; i < 8; i++) {
            const deco = document.createElement('div');
            deco.className = 'map-decoration';
            deco.textContent = decos[Math.floor(Math.random() * decos.length)];
            deco.style.left = `${Math.random() * (width - 60) + 30}px`;
            deco.style.top = `${Math.random() * (height - 60) + 30}px`;
            deco.style.animationDelay = `${Math.random() * 20}s`;
            deco.style.fontSize = `${Math.random() * 1.5 + 1.5}rem`;
            container.appendChild(deco);
        }
    }

    // Create level node
    function createLevelNode(level, unlocked, completed, stars, isCurrent, world) {
        const container = elements.map.mapLevels;
        if (!container) return;
        
        const scene = elements.map.mapScene;
        const width = scene.clientWidth || 320;
        const height = scene.clientHeight || 500;
        const padding = 40;
        const usableHeight = height - padding * 2;
        const stepY = usableHeight / (world.levels - 1);
        
        const x = width / 2 + Math.sin((level - 1) * 0.5) * (width * 0.25);
        const y = padding + (level - 1) * stepY;
        
        const node = document.createElement('button');
        node.className = 'level-node';
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.dataset.level = level;
        
        if (!unlocked) {
            node.classList.add('locked');
            node.disabled = true;
            node.innerHTML = '<span class="lock-icon">🔒</span>';
        } else if (completed) {
            node.classList.add('completed');
            node.innerHTML = `<span class="level-number">${level}</span>`;
        } else if (isCurrent) {
            node.classList.add('current', 'available');
            node.innerHTML = `<span class="level-number">${level}</span><div class="current-pulse"></div>`;
        } else {
            node.classList.add('available');
            node.innerHTML = `<span class="level-number">${level}</span>`;
        }
        
        // Stars
        const starsEl = document.createElement('div');
        starsEl.className = 'level-stars';
        for (let s = 1; s <= 3; s++) {
            const star = document.createElement('span');
            star.className = 'star' + (s <= stars ? ' filled' : '');
            star.textContent = '⭐';
            starsEl.appendChild(star);
        }
        node.appendChild(starsEl);
        
// Perfect badge - with error handling
let levelData = null;
try {
  const progress = Storage.getProgress();
  levelData = progress?.worlds?.[world.id]?.levels[level];
} catch (e) {
  console.error('Game: Error getting level data for perfect badge:', e);
}
if (levelData?.perfect) {
  const badge = document.createElement('span');
  badge.className = 'perfect-badge';
  badge.textContent = '✨';
  node.appendChild(badge);
}
        
        // Click handler
        if (unlocked && !completed) {
            node.addEventListener('click', () => selectLevel(level));
        }
        
        container.appendChild(node);
    }

    // Scroll to current level
    function scrollToCurrentLevel() {
        const scene = elements.map.mapScene;
        const currentNode = scene?.querySelector('.level-node.current');
        if (currentNode && scene) {
            currentNode.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }

    // Select level
    function selectLevel(level) {
        state.currentLevel = level;
        startLevel();
    }

    // Start level
    function startLevel() {
        // Generate questions
        state.questions = Challenges.generateLevel(state.currentWorld, state.currentLevel, QUESTIONS_PER_LEVEL);
        state.currentQuestionIndex = 0;
        state.answers = [];
        state.correctCount = 0;
        state.heartsLost = 0;
        state.streak = 0;
        state.maxStreak = 0;
        state.levelStartTime = Date.now();
        state.isPaused = false;
        
        // Play world music
        const world = Challenges.getWorld(state.currentWorld);
        Audio.playMusic(`world${state.currentWorld}`);
        
        // Show challenge screen
        showScreen('challenge');
        loadQuestion();
    }

    // Load current question
    function loadQuestion() {
        const question = state.questions[state.currentQuestionIndex];
        if (!question) {
            finishLevel();
            return;
        }
        
        state.currentQuestion = question;
        state.isAnswered = false;
        state.hintUsed = false;
        state.questionStartTime = Date.now();
        
        // Update UI
        updateChallengeUI(question);
        
        // Start timer
        startQuestionTimer();
        
        // Animate in
        elements.challenge.questionVisual?.classList.remove('animate-in');
        requestAnimationFrame(() => {
            elements.challenge.questionVisual?.classList.add('animate-in');
        });
    }

    // Update challenge UI
    function updateChallengeUI(question) {
        const world = Challenges.getWorld(state.currentWorld);
        
        // Header
        if (elements.challenge.worldName) elements.challenge.worldName.textContent = world.name;
        if (elements.challenge.levelName) elements.challenge.levelName.textContent = `Level ${state.currentLevel}`;
        if (elements.challenge.questionCounter) {
            elements.challenge.questionCounter.textContent = `${state.currentQuestionIndex + 1} / ${state.questions.length}`;
        }
        
        // Question
        if (elements.challenge.questionType) {
            const typeInfo = Challenges.getQuestionType(question.type);
            elements.challenge.questionType.innerHTML = `<span class="type-icon">${typeInfo.icon}</span> ${typeInfo.name}`;
        }
        if (elements.challenge.questionText) elements.challenge.questionText.textContent = question.question;
        
        // Visual
        renderQuestionVisual(question);
        
        // Answers
        renderAnswers(question);
        
        // Progress
        updateProgressBar();
        
        // Hearts
        updateHeartsDisplay();
        
        // Streak
        updateStreakDisplay();
    }

    // Render question visual
    function renderQuestionVisual(question) {
        const container = elements.challenge.questionVisual;
        if (!container) return;
        
        container.innerHTML = '';
        
        switch (question.subtype) {
            case 'visual':
                // Counting objects
                if (question.visual && Array.isArray(question.visual)) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'visual-objects';
                    question.visual.forEach((obj, i) => {
                        const el = document.createElement('span');
                        el.className = 'visual-object';
                        el.textContent = obj;
                        el.style.animationDelay = `${i * 0.05}s`;
                        wrapper.appendChild(el);
                    });
                    container.appendChild(wrapper);
                }
                break;
                
            case 'equation':
                // Math equation
                if (question.visual) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'equation-visual';
                    const { a, b, operator, answer } = question.visual;
                    wrapper.innerHTML = `
                        <span class="equation-part">${a}</span>
                        <span class="equation-operator">${operator}</span>
                        <span class="equation-part">${b}</span>
                        <span class="equation-operator">=</span>
                        <span class="equation-part blank">?</span>
                    `;
                    container.appendChild(wrapper);
                }
                break;
                
            case 'missing':
                // Missing number
                if (question.visual) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'equation-visual';
                    const { a, b, operator, answer } = question.visual;
                    const missingA = question.answer === a;
                    const missingB = question.answer === b;
                    wrapper.innerHTML = `
                        <span class="equation-part ${missingA ? 'blank' : ''}">${missingA ? '?' : a}</span>
                        <span class="equation-operator">${operator}</span>
                        <span class="equation-part ${missingB ? 'blank' : ''}">${missingB ? '?' : b}</span>
                        <span class="equation-operator">=</span>
                        <span class="equation-part">${answer}</span>
                    `;
                    container.appendChild(wrapper);
                }
                break;
                
            case 'numbers':
                // Number line
                if (question.visual && question.visual.points) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'number-line';
                    question.visual.points.forEach((point, i) => {
                        const el = document.createElement('div');
                        el.className = 'number-line-point' + (point === '?' ? ' highlight' : '');
                        el.textContent = point;
                        wrapper.appendChild(el);
                    });
                    container.appendChild(wrapper);
                }
                break;
                
            case 'shapes':
                // Pattern shapes
                if (question.visual && question.visual.sequence) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'visual-objects';
                    question.visual.sequence.forEach((shape, i) => {
                        const el = document.createElement('span');
                        el.className = 'visual-object';
                        el.textContent = shape;
                        el.style.animationDelay = `${i * 0.1}s`;
                        wrapper.appendChild(el);
                    });
                    // Add question mark
                    const qEl = document.createElement('span');
                    qEl.className = 'visual-object';
                    qEl.textContent = '?';
                    qEl.style.fontSize = '3rem';
                    wrapper.appendChild(qEl);
                    container.appendChild(wrapper);
                }
                break;
                
            case 'countSides':
            case 'identify':
                // Single shape
                if (question.visual && question.visual.shape) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'visual-objects';
                    const el = document.createElement('span');
                    el.className = 'visual-object';
                    el.style.fontSize = '5rem';
                    el.textContent = question.visual.shape;
                    wrapper.appendChild(el);
                    container.appendChild(wrapper);
                }
                break;
                
            case 'text':
            default:
                // No visual for text-only questions
                container.innerHTML = '<div class="visual-placeholder">💭</div>';
                break;
        }
    }

    // Render answer options
    function renderAnswers(question) {
        const grid = elements.challenge.answersGrid;
        const numberInput = elements.challenge.numberInput;
        const dragDrop = elements.challenge.dragDrop;
        
        // Hide all answer types
        if (grid) grid.style.display = 'none';
        if (numberInput) numberInput.style.display = 'none';
        if (dragDrop) dragDrop.style.display = 'none';
        
        // Determine answer type
        if (question.type === 'wordProblems' || question.type === 'counting' || 
            question.type === 'addition' || question.type === 'subtraction' ||
            question.type === 'multiplication' || question.type === 'division' ||
            question.type === 'comparison' || question.type === 'shapes') {
            // Multiple choice
            if (grid) {
                grid.style.display = 'grid';
                grid.innerHTML = '';
                question.options.forEach((option, i) => {
                    const btn = document.createElement('button');
                    btn.className = 'answer-btn';
                    btn.dataset.value = option;
                    btn.innerHTML = `
                        <span class="answer-letter">${String.fromCharCode(65 + i)}</span>
                        <span class="answer-value">${option}</span>
                    `;
                    btn.addEventListener('click', () => submitAnswer(option));
                    grid.appendChild(btn);
                });
            }
        } else if (question.type === 'numberLine' || question.type === 'patterns') {
            // Number input
            if (numberInput) {
                numberInput.style.display = 'flex';
                renderNumberInput(question);
            }
        } else if (question.type === 'comparison' && question.subtype === 'boolean') {
            // Yes/No buttons
            if (grid) {
                grid.style.display = 'grid';
                grid.innerHTML = '';
                question.options.forEach((option, i) => {
                    const btn = document.createElement('button');
                    btn.className = 'answer-btn';
                    btn.dataset.value = option;
                    btn.innerHTML = `
                        <span class="answer-letter">${String.fromCharCode(65 + i)}</span>
                        <span class="answer-value">${option}</span>
                    `;
                    btn.addEventListener('click', () => submitAnswer(option));
                    grid.appendChild(btn);
                });
            }
        }
    }

    // Render number input
    function renderNumberInput(question) {
        const display = elements.challenge.numberDisplay;
        const keypad = elements.challenge.numberKeypad;
        
        if (display) {
            display.innerHTML = '';
            // Show empty digits based on expected answer length
            const maxDigits = String(Math.max(...question.options)).length;
            for (let i = 0; i < maxDigits; i++) {
                const digit = document.createElement('div');
                digit.className = 'number-digit empty';
                digit.textContent = '_';
                digit.dataset.index = i;
                display.appendChild(digit);
            }
        }
        
        if (keypad) {
            keypad.innerHTML = '';
            // Numbers 1-9
            for (let i = 1; i <= 9; i++) {
                const btn = document.createElement('button');
                btn.className = 'keypad-btn';
                btn.textContent = i;
                btn.dataset.value = i;
                btn.addEventListener('click', () => handleNumberInput(i));
                keypad.appendChild(btn);
            }
            // 0
            const btn0 = document.createElement('button');
            btn0.className = 'keypad-btn';
            btn0.textContent = 0;
            btn0.dataset.value = 0;
            btn0.addEventListener('click', () => handleNumberInput(0));
            keypad.appendChild(btn0);
            // Delete
            const btnDel = document.createElement('button');
            btnDel.className = 'keypad-btn delete';
            btnDel.textContent = '⌫';
            btnDel.addEventListener('click', handleNumberDelete);
            keypad.appendChild(btnDel);
            // Enter
            const btnEnter = document.createElement('button');
            btnEnter.className = 'keypad-btn action';
            btnEnter.textContent = '✓';
            btnEnter.addEventListener('click', handleNumberSubmit);
            keypad.appendChild(btnEnter);
        }
    }

    // Handle number input
    let numberInputValue = '';
    function handleNumberInput(num) {
        const display = elements.challenge.numberDisplay;
        const digits = display?.querySelectorAll('.number-digit');
        if (!digits || numberInputValue.length >= digits.length) return;
        
        numberInputValue += num;
        const digit = digits[numberInputValue.length - 1];
        if (digit) {
            digit.textContent = num;
            digit.classList.remove('empty');
            digit.classList.add('filled');
        }
        Audio.playSound('click');
    }

    function handleNumberDelete() {
        const display = elements.challenge.numberDisplay;
        const digits = display?.querySelectorAll('.number-digit');
        if (!digits || numberInputValue.length === 0) return;
        
        const digit = digits[numberInputValue.length - 1];
        if (digit) {
            digit.textContent = '_';
            digit.classList.add('empty');
            digit.classList.remove('filled');
        }
        numberInputValue = numberInputValue.slice(0, -1);
        Audio.playSound('pop');
    }

    function handleNumberSubmit() {
        if (numberInputValue === '') return;
        const answer = parseInt(numberInputValue, 10);
        numberInputValue = '';
        submitAnswer(answer);
    }

    // Start question timer
    function startQuestionTimer() {
        const timerProgress = elements.challenge.timerProgress;
        const timerText = elements.challenge.timerText;
        const timerRing = elements.challenge.timerRing;
        
        if (!timerProgress) return;
        
        const settings = Storage.getSettings();
        const difficulty = settings.difficulty || 'adaptive';
        let timeLimit = BASE_TIME_PER_QUESTION;
        
        if (difficulty === 'easy') timeLimit *= 1.5;
        else if (difficulty === 'hard') timeLimit *= 0.7;
        
        // Adjust based on question type
        if (state.currentQuestion.timeBonus) {
            timeLimit = state.currentQuestion.timeBonus;
        }
        
        const circumference = 2 * Math.PI * 26; // r=26
        timerProgress.style.strokeDasharray = circumference;
        timerProgress.style.strokeDashoffset = 0;
        timerProgress.classList.remove('warning', 'danger');
        
        let startTime = Date.now();
        
        function updateTimer() {
            if (state.isPaused || state.isAnswered) return;
            
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, timeLimit - elapsed);
            const progress = 1 - remaining / timeLimit;
            
            timerProgress.style.strokeDashoffset = circumference * progress;
            
            // Update text
            if (timerText) {
                timerText.textContent = Math.ceil(remaining / 1000);
            }
            
            // Warning states
            if (progress > 0.7 && progress <= 0.9) {
                timerProgress.classList.add('warning');
                timerProgress.classList.remove('danger');
            } else if (progress > 0.9) {
                timerProgress.classList.add('danger');
                timerProgress.classList.remove('warning');
                
                // Play danger sound every second
                if (Math.floor(remaining / 1000) !== Math.floor((remaining + 100) / 1000)) {
                    Audio.playSound('timerDanger');
                }
            } else if (progress > 0.7) {
                if (Math.floor(remaining / 1000) % 2 === 0) {
                    Audio.playSound('timerWarning');
                }
            }
            
            if (remaining <= 0) {
                timeUp();
            } else {
                timers.question = requestAnimationFrame(updateTimer);
            }
        }
        
        updateTimer();
    }

    // Time up
    function timeUp() {
        if (state.isAnswered) return;
        state.isAnswered = true;
        cancelAnimationFrame(timers.question);
        
        Audio.playSound('incorrect');
        showFeedback(false, 'Time\'s up!');
        state.heartsLost++;
        state.streak = 0;
        
        recordAnswer(false, 0);
        
        setTimeout(() => nextQuestion(), 1500);
    }

    // Submit answer
    function submitAnswer(answer) {
        if (state.isAnswered) return;
        state.isAnswered = true;
        cancelAnimationFrame(timers.question);
        
        const question = state.currentQuestion;
        const isCorrect = answer === question.answer;
        const timeSpent = Date.now() - state.questionStartTime;
        
        // Record answer
        recordAnswer(isCorrect, timeSpent);
        
        // Visual feedback
        highlightAnswer(answer, isCorrect);
        
        if (isCorrect) {
            Audio.playSound('correct');
            state.correctCount++;
            state.streak++;
            state.maxStreak = Math.max(state.maxStreak, state.streak);
            showFeedback(true, 'Correct!');
            
            // Bonus coins for streak
            if (state.streak >= 5) {
                const bonus = Math.min(state.streak * 2, 50);
                Storage.addCoins(bonus);
                showToast(`Streak bonus: +${bonus} coins!`, '💰');
            }
        } else {
            Audio.playSound('incorrect');
            state.heartsLost++;
            state.streak = 0;
            showFeedback(false, `The answer was ${question.answer}`);
            
            // Lose heart
            const heartsLeft = Storage.loseHeart();
            updateHeartsDisplay();
            
            if (heartsLeft <= 0) {
                // Game over
                setTimeout(() => finishLevel(true), 2000);
                return;
            }
        }
        
        // Update progress
        updateProgressBar();
        updateStreakDisplay();
        
        // Auto advance
        const settings = Storage.getSettings();
        const delay = settings.autoAdvance ? 1000 : 2000;
        
        timers.autoAdvance = setTimeout(() => {
            nextQuestion();
        }, delay);
    }

    // Highlight answer
    function highlightAnswer(selectedValue, isCorrect) {
        const grid = elements.challenge.answersGrid;
        if (!grid) return;
        
        const buttons = grid.querySelectorAll('.answer-btn');
        buttons.forEach(btn => {
            const value = btn.dataset.value;
            const isSelected = value == selectedValue;
            const isRight = value == state.currentQuestion.answer;
            
            btn.classList.add('disabled');
            
            if (isSelected) {
                btn.classList.add(isCorrect ? 'correct' : 'incorrect');
            }
            if (isRight && !isCorrect) {
                btn.classList.add('correct');
            }
        });
    }

    // Show feedback
    function showFeedback(correct, message) {
        state.showFeedback = true;
        state.feedbackCorrect = correct;
        
        // Create feedback overlay
        const overlay = document.createElement('div');
        overlay.className = 'feedback-overlay';
        overlay.innerHTML = `<div class="feedback-icon ${correct ? 'correct' : 'incorrect'}">${correct ? '✨' : '💥'}</div>`;
        document.body.appendChild(overlay);
        
        setTimeout(() => {
            overlay.remove();
            state.showFeedback = false;
        }, 800);
    }

    // Record answer
    function recordAnswer(correct, timeSpent) {
        const question = state.currentQuestion;
        state.answers.push({
            question: question.question,
            type: question.type,
            userAnswer: correct ? question.answer : 'wrong',
            correct: question.answer,
            isCorrect: correct,
            timeSpent
        });
        
        // Update stats
        Storage.recordAnswer(question.type, state.currentWorld, correct, timeSpent);
        
        // Update total time
        state.totalTime += timeSpent;
    }

    // Next question
    function nextQuestion() {
        clearTimeout(timers.autoAdvance);
        state.currentQuestionIndex++;
        
        if (state.currentQuestionIndex >= state.questions.length) {
            finishLevel();
        } else {
            loadQuestion();
        }
    }

    // Finish level
    function finishLevel(gameOver = false) {
        clearTimeout(timers.autoAdvance);
        cancelAnimationFrame(timers.question);
        
        const timeSpent = Date.now() - state.levelStartTime;
        const perfect = Challenges.isPerfect(state.questions, state.correctCount, state.heartsLost);
        const stars = Challenges.calculateStars(state.questions, state.correctCount, timeSpent, state.heartsLost);
        
        // Complete level in storage
        const result = Storage.completeLevel(state.currentWorld, state.currentLevel, stars, perfect, timeSpent);
        
        // Award XP and coins
        const baseXP = 10 * state.correctCount;
        const starBonus = stars * 20;
        const perfectBonus = perfect ? 50 : 0;
        const streakBonus = state.maxStreak * 2;
        const totalXP = baseXP + starBonus + perfectBonus + streakBonus;
        
        const baseCoins = 5 * state.correctCount;
        const coinBonus = stars * 10;
        const totalCoins = baseCoins + coinBonus;
        
        Storage.addXP(totalXP);
        Storage.addCoins(totalCoins);
        
        // Record perfect level
        if (perfect) {
            Storage.recordPerfectLevel();
        }
        
        // Check achievements
        checkAchievements(stars, perfect, state.maxStreak);
        
        // Update profile
        const profile = Storage.getProfile();
        
        // Refill hearts if not game over
        if (!gameOver) {
            Storage.refillHearts();
        }
        
        // Show results
        showResults({
            victory: !gameOver,
            stars,
            perfect,
            correctCount: state.correctCount,
            totalQuestions: state.questions.length,
            timeSpent,
            xpEarned: totalXP,
            coinsEarned: totalCoins,
            streak: state.maxStreak,
            level: state.currentLevel,
            world: state.currentWorld,
            gameOver
        });
        
        // Play music
        if (gameOver) {
            Audio.playSound('error');
        } else if (perfect) {
            Audio.playSound('levelUp');
        } else if (stars === 3) {
            Audio.playSound('worldComplete');
        } else {
            Audio.playSound('success');
        }
    }

    // Check achievements
    function checkAchievements(stars, perfect, maxStreak) {
        const stats = Storage.getStats();
        const profile = Storage.getProfile();
        const progress = Storage.getProgress();
        const achievements = Storage.getAchievements();
        
        const checks = [
            { id: 'first_steps', condition: progress.totalLevelsCompleted >= 1 },
            { id: 'math_novice', condition: Storage.getCompletedCount(1) >= 10 },
            { id: 'math_explorer', condition: Storage.getCompletedCount(2) >= 10 },
            { id: 'math_scholar', condition: Storage.getCompletedCount(3) >= 10 },
            { id: 'math_master', condition: Storage.getCompletedCount(4) >= 10 },
            { id: 'math_legend', condition: Storage.getCompletedCount(5) >= 10 },
            { id: 'perfect_10', condition: stats.perfectLevels >= 10 },
            { id: 'streak_10', condition: maxStreak >= 10 },
            { id: 'streak_20', condition: maxStreak >= 20 },
            { id: 'streak_50', condition: maxStreak >= 50 },
            { id: 'coin_collector', condition: profile.coins >= 1000 },
            { id: 'coin_hoarder', condition: profile.coins >= 5000 },
            { id: 'collector', condition: profile.ownedAvatars.length >= 5 }
        ];
        
        checks.forEach(check => {
            if (check.condition && achievements[check.id] && !achievements[check.id].unlocked) {
                const unlocked = Storage.unlockAchievement(check.id);
                if (unlocked) {
                    showAchievementToast(unlocked);
                    Audio.playSound('achievement');
                }
            }
        });
    }

    // Show achievement toast
    function showAchievementToast(achievement) {
        const container = elements.toasts.achievements;
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = 'achievement-toast';
        toast.innerHTML = `
            <span class="achievement-icon">${achievement.icon}</span>
            <div class="achievement-text">
                <span class="achievement-title">Achievement Unlocked</span>
                <span class="achievement-name">${achievement.name}</span>
            </div>
        `;
        
        container.appendChild(toast);
        
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // Show results screen
    function showResults(data) {
        const container = elements.results.container;
        const content = elements.results.content;
        
        if (!container || !content) return;
        
        // Set victory/defeat
        content.className = 'results-content ' + (data.victory ? 'victory' : 'defeat');
        
        // Icon
        if (elements.results.icon) {
            elements.results.icon.textContent = data.victory ? '🎉' : '😢';
        }
        
        // Title
        if (elements.results.title) {
            elements.results.title.textContent = data.victory ? 'Level Complete!' : 'Out of Hearts';
        }
        
        // Subtitle
        if (elements.results.subtitle) {
            if (data.victory) {
                elements.results.subtitle.textContent = `You got ${data.correctCount}/${data.totalQuestions} correct!`;
            } else {
                elements.results.subtitle.textContent = `You got ${data.correctCount}/${data.totalQuestions} correct. Try again!`;
            }
        }
        
        // Stats
        if (elements.results.stats) {
            elements.results.stats.innerHTML = `
                <div class="result-stat">
                    <span class="result-stat-value">${data.correctCount}/${data.totalQuestions}</span>
                    <span class="result-stat-label">Correct</span>
                </div>
                <div class="result-stat">
                    <span class="result-stat-value">${formatTime(data.timeSpent)}</span>
                    <span class="result-stat-label">Time</span>
                </div>
                <div class="result-stat">
                    <span class="result-stat-value">${data.streak}</span>
                    <span class="result-stat-label">Best Streak</span>
                </div>
            `;
        }
        
        // Stars
        if (elements.results.stars) {
            elements.results.stars.innerHTML = '';
            for (let i = 1; i <= 3; i++) {
                const star = document.createElement('span');
                star.className = 'result-star' + (i <= data.stars ? ' earned' : '');
                star.textContent = '⭐';
                elements.results.stars.appendChild(star);
            }
        }
        
        // Rewards
        if (elements.results.rewards) {
            elements.results.rewards.innerHTML = `
                <div class="reward-item">
                    <span class="reward-icon">⭐</span>
                    <span class="reward-amount">+${data.xpEarned}</span>
                    <span class="reward-label">XP</span>
                </div>
                <div class="reward-item">
                    <span class="reward-icon">💰</span>
                    <span class="reward-amount">+${data.coinsEarned}</span>
                    <span class="reward-label">Coins</span>
                </div>
            `;
        }
        
        // Actions
        if (elements.results.actions) {
            const progress = Storage.getProgress();
            const world = Challenges.getWorld(data.world);
            const isLastLevel = data.level >= world.levels;
            const isLastWorld = data.world >= 5;
            const hasNext = !isLastLevel || (!isLastWorld && progress.worlds[data.world + 1]?.unlocked);
            
            elements.results.actions.innerHTML = '';
            
            if (data.victory && hasNext) {
                const btn = document.createElement('button');
                btn.className = 'btn btn-primary btn-lg';
                btn.textContent = isLastLevel ? 'Next World' : 'Next Level';
                btn.id = 'btn-next-level';
                btn.addEventListener('click', nextLevel);
                elements.results.actions.appendChild(btn);
            }
            
            const replayBtn = document.createElement('button');
            replayBtn.className = 'btn btn-secondary btn-lg';
            replayBtn.textContent = 'Replay';
            replayBtn.id = 'btn-replay';
            replayBtn.addEventListener('click', restartLevel);
            elements.results.actions.appendChild(replayBtn);
            
            const mapBtn = document.createElement('button');
            mapBtn.className = 'btn btn-secondary btn-lg';
            mapBtn.textContent = 'Map';
            mapBtn.id = 'btn-map';
            mapBtn.addEventListener('click', quitToMap);
            elements.results.actions.appendChild(mapBtn);
        }
        
        showScreen('results');
    }

    // Next level
    function nextLevel() {
        const progress = Storage.getProgress();
        const world = Challenges.getWorld(state.currentWorld);
        
        if (state.currentLevel < world.levels) {
            state.currentLevel++;
        } else if (state.currentWorld < 5 && progress.worlds[state.currentWorld + 1]?.unlocked) {
            state.currentWorld++;
            state.currentLevel = 1;
        } else {
            // Game complete!
            showGameComplete();
            return;
        }
        
        startLevel();
    }

    // Restart level
    function restartLevel() {
        startLevel();
    }

    // Quit to map
    function quitToMap() {
        Audio.playMusic('menu');
        showScreen('map');
        updateMapUI();
    }

    // Show game complete
    function showGameComplete() {
        Audio.playSound('gameComplete');
        Audio.playMusic('victory');
        
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>🎉 Congratulations! 🎉</h2>
                <p>You've completed all worlds in Math Quest!</p>
                <p>You're a true Math Legend!</p>
                <button class="btn btn-primary btn-lg" onclick="this.closest('.modal').remove(); Game.quitToMap();">Back to Map</button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Pause game
    function pauseGame() {
        state.isPaused = true;
        Audio.pauseMusic();
        
        const modal = elements.modals.pause;
        if (modal) {
            modal.classList.add('show');
            modal.hidden = false;
        }
    }

    // Resume game
    function resumeGame() {
        state.isPaused = false;
        Audio.resumeMusic();
        
        const modal = elements.modals.pause;
        if (modal) {
            modal.classList.remove('show');
            modal.hidden = true;
        }
    }

    // Use hint
    function useHint() {
        if (state.hintUsed || !state.currentQuestion) return;
        
        const settings = Storage.getSettings();
        if (!settings.showHints) return;
        
        state.hintUsed = true;
        Storage.recordHint();
        Audio.playSound('hint');
        
        // Show hint based on question type
        let hint = '';
        const q = state.currentQuestion;
        
        switch (q.type) {
            case 'addition':
                hint = `Try counting up from ${Math.max(q.visual?.a || 0, q.visual?.b || 0)}`;
                break;
            case 'subtraction':
                hint = `Think: what plus ${q.visual?.b || 0} equals ${q.visual?.a || 0}?`;
                break;
            case 'multiplication':
                hint = `It's like adding ${q.visual?.a || 0}, ${q.visual?.b || 0} times`;
                break;
            case 'division':
                hint = `How many groups of ${q.visual?.b || 0} in ${q.visual?.a || 0}?`;
                break;
            case 'numberLine':
                hint = `The numbers go up by ${q.visual?.step || 1} each step`;
                break;
            case 'patterns':
                hint = `Look at the difference between each number`;
                break;
            case 'counting':
                hint = `Count each ${q.visual?.[0] || 'object'} one by one`;
                break;
            default:
                hint = 'Take your time and think carefully!';
        }
        
        showToast(hint, '💡');
    }

    // Show toast
    function showToast(message, icon = '') {
        const container = elements.toasts.achievements;
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = 'achievement-toast';
        toast.innerHTML = `
            <span class="achievement-icon">${icon}</span>
            <div class="achievement-text">
                <span class="achievement-name">${message}</span>
            </div>
        `;
        
        container.appendChild(toast);
        
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Show offline notice
    function showOfflineNotice() {
        const container = elements.toasts.offline;
        if (!container) return;
        
        container.innerHTML = '<div class="offline-notice">📡 You\'re offline. Progress saved locally.</div>';
    }

    function hideOfflineNotice() {
        const container = elements.toasts.offline;
        if (container) container.innerHTML = '';
    }

    // Update progress bar
    function updateProgressBar() {
        if (elements.challenge.progressBar) {
            const percent = ((state.currentQuestionIndex) / state.questions.length) * 100;
            elements.challenge.progressBar.style.width = `${percent}%`;
        }
    }

    // Update hearts display
    function updateHeartsDisplay() {
        const container = elements.challenge.hearts;
        const profile = Storage.getProfile();
        
        if (!container) return;
        
        container.innerHTML = '';
        for (let i = 0; i < profile.maxHearts; i++) {
            const heart = document.createElement('span');
            heart.className = 'heart' + (i >= profile.hearts ? ' lost' : '');
            heart.textContent = '❤️';
            container.appendChild(heart);
        }
    }

    // Update streak display
    function updateStreakDisplay() {
        const streakEl = elements.challenge.streak;
        if (!streakEl) return;
        
        if (state.streak > 0) {
            streakEl.textContent = `🔥 ${state.streak}`;
            streakEl.classList.add('active');
        } else {
            streakEl.textContent = '';
            streakEl.classList.remove('active');
        }
    }

    // Format time
    function formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Show screen
    function showScreen(screenId) {
        // Hide all screens
        Object.values(elements.screens).forEach(screen => {
            if (screen) {
                screen.classList.remove('active');
                screen.hidden = true;
            }
        });
        
        // Show target screen
        const screen = elements.screens[screenId];
        if (screen) {
            screen.hidden = false;
            requestAnimationFrame(() => {
                screen.classList.add('active');
            });
        }
        
        state.currentScreen = screenId;
        
        // Screen-specific initialization
        if (screenId === 'map') {
            updateMapUI();
        } else if (screenId === 'shop') {
            renderShop();
        } else if (screenId === 'profile') {
            renderProfile();
        } else if (screenId === 'settings') {
            applySettingsToUI();
        }
        applyLocalization();
    }

    // Render shop
    function renderShop() {
        const container = elements.shop.content;
        const profile = Storage.getProfile();
        
        if (!container) return;
        
        if (elements.shop.coins) elements.shop.coins.textContent = profile.coins;
        
        // Avatars
        const allAvatars = ['🧙‍♂️', '🧙‍♀️', '🧝‍♂️', '🧝‍♀️', '🤖', '🦸‍♂️', '🦸‍♀️', '🧚‍♂️', '🧚‍♀️', '👨‍🚀', '👩‍🚀', '🧑‍🔬', '🧛‍♂️', '🧛‍♀️', '🧟‍♂️', '🧞‍♂️', '🧜‍♂️', '🧜‍♀️', '🦹‍♂️', '🦹‍♀️'];
        const prices = [0, 50, 100, 100, 200, 300, 300, 400, 400, 500, 500, 600, 700, 700, 800, 900, 1000, 1000, 1200, 1200];
        
        let html = '<div class="shop-category"><h2>🎭 Avatars</h2><div class="shop-grid">';
        
        allAvatars.forEach((avatar, i) => {
            const price = prices[i];
            const owned = profile.ownedAvatars.includes(avatar);
            const equipped = profile.equippedAvatar === avatar;
            
            html += `
                <div class="shop-item ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''}" data-avatar="${avatar}" data-price="${price}">
                    <span class="shop-item-icon">${avatar}</span>
                    <div class="shop-item-info">
                        <span class="shop-item-name">${avatar}</span>
                        <span class="shop-item-desc">${owned ? 'Owned' : `${price} coins`}</span>
                    </div>
                    <button class="shop-item-btn ${equipped ? 'owned' : (owned ? 'equip' : 'buy')}" 
                            ${equipped || !owned ? '' : profile.coins < price ? 'disabled' : ''}
                            data-action="${equipped ? 'equipped' : (owned ? 'equip' : 'buy')}"
                            data-avatar="${avatar}">
                        ${equipped ? 'Equipped' : (owned ? 'Equip' : 'Buy')}
                    </button>
                </div>
            `;
        });
        
        html += '</div></div>';
        
        // Themes
        const themes = [
            { id: 'default', name: 'Ocean', icon: '🌊', price: 0 },
            { id: 'forest', name: 'Forest', icon: '🌲', price: 500 },
            { id: 'sky', name: 'Sky', icon: '☁️', price: 1000 },
            { id: 'ice', name: 'Ice', icon: '🧊', price: 1500 },
            { id: 'space', name: 'Space', icon: '🚀', price: 2000 },
            { id: 'colorful', name: 'Rainbow', icon: '🌈', price: 3000 }
        ];
        
        html += '<div class="shop-category"><h2>🎨 Themes</h2><div class="shop-grid">';
        
        themes.forEach(theme => {
            const owned = profile.ownedThemes.includes(theme.id);
            const equipped = profile.equippedTheme === theme.id;
            
            html += `
                <div class="shop-item ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''}" data-theme="${theme.id}" data-price="${theme.price}">
                    <span class="shop-item-icon">${theme.icon}</span>
                    <div class="shop-item-info">
                        <span class="shop-item-name">${theme.name}</span>
                        <span class="shop-item-desc">${owned ? 'Owned' : `${theme.price} coins`}</span>
                    </div>
                    <button class="shop-item-btn ${equipped ? 'owned' : (owned ? 'equip' : 'buy')}" 
                            ${equipped || !owned ? '' : profile.coins < theme.price ? 'disabled' : ''}
                            data-action="${equipped ? 'equipped' : (owned ? 'equip' : 'buy')}"
                            data-theme="${theme.id}">
                        ${equipped ? 'Active' : (owned ? 'Apply' : 'Buy')}
                    </button>
                </div>
            `;
        });
        
        html += '</div></div>';
        
        container.innerHTML = html;
        
        // Bind shop buttons
        container.querySelectorAll('.shop-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const avatar = e.target.dataset.avatar;
                const theme = e.target.dataset.theme;
                
                if (avatar) {
                    if (action === 'buy') {
                        const item = e.target.closest('.shop-item');
                        const price = parseInt(item.dataset.price);
                        if (Storage.spendCoins(price)) {
                            Storage.purchaseAvatar(avatar);
                            Audio.playSound('purchase');
                            renderShop();
                            updateMenuUI(Storage.getProfile());
                        }
                    } else if (action === 'equip') {
                        Storage.equipAvatar(avatar);
                        Audio.playSound('click');
                        renderShop();
                        updateMenuUI(Storage.getProfile());
                    }
                } else if (theme) {
                    if (action === 'buy') {
                        const item = e.target.closest('.shop-item');
                        const price = parseInt(item.dataset.price);
                        if (Storage.spendCoins(price)) {
                            Storage.purchaseTheme(theme);
                            Audio.playSound('purchase');
                            renderShop();
                        }
                    } else if (action === 'equip') {
                        Storage.equipTheme(theme);
                        Audio.playSound('click');
                        renderShop();
                        applySettingsToUI();
                    }
                }
            });
        });
    }

    // Render profile
    function renderProfile() {
        const profile = Storage.getProfile();
        const stats = Storage.getStats();
        const achievements = Storage.getAchievements();
        const progress = Storage.getProgress();
        
        // Header
        if (elements.profile.avatar) elements.profile.avatar.textContent = profile.equippedAvatar;
        if (elements.profile.name) elements.profile.name.textContent = profile.name;
        if (elements.profile.title) elements.profile.title.textContent = `Level ${profile.level} Mathematician`;
        if (elements.profile.level) elements.profile.level.textContent = profile.level;
        if (elements.profile.xp) elements.profile.xp.textContent = `${profile.xp}/${profile.xpToNext} XP`;
        if (elements.profile.xpBar) {
            elements.profile.xpBar.style.width = `${(profile.xp / profile.xpToNext) * 100}%`;
        }
        if (elements.profile.coins) elements.profile.coins.textContent = profile.coins;
        if (elements.profile.hearts) elements.profile.hearts.textContent = `${profile.hearts}/${profile.maxHearts}`;
        if (elements.profile.streak) elements.profile.streak.textContent = profile.streak;
        
        // Achievements
        if (elements.profile.achievements) {
            elements.profile.achievements.innerHTML = '';
            Object.values(achievements).forEach(a => {
                const card = document.createElement('div');
                card.className = `achievement-card ${a.unlocked ? 'unlocked' : 'locked'}`;
                card.innerHTML = `
                    <span class="achievement-icon">${a.icon}</span>
                    <span class="achievement-name">${a.name}</span>
                    <span class="achievement-desc">${a.desc}</span>
                `;
                elements.profile.achievements.appendChild(card);
            });
        }
        
        // Stats
        if (elements.profile.stats) {
            elements.profile.stats.innerHTML = `
                <div class="stat-item">
                    <span class="stat-item-value">${stats.totalQuestions}</span>
                    <span class="stat-item-label">Questions</span>
                </div>
                <div class="stat-item">
                    <span class="stat-item-value">${stats.correctAnswers}</span>
                    <span class="stat-item-label">Correct</span>
                </div>
                <div class="stat-item">
                    <span class="stat-item-value">${Math.round(stats.totalQuestions > 0 ? (stats.correctAnswers / stats.totalQuestions * 100) : 0)}%</span>
                    <span class="stat-item-label">Accuracy</span>
                </div>
                <div class="stat-item">
                    <span class="stat-item-value">${stats.perfectLevels}</span>
                    <span class="stat-item-label">Perfect Levels</span>
                </div>
                <div class="stat-item">
                    <span class="stat-item-value">${formatTime(stats.totalPlayTime * 1000)}</span>
                    <span class="stat-item-label">Play Time</span>
                </div>
                <div class="stat-item">
                    <span class="stat-item-value">${stats.sessionsPlayed}</span>
                    <span class="stat-item-label">Sessions</span>
                </div>
                <div class="stat-item">
                    <span class="stat-item-value">${stats.longestStreak}</span>
                    <span class="stat-item-label">Best Streak</span>
                </div>
                <div class="stat-item">
                    <span class="stat-item-value">${stats.coinsEarned}</span>
                    <span class="stat-item-label">Coins Earned</span>
                </div>
            `;
        }
        
        // History
        if (elements.profile.history) {
            // Would need to store history in storage
            elements.profile.history.innerHTML = '<p style="text-align:center;opacity:0.7;">History coming soon!</p>';
        }
    }

    // Apply settings to UI
    function applySettingsToUI() {
        const settings = Storage.getSettings();
        
        Object.keys(settings).forEach(key => {
            const element = elements.settings[key];
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = settings[key];
                } else {
                    element.value = settings[key];
                }
            }
        });
        applyMuteButton();
    }

    function translateText(key) {
        const settings = Storage.getSettings();
        const lang = settings.language || 'en';
        return TRANSLATIONS[lang] && TRANSLATIONS[lang][key] ? TRANSLATIONS[lang][key] : TRANSLATIONS.en[key] || key;
    }

    function applyLocalization() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            const translated = translateText(key);
            if (translated) {
                el.textContent = translated;
            }
        });

        if (elements.menu.btnMute) {
            const settings = Storage.getSettings();
            const isMuted = !settings.soundEnabled && !settings.musicEnabled;
            const btnText = elements.menu.btnMute.querySelector('.btn-text');
            if (btnText) {
                btnText.textContent = translateText(isMuted ? 'menuUnmute' : 'menuMute');
            }
            elements.menu.btnMute.setAttribute('aria-label', isMuted ? 'Ton einschalten' : 'Stummschalten');
        }
    }

    function applyMuteButton() {
        const settings = Storage.getSettings();
        const isMuted = !settings.soundEnabled && !settings.musicEnabled;
        if (elements.menu.btnMute) {
            elements.menu.btnMute.classList.toggle('muted', isMuted);
            const btnText = elements.menu.btnMute.querySelector('.btn-text');
            if (btnText) {
                btnText.textContent = translateText(isMuted ? 'menuUnmute' : 'menuMute');
            }
            elements.menu.btnMute.setAttribute('aria-label', isMuted ? 'Ton einschalten' : 'Stummschalten');
        }
    }

    function toggleMute() {
        const settings = Storage.getSettings();
        const mute = settings.soundEnabled || settings.musicEnabled;
        Storage.updateSetting('soundEnabled', !mute);
        Storage.updateSetting('musicEnabled', !mute);
        Audio.updateSettings(Storage.getSettings());
        applySettingsToUI();
        applyLocalization();
    }

    // Confirm reset progress
    function confirmResetProgress() {
        if (confirm('Are you sure you want to reset all progress? This cannot be undone!')) {
            if (confirm('Really sure? All levels, coins, and achievements will be lost!')) {
                Storage.clearAllData();
                location.reload();
            }
        }
    }

    // Export data
    function exportData() {
        const data = Storage.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mathquest-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        Audio.playSound('success');
    }

    // Import data
    function importData(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (Storage.importData(data)) {
                    alert('Data imported successfully! Reloading...');
                    location.reload();
                } else {
                    alert('Import failed. Invalid file format.');
                }
            } catch (err) {
                alert('Import failed: ' + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    // Handle keydown
    function handleKeydown(e) {
        if (state.currentScreen !== 'challenge' || state.isPaused || state.isAnswered) return;
        
        const question = state.currentQuestion;
        if (!question) return;
        
        // Number keys for multiple choice
        if (e.key >= '1' && e.key <= '4') {
            const index = parseInt(e.key) - 1;
            const grid = elements.challenge.answersGrid;
            if (grid) {
                const buttons = grid.querySelectorAll('.answer-btn');
                if (buttons[index]) {
                    buttons[index].click();
                }
            }
        }
        
        // Enter for number input
        if (e.key === 'Enter' && elements.challenge.numberInput?.style.display !== 'none') {
            handleNumberSubmit();
        }
        
        // Backspace for number input
        if (e.key === 'Backspace' && elements.challenge.numberInput?.style.display !== 'none') {
            handleNumberDelete();
        }
        
        // Escape to pause
        if (e.key === 'Escape') {
            pauseGame();
        }
        
        // H for hint
        if (e.key === 'h' || e.key === 'H') {
            useHint();
        }
    }

    // Handle visibility change
    function handleVisibilityChange() {
        if (document.hidden && state.currentScreen === 'challenge' && !state.isPaused) {
            pauseGame();
        }
    }

    // Drag and drop handlers
    let draggedItem = null;
    let dragOffset = { x: 0, y: 0 };
    
    function handleDragStart(e) {
        const item = e.target.closest('.drag-item');
        if (!item) return;
        
        draggedItem = item;
        item.classList.add('dragging');
        
        const touch = e.touches[0];
        const rect = item.getBoundingClientRect();
        dragOffset.x = touch.clientX - rect.left;
        dragOffset.y = touch.clientY - rect.top;
        
        Audio.playSound('pop');
    }
    
    function handleDragMove(e) {
        if (!draggedItem) return;
        e.preventDefault();
        
        const touch = e.touches[0];
        draggedItem.style.position = 'fixed';
        draggedItem.style.left = `${touch.clientX - dragOffset.x}px`;
        draggedItem.style.top = `${touch.clientY - dragOffset.y}px`;
        draggedItem.style.zIndex = '1000';
        draggedItem.style.pointerEvents = 'none';
        
        // Check drop zones
        const dropZones = document.querySelectorAll('.drop-zone');
        dropZones.forEach(zone => {
            const rect = zone.getBoundingClientRect();
            if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
                touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                zone.classList.add('active');
            } else {
                zone.classList.remove('active');
            }
        });
    }
    
    function handleDragEnd(e) {
        if (!draggedItem) return;
        
        const touch = e.changedTouches[0];
        let dropped = false;
        
        const dropZones = document.querySelectorAll('.drop-zone');
        dropZones.forEach(zone => {
            const rect = zone.getBoundingClientRect();
            if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
                touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                // Drop here
                zone.appendChild(draggedItem);
                zone.classList.add('filled');
                zone.classList.remove('active');
                dropped = true;
                
                // Check answer
                const value = draggedItem.textContent.trim();
                submitAnswer(value);
            } else {
                zone.classList.remove('active');
            }
        });
        
        if (!dropped) {
            // Return to original position
            draggedItem.style.position = '';
            draggedItem.style.left = '';
            draggedItem.style.top = '';
            draggedItem.style.zIndex = '';
            draggedItem.style.pointerEvents = '';
        }
        
        draggedItem.classList.remove('dragging');
        draggedItem = null;
    }

    // Public API
    return {
        init,
        showScreen,
        startLevel,
        nextLevel,
        restartLevel,
        quitToMap,
        pauseGame,
        resumeGame,
        useHint,
        getState: () => state
    };
})();

// Export for browser global usage
if (typeof window !== 'undefined') {
    window.Game = Game;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Game;
}