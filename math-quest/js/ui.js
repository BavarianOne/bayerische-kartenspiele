/**
 * Math Quest: Number Kingdom - UI Module
 * Handles UI animations, transitions, and visual effects
 */

const UI = (function() {
    'use strict';

    // Animation durations
    const DURATIONS = {
        fast: 150,
        normal: 300,
        slow: 500,
        screenTransition: 400
    };

    // Easing functions
    const EASING = {
        easeOut: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        easeIn: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
        easeInOut: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
        bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    };

    // Initialize UI
    function init() {
        // Add global styles for animations
        injectAnimationStyles();
        
        // Setup intersection observer for scroll animations
        setupScrollAnimations();
        
        // Setup reduced motion preference
        setupReducedMotion();
        
        console.log('UI initialized');
    }

    // Inject animation keyframes
    function injectAnimationStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Screen transitions */
            .screen {
                transition: opacity var(--transition-normal) var(--ease-out),
                            transform var(--transition-normal) var(--ease-out);
            }
            
            .screen:not(.active) {
                opacity: 0;
                transform: translateY(20px);
                pointer-events: none;
            }
            
            .screen.active {
                opacity: 1;
                transform: translateY(0);
                pointer-events: auto;
            }
            
            /* Button animations */
            .btn {
                transition: transform var(--transition-fast) var(--ease-out),
                            box-shadow var(--transition-fast) var(--ease-out),
                            background-color var(--transition-fast) var(--ease-out);
            }
            
            .btn:active {
                transform: scale(0.96);
            }
            
            .btn:focus-visible {
                outline: 3px solid var(--color-secondary);
                outline-offset: 3px;
            }
            
            /* Card animations */
            .card {
                transition: transform var(--transition-normal) var(--ease-out),
                            box-shadow var(--transition-normal) var(--ease-out);
            }
            
            .card:hover {
                transform: translateY(-4px);
                box-shadow: var(--shadow-lg);
            }
            
            /* Level node animations */
            .level-node {
                transition: transform var(--transition-bounce),
                            box-shadow var(--transition-normal);
            }
            
            .level-node.available:hover {
                transform: scale(1.15);
                box-shadow: var(--shadow-lg);
            }
            
            .level-node.current {
                animation: pulseRing 2s ease-in-out infinite;
            }
            
            @keyframes pulseRing {
                0%, 100% { box-shadow: 0 0 0 0 var(--color-primary); }
                50% { box-shadow: 0 0 0 12px transparent; }
            }
            
            .level-node.completed {
                animation: starPop 0.5s var(--ease-bounce) backwards;
            }
            
            @keyframes starPop {
                from { transform: scale(0); }
                to { transform: scale(1); }
            }
            
            .level-node .star {
                transition: transform var(--transition-bounce), opacity var(--transition-fast);
            }
            
            .level-node .star.filled {
                animation: starFill 0.5s var(--ease-bounce) backwards;
            }
            
            @keyframes starFill {
                0% { transform: scale(0) rotate(-180deg); opacity: 0; }
                100% { transform: scale(1) rotate(0deg); opacity: 1; }
            }
            
            /* Modal animations */
            .modal {
                opacity: 0;
                visibility: hidden;
                transition: opacity var(--transition-normal) var(--ease-out),
                            visibility var(--transition-normal) var(--ease-out);
            }
            
            .modal.show {
                opacity: 1;
                visibility: visible;
            }
            
            .modal-content {
                transform: scale(0.9) translateY(20px);
                transition: transform var(--transition-bounce);
            }
            
            .modal.show .modal-content {
                transform: scale(1) translateY(0);
            }
            
            /* Toast animations */
            .achievement-toast {
                transform: translateX(120%);
                opacity: 0;
                transition: transform var(--transition-bounce), opacity var(--transition-normal);
            }
            
            .achievement-toast.show {
                transform: translateX(0);
                opacity: 1;
            }
            
            /* Loading spinner */
            .spinner {
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            /* Pulse animation */
            .pulse {
                animation: pulse 2s ease-in-out infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            /* Shake animation */
            .shake {
                animation: shake 0.5s var(--ease-out);
            }
            
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                20% { transform: translateX(-10px); }
                40% { transform: translateX(10px); }
                60% { transform: translateX(-5px); }
                80% { transform: translateX(5px); }
            }
            
            /* Fade in/out */
            .fade-in {
                animation: fadeIn var(--transition-normal) var(--ease-out);
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .fade-out {
                animation: fadeOut var(--transition-normal) var(--ease-in);
            }
            
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            
            /* Slide animations */
            .slide-up {
                animation: slideUp var(--transition-normal) var(--ease-out);
            }
            
            @keyframes slideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .slide-down {
                animation: slideDown var(--transition-normal) var(--ease-in);
            }
            
            @keyframes slideDown {
                from { opacity: 1; transform: translateY(0); }
                to { opacity: 0; transform: translateY(20px); }
            }
            
            /* Scale animations */
            .scale-in {
                animation: scaleIn var(--transition-bounce);
            }
            
            @keyframes scaleIn {
                from { opacity: 0; transform: scale(0.8); }
                to { opacity: 1; transform: scale(1); }
            }
            
            /* Confetti */
            .confetti {
                position: fixed;
                pointer-events: none;
                z-index: 9999;
                animation: confettiFall 3s ease-out forwards;
            }
            
            @keyframes confettiFall {
                0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
                100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
            }
            
            /* Floating particles */
            .particle {
                position: absolute;
                pointer-events: none;
                animation: particleFloat 2s ease-out forwards;
            }
            
            @keyframes particleFloat {
                0% { transform: translate(0, 0) scale(1); opacity: 1; }
                100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
            }
            
            /* Progress bar animation */
            .progress-bar {
                transition: width var(--transition-normal) var(--ease-out);
            }
            
            /* Heart animations */
            .heart {
                transition: transform var(--transition-bounce), opacity var(--transition-fast);
            }
            
            .heart.lost {
                animation: heartBreak 0.5s var(--ease-out);
            }
            
            @keyframes heartBreak {
                0% { transform: scale(1); }
                50% { transform: scale(1.3); }
                100% { transform: scale(1); opacity: 0.2; }
            }
            
            /* Coin animation */
            .coin-fly {
                animation: coinFly 0.8s var(--ease-out) forwards;
            }
            
            @keyframes coinFly {
                0% { transform: translate(0, 0) scale(1); opacity: 1; }
                50% { transform: translate(var(--tx), -50px) scale(1.2); }
                100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
            }
            
            /* XP bar animation */
            .xp-bar-fill {
                transition: width var(--transition-slow) var(--ease-out);
            }
            
            /* Tab animations */
            .tab-content {
                animation: fadeIn var(--transition-fast) var(--ease-out);
            }
            
            /* Tooltip */
            .tooltip {
                opacity: 0;
                transform: translateY(10px);
                transition: opacity var(--transition-fast), transform var(--transition-fast);
            }
            
            .tooltip.show {
                opacity: 1;
                transform: translateY(0);
            }
            
            /* Badge bounce */
            .badge-bounce {
                animation: badgeBounce 0.5s var(--ease-bounce);
            }
            
            @keyframes badgeBounce {
                0% { transform: scale(1); }
                50% { transform: scale(1.3); }
                100% { transform: scale(1); }
            }
            
            /* Reduced motion */
            @media (prefers-reduced-motion: reduce) {
                *, *::before, *::after {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                }
            }
            
            .reduced-motion *, .reduced-motion *::before, .reduced-motion *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Setup scroll animations
    function setupScrollAnimations() {
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate-in');
                    }
                });
            }, { threshold: 0.1, rootMargin: '50px' });
            
            document.querySelectorAll('.animate-on-scroll').forEach(el => {
                observer.observe(el);
            });
        }
    }

    // Setup reduced motion
    function setupReducedMotion() {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handleChange = (e) => {
            document.body.classList.toggle('reduced-motion', e.matches);
        };
        mediaQuery.addEventListener('change', handleChange);
        handleChange(mediaQuery);
    }

    // Screen transition
    function transitionScreen(fromScreen, toScreen, options = {}) {
        const { direction = 'forward', duration = DURATIONS.screenTransition } = options;
        
        return new Promise(resolve => {
            const fromEl = document.getElementById(fromScreen);
            const toEl = document.getElementById(toScreen);
            
            if (!fromEl || !toEl) {
                resolve();
                return;
            }
            
            // Prepare target screen
            toEl.hidden = false;
            toEl.style.zIndex = '10';
            fromEl.style.zIndex = '5';
            
            // Animate
            const translateX = direction === 'forward' ? '-100%' : '100%';
            
            fromEl.style.transition = `transform ${duration}ms var(--ease-in-out)`;
            toEl.style.transition = `transform ${duration}ms var(--ease-in-out)`;
            toEl.style.transform = direction === 'forward' ? 'translateX(100%)' : 'translateX(-100%)';
            
            requestAnimationFrame(() => {
                fromEl.style.transform = `translateX(${translateX})`;
                toEl.style.transform = 'translateX(0)';
            });
            
            setTimeout(() => {
                fromEl.hidden = true;
                fromEl.classList.remove('active');
                fromEl.style.transform = '';
                fromEl.style.zIndex = '';
                fromEl.style.transition = '';
                
                toEl.classList.add('active');
                toEl.style.zIndex = '';
                toEl.style.transition = '';
                
                resolve();
            }, duration);
        });
    }

    // Show element with animation
    function show(element, animation = 'fadeIn') {
        if (!element) return Promise.resolve();
        
        element.hidden = false;
        element.style.display = '';
        
        return animate(element, animation);
    }

    // Hide element with animation
    function hide(element, animation = 'fadeOut') {
        if (!element) return Promise.resolve();
        
        return animate(element, animation).then(() => {
            element.hidden = true;
            element.style.display = 'none';
        });
    }

    // Animate element
    function animate(element, animation, duration = DURATIONS.normal) {
        return new Promise(resolve => {
            if (!element) {
                resolve();
                return;
            }
            
            const animationClass = typeof animation === 'string' ? animation : 'custom';
            
            if (typeof animation === 'string') {
                element.classList.add(animation);
            }
            
            const handleEnd = () => {
                element.classList.remove(animation);
                element.removeEventListener('animationend', handleEnd);
                resolve();
            };
            
            element.addEventListener('animationend', handleEnd);
            
            // Fallback
            setTimeout(handleEnd, duration + 100);
        });
    }

    // Create confetti
    function createConfetti(x, y, count = 50) {
        const colors = ['#4ecdc4', '#ffeaa7', '#a29bfe', '#ff6b6b', '#7fb069', '#81ecec'];
        const shapes = ['●', '■', '▲', '★', '♥', '◆'];
        
        for (let i = 0; i < count; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.textContent = shapes[Math.floor(Math.random() * shapes.length)];
            confetti.style.left = `${x}px`;
            confetti.style.top = `${y}px`;
            confetti.style.color = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.fontSize = `${Math.random() * 1 + 0.8}rem`;
            confetti.style.setProperty('--tx', `${(Math.random() - 0.5) * 400}px`);
            confetti.style.animationDelay = `${Math.random() * 0.5}s`;
            confetti.style.animationDuration = `${2 + Math.random() * 2}s`;
            
            document.body.appendChild(confetti);
            
            setTimeout(() => confetti.remove(), 5000);
        }
    }

    // Create particles
    function createParticles(x, y, count = 20, color = '#4ecdc4') {
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = `${x}px`;
            particle.style.top = `${y}px`;
            particle.style.width = `${Math.random() * 8 + 4}px`;
            particle.style.height = particle.style.width;
            particle.style.background = color;
            particle.style.borderRadius = '50%';
            particle.style.setProperty('--tx', `${(Math.random() - 0.5) * 200}px`);
            particle.style.setProperty('--ty', `${(Math.random() - 0.5) * 200}px`);
            
            document.body.appendChild(particle);
            
            setTimeout(() => particle.remove(), 2000);
        }
    }

    // Animate coin flying to counter
    function animateCoinFly(fromElement, toElement, count = 1) {
        const fromRect = fromElement.getBoundingClientRect();
        const toRect = toElement.getBoundingClientRect();
        
        const startX = fromRect.left + fromRect.width / 2;
        const startY = fromRect.top + fromRect.height / 2;
        const endX = toRect.left + toRect.width / 2;
        const endY = toRect.top + toRect.height / 2;
        
        for (let i = 0; i < count; i++) {
            const coin = document.createElement('div');
            coin.className = 'coin-fly';
            coin.textContent = '💰';
            coin.style.left = `${startX}px`;
            coin.style.top = `${startY}px`;
            coin.style.fontSize = '1.5rem';
            coin.style.setProperty('--tx', `${endX - startX}px`);
            coin.style.setProperty('--ty', `${endY - startY}px`);
            coin.style.animationDelay = `${i * 0.1}s`;
            
            document.body.appendChild(coin);
            
            setTimeout(() => coin.remove(), 800);
        }
    }

    // Animate XP bar
    function animateXPBar(barElement, fromPercent, toPercent, duration = 1000) {
        if (!barElement) return Promise.resolve();
        
        return new Promise(resolve => {
            const start = Date.now();
            const animate = () => {
                const elapsed = Date.now() - start;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
                const current = fromPercent + (toPercent - fromPercent) * eased;
                
                barElement.style.width = `${current}%`;
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            animate();
        });
    }

    // Animate number counting
    function animateNumber(element, from, to, duration = 1000, formatter = n => n) {
        if (!element) return Promise.resolve();
        
        return new Promise(resolve => {
            const start = Date.now();
            const animate = () => {
                const elapsed = Date.now() - start;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = Math.round(from + (to - from) * eased);
                
                element.textContent = formatter(current);
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    element.textContent = formatter(to);
                    resolve();
                }
            };
            animate();
        });
    }

    // Shake element
    function shake(element, intensity = 10) {
        if (!element) return;
        
        element.style.animation = 'none';
        element.offsetHeight; // Force reflow
        element.style.animation = `shake 0.5s var(--ease-out)`;
        element.style.setProperty('--shake-intensity', `${intensity}px`);
    }

    // Pulse element
    function pulse(element, times = 1) {
        if (!element) return;
        
        let count = 0;
        const originalAnimation = element.style.animation;
        
        function doPulse() {
            element.style.animation = 'pulse 0.5s var(--ease-out)';
            
            setTimeout(() => {
                element.style.animation = originalAnimation;
                count++;
                if (count < times) {
                    setTimeout(doPulse, 100);
                }
            }, 500);
        }
        
        doPulse();
    }

    // Create ripple effect
    function createRipple(element, x, y) {
        if (!element) return;
        
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${x - rect.left - size / 2}px`;
        ripple.style.top = `${y - rect.top - size / 2}px`;
        
        element.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 600);
    }

    // Show tooltip
    function showTooltip(element, text, position = 'top') {
        if (!element) return;
        
        let tooltip = element.querySelector('.tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            element.appendChild(tooltip);
        }
        
        tooltip.textContent = text;
        tooltip.className = `tooltip ${position}`;
        
        requestAnimationFrame(() => {
            tooltip.classList.add('show');
        });
    }

    // Hide tooltip
    function hideTooltip(element) {
        if (!element) return;
        
        const tooltip = element.querySelector('.tooltip');
        if (tooltip) {
            tooltip.classList.remove('show');
        }
    }

    // Staggered animation for lists
    function staggerAnimate(elements, animation = 'slideUp', delay = 100) {
        elements.forEach((el, i) => {
            setTimeout(() => {
                animate(el, animation);
            }, i * delay);
        });
    }

    // Parallax effect
    function parallax(element, speed = 0.5) {
        if (!element) return;
        
        const handleScroll = () => {
            const scrolled = window.pageYOffset;
            element.style.transform = `translateY(${scrolled * speed}px)`;
        };
        
        window.addEventListener('scroll', handleScroll, { passive: true });
        
        return () => window.removeEventListener('scroll', handleScroll);
    }

    // Public API
    return {
        init,
        transitionScreen,
        show,
        hide,
        animate,
        createConfetti,
        createParticles,
        animateCoinFly,
        animateXPBar,
        animateNumber,
        shake,
        pulse,
        createRipple,
        showTooltip,
        hideTooltip,
        staggerAnimate,
        parallax,
        DURATIONS,
        EASING
    };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UI;
}