'use strict';

/* ============================================================
   WarDice — minimal RollHammer-style D6 battle dice roller
   ============================================================ */

const MAX_DICE = 1000;          // hard cap for the cup
const RENDER_CAP = 36;          // max die glyphs rendered per value row
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

/* ---------- DOM refs ---------- */
const $ = id => document.getElementById(id);
const resultsEl = $('results');
const emptyEl = $('emptyState');
const totalEl = $('resultTotal');
const cupEl = $('cupCount');
const rollBtn = $('rollBtn');
const againBtn = $('rollAgain');
const againCountEl = $('againCount');
const poolSection = $('sidepoolSection');
const poolDiceEl = $('poolDice');
const poolCountEl = $('poolCount');
const selectBar = $('selectBar');
const selectCountEl = $('selectCount');

/* ---------- rendering ---------- */
function dieEl(die, opts = {}) {
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
  if (opts.pool) el.dataset.pool = '1';
  return el;
}

function render() {
  // results area
  resultsEl.querySelectorAll('.value-row').forEach(n => n.remove());
  const hasDice = state.dice.length > 0;
  emptyEl.hidden = hasDice;

  if (hasDice) {
    for (let v = 6; v >= 1; v--) {
      const group = state.dice.filter(d => d.value === v);
      if (group.length === 0) continue;

      const row = document.createElement('div');
      row.className = 'value-row';
      row.dataset.value = v;

      const label = document.createElement('div');
      label.className = 'row-label';
      label.innerHTML = `<div class="face-num">${v}</div><div class="face-count">×${group.length}</div>`;
      row.appendChild(label);

      const diceWrap = document.createElement('div');
      diceWrap.className = 'row-dice';
      const shown = group.slice(0, group.length > RENDER_CAP ? RENDER_CAP - 1 : RENDER_CAP);
      for (const d of shown) diceWrap.appendChild(dieEl(d));
      if (group.length > RENDER_CAP) {
        const more = document.createElement('div');
        more.className = 'die overflow';
        more.textContent = `+${group.length - shown.length}`;
        diceWrap.appendChild(more);
      }
      row.appendChild(diceWrap);

      const actions = document.createElement('div');
      actions.className = 'row-actions';
      actions.innerHTML = `
        <button class="row-btn reroll" data-act="reroll" title="Re-roll all ${v}s">↻</button>
        <button class="row-btn pool" data-act="pool" title="Move all ${v}s to side pool">POOL</button>
        <button class="row-btn del" data-act="del" title="Delete all ${v}s">✕</button>`;
      row.appendChild(actions);

      resultsEl.appendChild(row);
    }
  }

  totalEl.innerHTML = hasDice ? `RESULT <b>${state.dice.length}</b> DICE` : '—';

  // side pool
  poolSection.hidden = state.pool.length === 0;
  poolCountEl.textContent = state.pool.length;
  poolDiceEl.replaceChildren(...state.pool.map(d => dieEl(d, { pool: true })));

  // cup + buttons
  cupEl.textContent = state.cup;
  rollBtn.disabled = state.cup === 0 || state.rolling;
  againBtn.disabled = state.lastRollCount === 0 || state.rolling;
  againCountEl.textContent = state.lastRollCount > 0 ? `×${state.lastRollCount}` : '';

  // selection bar
  selectBar.hidden = state.selected.size === 0;
  selectCountEl.textContent = `${state.selected.size} SELECTED`;
}

/* ---------- roll animation ---------- */
function animateRoll(finalize) {
  state.rolling = true;
  render();
  resultsEl.classList.add('rolling');
  setTimeout(() => {
    resultsEl.classList.remove('rolling');
    state.rolling = false;
    finalize();
    render();
  }, 430);
}

/* ---------- actions ---------- */
function addToCup(n) {
  state.cup = Math.min(MAX_DICE, Math.max(0, state.cup + n));
  render();
}

function doRoll(count) {
  state.selected.clear();
  state.lastRollCount = count;
  state.dice = makeDice(rollD6(count));
  state.cup = 0;
  animateRoll(() => {});
}

function rerollDice(ids) {
  const idSet = new Set(ids);
  const values = rollD6(idSet.size);
  let i = 0;
  for (const d of state.dice) if (idSet.has(d.id)) d.value = values[i++];
  state.selected.clear();
  animateRoll(() => {});
}

function deleteDice(ids) {
  const idSet = new Set(ids);
  state.dice = state.dice.filter(d => !idSet.has(d.id));
  state.selected.clear();
  render();
}

function poolDice(ids) {
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
    state.dice.push(state.pool[idx]);
    state.pool.splice(idx, 1);
    render();
  }
});

$('poolReturnAll').addEventListener('click', () => {
  state.dice.push(...state.pool);
  state.pool = [];
  render();
});
$('poolClear').addEventListener('click', () => { state.pool = []; render(); });

/* ---------- PWA ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

render();
