'use strict';

/* ============================================================
   WarDice — RollHammer-style D6 battle dice roller
   Multi-instance: one roller per player panel (1-4 players).
   ============================================================ */

const MAX_DICE = 1000;          // hard cap per cup
const ROW_CAP = 12;             // max die glyphs shown per row: 6 wide x 2 lines (11 dice + "+N")
const ROW_COLS = 6;             // dice per line when a row overflows
const UNDO_DEPTH = 30;
const DIE_SIZES = [34, 30, 26, 22, 18, 14];  // shrink-to-fit ladder
const DIE_MIN = 10;             // smallest die when squeezing an overflow row
const GAP = 4;                  // matches .row-dice gap
const POOL_DIE_PITCH = 28;      // .dice-strip die (24px) + its 4px gap
const ROLL_ANIM_MS = 430;       // matches the .rolling tumble animation
const COMPACT_H = 520;          // panel shorter than this uses compact controls
const COMPACT_W = 330;          // panel narrower than this uses compact controls
const WIDE_RATIO = 1.15;        // pbody wider than tall*this -> landscape layout
const PIP_CELLS = {             // 3x3 grid cells (1-9) used per face value
  1: [5],
  2: [3, 7],
  3: [3, 5, 7],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

// the "+N not shown" tile, shared by the value rows and the side pool
function overflowTile(n) {
  const el = document.createElement('div');
  el.className = 'die overflow';
  el.textContent = `+${n}`;
  return el;
}

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

/* ============================================================
   Settings
   ============================================================ */
const DEFAULT_SETTINGS = { orientation: 'portrait', tablet: 'off', players: '2', sound: 'on', theme: 'default' };
let settings = { ...DEFAULT_SETTINGS };
try {
  settings = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('wardice-settings') || '{}') };
} catch {}

function saveSettings() {
  try { localStorage.setItem('wardice-settings', JSON.stringify(settings)); } catch {}
}

/* ============================================================
   Color schemes — 26 Warhammer 40k factions + default
   accent = faction armor color · bg = dark board tint
   die/pip override the dice face when a faction calls for it
   ============================================================ */
const THEMES = [
  { id: 'default',     name: 'Gold · WarDice',                 accent: '#c9a227', bg: '#0d0f12' },
  { id: 'ultramar',    name: 'Blue · Ultramarines',            accent: '#4a7bd0', bg: '#090e1c' },
  { id: 'bloodangels', name: 'Crimson · Blood Angels',         accent: '#c43c3c', bg: '#160a0a' },
  { id: 'darkangels',  name: 'Forest Green · Dark Angels',     accent: '#2a8a57', bg: '#07120c', die: '#ece5cb' },
  { id: 'fists',       name: 'Yellow · Imperial Fists',        accent: '#e8c11c', bg: '#14110a', pip: '#2b2410' },
  { id: 'salamanders', name: 'Green · Salamanders',            accent: '#34a853', bg: '#081207' },
  { id: 'ravenguard',  name: 'Slate Grey · Raven Guard',       accent: '#9aa3ad', bg: '#0a0a0c' },
  { id: 'whitescars',  name: 'White · White Scars',            accent: '#e8e8e8', bg: '#101012', pip: '#a02020' },
  { id: 'ironhands',   name: 'Gunmetal · Iron Hands',          accent: '#8c9296', bg: '#0c0d0e', die: '#d7dade' },
  { id: 'spacewolves', name: 'Grey-Blue · Space Wolves',       accent: '#7da0b8', bg: '#0d1318' },
  { id: 'templars',    name: 'Bone · Black Templars',          accent: '#cfcfc6', bg: '#08080a', pip: '#8c1d1d' },
  { id: 'greyknights', name: 'Silver · Grey Knights',          accent: '#aeb9c4', bg: '#0d1014', die: '#dde3e9' },
  { id: 'deathwatch',  name: 'Steel Red · Deathwatch',         accent: '#b0b8c4', bg: '#09090b', pip: '#7a1f1f' },
  { id: 'sororitas',   name: 'Scarlet · Adepta Sororitas',     accent: '#c02438', bg: '#0e0a0c', die: '#f2eee6' },
  { id: 'militarum',   name: 'Olive · Astra Militarum',        accent: '#9aa050', bg: '#0e0f08', die: '#e3e0c4' },
  { id: 'mechanicus',  name: 'Rust Red · Adeptus Mechanicus',  accent: '#c04a2e', bg: '#120b08', pip: '#3a241c' },
  { id: 'custodes',    name: 'Rich Gold · Adeptus Custodes',   accent: '#d4af37', bg: '#12100a' },
  { id: 'blacklegion', name: 'Dark Gold · Black Legion',       accent: '#b89b32', bg: '#0a090c' },
  { id: 'deathguard',  name: 'Sickly Green · Death Guard',     accent: '#8a9c45', bg: '#0e1009', die: '#dde0c0', pip: '#4a3a1f' },
  { id: 'tsons',       name: 'Azure · Thousand Sons',          accent: '#2f8fc5', bg: '#081018', die: '#e9e2c8', pip: '#1c3a5e' },
  { id: 'worldeaters', name: 'Blood Red · World Eaters',       accent: '#c03028', bg: '#120808', pip: '#5e1a14' },
  { id: 'emperors',    name: "Purple · Emperor's Children",    accent: '#9b4fc0', bg: '#100818' },
  { id: 'necrons',     name: 'Gauss Green · Necrons',          accent: '#46d68a', bg: '#0a1210', die: '#c8d2cc', pip: '#0f3528' },
  { id: 'orks',        name: 'Bright Green · Orks',            accent: '#5fae35', bg: '#0c1208', die: '#e8e3c8', pip: '#20330f' },
  { id: 'aeldari',     name: 'Teal · Aeldari',                 accent: '#3fb5c4', bg: '#0a1216', die: '#e9e9e0' },
  { id: 'tau',         name: "Ochre · T'au Empire",            accent: '#d8a25a', bg: '#14100b', die: '#efe6d2' },
  { id: 'tyranids',    name: 'Magenta · Tyranids',             accent: '#b54a8f', bg: '#120a14', die: '#e8dcc8', pip: '#4a1f3a' },
];

// mix two hex colors: t=0 -> a, t=1 -> b (accepts #rgb or #rrggbb)
function mix(a, b, t) {
  const rgb = h => {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  };
  const pa = rgb(a), pb = rgb(b);
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

function applyTheme() {
  const t = THEMES.find(x => x.id === settings.theme) || THEMES[0];
  const r = document.documentElement.style;
  r.setProperty('--gold', t.accent);
  r.setProperty('--gold-dim', mix(t.accent, '#000000', 0.35));
  r.setProperty('--bg', t.bg);
  r.setProperty('--panel', mix(t.bg, '#ffffff', 0.04));
  r.setProperty('--panel2', mix(t.bg, '#ffffff', 0.09));
  r.setProperty('--line', mix(t.bg, '#ffffff', 0.16));
  r.setProperty('--die-face', t.die || '#f0ead6');
  r.setProperty('--die-pip', t.pip || '#17191d');
  r.setProperty('--accent-grad-a', mix(t.accent, '#ffffff', 0.10));
  r.setProperty('--accent-grad-b', mix(t.accent, '#000000', 0.25));
  r.setProperty('--accent-edge', mix(t.accent, '#000000', 0.60));
  r.setProperty('--accent-text', mix(t.accent, '#000000', 0.85));
  document.querySelector('meta[name="theme-color"]').setAttribute('content', t.bg);
}

/* ---------- dice roll sound (generated with ludo.ai) ---------- */
// small fixed pool of reused players: simultaneous rolls overlap cleanly
// without allocating (and leaking) a fresh Audio on every roll
const SFX_POOL = Array.from({ length: 4 }, () => {
  const a = new Audio('sounds/roll.mp3');
  a.preload = 'auto';
  a.volume = 0.9;
  return a;
});
let sfxIdx = 0;

function playRollSound() {
  if (settings.sound !== 'on') return;
  const a = SFX_POOL[sfxIdx];
  sfxIdx = (sfxIdx + 1) % SFX_POOL.length;
  try { a.currentTime = 0; a.play().catch(() => {}); } catch {}
}

async function applyOrientation() {
  try {
    if (settings.orientation === 'auto') screen.orientation.unlock();
    else await screen.orientation.lock(settings.orientation);
  } catch {} // browser tabs / iOS don't allow locking — setting still drives layout
}

/* ============================================================
   Player roller instance
   ============================================================ */
function createPlayer(root, name) {
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

  const q = sel => root.querySelector(sel);
  const pbody = q('.pbody');
  const resultsEl = q('.results');
  const totalEl = q('.ptotal');
  const undoBtn = q('.undo');
  const cupEl = q('.cup-count b');
  const rollBtn = q('.roll-btn');
  const againBtn = q('.roll-again');
  const againCountEl = q('.roll-again small');
  const poolSection = q('.sidepool');
  const poolDiceEl = q('.pool-dice');
  const poolCountEl = q('.pool-count');
  const selectBar = q('.select-bar');
  const selectCountEl = q('.select-count');

  q('.pname').textContent = name;

  const makeDice = values => values.map(v => ({ id: state.nextId++, value: v }));

  function pushUndo() {
    undoStack.push(JSON.stringify({
      dice: state.dice, pool: state.pool, cup: state.cup, lastRollCount: state.lastRollCount,
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

  /* Build the 6 fixed rows, measure the free dice area, then walk the size
     ladder so the busiest row shows as many real dice as possible. */
  function render() {
    // panel-shape classes (drives portrait/landscape layout + compact controls)
    pbody.classList.toggle('wide', pbody.clientWidth > pbody.clientHeight * WIDE_RATIO);
    root.classList.toggle('compact', root.clientHeight < COMPACT_H || root.clientWidth < COMPACT_W);

    const groups = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const d of state.dice) groups[d.value].push(d);
    const maxGroup = Math.max(...Object.values(groups).map(g => g.length));

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
      label.title = `Move all ${v}s to side pool`;
      label.innerHTML = `<div class="face-num">${v}</div><div class="face-count">×${n}</div>`
        + (n > 0 ? '<div class="pool-hint">POOL</div>' : '');
      row.appendChild(label);

      const diceWrap = document.createElement('div');
      diceWrap.className = 'row-dice';
      row.appendChild(diceWrap);
      wraps[v] = diceWrap;

      if (n > 0) {
        const actions = document.createElement('div');
        actions.className = 'row-actions';
        actions.innerHTML = `
          <button class="row-btn reroll" data-act="reroll" title="Re-roll all ${v}s">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>
            REROLL</button>
          <button class="row-btn del" data-act="del" title="Remove all ${v}s">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>
            REMOVE</button>`;
        row.appendChild(actions);
      }
      resultsEl.appendChild(row);
    }

    // pass 2: measure a row that actually has the action buttons, otherwise
    // the wider empty-row dice area lies about the available space
    const measured = resultsEl.querySelector('.value-row:not(.empty) .row-dice')
      || resultsEl.querySelector('.row-dice');
    const rect = measured.getBoundingClientRect();
    // a row always shows whole lines, two at most; the last tile is the
    // "+N not shown" counter when a group overflows
    const perLineOf = s => Math.max(1, Math.floor((rect.width + GAP) / (s + GAP)));
    const linesOf = s => Math.max(1, Math.min(2, Math.floor((rect.height + GAP) / (s + GAP))));
    const capOf = s => Math.min(ROW_CAP, perLineOf(s) * linesOf(s));
    // largest ladder size that shows every die of the busiest group
    let die = 0;
    for (const s of DIE_SIZES) {
      if (s <= rect.height && maxGroup <= capOf(s)) { die = s; break; }
    }
    let capacity;
    if (die) {
      capacity = capOf(die);                 // everything fits — no "+N" tile
    } else {
      // overflow: show 11 dice + "+N" as a filled 6-wide x 2 grid, with the
      // dice resized so those 12 tiles exactly fill the row
      const dieW = Math.floor((rect.width + GAP) / ROW_COLS) - GAP;
      const dieH = Math.floor((rect.height + GAP) / 2) - GAP;
      die = Math.max(DIE_MIN, Math.min(DIE_SIZES[0], dieW, dieH));
      capacity = ROW_CAP;
    }
    resultsEl.style.setProperty('--die-size', die + 'px');
    // square action buttons: two of them split the row height
    const btn = Math.max(20, Math.min(48, Math.floor((rect.height - 4) / 2)));
    resultsEl.style.setProperty('--btn-size', btn + 'px');

    // pass 3: fill dice, collapsing the tail into a "+N" tile when needed
    for (let v = 6; v >= 1; v--) {
      const group = groups[v];
      if (group.length === 0) continue;
      const shown = group.slice(0, group.length > capacity ? capacity - 1 : capacity);
      const frag = document.createDocumentFragment();
      for (const d of shown) frag.appendChild(dieEl(d));
      if (group.length > shown.length) frag.appendChild(overflowTile(group.length - shown.length));
      wraps[v].appendChild(frag);
    }

    totalEl.innerHTML = state.dice.length > 0
      ? `RESULT <b>${state.dice.length}</b> DICE`
      : '';

    // side pool: max two clean lines, tail collapses into a "+N" tile
    poolSection.hidden = state.pool.length === 0;
    poolCountEl.textContent = state.pool.length;
    if (state.pool.length > 0) {
      const stripW = poolDiceEl.clientWidth || 300;
      const poolCap = Math.max(1, Math.floor((stripW + GAP) / POOL_DIE_PITCH)) * 2;
      const shown = state.pool.slice(0, state.pool.length > poolCap ? poolCap - 1 : poolCap);
      poolDiceEl.replaceChildren(...shown.map(d => dieEl(d)));
      if (state.pool.length > shown.length) poolDiceEl.appendChild(overflowTile(state.pool.length - shown.length));
    } else {
      poolDiceEl.replaceChildren();
    }

    // cup + buttons — the count box and ROLL both show how many dice are queued
    cupEl.textContent = state.cup;
    rollBtn.textContent = state.cup > 0 ? `ROLL ${state.cup}` : 'ROLL';
    rollBtn.disabled = state.cup === 0 || state.rolling;
    againBtn.disabled = state.lastRollCount === 0 || state.rolling;
    againCountEl.textContent = state.lastRollCount > 0 ? `×${state.lastRollCount}` : '';
    undoBtn.disabled = undoStack.length === 0 || state.rolling;

    // selection bar
    selectBar.hidden = state.selected.size === 0;
    selectCountEl.textContent = `${state.selected.size} SELECTED`;
  }

  function animateRoll() {
    state.rolling = true;
    playRollSound();
    render();
    resultsEl.classList.add('rolling');
    setTimeout(() => {
      resultsEl.classList.remove('rolling');
      state.rolling = false;
      render();
    }, ROLL_ANIM_MS);
  }

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
  root.querySelectorAll('.cup-btn').forEach(btn =>
    btn.addEventListener('click', () => addToCup(parseInt(btn.dataset.add, 10))));

  q('.cup-empty').addEventListener('click', () => {   // zero just the pending cup
    if (state.cup === 0) return;
    state.cup = 0;
    render();
  });
  q('.cup-clear').addEventListener('click', () => {
    if (state.cup === 0 && state.dice.length === 0) return;
    pushUndo();
    state.cup = 0;
    state.dice = [];           // clear the table, not just the cup counter
    state.selected.clear();
    render();
  });
  rollBtn.addEventListener('click', () => { if (state.cup > 0) doRoll(state.cup); });
  againBtn.addEventListener('click', () => { if (state.lastRollCount > 0) doRoll(state.lastRollCount); });
  undoBtn.addEventListener('click', undo);

  resultsEl.addEventListener('click', e => {
    if (state.rolling) return;
    const btn = e.target.closest('.row-btn');
    if (btn) {
      const v = parseInt(btn.closest('.value-row').dataset.value, 10);
      const ids = idsOfValue(v);
      if (btn.dataset.act === 'reroll') rerollDice(ids);
      else if (btn.dataset.act === 'del') deleteDice(ids);
      return;
    }
    const label = e.target.closest('.row-label');
    if (label) {
      const v = parseInt(label.closest('.value-row').dataset.value, 10);
      poolDice(idsOfValue(v));   // face number doubles as the POOL button
      return;
    }
    const die = e.target.closest('.die');
    if (die && !die.classList.contains('overflow')) {
      const id = parseInt(die.dataset.id, 10);
      state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id);
      render();
    }
  });

  q('.sel-reroll').addEventListener('click', () => rerollDice([...state.selected]));
  q('.sel-pool').addEventListener('click', () => poolDice([...state.selected]));
  q('.sel-delete').addEventListener('click', () => deleteDice([...state.selected]));
  q('.sel-cancel').addEventListener('click', () => { state.selected.clear(); render(); });

  poolDiceEl.addEventListener('click', e => {
    const die = e.target.closest('.die');
    if (!die || die.classList.contains('overflow')) return;
    const id = parseInt(die.dataset.id, 10);
    const idx = state.pool.findIndex(d => d.id === id);
    if (idx >= 0) {
      pushUndo();
      state.dice.push(state.pool[idx]);
      state.pool.splice(idx, 1);
      render();
    }
  });

  q('.pool-return').addEventListener('click', () => {
    if (state.pool.length === 0) return;
    pushUndo();
    state.dice.push(...state.pool);
    state.pool = [];
    render();
  });
  q('.pool-clear').addEventListener('click', () => {
    if (state.pool.length === 0) return;
    pushUndo();
    state.pool = [];
    render();
  });

  // refit when this panel's size changes (rotation, split-board resize, …)
  let roTimer = null;
  const ro = new ResizeObserver(() => {
    clearTimeout(roTimer);
    roTimer = setTimeout(render, 80);
  });
  ro.observe(pbody);

  render();
  return {
    render,
    // snapshot/restore so a board rebuild (tablet toggle, player-count
    // change) keeps each player's full state instead of wiping it
    snapshot: () => ({
      dice: state.dice, pool: state.pool, cup: state.cup,
      lastRollCount: state.lastRollCount, nextId: state.nextId,
      undo: undoStack.slice(), selected: [...state.selected],
    }),
    restore: s => {
      state.dice = s.dice; state.pool = s.pool; state.cup = s.cup;
      state.lastRollCount = s.lastRollCount; state.nextId = s.nextId;
      undoStack.length = 0;
      if (s.undo) undoStack.push(...s.undo);
      state.selected = new Set(s.selected || []);
      render();
    },
    destroy: () => { clearTimeout(roTimer); ro.disconnect(); },
  };
}

/* ============================================================
   Board + settings UI
   ============================================================ */
const board = document.getElementById('board');
const playerTpl = document.getElementById('playerTpl');
const settingsModal = document.getElementById('settingsModal');
let players = [];

function buildBoard() {
  const n = settings.tablet === 'on' ? parseInt(settings.players, 10) : 1;
  const carried = players.map(p => p.snapshot());   // keep state across rebuild
  players.forEach(p => p.destroy());                // tear down old observers
  board.className = 'board players-' + n;
  board.replaceChildren();
  document.getElementById('statusSlot').replaceChildren();
  players = [];
  for (let i = 1; i <= n; i++) {
    const node = playerTpl.content.firstElementChild.cloneNode(true);
    board.appendChild(node);
    players.push(createPlayer(node, 'P' + i));
  }
  // single player: result + undo live up in the WARDICE bar
  if (n === 1) document.getElementById('statusSlot').appendChild(board.querySelector('.cup-status'));
  // restore carried state synchronously (so a follow-up rebuild snapshots
  // real state, not empty panels), then refit once layout has settled so
  // dice are measured against the final panel size (not a transient one)
  players.forEach((p, i) => { if (carried[i]) p.restore(carried[i]); });
  requestAnimationFrame(() => players.forEach(p => p.render()));
}

const themeSelect = document.getElementById('themeSelect');
for (const t of THEMES) {
  const opt = document.createElement('option');
  opt.value = t.id;
  opt.textContent = t.name;
  themeSelect.appendChild(opt);
}
themeSelect.addEventListener('change', () => {
  settings.theme = themeSelect.value;
  saveSettings();
  applyTheme();
});

function syncSettingsUI() {
  settingsModal.querySelectorAll('.seg').forEach(seg => {
    const key = seg.dataset.setting;
    seg.querySelectorAll('button').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.val === settings[key]));
  });
  themeSelect.value = settings.theme;
  document.getElementById('playersSetting').hidden = settings.tablet !== 'on';
}

document.getElementById('settingsBtn').addEventListener('click', () => {
  syncSettingsUI();
  settingsModal.hidden = false;
});
document.getElementById('settingsClose').addEventListener('click', () => { settingsModal.hidden = true; });
settingsModal.addEventListener('click', e => {
  if (e.target === settingsModal) settingsModal.hidden = true;
  const btn = e.target.closest('.seg button');
  if (!btn) return;
  const key = btn.closest('.seg').dataset.setting;
  if (settings[key] === btn.dataset.val) return;
  settings[key] = btn.dataset.val;
  saveSettings();
  syncSettingsUI();
  if (key === 'orientation') applyOrientation();
  else buildBoard();
});

/* ---------- PWA ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  let refreshed = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshed) { refreshed = true; location.reload(); } // auto-pick-up new versions
  });
}

applyTheme();
buildBoard();
applyOrientation();
