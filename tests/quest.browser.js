async page => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const first = 'aaaaaaaaaaa';
  const second = 'bbbbbbbbbbb';
  const secondPreset = 'ZNWfZclu72c';
  const workVideo = '80mAjV1XUUc';
  await page.clock.install({ time: new Date('2026-11-09T09:00:00Z') });
  await page.addInitScript(({ first, second }) => {
    localStorage.setItem('fischers2017ViewerCacheV5', JSON.stringify({
      videos: [
        { id: first, title: '通常の候補 A', durationSeconds: 583 },
        { id: second, title: '通常の候補 B', durationSeconds: 779 }
      ].map(video => ({ ...video, publishedAt: '2024-01-01T00:00:00Z' })),
      archiveComplete: true,
      savedAt: new Date().toISOString()
    }));
  }, { first, second });
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
        getDuration(){return {'${first}':583,'${second}':779,'${secondPreset}':779,'${workVideo}':5403}[this.id];}
        seekTo(value){this.pos=value;if(this.state===1)this.playVideo();}
        destroy(){clearTimeout(this.timer);this.frame.remove();}
      }};window.onYouTubeIframeAPIReady();`
  }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:8876', { waitUntil: 'domcontentloaded' });
  check(await page.locator('#presetList button:visible').count() === 4, 'Four presets shown before selection');
  check(await page.locator('#selectionDock').isHidden(), 'No timer until selection starts');
  await page.screenshot({ path: 'output/playwright/quest-mobile-presets.png' });
  await page.getByRole('button', { name: '選択スタート', exact: true }).click();
  check(await page.locator('#presetPanel').isHidden(), 'Presets are hidden during normal selection');
  await page.locator('#grid .thumb-btn[data-select="' + first + '"]').click();
  await page.locator('#grid .thumb-btn[data-select="' + second + '"]').click();
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
  check(await page.locator('#endQuest').isHidden(), 'No finish button until the last video');
  check(await page.evaluate(() => window.testPlayerVars.controls === 0 && window.testPlayerVars.disablekb === 1), 'YouTube seek bar and keyboard shortcuts are disabled');
  check(await page.locator('#backToPresets').isHidden() && await page.locator('#watchPresets').isHidden(), 'Preset navigation is unavailable in the queue');
  check(await page.locator('#presetTimer').isHidden(), 'Pause timer is unavailable in the queue');
  await page.locator('#pauseQuest').click();
  const checkpoint = () => page.evaluate(() => JSON.parse(localStorage.getItem('fischersQuestV1')).checkpoint);
  const pausedAt = await checkpoint();
  await page.locator('#seekForward').click();
  check(await checkpoint() >= pausedAt + 10, 'Forward seek is saved while paused');
  await page.locator('#resumeQuest').click();
  await page.clock.runFor(583000);
  check(await page.locator('#playerProgress').innerText() === '2 / 2 本', 'Automatic next video');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '視聴を終了', exact: true }).click();
  check(await page.locator('#cooldown').isVisible(), 'Finish button locks immediately during the last video');
  check(await page.locator('iframe').count() === 0, 'No hidden player');
  check(await page.locator('#planning').isHidden() && await page.locator('#catalog').isHidden(), 'Normal viewing stays locked');
  check(await page.locator('#presetList button:visible').count() === 4, 'Locked screen still offers the presets');
  const lockUntil = () => page.evaluate(() => localStorage.getItem('fischersQuestLockUntilV1'));
  const originalLock = await lockUntil();
  await page.screenshot({ path: 'output/playwright/quest-mobile-locked.png' });
  await page.reload();
  check(await page.locator('#cooldown').isVisible(), 'Lock survives reload');
  await page.locator('#presetList [data-select="' + workVideo + '"]').click();
  await page.clock.runFor(500);
  check(await page.locator('#watchArea').isVisible(), 'Preset opens immediately without selection');
  check(await page.locator('#endQuest').isHidden(), 'No finish-and-lock button for presets');
  check(await page.locator('#playerProgress').innerText() === '1 / 1 本', 'Only the tapped video plays');
  check(await page.locator('#playerMeta').innerText() === '1時間30分3秒', 'New preset shows its actual duration');
  check(await page.locator('#pauseQuest').isVisible(), 'Preset starts playing');
  check(await page.locator('#selectionDock').isHidden(), 'Direct playback skips the selection timer');
  check(await page.evaluate(() => window.testPlayerVars.controls === 1 && window.testPlayerVars.disablekb === 0), 'Direct presets use normal YouTube seeking');
  check(await page.locator('#watchPresetList button:visible').count() === 4, 'Preset choices remain available while playing');
  check(await page.locator('#watchPresetList [data-select="' + workVideo + '"]').isDisabled(), 'Current preset is marked');
  await page.locator('#presetTimerMinutes').fill('1');
  await page.locator('#presetRestMinutes').fill('1');
  await page.locator('#presetTimerStart').click();
  check(await page.locator('#presetTimerRemaining').isVisible(), 'Focus schedule shows remaining time');
  await page.screenshot({ path: 'output/playwright/quest-mobile-preset-player.png' });
  await page.locator('#watchPresetList [data-select="' + secondPreset + '"]').click();
  check(await page.locator('#playerMeta').innerText() === '12分59秒', 'Switches to a different preset');
  check(await page.locator('iframe').count() === 1, 'Only one player after switching');
  await page.reload({ waitUntil: 'domcontentloaded' });
  check(await page.locator('#backToPresets').isVisible(), 'Preset navigation remains after reload');
  check(await page.locator('#cooldown').isVisible() && await lockUntil() === originalLock, 'Preset reload keeps the original cooldown');
  check(await page.locator('#presetTimerCancel').isVisible(), 'Pause timer survives switching and reload');
  await page.locator('#resumeQuest').click();
  await page.clock.runFor(500);
  await page.locator('iframe').waitFor();
  await page.clock.runFor(60000);
  check(await page.locator('#restScreen').isVisible(), 'Focus expiry opens rest');
  check(await page.locator('iframe').count() === 0, 'No playback during rest');
  check(await page.locator('#app').evaluate(app => app.inert), 'Rest blocks app controls');
  await page.screenshot({ path: 'output/playwright/quest-mobile-rest.png' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  check(await page.locator('#restScreen').isVisible(), 'Rest survives reload');
  await page.clock.runFor(60000);
  check(await page.locator('#restScreen').isHidden() && await page.locator('#restTapPanel').isHidden(), 'Daytime focus rest ends without a tap challenge');
  check(await page.locator('iframe').count() === 0, 'No autoplay after rest');
  await page.locator('#resumeQuest').click();
  await page.locator('#pauseQuest').waitFor();
  await page.clock.fastForward(779000);
  check(await page.locator('#playerMessage').innerText() === '再生が終了しました。', 'Preset finished normally');
  check(await page.locator('#watchPresets').isVisible() && await lockUntil() === originalLock, 'Finishing a preset does not extend the cooldown');
  await page.locator('#backToPresets').click();
  check(await page.locator('#presetPanel').isVisible() && await page.locator('#watchArea').isHidden(), 'Back returns to the list');
  check(await page.locator('iframe').count() === 0 && await page.locator('#cooldown').isVisible(), 'Back stops the preset and keeps the original lock');
  await page.locator('#presetList [data-select="' + workVideo + '"]').click();
  await page.clock.runFor(500);
  await page.clock.fastForward(1801000);
  check(await page.locator('#cooldown').isHidden() && await page.locator('#pauseQuest').isVisible(), 'Cooldown expires without stopping playback');
  await page.locator('#backToPresets').click();
  check(await page.locator('#catalog').isVisible() && await page.locator('#startQuest').isEnabled(), 'Ordinary selection is available again');
  await page.clock.setSystemTime(new Date('2026-11-09T11:29:50Z'));
  await page.locator('#presetList [data-select="' + workVideo + '"]').click();
  await page.locator('#pauseQuest').waitFor();
  await page.clock.runFor(12000);
  check(await page.locator('#restScreen').isVisible(), 'Daily rest starts during playback at 20:30 JST');
  check(await page.locator('iframe').count() === 0 && await page.locator('#app').evaluate(app => app.inert), 'Daily rest stops playback and blocks the app');
  const dailyCheckpoint = await checkpoint();
  check(dailyCheckpoint > 0, 'Daily rest saves the current position');
  await page.screenshot({ path: 'output/playwright/quest-mobile-daily-rest.png' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  check(await page.locator('#restScreen').isVisible(), 'Daily rest survives reload');
  await page.clock.setSystemTime(new Date('2026-11-09T11:35:00Z'));
  await page.clock.runFor(1000);
  check(await page.locator('#restScreen').isHidden() && await page.locator('#restTapPanel').isHidden(), 'Presets are available again at 20:35');
  check(await page.locator('iframe').count() === 0 && await checkpoint() === dailyCheckpoint, 'Rest expiry does not autoplay or reset progress');
  await page.locator('#resumeQuest').click();
  await page.locator('#pauseQuest').waitFor();
  await page.locator('#backToPresets').click();
  check(await page.locator('#restTapButton').isVisible() && await page.locator('#planning').isHidden(), 'Only normal selection remains locked after the daily rest');
  check(await page.locator('#presetPanel').isVisible(), 'Presets stay accessible alongside the tap challenge');
  await page.screenshot({ path: 'output/playwright/quest-mobile-tap-unlock.png' });
  await page.locator('#restTapButton').evaluate(button => {
    for (let i = 0; i < 499; i++) button.click();
  });
  check(await page.locator('#restTapCount').innerText() === '499 / 500', '499 taps do not unlock');
  await page.reload({ waitUntil: 'domcontentloaded' });
  check(await page.locator('#restTapCount').innerText() === '499 / 500', 'Reload keeps the tap count');
  await page.locator('#restTapButton').click();
  check(await page.locator('#restTapPanel').isHidden() && await page.locator('#startQuest').isEnabled(), 'The 500th tap unlocks normal selection');
  await page.clock.setSystemTime(new Date('2026-11-11T02:59:58Z'));
  await page.clock.runFor(1000);
  check(await page.locator('#restTapPanel').isVisible(), 'Before noon, an unfinished lock still applies');
  await page.clock.setSystemTime(new Date('2026-11-11T03:00:00Z'));
  await page.clock.runFor(1000);
  check(await page.locator('#restTapPanel').isHidden() && await page.locator('#startQuest').isEnabled(), 'Noon releases the lock without taps');
  await page.clock.setSystemTime(new Date('2026-11-11T10:00:00Z'));
  await page.clock.runFor(1000);
  check(await page.locator('#restTapCount').innerText() === '0 / 500' && await page.locator('#planning').isHidden(), '19:00 creates a new lock');
  await page.locator('#restTapButton').evaluate(button => {
    for (let i = 0; i < 500; i++) button.click();
  });
  await page.locator('#startQuest').click();
  await page.locator('#grid .thumb-btn[data-select="' + first + '"]').click();
  await page.locator('#playSelection').click();
  check(await page.locator('#intervalPanel').isVisible(), 'Evening selection opens the interval');
  check(await page.locator('#playAfterInterval').isDisabled() && await page.locator('iframe').count() === 0, 'No playback during the interval');
  await page.screenshot({ path: 'output/playwright/quest-mobile-evening-interval.png' });
  const playAt = await page.evaluate(() => JSON.parse(localStorage.getItem('fischersQuestV1')).playAfter);
  await page.reload({ waitUntil: 'domcontentloaded' });
  check(await page.locator('#playAfterInterval').isDisabled(), 'Reload does not skip the interval');
  await page.clock.setSystemTime(new Date(playAt));
  await page.clock.runFor(1000);
  check(await page.locator('#restTapButton').isVisible() && await page.locator('#playAfterInterval').isDisabled(), 'Completed interval requires taps before playback');
  await page.locator('#restTapButton').evaluate(button => {
    for (let i = 0; i < 500; i++) button.click();
  });
  check(await page.locator('#playAfterInterval').isEnabled() && await page.locator('iframe').count() === 0, 'Ready after five minutes, without autoplay');
  await page.locator('#playAfterInterval').click();
  await page.locator('#pauseQuest').waitFor();
  check(await page.locator('#intervalPanel').isHidden(), 'Manual play after the interval');
  check(dataApiCalls === 0, 'Preset selection and playback do not call the Data API');
  console.log('PASS browser: noon auto-unlock, 19:00 re-lock, presets and evening interval');
}
