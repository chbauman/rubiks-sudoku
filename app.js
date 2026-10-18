(() => {
  const N = 9;
  const $ = id => document.getElementById(id);
  const clone = g => g.map(r => r.slice());
  const same = (a, b) => a.every((r, i) => r.every((v, j) => v === b[i][j]));
  const rnd = n => Math.floor(Math.random() * n);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---- random solved sudoku via randomized backtracking ----
  function generate() {
    const g = Array.from({ length: N }, () => Array(N).fill(0));
    const ok = (r, c, v) => {
      for (let i = 0; i < N; i++) if (g[r][i] === v || g[i][c] === v) return false;
      const br = r - r % 3, bc = c - c % 3;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (g[br + i][bc + j] === v) return false;
      return true;
    };
    const fill = p => {
      if (p === 81) return true;
      const r = Math.floor(p / N), c = p % N;
      for (const v of shuffle([1,2,3,4,5,6,7,8,9])) {
        if (ok(r, c, v)) { g[r][c] = v; if (fill(p + 1)) return true; g[r][c] = 0; }
      }
      return false;
    };
    fill(0);
    return g;
  }

  function isValid(g) {
    for (let i = 0; i < N; i++) {
      const row = new Set(), col = new Set(), box = new Set();
      for (let j = 0; j < N; j++) {
        row.add(g[i][j]); col.add(g[j][i]);
        box.add(g[3 * Math.floor(i / 3) + Math.floor(j / 3)][3 * (i % 3) + (j % 3)]);
      }
      if (row.size !== N || col.size !== N || box.size !== N) return false;
    }
    return true;
  }

  // how conflicts of a number swap are resolved: 'columns' (only the two affected columns/rows) or 'chain'
  let resolution = 'columns';
  const resolutionInfo = {
    columns: ['Two columns / rows', 'Conflicts are resolved by exchanging entries only between the two affected columns (or rows).'],
    chain: ['Whole chain', 'Any two numbers of a sub-square can be swapped; conflicts are resolved by swapping the two numbers in every cell they chain through, anywhere on the board.'],
  };

  // ---- operations (all return a new grid) ----
  const ops = {
    rotR: g => g.map((_, r) => g.map((_, c) => g[N - 1 - c][r])),
    rotL: g => g.map((_, r) => g.map((_, c) => g[c][N - 1 - r])),
    flipH: g => g.map(r => r.slice().reverse()),
    flipV: g => g.slice().reverse().map(r => r.slice()),
    row(g, r1, r2) { const n = clone(g); [n[r1], n[r2]] = [n[r2], n[r1]]; return n; },
    col(g, c1, c2) { const n = clone(g); n.forEach(r => [r[c1], r[c2]] = [r[c2], r[c1]]); return n; },
    band(g, b1, b2) { let n = clone(g); for (let i = 0; i < 3; i++) n = ops.row(n, 3 * b1 + i, 3 * b2 + i); return n; },
    stack(g, s1, s2) { let n = clone(g); for (let i = 0; i < 3; i++) n = ops.col(n, 3 * s1 + i, 3 * s2 + i); return n; },
    // Swap two cells in the same sub-square (same row or column). The resulting conflicts are
    // resolved using only the two affected columns (horizontal move) or rows (vertical move):
    // the two columns exchange their entries in every row of the cycle that the swapped row
    // belongs to. In the worst case that cycle is everything, i.e. the two whole columns are swapped.
    // With resolution 'chain' instead, the two values are swapped in every cell of the whole
    // connected chain of those two values (anywhere on the board), see numberChain().
    number(g, [r1, c1], [r2, c2], mode = resolution) {
      if (mode === 'chain') return numberChain(g, [r1, c1], [r2, c2]);
      if (r1 !== r2) { // vertical move: do the horizontal logic on the transposed grid
        const t = g.map((_, r) => g.map((_, c) => g[c][r]));
        const n = ops.number(t, [c1, r1], [c2, r2], mode);
        return n.map((_, r) => n.map((_, c) => n[c][r]));
      }
      const n = clone(g);
      let cur = r1;
      do {
        [n[cur][c1], n[cur][c2]] = [n[cur][c2], n[cur][c1]];
        // c1 now holds g[cur][c2] twice; fix the row that originally had it in c1
        const dup = g[cur][c2];
        cur = g.findIndex(row => row[c1] === dup);
      } while (cur !== r1);
      return n;
    },
  };

  // Alternative number swap: swap the two values a, b in every cell of the connected chain
  // (cells holding a or b that share a row, column or sub-square, starting from the chosen cell).
  function numberChain(g, [r1, c1], [r2, c2]) {
    const a = g[r1][c1], b = g[r2][c2], n = clone(g);
    const linked = (p, q) => p[0] === q[0] || p[1] === q[1] ||
      (Math.floor(p[0] / 3) === Math.floor(q[0] / 3) && Math.floor(p[1] / 3) === Math.floor(q[1] / 3));
    const cells = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (g[r][c] === a || g[r][c] === b) cells.push([r, c]);
    const seen = new Set([r1 * N + c1]), queue = [[r1, c1]];
    while (queue.length) {
      const p = queue.pop();
      for (const q of cells) if (!seen.has(q[0] * N + q[1]) && linked(p, q)) { seen.add(q[0] * N + q[1]); queue.push(q); }
    }
    for (const k of seen) { const r = Math.floor(k / N), c = k % N; n[r][c] = g[r][c] === a ? b : a; }
    return n;
  }

  const box = (r, c) => [Math.floor(r / 3), Math.floor(c / 3)];
  // two cells that may be swapped as numbers: same sub-square and, with the 'columns' resolution,
  // additionally the same row or column (the 'chain' resolution allows any two cells of the sub-square)
  function numberPair([r1, c1], [r2, c2]) {
    const [br1, bc1] = box(r1, c1), [br2, bc2] = box(r2, c2);
    if (br1 !== br2 || bc1 !== bc2 || (r1 === r2 && c1 === c2)) return false;
    return resolution === 'chain' || (r1 === r2) !== (c1 === c2);
  }

  // ---- state ----
  // gameKind: 'random' or the number of scrambling moves; way: how the scrambled games resolve the conflicts
  // ('columns', 'chain' or 'both'), gameWay: the way of the running game
  let start, target, grid, history, moves = 0, drag = null, gameKind = '15', way = 'columns', gameWay = 'columns';

  // no number can be moved in a scrambled game of the way 'none'
  const numbersLocked = () => gameKind !== 'random' && gameWay === 'none';

  function newGame() {
    const kind = checkedKind();
    gameKind = kind;
    gameWay = way;
    // a fixed way is the way of the game; with 'both' and for random sudokus the player chooses (see the button)
    if (kind !== 'random' && resolutionInfo[way]) resolution = way;  // not for 'both' and 'none'
    start = generate();
    if (kind === 'random') target = generate();
    else {
      target = clone(start);
      const simple = ['rotR', 'rotL', 'flipH', 'flipV'];
      for (let i = 0; i < +kind; i++) {
        const t = rnd(way === 'none' ? 4 : 5);  // 4 is the number swap
        if (t === 0) target = ops[simple[rnd(4)]](target);
        else if (t === 1) { const b = rnd(3), [x, y] = shuffle([0, 1, 2]); target = ops.row(target, 3 * b + x, 3 * b + y); }
        else if (t === 2) { const b = rnd(3), [x, y] = shuffle([0, 1, 2]); target = ops.col(target, 3 * b + x, 3 * b + y); }
        else if (t === 3) { const [x, y] = shuffle([0, 1, 2]); target = rnd(2) ? ops.band(target, x, y) : ops.stack(target, x, y); }
        else {
          const br = rnd(3), bc = rnd(3), a = [3 * br + rnd(3), 3 * bc + rnd(3)];
          const b = rnd(2) ? [a[0], 3 * bc + (a[1] % 3 + 1 + rnd(2)) % 3] : [3 * br + (a[0] % 3 + 1 + rnd(2)) % 3, a[1]];
          target = ops.number(target, a, b, way === 'both' ? (rnd(2) ? 'columns' : 'chain') : resolution);
        }
      }
    }
    restart();
  }
  function restart() { grid = clone(start); history = []; moves = 0; render(); }

  function commit(next) {
    if (!isValid(next)) return; // should never happen
    history.push(grid); grid = next; moves++; render();
  }

  function buildBoard(el, interactive) {
    el.innerHTML = '';
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const d = document.createElement('div');
      d.className = 'cell' + (c % 3 === 2 && c < 8 ? ' br' : '') + (r % 3 === 2 && r < 8 ? ' bb' : '');
      if (interactive) {
        d.onpointerdown = () => {  // drag a number onto another cell of its sub-square (same row/column)
          if (same(grid, target) || numbersLocked()) return;
          drag = { kind: 'number', from: [r, c], over: null };
          document.body.classList.add('dragging');
          render();
        };
      }
      d.innerHTML = '<span class="v"></span><span class="pm"></span>';
      el.appendChild(d);
    }
  }
  function paint(el, g, cls) {
    [...el.children].forEach((d, i) => {
      const r = Math.floor(i / N), c = i % N;
      d.firstChild.textContent = g[r][c];
      d.lastChild.textContent = target[r][c]; // pencil mark: the target digit
      d.classList.remove('match', 'hl', 'sel');
      const k = cls && cls(r, c); if (k) d.classList.add(k);
    });
  }

  function render() {
    const won = same(grid, target);
    // live preview: while hovering a valid drop target, show the board as it would look after the swap
    const preview = drag && drag.over != null;
    const num = drag && drag.kind === 'number';
    const disp = !preview ? grid : num ? ops.number(grid, drag.from, drag.over) : ops[drag.kind](grid, drag.idx, drag.over);
    paint($('cur'), disp, (r, c) => {
      if (num) {
        if ((r === drag.from[0] && c === drag.from[1]) || (preview && r === drag.over[0] && c === drag.over[1])) return 'sel';
        // highlight every cell changed by the swap (incl. auto-resolved conflicts), or the possible drop targets
        if (preview ? disp[r][c] !== grid[r][c] : numberPair(drag.from, [r, c])) return 'hl';
      } else if (drag) {
        if (preview && inDragUnit(drag.kind, drag.over, r, c)) return 'sel'; // dragged unit, now at its new spot
        if (preview && inDragUnit(drag.kind, drag.idx, r, c)) return 'hl';
        if (!preview && inDragUnit(drag.kind, drag.idx, r, c)) return 'sel';
      }
      return disp[r][c] === target[r][c] ? 'match' : '';
    });
    const st = $('status');
    st.className = 'status' + (won ? ' win' : '');
    st.textContent = won ? `Solved in ${moves} move${moves === 1 ? '' : 's'}! 🎉`
      : `Moves: ${moves} · Matching cells: ${grid.flat().filter((v, i) => v === target.flat()[i]).length}/81`;
    document.querySelectorAll('.handle').forEach(h => {
      const unit = drag && drag.kind !== 'number';
      const mine = unit && h.dataset.kind === drag.kind;
      const i = +h.dataset.idx;
      h.classList.toggle('dragging', mine && i === drag.idx);
      h.classList.toggle('over', mine && i === drag.over);
      // while dragging a unit, only grips it can actually be dropped on stay enabled
      h.classList.toggle('disabled', !!unit && !(mine && (i === drag.idx || dragValid(drag.kind, drag.idx, i))));
    });
    // the player can switch the way of resolving in a game of two random sudokus and in a scrambled game with both
    // ways; in the other scrambled games it is fixed, as the target was scrambled in that way
    const canSwitch = gameKind === 'random' || gameWay === 'both';
    $('cur').classList.toggle('no-swaps', numbersLocked());
    $('resolution-row').hidden = !canSwitch;
    $('resolution').textContent = 'Conflict resolution: ' + resolutionInfo[resolution][0];
    $('resolution').title = resolutionInfo[resolution][1];
    // the way of a fixed game is shown as an indicator instead of the button
    $('mode').hidden = canSwitch;
    $('mode').textContent = numbersLocked() ? 'Numbers cannot be moved (no conflict resolution)'
      : 'Conflict resolution: ' + resolutionInfo[resolution][0] + ' (fixed)';
    $('mode').title = numbersLocked() ? wayInfo.none[1] : resolutionInfo[resolution][1];
    $('undo').disabled = !history.length;
  }

  // ---- drag & drop on the grips around the board ----
  const inDragUnit = (kind, i, r, c) =>
    kind === 'row' ? r === i : kind === 'col' ? c === i :
    kind === 'band' ? Math.floor(r / 3) === i : Math.floor(c / 3) === i;
  const dragValid = (kind, a, b) => a !== b && ((kind === 'row' || kind === 'col') ? Math.floor(a / 3) === Math.floor(b / 3) : true);

  document.querySelectorAll('.strip').forEach(strip => {
    const kind = strip.dataset.kind, big = kind === 'band' || kind === 'stack';
    for (let i = 0; i < (big ? 3 : 9); i++) {
      const h = document.createElement('div');
      h.className = 'handle' + (big ? ' big' : '');
      h.dataset.kind = kind; h.dataset.idx = i;
      h.textContent = '⠿';
      h.title = { row: 'Drag onto another row of the same band', col: 'Drag onto another column of the same stack',
                  band: 'Drag onto another band of sub-squares', stack: 'Drag onto another stack of sub-squares' }[kind];
      h.addEventListener('pointerdown', e => {
        if (same(grid, target)) return;
        e.preventDefault();
        drag = { kind, idx: i, over: null };
        document.body.classList.add('dragging');
        render();
      });
      strip.appendChild(h);
    }
  });
  const dragOver = e => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    let over = null;
    if (drag.kind === 'number') {
      const cell = el?.closest('#cur .cell');
      if (cell) {
        const k = [...cell.parentNode.children].indexOf(cell), rc = [Math.floor(k / N), k % N];
        if (numberPair(drag.from, rc)) over = rc;
      }
      if (String(over) === String(drag.over)) return;
    } else {
      const h = el?.closest('.handle');
      over = h && h.dataset.kind === drag.kind && dragValid(drag.kind, drag.idx, +h.dataset.idx) ? +h.dataset.idx : null;
      if (over === drag.over) return;
    }
    drag.over = over; render();
  };
  window.addEventListener('pointermove', e => { if (drag) dragOver(e); });
  const endDrag = (e, cancel) => {
    if (!drag) return;
    if (!cancel) dragOver(e);
    const d = drag; drag = null;
    document.body.classList.remove('dragging');
    if (!cancel && d.over != null) commit(d.kind === 'number' ? ops.number(grid, d.from, d.over) : ops[d.kind](grid, d.idx, d.over));
    else render();
  };
  window.addEventListener('pointerup', e => endDrag(e, false));
  window.addEventListener('pointercancel', e => endDrag(e, true));

  buildBoard($('cur'), true);
  for (const k of ['rotL', 'rotR', 'flipH', 'flipV']) $(k).onclick = () => { if (!same(grid, target)) commit(ops[k](grid)); };
  $('undo').onclick = () => { if (history.length) { grid = history.pop(); moves--; render(); } };

  // ---- dialogs: restart (asks, as the moves are lost) and new game (with the options of the game)
  const checkedKind = () => document.querySelector('input[name="kind"]:checked').value;
  const inProgress = () => moves > 0 && !same(grid, target);
  const movesText = n => `${n} move${n === 1 ? '' : 's'}`;
  for (const dlg of document.querySelectorAll('dialog')) {
    dlg.addEventListener('click', e => {  // a click on the backdrop closes the dialog
      const r = dlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
    });
  }
  $('reset').onclick = () => {
    if (!inProgress()) return restart();
    $('restart-text').textContent = `The ${movesText(moves)} you made in this game are lost.`;
    $('restart-dialog').showModal();
  };
  $('restart-cancel').onclick = () => $('restart-dialog').close();
  $('restart-yes').onclick = () => { $('restart-dialog').close(); restart(); };

  const wayInfo = {
    ...resolutionInfo,
    both: ['Both', 'The target is scrambled with either way, and you can switch between them during the game.'],
    none: ['None', 'The numbers cannot be moved: the target is scrambled with rows, columns, bands, stacks, rotations and flips only.'],
  };
  for (const [value, [name, info]] of Object.entries(wayInfo)) {
    const label = document.createElement('label');
    label.innerHTML = '<input type="radio" name="resolution" value="' + value + '"> <span></span>';
    label.lastChild.innerHTML = '<b></b><br><small></small>';
    label.lastChild.children[0].textContent = name;
    label.lastChild.children[2].textContent = info;
    $('resolution-options').appendChild(label);
  }
  $('new').onclick = () => {
    document.querySelector('input[name="resolution"][value="' + way + '"]').checked = true;
    document.querySelector('input[name="kind"][value="' + gameKind + '"]').checked = true;  // not a cancelled choice
    const warning = $('new-warning');
    warning.hidden = !inProgress();
    warning.textContent = `Starting a new game loses the current one, with its ${movesText(moves)}.`;
    syncResolutionOptions();
    $('new-dialog').showModal();
  };
  $('new-cancel').onclick = () => $('new-dialog').close();
  $('new-start').onclick = () => {
    // for two random sudokus the way is not chosen here (the button on the page does it)
    if (checkedKind() !== 'random') way = document.querySelector('input[name="resolution"]:checked').value;
    $('new-dialog').close();
    newGame();
    saveOptions();
  };
  // the way of resolving is only an option of the scrambled games
  const syncResolutionOptions = () => { $('resolution-options').hidden = checkedKind() === 'random'; };
  document.querySelectorAll('input[name="kind"]').forEach(r => r.addEventListener('change', syncResolutionOptions));
  $('resolution').onclick = () => { resolution = resolution === 'columns' ? 'chain' : 'columns'; saveOptions(); render(); };

  // ---- the used options (game type and way of resolving) are saved
  const OPTIONS_KEY = 'rubiks-sudoku:options:v1';
  function saveOptions() {
    try { localStorage.setItem(OPTIONS_KEY, JSON.stringify({ kind: gameKind, way, resolution })); } catch (e) {}
  }
  function loadOptions() {
    try {
      const o = JSON.parse(localStorage.getItem(OPTIONS_KEY));
      if (o && resolutionInfo[o.resolution]) resolution = o.resolution;
      if (o && wayInfo[o.way]) way = o.way;
      const radio = o && document.querySelector('input[name="kind"][value="' + o.kind + '"]');
      if (radio) radio.checked = true;
    } catch (e) {}
    syncResolutionOptions();
  }

  // ---- pages: the game, the help and the about page are selected by the URL hash (#help, #about),
  // so the browser's back button returns to the game
  const TITLES = { game: "Rubik's Sudoku", help: 'Help', about: 'About' };
  const currentPage = () => { const p = location.hash.slice(1); return p in TITLES ? p : 'game'; };
  const closeMenu = () => { $('menu').hidden = true; $('menu-btn').setAttribute('aria-expanded', 'false'); };
  function showPage() {
    const page = currentPage();
    document.querySelectorAll('[data-page]').forEach(el => { el.hidden = el.dataset.page !== page; });
    $('page-title').textContent = TITLES[page];
    $('back-btn').hidden = page === 'game';
    closeMenu();
    window.scrollTo(0, 0);
  }
  // history is [game, subpage] at most: opening a subpage from another one replaces the entry
  let prevPage = currentPage(), cameFromGame = false;
  window.addEventListener('hashchange', () => {
    const page = currentPage();
    if (page === 'game') cameFromGame = false;
    else if (prevPage === 'game') cameFromGame = true;
    prevPage = page;
    showPage();
  });
  // (`history` is the list of moves in this file, so the browser's history is window.history)
  $('back-btn').onclick = () => { if (cameFromGame) window.history.back(); else location.hash = ''; };
  $('menu-btn').onclick = () => {
    const open = $('menu').hidden;
    $('menu').hidden = !open;
    $('menu-btn').setAttribute('aria-expanded', String(open));
  };
  $('menu').addEventListener('click', e => {
    const link = e.target.closest('a');
    if (link && currentPage() !== 'game') { e.preventDefault(); location.replace(link.getAttribute('href')); }
  });
  document.addEventListener('click', e => { if (!e.target.closest('#menu-btn')) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  showPage();
  window.__rs = { ops, isValid, generate }; // handy for debugging in the console
  loadOptions();
  newGame();
})();
