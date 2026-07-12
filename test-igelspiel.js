const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type()}] ${msg.text()}`);
  });
  
  page.on('pageerror', error => {
    console.log(`[BROWSER ERROR] ${error.message}`);
  });
  
  await page.goto('file:///c:/Github/bayerische-kartenspiele/igelspiel.html');
  
  // Wait for game to load
  await page.waitForTimeout(3000);
  
  // Click start button
  console.log('[TEST] Clicking start button...');
  await page.click('#startBtn');
  
  // Wait for game to fully start
  await page.waitForTimeout(2000);
  
  // Check gameRunning state
  const gameState = await page.evaluate(() => window.gameRunning);
  console.log('[TEST] gameRunning after start:', gameState);
  
  // Press arrow keys to test movement
  console.log('[TEST] Pressing ArrowRight...');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(100);
  
  // Check inputDir after keydown
  let inputDir = await page.evaluate(() => window.inputDir);
  console.log('[TEST] inputDir after ArrowRight down:', inputDir);
  
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(100);
  
  inputDir = await page.evaluate(() => window.inputDir);
  console.log('[TEST] inputDir after ArrowRight up:', inputDir);
  
  await page.waitForTimeout(1000);
  
  console.log('[TEST] Pressing ArrowRight again...');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(100);
  
  inputDir = await page.evaluate(() => window.inputDir);
  console.log('[TEST] inputDir after ArrowRight down (2nd):', inputDir);
  
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(100);
  
  inputDir = await page.evaluate(() => window.inputDir);
  console.log('[TEST] inputDir after ArrowRight up (2nd):', inputDir);
  
  await page.waitForTimeout(1000);
  
  console.log('[TEST] Pressing ArrowDown...');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(100);
  
  inputDir = await page.evaluate(() => window.inputDir);
  console.log('[TEST] inputDir after ArrowDown down:', inputDir);
  
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(100);
  
  inputDir = await page.evaluate(() => window.inputDir);
  console.log('[TEST] inputDir after ArrowDown up:', inputDir);
  
  await page.waitForTimeout(1000);
  
  console.log('[TEST] Pressing ArrowLeft...');
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(100);
  
  inputDir = await page.evaluate(() => window.inputDir);
  console.log('[TEST] inputDir after ArrowLeft down:', inputDir);
  
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(100);
  
  inputDir = await page.evaluate(() => window.inputDir);
  console.log('[TEST] inputDir after ArrowLeft up:', inputDir);
  
  await page.waitForTimeout(1000);
  
  console.log('[TEST] Pressing ArrowUp...');
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(100);
  
  inputDir = await page.evaluate(() => window.inputDir);
  console.log('[TEST] inputDir after ArrowUp down:', inputDir);
  
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(100);
  
  inputDir = await page.evaluate(() => window.inputDir);
  console.log('[TEST] inputDir after ArrowUp up:', inputDir);
  
  // Wait a bit more to see movement
  await page.waitForTimeout(5000);
  
  await browser.close();
})();
