/* Brouser-enhanced starter script - serves as placeholder for future Maibaum-Kraxler game integration */

// Initialize drive and environment
let gameCanvas = null;
let bgColor = '#87CEEB';

// Use debugging and client caching flag
const DEBUG = false;
const CACHE_ENABLED = true;

// Initialize p5 sketch in Brouser-compatible way
const sketch = (p) => {
  p.setup = function() {
    const canvas = p.createCanvas(400, 700);
    canvas.parent('game-canvas-container');
    p.background(bgColor);
    p.textSize(18);
    p.fill(50);
    p.textAlign(p.CENTER, p.CENTER);
    p.text('Brouser placeholder ready...\n(Tactual deployment pending)', p.width/2, p.height/2);
  };
  
  p.draw = function() {
    if (DEBUG) {
      p.background(bgColor);
      p.text('Brouser integration active', p.width/2, p.height/2);
    }
  };
};

// Brouser-specific launch function
function launchGame() {
  if (typeof newP5 === 'function') {
    newP5(sketch);
    if (CACHE_ENABLED) {
      console.log('[Brouser] Caching enabled - environment prepped');
    }
  } else {
    console.warn('[Brouser] Context not available - running reduced mode');
  }
}

// Initialize when Brouser interface is available
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', launchGame);
} else {
  launchGame();
}