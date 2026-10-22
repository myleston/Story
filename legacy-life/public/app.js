import { countryById, LETTERS, LEGACY_TYPES, WEALTH_LABELS } from '/shared/data.js';
import { mulberry32, birth, live, summarize } from '/shared/engine.js';

const app = document.getElementById('app');
const SPEEDS = { 慢: 700, 中: 300, 快: 60 };
let speed = '中';

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children.flat()) if (c != null) node.append(c);
  return node;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

const myLives = {
  get() {
    try { return JSON.parse(localStorage.getItem('myLives') ?? '[]'); } catch { return []; }
  },
  add(id) {
    try { localStorage.setItem('myLives', JSON.stringify([id, ...this.get()].slice(0, 20))); } catch { /* 无痕模式等情况下忽略 */ }
  },
};

async function api(method, url, body) {
  const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json();
}

// ---------- 首页 ----------

async function home() {
  history.replaceState(null, '', '/');
  app.replaceChildren(
    el('h1', { textContent: '前人的痕迹' }),
    el('p', { className: 'lead', textContent: '你会随机投胎成今天出生的某个婴儿，按真实统计过完一生。不同的是：你出生的世界里，留着之前玩家的选择——他们开的店、建的学校、写下的纸条。你留下的东西，也会出现在后来者的人生里。' }),
    el('button', { className: 'primary', textContent: '开始投胎', onclick: play }),
    el('section', { id: 'mine' }),
  );
  const ids = myLives.get();
  if (!ids.length) return;
  const mine = document.getElementById('mine');
  mine.append(el('h2', { textContent: '我活过的人生' }));
  for (const id of ids) {
    try {
      const life = await api('GET', `/api/lives/${id}`);
      const impacts = life.legacies.reduce((n, l) => n + l.impacts.length, 0);
      mine.append(el('a', { className: 'life-link', href: `/?life=${id}`, onclick: e => { e.preventDefault(); showLife(id); } },
        el('span', { textContent: `${life.name} · ${countryById(life.countryId).name} · ${life.deathAge} 岁` }),
        el('span', { className: impacts ? 'badge on' : 'badge', textContent: impacts ? `影响了 ${impacts} 个人` : '还没有人遇到' })));
    } catch { /* 记录可能已被清理 */ }
  }
}

// ---------- 游玩 ----------

async function play() {
  const rng = mulberry32((Math.random() * 2 ** 32) >>> 0);
  const p = birth(rng);
  const country = countryById(p.countryId);

  let legacies = [];
  try {
    ({ legacies } = await api('GET', `/api/legacies?country=${p.countryId}`));
  } catch {
    // 后端不可用时退化成单机版
  }

  const header = el('header', { className: 'status' });
  const log = el('ol', { className: 'log' });
  const choiceBox = el('div', { className: 'choices' });
  const speedBar = el('div', { className: 'speed' }, Object.keys(SPEEDS).map(s =>
    el('button', { textContent: s, className: s === speed ? 'on' : '', onclick: e => {
      speed = s;
      speedBar.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.target));
    } })));
  app.replaceChildren(header, speedBar, log, choiceBox);

  const renderStatus = () => header.replaceChildren(
    el('div', { className: 'who', textContent: `${p.name} · ${country.name}${p.city} · ${p.age} 岁 · ${WEALTH_LABELS[p.wealth]}` }),
    el('div', { className: 'bars' }, [['健康', 'health'], ['幸福', 'happiness'], ['知识', 'knowledge'], ['人际', 'relationships']].map(([label, key]) =>
      el('div', { className: 'bar' }, el('span', { textContent: label }), el('i', {}, el('b', { style: `width:${p.stats[key]}%` }))))));

  const it = live(rng, p, legacies);
  let step = it.next();
  let lastAge = 0;
  while (!step.done) {
    const ev = step.value;
    await sleep(SPEEDS[speed] * Math.min(1 + ev.age - lastAge, 4));
    lastAge = ev.age;
    renderStatus();
    if (ev.kind === 'event') {
      log.append(el('li', { className: ev.tag === 'legacy' ? 'legacy' : '' }, el('em', { textContent: `${ev.age} 岁` }), ev.text));
      log.lastChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      step = it.next();
    } else {
      const chosen = await new Promise(resolve => {
        choiceBox.replaceChildren(el('p', { textContent: ev.prompt }),
          ...ev.options.map(o => el('button', { textContent: o.label, onclick: () => resolve(o) })));
        choiceBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      choiceBox.replaceChildren();
      log.append(el('li', { className: 'chosen' }, el('em', { textContent: `${ev.age} 岁` }), `→ ${chosen.label}`));
      step = it.next(chosen.id);
    }
  }
  renderStatus();
  await finish(p);
}

async function finish(p) {
  const box = el('section', { className: 'ending' },
    el('h2', { textContent: '这一生' }),
    el('p', { className: 'summary', textContent: summarize(p) }));
  app.append(box);

  const { legacy, letterIndex, touched, stats, age, ...rest } = p;
  try {
    const { id } = await api('POST', '/api/lives', { ...rest, legacy, letterIndex, touched });
    myLives.add(id);
    const link = `${location.origin}/?life=${id}`;
    box.append(
      el('p', { textContent: legacy || letterIndex !== null ? '你留下的东西已经放进这个世界了。之后投胎的人可能会遇到它，回来看看它改变了谁。' : '这一生没有留下什么，但它被记住了。' }),
      el('div', { className: 'share' },
        el('input', { value: link, readOnly: true, onclick: e => e.target.select() }),
        el('button', { textContent: '复制链接', onclick: () => navigator.clipboard?.writeText(link) })));
  } catch (err) {
    box.append(el('p', { className: 'error', textContent: `没能保存这一生：${err.message}` }));
  }
  box.append(el('button', { className: 'primary', textContent: '再投一次胎', onclick: play }),
    el('button', { textContent: '回首页', onclick: home }));
  box.scrollIntoView({ behavior: 'smooth' });
}

// ---------- 分享页 ----------

async function showLife(id) {
  history.replaceState(null, '', `/?life=${id}`);
  let life;
  try {
    life = await api('GET', `/api/lives/${id}`);
  } catch {
    app.replaceChildren(el('p', { textContent: '找不到这段人生。' }), el('button', { textContent: '回首页', onclick: home }));
    return;
  }
  const sections = [
    el('h1', { textContent: `${life.name} 的一生` }),
    el('p', { className: 'summary', textContent: life.summary }),
  ];
  if (life.touched.length) {
    sections.push(el('h2', { textContent: '改变过这一生的前人' }),
      el('ul', {}, life.touched.map(t => el('li', { textContent: `${t.ownerName}${t.npc ? '' : '（玩家）'} 留下的${LEGACY_TYPES[t.type].title(t.label)}` }))));
  }
  for (const l of life.legacies) {
    const title = l.type === 'letter' ? `留下的纸条「${LETTERS[l.letterIndex]}」` : `留下的${LEGACY_TYPES[l.type].title(l.label)}`;
    sections.push(el('h2', { textContent: title }),
      l.impacts.length
        ? el('ul', {}, l.impacts.map(i => el('li', { textContent: `${i.name}（${i.countryName}，活到 ${i.deathAge} 岁）${LEGACY_TYPES[l.type].impact}` })))
        : el('p', { className: 'muted', textContent: '还没有后来者遇到它。' }));
  }
  sections.push(el('button', { className: 'primary', textContent: '我也去投一次胎', onclick: play }));
  app.replaceChildren(...sections);
}

const lifeId = new URLSearchParams(location.search).get('life');
if (lifeId) showLife(lifeId); else home();
