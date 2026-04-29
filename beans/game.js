// ===== Constants =====
const ROWS = 9;
const COLS = 12;
const BEANS_EASY = 5;
const BEANS_HARD = 7;
const CHAIN_MIN = 5;

const BEAN_IMGS = {
  1: 'Image/bean_001.png',
  2: 'Image/bean_002.png',
  3: 'Image/bean_003.png',
  4: 'Image/bean_004.png',
  5: 'Image/bean_005.png',
  6: 'Image/bean_006.png',
  7: 'Image/bean_007.png',
};

// Storage keys
const KEY_MODE   = 'BeansSettingGameMode';
const KEY_MUSIC  = 'BeansSettingPlayBackgroundMusic';
const KEY_EASY   = 'BeansSettingEasyModeScore';
const KEY_HARD   = 'BeansSettingHardModeScore';

// ===== Storage helpers =====
const Storage = {
  get(key, def) {
    const v = localStorage.getItem(key);
    return v === null ? def : JSON.parse(v);
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }
};

// ===== A* Pathfinder =====
class AStarPathFinder {
  constructor() {
    // 4-directional movement
    this.movements = [
      { row: -1, col:  0 },
      { row:  1, col:  0 },
      { row:  0, col: -1 },
      { row:  0, col:  1 },
    ];
    this.dist = [];
    this.content = []; // 0=empty, 1=wall, 2=start(monster), 3=end(hero)
  }

  readMap(map, sr, sc, tr, tc) {
    this.rows = ROWS;
    this.cols = COLS;
    this.dist = [];
    this.content = [];
    for (let r = 0; r < ROWS; r++) {
      this.dist.push(new Array(COLS).fill(10000));
      this.content.push(new Array(COLS).fill(0));
      for (let c = 0; c < COLS; c++) {
        this.content[r][c] = map[r][c] !== 0 ? 1 : 0; // wall or empty
      }
    }
    this.content[sr][sc] = 2; // monster (start)
    this.content[tr][tc] = 3; // hero (end)
    this.sr = sr; this.sc = sc;
    this.tr = tr; this.tc = tc;
  }

  _squareOpen(r, c) {
    return this.content[r][c] !== 1; // empty, start, end all passable
  }

  _validCoord(r, c) {
    return r >= 0 && c >= 0 && r < ROWS && c < COLS;
  }

  pathfind() {
    // BFS / Dijkstra relaxation from hero (end)
    this.dist[this.tr][this.tc] = 0;
    let madeProgress = true;
    while (madeProgress) {
      madeProgress = false;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!this._squareOpen(r, c)) continue;
          const passHere = this.dist[r][c];
          for (const m of this.movements) {
            const nr = r + m.row;
            const nc = c + m.col;
            if (!this._validCoord(nr, nc) || !this._squareOpen(nr, nc)) continue;
            const newPass = passHere + 1;
            if (this.dist[nr][nc] > newPass) {
              this.dist[nr][nc] = newPass;
              madeProgress = true;
            }
          }
        }
      }
    }
  }

  getPath() {
    // Trace from start (monster) toward decreasing distance values
    const path = [];
    let r = this.sr, c = this.sc;
    if (this.dist[r][c] === 10000) return []; // no path

    path.push({ row: r, col: c });
    while (!(r === this.tr && c === this.tc)) {
      let lowest = 10000;
      let nr = -1, nc = -1;
      for (const m of this.movements) {
        const mr = r + m.row;
        const mc = c + m.col;
        if (!this._validCoord(mr, mc) || !this._squareOpen(mr, mc)) continue;
        if (this.dist[mr][mc] < lowest) {
          lowest = this.dist[mr][mc];
          nr = mr; nc = mc;
        }
      }
      if (nr === -1) return []; // stuck
      r = nr; c = nc;
      path.push({ row: r, col: c });
      if (path.length > ROWS * COLS) return []; // safety
    }
    return path;
  }
}

// ===== Game State =====
class BeansGame {
  constructor(boardEl, scoreEl, nextEls) {
    this.boardEl  = boardEl;
    this.scoreEl  = scoreEl;
    this.nextEls  = nextEls; // array of 3 img/div elements

    this.map = [];       // 2D [row][col] -> bean type 1-7, 0=empty
    this.cells = [];     // 2D [row][col] -> DOM cell element
    this.nextBeans = []; // array of 3 upcoming bean types

    this.selected = null;   // { row, col } or null
    this.score = 0;
    this.animating = false;
    this.gameOver = false;
    this.mode = Storage.get(KEY_MODE, BEANS_EASY);

    this._buildBoard();
    this.newGame();
  }

  // ---- Board construction ----
  _buildBoard() {
    this.boardEl.innerHTML = '';
    this.boardEl.style.gridTemplateColumns = `repeat(${COLS}, var(--cell-size, 46px))`;
    this.cells = [];
    for (let r = 0; r < ROWS; r++) {
      this.cells.push([]);
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.addEventListener('click', () => this._onCellClick(r, c));
        this.boardEl.appendChild(cell);
        this.cells[r].push(cell);
      }
    }
  }

  // ---- New Game ----
  newGame() {
    this.mode = Storage.get(KEY_MODE, BEANS_EASY);
    this.map = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    this.score = 0;
    this.selected = null;
    this.animating = false;
    this.gameOver = false;
    this._updateScore();
    this._clearAllCells();
    this._createNextBeans();
    this._putNextBeans();
  }

  // ---- Score ----
  _updateScore() {
    this.scoreEl.textContent = this.score;
  }

  _addScore(n) {
    this.score += n;
    this._updateScore();
  }

  _storeScore() {
    if (this.mode === BEANS_HARD) {
      const best = Storage.get(KEY_HARD, 0);
      if (this.score > best) Storage.set(KEY_HARD, this.score);
    } else {
      const best = Storage.get(KEY_EASY, 0);
      if (this.score > best) Storage.set(KEY_EASY, this.score);
    }
  }

  // ---- Cell rendering ----
  _clearAllCells() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this._renderCell(r, c);
      }
    }
  }

  _renderCell(r, c, extraClass) {
    const cell = this.cells[r][c];
    const beanType = this.map[r][c];
    cell.innerHTML = '';
    cell.className = 'cell';
    if (extraClass) cell.classList.add(extraClass);
    if (beanType > 0) {
      const bean = document.createElement('div');
      bean.className = `bean bean-${beanType}`;
      cell.appendChild(bean);
    }
  }

  // ---- Next beans ----
  _createNextBeans() {
    this.nextBeans = [];
    for (let i = 0; i < 3; i++) {
      this.nextBeans.push(Math.floor(Math.random() * this.mode) + 1);
    }
    this._updateNextUI();
  }

  _updateNextUI() {
    for (let i = 0; i < 3; i++) {
      const el = this.nextEls[i];
      el.className = `next-bean bean-${this.nextBeans[i]}`;
    }
  }

  _getEmptyCells() {
    const list = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (this.map[r][c] === 0) list.push({ row: r, col: c });
    return list;
  }

  _putNextBeans() {
    const empty = this._getEmptyCells();
    if (empty.length <= 3) return false; // game over

    // Shuffle pick 3
    for (let i = 0; i < 3 && empty.length > 0; i++) {
      const idx = Math.floor(Math.random() * empty.length);
      const { row, col } = empty.splice(idx, 1)[0];
      this.map[row][col] = this.nextBeans[i];
      this._renderCell(row, col, 'bean-appearing');

      if (this._checkChain(row, col)) {
        // Use animated removal even here so DOM stays consistent
        this._removeChainAnimated(() => {});
        break; // stop adding more beans when a chain forms
      }
    }
    this._createNextBeans();
    return true;
  }

  // ---- Click handler ----
  _onCellClick(r, c) {
    if (this.animating || this.gameOver) return;

    const beanType = this.map[r][c];

    if (this.selected === null) {
      // Nothing selected yet
      if (beanType > 0) {
        this._selectCell(r, c);
      }
    } else {
      const { row: sr, col: sc } = this.selected;
      if (r === sr && c === sc) {
        // Deselect same cell
        this._deselectAll();
      } else if (beanType > 0) {
        // Select a different bean
        this._deselectAll();
        this._selectCell(r, c);
      } else {
        // Empty cell → try to move
        this._deselectAll();
        this._moveBean(sr, sc, r, c);
      }
    }
  }

  _selectCell(r, c) {
    this.selected = { row: r, col: c };
    this.cells[r][c].classList.add('selected');
  }

  _deselectAll() {
    if (this.selected) {
      const { row, col } = this.selected;
      this.cells[row][col].classList.remove('selected');
    }
    // clear path highlights
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        this.cells[r][c].classList.remove('path-highlight');
    this.selected = null;
  }

  // ---- Move bean ----
  _moveBean(sr, sc, tr, tc) {
    const finder = new AStarPathFinder();
    finder.readMap(this.map, sr, sc, tr, tc);
    finder.pathfind();
    const path = finder.getPath();

    if (path.length === 0) {
      this._showMessage('無效路徑', true);
      return;
    }

    // Update virtual map immediately
    const beanType = this.map[sr][sc];
    this.map[sr][sc] = 0;
    this.map[tr][tc] = beanType;

    this._animateMove(path, beanType, () => {
      // Animation done — check chain at target
      if (this._checkChain(tr, tc)) {
        this._removeChainAnimated(() => {
          this.animating = false;
        });
      } else {
        const ok = this._putNextBeans();
        this.animating = false;
        if (!ok) {
          this._storeScore();
          this._showGameOver();
        }
      }
    });
  }

  // ---- Animation: move along path ----
  _animateMove(path, beanType, onDone) {
    this.animating = true;

    // Hide source cell bean during animation
    const src = path[0];
    this._renderCell(src.row, src.col); // clear source (map already updated to 0)

    const movingEl = document.getElementById('moving-bean');
    movingEl.className = `bean bean-${beanType}`;
    movingEl.style.display = 'block';

    const cellSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size')) || 46;
    movingEl.style.width  = cellSize * 0.86 + 'px';
    movingEl.style.height = cellSize * 0.86 + 'px';

    // Place at the starting cell immediately, without transition, to avoid the flash
    const srcEl = this.cells[path[0].row][path[0].col];
    const srcRect = srcEl.getBoundingClientRect();
    movingEl.style.transition = 'none';
    movingEl.style.left = srcRect.left + 'px';
    movingEl.style.top  = srcRect.top  + 'px';
    // Force reflow so the position above is committed before we re-enable transition
    movingEl.getBoundingClientRect();
    movingEl.style.transition = '';

    let stepIndex = 1; // start from index 1, already placed at index 0

    const step = () => {
      if (stepIndex >= path.length) {
        movingEl.style.display = 'none';
        // Render arrival bean
        const dst = path[path.length - 1];
        this._renderCell(dst.row, dst.col, 'bean-arrival');
        onDone();
        return;
      }

      const { row, col } = path[stepIndex];
      const cellEl = this.cells[row][col];
      const rect = cellEl.getBoundingClientRect();
      movingEl.style.left = rect.left + 'px';
      movingEl.style.top  = rect.top  + 'px';

      stepIndex++;
      setTimeout(step, 55);
    };

    step();
  }

  // ---- Chain detection ----
  // Returns true and populates this._chain if ≥5 found
  _checkChain(r, c) {
    const targetType = this.map[r][c];
    if (!targetType) return false;

    const chainSet = new Set();

    const check = (positions) => {
      // Find consecutive runs of targetType
      let run = [];
      for (const pos of positions) {
        if (this.map[pos.r][pos.c] === targetType) {
          run.push(pos);
        } else {
          if (run.length >= CHAIN_MIN) run.forEach(p => chainSet.add(`${p.r},${p.c}`));
          run = [];
        }
      }
      if (run.length >= CHAIN_MIN) run.forEach(p => chainSet.add(`${p.r},${p.c}`));
    };

    // Horizontal: scan full row r
    {
      const row = [];
      for (let c2 = 0; c2 < COLS; c2++) row.push({ r, c: c2 });
      check(row);
    }

    // Vertical: scan full col c
    {
      const col = [];
      for (let r2 = 0; r2 < ROWS; r2++) col.push({ r: r2, c });
      check(col);
    }

    // Diagonal ↘ (r+i, c+i)
    {
      const diag = [];
      for (let i = -Math.max(ROWS, COLS); i < Math.max(ROWS, COLS); i++) {
        const nr = r + i, nc = c + i;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) diag.push({ r: nr, c: nc });
      }
      check(diag);
    }

    // Anti-diagonal ↙ (r+i, c-i)
    {
      const adiag = [];
      for (let i = -Math.max(ROWS, COLS); i < Math.max(ROWS, COLS); i++) {
        const nr = r + i, nc = c - i;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) adiag.push({ r: nr, c: nc });
      }
      check(adiag);
    }

    if (chainSet.size > 0) {
      chainSet.add(`${r},${c}`); // always include the placed bean
      this._chain = [...chainSet].map(s => {
        const [cr, cc] = s.split(',').map(Number);
        return { row: cr, col: cc };
      });
      return true;
    }
    return false;
  }

  _removeChain() {
    if (!this._chain) return;
    for (const { row, col } of this._chain) {
      this.map[row][col] = 0;
      this._renderCell(row, col);
    }
    this._addScore(this._chain.length);
    this._chain = null;
  }

  _removeChainAnimated(onDone) {
    if (!this._chain) { onDone(); return; }
    const chain = this._chain;
    this._chain = null;

    // Clear map immediately so pathfinding is correct
    for (const { row, col } of chain) {
      this.map[row][col] = 0;
    }

    // Force a reflow once, then add all classes in the same frame
    // so every bean starts the animation at exactly the same time
    void this.boardEl.offsetWidth;
    for (const { row, col } of chain) {
      const bean = this.cells[row][col].querySelector('.bean');
      if (bean) {
        bean.style.animation = 'bean-disappear 0.18s ease forwards';
      }
    }

    setTimeout(() => {
      for (const { row, col } of chain) {
        this._renderCell(row, col);
      }
      this._addScore(chain.length);
      onDone();
    }, 200);
  }

  // ---- Messages ----
  _showMessage(text, autoHide, subText, showNewGame) {
    const box = document.getElementById('message-box');
    const txt = document.getElementById('message-text');
    const sub = document.getElementById('message-sub');
    const newBtn = document.getElementById('btn-msg-newgame');

    txt.textContent = text;
    sub.textContent = subText || '';
    newBtn.style.display = showNewGame ? 'inline-block' : 'none';

    box.classList.remove('hide');
    box.classList.add('show');

    if (autoHide) {
      setTimeout(() => this._hideMessage(), 1200);
    }
  }

  _hideMessage() {
    const box = document.getElementById('message-box');
    box.classList.remove('show');
    box.classList.add('hide');
    box.addEventListener('animationend', () => {
      box.style.transform = 'scale(0)';
      box.classList.remove('hide');
    }, { once: true });
  }

  _showGameOver() {
    this.gameOver = true;
    this._showMessage('遊戲結束', false, `得分：${this.score}`, true);
  }
}

// ===== Boot =====
let game;

document.addEventListener('DOMContentLoaded', () => {
  const boardEl  = document.getElementById('game-board');
  const scoreEl  = document.getElementById('score-display');
  const nextEls  = [
    document.getElementById('next-0'),
    document.getElementById('next-1'),
    document.getElementById('next-2'),
  ];

  game = new BeansGame(boardEl, scoreEl, nextEls);

  document.getElementById('btn-newgame').addEventListener('click', () => {
    game._hideMessage();
    game.newGame();
  });

  document.getElementById('btn-back').addEventListener('click', () => {
    location.href = 'index.html';
  });

  document.getElementById('btn-msg-newgame').addEventListener('click', () => {
    game._hideMessage();
    setTimeout(() => game.newGame(), 250);
  });

  // Responsive cell size
  function resize() {
    const boardWrap = document.getElementById('board-wrap');
    const ww = boardWrap.clientWidth  - 24;
    const wh = boardWrap.clientHeight - 24;
    const byW = Math.floor(ww / COLS);
    const byH = Math.floor(wh / ROWS);
    const size = Math.max(28, Math.min(byW, byH, 52));
    document.documentElement.style.setProperty('--cell-size', size + 'px');
    boardEl.style.gridTemplateColumns = `repeat(${COLS}, ${size}px)`;
  }

  window.addEventListener('resize', resize);
  resize();
});
