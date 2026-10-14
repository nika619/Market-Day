// prints the edit_part payloads that bring a live SVGator project up to the local build (product on the tray + label card)
const set = process.argv[2] || 'set1', doc = require('./' + (set === 'set1' ? 'market' : 'market-' + set) + '.json');
const find = (e, f) => f(e) ? e : (e.children || []).reduce((r, c) => r || find(c, f), null);
const byTitle = t => find(doc, e => e.title === t);
const out = {};
for (const [id, t, i] of [['c28', 'depth-1 stall', 3], ['c47', 'depth-3 seller', 3], ['c50', 'depth-4 foreground (out of focus)', 3], ['c89', 'blurred stall (follows the camera)', 0], ['c92', 'blurred seller (follows the camera)', 0]]) {
  const e = byTitle(t), tr = e.animators.transform; console.assert(e.id === id && tr.origin.keys[i].time === 9000, id);
  out[id] = { i, o: tr.origin.keys[i].value, s: tr.scale.keys[i].value };
}
const th = byTitle('light-thread (from the button to the product)'); console.assert(th.id === 'c113'); out.c113 = th.properties.shape.path;
let n = 0; const reid = (e, p) => { e.id = p + (++n); (e.children || []).forEach(c => reid(c, p)); return e; };
const prod = JSON.parse(JSON.stringify(byTitle('product (rides the scene camera)'))); n = 0; reid(prod, 'pd'); delete prod.id; prod.children.forEach(c => reid(c, 'pd'));
out.c131 = prod; n = 0; out.label = reid(JSON.parse(JSON.stringify(byTitle('EDIT ME 3 - label: label-title, label-detail'))), 'lb');
for (const k in out) console.log('== ' + k + ' (' + JSON.stringify(out[k]).length + ')\n' + JSON.stringify(out[k]));
