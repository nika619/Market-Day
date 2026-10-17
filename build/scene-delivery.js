// SPECIAL DELIVERY: builds the SVGator project document (delivery[-setN].json) and the local preview script (delivery[-setN].js).
// Art: Blender plates and parts packed by entry3/blender/pack.py into ../assets/delivery (+ manifest.json with frame rects, depths, rig pivots).
// Rules kept everywhere: motion lives on wrapper groups, never on the swappable text or images; every camera move is eased (no linear on space).
const fs = require('fs'), path = require('path');
const SET = process.argv[2] || 'set1', C = require('./content-delivery' + SET.slice(3) + '.js');
const MAN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'delivery', 'manifest.json'), 'utf8'));
const BASE = process.env.BASE || 'https://raw.githubusercontent.com/nika619/conjure-svgator/main/assets/';
const W = 1920, H = 1080, DUR = 23000, P = [960, 540];

// ---------------- engine (same document model as scene-market.js, plus filters) ----------------
const cb = (a, b, c, d) => ({ type: 'cubic-bezier', value: { from: { x: a, y: b }, to: { x: c, y: d } } });
const LIN = { type: 'linear', value: null };
const IO = cb(.45, 0, .55, 1), OUT = cb(.16, 1, .3, 1), IN = cb(.7, 0, .84, 0), BACK = cb(.34, 1.56, .64, 1), SOFT = cb(.3, 0, .15, 1);
const PREM = cb(.4, 0, .2, 1), GLIDE = cb(.33, 0, .12, 1), SPRING = cb(.2, 1.35, .4, 1), WHIP = cb(.8, 0, .2, 1), SINE = cb(.37, 0, .63, 1);
const col = ([r, g, b], a = 1) => ({ type: 'color', value: { r, g, b, a } });
const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(20261017);
const R = (a, b) => +(a + (b - a) * rnd()).toFixed(1);
const f1 = v => +v.toFixed(2), f3 = v => +v.toFixed(3), r1 = v => Math.round(v * 10) / 10;
const CH = {
  o: ['transform', 'origin', v => ({ x: r1(v[0]), y: r1(v[1]) })],
  s: ['transform', 'scale', v => typeof v === 'number' ? { x: f3(v), y: f3(v) } : { x: f3(v[0]), y: f3(v[1]) }],
  r: ['transform', 'rotate', v => f1(v)],
  op: ['compositing', 'opacity', v => f3(v)],
  dash: ['stroke', 'dashOffset', v => f1(v)],
  size: ['shape', 'size', v => ({ width: f1(v[0]), height: f1(v[1]) })],
  f: ['filter', 'list', v => v],
};
let idn = 0;
function E(type, title, o = {}) {
  const n = { id: (o.id || 'd' + (++idn)), type, title, properties: {} }, p = n.properties;
  if (o.o) o.o = o.o.map(r1); if (o.t) o.t = o.t.map(r1);
  const tr = {};
  if (o.o) tr.origin = { x: o.o[0], y: o.o[1] };
  if (o.t) tr.translate = { x: o.t[0], y: o.t[1] };
  if (o.s != null) tr.scale = CH.s[2](o.s);
  if (o.r) tr.rotate = o.r;
  if (Object.keys(tr).length) p.transform = tr;
  const c = {};
  if (o.op != null) c.opacity = o.op;
  if (o.blend) c.blend = o.blend;
  if (o.mask) c.mask = { source: o.mask };
  if (o.clip) c.clip = { path: o.clip, rule: false };
  if (Object.keys(c).length) p.compositing = c;
  if (o.filter) p.filter = { list: o.filter };
  if (o.shape) p.shape = o.shape;
  if (o.fill) p.fill = { paint: o.fill };
  if (o.stroke) p.stroke = o.stroke;
  if (type === 'mask') p.mask = { type: 'luminance' };
  if (o.a) {
    n.animators = {};
    for (const k in o.a) {
      if (!o.a[k] || !o.a[k].length) continue;
      const [grp, chn, wrap] = CH[k], ks = o.a[k].filter(q => q[0] <= DUR).map(([t, v, e], i, all) => ({ time: Math.round(t), value: wrap(v), ...(e && e !== LIN && k !== 'op' && k !== 'f' && i < all.length - 1 ? { easing: e } : {}) }));
      for (let i = 1; i < ks.length; i++) if (ks[i].time <= ks[i - 1].time) ks[i].time = ks[i - 1].time + 1;   // strictly increasing
      while (ks.length > 1 && ks[ks.length - 1].time > DUR) ks.pop(); if (!ks.length) continue;
      if (ks.length) delete ks[ks.length - 1].easing;
      (n.animators[grp] = n.animators[grp] || {})[chn] = { keys: ks };
      (p[grp] = p[grp] || {})[chn] = ks[0].value;
    }
  }
  if (!Object.keys(p).length) delete n.properties;
  if (o.kids) n.children = o.kids.flat(Infinity).filter(Boolean);
  return n;
}
const img = (file, w, h, fit) => ({ size: { width: r1(w), height: r1(h) }, href: /^https?:/.test(file) ? file : BASE + file, ...(fit ? { aspectRatio: fit } : {}) });
const spr = (title, file, cx, cy, w, h, o = {}) => E('image', title, { o: [cx, cy], t: [-w / 2, -h / 2], shape: img(file, w, h, o.fit), ...o });
const rect = (title, x, y, w, h, o = {}) => E('rect', title, { o: [x, y], shape: { size: { width: w, height: h }, radius: { x: o.rx || 0, y: o.rx || 0 } }, ...o });
const piv = (title, [px, py], o = {}) => E('g', title, { o: [px, py], t: [-px, -py], ...o });
const G = (title, kids, o = {}) => E('g', title, { kids, ...o });
const osc = (t0, t1, period, a, b, e = SINE) => { const out = []; for (let t = t0, i = 0; t < t1 + period / 2; t += period / 2, i++) out.push([Math.min(t, t1), i % 2 ? b : a, e]); return out; };
const light = { blend: 'screen' };
const L = (shot, name) => { const l = MAN[shot] && MAN[shot].layers[name]; if (!l) throw new Error('missing layer ' + shot + '/' + name); return l; };
const A = (shot, name) => { const a = MAN[shot] && MAN[shot].anchors[name]; if (!a) throw new Error('missing anchor ' + shot + '/' + name); return a; };
const plate = (shot, name, title, o = {}) => { const l = L(shot, name); return E('image', title || name, { o: [l.x, l.y], shape: img(l.file, l.w, l.h), ...o }); };
const visible = (t0, t1, fade = 0) => t0 <= 0 ? [[0, 1], [t1, 1], [t1 + 1, 0]] : fade ? [[0, 0], [t0 - fade, 0], [t0, 1], [t1, 1], [t1 + fade, 0]] : [[0, 0], [t0 - 1, 0], [t0, 1], [t1, 1], [t1 + 1, 0]];
const txt = (title, text, x, y, font, size, weight, o = {}) => E('text', title, { o: [x, y], shape: { text, rangeStyles: o.ranges || [], fontFamily: font, fontSize: size, fontStyle: { bold: false, italic: !!o.italic, weight }, letterSpacing: o.ls || 0, textAnchor: o.anchor || 'start' }, fill: col(o.color || [255, 246, 230]), ...(o.a ? { a: o.a } : {}), ...(o.filter ? { filter: o.filter } : {}) });
const blur = v => [{ type: 'blur', value: { x: v, y: v } }];

// ---------------- the multiplane camera ----------------
// keys: [time, zoom, panX, panY (frame px at the focus depth), roll deg, easing to next]; a layer at depth D moves by focusDepth/D of that.
function camLayer(title, keys, d, kids, extra = {}) {
  const a = { o: keys.map(([t, s, x, y, r, e]) => [t, [P[0] + x * d, P[1] + y * d], e]), s: keys.map(([t, s, x, y, r, e]) => [t, 1 + (s - 1) * d, e]) };
  if (keys.some(k => k[4])) a.r = keys.map(([t, s, x, y, r = 0, e]) => [t, r, e]);
  return piv(title, P, { a, kids, ...extra });
}
const depthFactor = (shot, name, focus) => focus / (L(shot, name).depth || focus);

// ---------------- shared pieces ----------------
const sparkle = (x, y, z, t0, life, dx, dy, o = {}) => spr('sparkle', 'spark.jpg', x, y, z, z, { ...light, a: { o: [[t0, [x, y], OUT], [t0 + life, [x + dx, y + dy]]], op: [[0, 0], [t0, 0], [t0 + 60, o.peak || .95], [t0 + life, 0]], s: [[t0, 1.1, IN], [t0 + life, .4]] } });
const glow = (title, x, y, w, h, keysOp, o = {}) => spr(title, o.file || 'glow-gold.jpg', x, y, w, h, { ...light, a: { op: keysOp, ...(o.a || {}) } });

// team rig built from the TEAM parts (3/4 front view). opts: t0,t1 gallop window, period, silhouette
function teamRig(title, { t0, t1, period = 420, arm = null, bells = true }) {
  const T = 'TEAM', kids = [], legAmp = 26;
  const part = n => plate(T, n);
  // reins first (behind the reindeer), from Santa's hands to each collar
  const hl = A(T, 'hand_l'), hr = A(T, 'hand_r');
  kids.push(G('reins', [0, 1, 2, 3].map(i => { const c = A(T, `deer${i}_collar`), h = i % 2 ? hr : hl, mx = (h[0] + c[0]) / 2, my = Math.max(h[1], c[1]) + 26;
    return E('path', 'rein ' + (i + 1), { shape: { path: [{ x: h[0], y: h[1], type: 'cusp', mode: 0, end: { x: mx - 80, y: my } }, { x: c[0], y: c[1], type: 'cusp', mode: 0, start: { x: mx + 80, y: my } }] }, fill: { type: 'none' }, stroke: { paint: col([226, 186, 104], .9), width: 1.6, lineCap: 'round', opacity: 1 } }); })));
  const sl = L(T, 'sleigh-santa'), slC = [sl.x + sl.w / 2, sl.y + sl.h * .8];
  kids.push(piv('sleigh-rock', slC, { a: { r: osc(t0, t1, period * 4, -1.2, 1.2), o: osc(t0, t1, period * 2, slC, [slC[0], slC[1] - 4]) }, kids: [
    part('sleigh-santa'),
    piv('santa-arm-r (throws)', A(T, 'shoulder_r'), { a: arm || {}, kids: [part('santa-arm-r')] }),
    E('image', 'logo on the sack', { o: [A(T, 'sack')[0] - 46, A(T, 'sack')[1] - 30], shape: img(C.logo, 92, 52, 'xMidYMid meet'), op: .92, r: -6 }),
  ] }));
  for (const i of [0, 1, 2, 3]) {   // far pair first
    const c = A(T, `deer${i}_center`), far = A(T, `deer${i}_far_legs`), ph = i * 70;
    const leg = j => { const hip = A(T, `deer${i}_hip${j}`), front = j < 2, near = !far.includes(j), sgn = (front ? 1 : -1) * (near ? 1 : -1);
      return piv(`leg ${j + 1}`, hip, { a: { r: osc(t0 + ph + (front ? 0 : period / 2) + (near ? 0 : 40), t1, period, -legAmp * sgn, legAmp * sgn) }, kids: [part(`deer${i}-leg${j}`)] }); };
    kids.push(piv(`reindeer ${i + 1}`, c, { a: { o: osc(t0 + ph, t1, period / 2, [c[0], c[1]], [c[0], c[1] - 6]), r: osc(t0 + ph, t1, period, -2, 2.5) }, kids: [
      ...far.map(leg), part(`deer${i}-body`), ...[0, 1, 2, 3].filter(j => !far.includes(j)).map(leg),
      ...(bells ? [0, 1, 2].map(k => { const cc = A(T, `deer${i}_collar`), x = cc[0] - 10 + k * 9, y = cc[1] + 14 + k * 3; return glow('bell glint', x, y, 16, 16, osc(t0 + k * 90 + ph, t1, period * 2, .15, .9)); }) : []),
    ] }));
  }
  return G(title, kids);
}

// ---------------- S1 night over the town (0-3200) ----------------
const S1 = 'S1', F1 = 13, KEY1 = [[0, 1.0, 0, 300, 0, PREM], [3200, 1.06, 0, 0, 0, LIN]];   // starts tilted up at the stars, cranes down and pushes in
const stars = (n, yMax, t0 = 0, t1 = 3200) => Array.from({ length: n }, () => { const x = R(-60, 1980), y = R(-420, yMax), z = R(1.6, 4.2), t = t0 + R(150, 1500);
  return rect('star', x, y, z, z, { rx: z / 2, fill: col([255, 246, 220]), a: { op: [[0, 0], [t, 0], [t + 300, R(.5, 1)], ...osc(t + 300, t1, R(1300, 2600), R(.6, 1), R(.25, .5))] } }); });
const s1 = G('S1 night over the town', [
  camLayer('sky (+ stars)', KEY1, .08, [E('image', 'sky', { o: [L(S1, 'sky').x, L(S1, 'sky').y - 600], shape: img(L(S1, 'sky').file, L(S1, 'sky').w, L(S1, 'sky').h + 600) }), ...stars(46, 420, 0, 3200)]),
  camLayer('moon', KEY1, depthFactor(S1, 'moon', F1), [plate(S1, 'moon'), (() => { const m = L(S1, 'moon'); return glow('moon glow', m.x + m.w / 2, m.y + m.h / 2, m.w * 2.6, m.h * 2.6, [[0, .45], ...osc(0, 3200, 2400, .45, .6)]); })()]),
  camLayer('far town', KEY1, depthFactor(S1, 'far', F1), [plate(S1, 'far')]),
  camLayer('mid town (windows flicker)', KEY1, depthFactor(S1, 'mid', F1), [plate(S1, 'mid'), ...MAN.ANCH_S1.anchors.windows.filter(() => rnd() < .13).map(([x, y, r]) => glow('flicker', x, y, r * 7, r * 7, osc(R(0, 600), 3200, R(700, 1500), .05, R(.25, .45))))]),
  camLayer('foreground: tree, snowman, fence (out of focus)', KEY1, depthFactor(S1, 'fg', F1), [plate(S1, 'fg'), ...MAN.ANCH_S1.anchors.bulbs.filter((b, i) => b[1] < 1150 && i % 2 === 0).map(([x, y, r]) => glow('bokeh', x, y, r * 5, r * 5, osc(R(0, 500), 3200, R(900, 1700), .25, .75)))]),
], { id: 'p-s1', a: { op: visible(0, 3199) } });

// ---------------- S2 long lens on the moon; the team crosses it in silhouette (3200-5650) ----------------
const MOONC = [1180, 470], MOOND = 760;
const s2 = G('S2 moon crossing (long lens)', [
  piv('s2-push', P, { a: { s: [[3200, 1.0, GLIDE], [5650, 1.06]] }, kids: [
    E('image', 'sky (long lens)', { o: [-100, -100], shape: img(L(S1, 'sky').file, 2120, 1280) }),
    ...stars(28, 1080, 3200, 5950),
    glow('moon halo', MOONC[0], MOONC[1], MOOND * 2.4, MOOND * 2.4, [[0, .55]]),
    spr('moon', L('MOON', 'moon').file, MOONC[0], MOONC[1], MOOND, MOOND),
  ] }),
  piv('team crossing (silhouette)', P, { a: { o: [[3300, [-560, 650], SOFT], [5600, [2500, 290]]], s: [[3300, .5, LIN], [5550, .44]], r: [[3300, -9, SOFT], [5550, -4]] }, kids: [
    E('g', 'silhouette', { id: 'p-s2team', filter: [{ type: 'brightness', value: 0 }], kids: [teamRig('team (silhouette)', { t0: 3200, t1: 5950, period: 380, bells: false })] }),
  ] }),
  ...Array.from({ length: 14 }, (_, i) => { const t = 3450 + i * 150, x = -380 + (t - 3300) / 2250 * 2240 - 220, y = 690 - (t - 3300) / 2250 * 270; return sparkle(x, y, R(18, 42), t, R(700, 1100), R(-90, -30), R(20, 70)); }),
], { a: { op: visible(3200, 5950) } });

// ---------------- S3 whip pan + S4 the team, tracking (5650-9500) ----------------
const PANO = 'PANO', T0 = 5900, T1 = 9500;
const panoLayer = (name, d, scroll) => piv('pano ' + name, P, { a: { o: [[T0, [P[0] + 260 * d, P[1]], GLIDE], [T1, [P[0] - scroll, P[1]]]] }, kids: [plate(PANO, name)] });
const s4 = G('S4 the team (tracking over the town)', [
  piv('whip-in (pan blur)', P, { a: { o: [[5750, [1700, 540], OUT], [6150, [960, 540]]], f: [[5750, blur(30)], [6000, blur(8)], [6150, blur(0)]] }, kids: [
    piv('s4-camera (bank + push)', P, { a: { r: [[T0, -2.5, PREM], [8000, 1.2, PREM], [T1, -0.6]], s: [[T0, 1.0, GLIDE], [9200, 1.08, IN], [T1, 1.7]], o: [[T0, P, GLIDE], [9200, [P[0], P[1] - 10], IN], [T1, [P[0] + 300, P[1] + 140]]] }, kids: [
      panoLayer('sky', .05, 60), panoLayer('far', .45, 520), panoLayer('mid', 1, 1500),
      piv('team (hero)', A('TEAM', 'team_center'), { a: { o: [[T0, [A('TEAM', 'team_center')[0] + 40, A('TEAM', 'team_center')[1] + 60], PREM], [T1, [A('TEAM', 'team_center')[0] - 20, A('TEAM', 'team_center')[1] - 30]]], s: [[T0, 1.12, LIN], [T1, 1.18]] }, kids: [E('g', 'team rig', { id: 'p-s4team', kids: [teamRig('team', { t0: 5900, t1: 9600, period: 420 })] })] }),
      ...Array.from({ length: 18 }, (_, i) => { const t = 6000 + i * 190, sl = L('TEAM', 'sleigh-santa'); return sparkle(sl.x + 40, sl.y + sl.h * .55 + R(-30, 30), R(16, 38), t, R(800, 1200), R(-420, -260), R(30, 120)); }),
    ] }),
  ] }),
  ...Array.from({ length: 10 }, () => { const y = R(0, 1080); return spr('speed line', 'streak.jpg', 960, y, 2400, R(30, 70), { ...light, a: { op: [[0, 0], [5700, 0], [5800, R(.2, .45)], [6150, 0]], o: [[5700, [2400, y], OUT], [6150, [-600, y]]] } }); }),
], { id: 'p-s4', a: { op: visible(5750, 9500) } });
const whipOut = piv('S2 whip-out wrapper', P, { id: 'p-s2', a: { o: [[5650, P, WHIP], [5950, [-700, 540]]], f: [[5650, blur(0)], [5800, blur(24)], [5950, blur(40)]] }, kids: [s2] });

// ---------------- S5 the Nice List (9500-12300) ----------------
const S5 = 'S5', rl = A(S5, 'rod_l'), rr = A(S5, 'rod_r'), RODY = (rl[1] + rr[1]) / 2 + 12, PX0 = Math.min(rl[0], rr[0]) + 26, PX1 = Math.max(rl[0], rr[0]) - 26, PW = PX1 - PX0, PH = 470, U0 = 9800, U1 = 10450;
// the list is the setup, the gift tag is the payoff: entry 4 is the tag's recipient, circled, ticked and stamped
const INK = [58, 40, 30], RED = [168, 40, 34], LX = PX0 + 62, LY = i => RODY + 122 + i * 50;
const entries = [...C.list.map((s, i) => ({ lines: [s], y: LY(i), t: 10350 + i * 230 })), { lines: C.recipient, y: LY(3) + 12, t: 11060, hero: true }];
const writeOn = (id, line, x, y, t, dur, o = {}) => G('write-on', [   // a pen wipe: the mask grows left to right, the text never moves
  E('mask', 'pen wipe', { id, kids: [rect('wipe', x - 6, y - 28, 1, 38, { fill: col([255, 255, 255]), a: { size: [[t, [1, 38], SINE], [t + dur, [PX1 - x + 10, 38]]] } })] }),
  txt(o.title || 'line (edit me)', line, x, y, 'Fraunces', 25, o.weight || 500, { italic: true, color: o.color || INK }),
], { mask: id });
const hero = entries[3], heroW = Math.max(...hero.lines.map(l => l.length)) * 13.2, CX = (PX0 + 6 + LX + heroW + 20) / 2, CY = hero.y + 8, CRX = (LX + heroW + 20 - PX0 - 6) / 2, CRY = 50;   // loops the whole entry, number included
const inkLoop = (() => {   // hand-drawn loop: 1.1 turns of a wobbly ellipse, Catmull-Rom to bezier handles
  const pts = Array.from({ length: 12 }, (_, i) => { const a = (-60 + i * 36) * Math.PI / 180, w = 1 + (i % 3 - 1) * .035; return [CX + Math.cos(a) * CRX * w, CY + Math.sin(a) * CRY * w + i * .6]; });
  return pts.map(([x, y], i) => { const p0 = pts[Math.max(0, i - 1)], p2 = pts[Math.min(pts.length - 1, i + 1)], hx = (p2[0] - p0[0]) / 6, hy = (p2[1] - p0[1]) / 6;
    return { x: r1(x), y: r1(y), type: 'cusp', mode: 0, ...(i ? { start: { x: r1(x - hx), y: r1(y - hy) } } : {}), ...(i < pts.length - 1 ? { end: { x: r1(x + hx), y: r1(y + hy) } } : {}) }; });
})(), LOOPLEN = Math.round(Math.PI * (CRX + CRY) * 1.3);
const SX = PX0 + PW / 2 + 74, SY = RODY + 414, STAMP = 12020;
const paper = piv('list sway (hangs from the rod)', [PX0 + PW / 2, RODY], { a: { r: osc(9500, 12300, 2800, -0.5, 0.5) }, kids: [G('EDIT ME 2 - the Nice List (entries are live text; entry 4 = the tag recipient)', [
  E('g', 'paper (unrolls)', { mask: 'm-paper', kids: [
    E('mask', 'unroll mask', { id: 'm-paper', kids: [rect('reveal', PX0 - 10, RODY, PW + 20, 10, { fill: col([255, 255, 255]), a: { size: [[U0, [PW + 20, 1], cb(.35, 0, .25, 1)], [U1, [PW + 20, PH + 40]]] } })] }),
    E('image', 'parchment', { o: [PX0, RODY], shape: img('delivery/s5/paper.webp', PW, PH), filter: [{ type: 'drop-shadow', value: { blur: { x: 10, y: 10 }, offset: { x: 0, y: 8 }, color: { r: 20, g: 10, b: 4, a: .45 } } }] }),
    txt('list-title', 'NICE LIST', PX0 + PW / 2, RODY + 58, 'Fraunces', 34, 700, { anchor: 'middle', color: RED, ls: 3 }),
    rect('list rule', PX0 + 40, RODY + 74, PW - 80, 2, { fill: col(RED, .6) }),
    ...entries.map((e, i) => G('entry ' + (i + 1) + (e.hero ? ' (the recipient: match the gift tag)' : ''), [
      piv('number', [PX0 + 40, e.y - 8], { a: { op: [[0, 0], [e.t - 120, 0], [e.t, 1]], s: [[e.t - 120, .6, BACK], [e.t + 80, 1]] }, kids: [txt('number', (i + 1) + '.', PX0 + 40, e.y, 'Fraunces', 22, 700, { anchor: 'middle', color: RED })] }),
      ...e.lines.map((l, j) => writeOn(`m-entry${i + 1}${'ab'[j]}`, l, LX, e.y + j * 32, e.t + j * 230, e.hero ? 300 : 360, { title: `entry ${i + 1}${e.lines.length > 1 ? ' line ' + (j + 1) : ''} (edit me)`, weight: e.hero ? 700 : 500, color: e.hero ? [40, 26, 18] : INK })),
    ])),
    E('path', 'ink loop around the recipient', { shape: { path: inkLoop }, fill: { type: 'none' }, stroke: { paint: col(RED, .85), width: 3.2, lineCap: 'round', lineJoin: 'round', dashArray: [LOOPLEN], dashOffset: LOOPLEN, opacity: 1 }, a: { dash: [[11560, LOOPLEN, SOFT], [11900, 0]] } }),
    E('path', 'tick (draws itself)', { shape: { path: [{ x: PX1 - 66, y: CY + 2, type: 'corner', mode: 0 }, { x: PX1 - 52, y: CY + 16, type: 'corner', mode: 0 }, { x: PX1 - 24, y: CY - 16, type: 'corner', mode: 0 }] }, fill: { type: 'none' }, stroke: { paint: col([46, 128, 74]), width: 6, lineCap: 'round', lineJoin: 'round', dashArray: [80], dashOffset: 80, opacity: 1 }, a: { dash: [[11860, 80, BACK], [12020, 0]] } }),
    piv('stamp (slams down)', [SX, SY], { r: -8, op: 0, a: { op: [[0, 0], [STAMP, 0], [STAMP + 70, .9]], s: [[STAMP, 1.9, IN], [STAMP + 110, .94, OUT], [STAMP + 220, 1]] }, kids: [
      rect('stamp border', SX - 118, SY - 24, 236, 48, { rx: 8, fill: { type: 'none' }, stroke: { paint: col(RED), width: 3, opacity: 1 } }),
      txt('stamp text', 'CHECKED TWICE', SX, SY + 7, 'DM Sans', 19, 700, { anchor: 'middle', color: RED, ls: 3 }),
    ] }),
  ] }),
  rect('roll (the rolled-up paper)', PX0 - 6, RODY - 14, PW + 12, 28, { rx: 14, fill: { type: 'linear-gradient', value: { from: { x: 0, y: 0 }, to: { x: 0, y: 1 }, stops: [{ offset: 0, color: { r: 250, g: 240, b: 216, a: 1 } }, { offset: .55, color: { r: 214, g: 196, b: 158, a: 1 } }, { offset: 1, color: { r: 150, g: 128, b: 92, a: 1 } }] } }, a: { o: [[U0, [PX0 - 6, RODY - 14], cb(.35, 0, .25, 1)], [U1, [PX0 - 6, RODY + PH - 14]]], op: [[0, 1], [U1 - 1, 1], [U1 + 120, 0]] } }),
])] });
const s5 = G('S5 the Nice List (medium close-up)', [
  piv('s5-camera (slow push)', [960, 560], { a: { s: [[9500, 1.0, GLIDE], [12300, 1.07]], o: [[9500, [960, 600], GLIDE], [12300, [960, 560]]] }, kids: [
    E('image', 'town bokeh', { o: [-700, -120], shape: img(L(PANO, 'far').file, 3400, 1300), filter: blur(14), op: .85 }),
    ...Array.from({ length: 9 }, () => { const x = R(0, 1920), y = R(150, 950), z = R(40, 120); return glow('bokeh', x, y, z, z, osc(9500, 12300, R(1400, 2600), .15, .5)); }),
    piv('santa (breathes)', [960, 1080], { a: { s: osc(9500, 12300, 1800, [1, 1], [1.004, 1.012], SINE) }, kids: [plate(S5, 'santa-mcu'), plate(S5, 'arm-rod'), paper] }),
  ] }),
], { a: { op: visible(9500, 12300) } });

// ---------------- S6 the drop + S7 down the chimney (12300-15600) ----------------
const S6 = 'S6', F6 = 3.8, MOUTH = A(S6, 'mouth'), HOVER = [A(S6, 'mouth')[0], A(S6, 'mouth')[1] - 210], K6 = [[12300, 1.0, 0, -240, 0, PREM], [13300, 1.0, 0, -120, 0, IO], [14500, 1.02, 0, 0, 0, IN], [15150, 1.9, 960 - MOUTH[0], 540 - MOUTH[1] + 120, 0, LIN]];
const TS = MAN.TUMBLE.layers, TN = 24, TW = 210, TH = TW * TS.tumble00.h / TS.tumble00.w, GT0 = 13100, GT1 = 14250, HV1 = 14600, DROP = 14900;
const arcPt = u => { const a = [430, 330], b = [HOVER[0] - 40, HOVER[1] - 260], c = HOVER; return [(1 - u) ** 2 * a[0] + 2 * u * (1 - u) * b[0] + u * u * c[0], (1 - u) ** 2 * a[1] + 2 * u * (1 - u) * b[1] + u * u * c[1]]; };
const giftPath = []; for (let k = 0; k <= 8; k++) { const u = k / 8, t = GT0 + (GT1 - GT0) * (1 - (1 - u) ** 1.6); giftPath.push([t, arcPt(u), LIN]); }
const tumble = G('gift tumble (24-frame sequence)', Array.from({ length: TN }, (_, k) => { const keys = [[0, 0]]; for (let t = GT0, f = 0; t < GT1 + 300; t += 42, f++) if (f % TN === k) { keys.push([t, 0], [t + 1, 1], [t + 41, 1], [t + 42, 0]); } return spr('tumble ' + k, TS['tumble' + String(k).padStart(2, '0')].file, 0, 0, TW, TH, { a: { op: keys } }); }));
const s6 = G('S6 the drop (rooftop)', [
  camLayer('sky (+ stars)', K6, .06, [E('image', 'sky', { o: [L(S6, 'sky').x, L(S6, 'sky').y - 500], shape: img(L(S6, 'sky').file, L(S6, 'sky').w, L(S6, 'sky').h + 500) }), ...stars(30, 600, 12300, 15200)]),
  camLayer('moon', K6, depthFactor(S6, 'moon', F6), [(() => { const m = L(S6, 'moon'); return glow('moon glow', m.x + m.w / 2, m.y + m.h / 2, m.w * 2.8, m.h * 2.8, [[0, .5]]); })(), plate(S6, 'moon')]),
  piv('team swoops overhead', P, { a: { o: [[12300, [-360, 330], SOFT], [13250, [700, 150], SOFT], [14100, [2300, 260]]], s: [[12300, .38, LIN], [14100, .3]], r: [[12300, -6, SOFT], [13250, -12, SOFT], [14100, -2]] }, kids: [E('g', 'team rig', { id: 'p-s6team', kids: [teamRig('team (small)', { t0: 12300, t1: 14100, period: 360, bells: false, arm: { r: [[12300, 0, OUT], [12850, -38, SPRING], [13050, 62, OUT], [13400, 20, IO], [13800, 0]] } })] })] }),
  camLayer('town below', K6, depthFactor(S6, 'town', F6), [plate(S6, 'town')]),
  camLayer('roof (+ ridge lights)', K6, depthFactor(S6, 'roof', F6), [plate(S6, 'roof')]),
  camLayer('the gift (behind the chimney, so it drops in)', K6, 1, [
    piv('gift flight', [0, 0], { a: { o: [...giftPath, [GT1 + 1, HOVER, SINE], [HV1, [HOVER[0], HOVER[1] - 12], IN], [DROP, [MOUTH[0], MOUTH[1] + 60]]], s: [[GT0, .85, LIN], [GT1, 1.0, SINE], [HV1, 1.04, IN], [DROP, .92]], op: [[0, 0], [GT0 - 1, 0], [GT0, 1]] }, kids: [
      tumble,
      spr('upright', TS.upright.file, 0, 0, TW, TH, { a: { op: [[0, 0], [GT1 + 299, 0], [GT1 + 300, 1]], r: [[GT1 + 300, -6, SPRING], [HV1, 2, IN], [DROP, 0]] } }),
    ] }),
    ...Array.from({ length: 12 }, (_, i) => { const t = GT0 + i * 100, p = arcPt(Math.min((t - GT0) / (GT1 - GT0), 1)); return sparkle(p[0], p[1], R(14, 30), t, R(600, 900), R(-60, 20), R(-40, 30)); }),
  ]),
  camLayer('chimney', K6, depthFactor(S6, 'chimney', F6), [plate(S6, 'chimney'), glow('firelight from the mouth', MOUTH[0], MOUTH[1] - 20, 260, 160, [[0, .5], ...osc(12300, 15200, 500, .45, .7)])]),
], { id: 'p-s6', a: { op: [[0, 0], [12299, 0], [12300, 1], [15150, 1], [15250, 0]] } });
const MP = L(S6, 'mouth');
const s7 = G('S7 down the chimney', [
  piv('flue push', P, { a: { s: [[14950, 1.0, IN], [15600, 2.6]] }, kids: [E('image', 'mouth (looking down the flue)', { o: [MP.x, MP.y], shape: img(MP.file, MP.w, MP.h) })] }),
], { a: { op: [[0, 0], [14949, 0], [15050, 1], [15700, 1], [15701, 0]] } });

// ---------------- S8-S10 the room (15600-23000) ----------------
const RM = 'ROOM', GF = 'GIFT', FR = 2.75;
const FM = A(RM, 'fire_mouth'), REST = A(RM, 'rest'), BT = A(GF, 'box_top'), BB = A(GF, 'box_base');
const panTo = (pt, s) => [(960 - pt[0]) * s, (540 - pt[1]) * s];   // pan (frame px at focus) that puts pt at the centre under zoom s
const KR = [[15600, 2.5, ...panTo(FM, 2.5), 0, PREM], [16800, 1.15, ...panTo([900, 600], 1.15), 0, GLIDE], [17600, 1.5, ...panTo([BT[0] - 40, BT[1] + 40], 1.5), 0, IO],
  [18900, 1.62, ...panTo([BT[0] - 12, BT[1] + 30], 1.62), 0, PREM], [20300, 1.06, ...panTo([900, 560], 1.06), 0, GLIDE], [23000, 1.1, ...panTo([890, 560], 1.1), 0, LIN]];
const rl_ = n => depthFactor(RM, n, FR);
const gp = n => plate(GF, n);
const tagR = L(GF, 'gift-tag'), TAGPIN = A(GF, 'tag_pin'), TAGC = [tagR.x + tagR.w / 2, tagR.y + tagR.h * .62];
const LAND = 16800, BOW = A(GF, 'bow'), POP = 19250;
const GBX = [BB[0], BB[1]];   // the box rests on this floor point
const giftRig = G('Santa’s gift', [
  piv('gift-flight (out of the fireplace)', GBX, { a: {
    o: [[16150, [FM[0], FM[1] + 40], OUT], [16500, [(FM[0] + GBX[0]) / 2, GBX[1] - 260], IN], [LAND, GBX, OUT], [16960, [GBX[0], GBX[1] - 46], IN], [17110, GBX, OUT], [17220, [GBX[0], GBX[1] - 10], IN], [17320, GBX]],
    s: [[16150, .55, OUT], [LAND - 1, 1, LIN], [LAND, [1.16, .8], OUT], [16900, [.94, 1.08], IO], [17110, [1.08, .9], OUT], [17200, [.98, 1.03], IO], [17320, [1, 1]]],
    r: [[16150, -24, OUT], [16500, 10, IN], [LAND, -3, OUT], [17110, 1.5, IO], [17320, 0]],
    op: [[0, 0], [16149, 0], [16150, 1]] }, kids: [
    gp('gift-box'),
    piv('lid tremble', [BT[0], BT[1]], { a: { r: [[18750, 0, LIN], ...Array.from({ length: 7 }, (_, k) => [18800 + k * 65, k % 2 ? -2.6 : 2.6, SINE]), [POP - 10, 0]], o: [[POP - 30, BT, OUT], [POP + 120, [BT[0], BT[1] - 40], IO], [POP + 380, [BT[0], BT[1] - 8]]] }, kids: [
      E('g', 'lid closed', { a: { op: [[0, 1], [POP, 1], [POP + 1, 0]] }, kids: [gp('gift-lid'),
        piv('bow (collapses)', BOW, { a: { s: [[18300, 1, OUT], [18420, 1.14, IN], [18680, .15]], r: [[18420, 0, IN], [18680, 70]], op: [[0, 1], [18560, 1], [18690, 0]] }, kids: [gp('gift-bow')] })] }),
      (() => { const lm = L(GF, 'gift-lid-mid'), c = [lm.x + lm.w / 2, lm.y + lm.h / 2]; return piv('lid pops off and tumbles away', c, { a: { op: [[0, 0], [POP, 0], [POP + 1, 1], [POP + 420, 1], [POP + 560, 0]], o: [[POP, c, OUT], [POP + 560, [c[0] + 760, c[1] - 560]]], r: [[POP, 0, OUT], [POP + 560, 48]], s: [[POP, .95, OUT], [POP + 560, 1.12]] }, kids: [gp('gift-lid-mid')] }); })(),
    ] }),
    piv('tag swing', TAGPIN, { a: { r: [[LAND, 0, OUT], ...Array.from({ length: 12 }, (_, k) => [LAND + 120 + k * 230, (k % 2 ? -1 : 1) * 26 * Math.exp(-k / 3.4), SINE]), [POP, 0, OUT], [POP + 300, -18, OUT], [POP + 900, 4]], op: [[0, 1], [POP + 120, 1], [POP + 420, 0]] }, kids: [
      piv('tag (oversized so it reads)', TAGPIN, { s: 2.2, kids: [gp('gift-tag'),
        G('EDIT ME 3 - tag-to (live text)', C.tag.map((s, i) => txt('tag-to line ' + (i + 1), s, TAGC[0], TAGC[1] - 8 + i * 13, 'Fraunces', 9.6, 600, { italic: true, anchor: 'middle', color: [70, 46, 28] })))] }),
    ] }),
  ] }),
]);
const shadowL = L(GF, 'gift-shadow');
const TOPF = ['top_fl', 'top_fr', 'top_br', 'top_bl'].map(k => A(GF, k));
const beam = G('light from the box', [
  E('path', 'the opening (light inside the box)', { shape: { path: TOPF.map(([x, y]) => ({ x, y, type: 'corner', mode: 0 })).concat([{ x: TOPF[0][0], y: TOPF[0][1], type: 'corner', mode: 0 }]) }, fill: { type: 'radial-gradient', value: { center: { x: .5, y: .5 }, radius: .6, stops: [{ offset: 0, color: { r: 255, g: 244, b: 214, a: 1 } }, { offset: .55, color: { r: 255, g: 196, b: 104, a: 1 } }, { offset: 1, color: { r: 168, g: 70, b: 30, a: 1 } }], spread: 'pad', fixed: false } }, a: { op: [[0, 0], [POP - 1, 0], [POP + 60, 1]] } }),
  glow('burst', BT[0], BT[1] - 40, 900, 900, [[0, 0], [POP - 40, 0], [POP + 60, 1], [POP + 700, .55], [23000, .45]], { a: { s: [[POP - 40, .2, OUT], [POP + 400, 1.15, IO], [23000, 1]] } }),
  ...Array.from({ length: 22 }, () => { const t = R(POP, 21600); return sparkle(BT[0] + R(-60, 60), BT[1] - R(0, 40), R(8, 22), t, R(1100, 1900), R(-140, 140), -R(260, 520), { peak: .8 }); }),
]);
const PB = [300, 360], PBASE = [BT[0] + 20, BT[1] + 8];   // product box: bottom-centre sits in the box opening
const product = G('EDIT ME 1 - product-image (rises from the box)', [
  glow('product glow', PBASE[0], PBASE[1] - 330, 620, 520, [[0, 0], [POP + 200, 0], [20300, .75], [23000, .6]]),
  E('g', 'emerges through the opening', { clip: 'c-open', kids: [
    E('clipPath', 'above the rim', { id: 'c-open', kids: [rect('above rim', BT[0] - 500, BT[1] - 900, 1000, 900 + 6, { fill: col([255, 255, 255]) })] }),
    piv('product-rise', PBASE, { a: { o: [[0, [PBASE[0], PBASE[1] + 330]], [POP + 150, [PBASE[0], PBASE[1] + 330], SOFT], [20250, [PBASE[0], PBASE[1] - 86], SPRING], [20700, [PBASE[0], PBASE[1] - 74], SINE], ...osc(20700, 23000, 2600, [PBASE[0], PBASE[1] - 74], [PBASE[0], PBASE[1] - 84])] }, kids: [
      E('image', 'product-image (transparent cut-out; base on the bottom edge)', { o: [PBASE[0] - PB[0] / 2, PBASE[1] - PB[1]], shape: img(C.product, PB[0], PB[1], 'xMidYMax meet') }),
    ] }),
  ] }),
]);
const roomL = (n, kids = []) => camLayer(n, KR, rl_(n), [plate(RM, n), ...kids]);
const RB = MAN.ANCH_ROOM.anchors;
const s8 = G('S8-S10 the living room', [
  roomL('back'),
  roomL('fire', RB.flames.filter((f, i) => i % 2 === 0).map(([x, y, r]) => glow('flame', x, y - r, r * 8, r * 10, osc(15600 + R(0, 300), 23000, R(700, 1000), .4, .85)))),
  roomL('tree', RB.bulbs.filter((b, i) => i % 2 === 0).map(([x, y, r], i) => glow('tree light', x, y, r * 6, r * 6, [[0, .2], ...osc(15600 + i * 37, 23000, 2200, .25, .9)]))),
  roomL('rug'),
  camLayer('gift + product (rest on the rug)', KR, 1, [
    piv('contact shadow (stays on the floor)', [BB[0], BB[1] - 6], { a: { op: [[0, 0], [16400, 0], [LAND, .75], [16960, .45], [17110, .75]], s: [[16400, .45, IN], [LAND, 1, OUT], [16960, .8, IN], [17110, 1]] }, kids: [rect('shadow', BB[0] - 300, BB[1] - 46, 600, 80, { rx: 40, fill: col([24, 10, 4], .8), filter: blur(22) })] }),
    giftRig, beam, product,
  ]),
  roomL('near'),
  rect('warm grade (soft-light)', 0, 0, W, H, { fill: col([255, 170, 90]), blend: 'soft-light', op: .07 }),
], { id: 'p-room', a: { op: [[0, 0], [15699, 0], [15700, 1]] } });

// ---------------- end card text (screen space) ----------------
const TX = 1180, AC = C.accent;
const endText = G('EDIT ME 4 - end card: logo, headline, cta-text, signoff', [
  rect('end-card scrim (keeps the words legible)', 760, 0, 1160, H, { fill: { type: 'linear-gradient', value: { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, stops: [{ offset: 0, color: { r: 12, g: 8, b: 6, a: 0 } }, { offset: .45, color: { r: 12, g: 8, b: 6, a: .55 } }, { offset: 1, color: { r: 12, g: 8, b: 6, a: .7 } }], spread: 'pad', fixed: false } }, a: { op: [[0, 0], [20100, 0], [20800, 1]] } }),
  G('logo-reveal', [E('image', 'logo', { o: [TX, 210], shape: img(C.logo, C.logoBox[0], C.logoBox[1], 'xMinYMid meet') })], { a: { op: [[0, 0], [20350, 0], [20800, 1]], o: [[20350, [0, 18], OUT], [20800, [0, 0]]] } }),
  E('g', 'headline (masked line rise)', { mask: 'm-head', kids: [
    E('mask', 'headline mask', { id: 'm-head', kids: [rect('window', TX - 20, 330, 760, 230, { fill: col([255, 255, 255]) })] }),
    ...C.headline.map((s, i) => G('headline-line-' + (i + 1), [txt('headline line ' + (i + 1) + ' (edit me)', s, TX, 420 + i * 92, 'Fraunces', 84, 600, { italic: i === 1, color: i === 1 ? AC : [255, 246, 230] })],
      { a: { o: [[20600 + i * 160, [0, 110], SOFT], [21250 + i * 160, [0, 0]]], op: [[0, 0], [20590 + i * 160, 0], [20600 + i * 160, 1]] } })),
  ] }),
  piv('cta (pops)', [TX + 150, 620], { a: { s: [[21500, .9, SPRING], [21850, 1]], op: [[0, 0], [21500, 0], [21640, 1]] }, kids: [
    rect('cta pill (accent colour)', TX, 588, 300, 64, { rx: 32, fill: col(AC) }),
    txt('cta-text (max 16 chars)', C.cta, TX + 150, 630, 'DM Sans', 26, 700, { anchor: 'middle', color: [36, 24, 12], ls: .5 }),
  ] }),
  G('signoff', [txt('signoff (edit me)', C.signoff, TX, 712, 'Fraunces', 30, 500, { italic: true, color: [255, 220, 170] })], { a: { op: [[0, 0], [22000, 0], [22500, 1]], o: [[22000, [0, 12], OUT], [22500, [0, 0]]] } }),
]);
const title1 = G('EDIT ME 5 - title-line (opening)', [
  E('g', 'title (fades out)', { a: { op: [[0, 1], [2650, 1], [3100, 0]] }, kids: [E('g', 'title (blur-in)', { a: { op: [[0, 0], [350, 0], [1300, 1]], f: [[350, blur(14)], [1300, blur(0)]], o: [[350, [0, 14], OUT], [1300, [0, 0]]] }, kids: [txt('title-line (edit me)', C.title, 120, 160, 'Fraunces', 64, 500, { italic: true })] })] }),
]);

// ---------------- snow (all exterior shots) ----------------
const flake = (depth) => { const big = depth === 2, z = big ? R(14, 26) : depth ? R(5, 9) : R(2, 4), T = big ? R(1600, 2600) : depth ? R(3500, 5200) : R(6500, 9000), x0 = R(-100, 2020), drift = R(-180, 60), ph = R(0, T), keys = [];
  for (let t = -ph; t < 15200; t += T) { keys.push([Math.max(t, 0), [x0 + (t < 0 ? drift * (-t / T) : 0), t < 0 ? -30 + 1140 * (-t / T) : -30], LIN], [Math.max(t + T - 1, 1), [x0 + drift, 1110], LIN]); }
  return rect('flake', 0, 0, z, z, { rx: z / 2, fill: col([240, 244, 255], big ? .55 : .85), ...(big ? { filter: blur(5) } : {}), a: { o: keys } }); };
const snow = G('snow (exterior)', [G('far flakes', Array.from({ length: 30 }, () => flake(0))), G('mid flakes', Array.from({ length: 16 }, () => flake(1))), G('near flakes (soft)', Array.from({ length: 5 }, () => flake(2)))], { id: 'p-snow', a: { op: [[0, 1], [15100, 1], [15350, 0]] } });

// ---------------- finish ----------------
const bridge = G('chimney to fireplace: firelight bloom', [
  rect('warm wash', 0, 0, W, H, { fill: col([255, 140, 60]), a: { op: [[0, 0], [15200, 0], [15580, .5], [15720, .42], [16100, 0]] } }),
  spr('fire bloom', 'glow-gold.jpg', 960, 560, 2900, 2400, { ...light, a: { op: [[0, 0], [15150, 0], [15560, 1], [15800, .75], [16250, 0]], s: [[15150, .35, IN], [15600, 1.05, OUT], [16250, 1.25]] } }),
]);
const finish = G('finish: vignette, letterbox', [
  E('image', 'vignette', { shape: img('vignette.png', W, H), op: .85 }),
  rect('letterbox-top (delete both bars for a full frame)', 0, 0, W, 64, { fill: col([0, 0, 0]) }), rect('letterbox-bottom', 0, H - 64, W, 64, { fill: col([0, 0, 0]) }),
]);
const readme = G('README (outside the canvas: how to make it yours)', [txt('readme', 'MAKE IT YOURS: 1 product-image  2 logo (sack + end card)  3 tag-to  4 headline, cta-text, signoff  5 accent colour on the cta pill + headline line 2. Nothing else needs touching.', 0, 1240, 'DM Sans', 22, 500, { color: [255, 230, 190] })]);

const doc = { id: 'svg-delivery', type: 'svg', animation: { duration: DUR, direction: 1, iterations: 1, fill: 1, alternate: false, speed: 1 },
  properties: { shape: { position: { x: 0, y: 0 }, size: { width: W, height: H }, bgColor: col([4, 6, 14]) } },
  children: [s1, title1, whipOut, s4, s5, s6, s7, s8, bridge, endText, snow, finish, readme] };

(function check() {
  let n = 0, keysN = 0, imgs = new Set();
  (function walk(e) { n++; if (e.properties && e.properties.shape && e.properties.shape.href) imgs.add(e.properties.shape.href);
    for (const g in e.animators || {}) for (const c in e.animators[g]) { const ks = e.animators[g][c].keys; keysN += ks.length; ks.forEach((q, i) => console.assert(q.time >= 0 && q.time <= DUR && (!i || q.time > ks[i - 1].time), 'bad key order', e.title, g, c, q.time)); }
    (e.children || []).forEach(walk); })(doc);
  console.log('elements', n, 'keyframes', keysN, 'images', imgs.size);
})();
const out = process.env.OUTNAME || (SET === 'set1' ? 'delivery' : 'delivery-' + SET);
// upload chunks: the base document with placeholders, then each big piece as an edit_part update of its placeholder (parents first)
const SPLIT = ['p-s1', 'p-s2', 'p-s2team', 'p-s4', 'p-s4team', 'p-s6', 'p-s6team', 'p-snow'];
const strip = (e, keep) => (SPLIT.includes(e.id) && e.id !== keep) ? { id: e.id, type: 'g', title: e.title } : { ...e, ...(e.children ? { children: e.children.map(c => strip(c, keep)) } : {}) };
const find = (e, id) => e.id === id ? e : (e.children || []).reduce((r, c) => r || find(c, id), null);
const cdir = path.join(__dirname, out + '-chunks'); fs.rmSync(cdir, { recursive: true, force: true }); fs.mkdirSync(cdir);
const base = strip(doc, null); const lined = o => JSON.stringify(o).replace(/\},\{/g, '},\n{');   // valid JSON, broken into short lines for reading
fs.writeFileSync(path.join(cdir, '0-base.json'), lined(base)); console.log('chunk base', (JSON.stringify(base).length / 1024).toFixed(1), 'KB');
SPLIT.forEach((id, i) => { const el = strip(find(doc, id), id); fs.writeFileSync(path.join(cdir, (i + 1) + '-' + id + '.json'), lined(el)); console.log('chunk', id, (JSON.stringify(el).length / 1024).toFixed(1), 'KB'); });
fs.writeFileSync(path.join(__dirname, out + '.json'), JSON.stringify(doc));
fs.writeFileSync(path.join(__dirname, out + '.js'), 'window.SCENE_BASE=' + JSON.stringify(BASE) + ';window.SCENE=' + JSON.stringify(doc) + ';');
console.log(out + '.json', (JSON.stringify(doc).length / 1024).toFixed(1), 'KB');
