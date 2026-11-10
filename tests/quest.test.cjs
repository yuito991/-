const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const KEY = 'fischersQuestV1';
const LOCK = 'fischersQuestLockUntilV1';
const fixtures = ['aaaaaaaaaaa', 'bbbbbbbbbbb'].map((id, index) => ({
  id, title: 'Video ' + (index + 1), description: '',
  publishedAt: '2026-11-01T00:00:00Z', year: 2026,
  thumbnail: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'
}));

function boot(saved = new Map()) {
  let now = new Date('2026-11-09T14:59:00Z').getTime();
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
  app.run('render()');
  app.run('selectVideo("aaaaaaaaaaa"); selectVideo("bbbbbbbbbbb");');
  assert.equal(app.nodes.get('startQuest').disabled, true);
  app.run('els.apiKey.value="test-key"');
  await app.run('loadDurations()');
  assert.equal(app.nodes.get('totalDuration').textContent, '3分10秒');
  assert.equal(app.nodes.get('startQuest').disabled, false);
  assert.match(app.nodes.get('finishTime').textContent, /11\/10.*00:02/);
  app.run('changeQueue("bbbbbbbbbbb","up")');
  assert.deepEqual(app.get('quest.items.map(v=>v.id)'), ['bbbbbbbbbbb', 'aaaaaaaaaaa']);
  app.run('resumeQuest=()=>{};startQuest();');
  app.run('selectVideo("aaaaaaaaaaa");changeQueue("aaaaaaaaaaa","up");');
  assert.deepEqual(app.get('quest.items.map(v=>v.id)'), ['bbbbbbbbbbb', 'aaaaaaaaaaa']);

  const reloaded = boot(app.saved);
  assert.equal(reloaded.get('quest.phase'), 'running');
  assert.equal(reloaded.get('quest.index'), 0);
  assert.equal(reloaded.nodes.get('catalog').hidden, true);

  app.run(`playerReady=true;hasPlayed=true;sampleTime=Date.now();samplePosition=0;
    player={pos:125,id:'bbbbbbbbbbb',seeks:[],destroy(){this.destroyed=true;},
      getVideoData(){return {video_id:this.id};},getCurrentTime(){return this.pos;},
      getPlaybackRate(){return 1;},getPlayerState(){return 0;},getDuration(){return quest.items[quest.index].durationSeconds;},
      seekTo(value){this.seeks.push(value);this.pos=value;},playVideo(){},
      loadVideoById(value){this.id=value.videoId;this.pos=value.startSeconds;}};
    finishCurrentVideo();`);
  assert.equal(app.get('quest.index'), 0, 'Seeking to the end cannot advance the queue');
  assert.ok(app.get('player.seeks.length') >= 1);
  app.run('quest.checkpoint=125;samplePosition=125;player.pos=125;hasPlayed=true;finishCurrentVideo();');
  assert.equal(app.get('quest.index'), 1);
  assert.equal(app.get('quest.checkpoint'), 0);
  app.run('finishCurrentVideo()');
  assert.equal(app.get('quest.phase'), 'running', 'Duplicate end events do not clear the next video');
  app.run('quest.checkpoint=65;samplePosition=65;player.pos=65;hasPlayed=true;finishCurrentVideo();');
  assert.equal(app.get('quest.phase'), 'locked');
  assert.equal(app.nodes.get('cooldown').hidden, false);
  assert.equal(app.nodes.get('lockRemaining').textContent, '30:00');
  assert.equal(app.get('player'), null, 'No hidden player continues during lock');
  assert.equal(app.get('quest.lockedUntil-Date.now()'), 1800000);
  const locked = boot(app.saved);
  assert.equal(locked.get('quest.phase'), 'locked', 'Lock persists across reload');
  locked.run('startQuest()');
  assert.equal(locked.get('quest.phase'), 'locked');
  locked.advance(1800001);
  locked.run('tick()');
  assert.equal(locked.get('quest.phase'), 'planning');
  assert.equal(locked.saved.has(LOCK), false);

  const failed = boot();
  failed.run('allVideos=' + JSON.stringify(fixtures));
  failed.run('render()');
  failed.run('selectVideo("aaaaaaaaaaa");els.apiKey.value="test-key";fetch=async()=>({ok:true,json:async()=>({items:[]})});');
  await failed.run('loadDurations()');
  assert.equal(failed.nodes.get('startQuest').disabled, true, 'Unavailable videos cannot start');
  assert.equal(failed.nodes.get('retryDurations').hidden, false);
  assert.equal(failed.run('parseDuration("P1DT2H3M4S")'), 93784);
  assert.equal(failed.run('parseDuration("PT0S")'), null);
  assert.ok(app.saved.has(KEY));
  console.log('PASS: selection, duration API, midnight estimate, fixed order, reload, seek/duplicate guards, cooldown, expiry, unavailable videos');
}
module.exports = { boot, fixtures };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
