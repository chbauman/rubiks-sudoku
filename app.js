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
    chain: ['Whole chain', 'Conflicts are resolved by swapping the two numbers in every cell they chain through, anywhere on the board.'],
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
  // two cells that may be swapped as numbers: same sub-square, same row or column
  function numberPair([r1, c1], [r2, c2]) {
    const [br1, bc1] = box(r1, c1), [br2, bc2] = box(r2, c2);
    return br1 === br2 && bc1 === bc2 && (r1 === r2) !== (c1 === c2);
  }

  // ---- state ----
  let start, target, grid, history, moves = 0, drag = null;

  function newGame() {
    const kind = $('kind').value;
    start = generate();
    if (kind === 'random') target = generate();
    else {
      target = clone(start);
      const simple = ['rotR', 'rotL', 'flipH', 'flipV'];
      for (let i = 0; i < +kind; i++) {
        const t = rnd(5);
        if (t === 0) target = ops[simple[rnd(4)]](target);
        else if (t === 1) { const b = rnd(3), [x, y] = shuffle([0, 1, 2]); target = ops.row(target, 3 * b + x, 3 * b + y); }
        else if (t === 2) { const b = rnd(3), [x, y] = shuffle([0, 1, 2]); target = ops.col(target, 3 * b + x, 3 * b + y); }
        else if (t === 3) { const [x, y] = shuffle([0, 1, 2]); target = rnd(2) ? ops.band(target, x, y) : ops.stack(target, x, y); }
        else {
          const br = rnd(3), bc = rnd(3), a = [3 * br + rnd(3), 3 * bc + rnd(3)];
          const b = rnd(2) ? [a[0], 3 * bc + (a[1] % 3 + 1 + rnd(2)) % 3] : [3 * br + (a[0] % 3 + 1 + rnd(2)) % 3, a[1]];
          target = ops.number(target, a, b);
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
          if (same(grid, target)) return;
          drag = { kind: 'number', from: [r, c], over: null };
          document.body.classList.add('dragging');
          render();
        };
      }
      el.appendChild(d);
    }
  }
  function paint(el, g, cls) {
    [...el.children].forEach((d, i) => {
      const r = Math.floor(i / N), c = i % N;
      d.textContent = g[r][c];
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
    paint($('tgt'), target);
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
    $('resolution').textContent = 'Conflict resolution: ' + resolutionInfo[resolution][0];
    $('resolution').title = resolutionInfo[resolution][1];
    $('resolutionInfo').textContent = resolutionInfo[resolution][1];
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
  buildBoard($('tgt'));
  for (const k of ['rotL', 'rotR', 'flipH', 'flipV']) $(k).onclick = () => { if (!same(grid, target)) commit(ops[k](grid)); };
  $('undo').onclick = () => { if (history.length) { grid = history.pop(); moves--; render(); } };
  $('resolution').onclick = () => { resolution = resolution === 'columns' ? 'chain' : 'columns'; render(); };
  $('reset').onclick = restart;
  $('new').onclick = newGame;
  window.__rs = { ops, isValid, generate }; // handy for debugging in the console
  newGame();
})();
