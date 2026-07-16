/**
 * Math Quest: Number Kingdom - Map Module
 * Handles world map rendering, navigation, and level selection
 */

const Map = (function() {
    'use strict';

    // Map state
    let state = {
        currentWorld: 1,
        isAnimating: false
    };

    // World themes for map styling
    const WORLD_THEMES = {
        1: {
            id: 1,
            name: 'Ocean Cove',
            theme: 'ocean',
            color: '#4ecdc4',
            bgColor: '#e0f7fa',
            gradient: 'linear-gradient(180deg, #e0f7fa 0%, #b2ebf2 100%)',
            decorations: ['🐠', '🐟', '🦀', '🐙', '🐚', '🦑', '🐡', '🦐', '🦞', '🪸'],
            particleColor: '#4ecdc4',
            music: 'world1'
        },
        2: {
            id: 2,
            name: 'Number Forest',
            theme: 'forest',
            color: '#7fb069',
            bgColor: '#e8f5e9',
            gradient: 'linear-gradient(180deg, #e8f5e9 0%, #c8e6c9 100%)',
            decorations: ['🌲', '🌳', '🍄', '🌰', '🍂', '🌿', '🍃', '🌱', '🌻', '🌸'],
            particleColor: '#7fb069',
            music: 'world2'
        },
        3: {
            id: 3,
            name: 'Cloud Kingdom',
            theme: 'sky',
            color: '#ffeaa7',
            bgColor: '#fffde7',
            gradient: 'linear-gradient(180deg, #fffde7 0%, #fff9c4 100%)',
            decorations: ['☁️', '⭐', '🌙', '☀️', '🌈', '✨', '🎈', '🪁', '🕊️', '🦋'],
            particleColor: '#ffeaa7',
            music: 'world3'
        },
        4: {
            id: 4,
            name: 'Ice Palace',
            theme: 'ice',
            color: '#81ecec',
            bgColor: '#e0f7fa',
            gradient: 'linear-gradient(180deg, #e0f7fa 0%, #b2ebf2 100%)',
            decorations: ['❄️', '🧊', '🐧', '⛄', '🎿', '🧤', '🧣', '🧥', '🌨️', '🏔️'],
            particleColor: '#81ecec',
            music: 'world4'
        },
        5: {
            id: 5,
            name: 'Space Station',
            theme: 'space',
            color: '#a29bfe',
            bgColor: '#ede7f6',
            gradient: 'linear-gradient(180deg, #ede7f6 0%, #d1c4e9 100%)',
            decorations: ['🚀', '🪐', '👽', '🛸', '🌟', '🌌', '🛰️', '🔭', '👨‍🚀', '👩‍🚀'],
            particleColor: '#a29bfe',
            music: 'world5'
        }
    };

    // DOM elements
    let elements = {};

    // Initialize map
    function init() {
        cacheElements();
        bindEvents();
        console.log('Map module initialized');
    }

    // Cache DOM elements
    function cacheElements() {
        elements = {
            scene: document.getElementById('map-scene'),
            path: document.getElementById('map-path'),
            decorations: document.getElementById('map-decorations'),
            levels: document.getElementById('map-levels'),
            worldName: document.getElementById('map-world-name'),
            worldProgress: document.getElementById('map-world-progress'),
            progressBar: document.getElementById('map-progress-bar'),
            coins: document.getElementById('map-coins'),
            hearts: document.getElementById('map-hearts'),
            btnPrev: document.getElementById('btn-prev-world'),
            btnNext: document.getElementById('btn-next-world'),
            btnBack: document.getElementById('btn-map-back')
        };
    }

    // Bind events
    function bindEvents() {
        if (elements.btnPrev) {
            elements.btnPrev.addEventListener('click', () => changeWorld(-1));
        }
        if (elements.btnNext) {
            elements.btnNext.addEventListener('click', () => changeWorld(1));
        }
        if (elements.btnBack) {
            elements.btnBack.addEventListener('click', () => Game.showScreen('menu'));
        }

        // Keyboard navigation
        document.addEventListener('keydown', handleKeydown);

        // Touch swipe for world change
        let touchStartX = 0;
        elements.scene?.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        }, { passive: true });

        elements.scene?.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchStartX - touchEndX;
            if (Math.abs(diff) > 50) {
                changeWorld(diff > 0 ? 1 : -1);
            }
        }, { passive: true });
    }

    // Handle keydown
    function handleKeydown(e) {
        if (Game.getState().currentScreen !== 'map') return;
        
        if (e.key === 'ArrowLeft') {
            changeWorld(-1);
        } else if (e.key === 'ArrowRight') {
            changeWorld(1);
        } else if (e.key === 'Escape') {
            Game.showScreen('menu');
        }
    }

    // Change world
    function changeWorld(direction) {
        if (state.isAnimating) return;
        
        const newWorld = state.currentWorld + direction;
        if (newWorld < 1 || newWorld > 5) return;
        
        const progress = Storage.getProgress();
        if (direction > 0 && !progress.worlds[newWorld]?.unlocked) {
            // Show locked feedback
            UI.shake(elements.btnNext);
            Audio.playSound('error');
            return;
        }
        
        state.isAnimating = true;
        state.currentWorld = newWorld;
        
        // Animate transition
        animateWorldTransition(direction > 0 ? 'left' : 'right').then(() => {
            renderMap();
            updateMapUI();
            state.isAnimating = false;
        });
        
        Audio.playSound('whoosh');
    }

    // Animate world transition
    function animateWorldTransition(direction) {
        return new Promise(resolve => {
            const scene = elements.scene;
            const levels = elements.levels;
            const path = elements.path;
            const decorations = elements.decorations;
            
            if (!scene) {
                resolve();
                return;
            }
            
            const translateX = direction === 'left' ? '-100%' : '100%';
            const enterX = direction === 'left' ? '100%' : '-100%';
            
            // Prepare containers
            [levels, path, decorations].forEach(el => {
                if (el) {
                    el.style.transition = 'transform 400ms var(--ease-in-out)';
                    el.style.transform = `translateX(${translateX})`;
                }
            });
            
            // Fade out world name
            if (elements.worldName) {
                elements.worldName.style.transition = 'opacity 200ms, transform 200ms';
                elements.worldName.style.opacity = '0';
                elements.worldName.style.transform = `translateX(${translateX})`;
            }
            
            setTimeout(() => {
                // Update world class
                scene.className = 'map-scene';
                scene.classList.add(`world-${state.currentWorld}`);
                
                // Reset positions for entering
                [levels, path, decorations].forEach(el => {
                    if (el) {
                        el.style.transform = `translateX(${enterX})`;
                    }
                });
                
                if (elements.worldName) {
                    elements.worldName.style.transform = `translateX(${enterX})`;
                }
                
                // Force reflow
                scene.offsetHeight;
                
                // Animate in
                [levels, path, decorations].forEach(el => {
                    if (el) {
                        el.style.transform = 'translateX(0)';
                    }
                });
                
                if (elements.worldName) {
                    elements.worldName.style.opacity = '1';
                    elements.worldName.style.transform = 'translateX(0)';
                }
                
                setTimeout(() => {
                    [levels, path, decorations, elements.worldName].forEach(el => {
                        if (el) {
                            el.style.transition = '';
                            el.style.transform = '';
                        }
                    });
                    resolve();
                }, 400);
            }, 400);
        });
    }

    // Render map for current world
    function renderMap() {
        const world = WORLD_THEMES[state.currentWorld];
        const progress = Storage.getProgress();
        const worldProgress = progress.worlds[state.currentWorld] || { levels: {} };
        
        if (!elements.scene) return;
        
        // Clear containers
        if (elements.levels) elements.levels.innerHTML = '';
        if (elements.decorations) elements.decorations.innerHTML = '';
        if (elements.path) elements.path.innerHTML = '';
        
        // Apply world theme
        elements.scene.className = 'map-scene';
        elements.scene.classList.add(`world-${world.id}`);
        elements.scene.style.background = world.gradient;
        
        // Update world name
        if (elements.worldName) {
            elements.worldName.textContent = world.name;
            elements.worldName.style.color = world.color;
        }
        
        // Generate path
        generatePath(world, worldProgress);
        
        // Generate decorations
        generateDecorations(world);
        
        // Generate level nodes
        for (let i = 1; i <= 10; i++) {
            const levelData = worldProgress.levels[i] || {};
            const unlocked = i === 1 || (worldProgress.levels[i - 1]?.completed || false);
            const completed = levelData.completed || false;
            const stars = levelData.stars || 0;
            const isCurrent = (Game.getState().currentLevel === i && 
                              Game.getState().currentWorld === world.id && 
                              !completed);
            
            createLevelNode(i, unlocked, completed, stars, isCurrent, world);
        }
        
        // Scroll to current level
        scrollToCurrentLevel();
    }

    // Generate SVG path
    function generatePath(world, worldProgress) {
        const container = elements.path;
        if (!container) return;
        
        const scene = elements.scene;
        const width = scene.clientWidth || 320;
        const height = scene.clientHeight || 500;
        
        // Create curved path through levels
        const points = [];
        const padding = 40;
        const usableHeight = height - padding * 2;
        const stepY = usableHeight / 9; // 10 levels = 9 segments
        
        for (let i = 0; i < 10; i++) {
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
        
        // Determine completed progress for path coloring
        const completedCount = Object.values(worldProgress.levels).filter(l => l.completed).length;
        const progressPercent = completedCount / 10;
        
        container.innerHTML = `
            <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                <!-- Background path -->
                <path class="path-bg" d="${pathD}" stroke="${world.color}44" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                <!-- Progress path -->
                <path class="path-progress" d="${pathD}" stroke="${world.color}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1000" stroke-dashoffset="1000"/>
                <!-- Glow path -->
                <path class="path-glow" d="${pathD}" stroke="${world.color}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.3" filter="blur(4px)"/>
            </svg>
        `;
        
        // Animate progress path
        requestAnimationFrame(() => {
            const progressPath = container.querySelector('.path-progress');
            if (progressPath) {
                const length = progressPath.getTotalLength();
                progressPath.style.strokeDasharray = length;
                progressPath.style.strokeDashoffset = length;
                progressPath.getBoundingClientRect(); // Force reflow
                progressPath.style.transition = 'stroke-dashoffset 1.5s ease-out';
                progressPath.style.strokeDashoffset = length * (1 - progressPercent);
            }
        });
    }

    // Generate decorations
    function generateDecorations(world) {
        const container = elements.decorations;
        if (!container) return;
        
        const scene = elements.scene;
        const width = scene.clientWidth || 320;
        const height = scene.clientHeight || 500;
        
        // Create more decorations for richer feel
        for (let i = 0; i < 12; i++) {
            const deco = document.createElement('div');
            deco.className = 'map-decoration';
            deco.textContent = world.decorations[Math.floor(Math.random() * world.decorations.length)];
            deco.style.left = `${Math.random() * (width - 80) + 40}px`;
            deco.style.top = `${Math.random() * (height - 80) + 40}px`;
            deco.style.animationDelay = `${Math.random() * 30}s`;
            deco.style.fontSize = `${Math.random() * 2 + 1.5}rem`;
            deco.style.opacity = `${0.3 + Math.random() * 0.4}`;
            container.appendChild(deco);
        }
        
        // Add some floating particles
        createFloatingParticles(world);
    }

    // Create floating particles
    function createFloatingParticles(world) {
        const container = elements.decorations;
        if (!container) return;
        
        for (let i = 0; i < 8; i++) {
            const particle = document.createElement('div');
            particle.className = 'map-particle';
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            particle.style.width = `${Math.random() * 6 + 4}px`;
            particle.style.height = particle.style.width;
            particle.style.background = world.particleColor;
            particle.style.borderRadius = '50%';
            particle.style.animationDelay = `${Math.random() * 10}s`;
            particle.style.animationDuration = `${15 + Math.random() * 10}s`;
            container.appendChild(particle);
        }
    }

    // Create level node
    function createLevelNode(level, unlocked, completed, stars, isCurrent, world) {
        const container = elements.levels;
        if (!container) return;
        
        const scene = elements.scene;
        const width = scene.clientWidth || 320;
        const height = scene.clientHeight || 500;
        const padding = 40;
        const usableHeight = height - padding * 2;
        const stepY = usableHeight / 9;
        
        const x = width / 2 + Math.sin((level - 1) * 0.5) * (width * 0.25);
        const y = padding + (level - 1) * stepY;
        
        const node = document.createElement('button');
        node.className = 'level-node';
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.dataset.level = level;
        node.setAttribute('aria-label', `Level ${level}${completed ? ', completed' : unlocked ? ', available' : ', locked'}`);
        
        if (!unlocked) {
            node.classList.add('locked');
            node.disabled = true;
            node.innerHTML = `
                <span class="lock-icon">🔒</span>
                <span class="level-number">${level}</span>
            `;
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
        starsEl.setAttribute('aria-hidden', 'true');
        for (let s = 1; s <= 3; s++) {
            const star = document.createElement('span');
            star.className = 'star' + (s <= stars ? ' filled' : '');
            star.textContent = '⭐';
            star.style.animationDelay = `${s * 0.1}s`;
            starsEl.appendChild(star);
        }
        node.appendChild(starsEl);
        
        // Perfect badge
        const levelData = Storage.getProgress().worlds[world.id]?.levels[level];
        if (levelData?.perfect) {
            const badge = document.createElement('span');
            badge.className = 'perfect-badge';
            badge.textContent = '✨';
            badge.setAttribute('aria-label', 'Perfect level');
            node.appendChild(badge);
        }
        
        // Click handler
        if (unlocked && !completed) {
            node.addEventListener('click', () => selectLevel(level));
            node.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectLevel(level);
                }
            });
        }
        
        // Add entrance animation
        node.style.opacity = '0';
        node.style.transform = 'scale(0.5) translateY(20px)';
        container.appendChild(node);
        
        // Staggered animation
        setTimeout(() => {
            node.style.transition = 'opacity 0.4s var(--ease-bounce), transform 0.4s var(--ease-bounce)';
            node.style.opacity = '1';
            node.style.transform = 'scale(1) translateY(0)';
        }, level * 80);
        
        return node;
    }

    // Scroll to current level
    function scrollToCurrentLevel() {
        const scene = elements.scene;
        const currentNode = scene?.querySelector('.level-node.current');
        if (currentNode && scene) {
            currentNode.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }

    // Select level
    function selectLevel(level) {
        if (state.isAnimating) return;
        
        const node = elements.levels?.querySelector(`[data-level="${level}"]`);
        if (node) {
            // Click animation
            node.style.transform = 'scale(0.9)';
            setTimeout(() => {
                node.style.transform = '';
            }, 100);
        }
        
        Audio.playSound('click');
        
        // Start level after brief delay
        setTimeout(() => {
            Game.getState().currentLevel = level;
            Game.startLevel();
        }, 200);
    }

    // Update map UI (stats, progress)
    function updateMapUI() {
        const world = WORLD_THEMES[state.currentWorld];
        const progress = Storage.getProgress();
        const worldProgress = progress.worlds[state.currentWorld] || { levels: {} };
        const profile = Storage.getProfile();
        
        // Progress text
        const completed = Object.values(worldProgress.levels).filter(l => l.completed).length;
        const total = 10;
        
        if (elements.worldProgress) {
            elements.worldProgress.textContent = `${completed}/${total} levels completed`;
        }
        
        // Progress bar
        if (elements.progressBar) {
            const percent = (completed / total) * 100;
            elements.progressBar.style.width = `${percent}%`;
        }
        
        // Stats
        if (elements.coins) elements.coins.textContent = profile.coins;
        if (elements.hearts) elements.hearts.textContent = `${profile.hearts}/${profile.maxHearts}`;
        
        // Navigation buttons
        if (elements.btnPrev) {
            elements.btnPrev.disabled = state.currentWorld === 1;
            elements.btnPrev.style.opacity = state.currentWorld === 1 ? '0.4' : '1';
        }
        if (elements.btnNext) {
            const nextLocked = state.currentWorld === 5 || !progress.worlds[state.currentWorld + 1]?.unlocked;
            elements.btnNext.disabled = nextLocked;
            elements.btnNext.style.opacity = nextLocked ? '0.4' : '1';
        }
    }

    // Show map screen
    function show() {
        state.currentWorld = Game.getState().currentWorld;
        renderMap();
        updateMapUI();
    }

    // Get current world
    function getCurrentWorld() {
        return state.currentWorld;
    }

    // Public API
    return {
        init,
        show,
        renderMap,
        updateMapUI,
        changeWorld,
        selectLevel,
        getCurrentWorld,
        WORLD_THEMES
    };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Map;
}