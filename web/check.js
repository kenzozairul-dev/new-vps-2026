const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await p.goto('file://' + process.cwd().replace(/\\/g,'/') + '/index.html');
  await p.waitForTimeout(1200);
  console.log('TITLE:', await p.title());
  console.log('CARDS:', await p.locator('.svc-card, [data-service]').count());
  console.log('sections:', await p.locator('section').count());
  // drawer
  const firstCard = p.locator('.svc-card, [data-service], button[data-open]').first();
  console.log('firstCardVisible:', await firstCard.isVisible().catch(()=>false));
  console.log('ERRORS:', errors.length, JSON.stringify(errors.slice(0,5)));
  await b.close();
})();
