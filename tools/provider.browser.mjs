import assert from 'node:assert/strict';

// Use an installed Playwright or supply its module path without adding a runtime app dependency.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chromium' });
try {
  for (const width of [393, 320, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 852 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /not handled by any navigator/.test(message.text())) errors.push(message.text());
    });
    await page.goto(process.env.PREVIEW_URL || 'http://localhost:4173/', { waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: /Profile/ }).click();
    await page.getByRole('button', { name: 'Switch to business account', exact: true }).click();
    const tab = (name) => page.getByRole('tab', { name, exact: true });
    await tab('Home').waitFor();
    await page.getByRole('button', { name: 'Collapse Order Food' }).click();
    assert.equal(await page.getByRole('button', { name: 'Restaurant Management', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Expand Order Food' }).click();
    await page.screenshot({ path: `/private/tmp/provider-dashboard-${width}.png` });
    await page.getByRole('button', { name: 'Restaurant Management', exact: true }).click();
    await tab('Profile').click();
    await page.getByText('Business Profile', { exact: true }).waitFor();
    await page.screenshot({ path: `/private/tmp/provider-profile-${width}.png` });
    await tab('Home').click();
    await page.getByRole('button', { name: 'Add Restaurant', exact: true }).click();
    const next = () => page.getByRole('button', { name: 'Next', exact: true });
    assert.equal(await next().isEnabled(), false);
    await page.getByPlaceholder("e.g. Mama's Kitchen").fill('Provider UI Test');
    await page.getByPlaceholder('e.g. Sri Lankan · Authentic').fill('Sri Lankan');
    assert.equal(await next().isEnabled(), false);
    await page.getByPlaceholder('Describe your restaurant in a few words…').fill('Fresh local meals');
    await next().click();
    assert.equal(await next().isEnabled(), false);
    await page.getByPlaceholder('e.g. 42, Main Street, Trincomalee').fill('42 Test Street');
    await page.getByPlaceholder('e.g. +94 26 222 3456').fill('0711234567');
    await next().click();
    await page.getByPlaceholder('7:00 AM').fill('7:00 AM');
    await page.getByPlaceholder('10:00 PM').fill('10:00 PM');
    assert.equal(await next().isEnabled(), false);
    await page.getByRole('button', { name: 'Open every day', exact: true }).click();
    await next().click();
    const create = page.getByRole('button', { name: 'Create Restaurant', exact: true });
    assert.equal(await create.isEnabled(), false);
    await page.getByRole('button', { name: '20–30 min', exact: true }).click();
    await page.getByPlaceholder('Rs. 150').fill('0');
    await create.click();
    await page.getByRole('button', { name: 'Manage Restaurant', exact: true }).waitFor();
    await page.screenshot({ path: `/private/tmp/provider-restaurants-${width}.png` });
    await page.getByRole('button', { name: 'Manage Restaurant', exact: true }).click();
    await page.getByRole('button', { name: /^Menu Management/ }).waitFor();
    await page.screenshot({ path: `/private/tmp/provider-hub-${width}.png` });
    await tab('Orders').click();
    await page.getByRole('button', { name: 'Orders for Provider UI Test' }).click();
    await page.getByRole('button', { name: 'Go back', exact: true }).click();
    await tab('Messages').click();
    await page.getByRole('button', { name: 'Create A-Z Group' }).waitFor();
    await page.getByRole('button', { name: 'Open Trincomalee Food Lovers', exact: true }).click();
    assert.equal(await page.getByRole('tablist').count(), 0);
    await page.getByRole('button', { name: 'Back to Messages', exact: true }).click();
    await tab('Profile').click();
    await page.getByRole('button', { name: /My Restaurants/ }).click();
    await page.getByRole('button', { name: 'Manage Restaurant', exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Restaurant Management', exact: true }).click();
    await page.getByRole('button', { name: 'Manage Restaurant', exact: true }).waitFor();
    await tab('Profile').click();
    await page.getByRole('button', { name: 'Switch to personal account', exact: true }).click();
    await page.getByRole('tab', { name: /Cart/ }).waitFor();
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: provider tabs, retained navigation, profile, restaurant validation/create/reload, orders and group chat`);
    await context.close();
  }
} finally { await browser.close(); }
