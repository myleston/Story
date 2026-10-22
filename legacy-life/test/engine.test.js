import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, birth, live, summarize } from '../shared/engine.js';
import { COUNTRIES } from '../shared/data.js';

// 每次都选第一个选项，跑完一整局
function autoplay(seed, legacies = [], chooser = opts => opts[0].id) {
  const rng = mulberry32(seed);
  const p = birth(rng);
  const it = live(rng, p, legacies);
  const events = [];
  let step = it.next();
  while (!step.done) {
    events.push(step.value);
    step = it.next(step.value.kind === 'choice' ? chooser(step.value.options) : undefined);
  }
  return { p, events };
}

test('same seed gives the same life', () => {
  assert.deepEqual(autoplay(42).p, autoplay(42).p);
});

test('every life ends with a death age and cause', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const { p } = autoplay(seed);
    assert.ok(Number.isInteger(p.deathAge) && p.deathAge >= 0 && p.deathAge <= 110);
    assert.ok(p.cause);
    assert.ok(summarize(p).includes(`${p.deathAge} 岁`));
  }
});

test('birth country is weighted by births', () => {
  const counts = {};
  for (let seed = 1; seed <= 3000; seed++) {
    const { countryId } = birth(mulberry32(seed));
    counts[countryId] = (counts[countryId] ?? 0) + 1;
  }
  assert.ok(counts.IN > counts.US * 3, 'India should be drawn far more often than the US');
  assert.ok((counts.TW ?? 0) < counts.IN / 20);
});

test('average lifespan tracks life expectancy', () => {
  const ages = { JP: [], NG: [] };
  for (let seed = 1; ages.JP.length < 200 || ages.NG.length < 200; seed++) {
    const { p } = autoplay(seed, [], () => 'none');
    if (ages[p.countryId]) ages[p.countryId].push(p.deathAge);
  }
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  assert.ok(mean(ages.JP) > mean(ages.NG) + 15, `JP ${mean(ages.JP)} vs NG ${mean(ages.NG)}`);
});

test('legacies from other players show up and are recorded as touched', () => {
  const legacies = COUNTRIES.flatMap(c => ['business', 'school', 'clinic', 'park'].map(type => ({
    id: `${c.id}-${type}`, type, countryId: c.id, ownerName: 'Someone', npc: false,
    label: type === 'business' ? '面包店' : null,
  })));
  legacies.push({ id: 'letter-1', type: 'letter', countryId: 'JP', ownerName: 'Yui', ownerCountryName: '日本', ownerDeathAge: 88, letterIndex: 0, npc: false });

  let sawLegacyEvent = false;
  let sawLegacyJob = false;
  for (let seed = 1; seed <= 100; seed++) {
    const { p, events } = autoplay(seed, legacies, opts => (opts.find(o => o.id === 'legacy') ?? opts[0]).id);
    for (const id of p.touched) assert.ok(legacies.some(l => l.id === id && (l.type === 'letter' || l.countryId === p.countryId)));
    if (events.some(e => e.tag === 'legacy')) sawLegacyEvent = true;
    if (p.job?.endsWith('帮工')) sawLegacyJob = true;
  }
  assert.ok(sawLegacyEvent);
  assert.ok(sawLegacyJob);
});

test('choosing a legacy at 40 records it on the person', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const { p } = autoplay(seed, [], opts => (opts.find(o => o.id === 'park') ?? opts[0]).id);
    if (p.deathAge > 40) {
      assert.deepEqual(p.legacy, { type: 'park', label: null });
      return;
    }
  }
  assert.fail('no simulated life reached 40');
});
