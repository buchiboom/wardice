'use strict';

/* ============================================================
   WarDice — minimal RollHammer-style D6 battle dice roller
   ============================================================ */

const MAX_DICE = 1000;          // hard cap for the cup
const MAX_GLYPHS = 60;          // absolute max die glyphs per row (perf)
const UNDO_DEPTH = 30;
const PIP_CELLS = {             // 3x3 grid cells (1-9) used per face value
  1: [5],
  2: [3, 7],
  3: [3, 5, 7],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

const state = {
  cup: 0,
  dice: [],          // { id, value }
  pool: [],          // { id, value }
  selected: new Set(),
  lastRollCount: 0,
  rolling: false,
  nextId: 1,
};

const undoStack = [];

/* ---------- unbiased d6 via crypto ---------- */
function rollD6(count) {
  const out = new Array(count);
  let filled = 0;
  while (filled < count) {
    const buf = new Uint8Array(Math.max(32, (count - filled) * 2));
    crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length && filled < count; i++) {
      if (buf[i] < 252) out[filled++] = (buf[i] % 6) + 1; // reject 252-255 to stay unbiased
    }
  }
  return out;
}

function makeDice(values) {
  return values.map(v => ({ id: state.nextId++, value: v }));
}

/* ---------- undo ---------- */
function pushUndo() {
  undoStack.push(JSON.stringify({
    dice: state.dice,
    pool: state.pool,
    cup: state.cup,
    lastRollCount: state.lastRollCount,
  }));
  if (undoStack.length > UNDO_DEPTH) undoStack.shift();
}

function undo() {
  if (undoStack.length === 0 || state.rolling) return;
  const s = JSON.parse(undoStack.pop());
  state.dice = s.dice;
  state.pool = s.pool;
  state.cup = s.cup;
  state.lastRollCount = s.lastRollCount;
  state.selected.clear();
  render();
}

/* ---------- DOM refs ---------- */
const $ = id => document.getElementById(id);
const resultsEl = $('results');
const totalEl = $('resultTotal');
const cupEl = $('cupCount');
const rollBtn = $('rollBtn');
const againBtn = $('rollAgain');
const againCountEl = $('againCount');
const undoBtn = $('undoBtn');
const poolSection = $('sidepoolSection');
const poolDiceEl = $('poolDice');
const poolCountEl = $('poolCount');
const selectBar = $('selectBar');
const selectCountEl = $('selectCount');

/* ---------- rendering ---------- */
function dieEl(die) {
  const el = document.createElement('div');
  el.className = 'die';
  el.dataset.id = die.id;
  if (state.selected.has(die.id)) el.classList.add('selected');
  for (const cell of PIP_CELLS[die.value]) {
    const pip = document.createElement('div');
    pip.className = 'pip';
    pip.style.gridArea = `${Math.ceil(cell / 3)} / ${((cell - 1) % 3) + 1}`;
    el.appendChild(pip);
  }
  return el;
}

/* Build the 6 fixed rows, measure the free dice area, then size the dice so
   every row fits on screen with no scrolling. */
function render() {
  const groups = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const d of state.dice) groups[d.value].push(d);

  // pass 1: skeleton rows (always all six, 6 on top)
  resultsEl.replaceChildren();
  const wraps = {};
  for (let v = 6; v >= 1; v--) {
    const n = groups[v].length;
    const row = document.createElement('div');
    row.className = 'value-row' + (n === 0 ? ' empty' : '');
    row.dataset.value = v;

    const label = document.createElement('div');
    label.className = 'row-label';
    label.innerHTML = `<div class="face-num">${v}</div><div class="face-count">×${n}</div>`;
    row.appendChild(label);

    const diceWrap = document.createElement('div');
    diceWrap.className = 'row-dice';
    row.appendChild(diceWrap);
    wraps[v] = diceWrap;

    if (n > 0) {
      const actions = document.createElement('div');
      actions.className = 'row-actions';
      actions.innerHTML = `
        <button class="row-btn reroll" data-act="reroll" title="Re-roll all ${v}s">↻</button>
        <button class="row-btn pool" data-act="pool" title="Move all ${v}s to side pool">POOL</button>
        <button class="row-btn del" data-act="del" title="Delete all ${v}s">✕</button>`;
      row.appendChild(actions);
    }
    resultsEl.appendChild(row);
  }

  // pass 2: measure one dice area and derive die size + per-row capacity
  const GAP = 5;
  const rect = resultsEl.querySelector('.row-dice').getBoundingClientRect();
  let die = 34;
  let lines = Math.floor((rect.height + GAP) / (die + GAP));
  if (lines < 1) {                       // very short rows: shrink dice to one line
    die = Math.max(18, Math.floor(rect.height));
    lines = 1;
  }
  const perLine = Math.max(1, Math.floor((rect.width + GAP) / (die + GAP)));
  const capacity = Math.min(MAX_GLYPHS, lines * perLine);
  resultsEl.style.setProperty('--die-size', die + 'px');

  // pass 3: fill dice, collapsing the tail into a "+N" tile when needed
  for (let v = 6; v >= 1; v--) {
    const group = groups[v];
    if (group.length === 0) continue;
    const shown = group.slice(0, group.length > capacity ? capacity - 1 : capacity);
    const frag = document.createDocumentFragment();
    for (const d of shown) frag.appendChild(dieEl(d));
    if (group.length > shown.length) {
      const more = document.createElement('div');
      more.className = 'die overflow';
      more.textContent = `+${group.length - shown.length}`;
      frag.appendChild(more);
    }
    wraps[v].appendChild(frag);
  }

  totalEl.innerHTML = state.dice.length > 0
    ? `RESULT <b>${state.dice.length}</b> DICE`
    : 'FILL CUP & ROLL';

  // side pool
  poolSection.hidden = state.pool.length === 0;
  poolCountEl.textContent = state.pool.length;
  poolDiceEl.replaceChildren(...state.pool.map(d => dieEl(d)));

  // cup + buttons
  cupEl.textContent = state.cup;
  rollBtn.disabled = state.cup === 0 || state.rolling;
  againBtn.disabled = state.lastRollCount === 0 || state.rolling;
  againCountEl.textContent = state.lastRollCount > 0 ? `×${state.lastRollCount}` : '';
  undoBtn.disabled = undoStack.length === 0 || state.rolling;

  // selection bar
  selectBar.hidden = state.selected.size === 0;
  selectCountEl.textContent = `${state.selected.size} SELECTED`;
}

/* ---------- roll animation ---------- */
function animateRoll() {
  state.rolling = true;
  render();
  resultsEl.classList.add('rolling');
  setTimeout(() => {
    resultsEl.classList.remove('rolling');
    state.rolling = false;
    render();
  }, 430);
}

/* ---------- actions ---------- */
function addToCup(n) {
  state.cup = Math.min(MAX_DICE, Math.max(0, state.cup + n));
  render();
}

function doRoll(count) {
  pushUndo();
  state.selected.clear();
  state.lastRollCount = count;
  state.dice = makeDice(rollD6(count));
  state.cup = 0;
  animateRoll();
}

function rerollDice(ids) {
  if (ids.length === 0) return;
  pushUndo();
  const idSet = new Set(ids);
  const values = rollD6(idSet.size);
  let i = 0;
  for (const d of state.dice) if (idSet.has(d.id)) d.value = values[i++];
  state.selected.clear();
  animateRoll();
}

function deleteDice(ids) {
  if (ids.length === 0) return;
  pushUndo();
  const idSet = new Set(ids);
  state.dice = state.dice.filter(d => !idSet.has(d.id));
  state.selected.clear();
  render();
}

function poolDice(ids) {
  if (ids.length === 0) return;
  pushUndo();
  const idSet = new Set(ids);
  state.pool.push(...state.dice.filter(d => idSet.has(d.id)));
  state.dice = state.dice.filter(d => !idSet.has(d.id));
  state.selected.clear();
  render();
}

const idsOfValue = v => state.dice.filter(d => d.value === v).map(d => d.id);

/* ---------- events ---------- */
document.querySelectorAll('.cup-btn').forEach(btn =>
  btn.addEventListener('click', () => addToCup(parseInt(btn.dataset.add, 10))));

$('cupClear').addEventListener('click', () => { state.cup = 0; render(); });
rollBtn.addEventListener('click', () => { if (state.cup > 0) doRoll(state.cup); });
againBtn.addEventListener('click', () => { if (state.lastRollCount > 0) doRoll(state.lastRollCount); });
undoBtn.addEventListener('click', undo);

// results: row action buttons + individual die selection
resultsEl.addEventListener('click', e => {
  if (state.rolling) return;
  const btn = e.target.closest('.row-btn');
  if (btn) {
    const v = parseInt(btn.closest('.value-row').dataset.value, 10);
    const ids = idsOfValue(v);
    if (btn.dataset.act === 'reroll') rerollDice(ids);
    else if (btn.dataset.act === 'pool') poolDice(ids);
    else if (btn.dataset.act === 'del') deleteDice(ids);
    return;
  }
  const die = e.target.closest('.die');
  if (die && !die.classList.contains('overflow')) {
    const id = parseInt(die.dataset.id, 10);
    state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id);
    render();
  }
});

// selection bar
$('selReroll').addEventListener('click', () => rerollDice([...state.selected]));
$('selPool').addEventListener('click', () => poolDice([...state.selected]));
$('selDelete').addEventListener('click', () => deleteDice([...state.selected]));
$('selCancel').addEventListener('click', () => { state.selected.clear(); render(); });

// side pool: tap a die to return it to results
poolDiceEl.addEventListener('click', e => {
  const die = e.target.closest('.die');
  if (!die) return;
  const id = parseInt(die.dataset.id, 10);
  const idx = state.pool.findIndex(d => d.id === id);
  if (idx >= 0) {
    pushUndo();
    state.dice.push(state.pool[idx]);
    state.pool.splice(idx, 1);
    render();
  }
});

$('poolReturnAll').addEventListener('click', () => {
  if (state.pool.length === 0) return;
  pushUndo();
  state.dice.push(...state.pool);
  state.pool = [];
  render();
});
$('poolClear').addEventListener('click', () => {
  if (state.pool.length === 0) return;
  pushUndo();
  state.pool = [];
  render();
});

// keep the fixed 6-row layout fitted on viewport changes (rotation, resize)
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(render, 100);
});

/* ---------- PWA ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  let refreshed = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshed) { refreshed = true; location.reload(); } // auto-pick-up new versions
  });
}

render();
