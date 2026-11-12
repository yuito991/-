async page => {
  const fixtures = ['aaaaaaaaaaa', 'bbbbbbbbbbb'].map((id, index) => ({
    id, title: index ? 'フィッシャーズ 動画B' : 'フィッシャーズ 動画A', description: '',
    publishedAt: '2026-11-01T00:00:00Z', year: 2026,
    thumbnail: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'
  }));
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  await page.clock.install();
  await page.addInitScript(({ fixtures }) => {
    localStorage.setItem('fischers2017ViewerCacheV5', JSON.stringify({
      videos: fixtures, archiveComplete: true, savedAt: new Date().toISOString()
    }));
    localStorage.setItem('fischers2017ViewerApiKey', 'test-key');
  }, { fixtures });
  await page.route('**/www.googleapis.com/youtube/v3/**', route => route.fulfill({
    json: { items: fixtures.map((v, i) => ({ id: v.id, status: { embeddable: true },
      snippet: { liveBroadcastContent: 'none' }, contentDetails: { duration: i ? 'PT2M5S' : 'PT1M5S' } })) }
  }));
  await page.route('**/www.youtube.com/iframe_api', route => route.fulfill({
    contentType: 'application/javascript', body: `
      window.YT={Player:class {
        constructor(id,config){this.events=config.events;this.pos=0;this.state=2;
          this.frame=document.createElement('iframe');this.frame.id=id;
          document.getElementById(id).replaceWith(this.frame);
          setTimeout(()=>this.events.onReady({target:this}),0);}
        getIframe(){return this.frame;}
        loadVideoById(data){clearTimeout(this.timer);this.id=data.videoId;this.pos=data.startSeconds||0;this.playVideo();}
        playVideo(){this.start=Date.now()-this.pos*1000;this.state=1;this.events.onStateChange({data:1});
          clearTimeout(this.timer);this.timer=setTimeout(()=>{this.pos=this.getDuration();this.state=0;this.events.onStateChange({data:0});},(this.getDuration()-this.pos)*1000);}
        getVideoData(){return {video_id:this.id};}
        getCurrentTime(){return this.state===1?Math.min(this.getDuration(),(Date.now()-this.start)/1000):this.pos;}
        getPlayerState(){return this.state;}
        getPlaybackRate(){return 1;}
        getDuration(){return this.id==='aaaaaaaaaaa'?65:125;}
        seekTo(value){this.pos=value;this.start=Date.now()-value*1000;}
        destroy(){clearTimeout(this.timer);this.frame.remove();}
      }};window.onYouTubeIframeAPIReady();`
  }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:8876');
  console.log('Initial page:', (await page.locator('body').innerText()).slice(0, 500));
  await page.getByRole('button', { name: '選択スタート', exact: true }).click();
  await page.getByRole('button', { name: 'フィッシャーズ 動画Aを選択', exact: true }).click();
  await page.getByRole('button', { name: 'フィッシャーズ 動画Bを選択', exact: true }).click();
  await page.clock.runFor(500);
  check(await page.locator('#totalDuration').innerText() === '3分10秒', 'Total duration');
  check(await page.locator('#playSelection').isEnabled(), 'Manual play is available before time runs out');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow');
  await page.screenshot({ path: 'output/playwright/quest-mobile-selection.png', fullPage: true });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.screenshot({ path: 'output/playwright/quest-desktop-selection.png', fullPage: true });
  await page.clock.runFor(20000);
  await page.clock.runFor(500);
  check(await page.locator('#catalog').isHidden(), 'Catalog hidden during playback');
  check(await page.locator('#playerProgress').innerText() === '1 / 2 本', 'First video');
  await page.clock.runFor(65000);
  check(await page.locator('#playerProgress').innerText() === '2 / 2 本', 'Automatic next video');
  await page.clock.runFor(125000);
  check(await page.locator('#cooldown').isVisible(), 'Lock after all videos');
  check(await page.locator('iframe').count() === 0, 'No hidden player');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'output/playwright/quest-mobile-locked.png' });
  await page.reload();
  check(await page.locator('#cooldown').isVisible(), 'Lock survives reload');
  await page.clock.runFor(1801000);
  check(await page.locator('#cooldown').isHidden(), 'Lock expires');
  check(await page.locator('#catalog').isVisible(), 'Selection returns');
  check(await page.locator('iframe').count() === 0, 'No autoplay after unlock');
  console.log('PASS browser: mobile/desktop selection, duration, automatic order, instant lock, reload, 30-minute expiry');
}
