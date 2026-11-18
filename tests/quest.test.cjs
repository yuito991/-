const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
process.env.TZ = 'Asia/Tokyo';

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const KEY = 'fischersQuestV1';
const LOCK = 'fischersQuestLockUntilV1';
const fixtures = ['aaaaaaaaaaa', 'bbbbbbbbbbb'].map((id, index) => ({
  id, title: 'Video ' + (index + 1), description: '',
  publishedAt: '2026-11-01T00:00:00Z', year: 2026,
  thumbnail: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'
}));

function boot(saved = new Map(), startAt = '2026-11-09T10:59:00Z') {
  let now = new Date(startAt).getTime();
  const nodes = new Map();
  function element(id) {
    if (nodes.has(id)) return nodes.get(id);
    const classes = new Set();
    const node = {
      id, value: id === 'yearFrom' ? '2016' : id === 'yearTo' || id === 'libraryFilter' ? 'all' : id === 'sort' ? 'new' : '',
      hidden: false, disabled: false, textContent: '', options: [],
      classList: {
        add: (...values) => values.forEach(v => classes.add(v)),
        remove: (...values) => values.forEach(v => classes.delete(v)),
        toggle: (v, force) => force ? classes.add(v) : classes.delete(v)
      },
      addEventListener() {}, scrollIntoView() {}, focus() {}, setAttribute() {}, remove() {},
      appendChild() {}, querySelector: () => element('panel'),
      set innerHTML(value) { this.html = value; this.options = [...value.matchAll(/value="([^"]*)"/g)].map(m => ({ value: m[1] })); },
      get innerHTML() { return this.html || ''; }
    };
    nodes.set(id, node);
    return node;
  }
  const context = vm.createContext({
    console, URL, Intl, Set, Map,
    Date: class extends Date { static now() { return now; } },
    document: { getElementById: element, body: element('body'), head: element('head'), createElement: element, addEventListener() {} },
    window: { setTimeout: () => 1, clearTimeout() {}, setInterval() {}, addEventListener() {} },
    location: { protocol: 'https:', origin: 'https://test.example' },
    localStorage: { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) },
    fetch: async () => ({ ok: true, json: async () => ({ items: fixtures.map((v, i) => ({ id: v.id, contentDetails: { duration: i ? 'PT2M5S' : 'PT1M5S' }, status: { embeddable: true }, snippet: { liveBroadcastContent: 'none' } })) }) })
  });
  vm.runInContext(source, context);
  return { context, nodes, saved, advance: ms => { now += ms; }, run: code => vm.runInContext(code, context), get: code => JSON.parse(vm.runInContext('JSON.stringify(' + code + ')', context)) };
}

async function main() {
  const app = boot();
  app.run('allVideos=' + JSON.stringify(fixtures));
  app.run('beginSelection()');
  app.run('selectVideo("aaaaaaaaaaa"); selectVideo("bbbbbbbbbbb");');
  assert.equal(app.nodes.get('startQuest').disabled, true);
  app.run('els.apiKey.value="test-key"');
  await app.run('loadDurations()');
  assert.equal(app.nodes.get('totalDuration').textContent, '3分10秒');
  assert.equal(app.nodes.get('startQuest').disabled, false);
  assert.match(app.nodes.get('finishTime').textContent, /11\/9.*20:02/);
  assert.match(app.run('clockTime(Date.parse("2026-11-09T15:02:00Z"))'), /11\/10.*00:02/);
  app.run('changeQueue("bbbbbbbbbbb","up")');
  assert.deepEqual(app.get('quest.items.map(v=>v.id)'), ['bbbbbbbbbbb', 'aaaaaaaaaaa']);
  app.run('resumeQuest=()=>{};startQuest();');
  app.run('selectVideo("aaaaaaaaaaa");changeQueue("aaaaaaaaaaa","up");');
  assert.deepEqual(app.get('quest.items.map(v=>v.id)'), ['bbbbbbbbbbb', 'aaaaaaaaaaa']);

  const reloaded = boot(app.saved);
  assert.equal(reloaded.get('quest.phase'), 'running');
  assert.equal(reloaded.get('quest.index'), 0);
  assert.equal(reloaded.nodes.get('catalog').hidden, true);

  app.run(`playerReady=true;hasPlayed=true;
    player={pos:90,id:'bbbbbbbbbbb',destroy(){this.destroyed=true;},
      getVideoData(){return {video_id:this.id};},getCurrentTime(){return this.pos;},
      getDuration(){return this.id==='bbbbbbbbbbb'?125:65;},
      seekTo(target){if(target<=this.pos)throw new Error('Playback must only seek forward');this.pos=target;},
      loadVideoById(value){this.id=value.videoId;this.pos=value.startSeconds;}};
    recordProgress(true);`);
  assert.equal(app.get('quest.checkpoint'), 90, 'Forward seeking is saved');
  app.run('seekForward()');
  assert.equal(app.get('player.pos'), 100, 'The forward button moves 10 seconds');
  assert.equal(boot(new Map(app.saved)).get('quest.checkpoint'), 100, 'Forward progress saves immediately');
  app.run('player.pos=42;onPlayerState({data:2});');
  assert.equal(boot(new Map(app.saved)).get('quest.checkpoint'), 100, 'A lower player position never overwrites the saved checkpoint');
  app.run('loadCurrentVideo()');
  assert.equal(app.get('player.pos'), 100, 'Resuming does not subtract time');

  const automatic = boot(new Map(app.saved));
  automatic.run(`playerReady=true;hasPlayed=true;
    player={getVideoData(){return {video_id:'bbbbbbbbbbb'};},loadVideoById(){}};
    finishCurrentVideo();`);
  assert.equal(automatic.get('quest.index'), 1, 'YouTube ended event advances even after seeking');

  assert.equal(app.nodes.get('nextVideo').hidden, false);
  assert.equal(app.nodes.get('endQuest').hidden, true);
  assert.equal(app.run('endQuest()'), false, 'Only the last item can be stopped early');
  assert.equal(app.run('advanceQuest()'), true);
  assert.equal(app.get('quest.index'), 1);
  assert.equal(app.get('quest.checkpoint'), 0);
  assert.equal(app.get('player.id'), 'aaaaaaaaaaa');
  assert.equal(app.get('state.watched.has("bbbbbbbbbbb")'), false, 'Manual skips do not mark the skipped video watched');
  assert.equal(app.nodes.get('nextVideo').hidden, true);
  assert.equal(app.nodes.get('endQuest').hidden, false);
  const stoppedEarly = boot(new Map(app.saved));
  stoppedEarly.run('player={destroy(){}};playerReady=true;');
  assert.equal(stoppedEarly.run('endQuest()'), true);
  assert.equal(stoppedEarly.get('quest.lockedUntil-Date.now()'), 1800000);
  assert.equal(stoppedEarly.get('player'), null, 'Early exit destroys the player');
  assert.equal(stoppedEarly.get('state.watched.has("aaaaaaaaaaa")'), false, 'Unfinished video is not marked watched');
  assert.equal(app.run('advanceQuest()'), false, 'There is no next-video action on the last item');
  app.run('finishCurrentVideo()');
  assert.equal(app.get('quest.phase'), 'running', 'Duplicate end events do not clear the next video');
  app.run('player.pos=65;hasPlayed=true;finishCurrentVideo();');
  assert.equal(app.get('quest.phase'), 'locked');
  assert.equal(app.nodes.get('cooldown').hidden, false);
  assert.equal(app.nodes.get('lockRemaining').textContent, '30:00');
  assert.equal(app.get('player'), null, 'No hidden player continues during lock');
  assert.equal(app.get('quest.lockedUntil-Date.now()'), 1800000);
  const locked = boot(new Map(app.saved));
  assert.equal(locked.get('quest.phase'), 'locked', 'Lock persists across reload');
  assert.equal(locked.nodes.get('presetPanel').hidden, false);
  assert.equal(locked.nodes.get('planning').hidden, true);
  locked.run('beginSelection();startQuest();');
  assert.equal(locked.get('quest.phase'), 'locked');
  const deadline = locked.get('quest.lockedUntil');
  locked.run('resumeQuest=()=>{}');
  assert.equal(locked.run('playPreset("VtKYjNo8IXI")'), true, 'A direct preset can play during cooldown');
  assert.equal(locked.get('quest.lockedUntil'), deadline);
  const lockedPreset = boot(new Map(locked.saved));
  assert.equal(lockedPreset.get('quest.presetMode'), true, 'Reload keeps the preset open during cooldown');
  assert.equal(lockedPreset.get('quest.lockedUntil'), deadline);
  assert.equal(lockedPreset.run('backToPresets()'), true);
  assert.equal(lockedPreset.get('quest.phase'), 'locked', 'Closing a preset restores the lock screen');
  assert.equal(lockedPreset.get('quest.lockedUntil'), deadline, 'Closing does not reset the timer');
  locked.advance(1800001);
  locked.run('tick()');
  assert.equal(locked.get('quest.phase'), 'running', 'Cooldown expires without interrupting a preset');
  assert.equal(locked.get('quest.lockedUntil'), 0);
  assert.equal(locked.saved.has(LOCK), false);
  locked.run('backToPresets()');
  assert.equal(locked.get('quest.phase'), 'planning');

  const failed = boot();
  failed.run('allVideos=' + JSON.stringify(fixtures));
  failed.run('beginSelection()');
  failed.run('selectVideo("aaaaaaaaaaa");els.apiKey.value="test-key";fetch=async()=>({ok:true,json:async()=>({items:[]})});');
  await failed.run('loadDurations()');
  assert.equal(failed.nodes.get('startQuest').disabled, true, 'Unavailable videos cannot start');
  assert.equal(failed.nodes.get('retryDurations').hidden, false);
  assert.equal(failed.run('parseDuration("P1DT2H3M4S")'), 93784);
  assert.equal(failed.run('parseDuration("PT0S")'), null);

  const regular = boot(new Map(automatic.saved));
  assert.equal(regular.run('backToPresets()'), false, 'The selected queue cannot use preset navigation');
  assert.equal(regular.run('playPreset("VtKYjNo8IXI")'), false);
  assert.equal(regular.run('setPresetTimer(1, 1)'), false, 'Only direct presets have focus and rest controls');

  const direct = boot();
  assert.equal(direct.nodes.get('presetPanel').hidden, false);
  assert.equal(direct.nodes.get('candidatePanel').hidden, true);
  assert.equal(direct.nodes.get('startQuest').disabled, true, 'No regular selection without an archive');
  assert.equal(direct.run('resumeQuest=()=>{};playPreset("80mAjV1XUUc")'), true);
  assert.deepEqual(direct.get('quest.items.map(v=>[v.id,v.durationSeconds])'), [['80mAjV1XUUc', 5403]]);
  assert.equal(direct.get('quest.selectionUntil'), 0);
  assert.equal(direct.nodes.get('presetPanel').hidden, true);
  assert.equal(direct.nodes.get('nextVideo').hidden, true);
  assert.equal(direct.nodes.get('endQuest').hidden, true);
  assert.equal(direct.run('endQuest()'), false, 'Direct presets have no finish-and-lock action');
  assert.equal(direct.nodes.get('backToPresets').hidden, false);
  assert.equal(direct.nodes.get('watchPresets').hidden, false);
  assert.equal(direct.nodes.get('presetTimer').hidden, false);
  assert.equal(boot(new Map(direct.saved)).get('quest.presetMode'), true, 'Single preset mode survives reload');
  direct.run(`quest.checkpoint=120;hasPlayed=true;playerReady=true;
    player={id:'80mAjV1XUUc',pos:60,getVideoData(){return {video_id:this.id};},getCurrentTime(){return this.pos;},
      getPlayerState(){return 1;},
      loadVideoById(v){this.id=v.videoId;this.pos=v.startSeconds;},destroy(){this.destroyed=true;}};
    recordProgress(true);`);
  assert.equal(direct.get('quest.checkpoint'), 60, 'A single preset allows backward seeking');
  assert.equal(direct.run('setPresetTimer(0, 1)'), false);
  assert.equal(direct.run('setPresetTimer(1, 0)'), false);
  assert.equal(direct.run('setPresetTimer(1, 2)'), true);
  const schedule = direct.get('focusSchedule');
  assert.equal(schedule.restAt - schedule.focusAt, 120000);
  assert.deepEqual(boot(new Map(direct.saved)).get('focusSchedule'), schedule);
  direct.advance(59000);
  direct.run('tick()');
  assert.equal(direct.nodes.get('presetTimerRemaining').textContent, '集中 残り 00:01 · 休憩 2分');
  assert.equal(direct.nodes.get('restScreen').hidden, true);
  assert.equal(direct.run('playPreset("VtKYjNo8IXI")'), true, 'An open preset can switch directly to another');
  assert.equal(direct.get('player.id'), 'VtKYjNo8IXI');
  assert.equal(direct.get('player.pos'), 0);
  assert.deepEqual(direct.get('focusSchedule'), schedule, 'Switching keeps both deadlines');
  direct.advance(1000);
  assert.equal(direct.run('cancelPresetTimer()'), false, 'Rest cannot be cancelled even before the next tick');
  direct.run('player.pos=40;hasPlayed=true;tick();tick()');
  assert.equal(direct.get('player'), null, 'Rest removes the player at focus expiry');
  assert.equal(direct.get('quest.checkpoint'), 40);
  assert.equal(direct.nodes.get('restRemaining').textContent, '02:00');
  assert.equal(direct.nodes.get('app').inert, true);
  assert.equal(direct.run('backToPresets()'), false);
  assert.equal(direct.run('playPreset("ZNWfZclu72c")'), false, 'Other presets cannot open during rest');
  assert.equal(direct.run('startPlayback(quest.items)'), false, 'Ordinary playback is blocked too');
  const restReload = boot(new Map(direct.saved));
  restReload.advance(65000);
  restReload.run('tick()');
  assert.equal(restReload.nodes.get('restRemaining').textContent, '01:55', 'Reload uses the same rest deadline');
  direct.advance(120000);
  direct.run('tick()');
  assert.equal(direct.get('focusSchedule'), null);
  assert.equal(direct.nodes.get('restScreen').hidden, true);
  assert.equal(direct.get('player'), null, 'Rest expiry does not autoplay');
  assert.equal(direct.saved.has(LOCK), false);
  assert.equal(direct.run('playPreset("ZNWfZclu72c")'), true);
  direct.run('setPresetTimer(1, 1);cancelPresetTimer();');
  assert.equal(direct.get('focusSchedule'), null);
  direct.run('setPresetTimer(1, 1)');
  assert.equal(direct.run('backToPresets()'), true);
  assert.equal(direct.get('focusSchedule'), null, 'Leaving during focus clears the timer');
  assert.equal(direct.get('player'), null);
  assert.equal(direct.get('quest.phase'), 'planning');
  assert.equal(direct.nodes.get('presetPanel').hidden, false);
  assert.equal(direct.saved.has(LOCK), false, 'Returning early does not lock the site');
  assert.equal(app.run('backToPresets()'), false, 'Cooldown cannot be dismissed');
  assert.ok(app.saved.has(KEY));
  console.log('PASS: selection, duration API, seeking/resume, next button, automatic advance, duplicate ends, cooldown, expiry');
}
async function testNightViewing() {
  const night = boot(new Map(), '2026-11-09T11:29:59Z');
  assert.equal(night.run('isNightViewing()'), false);
  night.run(`startPlayback([{...PRESET_VIDEOS.get('80mAjV1XUUc')}]);
    playerReady=true;hasPlayed=true;
    player={getVideoData(){return {video_id:'80mAjV1XUUc'};},getCurrentTime(){return 92;},destroy(){}};
  `);
  night.advance(1000);
  night.run('tick()');
  assert.equal(night.run('isNightViewing()'), true, '20:30 JST is blocked');
  assert.equal(night.nodes.get('nightScreen').hidden, false);
  assert.equal(night.nodes.get('resumeQuest').disabled, true);
  assert.equal(night.get('player'), null);
  assert.equal(night.get('quest.checkpoint'), 92);
  const resumed = boot(new Map(night.saved), '2026-11-09T14:59:59Z');
  assert.equal(resumed.nodes.get('nightScreen').hidden, false, 'Reload is still blocked at 23:59');
  await resumed.run('resumeQuest()');
  assert.equal(resumed.get('playerAPI'), null, 'No embedded player is started');
  resumed.advance(1000);
  resumed.run('tick()');
  assert.equal(resumed.nodes.get('nightScreen').hidden, true, 'Midnight JST releases the blackout');
  assert.equal(resumed.nodes.get('resumeQuest').disabled, false);
  assert.equal(resumed.get('player'), null, 'Midnight does not autoplay');
  assert.equal(resumed.get('quest.checkpoint'), 92);
  const latePreset = boot(new Map(), '2026-11-10T11:31:00Z');
  assert.equal(latePreset.run('playPreset("80mAjV1XUUc")'), true);
  assert.equal(latePreset.nodes.get('nightScreen').hidden, false);
  assert.equal(latePreset.get('playerAPI'), null, 'Choosing a preset at night cannot start audio or video');
  console.log('PASS: daily JST cutoff, saved progress, no playback during blackout and manual resume after midnight');
}
module.exports = { boot, fixtures };
if (require.main === module) main().then(testNightViewing).catch(error => { console.error(error); process.exitCode = 1; });
