// Animaciones propias de muñeco (vista lateral salvo "lateral", que es frontal).
// Cada patrón define dos posturas (a = inicio, b = final) con coordenadas de articulaciones
// en un lienzo 200x200 (suelo en y=185). Se interpolan con easing y se repiten en bucle.
(function () {
  const STAND = { hd: [100, 40], sh: [100, 58], el: [100, 83], ha: [100, 106], hp: [100, 108], kn: [100, 146], an: [100, 184], to: [114, 184] };
  const P = (base, over) => Object.assign({}, base, over);

  const PAT = {
    squat: {
      a: P(STAND, { el: [108, 80], ha: [112, 62] }),
      b: { hd: [109, 86], sh: [100, 102], el: [110, 125], ha: [116, 104], hp: [76, 146], kn: [116, 146], an: [100, 184], to: [114, 184] },
      grip: 'chest',
    },
    split: {
      a: { hd: [95, 38], sh: [94, 56], el: [96, 81], ha: [97, 105], hp: [92, 106], kn: [112, 144], an: [125, 184], to: [139, 184], kn2: [80, 144], an2: [44, 146], to2: [36, 150] },
      b: { hd: [96, 73], sh: [94, 91], el: [96, 116], ha: [97, 140], hp: [88, 140], kn: [124, 148], an: [125, 184], to: [139, 184], kn2: [80, 176], an2: [44, 146], to2: [36, 150] },
      props: ['bench_low'],
    },
    lunge: {
      a: { hd: [100, 38], sh: [100, 56], el: [101, 81], ha: [102, 105], hp: [100, 106], kn: [114, 145], an: [124, 184], to: [138, 184], kn2: [88, 145], an2: [72, 178], to2: [64, 185] },
      b: { hd: [98, 72], sh: [97, 90], el: [98, 115], ha: [99, 139], hp: [96, 140], kn: [132, 148], an: [124, 184], to: [138, 184], kn2: [88, 178], an2: [62, 176], to2: [54, 185] },
    },
    incline_press: {
      a: { hd: [60, 92], sh: [70, 105], el: [78, 128], ha: [88, 108], hp: [100, 140], kn: [135, 138], an: [138, 184], to: [150, 184] },
      b: { hd: [60, 92], sh: [70, 105], el: [84, 82], ha: [96, 60], hp: [100, 140], kn: [135, 138], an: [138, 184], to: [150, 184] },
      props: ['incline_bench'],
    },
    ohp: {
      a: P(STAND, { el: [106, 80], ha: [108, 56] }),
      b: P(STAND, { hd: [97, 40], el: [101, 34], ha: [101, 10] }),
    },
    curl: {
      a: P(STAND, { el: [100, 83], ha: [102, 107] }),
      b: P(STAND, { el: [100, 83], ha: [112, 62] }),
    },
    tri_ext: {
      a: P(STAND, { hd: [104, 40], el: [102, 33], ha: [90, 52] }),
      b: P(STAND, { hd: [104, 40], el: [102, 33], ha: [103, 9] }),
    },
    pushdown: {
      a: P(STAND, { el: [100, 83], ha: [112, 64] }),
      b: P(STAND, { el: [100, 83], ha: [102, 107] }),
      anchor: [118, 0],
    },
    plank: {
      a: { hd: [178, 152], sh: [160, 158], el: [160, 183], ha: [184, 183], hp: [115, 165], kn: [78, 174], an: [42, 180], to: [36, 185] },
      b: { hd: [178, 151], sh: [160, 157], el: [160, 183], ha: [184, 183], hp: [115, 163], kn: [78, 173], an: [42, 180], to: [36, 185] },
      hold: true,
    },
    rdl: {
      a: P(STAND, { el: [100, 83], ha: [102, 106] }),
      b: { hd: [143, 80], sh: [126, 88], el: [127, 113], ha: [127, 137], hp: [82, 112], kn: [104, 148], an: [100, 184], to: [114, 184] },
    },
    sl_rdl: {
      a: P(STAND, { el: [100, 83], ha: [102, 106], kn2: [96, 146], an2: [92, 178], to2: [104, 180] }),
      b: { hd: [143, 80], sh: [126, 88], el: [127, 113], ha: [127, 137], hp: [82, 112], kn: [104, 148], an: [100, 184], to: [114, 184], kn2: [44, 102], an2: [8, 94], to2: [4, 102] },
    },
    leg_press: {
      a: { hd: [30, 102], sh: [40, 115], el: [58, 140], ha: [72, 150], hp: [70, 150], kn: [100, 118], an: [130, 140], to: [138, 130] },
      b: { hd: [30, 102], sh: [40, 115], el: [58, 140], ha: [72, 150], hp: [70, 150], kn: [108, 130], an: [146, 112], to: [154, 102] },
      props: ['leg_press'],
    },
    row: {
      a: { hd: [76, 92], sh: [74, 110], el: [98, 112], ha: [122, 114], hp: [70, 160], kn: [100, 138], an: [130, 160], to: [134, 150] },
      b: { hd: [74, 92], sh: [72, 110], el: [52, 120], ha: [76, 122], hp: [70, 160], kn: [100, 138], an: [130, 160], to: [134, 150] },
      props: ['seat_low', 'footplate'], anchor: [190, 118],
    },
    pulldown: {
      a: { hd: [98, 82], sh: [98, 100], el: [104, 76], ha: [108, 52], hp: [100, 150], kn: [140, 150], an: [140, 185], to: [152, 185] },
      b: { hd: [92, 83], sh: [94, 100], el: [90, 124], ha: [104, 104], hp: [100, 150], kn: [140, 150], an: [140, 185], to: [152, 185] },
      props: ['seat'], anchor: [108, 0], bar: true,
    },
    chest_press: {
      a: { hd: [98, 82], sh: [98, 100], el: [82, 114], ha: [106, 110], hp: [100, 150], kn: [140, 150], an: [140, 185], to: [152, 185] },
      b: { hd: [98, 82], sh: [98, 100], el: [122, 100], ha: [146, 100], hp: [100, 150], kn: [140, 150], an: [140, 185], to: [152, 185] },
      props: ['seat_back'], handle: true,
    },
    dips: {
      a: { hd: [66, 56], sh: [64, 74], el: [62, 98], ha: [60, 122], hp: [70, 124], kn: [106, 146], an: [140, 178], to: [148, 184] },
      b: { hd: [68, 86], sh: [66, 104], el: [44, 114], ha: [60, 122], hp: [72, 154], kn: [108, 160], an: [140, 178], to: [148, 184] },
      props: ['bench_dips'],
    },
    calf: {
      a: P(STAND, { an: [100, 178], to: [114, 178] }),
      b: { hd: [100, 30], sh: [100, 48], el: [100, 73], ha: [100, 96], hp: [100, 98], kn: [100, 136], an: [102, 166], to: [114, 178] },
      props: ['step'],
    },
    bridge: {
      a: { hd: [34, 176], sh: [50, 178], el: [74, 176], ha: [96, 172], hp: [98, 180], kn: [124, 146], an: [140, 182], to: [152, 184] },
      b: { hd: [34, 176], sh: [50, 178], el: [72, 162], ha: [94, 144], hp: [96, 150], kn: [134, 144], an: [140, 182], to: [152, 184] },
    },
    pushup: {
      a: { hd: [178, 130], sh: [160, 138], el: [162, 161], ha: [164, 184], hp: [116, 152], kn: [78, 165], an: [40, 178], to: [36, 184] },
      b: { hd: [176, 164], sh: [158, 168], el: [142, 176], ha: [164, 184], hp: [116, 172], kn: [78, 178], an: [40, 180], to: [36, 184] },
    },
    decline_pushup: {
      a: { hd: [178, 128], sh: [160, 132], el: [162, 158], ha: [164, 184], hp: [114, 140], kn: [76, 142], an: [40, 144], to: [36, 150] },
      b: { hd: [176, 164], sh: [158, 166], el: [142, 176], ha: [164, 184], hp: [114, 158], kn: [76, 150], an: [40, 146], to: [36, 150] },
      props: ['box'],
    },
  };

  // Vista frontal para elevaciones laterales
  const FRONT_A = { hd: [100, 40], shL: [88, 60], shR: [112, 60], elL: [86, 84], elR: [114, 84], haL: [86, 106], haR: [114, 106], hpL: [93, 108], hpR: [107, 108], knL: [92, 146], knR: [108, 146], anL: [91, 184], anR: [109, 184] };
  const FRONT_B = P(FRONT_A, { elL: [64, 64], elR: [136, 64], haL: [42, 68], haR: [158, 68] });

  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const mix = (a, b, t) => { const o = {}; for (const k in a) o[k] = lerp(a[k], b[k] || a[k], t); return o; };

  function props(list) {
    let s = '';
    for (const p of list || []) {
      if (p === 'bench_low') s += '<rect x="22" y="148" width="50" height="7" rx="3" class="pr"/><line x1="30" y1="155" x2="30" y2="185" class="prl"/><line x1="64" y1="155" x2="64" y2="185" class="prl"/>';
      if (p === 'incline_bench') s += '<line x1="104" y1="146" x2="58" y2="96" class="prb"/><line x1="96" y1="148" x2="136" y2="148" class="prb"/><line x1="100" y1="148" x2="100" y2="185" class="prl"/><line x1="70" y1="120" x2="66" y2="185" class="prl"/>';
      if (p === 'seat') s += '<rect x="80" y="152" width="44" height="7" rx="3" class="pr"/><line x1="102" y1="159" x2="102" y2="185" class="prl"/><rect x="128" y="138" width="16" height="8" rx="4" class="pr"/>';
      if (p === 'seat_back') s += '<rect x="80" y="152" width="44" height="7" rx="3" class="pr"/><line x1="102" y1="159" x2="102" y2="185" class="prl"/><rect x="82" y="82" width="7" height="70" rx="3" class="pr"/>';
      if (p === 'seat_low') s += '<rect x="50" y="162" width="44" height="7" rx="3" class="pr"/><line x1="72" y1="169" x2="72" y2="185" class="prl"/><line x1="94" y1="185" x2="190" y2="185" class="prl"/>';
      if (p === 'footplate') s += '<line x1="138" y1="140" x2="138" y2="172" class="prb"/><line x1="190" y1="60" x2="190" y2="185" class="prb"/>';
      if (p === 'bench_dips') s += '<rect x="20" y="122" width="44" height="7" rx="3" class="pr"/><line x1="26" y1="129" x2="26" y2="185" class="prl"/><line x1="58" y1="129" x2="58" y2="185" class="prl"/>';
      if (p === 'step') s += '<rect x="96" y="178" width="40" height="7" rx="2" class="pr"/>';
      if (p === 'box') s += '<rect x="14" y="150" width="40" height="35" rx="4" class="pr"/>';
      if (p === 'leg_press') s += '<line x1="20" y1="80" x2="74" y2="158" class="prb"/><line x1="60" y1="160" x2="100" y2="185" class="prl"/><line x1="100" y1="185" x2="190" y2="80" class="prl" stroke-dasharray="3 4"/>';
    }
    return s;
  }

  const line = (p, q, cls) => `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" class="${cls}"/>`;

  function equip(j, aeq, pat, hand, elbow) {
    if (!hand) return '';
    const [x, y] = hand;
    if (aeq === 'kb') return `<circle cx="${x}" cy="${y + 8}" r="7" class="eq"/><path d="M${x - 4} ${y + 2} q4 -7 8 0" class="eql"/>`;
    if (aeq === 'db') {
      if (pat === 'lateral' || pat === 'curl') return `<rect x="${x - 3}" y="${y - 7}" width="6" height="14" rx="2" class="eq"/>`;
      return `<rect x="${x - 8}" y="${y - 3}" width="16" height="6" rx="2" class="eq"/>`;
    }
    if (aeq === 'bb') return `<circle cx="${x}" cy="${y}" r="11" class="eqo"/><circle cx="${x}" cy="${y}" r="2.5" class="eq"/>`;
    return '';
  }

  function drawSide(j, cfg, aeq, name) {
    const g = [];
    const far = 'lf';
    // pierna lejana
    if (j.kn2) { g.push(line(j.hp, j.kn2, far), line(j.kn2, j.an2, far), line(j.an2, j.to2, far)); }
    // brazo lejano (mismo que el cercano, algo desplazado) para pesos a dos manos
    if (cfg.anchor) {
      const [ax, ay] = cfg.anchor;
      g.push(`<line x1="${ax}" y1="${ay}" x2="${j.ha[0].toFixed(1)}" y2="${j.ha[1].toFixed(1)}" class="cable"/>`);
    }
    if (aeq === 'band' && !cfg.anchor) {
      g.push(`<path d="M${j.to[0] - 8} ${j.to[1]} Q ${(j.ha[0] + j.to[0]) / 2 - 10} ${(j.ha[1] + j.to[1]) / 2} ${j.ha[0].toFixed(1)} ${j.ha[1].toFixed(1)}" class="band"/>`);
    }
    // tronco y pierna cercana
    g.push(line(j.sh, j.hp, 'lb'), line(j.hp, j.kn, 'll'), line(j.kn, j.an, 'll'), line(j.an, j.to, 'll'));
    // cabeza
    g.push(`<circle cx="${j.hd[0].toFixed(1)}" cy="${j.hd[1].toFixed(1)}" r="11" class="hd"/>`);
    // brazo cercano
    g.push(line(j.sh, j.el, 'la'), line(j.el, j.ha, 'la'));
    if (cfg.bar) g.push(`<line x1="${j.ha[0] - 22}" y1="${j.ha[1]}" x2="${j.ha[0] + 22}" y2="${j.ha[1]}" class="eqline"/>`);
    if (cfg.handle) g.push(`<rect x="${j.ha[0] - 3}" y="${j.ha[1] - 9}" width="6" height="18" rx="3" class="eq"/>`);
    if (aeq !== 'band' && aeq !== 'cable' && aeq !== 'none') g.push(equip(j, aeq, name, j.ha, j.el));
    // articulaciones
    for (const k of ['sh', 'el', 'hp', 'kn']) g.push(`<circle cx="${j[k][0].toFixed(1)}" cy="${j[k][1].toFixed(1)}" r="2.6" class="jt"/>`);
    return g.join('');
  }

  function drawFront(j, aeq) {
    const g = [];
    const neck = [100, 56];
    g.push(line(neck, [100, 106], 'lb'), line(j.shL, j.shR, 'lb'), line(j.hpL, j.hpR, 'lb'));
    g.push(line(j.hpL, j.knL, 'll'), line(j.knL, j.anL, 'll'), line(j.hpR, j.knR, 'll'), line(j.knR, j.anR, 'll'));
    g.push(`<circle cx="100" cy="40" r="11" class="hd"/>`);
    g.push(line(j.shL, j.elL, 'la'), line(j.elL, j.haL, 'la'), line(j.shR, j.elR, 'la'), line(j.elR, j.haR, 'la'));
    if (aeq === 'band') {
      g.push(`<path d="M${j.haL[0].toFixed(1)} ${j.haL[1].toFixed(1)} Q 92 150 100 184 Q 108 150 ${j.haR[0].toFixed(1)} ${j.haR[1].toFixed(1)}" class="band"/>`);
    } else {
      g.push(`<rect x="${(j.haL[0] - 3).toFixed(1)}" y="${(j.haL[1] - 7).toFixed(1)}" width="6" height="14" rx="2" class="eq"/>`);
      g.push(`<rect x="${(j.haR[0] - 3).toFixed(1)}" y="${(j.haR[1] - 7).toFixed(1)}" width="6" height="14" rx="2" class="eq"/>`);
    }
    for (const k of ['shL', 'shR', 'elL', 'elR', 'knL', 'knR']) g.push(`<circle cx="${j[k][0].toFixed(1)}" cy="${j[k][1].toFixed(1)}" r="2.6" class="jt"/>`);
    return g.join('');
  }

  // Monta la animación en `el`. Devuelve una función para pararla.
  window.mountAnim = function (el, pattern, aeq, opts) {
    opts = opts || {};
    const isFront = pattern === 'lateral';
    const cfg = isFront ? {} : (PAT[pattern] || PAT.squat);
    const a = isFront ? FRONT_A : cfg.a;
    const b = isFront ? FRONT_B : cfg.b;
    const hold = cfg.hold;
    const pauseB = opts.pause ? 2.2 : 0.35;
    const T = hold ? [1.6, 1.6, 0, 0] : [0.45, 1.5, pauseB, 1.3];
    const total = T.reduce((x, y) => x + y, 0);
    const bg = `<line x1="0" y1="185.5" x2="200" y2="185.5" class="floor"/>` + props(cfg.props);
    el.innerHTML = `<svg viewBox="0 0 200 200" class="anim" role="img" aria-label="Animación del ejercicio"><g class="bg">${bg}</g><g class="fig"></g></svg>`;
    const fig = el.querySelector('.fig');
    let raf, t0 = performance.now(), stopped = false;
    const speed = opts.speed || 1;
    function frame(now) {
      if (stopped || !el.isConnected) return;
      let t = (((now - t0) / 1000) * speed) % total;
      let k;
      if (hold) k = 0.5 - 0.5 * Math.cos((t / total) * Math.PI * 2);
      else if (t < T[0]) k = 0;
      else if ((t -= T[0]) < T[1]) k = ease(t / T[1]);
      else if ((t -= T[1]) < T[2]) k = 1;
      else k = 1 - ease((t - T[2]) / T[3]);
      if (opts.k != null) k = opts.k; // postura fija (vista previa)
      const j = mix(a, b, k);
      fig.innerHTML = isFront ? drawFront(j, aeq) : drawSide(j, cfg, aeq, pattern);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => { stopped = true; cancelAnimationFrame(raf); };
  };
})();
