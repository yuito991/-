const assert = require('node:assert/strict');
const { boot, fixtures } = require('./quest.test.cjs');

const KEY = 'fischersQuestV1';
const CACHE = 'fischers2017ViewerCacheV5';

function setup(startAt) {
  return boot(new Map([[CACHE, JSON.stringify({ videos: fixtures, archiveComplete: true })]]), startAt);
}

async function main() {
  const app = setup();
  assert.equal(app.nodes.get('candidatePanel').hidden, true);
  app.run('selectVideo("aaaaaaaaaaa");beginSelection()');
  assert.equal(app.nodes.get('presetPanel').hidden, true, 'Presets are hidden during selection');
  app.run('selectVideo("VtKYjNo8IXI")');
  assert.equal(app.run('playPreset("VtKYjNo8IXI")'), false, 'Preset playback cannot interrupt selection');
  assert.deepEqual(app.get('quest.items'), []);
  assert.equal(app.nodes.get('selectionTime').textContent, '00:10');
  const deadline = JSON.parse(app.saved.get(KEY)).selectionUntil;
  assert.equal(deadline - app.get('Date.now()'), 10000);
  app.advance(5000);
  app.run('redrawCandidateList();beginSelection();tick()');
  assert.equal(app.get('quest.selectionUntil'), deadline);
  assert.equal(app.nodes.get('selectionTime').textContent, '00:05');

  const reloaded = boot(new Map(app.saved));
  reloaded.advance(5000);
  reloaded.run('tick()');
  assert.equal(reloaded.nodes.get('selectionTime').textContent, '00:05');
  reloaded.advance(5000);
  reloaded.run('selectVideo("aaaaaaaaaaa");tick()');
  assert.equal(reloaded.get('quest.phase'), 'planning');
  assert.deepEqual(reloaded.get('quest.items'), []);
  assert.equal(reloaded.nodes.get('selectionDock').hidden, true);
  assert.equal(reloaded.nodes.get('presetPanel').hidden, false);
  assert.equal(reloaded.nodes.get('startQuest').disabled, false);
  reloaded.run('beginSelection()');
  assert.equal(reloaded.nodes.get('selectionTime').textContent, '00:10');

  const pending = setup();
  pending.run('beginSelection();selectVideo("bbbbbbbbbbb");els.apiKey.value="test-key";resumeQuest=()=>{};');
  pending.advance(10000);
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

  const evening = setup('2026-11-09T10:00:00Z');
  evening.run('beginSelection();selectVideo("aaaaaaaaaaa");els.apiKey.value="test-key";');
  await evening.run('loadDurations()');
  assert.equal(evening.run('startQuest()'), true, '19:00 JST starts the interval');
  assert.equal(evening.get('quest.phase'), 'waiting');
  assert.equal(evening.nodes.get('intervalRemaining').textContent, '05:00');
  assert.equal(evening.nodes.get('playAfterInterval').disabled, true);
  assert.equal(evening.run('playAfterInterval()'), false);
  assert.equal(evening.get('playerAPI'), null);
  const waitDeadline = evening.get('quest.playAfter');
  const waitingReload = boot(new Map(evening.saved), '2026-11-09T10:04:59Z');
  assert.equal(waitingReload.get('quest.playAfter'), waitDeadline, 'Reload preserves the playback deadline');
  assert.equal(waitingReload.nodes.get('intervalRemaining').textContent, '00:01');
  assert.equal(waitingReload.run('playAfterInterval()'), false);
  waitingReload.advance(1000);
  waitingReload.run('tick()');
  assert.equal(waitingReload.nodes.get('playAfterInterval').disabled, true);
  assert.equal(waitingReload.get('quest.phase'), 'waiting', 'Nothing autoplays at the end of the interval');
  waitingReload.run('for (let i=0;i<499;i++) tapRestUnlock()');
  assert.equal(waitingReload.run('playAfterInterval()'), false, '499 taps still block playback');
  waitingReload.run('tapRestUnlock();tick()');
  assert.equal(waitingReload.nodes.get('playAfterInterval').disabled, false);
  assert.equal(waitingReload.run('resumeQuest=()=>{};playAfterInterval()'), true);
  assert.equal(waitingReload.get('quest.phase'), 'running');
  assert.deepEqual(waitingReload.get('quest.items.map(v=>v.id)'), ['aaaaaaaaaaa']);

  const afterSelection = setup('2026-11-09T11:29:45Z');
  afterSelection.run('beginSelection();selectVideo("aaaaaaaaaaa");els.apiKey.value="test-key";');
  await afterSelection.run('loadDurations()');
  afterSelection.advance(10000);
  afterSelection.run('tick()');
  assert.equal(afterSelection.get('quest.phase'), 'waiting', 'Selection timeout also applies the evening interval');
  afterSelection.advance(300000);
  afterSelection.run('tick()');
  assert.equal(afterSelection.run('playAfterInterval()'), false, 'The evening interval cannot bypass the daily rest');
  assert.equal(afterSelection.nodes.get('app').inert, true);
  afterSelection.advance(15000);
  afterSelection.run('tick()');
  assert.equal(afterSelection.nodes.get('app').inert, false);
  assert.equal(afterSelection.nodes.get('restTapPanel').hidden, false);
  assert.equal(afterSelection.run('playAfterInterval()'), false, 'The queue stays locked after overlapping waits');

  const preset = setup('2026-11-09T10:00:00Z');
  assert.equal(preset.run('resumeQuest=()=>{};playPreset("80mAjV1XUUc")'), true);
  assert.equal(preset.get('quest.phase'), 'running', 'Evening delay does not apply to a direct preset');
  console.log('PASS: evening interval, saved deadline, manual start, daily rest priority and preset exemption');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
