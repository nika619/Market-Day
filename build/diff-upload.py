# Turns two builds of a project into the smallest list of edit_part calls that makes SVGator match the new one.
# python diff-upload.py <remote-state.json> <new.json> <outDir> [idmap.json]
#   remote-state: the build that is live in SVGator now; new: the build to upload.
#   idmap: {"local id": "remote id"} for elements whose live id differs (an updated root keeps its old id, inserts may be renamed).
# Rules (from edit_part): update #id without `children` keeps the subtree; animators are taken verbatim, so every op sends the
# element's full own fields. New children go in as inserts (prepend / after a sibling); any other change to a child list
# rewrites the parent with its children one level deep (existing children sent without their own children, so they keep them).
# Image hrefs are compared without the pinned commit, so a re-pinned BASE alone is not a change.
import json, os, re, sys

old, new = (json.load(open(p, encoding='utf8')) for p in sys.argv[1:3])
out = sys.argv[3]; idmap = json.load(open(sys.argv[4])) if len(sys.argv) > 4 and os.path.exists(sys.argv[4]) else {}
LIMIT = 28 * 1024
norm = lambda o: re.sub(r'/conjure-svgator/[0-9a-f]{40}/assets/', '/conjure-svgator/@/assets/', json.dumps(o, sort_keys=True, ensure_ascii=False))
own = lambda n: {k: v for k, v in n.items() if k != 'children'}
kids = lambda n: n.get('children') or []

def index(n, acc, parent=None):
    acc[n['id']] = (n, parent)
    for c in kids(n): index(c, acc, n['id'])
    return acc
R, N = index(old, {}), index(new, {})

def remap(o):   # local ids -> live ids, in item paths, element ids and mask/clip references
    s = json.dumps(o, ensure_ascii=False)
    for a, b in idmap.items(): s = s.replace('"%s"' % a, '"%s"' % b)
    return json.loads(s)

ops = []
def op(action, item, value=None, why=''):
    v = remap(value) if value is not None else None
    if v is not None and len(json.dumps(v)) > LIMIT: raise SystemExit('op too big (%d B) for %s %s: split it' % (len(json.dumps(v)), action, item))
    ops.append({'action': action, 'item': '#' + idmap.get(item, item), **({'value': v} if v is not None else {}), 'why': why})

def walk(n):
    r = R.get(n['id'])
    if not r: return   # new nodes are sent whole by their parent's insert
    r = r[0]
    kn, kr = [c['id'] for c in kids(n)], [c['id'] for c in kids(r)]
    if kn != kr:
        added = [i for i in kn if i not in R]
        if [i for i in kn if i in R] == kr:   # only new children: insert each
            if norm(own(n)) != norm(own(r)): op('update', n['id'], own(n), 'own fields')
            for c in kids(n):
                if c['id'] in added:
                    i = kn.index(c['id'])
                    op('prepend', n['id'], c, 'new child') if i == 0 else op('after', kn[i - 1], c, 'new child of ' + n['id'])
        else:
            op('update', n['id'], {**own(n), 'children': [c if c['id'] not in R or N[c['id']][1] != R[c['id']][1] else own(c) for c in kids(n)]}, 'child list changed')
            for c in kids(n):
                if c['id'] in R and R[c['id']][1] == n['id']:
                    for g in kids(c): walk(g)
            return
    elif norm(own(n)) != norm(own(r)): op('update', n['id'], own(n), 'own fields')
    for c in kids(n): walk(c)

walk(new)
gone = [i for i in R if i not in N]
for i in gone:
    if R[i][1] in N and R[R[i][1]][1] is not None and i not in json.dumps([o.get('value') for o in ops]): op('delete', i, why='removed')
os.makedirs(out, exist_ok=True)
for f in os.listdir(out): os.remove(os.path.join(out, f))
for k, o in enumerate(ops):
    json.dump(o, open(os.path.join(out, '%02d-%s-%s.json' % (k, o['action'], o['item'][1:])), 'w', encoding='utf8'), ensure_ascii=False)
    print('%02d %-8s %-16s %6d B  %s' % (k, o['action'], o['item'], len(json.dumps(o.get('value'))), o['why']))
assert all(o['item'][1:] not in gone or o['action'] == 'delete' for o in ops)
