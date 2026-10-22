import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store, createApp } from '../server.js';

async function start() {
  const dir = await mkdtemp(path.join(tmpdir(), 'legacy-life-'));
  const store = new Store(path.join(dir, 'db.json'));
  await store.load();
  const server = http.createServer(createApp(store));
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, body) => {
    const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return { call, base, store, close: async () => { server.close(); await rm(dir, { recursive: true }); } };
}

const life = (overrides = {}) => ({
  countryId: 'JP', sex: 'F', name: 'Yui', city: '大阪', wealth: 4, birthWealth: 3, dream: '画家', education: 'university',
  job: '老师', partner: true, children: 2, deathAge: 85, cause: '心脏病', legacy: { type: 'park', label: null },
  letterIndex: 2, touched: [], ...overrides,
});

test('seeded legacies are returned for a country, plus letters', async () => {
  const s = await start();
  try {
    const { status, body } = await s.call('GET', '/api/legacies?country=JP');
    assert.equal(status, 200);
    assert.ok(body.legacies.some(l => l.type === 'park' && l.countryId === 'JP'));
    assert.ok(body.legacies.some(l => l.type === 'letter'));
    assert.ok(body.legacies.every(l => l.type === 'letter' || l.countryId === 'JP'));
    assert.ok(body.legacies.every(l => !('impacts' in l)));
  } finally { await s.close(); }
});

test('a later life touching a legacy shows up as an impact on the earlier life', async () => {
  const s = await start();
  try {
    const a = await s.call('POST', '/api/lives', life());
    assert.equal(a.status, 201);

    const { body } = await s.call('GET', '/api/legacies?country=JP');
    const park = body.legacies.find(l => l.type === 'park' && !l.npc);
    assert.equal(park.ownerName, 'Yui');

    const b = await s.call('POST', '/api/lives', life({ name: 'Hina', touched: [park.id], legacy: null, letterIndex: null }));
    assert.equal(b.status, 201);

    const view = await s.call('GET', `/api/lives/${a.body.id}`);
    const parkView = view.body.legacies.find(l => l.type === 'park');
    assert.deepEqual(parkView.impacts, [{ name: 'Hina', countryName: '日本', deathAge: 85 }]);
    assert.match(view.body.summary, /大阪/);

    const bView = await s.call('GET', `/api/lives/${b.body.id}`);
    assert.deepEqual(bView.body.touched, [{ type: 'park', label: null, ownerName: 'Yui', npc: false }]);
  } finally { await s.close(); }
});

test('invalid lives are rejected', async () => {
  const s = await start();
  try {
    const cases = [
      life({ name: '<script>' }),
      life({ countryId: 'XX' }),
      life({ job: '国王' }),
      life({ deathAge: 30 }), // 40 岁前不能留下遗产
      life({ letterIndex: 99 }),
      life({ touched: ['nope'] }),
    ];
    for (const c of cases) assert.equal((await s.call('POST', '/api/lives', c)).status, 400, JSON.stringify(c));

    const { body } = await s.call('GET', '/api/legacies?country=NG');
    const foreign = body.legacies.find(l => l.type === 'park');
    assert.equal((await s.call('POST', '/api/lives', life({ touched: [foreign.id] }))).status, 400);
  } finally { await s.close(); }
});

test('static files cannot escape their directories', async () => {
  const s = await start();
  try {
    for (const p of ['/shared/..%2Fserver.js', '/shared/..%2Fdata%2Fdb.json', '/..%2Fserver.js']) {
      const res = await fetch(s.base + p);
      assert.ok([403, 404].includes(res.status), `${p} -> ${res.status}`);
    }
    assert.equal((await fetch(`${s.base}/shared/engine.js`)).status, 200);
    assert.equal((await fetch(`${s.base}/`)).status, 200);
  } finally { await s.close(); }
});
