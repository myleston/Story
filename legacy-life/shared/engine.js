// 人生模拟引擎：浏览器和服务端共用，纯函数 + 生成器，没有任何 I/O。
//
// 用法：
//   const p = birth(rng);
//   const it = live(rng, p, legacies);
//   let step = it.next();
//   while (!step.done) { ... step = it.next(choiceIdIfStepWasAChoice); }
//
// 生成器产出两种东西：
//   { kind: 'event',  age, text, tag? }            —— tag 为 'legacy' 表示碰到了别的玩家留下的遗产
//   { kind: 'choice', age, prompt, options: [{ id, label }] }
// 遇到 choice 时，下一次 next() 需要传入所选 option 的 id。

import { COUNTRIES, countryById, DREAMS, JOBS, BUSINESS_LABELS, LETTERS, LEGACY_TYPES, WEALTH_LABELS } from './data.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted(rng, items, weight) {
  const total = items.reduce((s, it) => s + weight(it), 0);
  let r = rng() * total;
  for (const it of items) {
    r -= weight(it);
    if (r <= 0 && weight(it) > 0) return it;
  }
  return items[items.length - 1];
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));
const between = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

export function birth(rng) {
  // 按年新生儿数量加权，所以抽到印度的概率大约是台湾的 170 倍
  const country = pickWeighted(rng, COUNTRIES, c => c.births);
  const sex = rng() < 0.512 ? 'M' : 'F';
  const p = {
    countryId: country.id,
    sex,
    name: pick(rng, country.names[sex]),
    city: pick(rng, country.cities),
    wealth: clamp(country.income + pick(rng, [-2, -1, -1, 0, 0, 0, 1, 1, 2]), 1, 5),
    birthWealth: null, // 出生时的家境，birth() 末尾填入
    stats: { health: 60, happiness: 60, knowledge: 10, relationships: 50 },
    age: 0,
    dream: null,
    education: 'none',
    job: null,
    partner: false,
    children: 0,
    deathAge: null,
    cause: null,
    legacy: null,      // 自己留下的遗产 { type, label }
    letterIndex: null, // 自己留下的纸条
    touched: [],       // 碰到过的别人的遗产 id
  };
  p.birthWealth = p.wealth;
  return p;
}

// 每年的死亡概率：五岁前用五岁以下死亡率，之后用按预期寿命校准的 Gompertz 曲线
export function deathChance(country, p, age, clinic) {
  let q;
  if (age === 0) q = (country.u5 / 1000) * 0.6;
  else if (age < 5) q = (country.u5 / 1000) * 0.1;
  else {
    const b = 0.085;
    const a = (Math.LN2 * b) / (Math.exp(b * country.lifeExp[p.sex]) - 1);
    q = 1 - Math.exp((-a / b) * (Math.exp(b * (age + 1)) - Math.exp(b * age)));
    q += 0.0004 * (5 - country.income); // 意外、暴力等与年龄关系不大的风险
  }
  q *= 1.6 - p.stats.health / 100; // 健康 60 时系数为 1
  if (clinic) q *= age < 5 ? 0.6 : 0.85;
  return Math.min(q, 0.95);
}

function causeOfDeath(rng, country, age) {
  const table = age < 5
    ? [['肺炎', 3], ['腹泻', 2], ['早产并发症', 3], ['疟疾', country.income <= 2 ? 2 : 0]]
    : age < 45
      ? [['交通事故', 3], ['感染性疾病', 5 - country.income], ['意外', 2], ['癌症', 2], ['暴力冲突', country.conflict ? 2 : 0.2]]
      : [['心脏病', 4], ['中风', 3], ['癌症', 3], ['慢性呼吸道疾病', 1.5], ['糖尿病', 1],
         ['阿尔茨海默病', age > 75 ? 2 : 0], ['衰老', age > 85 ? 3 : 0]];
  return pickWeighted(rng, table, ([, w]) => w)[0];
}

// 每种类型挑一份遗产；真实玩家留下的权重高于种子数据
function chooseLegacies(rng, p, legacies) {
  const out = {};
  for (const type of Object.keys(LEGACY_TYPES)) {
    const pool = legacies.filter(l => l.type === type && (type === 'letter' || l.countryId === p.countryId));
    if (pool.length) out[type] = pickWeighted(rng, pool, l => (l.npc ? 1 : 3));
  }
  return out;
}

const RANDOM_EVENTS = [
  { w: c => 5 - c.income, text: '生了一场大病，躺了好几个月。', apply: p => { p.stats.health -= 15; } },
  { w: () => 1.5, text: '遭遇了一场车祸，所幸活了下来。', apply: p => { p.stats.health -= 10; } },
  { w: () => 1, text: '意外得到一笔钱，家里宽裕了一些。', apply: p => { p.wealth += 1; } },
  { w: () => 1.5, when: p => p.job, text: '失业了，有一阵子过得很艰难。', apply: p => { p.wealth -= 1; p.stats.happiness -= 10; } },
  { w: () => 2, text: '和多年未见的老朋友重逢。', apply: p => { p.stats.relationships += 10; } },
  { w: c => (c.conflict ? 2 : 0), text: '所在的地区爆发了冲突，全家人提心吊胆。', apply: p => { p.stats.happiness -= 15; p.stats.health -= 5; } },
  { w: () => 0.8, text: '一场洪水冲毁了附近的街道。', apply: p => { p.wealth -= 1; p.stats.happiness -= 5; } },
  { w: () => 2, text: '这一年过得平静而满足。', apply: p => { p.stats.happiness += 8; } },
];

function normalize(p) {
  for (const k of Object.keys(p.stats)) p.stats[k] = clamp(p.stats[k]);
  p.wealth = clamp(p.wealth, 1, 5);
}

export function* live(rng, p, legacies = []) {
  const country = countryById(p.countryId);
  const found = chooseLegacies(rng, p, legacies);
  const touch = (legacy, text) => {
    if (!p.touched.includes(legacy.id)) p.touched.push(legacy.id);
    return { kind: 'event', age: p.age, text, tag: 'legacy' };
  };
  const owner = l => (l.npc ? l.ownerName : `${l.ownerName}（另一位玩家）`);
  const clinic = found.clinic && rng() < 0.7 ? found.clinic : null;
  const letterAge = between(rng, 16, 30);
  const parkAge = between(rng, 20, 60);

  for (p.age = 0; p.age <= 110; p.age++) {
    const age = p.age;

    if (age === 0) {
      yield { kind: 'event', age, text: `你出生在${country.name}${p.city}一个${WEALTH_LABELS[p.birthWealth]}的家庭，是个${p.sex === 'M' ? '男孩' : '女孩'}。名字叫 ${p.name}。` };
      if (clinic) yield touch(clinic, `你是在 ${owner(clinic)} 资助的诊所里出生的。那里的接生条件比附近好得多。`);
    }

    if (age === 6) {
      let enrolled = rng() < Math.min(0.98, 0.5 + 0.12 * country.income + 0.05 * (p.wealth - 3));
      if (!enrolled && found.school && rng() < 0.6) {
        enrolled = true;
        yield touch(found.school, `家里本来供不起你上学，但 ${owner(found.school)} 留下的学校免了你的学费。`);
      } else if (enrolled && found.school && rng() < 0.5) {
        p.stats.knowledge += 15;
        yield touch(found.school, `你进了 ${owner(found.school)} 留下的那所学校，老师们很用心。`);
      }
      if (enrolled) {
        p.education = 'primary';
        p.stats.knowledge += 15;
        yield { kind: 'event', age, text: '你背上书包去上学了。' };
      } else {
        yield { kind: 'event', age, text: '家里没钱，你没能去上学，开始帮家里干活。' };
      }
    }

    if (age === 8) {
      p.dream = pick(rng, DREAMS);
      yield { kind: 'event', age, text: `你第一次说出了自己的梦想：长大要当${p.dream}。` };
    }

    if (age === 12) {
      const options = p.education === 'primary'
        ? [{ id: 'study', label: '拼命读书' }, { id: 'friends', label: '和朋友到处玩' }, { id: 'work', label: '课余帮家里干活' }]
        : [{ id: 'self', label: '借书自学' }, { id: 'friends', label: '和朋友到处玩' }, { id: 'work', label: '帮家里干活' }];
      const c = yield { kind: 'choice', age, prompt: '十二岁，你把大部分时间花在哪里？', options };
      if (c === 'study') p.stats.knowledge += 25;
      if (c === 'self') p.stats.knowledge += 12;
      if (c === 'friends') { p.stats.relationships += 20; p.stats.happiness += 10; }
      if (c === 'work') { p.wealth += 1; p.stats.happiness -= 5; }
    }

    if (age === 15 && p.education === 'primary') {
      if (rng() < 0.55 + 0.1 * country.income) {
        p.education = 'secondary';
        p.stats.knowledge += 10;
        yield { kind: 'event', age, text: '你读完了中学。' };
      } else {
        yield { kind: 'event', age, text: '你中学没读完就辍学了。' };
      }
    }

    if (age === letterAge && found.letter) {
      const l = found.letter;
      p.stats.happiness += 5;
      yield touch(l, `你在一本旧书里发现一张纸条，署名 ${owner(l)}，${l.ownerCountryName}人，活到 ${l.ownerDeathAge} 岁：「${LETTERS[l.letterIndex]}」`);
    }

    if (age === 18 && p.education === 'secondary') {
      const c = yield { kind: 'choice', age, prompt: '十八岁，中学毕业了。', options: [{ id: 'uni', label: '考大学' }, { id: 'work', label: '直接去工作' }] };
      if (c === 'uni') {
        const chance = Math.min(0.95, country.uni * (0.6 + p.stats.knowledge / 100) * (0.8 + 0.1 * p.wealth));
        if (rng() < chance) {
          p.education = 'university';
          p.stats.knowledge += 20;
          yield { kind: 'event', age, text: '你考上了大学，全家人都很高兴。' };
        } else {
          p.stats.happiness -= 10;
          yield { kind: 'event', age, text: '你没考上大学。' };
        }
      }
    }

    if (age === 22) {
      const rank = { none: 0, primary: 0, secondary: 1, university: 2 };
      const jobs = JOBS.filter(j => rank[p.education] >= rank[j.edu] && (!j.knowledge || p.stats.knowledge >= j.knowledge));
      const options = [...jobs].sort(() => rng() - 0.5).slice(0, 3).map(j => ({ id: j.key, label: `当${j.key}` }));
      if (found.business) options.push({ id: 'legacy', label: `去 ${owner(found.business)} 开的${found.business.label}帮工` });
      const c = yield { kind: 'choice', age, prompt: '该找工作了。', options };
      if (c === 'legacy') {
        p.job = `${found.business.label}帮工`;
        p.wealth += 1;
        p.stats.relationships += 10;
        yield touch(found.business, `你在 ${owner(found.business)} 开的${found.business.label}找到了第一份工作，店里的人待你像家人。`);
      } else {
        const job = JOBS.find(j => j.key === c) ?? jobs[0];
        p.job = job.key;
        p.wealth += job.wealth;
        yield { kind: 'event', age, text: `你成了一名${job.key}。` };
      }
    }

    if (age >= 22 && age <= 38 && !p.partner && rng() < 0.12 + p.stats.relationships / 500) {
      const c = yield { kind: 'choice', age, prompt: '你遇到了一个让你心动的人。', options: [{ id: 'marry', label: '和 Ta 结婚' }, { id: 'no', label: '还是算了' }] };
      if (c === 'marry') {
        p.partner = true;
        p.stats.happiness += 15;
        yield { kind: 'event', age, text: '你们结婚了。' };
      }
    }

    if (p.partner && age <= 42 && rng() < 0.06 + 0.03 * (4 - country.income)) {
      p.children += 1;
      p.stats.happiness += 5;
      yield { kind: 'event', age, text: `你的第 ${p.children} 个孩子出生了。` };
    }

    if (age === parkAge && found.park) {
      p.stats.happiness += 8;
      p.stats.health += 5;
      yield touch(found.park, `你常去城边那片树林散步，那是 ${owner(found.park)} 当年种下的。`);
    }

    if (age === 40) {
      const options = [
        { id: 'business', label: '开一家自己的小店', ok: p.wealth >= 2 },
        { id: 'school', label: '去资助一所学校', ok: p.education !== 'none' || p.wealth >= 4 },
        { id: 'clinic', label: '捐钱建一间诊所', ok: p.wealth >= 4 || p.job === '医生' },
        { id: 'park', label: '在城边种一片树', ok: true },
        { id: 'none', label: '不了，把日子过好就行', ok: true },
      ].filter(o => o.ok).map(({ id, label }) => ({ id, label }));
      const c = yield { kind: 'choice', age, prompt: '人到中年。你想给这座城市留下点什么吗？之后投胎到这里的人，可能会遇到它。', options };
      if (c !== 'none' && LEGACY_TYPES[c]) {
        const label = c === 'business' ? pick(rng, BUSINESS_LABELS) : null;
        p.legacy = { type: c, label };
        p.stats.happiness += 10;
        if (c === 'business' || c === 'clinic') p.wealth -= 1;
        yield { kind: 'event', age, text: `你留下了${LEGACY_TYPES[c].title(label)}。` };
      }
    }

    if (age >= 5 && rng() < 0.18) {
      const pool = RANDOM_EVENTS.filter(e => !e.when || e.when(p));
      const e = pickWeighted(rng, pool, ev => ev.w(country));
      e.apply(p);
      yield { kind: 'event', age, text: e.text };
    }

    normalize(p);

    if (rng() < deathChance(country, p, age, clinic)) {
      p.deathAge = age;
      p.cause = causeOfDeath(rng, country, age);
      break;
    }
  }

  if (p.deathAge === null) {
    p.deathAge = 110;
    p.cause = '衰老';
  }

  if (p.deathAge >= 15) {
    const options = [...LETTERS.map((t, i) => ({ id: String(i), label: t })), { id: 'none', label: '什么也不留' }];
    const c = yield { kind: 'choice', age: p.deathAge, prompt: '生命的最后时刻。你想给一个未来的陌生人留一句话吗？', options };
    if (c !== 'none' && LETTERS[Number(c)]) p.letterIndex = Number(c);
  }

  yield { kind: 'event', age: p.deathAge, text: `你在 ${p.deathAge} 岁时死于${p.cause}。` };
}

export function summarize(p) {
  const country = countryById(p.countryId);
  const parts = [`我出生在${country.name}${p.city}一个${WEALTH_LABELS[p.birthWealth] ?? '普通'}的家庭，是个${p.sex === 'M' ? '男孩' : '女孩'}。`];
  if (p.dream) parts.push(`小时候我梦想当${p.dream}${p.job ? `，最后的工作是${p.job}` : ''}。`);
  if (p.partner) parts.push(p.children ? `我结了婚，有 ${p.children} 个孩子。` : '我结了婚。');
  if (p.legacy) parts.push(`我给${p.city}留下了${LEGACY_TYPES[p.legacy.type].title(p.legacy.label)}。`);
  if (p.touched.length) parts.push(`我的一生被 ${p.touched.length} 个前人留下的痕迹改变过。`);
  parts.push(`我在 ${p.deathAge} 岁时死于${p.cause}。`);
  return parts.join('');
}
