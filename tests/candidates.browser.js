async page => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const fixtures = Array.from({ length: 20 }, (_, index) => {
    const year = index < 16 ? 2020 : index < 18 ? 2019 : 2026;
    return {
      id: 'v' + String(index).padStart(10, '0'), title: '候補動画 ' + index,
      description: index < 3 ? 'subset' : '', year,
      publishedAt: year + '-05-01T00:00:00Z', durationSeconds: 120,
      thumbnail: 'https://i.ytimg.com/vi/test-' + index + '/hqdefault.jpg', isShort: index === 19
    };
  });
  await page.addInitScript(({ fixtures }) => {
    if (localStorage.getItem('candidate-test-seeded')) return;
    localStorage.setItem('candidate-test-seeded', 'true');
    localStorage.removeItem('fischersQuestV1');
    localStorage.removeItem('fischersQuestLockUntilV1');
    localStorage.removeItem('fischers2017ViewerApiKey');
    localStorage.setItem('fischers2017ViewerCacheV5', JSON.stringify({
      videos: fixtures, archiveComplete: true, savedAt: new Date().toISOString()
    }));
  }, { fixtures });
  await page.route('https://i.ytimg.com/**', route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="480" height="270" fill="#164e63"/><rect x="190" y="85" width="100" height="100" rx="8" fill="#0ea5e9"/><path d="M225 110v50l38-25z" fill="white"/></svg>'
  }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install();
  await page.goto('http://127.0.0.1:8876', { waitUntil: 'domcontentloaded' });
  console.log((await page.locator('body').innerText()).slice(0, 400));
  await page.getByRole('combobox', { name: '開始年', exact: true }).selectOption('2020');
  await page.getByRole('combobox', { name: '終了年', exact: true }).selectOption('2020');
  const ids = () => page.locator('#grid .thumb-btn').evaluateAll(nodes => nodes.map(node => node.dataset.select));
  await page.getByRole('button', { name: '選択スタート', exact: true }).click();
  const initial = await ids();
  check(initial.length === 5, 'Starts with five candidates');
  await page.clock.runFor(5000);
  const deadline = () => page.evaluate(() => JSON.parse(localStorage.getItem('fischersQuestV1')).selectionUntil);
  const initialDeadline = await deadline();
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  const bottomRefresh = page.locator('#refreshCandidatesBottom');
  const bounds = await bottomRefresh.boundingBox();
  check(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 844, 'Mobile reroll stays visible at the bottom');
  await page.screenshot({ path: 'output/playwright/candidates-mobile-bottom.png' });
  await bottomRefresh.click();
  const first = await ids();
  check(first.every(id => !initial.includes(id)), 'Bottom reroll changes all five');
  check(await deadline() === initialDeadline, 'Reroll does not reset timer');
  check(await page.locator('#candidateHead').evaluate(el => el.getBoundingClientRect().top < 100), 'Reroll returns to first result');
  check(first.length === 5 && new Set(first).size === 5, 'Exactly five unique candidates');
  check((await page.locator('#grid .meta').allTextContents()).every(text => text.includes('2020')), 'Period applies');
  await page.locator('#grid .thumb-btn').first().click();
  const second = await ids();
  check(second.length === 5 && second.every(id => !first.includes(id)), 'Next five are unseen');
  check(await page.locator('#queueCount').innerText() === '1本', 'One selected');
  await page.locator('#grid .thumb-btn').first().click();
  const chosen = [first[0], second[0]];
  check(await page.locator('#queueCount').innerText() === '2本', 'Two selected');
  check(await page.locator('#totalDuration').innerText() === '4分0秒', 'Total unchanged behavior');
  check((await ids()).every(id => !chosen.includes(id)), 'Selected candidates excluded');
  await page.getByRole('button', { name: '候補を入れ替える', exact: true }).click();
  check((await ids()).length === 5, 'Refresh keeps five');
  check(await page.locator('#queueCount').innerText() === '2本', 'Refresh preserves queue');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile width fits');
  await page.screenshot({ path: 'output/playwright/candidates-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.screenshot({ path: 'output/playwright/candidates-desktop.png', fullPage: true });
  await page.getByRole('searchbox', { name: '動画を検索', exact: true }).fill('subset');
  check((await ids()).length <= 3, 'Small matching pool');
  await page.getByRole('searchbox', { name: '動画を検索', exact: true }).fill('no-such-video');
  check((await ids()).length === 0, 'Empty matching pool');
  await page.getByRole('searchbox', { name: '動画を検索', exact: true }).fill('');
  await page.getByRole('combobox', { name: '開始年', exact: true }).selectOption('2019');
  await page.getByRole('combobox', { name: '終了年', exact: true }).selectOption('2019');
  check((await ids()).length === 2, 'Two available videos shown');
  check((await page.locator('#grid .meta').allTextContents()).every(text => text.includes('2019')), 'Changed period applies');
  await page.reload({ waitUntil: 'domcontentloaded' });
  check(await deadline() === initialDeadline, 'Reload preserves selection deadline');
  check(await page.locator('#queueCount').innerText() === '2本', 'Queue survives reload');
  check((await ids()).length === 5 && (await ids()).every(id => !chosen.includes(id)), 'Reload respects selected exclusions');
  console.log('PASS browser: five candidates, next draw, period/search, fewer than five, queue persistence, mobile/desktop');
}
