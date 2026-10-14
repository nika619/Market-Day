// Local previewer for the SVGator project JSON that scene.js emits (only the subset it uses).
// Markup and maths mirror SVGator's own export: matrix = T(origin) R Skew S T(translate), filters as SVG primitives.
(function () {
  const NS = 'http://www.w3.org/2000/svg', XL = 'http://www.w3.org/1999/xlink', D = Math.PI / 180;
  const doc = window.SCENE, BASE = window.SCENE_BASE, LOCAL = '../assets/';
  const updaters = []; let uid = 0;
  const mk = (tag, parent) => parent.appendChild(document.createElementNS(NS, tag));
  const rgba = c => `rgba(${c.r},${c.g},${c.b},${c.a})`;
  let gid = 0, DEFS = null;
  const paint = p => { // solid colours inline; gradients become <linearGradient>/<radialGradient> in defs (objectBoundingBox unless fixed)
    if (!p || p.type === 'none') return 'none';
    if (p.type === 'color') return rgba(p.value);
    const v = p.value, g = document.createElementNS(NS, p.type === 'linear-gradient' ? 'linearGradient' : 'radialGradient'); g.id = 'g' + (++gid);
    g.setAttribute('gradientUnits', v.fixed ? 'userSpaceOnUse' : 'objectBoundingBox'); if (v.spread) g.setAttribute('spreadMethod', v.spread);
    if (p.type === 'linear-gradient') { g.setAttribute('x1', v.from.x); g.setAttribute('y1', v.from.y); g.setAttribute('x2', v.to.x); g.setAttribute('y2', v.to.y); }
    else { g.setAttribute('cx', v.center.x); g.setAttribute('cy', v.center.y); g.setAttribute('r', v.radius); }
    for (const s of v.stops) { const st = document.createElementNS(NS, 'stop'); st.setAttribute('offset', s.offset); st.setAttribute('stop-color', `rgb(${s.color.r},${s.color.g},${s.color.b})`); st.setAttribute('stop-opacity', s.color.a); g.appendChild(st); }
    DEFS.appendChild(g); return `url(#${g.id})`;
  };

  function matrix(tr) {
    const o = tr.origin || { x: 0, y: 0 }, t = tr.translate || { x: 0, y: 0 }, s = tr.scale || { x: 1, y: 1 }, k = tr.skew || { x: 0, y: 0 };
    const r = (tr.rotate || 0) * D, c = Math.cos(r), n = Math.sin(r), kx = Math.tan((k.x || 0) * D), ky = Math.tan((k.y || 0) * D);
    const a = (c - n * ky) * s.x, b = (n + c * ky) * s.x, cc = (c * kx - n) * s.y, d = (n * kx + c) * s.y;
    return `matrix(${a} ${b} ${cc} ${d} ${o.x + a * t.x + cc * t.y} ${o.y + b * t.x + d * t.y})`;
  }
  function bez(e, x) { // cubic-bezier(from, to) solved for x
    const x1 = e.from.x, y1 = e.from.y, x2 = e.to.x, y2 = e.to.y; let lo = 0, hi = 1, u = x;
    for (let i = 0; i < 24; i++) { u = (lo + hi) / 2; const bx = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u; bx < x ? lo = u : hi = u; }
    return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
  }
  function mix(a, b, f) {
    if (typeof a === 'number') return a + (b - a) * f;
    if (Array.isArray(a)) return a.map((v, i) => mix(v, b[i], f));
    if (a && typeof a === 'object') { const o = {}; for (const k in a) o[k] = mix(a[k], b[k], f); return o; }
    return a;
  }
  function sample(ks, t) {
    if (t <= ks[0].time) return ks[0].value;
    for (let i = 0; i < ks.length - 1; i++) {
      const A = ks[i], B = ks[i + 1];
      if (t < B.time) { let f = (t - A.time) / (B.time - A.time); const e = A.easing; if (e && e.type === 'cubic-bezier') f = bez(e.value, f); else if (e && e.type === 'steps') f = 0; return mix(A.value, B.value, f); }
    }
    return ks[ks.length - 1].value;
  }
  function pathD(nodes) {
    let d = `M${nodes[0].x} ${nodes[0].y}`;
    for (let i = 1; i < nodes.length; i++) {
      const p = nodes[i - 1], q = nodes[i];
      d += (p.end || q.start) ? `C${(p.end || p).x} ${(p.end || p).y} ${(q.start || q).x} ${(q.start || q).y} ${q.x} ${q.y}` : `L${q.x} ${q.y}`;
    }
    return d;
  }
  function setFilter(fEl, list) {
    while (fEl.firstChild) fEl.removeChild(fEl.firstChild);
    for (const it of list) {
      if (it.type === 'blur') mk('feGaussianBlur', fEl).setAttribute('stdDeviation', `${it.value.x},${it.value.y}`);
      else if (it.type === 'brightness') { const ct = mk('feComponentTransfer', fEl); for (const ch of 'RGB') { const fn = mk('feFunc' + ch, ct); fn.setAttribute('type', 'linear'); fn.setAttribute('slope', it.value); } }
    }
  }
  function build(n, parent, defs) {
    const P = n.properties || {}, sh = P.shape || {};
    const tag = { g: 'g', image: 'image', rect: 'rect', ellipse: 'ellipse', path: 'path', text: 'text', mask: 'mask', clipPath: 'clipPath' }[n.type];
    const e = mk(tag, parent); if (n.title) e.setAttribute('data-title', n.title);
    if (n.type === 'mask') { e.id = n.id; e.setAttribute('mask-type', 'luminance'); for (const [k, v] of [['x', '-150%'], ['y', '-150%'], ['width', '400%'], ['height', '400%']]) e.setAttribute(k, v); }
    if (n.type === 'clipPath') e.id = n.id;
    const state = { tr: Object.assign({}, P.transform || {}) };
    const applyTr = () => e.setAttribute('transform', matrix(state.tr));
    if (n.type !== 'mask') applyTr();
    if (n.type === 'image') { e.setAttribute('width', sh.size.width); e.setAttribute('height', sh.size.height); e.setAttributeNS(XL, 'href', sh.href.replace(BASE, LOCAL)); e.setAttribute('href', sh.href.replace(BASE, LOCAL)); e.setAttribute('preserveAspectRatio', sh.aspectRatio || 'xMidYMid meet'); }
    if (n.type === 'rect') { e.setAttribute('width', sh.size.width); e.setAttribute('height', sh.size.height); if (sh.radius) { e.setAttribute('rx', sh.radius.x); e.setAttribute('ry', sh.radius.y); } }
    if (n.type === 'ellipse') { e.setAttribute('rx', sh.radius.x); e.setAttribute('ry', sh.radius.y); }
    if (n.type === 'path') e.setAttribute('d', pathD(sh.path));
    if (n.type === 'text') {
      e.setAttribute('font-family', sh.fontFamily); e.setAttribute('font-size', sh.fontSize); e.setAttribute('font-weight', (sh.fontStyle || {}).weight || 400);
      if ((sh.fontStyle || {}).italic) e.setAttribute('font-style', 'italic');
      e.setAttribute('letter-spacing', sh.letterSpacing || 0); e.setAttribute('text-anchor', sh.textAnchor || 'start');
      let idx = 0;
      sh.text.split('\n').forEach((line, li) => {
        const rs = (sh.rangeStyles || []).filter(r => r.from <= idx + line.length - 1 && r.to >= idx);
        const ts = mk('tspan', e); ts.setAttribute('x', 0); ts.setAttribute('y', li * sh.fontSize); ts.textContent = line;
        if (rs.length) ts.setAttribute('fill', paint(rs[0].properties.fill.paint));
        idx += line.length + 1;
      });
    }
    if (P.fill) { e.setAttribute('fill', paint(P.fill.paint)); if (P.fill.opacity != null) e.setAttribute('fill-opacity', P.fill.opacity); }
    else if (['rect', 'ellipse', 'path'].includes(n.type)) e.setAttribute('fill', 'none');
    if (P.stroke) { const s = P.stroke; e.setAttribute('stroke', paint(s.paint)); e.setAttribute('stroke-width', s.width || 0); if (s.lineCap) e.setAttribute('stroke-linecap', s.lineCap); if (s.dashArray && s.dashArray.length) e.setAttribute('stroke-dasharray', s.dashArray.join(',')); if (s.dashOffset != null) e.setAttribute('stroke-dashoffset', s.dashOffset); if (s.opacity != null) e.setAttribute('stroke-opacity', s.opacity); }
    const C = P.compositing || {};
    if (C.opacity != null) e.setAttribute('opacity', C.opacity);
    if (C.blend && C.blend !== 'normal') e.style.mixBlendMode = C.blend;
    if (C.mask && C.mask.source) e.setAttribute('mask', `url(#${C.mask.source})`);
    if (C.clip && C.clip.path) e.setAttribute('clip-path', `url(#${C.clip.path})`);
    let fEl = null;
    const A = n.animators || {};
    if ((P.filter && P.filter.list && P.filter.list.length) || (A.filter && A.filter.list)) {
      fEl = mk('filter', defs); fEl.id = 'f' + (++uid); for (const [k, v] of [['x', '-150%'], ['y', '-150%'], ['width', '400%'], ['height', '400%']]) fEl.setAttribute(k, v);
      setFilter(fEl, (P.filter && P.filter.list) || []); e.setAttribute('filter', `url(#${fEl.id})`);
    }
    if (A.transform) for (const ch in A.transform) { const ks = A.transform[ch].keys; updaters.push(t => { state.tr[ch] = sample(ks, t); }); }
    if (A.transform) updaters.push(applyTr);
    if (A.compositing && A.compositing.opacity) { const ks = A.compositing.opacity.keys; updaters.push(t => e.setAttribute('opacity', sample(ks, t))); }
    if (A.stroke && A.stroke.dashOffset) { const ks = A.stroke.dashOffset.keys; updaters.push(t => e.setAttribute('stroke-dashoffset', sample(ks, t))); }
    if (A.shape && A.shape.size) { const ks = A.shape.size.keys; updaters.push(t => { const v = sample(ks, t); e.setAttribute('width', v.width); e.setAttribute('height', v.height); }); }
    if (A.shape && A.shape.path) { const ks = A.shape.path.keys; updaters.push(t => e.setAttribute('d', pathD(sample(ks, t)))); }
    if (A.fill && A.fill.opacity) { const ks = A.fill.opacity.keys; updaters.push(t => e.setAttribute('fill-opacity', sample(ks, t))); }
    if (A.stroke && A.stroke.opacity) { const ks = A.stroke.opacity.keys; updaters.push(t => e.setAttribute('stroke-opacity', sample(ks, t))); }
    if (A.shape && A.shape.radius) { const ks = A.shape.radius.keys; updaters.push(t => { const v = sample(ks, t); e.setAttribute('rx', v.x); e.setAttribute('ry', v.y); }); }
    if (A.filter && A.filter.list) { const ks = A.filter.list.keys; updaters.push(t => setFilter(fEl, sample(ks, t))); }
    let kids = n.children || [];
    if (/^video frames/.test(n.title || '') && location.hash) { // screenshots draw only the frame on top at that time: same picture, one image to load instead of hundreds
      const h = +location.hash.slice(1); let k = 0;
      kids.forEach((c, i) => { const a = c.animators && c.animators.compositing; if (!a || sample(a.opacity.keys, h) >= .5) k = i; });
      kids = [kids[k]];
    }
    for (const c of kids) build(c, e, defs);
    return e;
  }
  const sz = doc.properties.shape.size;
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', `0 0 ${sz.width} ${sz.height}`); svg.setAttribute('width', '100%');
  svg.style.background = paint(doc.properties.shape.bgColor); svg.style.display = 'block';
  document.body.appendChild(svg);
  const defs = mk('defs', svg); DEFS = defs;
  for (const c of doc.children) build(c, svg, defs);
  window.seek = t => { for (const u of updaters) u(t); };
  const h = +location.hash.slice(1);
  if (location.hash) seek(h); else { const t0 = performance.now(); (function loop() { seek((performance.now() - t0) % doc.animation.duration); requestAnimationFrame(loop); })(); }
})();
