#!/usr/bin/env node
/**
 * Puppeteer test script for bayerische-kartenspiele
 * Uses system Chromium at /usr/bin/chromium
 */

const puppeteer = require('puppeteer-core');
const path = require('path');

const GAMES = [
  { file: 'flappy-bird.html', name: 'Flappy Bird', checks: ['canvas', 'score', 'gameOver'] },
  { file: 'towers-of-hanoi-2d.html', name: 'Türme von Hanoi 2D', checks: ['canvas', 'moveCount', 'diskCount'] },
  { file: 'towers-of-hanoi-3d.html', name: 'Türme von Hanoi 3D', checks: ['canvas', 'moveCount'] },
  { file: 'sternhimmel.html', name: 'Sternenhimmel', checks: ['canvas', 'stars'] },
];

const HUB_PAGES = [
  { file: 'index.html', name: 'Main Hub', checks: ['game-card', 'category'] },
];

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-web-security',
  '--allow-file-access-from-files',
];

async function testGame(browser, game, baseUrl) {
  const url = `${baseUrl}/${game.file}`;
  console.log(`\n🧪 Testing: ${game.name} (${url})`);
  
  const page = await browser.newPage();
  const errors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`Console error: ${msg.text()}`);
    } else if (game.file === 'sternhimmel.html') {
      console.log(`  [Console ${msg.type()}]: ${msg.text()}`);
    }
  });
  
  page.on('pageerror', error => {
    errors.push(`Page error: ${error.message}`);
  });

  try {
    const timeout = game.file === 'sternhimmel.html' ? 90000 : 30000;
    const waitUntil = game.file === 'sternhimmel.html' ? 'domcontentloaded' : 'networkidle0';
    await page.goto(url, { waitUntil, timeout });
    
    await new Promise(r => setTimeout(r, game.file === 'sternhimmel.html' ? 5000 : 1000));
    
    // Force at least one render frame for Sternenhimmel
    if (game.file === 'sternhimmel.html') {
      await page.evaluate(() => {
        return new Promise(resolve => {
          if (typeof render === 'function') {
            console.log('Calling render()...');
            try {
              render();
              console.log('render() returned successfully');
            } catch (e) {
              console.error('render() threw:', e.message);
            }
          }
          requestAnimationFrame(resolve);
        });
      });
      await new Promise(r => setTimeout(r, 500));
    }
    
    const canvas = await page.$('canvas');
    if (!canvas) {
      errors.push('No <canvas> element found');
    } else {
      console.log('  ✓ Canvas found');
      
      const dimensions = await canvas.evaluate(el => ({
        width: el.width,
        height: el.height,
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight
      }));
      console.log(`  ✓ Canvas size: ${dimensions.width}x${dimensions.height} (CSS: ${dimensions.clientWidth}x${dimensions.clientHeight})`);
      
      if (dimensions.width === 0 || dimensions.height === 0) {
        errors.push('Canvas has zero dimensions');
      }
    }
    
    if (game.file === 'flappy-bird.html') {
      const score = await page.$('#currentScore');
      if (score) console.log('  ✓ Score element found');
      const state = await page.evaluate(() => window.state);
      console.log(`  ✓ Game state: ${state}`);
    }
    
    if (game.file === 'towers-of-hanoi-2d.html') {
      const moveCount = await page.$('#moveCount');
      const diskCount = await page.$('#diskCount');
      if (moveCount) console.log('  ✓ Move counter found');
      if (diskCount) console.log('  ✓ Disk counter found');
    }
    
    if (game.file === 'sternhimmel.html') {
      // Check stars are being rendered (canvas not white)
      const pixelData = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        const bufW = canvas.width;
        const bufH = canvas.height;
        const imgData = ctx.getImageData(0, 0, bufW, bufH);
        let darkPixels = 0, lightPixels = 0, midPixels = 0;
        for (let i = 0; i < imgData.data.length; i += 4) {
          const r = imgData.data[i];
          const g = imgData.data[i+1];
          const b = imgData.data[i+2];
          const brightness = (r + g + b) / 3;
          if (brightness < 50) darkPixels++;
          else if (brightness > 200) lightPixels++;
          else midPixels++;
        }
        return { darkPixels, lightPixels, midPixels, total: imgData.data.length / 4 };
      });
      console.log(`  ✓ Canvas pixels: ${pixelData.darkPixels} dark, ${pixelData.midPixels} mid, ${pixelData.lightPixels} light / ${pixelData.total} total`);
      
      if (pixelData.darkPixels + pixelData.midPixels < pixelData.total * 0.8) {
        errors.push('Background not dark enough - expected night sky');
      } else {
        console.log('  ✓ Dark night sky background detected');
      }
      
      // Debug: step through render function manually
      const renderDebug = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#030310';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        let pixel = ctx.getImageData(canvas.width/2, canvas.height/2, 1, 1).data;
        const afterClear = `rgba(${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3]})`;
        
        if (typeof drawBackground === 'function') {
          drawBackground();
          pixel = ctx.getImageData(canvas.width/2, canvas.height/2, 1, 1).data;
        }
        const afterDrawBg = `rgba(${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3]})`;
        
        if (typeof drawStars === 'function') {
          const lst = typeof localSiderealTime === 'function' 
            ? localSiderealTime(new Date().getTime()/86400000 + 2440587.5, 0.202) 
            : 0;
          drawStars(lst);
          pixel = ctx.getImageData(canvas.width/2, canvas.height/2, 1, 1).data;
        }
        const afterDrawStars = `rgba(${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3]})`;
        
        return { afterClear, afterDrawBg, afterDrawStars };
      });
      console.log(`  ✓ Render steps: ${JSON.stringify(renderDebug)}`);
    }
    
    if (errors.length === 0) {
      console.log(`  ✅ ${game.name} - PASSED`);
      return { passed: true, errors: [] };
    } else {
      console.log(`  ❌ ${game.name} - FAILED: ${errors.join('; ')}`);
      return { passed: false, errors };
    }
    
  } catch (err) {
    errors.push(`Navigation/load error: ${err.message}`);
    console.log(`  ❌ ${game.name} - ERROR: ${err.message}`);
    return { passed: false, errors };
  } finally {
    await page.close();
  }
}

async function testHubPage(browser, hub, baseUrl) {
  const url = `${baseUrl}/${hub.file}`;
  console.log(`\n🧪 Testing Hub: ${hub.name} (${url})`);
  
  const page = await browser.newPage();
  const errors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`Console error: ${msg.text()}`);
    }
  });
  
  page.on('pageerror', error => {
    errors.push(`Page error: ${error.message}`);
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));
    
    const gameCards = await page.$$('.game-card');
    console.log(`  ✓ Found ${gameCards.length} game cards`);
    if (gameCards.length === 0) {
      errors.push('No game cards found in index.html');
    }
    
    const categories = await page.$$('.category-section');
    console.log(`  ✓ Found ${categories.length} categories`);
    
    const fontLoaded = await page.evaluate(() => {
      return document.fonts.check('1rem "Fredoka"');
    });
    console.log(`  ✓ Font loaded: ${fontLoaded}`);
    
    if (errors.length === 0) {
      console.log(`  ✅ ${hub.name} - PASSED`);
      return { passed: true, errors: [] };
    } else {
      console.log(`  ❌ ${hub.name} - FAILED: ${errors.join('; ')}`);
      return { passed: false, errors };
    }
    
  } catch (err) {
    errors.push(`Navigation/load error: ${err.message}`);
    console.log(`  ❌ ${hub.name} - ERROR: ${err.message}`);
    return { passed: false, errors };
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('🚀 Starting Puppeteer tests with system Chromium...');
  console.log(`   Executable: /usr/bin/chromium`);
  console.log(`   Args: ${LAUNCH_ARGS.join(' ')}`);
  
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: LAUNCH_ARGS,
    headless: 'new',
  });
  
  const baseUrl = 'file://' + path.resolve(__dirname);
  const results = [];
  
  for (const game of GAMES) {
    const result = await testGame(browser, game, baseUrl);
    results.push({ ...game, ...result });
  }
  
  for (const hub of HUB_PAGES) {
    const result = await testHubPage(browser, hub, baseUrl);
    results.push({ ...hub, ...result });
  }
  
  await browser.close();
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  for (const r of results) {
    const status = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${status} - ${r.name}`);
    if (!r.passed && r.errors) {
      r.errors.forEach(e => console.log(`       - ${e}`));
    }
  }
  
  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});