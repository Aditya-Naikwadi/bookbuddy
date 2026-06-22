const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });

  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('HTTP ERROR:', response.status(), response.url());
    }
  });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 10000 }).catch(e => console.log('Timeout'));
  await browser.close();
})();
