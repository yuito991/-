async page => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:8876/-/', { waitUntil: 'domcontentloaded' });
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    return { url: link.href, data: await fetch(link.href).then(r => r.json()) };
  });
  check(new URL(manifest.data.start_url, manifest.url).href === 'http://127.0.0.1:8876/-/?app=1', 'Install opens the correct project');
  check(manifest.data.display === 'standalone' && manifest.data.prefer_related_applications === false, 'Independent web app manifest');
  for (const icon of manifest.data.icons) {
    const dimensions = await page.evaluate(async url => {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image.naturalWidth + 'x' + image.naturalHeight;
    }, new URL(icon.src, manifest.url).href);
    check(dimensions === icon.sizes, 'Icon dimensions');
  }
  const worker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return { scope: registration.scope, state: registration.active.state };
  });
  check(worker.scope === 'http://127.0.0.1:8876/-/' && worker.state === 'activated', 'Worker stays within project scope');
  await page.reload({ waitUntil: 'domcontentloaded' });
  check(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), 'Service worker controls page');
  const cdp = await page.context().newCDPSession(page);
  const install = await cdp.send('Page.getInstallabilityErrors');
  const contentErrors = install.installabilityErrors.filter(error => error.errorId !== 'in-incognito');
  check(contentErrors.length === 0, JSON.stringify(contentErrors));
  console.log('Installability errors other than the isolated test context:', contentErrors);
  console.log((await page.locator('body').innerText()).slice(0, 400));
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = async () => { window.testInstallPromptCalled = true; };
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);
  });
  const installButton = page.getByRole('button', { name: 'アプリをインストール', exact: true });
  check(await installButton.isVisible(), 'Install button responds to Chrome prompt');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Install button fits on mobile');
  await page.screenshot({ path: 'output/playwright/pwa-mobile-install.png', fullPage: true });
  await installButton.click();
  check(await page.evaluate(() => Boolean(window.testInstallPromptCalled)), 'Installation is user triggered');
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  check(await installButton.isHidden(), 'Install button hides after installation');
  await page.context().setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    check(await page.getByRole('heading', { name: 'インターネットに接続できません', exact: true }).isVisible(), 'Offline fallback');
  } finally {
    await page.context().setOffline(false);
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  check(await page.title() === "Fischer's Quest", 'Online reload returns current site');
  console.log('PASS PWA: manifest scope, PNG icons, installability, prompt, offline fallback, online recovery');
}
