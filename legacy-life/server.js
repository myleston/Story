// 零依赖的原型后端：静态文件 + 三个 API，数据存在一个 JSON 文件里。
// 上线时可以把 Store 换成 SQLite / Postgres / Supabase，接口不用变。

import http from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRIES, countryById, DREAMS, JOBS, BUSINESS_LABELS, CAUSES, LETTERS, LEGACY_TYPES } from './shared/data.js';
import { summarize } from './shared/engine.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MAX_BODY = 16 * 1024;
const newId = () => randomBytes(6).toString('base64url');
const shuffle = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

export class Store {
  constructor(file) {
    this.file = file;
    this.data = null;
    this.writing = Promise.resolve();
  }

  async load() {
    try {
      this.data = JSON.parse(await readFile(this.file, 'utf8'));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      this.data = { lives: {}, legacies: {} };
      seed(this.data);
      await this.save();
    }
  }

  // 写入串行化，先写临时文件再 rename，避免写一半的文件
  save() {
    this.writing = this.writing.then(async () => {
      await mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      await writeFile(tmp, JSON.stringify(this.data));
      await rename(tmp, this.file);
    });
    return this.writing;
  }
}

// 冷启动：每个国家先放一份种子遗产，保证第一个玩家也能遇到"前人"
function seed(data) {
  for (const c of COUNTRIES) {
    for (const type of ['business', 'school', 'clinic', 'park']) {
      const id = newId();
      data.legacies[id] = {
        id, type, npc: true, lifeId: null, countryId: c.id, ownerCountryName: c.name,
        ownerName: c.names.F[0], ownerDeathAge: 70, city: c.cities[0],
        label: type === 'business' ? BUSINESS_LABELS[0] : null, letterIndex: null, impacts: [],
      };
    }
  }
  LETTERS.forEach((_, i) => {
    const c = COUNTRIES[i % COUNTRIES.length];
    const id = newId();
    data.legacies[id] = {
      id, type: 'letter', npc: true, lifeId: null, countryId: c.id, ownerCountryName: c.name,
      ownerName: c.names.M[0], ownerDeathAge: 60 + i * 4, city: c.cities[0], label: null, letterIndex: i, impacts: [],
    };
  });
}

const publicLegacy = ({ impacts, lifeId, ...rest }) => rest;

// 客户端只上传结构化字段，每个字段都对照数据表校验；摘要文本由服务端重新生成，
// 所以玩家没有任何自由文本可以写进别人的故事里。
export function validateLife(body, legacies) {
  const fail = msg => { throw Object.assign(new Error(msg), { status: 400 }); };
  if (!body || typeof body !== 'object') fail('body must be an object');
  const country = countryById(body.countryId);
  if (!country) fail('unknown country');
  if (!['M', 'F'].includes(body.sex)) fail('bad sex');
  if (!country.names[body.sex].includes(body.name)) fail('bad name');
  if (!country.cities.includes(body.city)) fail('bad city');
  for (const k of ['wealth', 'birthWealth']) if (!Number.isInteger(body[k]) || body[k] < 1 || body[k] > 5) fail(`bad ${k}`);
  if (body.dream !== null && !DREAMS.includes(body.dream)) fail('bad dream');
  if (!['none', 'primary', 'secondary', 'university'].includes(body.education)) fail('bad education');
  const jobs = [...JOBS.map(j => j.key), ...BUSINESS_LABELS.map(l => `${l}帮工`)];
  if (body.job !== null && !jobs.includes(body.job)) fail('bad job');
  if (typeof body.partner !== 'boolean') fail('bad partner');
  if (!Number.isInteger(body.children) || body.children < 0 || body.children > 15) fail('bad children');
  if (!Number.isInteger(body.deathAge) || body.deathAge < 0 || body.deathAge > 110) fail('bad deathAge');
  if (!CAUSES.includes(body.cause)) fail('bad cause');

  let legacy = null;
  if (body.legacy !== null) {
    const { type, label } = body.legacy ?? {};
    if (!LEGACY_TYPES[type] || type === 'letter') fail('bad legacy type');
    if (body.deathAge < 40) fail('legacy requires reaching age 40');
    if (type === 'business' ? !BUSINESS_LABELS.includes(label) : label !== null) fail('bad legacy label');
    legacy = { type, label };
  }

  let letterIndex = null;
  if (body.letterIndex !== null) {
    if (!Number.isInteger(body.letterIndex) || !LETTERS[body.letterIndex]) fail('bad letterIndex');
    if (body.deathAge < 15) fail('letter requires reaching age 15');
    letterIndex = body.letterIndex;
  }

  if (!Array.isArray(body.touched) || body.touched.length > Object.keys(LEGACY_TYPES).length) fail('bad touched');
  const touched = [...new Set(body.touched)];
  for (const id of touched) {
    const l = legacies[id];
    if (!l) fail('unknown legacy');
    if (l.type !== 'letter' && l.countryId !== country.id) fail('legacy from another country');
  }

  const { countryId, sex, name, city, wealth, birthWealth, dream, education, job, partner, children, deathAge, cause } = body;
  return { countryId, sex, name, city, wealth, birthWealth, dream, education, job, partner, children, deathAge, cause, legacy, letterIndex, touched };
}

export function createApp(store) {
  const api = {
    'GET /api/legacies': (req, url) => {
      const country = countryById(url.searchParams.get('country'));
      if (!country) return [400, { error: 'unknown country' }];
      const all = Object.values(store.data.legacies);
      const local = shuffle(all.filter(l => l.type !== 'letter' && l.countryId === country.id)).slice(0, 40);
      const letters = shuffle(all.filter(l => l.type === 'letter')).slice(0, 10);
      return [200, { legacies: [...local, ...letters].map(publicLegacy) }];
    },

    'POST /api/lives': async (req, url, body) => {
      const life = validateLife(body, store.data.legacies);
      const country = countryById(life.countryId);
      const id = newId();
      const record = { id, createdAt: new Date().toISOString(), ...life, summary: summarize(life), legacyIds: [] };

      const addLegacy = (type, label, letterIndex) => {
        const lid = newId();
        store.data.legacies[lid] = {
          id: lid, type, npc: false, lifeId: id, countryId: country.id, ownerCountryName: country.name,
          ownerName: life.name, ownerDeathAge: life.deathAge, city: life.city, label, letterIndex, impacts: [],
        };
        record.legacyIds.push(lid);
      };
      if (life.legacy) addLegacy(life.legacy.type, life.legacy.label, null);
      if (life.letterIndex !== null) addLegacy('letter', null, life.letterIndex);

      // 反向记录：让前人能看到自己的遗产改变了谁
      for (const lid of life.touched) {
        const l = store.data.legacies[lid];
        l.impacts.push({ lifeId: id, name: life.name, countryName: country.name, deathAge: life.deathAge, at: record.createdAt });
        if (l.impacts.length > 200) l.impacts.shift();
      }

      store.data.lives[id] = record;
      await store.save();
      return [201, { id }];
    },

    'GET /api/lives/:id': (req, url, body, id) => {
      const life = store.data.lives[id];
      if (!life) return [404, { error: 'not found' }];
      const legacies = life.legacyIds.map(lid => store.data.legacies[lid]).map(l => ({
        type: l.type, label: l.label, letterIndex: l.letterIndex, impacts: l.impacts.map(({ name, countryName, deathAge }) => ({ name, countryName, deathAge })),
      }));
      const touched = life.touched.map(lid => store.data.legacies[lid]).filter(Boolean)
        .map(l => ({ type: l.type, label: l.label, ownerName: l.ownerName, npc: l.npc }));
      const { id: _, summary, name, countryId, sex, deathAge, cause, createdAt } = life;
      return [200, { id, summary, name, countryId, sex, deathAge, cause, createdAt, legacies, touched }];
    },
  };

  return async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const send = (status, payload) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(payload));
    };
    try {
      if (url.pathname.startsWith('/api/')) {
        let key = `${req.method} ${url.pathname}`;
        let param;
        const m = url.pathname.match(/^\/api\/lives\/([\w-]+)$/);
        if (m && req.method === 'GET') { key = 'GET /api/lives/:id'; param = m[1]; }
        const handler = api[key];
        if (!handler) return send(404, { error: 'not found' });
        const body = req.method === 'POST' ? await readJson(req) : undefined;
        const [status, payload] = await handler(req, url, body, param);
        return send(status, payload);
      }
      return await serveStatic(url.pathname, res);
    } catch (err) {
      if (!err.status) console.error(err);
      return send(err.status ?? 500, { error: err.status ? err.message : 'internal error' });
    }
  };
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('body too large'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('invalid json'), { status: 400 });
  }
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

async function serveStatic(pathname, res) {
  let rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  let base = path.join(ROOT, 'public');
  if (rel.startsWith('shared/')) {
    base = path.join(ROOT, 'shared');
    rel = rel.slice('shared/'.length);
  }
  const file = path.resolve(base, rel);
  if (!file.startsWith(base + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const content = await readFile(file);
    res.writeHead(200, { 'content-type': `${TYPES[path.extname(file)] ?? 'application/octet-stream'}; charset=utf-8` });
    res.end(content);
  } catch {
    res.writeHead(404).end('not found');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const store = new Store(process.env.DB_FILE ?? path.join(ROOT, 'data', 'db.json'));
  await store.load();
  const port = Number(process.env.PORT ?? 3000);
  http.createServer(createApp(store)).listen(port, () => console.log(`legacy-life running at http://localhost:${port}`));
}
