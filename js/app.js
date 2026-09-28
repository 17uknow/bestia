(function () {
  'use strict';
  const S = window.Store;
  const D = () => S.data;

  // ---------- utilidades ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => iso(new Date());
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const fmtDay = s => { const d = parse(s); return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`; };
  const fmtShort = s => { const d = parse(s); return `${d.getDate()} ${MON[d.getMonth()]}`; };
  const num = (x, dec = 0) => (x == null || isNaN(x) ? '—' : Number(x).toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
  const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const toNum = v => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };

  const ui = { tab: 'hoy', date: today(), sessionId: null, sheet: null, timer: null, reveal: false, chartEx: null, foodQuery: '', mediaTab: 'fotos' };
  let stopAnim = null;

  // ---------- comida ----------
  function food(id) {
    const c = S.live('foods')[id];
    if (c) return { n: c.n, kcal: c.kcal, p: c.p, c: c.c, f: c.f, custom: true };
    const f = window.FOODS[id];
    return f ? { n: f[0], kcal: f[1], p: f[2], c: f[3], f: f[4] } : null;
  }
  function macros(list) {
    const t = { kcal: 0, p: 0, c: 0, f: 0 };
    for (const [id, g] of list || []) { const f = food(id); if (!f) continue; t.kcal += f.kcal * g / 100; t.p += f.p * g / 100; t.c += f.c * g / 100; t.f += f.f * g / 100; }
    return t;
  }
  function mealItems(e) {
    if (!e || e.out) return [];
    const base = e.code && MEALS[e.code] ? MEALS[e.code].i : [];
    const adj = e.adj || {};
    return base.map(([id, g]) => [id, adj[id] != null ? adj[id] : g]).filter(([, g]) => g > 0).concat(e.extras || []);
  }
  function mealTotals(e, slot) {
    if (!e) return null;
    if (e.out) { const x = OUT_EST[slot][e.out]; return { kcal: x[0], p: x[1], c: x[2], f: x[3] }; }
    return macros(mealItems(e));
  }
  const filled = e => e && (e.code || e.out);
  function dayTotals(day) {
    const t = { kcal: 0, p: 0, c: 0, f: 0, slots: 0 };
    if (!day) return t;
    for (const s of SLOTS) { const e = day.meals && day.meals[s.k]; if (filled(e)) { t.slots++; const m = mealTotals(e, s.k); t.kcal += m.kcal; t.p += m.p; t.c += m.c; t.f += m.f; } }
    const x = macros(day.extras);
    t.kcal += x.kcal; t.p += x.p; t.c += x.c; t.f += x.f;
    return t;
  }
  function getDay(date, create) {
    let d = D().days[date];
    if (!d || d.del) { if (!create) return null; d = D().days[date] = { meals: {}, extras: [], h: {}, u: 0 }; }
    d.meals = d.meals || {}; d.extras = d.extras || []; d.h = d.h || {};
    return d;
  }
  const saveDay = date => { S.touch('days', date); render(); };

  // ---------- programa / semanas ----------
  function startDate() {
    const s = D().settings.startDate;
    if (s) return s;
    const ses = Object.values(S.live('sessions')).map(x => x.date).sort();
    return ses[0] || null;
  }
  function weekOf(date) { const s = startDate(); if (!s) return null; const d = diffDays(s, date); return d < 0 ? 0 : Math.floor(d / 7) + 1; }
  function weekDates(w) { const s = startDate(); const a = addDays(s, (w - 1) * 7); return [0, 1, 2, 3, 4, 5, 6].map(i => addDays(a, i)); }
  function baseline() {
    const b = D().settings.baseWeight;
    if (b) return b;
    const s = startDate();
    const days = S.live('days');
    const ks = Object.keys(days).filter(k => days[k].w && (!s || k >= addDays(s, -7))).sort();
    return ks.length ? days[ks[0]].w : 65;
  }
  function band(x) {
    const B = WEIGHT_BAND;
    if (x >= 12) return [3.0 + 0.2 * (x - 12), 5.5 + 0.35 * (x - 12)];
    for (let i = 1; i < B.length; i++) {
      if (x <= B[i][0]) { const [x0, l0, h0] = B[i - 1], [x1, l1, h1] = B[i]; const t = (x - x0) / (x1 - x0); return [l0 + (l1 - l0) * t, h0 + (h1 - h0) * t]; }
    }
    return [0, 0];
  }
  function sessionsIn(dates) {
    return Object.values(S.live('sessions')).filter(s => dates.includes(s.date) && Object.values(s.sets || {}).some(a => a.some(x => x.done)));
  }
  function weekStats(w) {
    const ds = weekDates(w), days = S.live('days');
    const ws = [], kc = [], pr = [], wat = [], sl = [], en = [];
    let cre = 0, alc = 0, gig = 0, card = 0;
    for (const d of ds) {
      const day = days[d]; if (!day) continue;
      if (day.w) ws.push(day.w);
      const t = dayTotals(day);
      if (t.slots >= 4) { kc.push(t.kcal); pr.push(t.p); }
      const h = day.h || {};
      if (h.water != null) wat.push(h.water);
      if (h.sleep != null) sl.push(h.sleep);
      if (h.creat) cre++;
      alc += h.alc || 0;
      if (h.gig) gig++;
      if (h.energy) en.push(h.energy);
      if (h.cardio && h.cardio !== 'no') card++;
    }
    return { w, ds, weight: avg(ws), nW: ws.length, kcal: avg(kc), prot: avg(pr), nMeals: kc.length, water: avg(wat), sleep: avg(sl), creat: cre, alc, gig, energy: avg(en), cardio: card, sessions: sessionsIn(ds).length, complete: ds[6] < today() };
  }

  // ---------- rutinas y progresión ----------
  function routine(key) {
    const o = S.live('routines')[key];
    const base = ROUTINES[key];
    return o && o.items ? Object.assign({}, base, { items: o.items }) : base;
  }
  function sortedSessions() { return Object.values(S.live('sessions')).sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id)); }
  function nextRoutine() {
    const last = sortedSessions().find(s => Object.values(s.sets || {}).some(a => a.some(x => x.done)));
    const place = last ? last.place : D().settings.place || 'gym';
    return { rid: last ? (last.rid === 'A' ? 'B' : 'A') : 'A', place };
  }
  function lastFor(exId, exceptId) {
    for (const s of sortedSessions()) {
      if (s.id === exceptId) continue;
      const sets = (s.sets && s.sets[exId] || []).filter(x => x.done);
      if (sets.length) return { date: s.date, sets };
    }
    return null;
  }
  function deloadDue(w) {
    if (!w || w < 5) return false;
    const dl = D().settings.deloads || [];
    const lastDl = dl.length ? Math.max(...dl) : 0;
    return w - lastDl >= 5 && !dl.includes(w);
  }
  const setsTxt = sets => sets.map(s => (s.kg != null ? `${num(s.kg, s.kg % 1 ? 1 : 0)}×` : '') + (s.reps != null ? s.reps : '?')).join(' · ');
  function suggest(item, date, exceptId) {
    const ex = EXERCISES[item.ex];
    const wk = weekOf(date) || 1;
    const last = lastFor(item.ex, exceptId);
    if (!last) {
      if (ex.load === 'time') return { text: `Aguanta ${item.time[0]}-${item.time[1]} s con buena técnica.` };
      if (ex.load !== 'kg') return { text: wk <= 2 ? 'Primera vez: haz las reps con buena técnica y apunta cuántas salen.' : 'Primera vez con este ejercicio: apunta reps.' };
      return { text: wk <= 2 ? 'Primera vez: elige un peso con el que te sobren 3-4 reps (RIR 3-4). Mejor quedarte corto que romper la técnica.' : 'Primera vez con este ejercicio: busca un peso con el que te sobren 2-3 reps.' };
    }
    const sets = last.sets;
    const lastTxt = `Última vez (${fmtShort(last.date)}): ${setsTxt(sets)}`;
    if (ex.load === 'time') {
      const hi = item.time[1];
      const all = sets.length >= item.sets && sets.every(s => (s.reps || 0) >= hi);
      return { last: lastTxt, text: all ? `Aguantaste ${hi} s en todas: sube a ${hi + 10} s o levanta un pie.` : `Intenta llegar a ${hi} s en todas.` };
    }
    const [lo, hi] = item.reps;
    const reps = sets.map(s => s.reps || 0);
    const allHigh = sets.length >= item.sets && reps.every(r => r >= hi);
    const anyLow = reps.some(r => r < lo);
    const rirs = sets.map(s => s.rir).filter(r => r != null);
    const easy = rirs.length && rirs.every(r => r >= 4);
    if (ex.load !== 'kg') {
      if (allHigh) return { last: lastTxt, text: ex.load === 'band' ? `Llegaste a ${hi} en todas: usa una banda más dura o baja más lento (3 s).` : `Llegaste a ${hi} en todas: añade dificultad (más lento, pausa abajo o más peso encima).`, reps: hi };
      return { last: lastTxt, text: `Intenta sumar 1 rep por serie hasta llegar a ${hi}.`, reps: Math.min(hi, Math.max(...reps) + 1) };
    }
    const kgs = sets.map(s => s.kg).filter(k => k != null);
    const kg = kgs.length ? Math.max(...kgs) : null;
    if (kg == null) return { last: lastTxt, text: 'La última vez no apuntaste el peso: apúntalo hoy para que pueda calcularte la progresión.' };
    const inc = ex.inc;
    const incTxt = inc ? (inc[0] === inc[1] ? `+${num(inc[0], inc[0] % 1 ? 1 : 0)} kg` : `+${num(inc[0], inc[0] % 1 ? 1 : 0)}-${num(inc[1], 0)} kg`) : '';
    if (wk <= 2) {
      if (easy && inc) return { last: lastTxt, text: `Te sobraban 4 o más reps: sube ${incTxt} (${num(kg + inc[0], 1)} kg).`, kg: kg + inc[0] };
      if (anyLow) return { last: lastTxt, text: `No llegaste a ${lo} en alguna serie: baja un poco el peso. En las semanas 1-2 lo importante es la técnica.`, kg: inc ? Math.max(0, kg - inc[0]) : kg };
      return { last: lastTxt, text: `Semana de aprendizaje: repite ${num(kg, 1)} kg dejando 3-4 reps en reserva.`, kg };
    }
    if (allHigh) {
      if (!inc) return { last: lastTxt, text: `Completaste ${hi} en todas con ${num(kg, 1)} kg: sube reps (hasta ${hi + 5}) o baja más lento (3-4 s).`, kg, reps: hi };
      return { last: lastTxt, text: `🔼 Toca subir: ${incTxt} → ${num(kg + inc[0], 1)} kg.`, kg: kg + inc[0], up: true };
    }
    if (anyLow && avg(reps) < lo - 2 && inc) return { last: lastTxt, text: `Te quedaste lejos de ${lo}: baja a ${num(kg - inc[0], 1)} kg y vuelve a subir cuando completes.`, kg: kg - inc[0] };
    return { last: lastTxt, text: `Repite ${num(kg, 1)} kg e intenta +1 rep por serie hasta llegar a ${hi} en todas.`, kg };
  }

  // ---------- diagnóstico ----------
  function diagnosis() {
    const out = [];
    const s0 = startDate();
    const set = D().settings;
    if (!s0) return [{ lv: 'info', t: 'Aún no has empezado', x: 'La semana 1 arranca el día de tu primer entreno. Hasta entonces puedes ir registrando peso y comidas.' }];
    const wNow = weekOf(today());
    const lw = weekDates(wNow)[6] < today() ? wNow : wNow - 1; // última semana completa
    if (lw < 1) return [{ lv: 'info', t: 'Semana 1 en curso', x: 'La primera revisión saldrá cuando termine la semana 1. Mientras, pésate cada mañana y registra comidas.' }];
    const st = weekStats(lw);
    const prev = lw > 1 ? weekStats(lw - 1) : null;
    const base = baseline();
    if (st.nW < 3) out.push({ lv: 'warning', t: `Solo ${st.nW} pesaje${st.nW === 1 ? '' : 's'} en la semana ${lw}`, x: 'Con menos de 3 pesajes la media semanal es poco fiable. Pésate cada mañana que puedas.' });
    if (st.nMeals < 4) out.push({ lv: 'warning', t: `Solo ${st.nMeals} días con comidas completas`, x: 'Sin registrar al menos 4 días no puedo saber si el problema es lo que comes. Un día cuenta si tiene 4 de las 5 comidas.' });
    const rate = (a, b) => (a && b && a.weight != null && b.weight != null ? a.weight - b.weight : null);
    const r1 = prev ? rate(st, prev) : st.weight != null ? st.weight - base : null;
    const r0 = prev ? (lw > 2 ? rate(prev, weekStats(lw - 2)) : prev.weight != null ? prev.weight - base : null) : null;
    if (st.weight != null) {
      const [lo, hi] = band(lw);
      const gain = st.weight - base;
      if (lw <= 2) out.push({ lv: 'info', t: `Semana ${lw}: ${gain >= 0 ? '+' : ''}${num(gain, 1)} kg`, x: 'Las 2 primeras semanas sube rápido (~1 kg) por agua y glucógeno (creatina + más carbohidrato). No es músculo todavía: no te emociones ni te asustes.' });
      else if (gain < lo) out.push({ lv: 'warning', t: `Por debajo del baremo (${gain >= 0 ? '+' : ''}${num(gain, 1)} kg vs +${num(lo, 1)}-${num(hi, 1)})`, x: 'Vas más lento de lo esperado. Mira abajo si es por calorías, proteína o sueño.' });
      else if (gain > hi) out.push({ lv: 'warning', t: `Por encima del baremo (+${num(gain, 1)} kg vs +${num(lo, 1)}-${num(hi, 1)})`, x: 'Subes más rápido de lo previsto: parte puede ser grasa. Vigila que no sea por días de bolo con mucha comida fuera.' });
      else out.push({ lv: 'good', t: `Dentro del baremo (+${num(gain, 1)} kg)`, x: `En la semana ${lw} lo esperado es +${num(lo, 1)} a +${num(hi, 1)} kg desde el inicio.` });
    }
    if (lw >= 4 && r1 != null && r0 != null) {
      if (r1 < 0.2 && r0 < 0.2) {
        if (st.kcal != null && st.kcal < set.kcal * 0.93) out.push({ lv: 'serious', t: 'No subes, pero tampoco comes lo que toca', x: `2 semanas por debajo de 0,2 kg/sem y comes ${num(st.kcal)} kcal de media (objetivo ${num(set.kcal)}). Antes de subir calorías, llega a las que ya tienes: el problema es la constancia, no el plan.` });
        else out.push({ lv: 'serious', t: 'Toca subir 300 kcal', x: `2 semanas seguidas por debajo de 0,2 kg/sem (${num(r0, 2)} y ${num(r1, 2)}). Súbelo a ${num(set.kcal + 300)} kcal: más arroz o pasta, o una merienda extra.`, act: 'kcal+300' });
      } else if (r1 > 0.5 && r0 > 0.5) out.push({ lv: 'warning', t: 'Subes demasiado rápido: -200 kcal', x: `Más de 0,5 kg/sem dos semanas (${num(r0, 2)} y ${num(r1, 2)}). Recorta a ${num(set.kcal - 200)} kcal para no acumular grasa.`, act: 'kcal-200' });
      else if (r1 >= 0.2 && r1 <= 0.5) out.push({ lv: 'good', t: `Ritmo bueno: ${num(r1, 2)} kg/sem`, x: 'Estás en el ritmo objetivo de 0,2-0,35 kg por semana (hasta 0,5 es aceptable).' });
    }
    if (st.kcal != null && st.kcal < set.kcal * 0.93 && !out.some(o => o.t.includes('comes lo que toca'))) out.push({ lv: 'warning', t: `Calorías bajas: ${num(st.kcal)} kcal/día`, x: `Objetivo ${num(set.kcal)}. Te faltan ~${num(set.kcal - st.kcal)} kcal al día: sube la ración de arroz o pasta (+50 g en seco ≈ +180 kcal), añade la media mañana si te la saltas o mete un extra de cacahuetes o plátano.` });
    if (st.prot != null && st.prot < set.prot * 0.9) out.push({ lv: 'warning', t: `Proteína baja: ${num(st.prot)} g/día`, x: `Objetivo ${set.prot} g. Te faltan ~${num(set.prot - st.prot)} g: un yogur griego (+22 g), 2 huevos (+13 g) o un batido (+23 g) en la merienda.` });
    if (st.sessions < 2) out.push({ lv: st.sessions === 0 ? 'serious' : 'warning', t: `${st.sessions} entreno${st.sessions === 1 ? '' : 's'} esta semana`, x: 'Sin los 2 días de fuerza, las calorías extra se van a grasa en vez de a músculo. Si es semana de bolos, haz al menos la versión de casa.' });
    if (st.sleep != null && st.sleep < 6.5) out.push({ lv: 'warning', t: `Duermes ${num(st.sleep, 1)} h de media`, x: 'Con menos de 6,5 h se recupera peor y se gana menos músculo. Una siesta de 20 min ayuda, pero no sustituye a la noche.' });
    if (st.water != null && st.water < 2) out.push({ lv: 'warning', t: `Agua: ${num(st.water, 1)} L/día`, x: 'Objetivo 2,5-3 L. Con creatina, beber poco da más molestias y peor rendimiento.' });
    if (st.creat < 6) out.push({ lv: 'warning', t: `Creatina: ${st.creat}/7 días`, x: 'Funciona por acumulación: tómala todos los días, también los de descanso. Métela en el café o en la merienda.' });
    if (st.alc > 4) out.push({ lv: 'warning', t: `${st.alc} copas esta semana`, x: 'El alcohol empeora el sueño y la síntesis de proteína. Intenta que no pase de 2 por bolo.' });
    if (st.energy != null && st.energy <= 2.5) out.push({ lv: 'warning', t: `Energía baja (${num(st.energy, 1)}/5)`, x: 'Si se junta con mal sueño o rendimiento que baja en el gym, puede tocar semana de descarga (-20 % de peso).' });
    // casa vs gira (últimas 4 semanas)
    const cmp = gigCompare(Math.max(1, lw - 3), lw);
    if (cmp.gig.n >= 2 && cmp.home.n >= 2) {
      if (cmp.gig.kcal != null && cmp.home.kcal != null && cmp.gig.kcal < cmp.home.kcal * 0.85) out.push({ lv: 'warning', t: `En días de bolo comes un ${num((1 - cmp.gig.kcal / cmp.home.kcal) * 100)} % menos`, x: 'El fallo está en las semanas de gira. Lleva snacks portátiles (A3, A8, batido) y usa la plantilla de comida fuera.' });
      if (cmp.gig.sleep != null && cmp.home.sleep != null && cmp.home.sleep - cmp.gig.sleep >= 1) out.push({ lv: 'info', t: `En días de bolo duermes ${num(cmp.home.sleep - cmp.gig.sleep, 1)} h menos`, x: 'Normal por el curro, pero compénsalo: siesta al día siguiente y nada de entrenar pesado tras una noche de 4 h.' });
    }
    if (!out.some(o => o.lv !== 'good' && o.lv !== 'info')) out.push({ lv: 'good', t: 'Todo en orden', x: 'No veo nada que corregir esta semana. Sigue igual.' });
    return out;
  }
  function gigCompare(w0, w1) {
    const days = S.live('days');
    const acc = { gig: { k: [], p: [], s: [], wa: [], a: [], n: 0 }, home: { k: [], p: [], s: [], wa: [], a: [], n: 0 } };
    for (let w = w0; w <= w1; w++) for (const d of weekDates(w)) {
      const day = days[d]; if (!day || d > today()) continue;
      const g = day.h && day.h.gig ? acc.gig : acc.home;
      const t = dayTotals(day);
      let any = false;
      if (t.slots >= 4) { g.k.push(t.kcal); g.p.push(t.p); any = true; }
      if (day.h && day.h.sleep != null) { g.s.push(day.h.sleep); any = true; }
      if (day.h && day.h.water != null) g.wa.push(day.h.water);
      if (day.h && day.h.alc != null) g.a.push(day.h.alc);
      if (any) g.n++;
    }
    const f = g => ({ n: g.n, kcal: avg(g.k), prot: avg(g.p), sleep: avg(g.s), water: avg(g.wa), alc: avg(g.a) });
    return { gig: f(acc.gig), home: f(acc.home) };
  }

  // ---------- componentes ----------
  const ICON = {
    hoy: '<svg viewBox="0 0 24 24"><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/><circle cx="12" cy="12" r="4.2"/></svg>',
    entreno: '<svg viewBox="0 0 24 24"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>',
    progreso: '<svg viewBox="0 0 24 24"><path d="M4 19h16"/><path d="M5 15l4.5-5 3.5 3 6-7"/><path d="M15 6h4v4"/></svg>',
    ajustes: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
    swap: '<svg viewBox="0 0 24 24"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    left: '<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    cloud: '<svg viewBox="0 0 24 24"><path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  };
  const LV = { good: ['✓', 'Bien'], warning: ['!', 'Ojo'], serious: ['!!', 'Corregir'], critical: ['✕', 'Mal'], info: ['i', 'Info'] };
  const status = (lv, label) => `<span class="st st-${lv}"><b>${LV[lv][0]}</b>${esc(label || LV[lv][1])}</span>`;

  function bar(val, target, label, unit, dec = 0) {
    const pct = target ? Math.min(1.25, (val || 0) / target) : 0;
    const lv = val == null ? 'info' : pct >= 0.93 && pct <= 1.1 ? 'good' : pct >= 0.8 ? 'warning' : 'serious';
    return `<div class="mbar"><div class="mbar-top"><span>${label}</span><span class="mono">${num(val, dec)}<small> / ${num(target, dec)} ${unit}</small></span></div>
      <div class="mbar-track"><div class="mbar-fill lv-${lv}" style="width:${Math.min(100, pct * 100).toFixed(1)}%"></div></div></div>`;
  }

  // Gráfica de línea con franja opcional + tooltip (SVG propio)
  const charts = {};
  function lineChart(id, opt) {
    const W = 340, H = 200, L = 36, R = 12, T = 12, B = 26;
    const pts = opt.pts;
    const xs = pts.map(p => p.x).concat(opt.band ? opt.band.map(b => b[0]) : []);
    const ys = pts.map(p => p.y).concat(opt.band ? opt.band.flatMap(b => [b[1], b[2]]) : []);
    const x0 = opt.x0 != null ? opt.x0 : Math.min(...xs), x1 = opt.x1 != null ? opt.x1 : Math.max(...xs, x0 + 1);
    let y0 = Math.min(...ys), y1 = Math.max(...ys);
    const padY = Math.max(0.5, (y1 - y0) * 0.12); y0 -= padY; y1 += padY;
    const sx = x => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R);
    const sy = y => T + (1 - (y - y0) / (y1 - y0 || 1)) * (H - T - B);
    const ticks = []; const step = niceStep((y1 - y0) / 4);
    for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) ticks.push(v);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" data-chart="${id}" role="img" aria-label="${esc(opt.aria || '')}">`;
    for (const v of ticks) s += `<line x1="${L}" x2="${W - R}" y1="${sy(v).toFixed(1)}" y2="${sy(v).toFixed(1)}" class="grid"/><text x="${L - 6}" y="${(sy(v) + 3.5).toFixed(1)}" class="axis" text-anchor="end">${num(v, step < 1 ? 1 : 0)}</text>`;
    const xt = opt.xTicks || [];
    for (const [v, lab] of xt) s += `<text x="${sx(v).toFixed(1)}" y="${H - 8}" class="axis" text-anchor="middle">${esc(lab)}</text>`;
    if (opt.band && opt.band.length) {
      const up = opt.band.map(b => `${sx(b[0]).toFixed(1)},${sy(b[2]).toFixed(1)}`);
      const dn = opt.band.slice().reverse().map(b => `${sx(b[0]).toFixed(1)},${sy(b[1]).toFixed(1)}`);
      s += `<polygon points="${up.concat(dn).join(' ')}" class="bandf"/>`;
    }
    if (pts.length > 1) s += `<polyline points="${pts.map(p => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')}" class="ln"/>`;
    for (const p of pts) s += `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="4" class="dot"/>`;
    s += `<line class="xh" x1="0" x2="0" y1="${T}" y2="${H - B}" style="display:none"/><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" class="hit"/></svg>`;
    charts[id] = { pts, sx, sy, W, H, tip: opt.tip };
    return `<div class="chart-wrap">${s}<div class="tip" hidden></div></div>`;
  }
  function niceStep(r) { const p = Math.pow(10, Math.floor(Math.log10(r || 1))); const n = r / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
  function chartHover(e) {
    const svg = e.target.closest && e.target.closest('svg[data-chart]');
    document.querySelectorAll('.chart-wrap .tip').forEach(t => { if (!svg || t.parentNode !== svg.parentNode) t.hidden = true; });
    if (!svg) return;
    const c = charts[svg.dataset.chart]; if (!c || !c.pts.length) return;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * c.W;
    let best = c.pts[0];
    for (const p of c.pts) if (Math.abs(c.sx(p.x) - x) < Math.abs(c.sx(best.x) - x)) best = p;
    const xh = svg.querySelector('.xh');
    xh.style.display = ''; xh.setAttribute('x1', c.sx(best.x)); xh.setAttribute('x2', c.sx(best.x));
    const tip = svg.parentNode.querySelector('.tip');
    tip.hidden = false; tip.innerHTML = c.tip(best);
    const px = (c.sx(best.x) / c.W) * r.width, py = (c.sy(best.y) / c.H) * r.height;
    tip.style.left = Math.min(r.width - 150, Math.max(0, px - 75)) + 'px';
    tip.style.top = Math.max(0, py - 62) + 'px';
  }

  // ---------- vistas ----------
  function render() {
    const main = $('#main');
    if (stopAnim && !ui.sheet) { stopAnim(); stopAnim = null; }
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === ui.tab));
    let html = '';
    if (ui.tab === 'hoy') html = viewHoy();
    else if (ui.tab === 'entreno') html = ui.sessionId && D().sessions[ui.sessionId] && !D().sessions[ui.sessionId].del ? viewSession() : viewEntreno();
    else if (ui.tab === 'progreso') html = viewProgreso();
    else html = viewAjustes();
    main.innerHTML = html;
    renderSync();
    renderTimer();
    renderSheet();
  }

  function renderSync() {
    const b = $('#sync');
    const st = S.connected() ? S.syncState : 'off';
    const lab = { off: 'Sin sincronizar', idle: 'Dropbox', syncing: 'Sincronizando…', ok: 'Sincronizado', error: 'Error de sincronización' }[st];
    b.className = 'sync glass s-' + st;
    b.innerHTML = ICON.cloud + `<span>${lab}</span>`;
    b.title = S.lastError || lab;
  }

  function banners() {
    const out = [];
    const t = today();
    if (ui.date !== t) return out;
    const day = getDay(t);
    const hr = new Date().getHours();
    const w = weekOf(t);
    if (!(day && day.w) && hr < 14) out.push(`<div class="banner glass">⚖️ <div><b>Pésate</b> antes del café y la creatina (en ayunas y después de mear).</div></div>`);
    if (!(day && day.h && day.h.creat) && hr >= 10) out.push(`<div class="banner glass">💊 <div><b>Creatina</b>: todavía no la has marcado hoy.</div><button class="chip" data-a="habit" data-k="creat" data-v="1">Tomada</button></div>`);
    const y = getDay(addDays(t, -1));
    const ys = y ? dayTotals(y).slots : 0;
    if (startDate() && ys < 4 && addDays(t, -1) >= startDate()) out.push(`<div class="banner glass">🍽️ <div>Ayer registraste <b>${ys}/5</b> comidas.</div><button class="chip" data-a="goDate" data-d="${addDays(t, -1)}">Completar</button></div>`);
    const nr = nextRoutine();
    const doneToday = sortedSessions().some(s => s.date === t);
    if (!doneToday) out.push(`<div class="banner glass">🏋️ <div>Próximo entreno: <b>Día ${nr.rid}</b> (${nr.place})</div><button class="chip" data-a="tab" data-tab="entreno">Ver</button></div>`);
    if (deloadDue(w)) out.push(`<div class="banner glass">🔋 <div>Llevas ${w - 1} semanas. Si notas fatiga, articulaciones cargadas o que el rendimiento baja, haz <b>semana de descarga</b> (-20 % de peso).</div><button class="chip" data-a="deload" data-w="${w}">Esta semana</button></div>`);
    const ms = Object.keys(S.live('measures')).sort();
    const lastM = ms[ms.length - 1];
    if (startDate() && (!lastM || diffDays(lastM, t) >= 28)) out.push(`<div class="banner glass">📏 <div>Toca <b>medidas y foto</b> (cada 4 semanas).</div><button class="chip" data-a="sheet" data-s="measure">Añadir</button></div>`);
    if (parse(t).getDay() === 3 && startDate()) out.push(`<div class="banner glass">📊 <div>Miércoles: <b>revisión semanal</b>.</div><button class="chip" data-a="tab" data-tab="progreso">Ver</button></div>`);
    if (!S.connected()) out.push(`<div class="banner glass">☁️ <div>Los datos solo están en este dispositivo. <b>Conecta Dropbox</b> para tenerlos en todos.</div><button class="chip" data-a="tab" data-tab="ajustes">Conectar</button></div>`);
    return out;
  }

  function viewHoy() {
    const date = ui.date, t = today();
    const day = getDay(date) || { meals: {}, extras: [], h: {} };
    const w = weekOf(date);
    const set = D().settings;
    const tot = dayTotals(day);
    const h = day.h || {};
    const plan = WEEK_PLAN[parse(date).getDay()];
    // peso de la semana (media)
    let wkTxt = '';
    if (w) { const st = weekStats(w); wkTxt = st.nW ? `Media semana ${w}: <b>${num(st.weight, 1)} kg</b> <small>(${st.nW}/7 pesajes)</small>` : `Semana ${w}: sin pesajes todavía`; }
    const weighed = day.w != null;
    const slots = SLOTS.map(s => {
      const e = day.meals[s.k];
      const m = filled(e) ? mealTotals(e, s.k) : null;
      const sug = plan && plan[s.k];
      const title = e && e.out ? `Fuera / libre · ${e.out}` : e && e.code ? `<span class="code">${e.code}</span> ${esc(MEALS[e.code].n)}` : `<span class="muted">Sin registrar${sug ? ` · toca ${sug}` : ''}</span>`;
      const mods = e && e.code && ((e.extras && e.extras.length) || Object.keys(e.adj || {}).length) ? ' <span class="tag">ajustado</span>' : '';
      return `<button class="row slot" data-a="sheet" data-s="meal" data-k="${s.k}">
        <div class="slot-l"><small>${s.name}</small><div>${title}${mods}</div></div>
        <div class="slot-r mono">${m ? `${num(m.kcal)}<small> kcal</small><br><small>${num(m.p)} g prot</small>` : ICON.plus}</div></button>`;
    }).join('');
    const extras = (day.extras || []).map((x, i) => { const f = food(x[0]); const m = macros([x]); return `<div class="row"><div>${esc(f ? f.n : x[0])} <small class="muted">${x[1]} g</small></div><div class="mono">${num(m.kcal)} kcal <button class="ib" data-a="rmExtra" data-i="${i}" aria-label="Quitar">${ICON.trash}</button></div></div>`; }).join('');
    const energy = [1, 2, 3, 4, 5].map(n => `<button class="seg ${h.energy === n ? 'on' : ''}" data-a="habit" data-k="energy" data-v="${n}">${n}</button>`).join('');
    const cardio = [['no', 'No'], ['boxeo', 'Boxeo'], ['cardio', 'Cardio']].map(([v, l]) => `<button class="seg ${(h.cardio || 'no') === v ? 'on' : ''}" data-a="habit" data-k="cardio" data-v="${v}">${l}</button>`).join('');
    return `
      <header class="dayhead">
        <button class="ib glass" data-a="dateNav" data-n="-1" aria-label="Día anterior">${ICON.left}</button>
        <div class="dayhead-c"><h1>${date === t ? 'Hoy' : cap(fmtDay(date))}</h1><small>${date === t ? cap(fmtDay(date)) : ''}${w ? ` · Semana ${w}` : ' · Antes de empezar'}</small></div>
        <button class="ib glass" data-a="dateNav" data-n="1" ${date >= t ? 'disabled' : ''} aria-label="Día siguiente">${ICON.right}</button>
      </header>
      ${banners().join('')}
      <section class="card glass">
        <div class="card-h"><h2>Peso</h2><small class="muted">en ayunas</small></div>
        ${weighed && !ui.editW ? `<div class="row"><div>${ui.reveal ? `<b class="mono big">${num(day.w, 1)} kg</b>` : `<b>Registrado ✓</b> <small class="muted">(oculto)</small>`}</div>
          <div><button class="ib" data-a="reveal" aria-label="Mostrar">${ICON.eye}</button><button class="ib" data-a="editW" aria-label="Editar">${ICON.edit}</button></div></div>`
        : `<form class="wform" data-f="weight"><input name="w" type="number" inputmode="decimal" step="0.1" min="30" max="200" placeholder="65,0" value="${weighed ? day.w : ''}" aria-label="Peso en kg"><span>kg</span><button class="btn pri">Guardar</button></form>`}
        <p class="muted small">${wkTxt}</p>
      </section>
      <section class="card glass">
        <div class="card-h"><h2>Comidas</h2><small class="muted">${tot.slots}/5</small></div>
        ${slots}
        <div class="card-h sub"><h3>Extras / picoteo</h3><button class="chip" data-a="sheet" data-s="food" data-target="day">${ICON.plus} Añadir</button></div>
        ${extras || '<p class="muted small">Nada fuera de las comidas.</p>'}
      </section>
      <section class="card glass">
        <div class="card-h"><h2>Resumen del día</h2></div>
        ${bar(tot.kcal, set.kcal, 'Calorías', 'kcal')}
        ${bar(tot.p, set.prot, 'Proteína', 'g')}
        ${bar(tot.c, set.carb, 'Carbohidratos', 'g')}
        ${bar(tot.f, set.fat, 'Grasa', 'g')}
      </section>
      <section class="card glass">
        <div class="card-h"><h2>Hábitos</h2></div>
        <div class="hrow"><span>💧 Agua</span><div class="stepper"><button data-a="step" data-k="water" data-d="-0.25">−</button><b class="mono">${num(h.water || 0, 2)} L</b><button data-a="step" data-k="water" data-d="0.25">+</button></div></div>
        <div class="hrow"><span>💊 Creatina</span><button class="toggle ${h.creat ? 'on' : ''}" data-a="habit" data-k="creat" data-v="${h.creat ? 0 : 1}" aria-pressed="${!!h.creat}"><i></i></button></div>
        <div class="hrow"><span>😴 Sueño</span><div class="stepper"><button data-a="step" data-k="sleep" data-d="-0.5">−</button><b class="mono">${h.sleep != null ? num(h.sleep, 1) + ' h' : '—'}</b><button data-a="step" data-k="sleep" data-d="0.5">+</button></div></div>
        <div class="hrow"><span>🍸 Copas</span><div class="stepper"><button data-a="step" data-k="alc" data-d="-1">−</button><b class="mono">${h.alc || 0}</b><button data-a="step" data-k="alc" data-d="1">+</button></div></div>
        <div class="hrow"><span>🎧 Bolo / viaje</span><button class="toggle ${h.gig ? 'on' : ''}" data-a="habit" data-k="gig" data-v="${h.gig ? 0 : 1}" aria-pressed="${!!h.gig}"><i></i></button></div>
        <div class="hrow"><span>⚡ Energía</span><div class="segs">${energy}</div></div>
        <div class="hrow"><span>🥊 Boxeo / cardio</span><div class="segs">${cardio}</div></div>
      </section>`;
  }

  function viewEntreno() {
    const nr = nextRoutine();
    const place = ui.place || nr.place;
    const w = weekOf(today());
    const cards = ['A', 'B'].map(rid => {
      const key = `${rid}-${place}`, r = routine(key);
      const list = r.items.map((it, i) => `<li><span>${esc(EXERCISES[it.ex].n)}</span><small class="mono">${it.sets}×${it.time ? `${it.time[0]}-${it.time[1]}s` : it.fail ? 'fallo' : `${it.reps[0]}${it.reps[1] !== it.reps[0] ? '-' + it.reps[1] : ''}`}${it.ss ? ' ⟶' : ''}</small></li>`).join('');
      return `<section class="card glass ${nr.rid === rid ? 'next' : ''}">
        <div class="card-h"><h2>${esc(r.name)}</h2>${nr.rid === rid ? '<span class="tag">te toca</span>' : ''}</div>
        <ol class="exlist">${list}</ol>
        <p class="muted small">Calienta 5-10 min (movilidad + cardio suave). ⟶ = superserie con el siguiente.</p>
        <button class="btn pri wide" data-a="startSession" data-rid="${rid}" data-place="${place}">Empezar ${esc(r.name.split('·')[0].trim())}</button>
      </section>`;
    }).join('');
    const hist = sortedSessions().slice(0, 8).map(s => {
      const n = Object.values(s.sets || {}).reduce((a, x) => a + x.filter(y => y.done).length, 0);
      return `<button class="row" data-a="openSession" data-id="${s.id}"><div><b>Día ${s.rid}</b> <small class="muted">${s.place} · ${fmtDay(s.date)}</small></div><div class="mono small">${n} series ${s.done ? '✓' : '<span class="tag">abierta</span>'}</div></button>`;
    }).join('');
    const lib = Object.entries(EXERCISES).map(([id, e]) => `<button class="row" data-a="sheet" data-s="exercise" data-ex="${id}"><div>${esc(e.n)}<br><small class="muted">${e.p.map(m => MUSCLE_NAMES[m]).join(', ')}</small></div>${ICON.info}</button>`).join('');
    return `
      <header class="phead"><h1>Entrenar</h1><small class="muted">${w ? `Semana ${w}${w <= 2 ? ' · aprendizaje (RIR 3-4)' : ' · RIR 1-2'}` : 'Tu primer entreno marcará el inicio de la semana 1'}</small></header>
      <div class="segs big glass">${['gym', 'casa'].map(p => `<button class="seg ${place === p ? 'on' : ''}" data-a="place" data-p="${p}">${p === 'gym' ? 'Gimnasio' : 'Casa'}</button>`).join('')}</div>
      ${deloadDue(w) ? `<div class="banner glass">🔋 <div>Semana ${w}: si notas fatiga, esta semana baja un 20 % los pesos (descarga).</div><button class="chip" data-a="deload" data-w="${w}">Hacer descarga</button></div>` : ''}
      ${cards}
      ${hist ? `<section class="card glass"><div class="card-h"><h2>Historial</h2></div>${hist}</section>` : ''}
      <section class="card glass"><div class="card-h"><h2>Biblioteca de ejercicios</h2></div><details><summary>Ver los ${Object.keys(EXERCISES).length} ejercicios</summary>${lib}</details></section>`;
  }

  function viewSession() {
    const s = D().sessions[ui.sessionId];
    const w = weekOf(s.date) || 1;
    const dl = (D().settings.deloads || []).includes(w);
    const items = s.items.map((it, i) => {
      const ex = EXERCISES[it.ex];
      const sg = suggest(it, s.date, s.id);
      const sets = (s.sets[it.ex] = s.sets[it.ex] || []);
      while (sets.length < it.sets) sets.push({});
      const tgt = it.time ? `${it.time[0]}-${it.time[1]} s` : it.fail ? `al fallo (${it.reps[0]}-${it.reps[1]})` : `${it.reps[0]}${it.reps[1] !== it.reps[0] ? '-' + it.reps[1] : ''} reps`;
      const kgPh = sg.kg != null ? num(dl ? sg.kg * 0.8 : sg.kg, 1) : ex.load === 'band' ? 'banda' : '';
      const rows = sets.map((st, j) => { const prev = sets[j - 1] || {}; const kph = prev.kg != null ? num(prev.kg, prev.kg % 1 ? 1 : 0) : kgPh; return `
        <div class="set ${st.done ? 'done' : ''}">
          <span class="set-n">${j + 1}</span>
          ${ex.load === 'kg' || ex.load === 'band' ? `<label class="fld"><input type="number" inputmode="decimal" step="0.5" data-in="set" data-ex="${it.ex}" data-j="${j}" data-f="kg" value="${st.kg != null ? st.kg : ''}" placeholder="${kph}"><small>${ex.load === 'band' ? 'banda' : 'kg'}</small></label>` : '<span class="fld ghost">peso corp.</span>'}
          <label class="fld"><input type="number" inputmode="numeric" step="1" data-in="set" data-ex="${it.ex}" data-j="${j}" data-f="reps" value="${st.reps != null ? st.reps : ''}" placeholder="${it.time ? it.time[1] : sg.reps || it.reps[1]}"><small>${it.time ? 's' : ex.uni ? 'reps/p' : 'reps'}</small></label>
          <select data-in="set" data-ex="${it.ex}" data-j="${j}" data-f="rir" aria-label="Repeticiones en reserva"><option value="">RIR</option>${[0, 1, 2, 3, 4].map(r => `<option value="${r}" ${st.rir === r ? 'selected' : ''}>${r}${r === 4 ? '+' : ''}</option>`).join('')}</select>
          <button class="ck ${st.done ? 'on' : ''}" data-a="setDone" data-ex="${it.ex}" data-j="${j}" data-i="${i}" aria-label="Serie hecha">${ICON.check}</button>
        </div>`; }).join('');
      return `<section class="card glass ex ${it.ss ? 'ss' : ''}">
        <div class="card-h"><div><small class="muted">${i + 1}${it.ss ? ' · superserie ⟶' : s.items[i - 1] && s.items[i - 1].ss ? ' · superserie' : ''}</small><h2>${esc(ex.n)}</h2></div>
          <div class="acts"><button class="ib" data-a="sheet" data-s="exercise" data-ex="${it.ex}" aria-label="Cómo se hace">${ICON.info}</button><button class="ib" data-a="sheet" data-s="swap" data-i="${i}" aria-label="Sustituir">${ICON.swap}</button><button class="ib" data-a="sheet" data-s="editItem" data-i="${i}" aria-label="Editar series">${ICON.edit}</button></div></div>
        <p class="small"><b class="mono">${it.sets} × ${tgt}</b> · descanso ${it.rest[0]}-${it.rest[1]} s${it.note ? ` · <span class="muted">${esc(it.note)}</span>` : ''}</p>
        ${sg.last ? `<p class="small muted">${esc(sg.last)}</p>` : ''}
        <p class="sug ${sg.up ? 'up' : ''}">${esc(sg.text)}${dl && sg.kg != null ? ` <b>Descarga: ${num(sg.kg * 0.8, 1)} kg</b>` : ''}</p>
        ${rows}
        <div class="setbtns"><button class="chip" data-a="addSet" data-ex="${it.ex}">${ICON.plus} Serie</button>${sets.length > 1 ? `<button class="chip" data-a="rmSet" data-ex="${it.ex}">− Serie</button>` : ''}</div>
      </section>`;
    }).join('');
    return `
      <header class="phead row0"><button class="ib glass" data-a="closeSession" aria-label="Volver">${ICON.left}</button>
        <div><h1>Día ${s.rid} <small class="muted">${s.place}</small></h1><small class="muted">${cap(fmtDay(s.date))} · semana ${w}${dl ? ' · descarga' : ''}</small></div></header>
      ${items}
      <button class="btn pri wide big" data-a="finishSession">${s.done ? 'Guardado ✓ · Volver' : 'Terminar entreno'}</button>
      <button class="btn ghost wide" data-a="deleteSession">Borrar esta sesión</button>`;
  }

  function viewProgreso() {
    const s0 = startDate();
    const set = D().settings;
    const wNow = s0 ? weekOf(today()) : 0;
    // peso
    const base = baseline();
    const pts = [];
    for (let w = 1; w <= wNow; w++) { const st = weekStats(w); if (st.weight != null) pts.push({ x: w, y: st.weight, n: st.nW }); }
    const xMax = Math.max(12, wNow + 1);
    const bandPts = [];
    for (let x = 0; x <= xMax; x++) { const [lo, hi] = band(x); bandPts.push([x, base + lo, base + hi]); }
    const xTicks = []; for (let x = 0; x <= xMax; x += xMax > 16 ? 4 : 2) xTicks.push([x, x === 0 ? 'inicio' : 'S' + x]);
    const wChart = lineChart('weight', {
      pts, band: bandPts, x0: 0, x1: xMax, xTicks, aria: 'Media semanal de peso frente al baremo esperado',
      tip: p => { const [lo, hi] = band(p.x); return `<b>Semana ${p.x}</b><br>Media: ${num(p.y, 1)} kg (${p.n} pesajes)<br><span class="muted">Baremo: ${num(base + lo, 1)}-${num(base + hi, 1)} kg</span>`; },
    });
    // semáforo semana actual / última
    const lw = s0 ? (weekDates(wNow)[6] < today() ? wNow : Math.max(1, wNow)) : 0;
    let sem = '';
    if (s0) {
      const st = weekStats(lw);
      const rowLv = (v, t, lo, hi) => v == null ? 'info' : v >= t * lo && v <= t * hi ? 'good' : v >= t * (lo - 0.1) ? 'warning' : 'serious';
      const rows = [
        ['Calorías (media)', st.kcal != null ? `${num(st.kcal)} kcal` : 'sin datos', `${num(set.kcal)}`, rowLv(st.kcal, set.kcal, 0.93, 1.1)],
        ['Proteína (media)', st.prot != null ? `${num(st.prot)} g` : 'sin datos', `${set.prot} g`, rowLv(st.prot, set.prot, 0.9, 2)],
        ['Entrenos de fuerza', `${st.sessions}`, '2', st.sessions >= 2 ? 'good' : st.sessions === 1 ? 'warning' : 'serious'],
        ['Agua (media)', st.water != null ? `${num(st.water, 1)} L` : 'sin datos', `${num(set.water, 1)} L`, rowLv(st.water, set.water, 0.9, 3)],
        ['Sueño (media)', st.sleep != null ? `${num(st.sleep, 1)} h` : 'sin datos', `${set.sleep} h`, rowLv(st.sleep, set.sleep, 0.93, 3)],
        ['Creatina', `${st.creat}/7`, '7/7', st.creat >= 6 ? 'good' : st.creat >= 4 ? 'warning' : 'serious'],
        ['Copas', `${st.alc}`, '≤ 4', st.alc <= 4 ? 'good' : 'warning'],
        ['Boxeo / cardio', `${st.cardio}`, '—', 'info'],
      ];
      sem = `<table class="tbl"><thead><tr><th>Semana ${lw}${st.complete ? '' : ' (en curso)'}</th><th>Real</th><th>Objetivo</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><td>${r[0]}</td><td class="mono">${r[1]}</td><td class="mono muted">${r[2]}</td><td>${status(r[3])}</td></tr>`).join('')}</tbody></table>
        <p class="muted small">Pesajes: ${st.nW}/7 · días con comidas completas: ${st.nMeals}/7 · días de bolo: ${st.gig}</p>`;
    }
    // diagnóstico
    const dg = diagnosis().map(d => `<div class="diag lv-${d.lv}">${status(d.lv)}<div><b>${esc(d.t)}</b><p>${esc(d.x)}</p>${d.act ? `<button class="chip" data-a="applyKcal" data-v="${d.act}">Aplicar</button>` : ''}</div></div>`).join('');
    // fuerza
    const done = {};
    for (const s of Object.values(S.live('sessions'))) for (const [ex, sets] of Object.entries(s.sets || {})) if (sets.some(x => x.done)) (done[ex] = done[ex] || []).push({ date: s.date, sets: sets.filter(x => x.done) });
    const exIds = Object.keys(done).filter(e => EXERCISES[e]);
    let str = '<p class="muted small">Cuando registres entrenos, aquí verás la evolución de cada ejercicio.</p>';
    if (exIds.length) {
      const sel = ui.chartEx && done[ui.chartEx] ? ui.chartEx : exIds[0];
      const ex = EXERCISES[sel];
      const list = done[sel].sort((a, b) => a.date.localeCompare(b.date));
      const metric = x => ex.load === 'kg' ? Math.max(...x.sets.map(s => s.kg || 0)) : Math.max(...x.sets.map(s => s.reps || 0));
      const unit = ex.load === 'kg' ? 'kg' : ex.load === 'time' ? 's' : 'reps';
      const d0 = list[0].date;
      const p2 = list.map(x => ({ x: diffDays(d0, x.date), y: metric(x), date: x.date, sets: x.sets }));
      const span = Math.max(7, p2[p2.length - 1].x);
      const xt = [[0, fmtShort(d0)], [span, fmtShort(addDays(d0, span))]];
      str = `<select class="sel" data-in="chartEx">${exIds.map(e => `<option value="${e}" ${e === sel ? 'selected' : ''}>${esc(EXERCISES[e].n)}</option>`).join('')}</select>
        ${lineChart('str', { pts: p2, x0: 0, x1: span, xTicks: xt, aria: 'Evolución de ' + ex.n, tip: p => `<b>${fmtShort(p.date)}</b><br>${ex.load === 'kg' ? 'Serie más pesada' : 'Mejor serie'}: ${num(p.y, 1)} ${unit}<br><span class="muted">${setsTxt(p.sets)}</span>` })}
        <p class="muted small">${ex.load === 'kg' ? 'Peso de la serie más pesada' : 'Mejor serie'} por sesión (${unit}).</p>`;
    }
    // medidas
    const ms = S.live('measures');
    const mk = Object.keys(ms).sort().reverse();
    const mrows = mk.map(k => { const m = ms[k]; return `<tr><td>${fmtShort(k)}</td><td class="mono">${num(m.chest, 1)}</td><td class="mono">${num(m.arm, 1)}</td><td class="mono">${num(m.waist, 1)}</td><td>${m.photo ? `<button class="chip" data-a="photo" data-p="${esc(m.photo)}">Foto</button>` : ''}</td></tr>`; }).join('');
    // casa vs gira
    let cmpHtml = '<p class="muted small">Cuando tengas días marcados como bolo y días normales, aquí verás la comparación.</p>';
    if (s0) {
      const c = gigCompare(Math.max(1, wNow - 7), wNow);
      if (c.gig.n && c.home.n) {
        const r = (lab, a, b, dec, u) => `<tr><td>${lab}</td><td class="mono">${num(b, dec)}${u}</td><td class="mono">${num(a, dec)}${u}</td></tr>`;
        cmpHtml = `<table class="tbl"><thead><tr><th>Media por día</th><th>Casa (${c.home.n} d)</th><th>Bolo/viaje (${c.gig.n} d)</th></tr></thead><tbody>
          ${r('Calorías', c.gig.kcal, c.home.kcal, 0, '')}${r('Proteína', c.gig.prot, c.home.prot, 0, ' g')}${r('Sueño', c.gig.sleep, c.home.sleep, 1, ' h')}${r('Agua', c.gig.water, c.home.water, 1, ' L')}${r('Copas', c.gig.alc, c.home.alc, 1, '')}</tbody></table>
          <p class="muted small">Últimas 8 semanas.</p>`;
      }
    }
    return `
      <header class="phead"><h1>Progreso</h1><small class="muted">${s0 ? `Semana ${wNow} · inicio ${fmtShort(s0)} · base ${num(base, 1)} kg` : 'Empieza con tu primer entreno'}</small></header>
      <section class="card glass"><div class="card-h"><h2>Peso: media semanal</h2></div>
        ${pts.length ? wChart : `<div class="empty">${wChart}<p class="muted small">Todavía no hay semanas con pesajes. La franja es el baremo esperado.</p></div>`}
        <div class="legend"><span><i class="lg-line"></i>Tu media semanal</span><span><i class="lg-band"></i>Baremo esperado</span></div>
      </section>
      <section class="card glass"><div class="card-h"><h2>Diagnóstico</h2><small class="muted">${s0 && wNow > 1 ? 'última semana completa' : ''}</small></div>${dg}</section>
      ${sem ? `<section class="card glass"><div class="card-h"><h2>Semáforo</h2></div>${sem}</section>` : ''}
      <section class="card glass"><div class="card-h"><h2>Fuerza</h2></div>${str}</section>
      <section class="card glass"><div class="card-h"><h2>Medidas y fotos</h2><button class="chip" data-a="sheet" data-s="measure">${ICON.plus} Añadir</button></div>
        ${mrows ? `<table class="tbl"><thead><tr><th>Fecha</th><th>Pecho</th><th>Brazo</th><th>Cintura</th><th></th></tr></thead><tbody>${mrows}</tbody></table><p class="muted small">Centímetros. Mide siempre en el mismo sitio y en frío (sin haber entrenado).</p>` : '<p class="muted small">Cada 4 semanas: contorno de pecho, brazo (relajado, en la parte más ancha) y cintura (a la altura del ombligo), y una foto de frente y de perfil con la misma luz.</p>'}
      </section>
      <section class="card glass"><div class="card-h"><h2>Casa vs gira</h2></div>${cmpHtml}</section>`;
  }

  function viewAjustes() {
    const set = D().settings;
    const foods = S.live('foods');
    const fl = Object.entries(foods).map(([id, f]) => `<div class="row"><div>${esc(f.n)}<br><small class="muted mono">${f.kcal} kcal · ${f.p} P · ${f.c} C · ${f.f} G /100 g</small></div><button class="ib" data-a="rmFood" data-id="${id}" aria-label="Borrar">${ICON.trash}</button></div>`).join('');
    const ov = Object.keys(S.live('routines'));
    const base = (location.origin + location.pathname);
    const conn = S.connected();
    const inp = (k, lab, step, unit) => `<label class="frow"><span>${lab}</span><span><input type="number" step="${step}" inputmode="decimal" data-in="setting" data-k="${k}" value="${set[k] != null ? set[k] : ''}"> ${unit}</span></label>`;
    return `
      <header class="phead"><h1>Ajustes</h1></header>
      <section class="card glass"><div class="card-h"><h2>Dropbox</h2>${status(conn ? (S.syncState === 'error' ? 'serious' : 'good') : 'warning', conn ? (S.syncState === 'error' ? 'Error' : 'Conectado') : 'No conectado')}</div>
        <p class="small">Tus datos se guardan en <b>/Apps/…/fitness.json</b> de tu Dropbox y las fotos en <b>fitness-fotos</b>. En GitHub solo está el código: nadie más puede ver tus datos.</p>
        ${conn ? `<p class="small muted">Última sincronización: ${S.lastSync ? new Date(S.lastSync).toLocaleString('es-ES') : 'nunca'}${S.lastError ? ` · ${esc(S.lastError)}` : ''}</p>
          <div class="btns"><button class="btn pri" data-a="syncNow">Sincronizar ahora</button><button class="btn ghost" data-a="disconnect">Desconectar este dispositivo</button></div>`
        : `<button class="btn pri wide" data-a="connect">Conectar Dropbox</button>${S.lastError ? `<p class="small err">${esc(S.lastError)}</p>` : ''}`}
        <details><summary>Configuración avanzada</summary>
          <p class="small muted">Redirect URI que tiene que estar dada de alta en tu app de Dropbox:<br><code>${esc(base)}</code></p>
          <label class="frow"><span>App key</span><input data-in="appkey" value="${esc(S.appKey())}" autocomplete="off" spellcheck="false"></label>
        </details>
      </section>
      <section class="card glass"><div class="card-h"><h2>Programa</h2></div>
        <label class="frow"><span>Inicio (semana 1)</span><input type="date" data-in="setting" data-k="startDate" value="${set.startDate || ''}"></label>
        <p class="small muted">Si lo dejas vacío, empieza el día de tu primer entreno${startDate() && !set.startDate ? ` (${fmtShort(startDate())})` : ''}.</p>
        ${inp('baseWeight', 'Peso inicial', '0.1', 'kg')}
        <p class="small muted">Vacío = tu primer pesaje (${num(baseline(), 1)} kg). El baremo se dibuja a partir de aquí.</p>
      </section>
      <section class="card glass"><div class="card-h"><h2>Objetivos diarios</h2></div>
        ${inp('kcal', 'Calorías', '50', 'kcal')}${inp('prot', 'Proteína', '5', 'g')}${inp('carb', 'Carbohidratos', '5', 'g')}${inp('fat', 'Grasa', '1', 'g')}${inp('water', 'Agua', '0.25', 'L')}${inp('sleep', 'Sueño', '0.5', 'h')}
      </section>
      <section class="card glass"><div class="card-h"><h2>Mis alimentos</h2><button class="chip" data-a="sheet" data-s="newFood">${ICON.plus} Nuevo</button></div>
        ${fl || '<p class="small muted">Añade aquí alimentos que no estén en la base, con los datos de la etiqueta (por 100 g).</p>'}
      </section>
      <section class="card glass"><div class="card-h"><h2>Rutinas</h2></div>
        <p class="small">${ov.length ? `Has modificado: ${ov.map(k => esc(ROUTINES[k] ? ROUTINES[k].name : k)).join(', ')}.` : 'Estás usando las rutinas originales del plan.'}</p>
        ${ov.length ? '<button class="btn ghost" data-a="resetRoutines">Volver a las rutinas originales</button>' : ''}
        <p class="small muted">Para cambios gordos (rutina nueva, más días) pídeselo a Claude y se actualiza la app.</p>
      </section>
      <section class="card glass"><div class="card-h"><h2>Recordatorios (iPhone)</h2></div>
        <p class="small">La app no puede mandarte notificaciones sola (no tiene servidor). Créalas con <b>Atajos</b>:</p>
        <ol class="small steps">
          <li>Abre <b>Atajos</b> → pestaña <b>Automatización</b> → <b>+</b> → <b>Hora del día</b>.</li>
          <li>Pon la hora, <b>Diariamente</b> y marca <b>Ejecutar inmediatamente</b>.</li>
          <li>Añade la acción <b>Mostrar notificación</b> con el texto.</li>
          <li>Repite para cada una.</li>
        </ol>
        <table class="tbl"><tbody>
          <tr><td class="mono">8:00</td><td>⚖️ Pésate (en ayunas, después de mear)</td></tr>
          <tr><td class="mono">8:15</td><td>💊 Creatina 5 g</td></tr>
          <tr><td class="mono">13:00</td><td>💧 ¿Vas por 1,25 L de agua?</td></tr>
          <tr><td class="mono">18:00</td><td>💧 ¿Vas por 2 L de agua?</td></tr>
          <tr><td class="mono">22:30</td><td>🍽️ Apunta las comidas y los hábitos de hoy</td></tr>
        </tbody></table>
        <p class="small muted">Instala la app en la pantalla de inicio: en Safari, <b>Compartir → Añadir a pantalla de inicio</b>. En Mac (Safari): <b>Archivo → Añadir al Dock</b>. En el PC (Chrome/Edge): icono de instalar en la barra de direcciones.</p>
      </section>
      <section class="card glass"><div class="card-h"><h2>Copia de seguridad</h2></div>
        <div class="btns"><button class="btn ghost" data-a="export">Descargar copia (.json)</button><label class="btn ghost">Importar copia<input type="file" accept="application/json" data-in="import" hidden></label></div>
      </section>
      <p class="small muted center">Fitness · datos en tu Dropbox · imágenes de ejercicios: free-exercise-db (dominio público)</p>`;
  }

  // ---------- hojas (modales) ----------
  function renderSheet() {
    const root = $('#sheet');
    if (!ui.sheet) { root.hidden = true; root.innerHTML = ''; if (stopAnim) { stopAnim(); stopAnim = null; } return; }
    const sh = ui.sheet;
    let html = '';
    if (sh.s === 'meal') html = sheetMeal(sh);
    else if (sh.s === 'food') html = sheetFood(sh);
    else if (sh.s === 'exercise') html = sheetExercise(sh);
    else if (sh.s === 'swap') html = sheetSwap(sh);
    else if (sh.s === 'editItem') html = sheetEditItem(sh);
    else if (sh.s === 'measure') html = sheetMeasure(sh);
    else if (sh.s === 'newFood') html = sheetNewFood(sh);
    else if (sh.s === 'photo') html = `<div class="sheet-h"><h2>Foto ${fmtShort(sh.date || '')}</h2><button class="ib" data-a="closeSheet">${ICON.close}</button></div><div class="photo">${sh.url ? `<img src="${esc(sh.url)}" alt="Foto de progreso">` : '<p class="muted">Cargando…</p>'}</div>`;
    const keep = root.querySelector('.sheet-b');
    const scroll = keep && keep.dataset.key === sh.s + (sh.k || sh.ex || sh.i || '') ? keep.scrollTop : 0;
    const opening = root.hidden;
    root.hidden = false;
    root.innerHTML = `<div class="scrim ${opening ? 'in' : ''}" data-a="closeSheet"></div><div class="sheet glass ${opening ? 'in' : ''}" role="dialog" aria-modal="true"><div class="sheet-b" data-key="${sh.s + (sh.k || sh.ex || sh.i || '')}">${html}</div></div>`;
    root.querySelector('.sheet-b').scrollTop = scroll;
    if (sh.s === 'exercise') mountMedia(sh.ex);
  }

  function sheetMeal(sh) {
    const date = ui.date, k = sh.k;
    const slot = SLOTS.find(s => s.k === k);
    const day = getDay(date) || { meals: {} };
    const e = day.meals[k];
    const plan = WEEK_PLAN[parse(date).getDay()];
    const sug = plan && plan[k];
    const opts = Object.keys(MEALS).filter(c => c[0] === k).map(c => {
      const m = macros(MEALS[c].i);
      return `<button class="opt ${e && e.code === c ? 'on' : ''} ${sug === c ? 'sug' : ''}" data-a="pickMeal" data-k="${k}" data-c="${c}"><span class="code">${c}</span><span class="opt-n">${esc(MEALS[c].n)}</span><small class="mono">${num(m.kcal)} kcal · ${num(m.p)} g P</small>${sug === c ? '<span class="tag">plan de hoy</span>' : ''}</button>`;
    }).join('');
    let detail = '';
    if (e && e.code) {
      const base = MEALS[e.code].i;
      const adj = e.adj || {};
      const rows = base.map(([id, g]) => { const cur = adj[id] != null ? adj[id] : g; const f = food(id); return `<div class="ing ${cur === 0 ? 'off' : ''}"><span>${esc(f ? f.n : id)}${cur !== g ? ` <small class="muted">(plan ${g})</small>` : ''}</span><label class="fld"><input type="number" inputmode="numeric" step="5" min="0" data-in="adj" data-k="${k}" data-id="${id}" value="${cur}"><small>g</small></label></div>`; }).join('');
      const ex = (e.extras || []).map(([id, g], i) => { const f = food(id); return `<div class="ing"><span>+ ${esc(f ? f.n : id)}</span><label class="fld"><input type="number" inputmode="numeric" step="5" min="0" data-in="mealExtra" data-k="${k}" data-i="${i}" value="${g}"><small>g</small></label><button class="ib" data-a="rmMealExtra" data-k="${k}" data-i="${i}" aria-label="Quitar">${ICON.trash}</button></div>`; }).join('');
      const t = mealTotals(e, k);
      detail = `<div class="card glass inner"><div class="card-h"><h3><span class="code">${e.code}</span> ${esc(MEALS[e.code].n)}</h3></div>
        <p class="small muted">${esc(MEALS[e.code].note)}</p>
        ${rows}${ex}
        <div class="btns"><button class="chip" data-a="sheet" data-s="food" data-target="meal" data-k="${k}">${ICON.plus} Añadir ingrediente</button>${Object.keys(adj).length ? `<button class="chip" data-a="resetAdj" data-k="${k}">Volver a las cantidades del plan</button>` : ''}</div>
        <p class="mono total">${num(t.kcal)} kcal · ${num(t.p)} P · ${num(t.c)} C · ${num(t.f)} G</p></div>`;
    }
    const out = ['poco', 'normal', 'mucho'].map(o => { const x = OUT_EST[k][o]; return `<button class="opt ${e && e.out === o ? 'on' : ''}" data-a="pickOut" data-k="${k}" data-o="${o}"><span class="opt-n">${cap(o)}</span><small class="mono">~${x[0]} kcal · ${x[1]} g P</small></button>`; }).join('');
    return `<div class="sheet-h"><div><small class="muted">${cap(fmtDay(date))}</small><h2>${slot.name}</h2></div><button class="ib" data-a="closeSheet" aria-label="Cerrar">${ICON.close}</button></div>
      ${detail}
      <h3 class="lbl">Opciones del plan</h3><div class="opts">${opts}</div>
      <h3 class="lbl">Fuera / libre (estimación rápida)</h3><div class="opts three">${out}</div>
      <p class="small muted">Fuera: elige el plato con más proteína visible y remata con yogur griego, huevo cocido o batido si te falta.</p>
      ${filled(e) ? `<button class="btn ghost wide" data-a="clearMeal" data-k="${k}">Quitar registro</button>` : ''}`;
  }

  function sheetFood(sh) {
    const q = (ui.foodQuery || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const all = Object.keys(FOODS).map(id => [id, food(id)]).concat(Object.keys(S.live('foods')).map(id => [id, food(id)]));
    const list = all.filter(([, f]) => f && (!q || f.n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q))).slice(0, 60);
    const sel = sh.sel;
    return `<div class="sheet-h"><h2>Añadir ${sh.target === 'meal' ? 'ingrediente' : 'extra'}</h2><button class="ib" data-a="closeSheet" aria-label="Cerrar">${ICON.close}</button></div>
      ${sel ? `<div class="card glass inner"><h3>${esc(food(sel).n)}</h3><form class="wform" data-f="addFood"><input name="g" type="number" inputmode="numeric" step="5" min="1" placeholder="gramos" autofocus><span>g</span><button class="btn pri">Añadir</button></form>
        <p class="small muted mono">${food(sel).kcal} kcal · ${food(sel).p} g P por 100 g</p></div>` : ''}
      <input class="search" type="search" placeholder="Buscar alimento…" data-in="foodQuery" value="${esc(ui.foodQuery || '')}">
      <div class="flist">${list.map(([id, f]) => `<button class="row ${sel === id ? 'on' : ''}" data-a="selFood" data-id="${id}"><span>${esc(f.n)}${f.custom ? ' <span class="tag">mío</span>' : ''}</span><small class="mono muted">${f.kcal} kcal · ${f.p} P</small></button>`).join('') || '<p class="muted small">Nada. Créalo en Ajustes → Mis alimentos.</p>'}</div>
      <button class="btn ghost wide" data-a="sheet" data-s="newFood" data-back="1">${ICON.plus} Crear alimento nuevo</button>`;
  }

  function sheetNewFood(sh) {
    return `<div class="sheet-h"><h2>Nuevo alimento</h2><button class="ib" data-a="closeSheet" aria-label="Cerrar">${ICON.close}</button></div>
      <p class="small muted">Copia los datos de la etiqueta (por 100 g o 100 ml). Vigila que no lleve frutos secos.</p>
      <form class="form" data-f="newFood">
        <label class="frow"><span>Nombre</span><input name="n" required></label>
        <label class="frow"><span>Calorías</span><input name="kcal" type="number" step="1" inputmode="decimal" required></label>
        <label class="frow"><span>Proteína (g)</span><input name="p" type="number" step="0.1" inputmode="decimal" required></label>
        <label class="frow"><span>Carbohidratos (g)</span><input name="c" type="number" step="0.1" inputmode="decimal" required></label>
        <label class="frow"><span>Grasa (g)</span><input name="f" type="number" step="0.1" inputmode="decimal" required></label>
        <button class="btn pri wide">Guardar</button></form>`;
  }

  function sheetExercise(sh) {
    const ex = EXERCISES[sh.ex];
    const hist = [];
    for (const s of sortedSessions()) { const sets = (s.sets[sh.ex] || []).filter(x => x.done); if (sets.length) hist.push(`<div class="row"><span>${fmtShort(s.date)}</span><span class="mono small">${setsTxt(sets)}</span></div>`); if (hist.length >= 5) break; }
    const mt = ui.mediaTab;
    return `<div class="sheet-h"><div><small class="muted">${esc(ex.eq)}</small><h2>${esc(ex.n)}</h2></div><button class="ib" data-a="closeSheet" aria-label="Cerrar">${ICON.close}</button></div>
      <div class="exmap">${muscleMapSVG(ex.p, ex.s)}
        <div class="mlegend"><div><i class="m-p"></i><b>Principal:</b> ${ex.p.map(m => MUSCLE_NAMES[m]).join(', ')}</div>${ex.s.length ? `<div><i class="m-s"></i><b>Secundarios:</b> ${ex.s.map(m => MUSCLE_NAMES[m]).join(', ')}</div>` : ''}</div></div>
      <div class="segs glass">${[['fotos', 'Fotos'], ['anim', 'Animación'], ['video', 'Vídeo']].map(([v, l]) => `<button class="seg ${mt === v ? 'on' : ''}" data-a="mediaTab" data-v="${v}">${l}</button>`).join('')}</div>
      <div class="media" id="media"></div>
      <h3 class="lbl">Por qué lo haces</h3><p>${esc(ex.why)}</p>
      <h3 class="lbl">Paso a paso</h3><ol class="steps">${ex.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      <h3 class="lbl">Errores comunes</h3><ul class="errs">${ex.errors.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
      ${ex.extra && ex.extra.length ? `<h3 class="lbl">Info extra</h3><ul>${ex.extra.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      ${hist.length ? `<h3 class="lbl">Tus últimas sesiones</h3>${hist.join('')}` : ''}`;
  }
  function mountMedia(exId) {
    const ex = EXERCISES[exId];
    const el = $('#media'); if (!el) return;
    if (stopAnim) { stopAnim(); stopAnim = null; }
    if (ui.mediaTab === 'fotos') {
      const base = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${ex.img}/`;
      el.innerHTML = `<div class="flip"><img src="${base}0.jpg" alt="${esc(ex.n)}: posición inicial" loading="lazy"><img src="${base}1.jpg" alt="${esc(ex.n)}: posición final" loading="lazy" class="b"></div>
        <p class="small muted">${ex.imgNote ? esc(ex.imgNote) + ' ' : ''}Alterna posición inicial y final. Imágenes: free-exercise-db (dominio público).</p>`;
    } else if (ui.mediaTab === 'anim') {
      el.innerHTML = '<div class="animbox"></div><p class="small muted">Animación esquemática del movimiento. Fíjate en la trayectoria y en qué articulaciones se mueven.</p>';
      stopAnim = mountAnim(el.querySelector('.animbox'), ex.anim, ex.aeq, { pause: ex.pause });
    } else {
      const q = encodeURIComponent(ex.yt);
      el.innerHTML = `<div class="vid"><p>Se abre YouTube con una búsqueda de <b>${esc(ex.yt)}</b>. Elige un vídeo de un canal serio de entrenamiento y compáralo con los pasos de abajo.</p>
        <a class="btn pri wide" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">Buscar vídeo en YouTube</a></div>`;
    }
  }

  function sheetSwap(sh) {
    const s = D().sessions[ui.sessionId];
    const it = s.items[sh.i];
    const cur = EXERCISES[it.ex];
    const place = s.place;
    const alts = (cur.alt || []).concat(Object.keys(EXERCISES).filter(id => id !== it.ex && !(cur.alt || []).includes(id) && EXERCISES[id].p.some(m => cur.p.includes(m))));
    return `<div class="sheet-h"><div><small class="muted">Sustituir</small><h2>${esc(cur.n)}</h2></div><button class="ib" data-a="closeSheet" aria-label="Cerrar">${ICON.close}</button></div>
      <p class="small muted">Primero las alternativas recomendadas, luego otros ejercicios que trabajan lo mismo.</p>
      <label class="frow"><span>Guardar también en la rutina</span><input type="checkbox" id="swapKeep"></label>
      ${alts.map((id, n) => `<button class="row" data-a="doSwap" data-i="${sh.i}" data-ex="${id}"><div>${esc(EXERCISES[id].n)}${n < (cur.alt || []).length ? ' <span class="tag">recomendado</span>' : ''}<br><small class="muted">${esc(EXERCISES[id].eq)} · ${EXERCISES[id].p.map(m => MUSCLE_NAMES[m]).join(', ')}</small></div>${ICON.swap}</button>`).join('')}
      <p class="small muted">Rutina: ${place}. Si no tienes el material de un ejercicio, elige otro.</p>`;
  }

  function sheetEditItem(sh) {
    const s = D().sessions[ui.sessionId];
    const it = s.items[sh.i];
    const ex = EXERCISES[it.ex];
    const r = it.time || it.reps;
    return `<div class="sheet-h"><div><small class="muted">Editar</small><h2>${esc(ex.n)}</h2></div><button class="ib" data-a="closeSheet" aria-label="Cerrar">${ICON.close}</button></div>
      <form class="form" data-f="editItem" data-i="${sh.i}">
        <label class="frow"><span>Series</span><input name="sets" type="number" min="1" max="8" value="${it.sets}"></label>
        <label class="frow"><span>${it.time ? 'Segundos mín.' : 'Reps mín.'}</span><input name="lo" type="number" min="1" value="${r[0]}"></label>
        <label class="frow"><span>${it.time ? 'Segundos máx.' : 'Reps máx.'}</span><input name="hi" type="number" min="1" value="${r[1]}"></label>
        <label class="frow"><span>Descanso mín. (s)</span><input name="r0" type="number" min="0" step="15" value="${it.rest[0]}"></label>
        <label class="frow"><span>Descanso máx. (s)</span><input name="r1" type="number" min="0" step="15" value="${it.rest[1]}"></label>
        <label class="frow"><span>Guardar en la rutina</span><input name="keep" type="checkbox" checked></label>
        <button class="btn pri wide">Guardar</button></form>`;
  }

  function sheetMeasure() {
    return `<div class="sheet-h"><h2>Medidas y foto</h2><button class="ib" data-a="closeSheet" aria-label="Cerrar">${ICON.close}</button></div>
      <form class="form" data-f="measure">
        <label class="frow"><span>Fecha</span><input name="date" type="date" value="${today()}"></label>
        <label class="frow"><span>Pecho (cm)</span><input name="chest" type="number" step="0.1" inputmode="decimal"></label>
        <label class="frow"><span>Brazo (cm)</span><input name="arm" type="number" step="0.1" inputmode="decimal"></label>
        <label class="frow"><span>Cintura (cm)</span><input name="waist" type="number" step="0.1" inputmode="decimal"></label>
        <label class="frow"><span>Foto</span><input name="photo" type="file" accept="image/*" ${S.connected() ? '' : 'disabled'}></label>
        ${S.connected() ? '<p class="small muted">La foto se reduce y se sube solo a tu Dropbox.</p>' : '<p class="small muted">Conecta Dropbox para guardar fotos.</p>'}
        <button class="btn pri wide">Guardar</button></form>`;
  }

  // ---------- temporizador de descanso (cuenta hacia arriba) ----------
  let tickInt = null;
  function renderTimer() {
    const el = $('#timer');
    if (!ui.timer || ui.tab !== 'entreno') { el.hidden = true; return; }
    el.hidden = false;
    const upd = () => {
      if (!ui.timer) return;
      const s = Math.floor((Date.now() - ui.timer.t) / 1000);
      const [a, b] = ui.timer.r;
      const lv = s < a ? '' : s <= b ? 'ok' : 'over';
      el.className = 'timer glass ' + lv;
      el.innerHTML = `<span class="mono big">${Math.floor(s / 60)}:${pad(s % 60)}</span><small>${ui.timer.label} · ${a}-${b} s</small><button class="ib" data-a="stopTimer" aria-label="Cerrar cronómetro">${ICON.close}</button>`;
    };
    upd();
    clearInterval(tickInt);
    tickInt = setInterval(upd, 1000);
  }

  // ---------- acciones ----------
  function sessionRoutineKey(s) { return `${s.rid}-${s.place}`; }
  function saveRoutineItems(s) {
    const key = sessionRoutineKey(s);
    D().routines[key] = { items: JSON.parse(JSON.stringify(s.items)), u: Date.now() };
    S.touch('routines', key);
  }

  const A = {
    tab(el) { ui.tab = el.dataset.tab; ui.sheet = null; if (ui.tab === 'hoy') ui.date = ui.date || today(); location.hash = ui.tab; window.scrollTo(0, 0); render(); },
    dateNav(el) { const n = +el.dataset.n; const d = addDays(ui.date, n); if (d <= today()) { ui.date = d; ui.reveal = false; ui.editW = false; render(); } },
    goDate(el) { ui.date = el.dataset.d; ui.tab = 'hoy'; render(); window.scrollTo(0, 0); },
    reveal() { ui.reveal = !ui.reveal; render(); },
    editW() { ui.editW = true; render(); const i = $('input[name=w]'); if (i) i.focus(); },
    habit(el) {
      const day = getDay(ui.date, true);
      const k = el.dataset.k, v = el.dataset.v;
      day.h[k] = k === 'energy' ? +v : k === 'cardio' ? v : v === '1';
      if (k === 'energy' && day.h[k] === +v && el.classList.contains('on')) day.h[k] = null;
      saveDay(ui.date);
    },
    step(el) {
      const day = getDay(ui.date, true);
      const k = el.dataset.k, d = +el.dataset.d;
      const cur = day.h[k] != null ? day.h[k] : k === 'sleep' ? 7 - d : 0;
      day.h[k] = Math.max(0, Math.round((cur + d) * 100) / 100);
      if (k === 'sleep') day.h[k] = Math.min(14, day.h[k]);
      saveDay(ui.date);
    },
    sheet(el) {
      const d = el.dataset;
      if (d.s === 'food') ui.foodQuery = '';
      if (d.s === 'exercise') ui.mediaTab = ui.mediaTab || 'fotos';
      const prev = ui.sheet;
      ui.sheet = { s: d.s, k: d.k, ex: d.ex, i: d.i != null ? +d.i : undefined, target: d.target, back: d.back ? prev : null };
      render();
    },
    closeSheet() { ui.sheet = ui.sheet && ui.sheet.back ? ui.sheet.back : null; render(); },
    mediaTab(el) { ui.mediaTab = el.dataset.v; render(); },
    pickMeal(el) {
      const day = getDay(ui.date, true);
      const k = el.dataset.k, c = el.dataset.c;
      const cur = day.meals[k];
      day.meals[k] = cur && cur.code === c ? cur : { code: c, adj: {}, extras: [] };
      saveDay(ui.date);
    },
    pickOut(el) { const day = getDay(ui.date, true); day.meals[el.dataset.k] = { out: el.dataset.o }; saveDay(ui.date); },
    clearMeal(el) { const day = getDay(ui.date, true); delete day.meals[el.dataset.k]; ui.sheet = null; saveDay(ui.date); },
    resetAdj(el) { const day = getDay(ui.date, true); const e = day.meals[el.dataset.k]; e.adj = {}; saveDay(ui.date); },
    rmMealExtra(el) { const day = getDay(ui.date, true); day.meals[el.dataset.k].extras.splice(+el.dataset.i, 1); saveDay(ui.date); },
    rmExtra(el) { const day = getDay(ui.date, true); day.extras.splice(+el.dataset.i, 1); saveDay(ui.date); },
    selFood(el) { ui.sheet.sel = el.dataset.id; render(); const i = $('form[data-f=addFood] input'); if (i) i.focus(); },
    rmFood(el) { if (confirm('¿Borrar este alimento? Los registros que lo usen dejarán de contarlo.')) { S.remove('foods', el.dataset.id); render(); } },
    place(el) { ui.place = el.dataset.p; D().settings.place = el.dataset.p; S.touch('settings'); render(); },
    startSession(el) {
      const rid = el.dataset.rid, place = el.dataset.place;
      const r = routine(`${rid}-${place}`);
      const id = uid();
      const date = today();
      D().sessions[id] = { id, date, rid, place, items: JSON.parse(JSON.stringify(r.items)), sets: {}, done: false, u: Date.now() };
      if (!D().settings.startDate && !startDate()) { D().settings.startDate = date; S.touch('settings'); }
      S.touch('sessions', id);
      ui.sessionId = id; window.scrollTo(0, 0); render();
    },
    openSession(el) { ui.sessionId = el.dataset.id; window.scrollTo(0, 0); render(); },
    closeSession() { ui.sessionId = null; ui.timer = null; render(); },
    setDone(el) {
      const s = D().sessions[ui.sessionId];
      const it = s.items[+el.dataset.i];
      const st = s.sets[el.dataset.ex][+el.dataset.j];
      st.done = !st.done;
      if (st.done) {
        // Si no apuntó nada, usa lo sugerido / objetivo
        const card = el.closest('.set');
        const kgI = card.querySelector('[data-f=kg]'), rI = card.querySelector('[data-f=reps]');
        if (st.kg == null && kgI && kgI.placeholder && !isNaN(toNum(kgI.placeholder))) st.kg = toNum(kgI.placeholder);
        if (st.reps == null && rI && rI.placeholder) st.reps = toNum(rI.placeholder);
        if (it.ss) ui.timer = { t: Date.now(), r: [0, 15], label: `Sin descanso → ${EXERCISES[s.items[+el.dataset.i + 1].ex].n}` };
        else ui.timer = { t: Date.now(), r: it.rest, label: 'Descanso' };
      }
      S.touch('sessions', s.id);
      render();
    },
    addSet(el) { const s = D().sessions[ui.sessionId]; s.sets[el.dataset.ex].push({}); const it = s.items.find(x => x.ex === el.dataset.ex); it.sets = s.sets[el.dataset.ex].length; S.touch('sessions', s.id); render(); },
    rmSet(el) { const s = D().sessions[ui.sessionId]; s.sets[el.dataset.ex].pop(); const it = s.items.find(x => x.ex === el.dataset.ex); it.sets = s.sets[el.dataset.ex].length; S.touch('sessions', s.id); render(); },
    finishSession() { const s = D().sessions[ui.sessionId]; s.done = true; S.touch('sessions', s.id); ui.sessionId = null; ui.timer = null; render(); window.scrollTo(0, 0); },
    deleteSession() { if (!confirm('¿Borrar esta sesión y lo que has apuntado en ella?')) return; S.remove('sessions', ui.sessionId); ui.sessionId = null; ui.timer = null; render(); },
    stopTimer() { ui.timer = null; clearInterval(tickInt); render(); },
    doSwap(el) {
      const s = D().sessions[ui.sessionId];
      const it = s.items[+el.dataset.i];
      const nex = el.dataset.ex;
      const old = it.ex;
      it.ex = nex;
      if (EXERCISES[nex].load === 'time' && !it.time) { it.time = [20, 30]; delete it.reps; }
      if (EXERCISES[nex].load !== 'time' && !it.reps) { it.reps = [10, 12]; delete it.time; }
      s.sets[nex] = s.sets[nex] || s.sets[old] || [];
      delete s.sets[old];
      if ($('#swapKeep') && $('#swapKeep').checked) saveRoutineItems(s);
      S.touch('sessions', s.id); ui.sheet = null; render();
    },
    deload(el) { const w = +el.dataset.w; const dl = D().settings.deloads || (D().settings.deloads = []); if (!dl.includes(w)) dl.push(w); S.touch('settings'); render(); },
    applyKcal(el) {
      const set = D().settings;
      if (el.dataset.v === 'kcal+300') { set.kcal += 300; set.carb += 75; }
      else { set.kcal -= 200; set.carb -= 50; }
      S.touch('settings'); render();
    },
    connect() { S.connect(); },
    disconnect() { if (confirm('¿Desconectar Dropbox en este dispositivo? Los datos se quedan aquí y en Dropbox.')) { S.disconnect(); render(); } },
    syncNow() { S.sync(); },
    resetRoutines() { if (!confirm('¿Volver a las rutinas originales?')) return; for (const k of Object.keys(S.live('routines'))) S.remove('routines', k); render(); },
    export() {
      const blob = new Blob([JSON.stringify(D(), null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `fitness-${today()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
    async photo(el) {
      const path = el.dataset.p;
      ui.sheet = { s: 'photo', date: path.split('/').pop().replace('.jpg', '') }; render();
      try { ui.sheet.url = await S.photoLink(path); } catch (e) { alert('No se pudo cargar la foto: ' + e.message); }
      render();
    },
  };

  const F = {
    weight(f) {
      const v = toNum(f.w.value);
      if (v == null || v < 30 || v > 200) return;
      const day = getDay(ui.date, true);
      day.w = Math.round(v * 10) / 10;
      ui.editW = false; ui.reveal = false;
      saveDay(ui.date);
    },
    addFood(f) {
      const g = toNum(f.g.value); if (!g) return;
      const id = ui.sheet.sel;
      const day = getDay(ui.date, true);
      if (ui.sheet.target === 'meal') { const e = day.meals[ui.sheet.k]; (e.extras = e.extras || []).push([id, g]); ui.sheet = ui.sheet.back || { s: 'meal', k: ui.sheet.k }; }
      else { day.extras.push([id, g]); ui.sheet = null; }
      saveDay(ui.date);
    },
    newFood(f) {
      const id = 'c_' + uid();
      D().foods[id] = { n: f.n.value.trim(), kcal: toNum(f.kcal.value) || 0, p: toNum(f.p.value) || 0, c: toNum(f.c.value) || 0, f: toNum(f.f.value) || 0, u: Date.now() };
      S.touch('foods', id);
      if (ui.sheet.back && ui.sheet.back.s === 'food') { ui.sheet = ui.sheet.back; ui.sheet.sel = id; } else ui.sheet = null;
      render();
    },
    editItem(f) {
      const s = D().sessions[ui.sessionId];
      const it = s.items[+f.dataset.i];
      it.sets = Math.max(1, +f.sets.value || it.sets);
      const lo = +f.lo.value, hi = Math.max(lo, +f.hi.value);
      if (it.time) it.time = [lo, hi]; else it.reps = [lo, hi];
      it.rest = [+f.r0.value || 0, Math.max(+f.r0.value || 0, +f.r1.value || 0)];
      const sets = s.sets[it.ex] = s.sets[it.ex] || [];
      while (sets.length > it.sets && !sets[sets.length - 1].done) sets.pop();
      if (f.keep.checked) saveRoutineItems(s);
      S.touch('sessions', s.id); ui.sheet = null; render();
    },
    async measure(f) {
      const date = f.date.value || today();
      const m = { chest: toNum(f.chest.value), arm: toNum(f.arm.value), waist: toNum(f.waist.value), u: Date.now() };
      const old = S.live('measures')[date];
      if (old && old.photo) m.photo = old.photo;
      const file = f.photo.files && f.photo.files[0];
      const btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        if (file && S.connected()) m.photo = await S.uploadPhoto(date, await shrink(file));
      } catch (e) { alert('No se pudo subir la foto: ' + e.message); }
      D().measures[date] = m; S.touch('measures', date);
      ui.sheet = null; render();
    },
  };

  function shrink(file) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => (b ? res(b) : rej(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.82);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => rej(new Error('Imagen no válida'));
      img.src = URL.createObjectURL(file);
    });
  }

  // Inputs que guardan al cambiar
  function onInput(e) {
    const el = e.target, d = el.dataset;
    if (!d.in) return;
    if (d.in === 'foodQuery') { ui.foodQuery = el.value; const pos = el.selectionStart; renderSheet(); const i = $('#sheet .search'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } return; }
    if (e.type === 'input') return; // el resto guarda en "change"
    if (d.in === 'set') {
      const s = D().sessions[ui.sessionId];
      const st = s.sets[d.ex][+d.j];
      st[d.f] = toNum(el.value);
      S.touch('sessions', s.id);
      return; // sin re-render para no perder el foco
    }
    if (d.in === 'adj') { const day = getDay(ui.date, true); const e2 = day.meals[d.k]; e2.adj = e2.adj || {}; const v = toNum(el.value) || 0; const base = MEALS[e2.code].i.find(x => x[0] === d.id)[1]; if (v === base) delete e2.adj[d.id]; else e2.adj[d.id] = v; saveDay(ui.date); return; }
    if (d.in === 'mealExtra') { const day = getDay(ui.date, true); day.meals[d.k].extras[+d.i][1] = toNum(el.value) || 0; saveDay(ui.date); return; }
    if (d.in === 'setting') {
      const set = D().settings;
      set[d.k] = d.k === 'startDate' ? el.value || null : toNum(el.value);
      if (['kcal', 'prot', 'carb', 'fat', 'water', 'sleep'].includes(d.k) && set[d.k] == null) set[d.k] = { kcal: 2700, prot: 180, carb: 330, fat: 78, water: 2.5, sleep: 7 }[d.k];
      S.touch('settings'); render(); return;
    }
    if (d.in === 'appkey') { S.setAppKey(el.value); render(); return; }
    if (d.in === 'chartEx') { ui.chartEx = el.value; render(); return; }
    if (d.in === 'import') {
      const file = el.files[0]; if (!file) return;
      file.text().then(t => {
        const data = JSON.parse(t);
        if (!confirm('¿Fusionar esta copia con tus datos actuales? (Gana lo editado más recientemente)')) return;
        S.replaceAll(mergeData(D(), data));
      }).catch(err => alert('Archivo no válido: ' + err.message));
    }
  }

  // ---------- arranque ----------
  function init() {
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-a]');
      if (!el || el.disabled) return;
      if (el.tagName === 'A') return;
      e.preventDefault();
      const fn = A[el.dataset.a];
      if (fn) fn(el, e);
    });
    document.addEventListener('submit', e => { const f = e.target; if (f.dataset.f && F[f.dataset.f]) { e.preventDefault(); F[f.dataset.f](f); } });
    document.addEventListener('input', onInput);
    document.addEventListener('change', onInput);
    document.addEventListener('pointermove', chartHover);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.sheet) A.closeSheet(); });
    window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (['hoy', 'entreno', 'progreso', 'ajustes'].includes(t) && t !== ui.tab) { ui.tab = t; ui.sheet = null; render(); } });
    // Si la app se quedó abierta de un día para otro, pasa a "hoy" (solo si estabas viendo el día que era hoy)
    let lastToday = today();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      const t = today();
      if (t !== lastToday) { if (ui.date === lastToday) ui.date = t; lastToday = t; }
      S.sync(); render();
    });
    S.onChange(() => { if (!document.activeElement || !document.activeElement.matches('input,select,textarea')) render(); else renderSync(); });
    const t = location.hash.slice(1) || new URLSearchParams(location.search).get('tab');
    if (['hoy', 'entreno', 'progreso', 'ajustes'].includes(t)) ui.tab = t;
    const open = sortedSessions().find(s => !s.done && s.date === today());
    if (open) ui.sessionId = open.id;
    render();
    S.handleRedirect().then(ok => { if (ok) { ui.tab = 'ajustes'; } S.sync(); render(); }).catch(e => { S.lastError = e.message; render(); });
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  // Exponer para pruebas
  window.__fit = { dayTotals, macros, suggest, diagnosis, weekStats, band, baseline, ui, render };
  init();
})();
