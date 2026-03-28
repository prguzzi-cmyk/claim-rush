const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  
  // Login
  await page.goto('http://localhost:4200/#/login');
  await page.waitForTimeout(1000);
  
  const pwdLink = page.locator('text=Use password instead');
  if (await pwdLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await pwdLink.click();
    await page.waitForTimeout(500);
  }
  
  await page.fill('input[name="email"]', 'admin@upa.com');
  await page.fill('input[name="password"]', 'admin');
  await page.locator('button[mat-raised-button]').click();
  await page.waitForTimeout(3000);
  
  // Navigate to Community Advocate
  await page.goto('http://localhost:4200/#/community-advocate');
  await page.waitForTimeout(5000);
  
  // Screenshot full page
  await page.screenshot({ path: '/tmp/ca-no-error.png', fullPage: false });
  
  // Check for snackbar
  const snackbar = await page.locator('.mat-mdc-snack-bar-container, .snackbar-error, .cdk-overlay-container .mat-mdc-snackbar-surface').count();
  console.log('Snackbar elements found:', snackbar);
  
  const notFoundVisible = await page.locator('text=Not Found').isVisible({ timeout: 2000 }).catch(() => false);
  console.log('"Not Found" text visible:', notFoundVisible);
  
  await browser.close();
  console.log('Screenshot saved to /tmp/ca-no-error.png');
})();
