/* Used by office-life.html. It reads the same map as index.html (the copy saved in this
   browser, the desk-map-data.json next to it, or a file you pick) and turns it into a floor people can walk on,
   with the exits a drill sends them to.
   Everything is measured in squares, like the app: desks and pillars fill squares, walls and windows close the
   edges between squares, and doors leave a gap. Nothing here ever writes to the map. */
(function(){
'use strict';

const LS_KEY = 'office-desk-map:v1';
const SHAPES = { h: { w: 4, h: 2 }, v: { w: 2, h: 4 }, corner: { w: 4, h: 4 } };
const WALL = 0.22;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const COFFEE_AREA = /kitchen|coffee|caf[eé]|break|pantry|lounge|cocina|comedor|cafeter/i;
const MEETING_AREA = /meet|conference|board|huddle|sala|reuni/i;

/* ---------- reading the map ---------- */
const validMap = d => d && Array.isArray(d.desks) && Array.isArray(d.people);

async function load(){
  try {
    const t = localStorage.getItem(LS_KEY);
    if (t) { const d = JSON.parse(t); if (validMap(d) && d.desks.length) return { data: d, source: 'browser' }; }
  } catch {}
  if (/^https?:$/.test(location.protocol)) {
    try {
      const r = await fetch('desk-map-data.json', { cache: 'no-store' });
      if (r.ok) { const d = await r.json(); if (validMap(d) && d.desks.length) return { data: d, source: 'site' }; }
    } catch {}
  }
  return { data: demoMap(), source: 'demo' };
}
async function readFile(file){
  let d;
  try { d = JSON.parse(await file.text()); } catch { throw new Error('That file isn’t a desk map.'); }
  if (!validMap(d)) throw new Error('That file isn’t a desk map.');
  if (!d.desks.length) throw new Error('That map has no desks yet.');
  return d;
}
function sourceLabel(source, fileName){
  return source === 'browser' ? 'Your map, as last saved in this browser'
    : source === 'site' ? 'desk-map-data.json from this site'
    : source === 'file' ? fileName || 'Your map file'
    : 'A demo office. Open your map to use yours.';
}

/* ---------- shapes, same rules as index.html ---------- */
function inShape(shape, rot, c, r){
  if (shape !== 'corner') return true;
  switch (rot) {
    case 90: return r < 2 || c >= 2;
    case 180: return r >= 2 || c >= 2;
    case 270: return r >= 2 || c < 2;
    default: return r < 2 || c < 2;
  }
}
function cellsOf(shape, rot, x, y){
  const s = SHAPES[shape] || SHAPES.h, out = [];
  for (let r = 0; r < s.h; r++) for (let c = 0; c < s.w; c++) if (inShape(shape, rot, c, r)) out.push([x + c, y + r]);
  return out;
}
function normSeg(f){
  return { ...f, x1: Math.min(f.x1, f.x2), x2: Math.max(f.x1, f.x2), y1: Math.min(f.y1, f.y2), y2: Math.max(f.y1, f.y2) };
}
function segEdges(f){
  const out = [];
  if (f.y1 === f.y2) for (let x = f.x1; x < f.x2; x++) out.push(['h', x, f.y1]);
  else for (let y = f.y1; y < f.y2; y++) out.push(['v', f.x1, y]);
  return out;
}
// swing: bit 1 opens down/right (otherwise up/left), bit 2 hinges at the far end (otherwise at x1,y1)
function doorGeom(f){
  const L = (f.x2 - f.x1) + (f.y2 - f.y1), horiz = f.y1 === f.y2, side = f.swing & 1 ? 1 : -1, far = f.swing & 2;
  const hinge = far ? [f.x2, f.y2] : [f.x1, f.y1], other = far ? [f.x1, f.y1] : [f.x2, f.y2];
  const leaf = horiz ? [hinge[0], hinge[1] + side * L] : [hinge[0] + side * L, hinge[1]];
  return { L, horiz, side, hinge, other, leaf };
}
const zonePts = z => z.pts?.length ? z.pts : [[z.x, z.y], [z.x + z.w, z.y], [z.x + z.w, z.y + z.h], [z.x, z.y + z.h]];
function inPts(P, px, py){
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* ---------- people ---------- */
function initials(name){
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
function shortName(name){
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || '';
  return parts[0] + ' ' + parts[parts.length - 1][0] + '.';
}
function parseDay(s){
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
// work anniversaries around `today`: this year's date, how many years, and how many days away (negative = passed)
function anniversaries(people, today = new Date()){
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()), out = [];
  for (const p of people) {
    const start = parseDay(p.startDate);
    if (!start || start > t0) continue;
    const sinceStart = Math.round((t0 - start) / 864e5);
    let years = t0.getFullYear() - start.getFullYear();
    const day = y => { const d = new Date(y, start.getMonth(), start.getDate()); if (d.getMonth() !== start.getMonth()) d.setDate(0); return d; };
    let date = day(t0.getFullYear()), days = Math.round((date - t0) / 864e5);
    // within half a year either way, so a December start still shows up in early January
    if (days > 182) { date = day(t0.getFullYear() - 1); years--; days = Math.round((date - t0) / 864e5); }
    else if (days < -182) { date = day(t0.getFullYear() + 1); years++; days = Math.round((date - t0) / 864e5); }
    if (years < 1) out.push({ person: p, years: 0, date: start, days: -sinceStart, isNew: sinceStart <= 30 });
    else out.push({ person: p, years, date, days, isNew: false });
  }
  return out;
}
const celebrating = a => a.years >= 1 && a.days >= -3 && a.days <= 3;

/* ---------- the walkable floor ---------- */
function build(data){
  const people = new Map((data.people || []).filter(p => p && p.id != null).map(p => [String(p.id), p]));
  const zones = (data.zones || []).filter(z => z && isFinite(z.x) && isFinite(z.y));
  const fixtures = (data.fixtures || []).filter(f => f && FIXKINDS.has(f.kind)).map(f => f.kind === 'pillar' ? f : normSeg(f));
  const desks = (data.desks || []).filter(d => d && isFinite(d.x) && isFinite(d.y)).map((d, i) => {
    const s = SHAPES[d.shape] || SHAPES.h;
    return { i, id: String(d.id), number: d.number ?? '', shape: d.shape, rot: d.rot || 0, x: d.x, y: d.y, w: s.w, h: s.h,
      cx: d.x + s.w / 2, cy: d.y + s.h / 2, cells: cellsOf(d.shape, d.rot || 0, d.x, d.y),
      person: d.personId != null ? people.get(String(d.personId)) || null : null };
  });

  // sheet size: hug the layout with the same margin on both sides, like the app's view mode
  let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
  const grow = (x, y, w, h) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h); };
  for (const d of desks) grow(d.x, d.y, d.w, d.h);
  for (const z of zones) for (const [x, y] of zonePts(z)) grow(x, y, 0, 0);
  for (const f of fixtures) f.kind === 'pillar' ? grow(f.x, f.y, f.w, f.h) : grow(f.x1, f.y1, f.x2 - f.x1, f.y2 - f.y1);
  if (!isFinite(minX)) { minX = minY = 0; maxX = 20; maxY = 14; }
  const cols = Math.ceil(maxX + Math.max(2, minX)), rows = Math.ceil(maxY + Math.max(2, minY)), N = cols * rows;

  const idx = (x, y) => y * cols + x;
  const inside = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
  const block = new Uint8Array(N), deskAt = new Int32Array(N).fill(-1);
  for (const d of desks) for (const [x, y] of d.cells) if (inside(x, y)) { block[idx(x, y)] = 1; deskAt[idx(x, y)] = d.i; }
  const hWall = new Set(), vWall = new Set(), wallRects = [];
  for (const f of fixtures) {
    if (f.kind === 'pillar') { for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) if (inside(x, y)) block[idx(x, y)] = 1; continue; }
    if (f.kind === 'door') continue;
    for (const [o, x, y] of segEdges(f)) (o === 'h' ? hWall : vWall).add(x + ',' + y);
    const t = WALL / 2 + 0.04;
    wallRects.push(f.y1 === f.y2 ? { x: f.x1 - t, y: f.y1 - t, w: f.x2 - f.x1 + 2 * t, h: 2 * t } : { x: f.x1 - t, y: f.y1 - t, w: 2 * t, h: f.y2 - f.y1 + 2 * t });
  }
  const free = (x, y) => inside(x, y) && !block[idx(x, y)];
  // one step to a side neighbour: the square must be empty and no wall in between
  function open(x, y, dx, dy){
    const nx = x + dx, ny = y + dy;
    if (!free(nx, ny)) return false;
    if (dx === 1) return !vWall.has(nx + ',' + y);
    if (dx === -1) return !vWall.has(x + ',' + y);
    if (dy === 1) return !hWall.has(x + ',' + ny);
    return !hWall.has(x + ',' + y);
  }
  // diagonal steps only where both ways round the corner are open, so nobody cuts through a desk corner
  const canMove = (x, y, dx, dy) => !dx || !dy ? open(x, y, dx, dy)
    : open(x, y, dx, 0) && open(x + dx, y, 0, dy) && open(x, y, 0, dy) && open(x, y + dy, dx, 0);

  // connected parts of the floor
  const comp = new Int32Array(N).fill(-1);
  let nComp = 0;
  for (let s = 0; s < N; s++) {
    if (block[s] || comp[s] >= 0) continue;
    const q = [s]; comp[s] = nComp;
    while (q.length) {
      const c = q.pop(), x = c % cols, y = (c - x) / cols;
      for (let k = 0; k < 4; k++) { const [dx, dy] = DIRS[k]; if (open(x, y, dx, dy)) { const n = idx(x + dx, y + dy); if (comp[n] < 0) { comp[n] = nComp; q.push(n); } } }
    }
    nComp++;
  }

  // where each desk's person sits: the empty square next to the desk that's closest to its middle
  const seatTaken = new Set();
  for (const d of desks) {
    let best = null, bestD = Infinity;
    for (const [x, y] of d.cells) for (let k = 0; k < 4; k++) {
      const [dx, dy] = DIRS[k], nx = x + dx, ny = y + dy;
      if (!free(nx, ny)) continue;
      // a wall between the desk and the square means you can't sit there
      if (dx === 1 && vWall.has(nx + ',' + y) || dx === -1 && vWall.has(x + ',' + y) || dy === 1 && hWall.has(x + ',' + ny) || dy === -1 && hWall.has(x + ',' + y)) continue;
      const dist = Math.hypot(nx + 0.5 - d.cx, ny + 0.5 - d.cy) + (seatTaken.has(idx(nx, ny)) ? 1.5 : 0);
      if (dist < bestD) { bestD = dist; best = [nx, ny, dx, dy]; }
    }
    if (!best) continue;
    const [sx, sy, dx, dy] = best;
    seatTaken.add(idx(sx, sy));
    d.seat = { cx: sx, cy: sy, x: sx + 0.5 - dx * 0.14, y: sy + 0.5 - dy * 0.14, fx: -dx, fy: -dy };
    d.comp = comp[idx(sx, sy)];
  }
  const compDesks = new Map();
  for (const d of desks) if (d.seat) compDesks.set(d.comp, (compDesks.get(d.comp) || 0) + 1);
  const mainComp = [...compDesks.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  for (const d of desks) d.reach = !!d.seat && d.comp === mainComp;
  const onFloor = (x, y) => free(x, y) && comp[idx(x, y)] === mainComp;

  // outdoors: what you can reach from the edge of the sheet without going through a door. With no walls
  // drawn that's everything, and then it all counts as indoors.
  const doorEdge = new Set();
  for (const f of fixtures) if (f.kind === 'door') for (const [o, x, y] of segEdges(f)) doorEdge.add(o + x + ',' + y);
  const thruDoor = (x, y, dx, dy) => doorEdge.has(dx ? 'v' + (dx > 0 ? x + 1 : x) + ',' + y : 'h' + x + ',' + (dy > 0 ? y + 1 : y));
  const outside = new Uint8Array(N), oq = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if ((!x || !y || x === cols - 1 || y === rows - 1) && free(x, y)) { outside[idx(x, y)] = 1; oq.push(idx(x, y)); }
  while (oq.length) {
    const c = oq.pop(), x = c % cols, y = (c - x) / cols;
    for (let k = 0; k < 4; k++) { const [dx, dy] = DIRS[k]; if (open(x, y, dx, dy) && !thruDoor(x, y, dx, dy) && !outside[idx(x + dx, y + dy)]) { outside[idx(x + dx, y + dy)] = 1; oq.push(idx(x + dx, y + dy)); } }
  }
  let indoorCount = 0;
  for (let i = 0; i < N; i++) if (!block[i] && !outside[i] && comp[i] === mainComp) indoorCount++;
  const indoors = (x, y) => onFloor(x, y) && (!indoorCount || !outside[idx(x, y)]);

  /* routes: distance fields from a target square, kept for reuse */
  const fields = new Map();
  function field(tx, ty){
    const key = idx(tx, ty);
    let dist = fields.get(key);
    if (dist) return dist;
    dist = new Float64Array(N).fill(Infinity); // same precision as the heap, or popped squares look stale and get skipped
    if (free(tx, ty)) {
      const heap = [[0, key]]; dist[key] = 0;
      while (heap.length) {
        const [dc, c] = heapPop(heap);
        if (dc > dist[c]) continue;
        const x = c % cols, y = (c - x) / cols;
        for (const [dx, dy] of DIRS) {
          if (!canMove(x, y, dx, dy)) continue;
          const n = idx(x + dx, y + dy), nd = dc + (dx && dy ? 1.4142 : 1);
          if (nd < dist[n]) { dist[n] = nd; heapPush(heap, [nd, n]); }
        }
      }
    }
    if (fields.size > 300) fields.delete(fields.keys().next().value);
    fields.set(key, dist);
    return dist;
  }
  function nearestFree(x, y){
    const cx = Math.floor(x), cy = Math.floor(y);
    if (onFloor(cx, cy)) return [cx, cy];
    for (let r = 1; r < Math.max(cols, rows); r++) {
      let best = null, bd = Infinity;
      for (let yy = cy - r; yy <= cy + r; yy++) for (let xx = cx - r; xx <= cx + r; xx++) {
        if (Math.max(Math.abs(xx - cx), Math.abs(yy - cy)) !== r || !onFloor(xx, yy)) continue;
        const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y);
        if (d < bd) { bd = d; best = [xx, yy]; }
      }
      if (best) return best;
    }
    return null;
  }
  // path length in squares between two squares (Infinity if you can't get there)
  const distance = (ax, ay, bx, by) => field(bx, by)[idx(ax, ay)];
  // a list of points to walk through from (ax,ay) to square (tx,ty), ending on its middle
  function route(ax, ay, tx, ty){
    const s = nearestFree(ax, ay);
    if (!s || !free(tx, ty)) return null;
    const dist = field(tx, ty);
    let [x, y] = s;
    if (!isFinite(dist[idx(x, y)])) return null;
    const pts = [{ x: x + 0.5, y: y + 0.5 }];
    let guard = N;
    while (dist[idx(x, y)] > 0 && guard--) {
      let bx = -1, by = -1, bd = dist[idx(x, y)];
      for (const [dx, dy] of DIRS) {
        if (!canMove(x, y, dx, dy)) continue;
        const nd = dist[idx(x + dx, y + dy)] + (dx && dy ? 1.4142 : 1) * 1e-3;
        if (nd < bd) { bd = nd; bx = x + dx; by = y + dy; }
      }
      if (bx < 0) break;
      x = bx; y = by; pts.push({ x: x + 0.5, y: y + 0.5 });
    }
    return smooth({ x: ax, y: ay }, pts);
  }
  // walking straight from a to b doesn't clip anything, with some elbow room either side
  function straight(a, b){
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-6) return true;
    const n = Math.ceil(len / 0.2), px = -(b.y - a.y) / len * 0.32, py = (b.x - a.x) / len * 0.32;
    for (const [ox, oy] of [[0, 0], [px, py], [-px, -py]]) {
      let cx = Math.floor(a.x + ox), cy = Math.floor(a.y + oy);
      for (let i = 1; i <= n; i++) {
        const t = i / n, nx = Math.floor(a.x + (b.x - a.x) * t + ox), ny = Math.floor(a.y + (b.y - a.y) * t + oy);
        if (nx === cx && ny === cy) continue;
        if (!canMove(cx, cy, nx - cx, ny - cy)) return false;
        cx = nx; cy = ny;
      }
    }
    return true;
  }
  function smooth(start, pts){
    const out = [];
    let a = start, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !straight(a, pts[j])) j--;
      out.push(pts[j]); a = pts[j]; i = j + 1;
    }
    return out;
  }

  const openness = (x, y, r) => { let n = 0; for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (free(xx, yy)) n++; return n; };
  const zoneCells = z => { const P = zonePts(z), out = []; for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (indoors(x, y) && inPts(P, x + 0.5, y + 0.5)) out.push([x, y]); return out; };
  const seatCells = new Set(desks.filter(d => d.reach).map(d => idx(d.seat.cx, d.seat.cy)));

  /* Coffee machines take 2×2 squares and block them, like a counter. Each area named something like "Kitchen" gets
     one. With no such area, one for about every 30 people (up to 6) goes in open spots that keep everyone's walk short. */
  const doorClear = new Set();
  // the squares a door sweeps through as it opens
  for (const f of fixtures) if (f.kind === 'door') {
    const g = doorGeom(f), x0 = g.horiz || g.side > 0 ? f.x1 : f.x1 - g.L, y0 = !g.horiz || g.side > 0 ? f.y1 : f.y1 - g.L;
    for (let y = y0; y < y0 + g.L; y++) for (let x = x0; x < x0 + g.L; x++) doorClear.add(x + ',' + y);
  }
  const BLOCK = [[0, 0], [1, 0], [0, 1], [1, 1]];
  // the squares round a 2×2 block, with the step from each one into the block
  const RING = [[-1, 0, 1, 0], [-1, 1, 1, 0], [2, 0, -1, 0], [2, 1, -1, 0], [0, -1, 0, 1], [1, -1, 0, 1], [0, 2, 0, -1], [1, 2, 0, -1]];
  const wallBetween = (x, y, dx, dy) => dx === 1 ? vWall.has((x + 1) + ',' + y) : dx === -1 ? vWall.has(x + ',' + y) : dy === 1 ? hWall.has(x + ',' + (y + 1)) : hWall.has(x + ',' + y);
  const fits2 = (x, y) => BLOCK.every(([dx, dy]) => indoors(x + dx, y + dy) && !seatCells.has(idx(x + dx, y + dy)) && !doorClear.has((x + dx) + ',' + (y + dy)))
    && !vWall.has((x + 1) + ',' + y) && !vWall.has((x + 1) + ',' + (y + 1)) && !hWall.has(x + ',' + (y + 1)) && !hWall.has((x + 1) + ',' + (y + 1));
  // how many of its sides are against a wall or furniture (a machine looks right against a wall)
  const snug = (x, y) => RING.filter(([rx, ry, dx, dy]) => !free(x + rx, y + ry) || wallBetween(x + rx, y + ry, dx, dy)).length;
  let floorCount = 0;
  for (let i = 0; i < N; i++) if (!block[i] && comp[i] === mainComp) floorCount++;
  // put it down unless that would cut part of the floor off
  function place(x, y){
    for (const [dx, dy] of BLOCK) block[idx(x + dx, y + dy)] = 1;
    // from a square you can reach the machine from, everything else on the floor must still be reachable
    const start = RING.filter(([rx, ry, dx, dy]) => onFloor(x + rx, y + ry) && !wallBetween(x + rx, y + ry, dx, dy)).map(([rx, ry]) => [x + rx, y + ry])[0];
    let reached = 0;
    if (start) {
      const seen = new Uint8Array(N), q = [idx(start[0], start[1])]; seen[q[0]] = 1;
      while (q.length) {
        const c = q.pop(), cx = c % cols, cy = (c - cx) / cols; reached++;
        for (let k = 0; k < 4; k++) { const [dx, dy] = DIRS[k]; if (open(cx, cy, dx, dy)) { const n = idx(cx + dx, cy + dy); if (!seen[n]) { seen[n] = 1; q.push(n); } } }
      }
    }
    if (start && reached === floorCount - 4) { floorCount -= 4; return true; }
    for (const [dx, dy] of BLOCK) block[idx(x + dx, y + dy)] = 0;
    return false;
  }
  function machine(x, y, area){
    const around = RING.filter(([rx, ry, dx, dy]) => onFloor(x + rx, y + ry) && !wallBetween(x + rx, y + ry, dx, dy)).map(([rx, ry]) => [x + rx, y + ry]);
    return { cell: [x, y], x: x + 1, y: y + 1, area, around, spot: around[0] };
  }
  function pickCoffees(){
    const reach = desks.filter(d => d.reach), out = [];
    for (const kz of zones.filter(z => COFFEE_AREA.test(z.name || ''))) {
      const P = zonePts(kz), zx = P.reduce((s, p) => s + p[0], 0) / P.length, zy = P.reduce((s, p) => s + p[1], 0) / P.length;
      // keep clear of the area's name, written from its top-left corner: along the top, or down the left side
      // when the view is turned a quarter
      const tl = P.reduce((a, p) => p[1] < a[1] || p[1] === a[1] && p[0] < a[0] ? p : a, P[0]), labelLen = 0.6 + String(kz.name).length * 0.36;
      const onLabel = (x, y) => y <= tl[1] && x < tl[0] + labelLen || x <= tl[0] && y < tl[1] + labelLen;
      const cand = zoneCells(kz).filter(([x, y]) => fits2(x, y)).map(([x, y]) => ({ x, y, s: -snug(x, y) * 1.5 + Math.hypot(x + 1 - zx, y + 1 - zy) * 0.4 + (onLabel(x, y) ? 20 : 0) })).sort((a, b) => a.s - b.s);
      const c = cand.slice(0, 40).find(k => place(k.x, k.y));
      if (c) out.push(machine(c.x, c.y, kz.name));
    }
    if (out.length || !reach.length) return out;
    const seatedN = reach.filter(d => d.person).length;
    const want = Math.max(1, Math.min(6, Math.round((seatedN >= 4 ? seatedN : Math.min(reach.length, people.size)) / 30)));
    const step = Math.ceil(reach.length / 40), seats = reach.filter((_, i) => i % step === 0).map(d => field(d.seat.cx, d.seat.cy));
    const cand = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (fits2(x, y)) cand.push({ x, y, i: idx(x, y), crowd: 0.7 * (25 - openness(x, y, 2)) });
    // how far each seat is from its nearest machine so far
    const near = seats.map(() => Infinity);
    while (out.length < want && cand.length) {
      const score = k => { let m = 0; for (let s = 0; s < seats.length; s++) m = Math.max(m, Math.min(near[s], seats[s][k.i])); return m + k.crowd; };
      const c = cand.filter(k => fits2(k.x, k.y)).sort((a, b) => score(a) - score(b)).slice(0, 40).find(k => place(k.x, k.y));
      if (!c) break;
      out.push(machine(c.x, c.y, null));
      seats.forEach((f, s) => { near[s] = Math.min(near[s], f[c.i]); });
    }
    return out;
  }
  // the way in: the outer side of a door that's nearest the edge of the sheet, else the edge of the floor nearest the desks
  function pickEntrance(){
    const edgeDist = (x, y) => Math.min(x, y, cols - 1 - x, rows - 1 - y);
    let bestSide = null, bd = Infinity;
    for (const f of fixtures) {
      if (f.kind !== 'door') continue;
      const horiz = f.y1 === f.y2, L = (f.x2 - f.x1) + (f.y2 - f.y1), m = Math.floor(L / 2) - (L % 2 ? 0 : 1);
      const sides = horiz ? [[f.x1 + m, f.y1 - 1], [f.x1 + m, f.y1]] : [[f.x1 - 1, f.y1 + m], [f.x1, f.y1 + m]];
      for (const [x, y] of sides) if (onFloor(x, y) && edgeDist(x, y) < bd) { bd = edgeDist(x, y); bestSide = [x, y]; }
    }
    if (bestSide) return bestSide;
    const reach = desks.filter(d => d.reach);
    const mx = reach.reduce((s, d) => s + d.cx, 0) / (reach.length || 1), my = reach.reduce((s, d) => s + d.cy, 0) / (reach.length || 1);
    const c = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (edgeDist(x, y) === 0 && onFloor(x, y)) c.push([x, y]);
    return c.length ? best(c, ([x, y]) => Math.hypot(x - mx, (y - my) * 0.8) - (y === rows - 1 ? 4 : 0)) : null;
  }
  const coffees = pickCoffees(), coffee = coffees[0] || null;
  fields.clear(); // routes worked out before the machines went down could walk through them
  const entrance = pickEntrance() || coffee?.spot || nearestFree(cols / 2, rows - 1);
  // the ways out: the outside square of every door in an outer wall, or just the entrance when there's none
  const exits = [];
  for (const f of fixtures) {
    if (f.kind !== 'door') continue;
    const horiz = f.y1 === f.y2, L = (f.x2 - f.x1) + (f.y2 - f.y1), m = Math.floor(L / 2) - (L % 2 ? 0 : 1);
    const [a, b] = horiz ? [[f.x1 + m, f.y1 - 1], [f.x1 + m, f.y1]] : [[f.x1 - 1, f.y1 + m], [f.x1, f.y1 + m]];
    const out = (p, q) => indoors(p[0], p[1]) && onFloor(q[0], q[1]) && !indoors(q[0], q[1]);
    if (out(a, b)) exits.push(b); else if (out(b, a)) exits.push(a);
  }
  if (!exits.length && entrance) exits.push(entrance);
  const meetingZones = zones.filter(z => MEETING_AREA.test(z.name || ''));
  // squares to stand at and look out of a window: only windows in an outer wall, not glass between two rooms.
  // With no walls round the office there's no telling inside from out, so every window counts.
  const windows = [];
  const outdoor = (x, y) => !inside(x, y) || free(x, y) && outside[idx(x, y)] === 1;
  for (const f of fixtures) if (f.kind === 'window') for (const [o, x, y] of segEdges(f)) {
    const [a, b] = o === 'h' ? [[x, y], [x, y - 1]] : [[x, y], [x - 1, y]];
    if (!indoorCount) { for (const [cx, cy] of [a, b]) if (onFloor(cx, cy)) windows.push([cx, cy]); continue; }
    if (indoors(a[0], a[1]) && outdoor(b[0], b[1])) windows.push(a);
    else if (indoors(b[0], b[1]) && outdoor(a[0], a[1])) windows.push(b);
  }

  // team colours, in the same order as the app's default "Colour by: Team"
  const colorField = ['team', 'supervisor', 'companyTeamLead', 'customerTeamLead'].find(k => [...people.values()].some(p => String(p[k] ?? '').trim())) || null;
  const groupNames = colorField ? [...new Set([...people.values()].map(p => String(p[colorField] ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)) : [];
  const groupIdx = new Map(groupNames.map((g, i) => [g.toLowerCase(), i % 8]));
  const groupOf = p => colorField && p ? String(p[colorField] ?? '').trim() : '';
  const colorIndex = p => groupIdx.get(groupOf(p).toLowerCase()) ?? -1;

  // who's in today: everyone with a desk, once, at the first desk they have. With hardly anyone assigned, the rest borrow free desks
  const counted = new Set();
  const seated = desks.filter(d => d.reach && d.person && !counted.has(d.person) && counted.add(d.person)).map(d => ({ person: d.person, desk: d, guest: false }));
  let hotDesking = false;
  if (seated.length < 4) {
    const placed = new Set(seated.map(s => String(s.person.id)));
    const spare = desks.filter(d => d.reach && !d.person), rest = [...people.values()].filter(p => !placed.has(String(p.id)));
    while (spare.length && rest.length) { seated.push({ person: rest.shift(), desk: spare.shift(), guest: true }); hotDesking = true; }
  }

  function randomNear(x, y, r, rnd = Math.random){
    const c = [];
    for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) if (indoors(xx, yy) && !seatCells.has(idx(xx, yy))) c.push([xx, yy]);
    return c.length ? c[Math.floor(rnd() * c.length)] : nearestFree(x, y);
  }
  // squares next to a person's seat where a visitor can stand
  function besideSeat(desk){
    const { cx, cy } = desk.seat, c = [];
    for (const [dx, dy] of DIRS) if (canMove(cx, cy, dx, dy) && !seatCells.has(idx(cx + dx, cy + dy))) c.push([cx + dx, cy + dy]);
    return c;
  }

  return {
    cols, rows, desks, zones, fixtures, people, wallRects, coffee, coffees, entrance, exits, windows, meetingZones,
    seated, hotDesking, colorField, groupNames, groupOf, colorIndex,
    free, onFloor, indoors, canMove, wallBetween, route, smooth, distance, nearestFree, randomNear, besideSeat, zoneCells,
    isBlocked: (x, y) => !inside(x, y) || block[idx(x, y)] === 1,
    deskAtCell: (x, y) => inside(x, y) && deskAt[idx(x, y)] >= 0 ? desks[deskAt[idx(x, y)]] : null
  };
}
const FIXKINDS = new Set(['wall', 'door', 'window', 'pillar']);
function best(list, score){ let b = list[0], bs = Infinity; for (const it of list) { const s = score(it); if (s < bs) { bs = s; b = it; } } return b; }
function heapPush(h, it){ h.push(it); let i = h.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } }
function heapPop(h){
  const top = h[0], last = h.pop();
  if (h.length) {
    h[0] = last; let i = 0;
    for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < h.length && h[l][0] < h[m][0]) m = l; if (r < h.length && h[r][0] < h[m][0]) m = r; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; }
  }
  return top;
}

/* ---------- drawing ---------- */
function palette(){
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
  return { paper: v('--paper'), sheet: v('--sheet'), surface: v('--surface'), ink: v('--ink'), muted: v('--muted'), line: v('--line'),
    lineStrong: v('--line-strong'), grid: v('--grid'), gridMajor: v('--grid-major'), accent: v('--accent'), warn: v('--warn'),
    danger: v('--danger'), ok: v('--ok'), team: [0, 1, 2, 3, 4, 5, 6, 7].map(i => v('--t' + i)), dark: matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light' || document.documentElement.dataset.theme === 'dark' };
}
const teamColor = (pal, i) => i >= 0 ? pal.team[i] : pal.lineStrong;

// the floor plan, in squares: the caller has already scaled the context so 1 unit = 1 square.
// opts.turn (0-3 quarter turns clockwise) keeps the writing upright when the caller shows the map turned.
function drawMap(ctx, world, pal, opts = {}){
  const { cols, rows } = world, turn = opts.turn || 0;
  // text tucked into the top-left corner (x,y) of something, as seen on screen
  const corner = (text, x, y, dx, dy) => {
    const right = turn === 1 || turn === 2, bottom = turn >= 2;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-turn * Math.PI / 2);
    ctx.textAlign = right ? 'right' : 'left'; ctx.textBaseline = bottom ? 'bottom' : 'top';
    ctx.fillText(text, right ? -dx : dx, bottom ? -dy : dy);
    ctx.restore();
  };
  ctx.fillStyle = pal.sheet; ctx.fillRect(0, 0, cols, rows);
  ctx.lineWidth = 0.03;
  for (let x = 0; x <= cols; x++) { ctx.strokeStyle = x % 5 ? pal.grid : pal.gridMajor; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, rows); ctx.stroke(); }
  for (let y = 0; y <= rows; y++) { ctx.strokeStyle = y % 5 ? pal.grid : pal.gridMajor; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cols, y); ctx.stroke(); }

  for (const z of world.zones) {
    const P = zonePts(z);
    ctx.beginPath(); P.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    ctx.globalAlpha = 0.07; ctx.fillStyle = pal.accent; ctx.fill();
    ctx.globalAlpha = 0.45; ctx.strokeStyle = pal.accent; ctx.lineWidth = 0.05; ctx.setLineDash([0.3, 0.2]); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    if (z.name) {
      const tl = P.reduce((a, p) => p[1] < a[1] || p[1] === a[1] && p[0] < a[0] ? p : a, P[0]);
      ctx.fillStyle = pal.accent; ctx.font = '600 0.62px "Barlow Condensed", "Arial Narrow", sans-serif';
      corner(String(z.name).toUpperCase(), tl[0], tl[1], 0.3, 0.28);
    }
  }

  for (const d of world.desks) {
    const own = new Set(d.cells.map(([x, y]) => x + ',' + y));
    ctx.fillStyle = pal.surface;
    for (const [x, y] of d.cells) ctx.fillRect(x - 0.01, y - 0.01, 1.02, 1.02);
    const ci = opts.deskColor ? opts.deskColor(d) : -2;
    if (ci > -2) { ctx.globalAlpha = 0.2; ctx.fillStyle = teamColor(pal, ci); for (const [x, y] of d.cells) ctx.fillRect(x - 0.01, y - 0.01, 1.02, 1.02); ctx.globalAlpha = 1; }
    ctx.strokeStyle = pal.lineStrong; ctx.lineWidth = 0.07; ctx.lineCap = 'square'; ctx.beginPath();
    for (const [x, y] of d.cells) {
      if (!own.has(x + ',' + (y - 1))) { ctx.moveTo(x, y); ctx.lineTo(x + 1, y); }
      if (!own.has(x + ',' + (y + 1))) { ctx.moveTo(x, y + 1); ctx.lineTo(x + 1, y + 1); }
      if (!own.has((x - 1) + ',' + y)) { ctx.moveTo(x, y); ctx.lineTo(x, y + 1); }
      if (!own.has((x + 1) + ',' + y)) { ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y + 1); }
    }
    ctx.stroke();
    if (opts.numbers !== false && d.number !== '') {
      ctx.fillStyle = pal.muted; ctx.font = '600 0.5px "JetBrains Mono", ui-monospace, monospace';
      corner(String(d.number), d.cells[0][0], d.cells[0][1], 0.2, 0.18);
    }
  }

  for (const f of world.fixtures) {
    if (f.kind === 'pillar') { ctx.fillStyle = pal.ink; ctx.globalAlpha = 0.72; ctx.fillRect(f.x, f.y, f.w, f.h); ctx.globalAlpha = 1; continue; }
    const line = (a, b, color, w) => { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'square'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
    const a = [f.x1, f.y1], b = [f.x2, f.y2];
    if (f.kind === 'wall') line(a, b, pal.ink, WALL);
    else if (f.kind === 'window') { line(a, b, pal.ink, WALL); line(a, b, pal.sheet, WALL * 0.45); line(a, b, pal.ink, 0.03); }
    else if (f.kind === 'door') {
      const g = doorGeom(f);
      ctx.lineCap = 'butt';
      ctx.strokeStyle = pal.ink; ctx.lineWidth = 0.07; ctx.beginPath(); ctx.moveTo(g.hinge[0], g.hinge[1]); ctx.lineTo(g.leaf[0], g.leaf[1]); ctx.stroke();
      const a0 = Math.atan2(g.leaf[1] - g.hinge[1], g.leaf[0] - g.hinge[0]), a1 = Math.atan2(g.other[1] - g.hinge[1], g.other[0] - g.hinge[0]);
      let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      ctx.lineWidth = 0.035; ctx.setLineDash([0.15, 0.12]); ctx.beginPath(); ctx.arc(g.hinge[0], g.hinge[1], g.L, a0, a0 + da, da < 0); ctx.stroke(); ctx.setLineDash([]);
    }
  }
}

/* ---------- a small demo office, for when there's no map yet ---------- */
function demoMap(){
  const t = new Date(), iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const ago = (years, days = 0) => iso(new Date(t.getFullYear() - years, t.getMonth(), t.getDate() - days));
  const P = [
    ['Ana Ruiz', 'Design', ago(3, -2)], ['Ben Carter', 'Design', ago(1, 120)], ['Chloé Martin', 'Design', ago(4, 200)],
    ['Dev Patel', 'Engineering', ago(2, 40)], ['Elif Kaya', 'Engineering', ago(5, 300)], ['Felipe Duarte', 'Engineering', ago(0, 9)],
    ['Grace Liu', 'Engineering', ago(1, 250)], ['Hugo Moreau', 'Support', ago(6, 80)], ['Inês Silva', 'Support', ago(2, 1)],
    ['Jonah Weiss', 'Support', ago(1, 160)], ['Keiko Sato', 'Sales', ago(3, 330)], ['Leo Rossi', 'Sales', ago(0, 140)], ['Maya Okafor', 'Sales', ago(7, 20)]
  ].map(([name, team, startDate], i) => ({ id: 'demo' + i, name, team, startDate }));
  const pods = [[4, 5], [15, 5], [4, 15], [15, 15]], desks = [];
  for (const [px, py] of pods) for (const [dx, dy] of [[0, 0], [4, 0], [0, 2], [4, 2]]) desks.push({ id: 'dd' + desks.length, number: String(desks.length + 1), shape: 'h', rot: 0, x: px + dx, y: py + dy, personId: null });
  [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14].forEach((d, i) => { desks[d].personId = P[i].id; });
  desks.push({ id: 'dt1', number: '', shape: 'h', rot: 0, x: 30, y: 19, personId: null }); // the meeting room table
  const seg = (kind, x1, y1, x2, y2, swing) => ({ id: 'df' + seg.n++, kind, x1, y1, x2, y2, ...(kind === 'door' ? { swing } : {}) });
  seg.n = 0;
  const fixtures = [
    seg('wall', 2, 2, 8, 2), seg('window', 8, 2, 14, 2), seg('wall', 14, 2, 17, 2), seg('window', 17, 2, 23, 2), seg('wall', 23, 2, 36, 2),
    seg('wall', 2, 2, 2, 24), seg('wall', 36, 2, 36, 24),
    seg('wall', 2, 24, 16, 24), seg('door', 16, 24, 18, 24, 0), seg('wall', 18, 24, 36, 24),
    seg('wall', 28, 2, 28, 6), seg('door', 28, 6, 28, 8, 0), seg('wall', 28, 8, 28, 10), seg('wall', 28, 10, 36, 10),
    seg('wall', 28, 10, 28, 12), seg('door', 28, 12, 28, 14, 0), seg('window', 28, 14, 28, 16),
    seg('wall', 28, 16, 36, 16), seg('wall', 28, 16, 28, 19), seg('door', 28, 19, 28, 21, 0), seg('wall', 28, 21, 28, 24),
    { id: 'dp1', kind: 'pillar', x: 13, y: 12, w: 1, h: 1 }, { id: 'dp2', kind: 'pillar', x: 24, y: 12, w: 1, h: 1 }
  ];
  const zones = [{ id: 'dz1', name: 'Kitchen', x: 28, y: 2, w: 8, h: 8 }, { id: 'dz2', name: 'Huddle room', x: 28, y: 10, w: 8, h: 6 }, { id: 'dz3', name: 'Meeting room', x: 28, y: 16, w: 8, h: 8 }];
  return { app: 'office-desk-map', version: 1, demo: true, desks, people: P, zones, fixtures };
}

window.FunMap = { load, readFile, sourceLabel, build, drawMap, palette, teamColor, initials, shortName, anniversaries, celebrating, demoMap, heapPush, heapPop };
})();
