/* KHE – Porovnávač verzí básní (statická verze pro GitHub Pages)
 *
 * Veškerá data jsou v data/ a předpočítaná. Z browseru se nevolá žádné API –
 * AI štítky leží v data/labels.json a klíčem k dvojici veršů je
 * "levý verš" + SEP + "pravý verš" (viz export_site.py).
 *
 * Diff počítá tady v prohlížeči: difflib z Pythonu je nahrazen LCS,
 * ostatní logika (slučování alignace přes BFS, skládání slokových map)
 * je port 1:1 z app.py.
 */
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const SEP = '␟';                       // oddělovač klíče štítku, musí sedět s exporterem
const DATA = 'data';

let poemData = null;
let poemIndex = null;
let labels = null;

/* ── pomocné ─────────────────────────────────────────────────────────── */

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Faithful port of difflib.SequenceMatcher.get_opcodes() (autojunk included),
 * so the diff here is byte-for-byte the same as the one in app.py.
 * Plain LCS gives different (equally valid) grouping – this keeps the
 * static demo identical to the locally running app. */
function align(a, b) {
  const n = a.length, m = b.length;

  // b2j: hodnota -> pozice v b; při >=200 prvků vyřadí "junk" (časté >1 %)
  const b2jAll = new Map();
  for (let i = 0; i < m; i++) {
    if (!b2jAll.has(b[i])) b2jAll.set(b[i], []);
    b2jAll.get(b[i]).push(i);
  }
  const junk = new Set();
  if (m >= 200) {
    const ntest = (m / 100 | 0) + 1;
    for (const [elt, idxs] of b2jAll) if (idxs.length > ntest) junk.add(elt);
  }
  const b2j = new Map();
  for (const [elt, idxs] of b2jAll) if (!junk.has(elt)) b2j.set(elt, idxs);
  const isJunk = elt => junk.has(elt);

  function longestMatch(alo, ahi, blo, bhi) {
    let besti = alo, bestj = blo, bestsize = 0;
    let j2len = new Map();
    for (let i = alo; i < ahi; i++) {
      const newj2len = new Map();
      const idxs = b2j.get(a[i]);
      if (idxs) {
        for (const j of idxs) {
          if (j < blo) continue;
          if (j >= bhi) break;
          const k = (j2len.has(j - 1) ? j2len.get(j - 1) : 0) + 1;
          newj2len.set(j, k);
          if (k > bestsize) { besti = i - k + 1; bestj = j - k + 1; bestsize = k; }
        }
      }
      j2len = newj2len;
    }
    // prodloužení o okolní shodné prvky
    while (besti > alo && bestj > blo && !isJunk(b[bestj - 1]) && a[besti - 1] === b[bestj - 1])
      { besti--; bestj--; bestsize++; }
    while (besti + bestsize < ahi && bestj + bestsize < bhi && !isJunk(b[bestj + bestsize]) && a[besti + bestsize] === b[bestj + bestsize])
      bestsize++;
    while (besti > alo && bestj > blo && isJunk(b[bestj - 1]) && a[besti - 1] === b[bestj - 1])
      { besti--; bestj--; bestsize++; }
    while (besti + bestsize < ahi && bestj + bestsize < bhi && isJunk(b[bestj + bestsize]) && a[besti + bestsize] === b[bestj + bestsize])
      bestsize++;
    return [besti, bestj, bestsize];
  }

  // matching blocks: rekurzivně (BFS) po nejdelších shodných úsecích
  const blocks = [];
  const queue = [[0, n, 0, m]];
  while (queue.length) {
    const [alo, ahi, blo, bhi] = queue.shift();
    const [ai, bj, size] = longestMatch(alo, ahi, blo, bhi);
    if (size) {
      blocks.push([ai, bj, size]);
      if (alo < ai && blo < bj) queue.push([alo, ai, blo, bj]);
      if (ai + size < ahi && bj + size < bhi) queue.push([ai + size, ahi, bj + size, bhi]);
    }
  }
  blocks.push([n, m, 0]);
  blocks.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);   // difflib třídí na konci

  // opcodes
  const ops = [];
  let i = 0, j = 0;
  for (const [ai, bj, size] of blocks) {
    let op = null;
    if (i < ai && j < bj) op = 'replace';
    else if (i < ai) op = 'delete';
    else if (j < bj) op = 'insert';
    if (op) ops.push({ op, a1: i, a2: ai, b1: j, b2: bj });
    i = ai + size; j = bj + size;
    if (size) ops.push({ op: 'equal', a1: ai, a2: i, b1: bj, b2: j });
  }
  return ops;
}

/* ── data ────────────────────────────────────────────────────────────── */

const verseLines = vid => {
  const out = [];
  (poemData.texts[vid] || []).forEach((lines, si) =>
    lines.forEach((text, li) => out.push([si, li, text])));
  return out;
};

const findMapping = (v1, v2) => poemData.maps[v1 + '>' + v2] ? { m: poemData.maps[v1 + '>' + v2], fwd: true }
  : poemData.maps[v2 + '>' + v1] ? { m: poemData.maps[v2 + '>' + v1], fwd: false }
  : null;

/* BFS cesta v grafu verzí – jako Store.find_path() */
function findPath(v1, v2) {
  const adj = {};
  for (const [s, t] of poemData.edges) {
    (adj[s] = adj[s] || []).push(t);
    (adj[t] = adj[t] || []).push(s);
  }
  const q = [[v1, [v1]]], seen = new Set([v1]);
  while (q.length) {
    const [cur, path] = q.shift();
    if (cur === v2) return path;
    for (const nb of adj[cur] || []) {
      if (!seen.has(nb)) { seen.add(nb); q.push([nb, path.concat(nb)]); }
    }
  }
  return null;
}

function parseStanzaMap(m, forward) {
  const smap = {}, inserted = new Set();
  for (const [fr, to] of m) {
    if (forward) {
      if (!to.length) fr.forEach(s => { smap[s] = null; });
      else if (!fr.length) to.forEach(s => inserted.add(s));
      else smap[fr[0]] = to[0];
    } else {
      if (!fr.length) to.forEach(s => { smap[s] = null; });
      else if (!to.length) fr.forEach(s => inserted.add(s));
      else smap[to[0]] = fr[0];
    }
  }
  return [smap, inserted];
}

/* Složení dvou slokových map – jako Store.compose_stanza_maps() */
function composeStanzaMaps(map1, ins1, map2, ins2) {
  const result = {};
  for (const a in map1) {
    const b = map1[a];
    result[a] = b === null ? null : (b in map2 ? map2[b] : null);
  }
  const ins = new Set(ins2);
  for (const b of ins1) if (b in map2 && map2[b] !== null) ins.add(map2[b]);
  return [result, ins];
}

/* Vrátí [smap, inserted, n_steps] – jako Store.build_stanza_map() */
function buildStanzaMap(v1, v2) {
  const direct = findMapping(v1, v2);
  if (direct) {
    const [smap, ins] = parseStanzaMap(direct.m, direct.fwd);
    return [smap, ins, 1];
  }
  const path = findPath(v1, v2);
  if (!path || path.length < 2) return [null, null, 0];
  let cur = null;
  for (let k = 0; k < path.length - 1; k++) {
    const hit = findMapping(path[k], path[k + 1]);
    if (!hit) return [null, null, 0];
    const step = parseStanzaMap(hit.m, hit.fwd);
    cur = cur === null ? step : composeStanzaMaps(cur[0], cur[1], step[0], step[1]);
  }
  return [cur[0], cur[1], path.length - 1];
}

/* ── štítky ──────────────────────────────────────────────────────────── */

const CATEGORY_LABELS = {
  interpunkce: 'Interpunkce', velikost_pismen: 'Velikost písmen', diakritika: 'Diakritika',
  pravopis: 'Pravopis', typografie: 'Typografie', synonymum: 'Synonymum', dialekt: 'Dialekt',
  registr: 'Registr', archaismus: 'Archaismus', lexikalni_jine: 'Lexikální – jiné',
  slovo_smazano: 'Slovo smazáno', slovo_pridano: 'Slovo přidáno', morfologie: 'Morfologie',
  slovosled: 'Slovosled', veta: 'Větná stavba', metrika: 'Metrika', intenzita: 'Intenzita',
  ton: 'Tón', obraznost: 'Obraznost', perspektiva: 'Perspektiva', vers_smazany: 'Verš smazán',
  vers_pridany: 'Verš přidán', vers_prepisan: 'Verš přepsán', strukturalni_jine: 'Strukturální – jiné',
  vice_zmen: 'Více změn', jine: 'Jiné'
};

const CAT_COLORS = {
  interpunkce: '#eceff1', velikost_pismen: '#eceff1', diakritika: '#eceff1',
  pravopis: '#eceff1', typografie: '#eceff1', synonymum: '#e3f2fd', dialekt: '#e3f2fd',
  registr: '#e3f2fd', archaismus: '#e3f2fd', lexikalni_jine: '#e3f2fd', slovo_smazano: '#fff9c4',
  slovo_pridano: '#c8e6c9', morfologie: '#e8f5e9', slovosled: '#fff3e0', veta: '#fff3e0',
  metrika: '#f3e5f5', intenzita: '#fce4ec', ton: '#fce4ec', obraznost: '#fce4ec',
  perspektiva: '#fce4ec', vers_smazany: '#ffebee', vers_pridany: '#c8e6c9', vers_prepisan: '#ffebee',
  strukturalni_jine: '#ffebee', vice_zmen: '#fffde7', jine: '#fffde7'
};

let evalMode = 'llm';
let rated = 0, changed = 0;

async function loadLabels() {
  if (labels) return;
  try {
    const r = await fetch(`${DATA}/labels.json`);
    labels = await r.json();
  } catch (e) {
    labels = { llm: {}, jev: {} };
  }
}

function classify(t1, t2) {
  if (!labels) return null;
  const set = labels[evalMode];
  return (set && set[t1 + SEP + t2]) || null;
}

/* ── řádky diffu ─────────────────────────────────────────────────────── */

function wordParts(t1, t2) {
  const w1 = t1.split(/\s+/).filter(Boolean), w2 = t2.split(/\s+/).filter(Boolean);
  const lh = [], rh = [];
  for (const o of align(w1, w2)) {
    if (o.op === 'equal') for (const w of w1.slice(o.a1, o.a2)) { lh.push(esc(w)); rh.push(esc(w)); }
    else if (o.op === 'replace') {
      for (const w of w1.slice(o.a1, o.a2)) lh.push(`<del>${esc(w)}</del>`);
      for (const w of w2.slice(o.b1, o.b2)) rh.push(`<ins>${esc(w)}</ins>`);
    } else if (o.op === 'delete') for (const w of w1.slice(o.a1, o.a2)) lh.push(`<del>${esc(w)}</del>`);
    else for (const w of w2.slice(o.b1, o.b2)) rh.push(`<ins>${esc(w)}</ins>`);
  }
  return [lh.join(' '), rh.join(' ')];
}

function row(op, l, r, lh, rh) {
  const lnL = l ? `${l[0] + 1}.${l[1] + 1}` : '';
  const lnR = r ? `${r[0] + 1}.${r[1] + 1}` : '';
  let html = `<div class="drow ${op}">`
    + `<div class="dc-l"><span class="dnum">${lnL}</span>${lh}</div>`
    + `<div class="dc-r"><span class="dnum">${lnR}</span>${rh}</div></div>`;

  if (op !== 'eq') {
    const cats = classify(l ? l[2] : '', r ? r[2] : '');
    if (cats && cats.length) {
      const badges = cats.map(c => {
        let cat, tip;
        if (Array.isArray(c)) {                       // Jev: [kategorie, pravděpodobnost]
          cat = c[0]; tip = `Jev – pravděpodobnost ${(c[1] * 100).toFixed(0)} %`;
        } else {                                     // LLM: {category, explanation}
          cat = c.category || 'jine'; tip = c.explanation || '';
        }
        const label = Array.isArray(c) ? `${CATEGORY_LABELS[cat] || cat} ${(c[1] * 100).toFixed(0)}%`
                                       : (CATEGORY_LABELS[cat] || cat);
        const attr = tip ? ` data-tip="${esc(tip)}"` : '';
        return `<span class="cat-badge"${attr} style="background:${CAT_COLORS[cat] || '#eee'}">${esc(label)}</span>`;
      });
      rated++;
      html += `<div class="cat-row">${badges.join('')}</div>`;
    }
  }
  return html;
}

function diffBlock(lines1, lines2, out, stats) {
  const t1 = lines1.map(x => x[2]), t2 = lines2.map(x => x[2]);
  for (const o of align(t1, t2)) {
    const cnt = Math.max(o.a2 - o.a1, o.b2 - o.b1);
    if (o.op === 'equal') {
      stats.eq += cnt;
      for (let i = 0; i < cnt; i++) out.push(row('eq', lines1[o.a1 + i], lines2[o.b1 + i], esc(lines1[o.a1 + i][2]), esc(lines2[o.b1 + i][2])));
    } else if (o.op === 'replace') {
      stats.mod += cnt; changed += cnt;
      for (let i = 0; i < cnt; i++) {
        const l = i < o.a2 - o.a1 ? lines1[o.a1 + i] : null;
        const r = i < o.b2 - o.b1 ? lines2[o.b1 + i] : null;
        const lt = l ? l[2] : '', rt = r ? r[2] : '';
        const [lh, rh] = wordParts(lt, rt);
        out.push(row('mod', l, r, lh, rh));
      }
    } else if (o.op === 'delete') {
      stats.del += cnt; changed += cnt;
      for (let i = 0; i < cnt; i++) {
        const l = lines1[o.a1 + i];
        out.push(row('del', l, null, `<del>${esc(l[2])}</del>`, ''));
      }
    } else {
      stats.ins += cnt; changed += cnt;
      for (let i = 0; i < cnt; i++) {
        const r = lines2[o.b1 + i];
        out.push(row('ins', null, r, '', `<ins>${esc(r[2])}</ins>`));
      }
    }
  }
}

const ST_HEADERS = {
  eq: ['st-eq', s => `<span class="st-l">Sloka ${s + 1}</span><span class="st-arrow">=</span><span class="st-r">Sloka ${s + 1}</span>`],
  shift: ['st-shift', (f, t) => `<span class="st-l">Sloka ${f + 1}</span><span class="st-arrow">→</span><span class="st-r">Sloka ${t + 1}</span><span class="st-note">posun číslování</span>`],
  del: ['st-del', f => `<span class="st-l">Sloka ${f + 1}</span><span class="st-arrow">✕</span><span class="st-r">smazáno</span><span class="st-note">sloka odstraněna</span>`],
  ins: ['st-ins', (f, t) => `<span class="st-l">nová</span><span class="st-arrow">+</span><span class="st-r">Sloka ${t + 1}</span><span class="st-note">sloka přidána</span>`]
};

function computeDiff(vid1, vid2) {
  const lines1 = verseLines(vid1), lines2 = verseLines(vid2);
  const [smap, inserted, nSteps] = buildStanzaMap(vid1, vid2);
  const stats = { eq: 0, mod: 0, del: 0, ins: 0 }, out = [];
  rated = 0; changed = 0;

  if (smap) {
    const st1 = new Map(), st2 = new Map();
    for (const l of lines1) { if (!st1.has(l[0])) st1.set(l[0], []); st1.get(l[0]).push(l); }
    for (const l of lines2) { if (!st2.has(l[0])) st2.set(l[0], []); st2.get(l[0]).push(l); }

    const pairs = [], usedR = new Set();
    for (const fl of Object.keys(smap).map(Number).sort((x, y) => x - y)) {
      const tl = smap[fl];
      if (tl === null) pairs.push(['del', fl, null, st1.get(fl) || [], []]);
      else {
        pairs.push([fl === tl ? 'eq' : 'shift', fl, tl, st1.get(fl) || [], st2.get(tl) || []]);
        usedR.add(tl);
      }
    }
    for (const tl of [...inserted].sort((x, y) => x - y)) {
      pairs.push(['ins', null, tl, [], st2.get(tl) || []]);
      usedR.add(tl);
    }
    for (const tl of [...st2.keys()].filter(k => !usedR.has(k)).sort((x, y) => x - y))
      pairs.push(['ins', null, tl, [], st2.get(tl) || []]);
    pairs.sort((x, y) => (x[1] !== null ? x[1] : 999) - (y[1] !== null ? y[1] : 999)
      || (x[2] !== null ? x[2] : 999) - (y[2] !== null ? y[2] : 999));

    if (nSteps > 1) out.push(`<div class="derived-note">Složeno z ${nSteps} kroků mapování (tranzitivní alignace)</div>`);

    for (const [kind, fl, tl, lns1, lns2] of pairs) {
      const [cls, head] = ST_HEADERS[kind];
      out.push(`<div class="st-block ${cls}"><div class="st-h ${cls}">${head(fl, tl)}</div>`);
      diffBlock(lns1, lns2, out, stats);
      out.push('</div>');
    }
  } else {
    diffBlock(lines1, lines2, out, stats);
  }
  return { html: out.join(''), stats };
}

/* ── graf verzí ──────────────────────────────────────────────────────── */

function renderGraph(d) {
  const nodes = d.versions.map(v => Object.assign({}, v));
  const edges = d.edges;
  if (!nodes.length) { $('#graph-container').innerHTML = '<p class="hint">Tato báseň nemá evidované verze.</p>'; return; }

  const hasParent = new Set(edges.map(e => e[1]));
  const rootId = (nodes.find(n => !hasParent.has(n.id)) || nodes[0]).id;
  const adj = {};
  nodes.forEach(n => { adj[n.id] = []; });
  edges.forEach(e => { if (adj[e[0]]) adj[e[0]].push({ id: e[1], w: e[2] }); });

  const tree = {}, visited = new Set([rootId]);
  tree[rootId] = { parent: null, children: [], depth: 0, ew: {} };
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift();
    for (const nb of adj[id]) {
      if (!visited.has(nb.id)) {
        visited.add(nb.id);
        tree[nb.id] = { parent: id, children: [], depth: tree[id].depth + 1, ew: {} };
        tree[id].children.push(nb.id);
        tree[id].ew[nb.id] = nb.w;
        queue.push(nb.id);
      }
    }
  }

  let leafIdx = 0;
  (function assignX(id) {
    const t = tree[id];
    if (!t.children.length) t.x = leafIdx++;
    else { t.children.forEach(assignX); t.x = (tree[t.children[0]].x + tree[t.children[t.children.length - 1]].x) / 2; }
  })(rootId);

  const maxDepth = Math.max.apply(null, Object.values(tree).map(t => t.depth));
  const W = Math.max(700, leafIdx * 70), H = (maxDepth + 1) * 110 + 60;
  const xScale = leafIdx > 1 ? (W - 80) / (leafIdx - 1) : 0;
  for (const id in tree) {
    const n = nodes.find(nd => nd.id === parseInt(id));
    if (n) { n.x = 40 + tree[id].x * xScale; n.y = 50 + tree[id].depth * 110; }
  }

  const maxW = Math.max.apply(null, edges.map(e => e[2]).concat([1]));
  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  for (const id in tree) {
    const t = tree[id];
    if (t.parent === null) continue;
    const ch = nodes.find(n => n.id === parseInt(id)), pa = nodes.find(n => n.id === t.parent);
    if (!ch || !pa) continue;
    const wt = tree[t.parent].ew[parseInt(id)] || 0;
    const sw = 1 + 9 * (wt / maxW), ratio = wt / maxW;
    const r = Math.round(80 + 175 * ratio), g = Math.round(180 - 130 * ratio);
    const mx = (pa.x + ch.x) / 2, my = (pa.y + ch.y) / 2;
    svg += `<path d="M${pa.x},${pa.y} C${pa.x},${my} ${ch.x},${my} ${ch.x},${ch.y}" fill="none"`
      + ` stroke="rgb(${r},${g},60)" stroke-width="${sw}" stroke-linecap="round" opacity=".75"`
      + ` style="cursor:pointer" onclick="pickEdge(${t.parent},${parseInt(id)})">`
      + `<title>${wt} změn</title></path>`;
    if (nodes.length <= 30) svg += `<text x="${mx}" y="${my - 2}" text-anchor="middle" font-size="9" fill="#888">${wt}</text>`;
  }
  for (const n of nodes) {
    if (n.x === undefined) continue;
    svg += `<circle cx="${n.x}" cy="${n.y}" r="18" fill="#2980b9" stroke="#fff" stroke-width="2">`
      + `<title>${esc(n.sigla)} – ${esc(n.source)} ${esc(n.year)}</title></circle>`
      + `<text x="${n.x}" y="${n.y + 4}" text-anchor="middle" font-size="10" fill="#fff" font-weight="700"`
      + ` pointer-events="none">${esc(n.sigla)}</text>`;
  }
  $('#graph-container').innerHTML = svg + '</svg>';
}

function pickEdge(a, b) {
  if (a === b) return;
  $('#diff-left').value = a; $('#diff-right').value = b;
  showTab('diff');
  doDiff();
}

/* ── tabulka verzí ───────────────────────────────────────────────────── */

let sortCol = -1, sortAsc = true;

function renderTable(d) {
  const tb = $('#ver-tbody'); tb.innerHTML = '';
  const vmap = {};
  d.versions.forEach(v => { vmap[v.id] = v; });
  const rows = [];
  for (const [s, t, w] of d.edges) {
    const a = vmap[s], b = vmap[t];
    if (!a || !b) continue;
    rows.push({
      e: [s, t, w],
      cells: [a.sigla, b.sigla, w, (a.source || '—') + ' ' + (a.year || ''), (b.source || '—') + ' ' + (b.year || '')]
    });
  }

  function draw(sorted) {
    tb.innerHTML = '';
    for (const item of sorted) {
      const tr = document.createElement('tr');
      tr.innerHTML = item.cells.map((c, i) => i === 2 ? `<td><b>${esc(c)}</b></td>`
        : `<td${i < 2 ? ' class="sigla"' : ''}>${esc(c)}</td>`).join('')
        + '<td><button class="cmp-btn">diff</button></td>';
      tr.querySelector('.cmp-btn').onclick = ev => {
        ev.stopPropagation();
        $('#diff-left').value = item.e[0]; $('#diff-right').value = item.e[1];
        showTab('diff');
        doDiff();
      };
      tb.appendChild(tr);
    }
  }
  draw(rows);

  $$('.ver-table th[data-col]').forEach(th => {
    th.onclick = () => {
      const col = +th.dataset.col, isNum = th.dataset.type === 'num';
      if (sortCol === col) sortAsc = !sortAsc; else { sortCol = col; sortAsc = true; }
      $$('.ver-table th .arrow').forEach(a => { a.textContent = ''; });
      th.querySelector('.arrow').textContent = sortAsc ? '▲' : '▼';
      draw([...rows].sort((r1, r2) => {
        const v1 = r1.cells[col], v2 = r2.cells[col];
        if (isNum) return sortAsc ? v1 - v2 : v2 - v1;
        return sortAsc ? String(v1).localeCompare(String(v2), 'cs') : String(v2).localeCompare(String(v1), 'cs');
      }));
    };
  });
}

/* ── diff UI ─────────────────────────────────────────────────────────── */

function fillSelects(d) {
  const opts = d.versions.map(v => `<option value="${v.id}">${esc(v.sigla)} – ${esc(v.source || v.title)}</option>`).join('');
  $('#diff-left').innerHTML = '<option value="">— levá verze —</option>' + opts;
  $('#diff-right').innerHTML = '<option value="">— pravá verze —</option>' + opts;
}

async function doDiff() {
  // selecty vracejí stringy, ale mapy i grafy jsou klíčované čísly
  const a = +$('#diff-left').value, b = +$('#diff-right').value;
  if (!a || !b || a === b) {
    $('#diff-result').innerHTML = '<p class="hint" style="padding:20px">Vyberte dvě různé verze.</p>';
    return;
  }
  await loadLabels();
  const d = computeDiff(a, b);
  const v1 = poemData.versions.find(v => v.id == a), v2 = poemData.versions.find(v => v.id == b);
  const name = v => v ? `${v.sigla} – ${v.source || v.title}` : v;

  let h = '<div class="diff-header">'
    + `<div class="dhs">${esc(name(v1))}</div><div class="dhs">${esc(name(v2))}</div></div>`;
  h += '<div class="stats">'
    + `<span>Shodných: <b>${d.stats.eq}</b></span>`
    + `<span>Změněných: <b>${d.stats.mod}</b></span>`
    + `<span>Smazaných: <b>${d.stats.del}</b></span>`
    + `<span>Přidaných: <b>${d.stats.ins}</b></span>`
    + `<span>Hodnocení: <b>${evalMode === 'jev' ? 'Jev' : 'LLM'}</b></span>`
    + `<span>Ohodnoceno: <b>${rated} / ${changed}</b> změn</span></div>`;
  if (changed > rated) {
    h += `<div class="engine-note">Tato demo verze obsahuje jen ${rated} předpočítaných hodnocení z ${changed} změn`
      + ` – zbytek je zobrazen jen slovně. (Štítky se doplní předpočítáním přes API na straně autora.)</div>`;
  }
  h += d.html;
  $('#diff-result').innerHTML = h;
}

function showTab(name) {
  $$('.tab').forEach(x => x.classList.toggle('active', x.dataset.tab === name));
  $$('.panel').forEach(x => x.classList.toggle('active', x.id === name + '-panel'));
}

/* ── výběr báseň ─────────────────────────────────────────────────────── */

async function selectPoem(id, li) {
  $$('#poem-list li').forEach(x => x.classList.remove('active'));
  if (li) li.classList.add('active');
  const d = await (await fetch(`${DATA}/poem/${+id}.json`)).json();
  poemData = d;
  $('#poem-title').textContent = d.title;
  $('#poem-sub').textContent = `${d.versions.length} verzí · ${d.edges.length} evidovaných přechodů`
    + (Object.keys(d.maps).length ? '' : ' · bez slokové alignace');
  try { renderGraph(d); } catch (e) { $('#graph-container').innerHTML = `<p class="hint">Chyba grafu: ${e.message}</p>`; }
  renderTable(d);
  fillSelects(d);
}

async function init() {
  poemIndex = await (await fetch(`${DATA}/index.json`)).json();
  const ul = $('#poem-list');
  ul.innerHTML = '';
  for (const p of poemIndex) {
    const li = document.createElement('li');
    li.innerHTML = `${esc(p.title)} <span class="nv">${p.nv}×</span>`;
    li.dataset.id = p.id;
    if (!p.aligned) li.classList.add('no-align');
    li.title = p.aligned ? '' : 'bez slokové alignace – diff jen na úrovni veršů';
    li.onclick = () => selectPoem(p.id, li);
    ul.appendChild(li);
  }

  // hloubkový odkaz: ?poem=4677&a=6603&b=6604 rovnou oteřeře diff
  const q = new URLSearchParams(location.search);
  const id = parseInt(q.get('poem'), 10);
  if (id) {
    const li = [...ul.children].find(x => x.dataset.id == id) || null;
    li && li.scrollIntoView({ block: 'center' });
    await selectPoem(id, li);
    if (q.get('a') && q.get('b')) {
      $('#diff-left').value = q.get('a');
      $('#diff-right').value = q.get('b');
      showTab('diff');
      await doDiff();
    }
  }
}

$('#search').oninput = e => {
  const q = e.target.value.toLowerCase();
  $$('#poem-list li').forEach(li => { li.style.display = li.textContent.toLowerCase().includes(q) ? '' : 'none'; });
};
$$('.tab').forEach(t => { t.onclick = () => showTab(t.dataset.tab); });
$('#diff-btn').onclick = doDiff;
$$('#mode-switch button').forEach(btn => {
  btn.onclick = async () => {
    evalMode = btn.dataset.mode;
    $$('#mode-switch button').forEach(x => x.classList.toggle('active', x.dataset.mode === evalMode));
    const a = +$('#diff-left').value, b = +$('#diff-right').value;
    if (a && b && a !== b) await doDiff();
  };
});

init();
