
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

async function scrapeWasner() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--allow-file-access-from-files'
    ],
    headless: 'new'
  });

  const page = await browser.newPage();
  
  try {
    console.log('Navigating to wasner offers page...');
    await page.goto('https://www.metzgereiwasner.de/angebote/', { 
      waitUntil: 'networkidle0', 
      timeout: 60000 
    });
    
    // Wait a bit for images to load
    await new Promise(r => setTimeout(r, 5000));
    
    // Get all images on the page
    const images = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.map(img => ({
        src: img.src,
        alt: img.alt,
        width: img.naturalWidth,
        height: img.naturalHeight,
        className: img.className
      })).filter(img => img.width > 100 && img.height > 100); // Filter out tiny images/icons
    });
    
    console.log(`Found ${images.length} relevant images`);
    
    // Create output directory
    const outputDir = '/tmp/wasner-offers';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Download each image
    const downloadedImages = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      try {
        // Navigate to image URL to download
        const imgPage = await browser.newPage();
        const response = await imgPage.goto(img.src, { waitUntil: 'networkidle0' });
        const buffer = await response.buffer();
        
        const ext = img.src.split('.').pop().split('?')[0] || 'jpg';
        const filename = `offer-${i + 1}.${ext}`;
        const filepath = path.join(outputDir, filename);
        
        fs.writeFileSync(filepath, buffer);
        downloadedImages.push({
          ...img,
          localPath: filepath,
          size: buffer.length
        });
        console.log(`Downloaded: ${filename} (${buffer.length} bytes)`);
        
        await imgPage.close();
      } catch (err) {
        console.error(`Failed to download image ${i}:`, err.message);
      }
    }
    
    // Also get page text content for context
    const pageText = await page.evaluate(() => document.body.innerText);
    
    await browser.close();
    
    // Save metadata
    const metadata = {
      scrapedAt: new Date().toISOString(),
      url: 'https://www.metzgereiwasner.de/angebote/',
      images: downloadedImages,
      pageText: pageText.substring(0, 5000) // First 5000 chars
    };
    
    fs.writeFileSync(
      path.join(outputDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    console.log('Scraping complete!');
    console.log(`Images saved to: ${outputDir}`);
    
    return metadata;
    
  } catch (err) {
    console.error('Error:', err.message);
    await browser.close();
    throw err;
  }
}

scrapeWasner().catch(console.error);
