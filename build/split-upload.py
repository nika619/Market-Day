# Splits a built project into ordered SVGator MCP calls that each stay under the payload limit (~28 KB; ~60 KB calls failed with 502).
# python split-upload.py <doc.json> <outDir>
#   00-root.json      -> create_project document (oversized subtrees replaced by {id,type,title} stubs)
#   NN-<id>.json      -> edit_part update '#<id>' with that element (its own oversized children stubbed again), in parent-first order
# Upload in file order; record each finished piece in <outDir>/DONE so an interrupted upload resumes where it stopped.
import json, os, sys

LIMIT = 28 * 1024
src, out = sys.argv[1], sys.argv[2]
doc = json.load(open(src, encoding='utf8'))
size = lambda o: len(json.dumps(o, separators=(',', ':'), ensure_ascii=False))
stub = lambda e: {'id': e['id'], 'type': e['type'], 'title': e.get('title', '')}
pieces = []

def emit(el, name):
    kids, later = list(el.get('children') or []), []
    while kids and size({**el, 'children': kids}) > LIMIT:   # stub the largest real child until the element fits
        i = max((i for i, c in enumerate(kids) if c.get('children') or size(c) > 200), key=lambda i: size(kids[i]))
        later.append(kids[i]); kids[i] = stub(kids[i])
    piece = {**el, 'children': kids} if 'children' in el else el
    assert size(piece) <= LIMIT, 'element %s alone is %d B' % (el['id'], size(piece))
    pieces.append((name, piece))
    for c in later: emit(c, c['id'])

emit(doc, 'root')
os.makedirs(out, exist_ok=True)
for f in os.listdir(out): os.remove(os.path.join(out, f))
for k, (name, p) in enumerate(pieces):
    json.dump(p, open(os.path.join(out, '%02d-%s.json' % (k, name)), 'w', encoding='utf8'), separators=(',', ':'), ensure_ascii=False)
ids = lambda e: [e['id']] + [i for c in (e.get('children') or []) for i in ids(c)]
real = set(ids(doc)); covered = set()
for _, p in pieces: covered |= {i for i in ids(p) if i not in {c['id'] for c in (p.get('children') or []) if 'children' not in c and c.get('type') == 'g' and c['id'] in {q['id'] for _, q in pieces}}}
assert real <= covered | {p['id'] for _, p in pieces}, 'some elements are in no piece'
print(len(pieces), 'pieces,', round(sum(size(p) for _, p in pieces) / 1024), 'KB total, largest', max(size(p) for _, p in pieces), 'B')
