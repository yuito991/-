async page => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const first = 'VtKYjNo8IXI';
  const second = 'ZNWfZclu72c';
  await page.clock.install();
  let dataApiCalls = 0;
  await page.route('**/www.googleapis.com/youtube/v3/**', route => { dataApiCalls++; return route.abort(); });
  await page.route('**/www.youtube.com/iframe_api', route => route.fulfill({
    contentType: 'application/javascript', body: `
      window.YT={Player:class {
        constructor(id,config){window.testPlayerVars=config.playerVars;this.events=config.events;this.pos=0;this.state=2;
          this.frame=document.createElement('iframe');this.frame.id=id;
          document.getElementById(id).replaceWith(this.frame);
          setTimeout(()=>this.events.onReady({target:this}),0);}
        getIframe(){return this.frame;}
        loadVideoById(data){clearTimeout(this.timer);this.id=data.videoId;this.pos=data.startSeconds||0;this.playVideo();}
        playVideo(){this.start=Date.now()-this.pos*1000;this.state=1;this.events.onStateChange({data:1});
          clearTimeout(this.timer);this.timer=setTimeout(()=>{this.pos=this.getDuration();this.state=0;this.events.onStateChange({data:0});},(this.getDuration()-this.pos)*1000);}
        getVideoData(){return {video_id:this.id};}
        getCurrentTime(){return this.state===1?Math.min(this.getDuration(),(Date.now()-this.start)/1000):this.pos;}
        pauseVideo(){this.pos=this.getCurrentTime();this.state=2;clearTimeout(this.timer);this.events.onStateChange({data:2});}
        getPlayerState(){return this.state;}
        getDuration(){return this.id==='${first}'?583:779;}
        seekTo(value){this.pos=value;if(this.state===1)this.playVideo();}
        destroy(){clearTimeout(this.timer);this.frame.remove();}
      }};window.onYouTubeIframeAPIReady();`
  }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:8876', { waitUntil: 'domcontentloaded' });
  check(await page.locator('#presetList button:visible').count() === 3, 'Three presets shown before selection');
  check(await page.locator('#selectionDock').isHidden(), 'No timer until selection starts');
  await page.screenshot({ path: 'output/playwright/quest-mobile-presets.png' });
  await page.getByRole('button', { name: '選択スタート', exact: true }).click();
  check(await page.locator('#presetList button').count() === 3, 'Three presets on a fresh browser without a key');
  await page.locator('#presetList [data-select="' + first + '"]').click();
  await page.locator('#presetList [data-select="' + second + '"]').click();
  await page.clock.runFor(500);
  check(await page.locator('#totalDuration').innerText() === '22分42秒', 'Total duration without a key');
  check(await page.locator('#playSelection').isEnabled(), 'Manual play is available before time runs out');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow');
  await page.screenshot({ path: 'output/playwright/quest-mobile-selection.png', fullPage: true });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.screenshot({ path: 'output/playwright/quest-desktop-selection.png', fullPage: true });
  await page.clock.runFor(10000);
  await page.clock.runFor(500);
  check(await page.locator('#catalog').isHidden(), 'Catalog hidden during playback');
  check(await page.locator('#playerProgress').innerText() === '1 / 2 本', 'First video');
  check(await page.evaluate(() => window.testPlayerVars.controls === 0 && window.testPlayerVars.disablekb === 1), 'YouTube seek bar and keyboard shortcuts are disabled');
  await page.locator('#pauseQuest').click();
  const checkpoint = () => page.evaluate(() => JSON.parse(localStorage.getItem('fischersQuestV1')).checkpoint);
  const pausedAt = await checkpoint();
  await page.locator('#seekForward').click();
  check(await checkpoint() >= pausedAt + 10, 'Forward seek is saved while paused');
  await page.locator('#resumeQuest').click();
  await page.clock.runFor(583000);
  check(await page.locator('#playerProgress').innerText() === '2 / 2 本', 'Automatic next video');
  await page.clock.runFor(779000);
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
  await page.locator('#presetList [data-select="' + second + '"]').click();
  await page.clock.runFor(500);
  check(await page.locator('#watchArea').isVisible(), 'Preset opens immediately without selection');
  check(await page.locator('#playerProgress').innerText() === '1 / 1 本', 'Only the tapped video plays');
  check(await page.locator('#pauseQuest').isVisible(), 'Preset starts playing');
  check(await page.locator('#selectionDock').isHidden(), 'Direct playback skips the selection timer');
  check(dataApiCalls === 0, 'Preset selection and playback do not call the Data API');
  console.log('PASS browser: direct- and timed-play presets, forward-only controls, lock, reload, 30-minute expiry');
}
