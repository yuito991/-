const assert = require('node:assert/strict');
const { boot } = require('./quest.test.cjs');

const fixtures = Array.from({ length: 20 }, (_, index) => {
  const year = index < 16 ? 2020 : index < 18 ? 2019 : 2026;
  return {
    id: 'v' + String(index).padStart(10, '0'), title: 'Video ' + index,
    description: index < 4 ? 'quiz' : '', year,
    publishedAt: year + '-05-01T00:00:00Z', thumbnail: '', isShort: index === 19
  };
});
const app = boot();
app.run('allVideos=' + JSON.stringify(fixtures));
app.run('els.yearFrom.value="2020";els.yearTo.value="2020";Math.random=()=>0.37;render();');
const first = app.get('candidateIds');
assert.equal(first.length, 5);
assert.equal(new Set(first).size, 5);
assert.ok(app.get('drawCandidates().every(v=>v.year===2020&&!v.isShort)'));
assert.notDeepEqual(first, fixtures.slice(0, 5).map(v => v.id), 'Candidates are not the first five chronologically');
app.run('render();allVideos.push({...allVideos[0],id:"extra000001",year:2026});populateYears();render();');
assert.deepEqual(app.get('candidateIds'), first, 'Background renders preserve the current five');
assert.equal(app.nodes.get('yearTo').value, '2020', 'Loading newer videos preserves the chosen end year');

app.run('selectVideo(' + JSON.stringify(first[0]) + ')');
const second = app.get('candidateIds');
assert.equal(second.length, 5);
assert.ok(second.every(id => !first.includes(id)), 'Next five prefer videos not yet shown');
assert.deepEqual(app.get('quest.items.map(v=>v.id)'), [first[0]]);
app.run('selectVideo(' + JSON.stringify(first[0]) + ')');
assert.equal(app.get('quest.items.length'), 1, 'A stale click cannot remove a selection');
assert.deepEqual(app.get('candidateIds'), second);
app.run('render()');
assert.deepEqual(app.get('candidateIds'), second, 'Duration updates do not reroll candidates');
app.run('selectVideo(' + JSON.stringify(second[0]) + ')');
assert.deepEqual(app.get('quest.items.map(v=>v.id)'), [first[0], second[0]], 'Queue preserves the click order');
assert.ok(app.get('candidateIds.every(id=>!quest.items.some(v=>v.id===id))'));

app.run('els.query.value="quiz";render(true)');
assert.ok(app.get('drawCandidates().every(v=>v.description==="quiz"&&v.year===2020)'));
assert.ok(app.get('candidateIds.length') <= 4, 'Small pools show only available videos');
while (app.get('candidateIds.length')) {
  const id = app.get('candidateIds[0]');
  app.run('selectVideo(' + JSON.stringify(id) + ')');
}
assert.match(app.nodes.get('empty').textContent, /すべて選択済み/);
const removed = app.get('quest.items.find(v=>v.description==="quiz").id');
app.run('changeQueue(' + JSON.stringify(removed) + ',"remove")');
assert.deepEqual(app.get('candidateIds'), [removed], 'Removing a selection returns it to the eligible pool');
app.run('els.query.value="nothing matches";render(true)');
assert.deepEqual(app.get('candidateIds'), []);
assert.match(app.nodes.get('empty').textContent, /合う動画がありません/);

app.run('els.query.value="";els.yearFrom.value="2019";els.yearTo.value="2019";render(true);');
assert.equal(app.get('candidateIds.length'), 2);
assert.ok(app.get('drawCandidates().every(v=>v.year===2019)'));
app.run('els.libraryFilter.value="favorite";render(true)');
assert.equal(app.get('candidateIds.length'), 0);
app.run('state.favorites.add(allVideos[16].id);render()');
assert.deepEqual(app.get('candidateIds'), [fixtures[16].id]);
app.run('els.libraryFilter.value="all";els.yearFrom.value="2016";els.yearTo.value="all";render(true)');
assert.ok(app.get('drawCandidates().every(v=>!v.isShort)'));
const idsBeforeRefresh = app.get('candidateIds');
app.run('render(true)');
assert.ok(app.get('candidateIds').some(id => !idsBeforeRefresh.includes(id)), 'Manual refresh draws another group');
console.log('PASS: random five, period/search/library filters, no selected duplicates, unseen preference, stable renders, exhaustion and removal');
