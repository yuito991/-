const assert = require('node:assert/strict');
const { boot, fixtures } = require('./quest.test.cjs');

const KEY = 'fischersQuestV1';
const CACHE = 'fischers2017ViewerCacheV5';

function setup() {
  return boot(new Map([[CACHE, JSON.stringify({ videos: fixtures, archiveComplete: true })]]));
}

async function main() {
  const app = setup();
  assert.equal(app.nodes.get('candidatePanel').hidden, true);
  app.run('selectVideo("aaaaaaaaaaa");beginSelection()');
  assert.deepEqual(app.get('quest.items'), []);
  assert.equal(app.nodes.get('selectionTime').textContent, '00:15');
  const deadline = JSON.parse(app.saved.get(KEY)).selectionUntil;
  assert.equal(deadline - app.get('Date.now()'), 15000);
  app.advance(5000);
  app.run('redrawCandidateList();beginSelection();tick()');
  assert.equal(app.get('quest.selectionUntil'), deadline);
  assert.equal(app.nodes.get('selectionTime').textContent, '00:10');

  const reloaded = boot(new Map(app.saved));
  reloaded.advance(5000);
  reloaded.run('tick()');
  assert.equal(reloaded.nodes.get('selectionTime').textContent, '00:10');
  reloaded.advance(10000);
  reloaded.run('selectVideo("aaaaaaaaaaa");tick()');
  assert.equal(reloaded.get('quest.phase'), 'planning');
  assert.deepEqual(reloaded.get('quest.items'), []);
  assert.equal(reloaded.nodes.get('selectionDock').hidden, true);
  assert.equal(reloaded.nodes.get('startQuest').disabled, false);
  reloaded.run('beginSelection()');
  assert.equal(reloaded.nodes.get('selectionTime').textContent, '00:15');

  const pending = setup();
  pending.run('beginSelection();selectVideo("bbbbbbbbbbb");els.apiKey.value="test-key";resumeQuest=()=>{};');
  pending.advance(15000);
  pending.run('tick();changeQueue("bbbbbbbbbbb","remove");selectVideo("aaaaaaaaaaa");');
  assert.equal(pending.get('quest.phase'), 'planning', 'Wait for duration, not another selection');
  assert.equal(pending.nodes.get('candidatePanel').hidden, true);
  assert.deepEqual(pending.get('quest.items.map(v=>v.id)'), ['bbbbbbbbbbb']);
  await pending.run('loadDurations()');
  assert.equal(pending.get('quest.phase'), 'running');
  assert.equal(pending.get('quest.selectionUntil'), 0);
  assert.equal(pending.nodes.get('selectionDock').hidden, true);
  assert.equal(pending.nodes.get('cooldown').hidden, true);
  console.log('PASS: timed start, no reset from reroll/reload, no selection after expiry, wait for duration then play');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
