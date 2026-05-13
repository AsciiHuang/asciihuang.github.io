// ===== Parse params =====
const params = new URLSearchParams(location.search);
const level = Math.max(1, Math.min(6, parseInt(params.get('level')) || 3));
const ROWS = level * 15;
const COLS = Math.round(ROWS * 9 / 16);

// ===== Maze generation (Prim's algorithm) =====
function generateMaze(rows, cols) {
  const N = 1, S = 2, E = 4, W = 8;
  const DX = { [E]: 1, [W]: -1, [N]: 0, [S]: 0 };
  const DY = { [N]: -1, [S]: 1, [E]: 0, [W]: 0 };
  const OPPOSITE = { [N]: S, [S]: N, [E]: W, [W]: E };
  const DIRS = [N, S, E, W];

  const grid = [];
  for (let y = 0; y < rows; y++) {
    grid.push(new Uint8Array(cols));
  }

  const inMaze = [];
  for (let y = 0; y < rows; y++) {
    inMaze.push(new Uint8Array(cols));
  }

  const frontier = [];

  function addFrontier(x, y) {
    for (const dir of DIRS) {
      const nx = x + DX[dir];
      const ny = y + DY[dir];
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !inMaze[ny][nx]) {
        frontier.push({ x: nx, y: ny, fromX: x, fromY: y, dir });
      }
    }
  }

  inMaze[0][0] = 1;
  addFrontier(0, 0);

  while (frontier.length > 0) {
    const idx = Math.floor(Math.random() * frontier.length);
    const { x, y, fromX, fromY, dir } = frontier[idx];
    frontier[idx] = frontier[frontier.length - 1];
    frontier.pop();

    if (inMaze[y][x]) continue;

    inMaze[y][x] = 1;
    grid[fromY][fromX] |= dir;
    grid[y][x] |= OPPOSITE[dir];

    addFrontier(x, y);
  }

  return { grid, rows, cols, N, S, E, W };
}

// ===== Multi-segment maze generation =====
function generateMultiSegmentMaze(totalRows, totalCols) {
  const segments = level <= 3 ? 2 : 3;
  const segRows = Math.floor(totalRows / segments);

  function randZoneX() {
    const zone = Math.floor(Math.random() * 3);
    const third = Math.floor(totalCols / 3);
    const base = zone * third;
    return base + Math.floor(Math.random() * third);
  }

  const points = [];
  for (let i = 0; i <= segments; i++) {
    points.push(randZoneX());
  }

  for (let i = 1; i <= segments; i++) {
    const third = Math.floor(totalCols / 3);
    const prevZone = Math.floor(points[i - 1] / third);
    let tries = 0;
    while (Math.floor(points[i] / third) === prevZone && tries < 20) {
      points[i] = randZoneX();
      tries++;
    }
  }

  const segMazes = [];
  for (let s = 0; s < segments; s++) {
    const rows = (s === segments - 1) ? totalRows - s * segRows : segRows;
    segMazes.push(generateMaze(rows, totalCols));
  }

  const N = 1, S = 2, E = 4, W = 8;
  const grid = [];
  for (let y = 0; y < totalRows; y++) {
    grid.push(new Uint8Array(totalCols));
  }

  let rowOffset = 0;
  for (let s = 0; s < segments; s++) {
    const seg = segMazes[s];
    for (let y = 0; y < seg.rows; y++) {
      for (let x = 0; x < totalCols; x++) {
        grid[rowOffset + y][x] = seg.grid[y][x];
      }
    }
    rowOffset += seg.rows;
  }

  rowOffset = 0;
  for (let s = 0; s < segments - 1; s++) {
    const junctionRow = rowOffset + segMazes[s].rows - 1;
    const jx = points[s + 1];
    grid[junctionRow][jx] |= S;
    grid[junctionRow + 1][jx] |= N;

    const extraCount = Math.max(2, Math.floor(totalCols * 0.2));
    const candidates = [];
    for (let x = 0; x < totalCols; x++) {
      if (x !== jx) candidates.push(x);
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const extras = candidates.slice(0, extraCount);
    for (const ex of extras) {
      grid[junctionRow][ex] |= S;
      grid[junctionRow + 1][ex] |= N;
    }

    for (let x = 0; x < totalCols; x++) {
      if (grid[junctionRow][x] & S) continue;
      const leftClosed = (x > 0) && !(grid[junctionRow][x - 1] & S);
      const rightClosed = (x < totalCols - 1) && !(grid[junctionRow][x + 1] & S);
      if (!leftClosed && !rightClosed) {
        grid[junctionRow][x] |= S;
        grid[junctionRow + 1][x] |= N;
      }
    }

    rowOffset += segMazes[s].rows;
  }

  const startCell = { x: points[0], y: 0 };
  const endCell = { x: points[segments], y: totalRows - 1 };

  return { grid, rows: totalRows, cols: totalCols, N, S, E, W, startCell, endCell };
}

// ===== Global game state =====
let currentMaze = null;
let startCell = { x: 0, y: 0 };
let endCell = { x: 0, y: 0 };
let wallSize = 2;
let cellSize = 10;
let mazeCanvas = null;
let hintCanvas = null;
let pathCanvas = null;
let path = [];

// ===== Render static maze to canvas =====
function renderMaze(maze) {
  const { grid, rows, cols, N, S, E, W } = maze;

  const maxW = window.innerWidth - 16 - 20;
  const maxH = window.innerHeight - 60 - 20 - 20;

  wallSize = level <= 3 ? 2 : 1;

  const cellByW = Math.floor((maxW - wallSize * (cols + 1)) / cols);
  const cellByH = Math.floor((maxH - wallSize * (rows + 1)) / rows);
  cellSize = Math.max(2, Math.min(cellByW, cellByH));

  const canvasW = wallSize + cols * (cellSize + wallSize);
  const canvasH = wallSize + rows * (cellSize + wallSize);

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.fillStyle = '#fff5eb';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = wallSize + x * (cellSize + wallSize);
      const py = wallSize + y * (cellSize + wallSize);
      ctx.fillRect(px, py, cellSize, cellSize);
      if (grid[y][x] & E) ctx.fillRect(px + cellSize, py, wallSize, cellSize);
      if (grid[y][x] & S) ctx.fillRect(px, py + cellSize, cellSize, wallSize);
      if ((grid[y][x] & S) && (grid[y][x] & E) &&
          x + 1 < cols && (grid[y + 1][x] & E || grid[y][x + 1] & S)) {
        ctx.fillRect(px + cellSize, py + cellSize, wallSize, wallSize);
      }
    }
  }

  // Entrance opening
  ctx.fillStyle = '#fff5eb';
  const startPx = wallSize + startCell.x * (cellSize + wallSize);
  ctx.fillRect(startPx, 0, cellSize, wallSize);

  // Exit opening
  const endPx = wallSize + endCell.x * (cellSize + wallSize);
  const endPy = wallSize + endCell.y * (cellSize + wallSize);
  ctx.fillRect(endPx, endPy + cellSize, cellSize, wallSize);

  // Exit arrow
  const exitArrowSize = Math.max(2, cellSize * 0.35);
  const exitArrowX = endPx + cellSize / 2;
  const exitArrowCenterY = endPy + cellSize / 2;
  ctx.fillStyle = '#e83030';
  ctx.beginPath();
  ctx.moveTo(exitArrowX, exitArrowCenterY + exitArrowSize);
  ctx.lineTo(exitArrowX - exitArrowSize * 0.8, exitArrowCenterY - exitArrowSize * 0.5);
  ctx.lineTo(exitArrowX + exitArrowSize * 0.8, exitArrowCenterY - exitArrowSize * 0.5);
  ctx.closePath();
  ctx.fill();

  return canvas;
}

// ===== Cell pixel center =====
function cellCenter(cx, cy) {
  return {
    px: wallSize + cx * (cellSize + wallSize) + cellSize / 2,
    py: wallSize + cy * (cellSize + wallSize) + cellSize / 2,
  };
}

// ===== Draw path overlay =====
function drawPath() {
  const ctx = pathCanvas.getContext('2d');
  ctx.clearRect(0, 0, pathCanvas.width, pathCanvas.height);

  if (path.length === 0) return;

  const lineWidth = Math.max(1, cellSize * 0.5);

  ctx.strokeStyle = 'rgba(232, 48, 48, 0.6)';
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  const first = cellCenter(path[0].x, path[0].y);
  ctx.moveTo(first.px, first.py);
  for (let i = 1; i < path.length; i++) {
    const p = cellCenter(path[i].x, path[i].y);
    ctx.lineTo(p.px, p.py);
  }
  ctx.stroke();

  // Draw ball at current position
  const cur = path[path.length - 1];
  const { px, py } = cellCenter(cur.x, cur.y);
  const ballRadius = Math.max(2, cellSize * 0.32);

  ctx.beginPath();
  ctx.arc(px, py, ballRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#e83030';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(px - ballRadius * 0.25, py - ballRadius * 0.25, ballRadius * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();
}

// ===== Check if passage exists between two adjacent cells =====
function canPass(x1, y1, x2, y2) {
  const { grid, N, S, E, W } = currentMaze;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 1 && dy === 0) return !!(grid[y1][x1] & E);
  if (dx === -1 && dy === 0) return !!(grid[y1][x1] & W);
  if (dx === 0 && dy === 1) return !!(grid[y1][x1] & S);
  if (dx === 0 && dy === -1) return !!(grid[y1][x1] & N);
  return false;
}

// ===== Walk a straight segment =====
function walkSegment(fromX, fromY, toX, toY) {
  if (fromX !== toX && fromY !== toY) return null;
  if (fromX === toX && fromY === toY) return [];

  const steps = [];
  let cx = fromX, cy = fromY;
  const dx = Math.sign(toX - fromX);
  const dy = Math.sign(toY - fromY);

  while (cx !== toX || cy !== toY) {
    const nx = cx + dx;
    const ny = cy + dy;
    if (!canPass(cx, cy, nx, ny)) return null;
    steps.push({ x: nx, y: ny });
    cx = nx;
    cy = ny;
  }

  return steps;
}

// ===== Try straight, 1-turn (L), or 2-turn (Z/S) path =====
function tryWalkPath(fromX, fromY, toX, toY) {
  if (fromX === toX && fromY === toY) return null;

  const straight = walkSegment(fromX, fromY, toX, toY);
  if (straight) return straight;

  // 1 turn (L-shape)
  const h1 = walkSegment(fromX, fromY, toX, fromY);
  if (h1) {
    const v1 = walkSegment(toX, fromY, toX, toY);
    if (v1) return [...h1, ...v1];
  }
  const v2 = walkSegment(fromX, fromY, fromX, toY);
  if (v2) {
    const h2 = walkSegment(fromX, toY, toX, toY);
    if (h2) return [...v2, ...h2];
  }

  // 2 turns (Z/S-shape) - Pattern A: H → V → H
  {
    const minX = Math.min(fromX, toX);
    const maxX = Math.max(fromX, toX);
    for (let midX = minX; midX <= maxX; midX++) {
      if (midX === fromX && midX === toX) continue;
      const s1 = walkSegment(fromX, fromY, midX, fromY);
      if (!s1) continue;
      const s2 = walkSegment(midX, fromY, midX, toY);
      if (!s2) continue;
      const s3 = walkSegment(midX, toY, toX, toY);
      if (!s3) continue;
      return [...s1, ...s2, ...s3];
    }
  }

  // Pattern B: V → H → V
  {
    const minY = Math.min(fromY, toY);
    const maxY = Math.max(fromY, toY);
    for (let midY = minY; midY <= maxY; midY++) {
      if (midY === fromY && midY === toY) continue;
      const s1 = walkSegment(fromX, fromY, fromX, midY);
      if (!s1) continue;
      const s2 = walkSegment(fromX, midY, toX, midY);
      if (!s2) continue;
      const s3 = walkSegment(toX, midY, toX, toY);
      if (!s3) continue;
      return [...s1, ...s2, ...s3];
    }
  }

  return null;
}

// ===== Hint: find straight dead-ends =====
function findStraightDeadEnds(maze) {
  const { grid, rows, cols, N, S, E, W } = maze;
  const DIRS = [N, S, E, W];
  const deadCells = new Set();

  function openings(x, y) {
    let count = 0;
    for (const d of DIRS) {
      if (grid[y][x] & d) count++;
    }
    return count;
  }

  const tips = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (x === startCell.x && y === startCell.y) continue;
      if (x === endCell.x && y === endCell.y) continue;
      if (openings(x, y) === 1) tips.push({ x, y });
    }
  }

  const DX = { [E]: 1, [W]: -1, [N]: 0, [S]: 0 };
  const DY = { [N]: -1, [S]: 1, [E]: 0, [W]: 0 };

  for (const tip of tips) {
    let cx = tip.x, cy = tip.y;
    const chain = [{ x: cx, y: cy }];

    let enterDir = null;
    for (const d of DIRS) {
      if (grid[cy][cx] & d) { enterDir = d; break; }
    }

    const dir = enterDir;
    while (true) {
      const nx = cx + DX[dir];
      const ny = cy + DY[dir];

      if (!(grid[cy][cx] & dir)) break;

      cx = nx;
      cy = ny;

      if (cx === startCell.x && cy === startCell.y) break;
      if (cx === endCell.x && cy === endCell.y) break;

      const op = openings(cx, cy);
      if (op > 2) break;
      if (op === 2) {
        chain.push({ x: cx, y: cy });
        if (!(grid[cy][cx] & dir)) break;
      } else {
        chain.push({ x: cx, y: cy });
        break;
      }
    }

    for (const c of chain) {
      deadCells.add(`${c.x},${c.y}`);
    }
  }

  return deadCells;
}

// ===== Draw dead cells on hint canvas =====
function fillDeadCells(deadCells) {
  if (!currentMaze || !hintCanvas) return;
  const { grid, rows, cols, N, S, E, W } = currentMaze;
  const ctx = hintCanvas.getContext('2d');

  const DIRS = [N, S, E, W];

  ctx.fillStyle = '#1a1a1a';

  for (const key of deadCells) {
    const [x, y] = key.split(',').map(Number);
    const px = wallSize + x * (cellSize + wallSize);
    const py = wallSize + y * (cellSize + wallSize);

    ctx.fillRect(px, py, cellSize, cellSize);

    for (const d of DIRS) {
      if (!(grid[y][x] & d)) continue;
      if (d === E) ctx.fillRect(px + cellSize, py, wallSize, cellSize);
      if (d === S) ctx.fillRect(px, py + cellSize, cellSize, wallSize);
      if (d === W) ctx.fillRect(px - wallSize, py, wallSize, cellSize);
      if (d === N) ctx.fillRect(px, py - wallSize, cellSize, wallSize);
    }
  }

  // Fill corner dots
  for (let cy = 0; cy <= rows; cy++) {
    for (let cx = 0; cx <= cols; cx++) {
      const tl = (cx > 0 && cy > 0) && deadCells.has(`${cx-1},${cy-1}`);
      const tr = (cx < cols && cy > 0) && deadCells.has(`${cx},${cy-1}`);
      const bl = (cx > 0 && cy < rows) && deadCells.has(`${cx-1},${cy}`);
      const br = (cx < cols && cy < rows) && deadCells.has(`${cx},${cy}`);

      if ((tl && br) || (tr && bl) || (tl && tr) || (tl && bl) || (tr && br) || (bl && br)) {
        const cpx = cx * (cellSize + wallSize);
        const cpy = cy * (cellSize + wallSize);
        ctx.fillRect(cpx, cpy, wallSize, wallSize);
      }
    }
  }
}

function drawHint1() {
  if (!currentMaze) return;
  const ctx = hintCanvas.getContext('2d');
  ctx.clearRect(0, 0, hintCanvas.width, hintCanvas.height);
  fillDeadCells(findStraightDeadEnds(currentMaze));
}

// ===== Find straight dead-ends treating blocked cells as walls =====
function findStraightDeadEndsWithBlocked(maze, blocked) {
  const { grid, rows, cols, N, S, E, W } = maze;
  const DIRS = [N, S, E, W];
  const DX = { [E]: 1, [W]: -1, [N]: 0, [S]: 0 };
  const DY = { [N]: -1, [S]: 1, [E]: 0, [W]: 0 };
  const deadCells = new Set();

  function openings(x, y) {
    let count = 0;
    for (const d of DIRS) {
      if (!(grid[y][x] & d)) continue;
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (!blocked.has(`${nx},${ny}`)) count++;
    }
    return count;
  }

  const tips = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (blocked.has(`${x},${y}`)) continue;
      if (x === startCell.x && y === startCell.y) continue;
      if (x === endCell.x && y === endCell.y) continue;
      if (openings(x, y) === 1) tips.push({ x, y });
    }
  }

  for (const tip of tips) {
    let cx = tip.x, cy = tip.y;
    const chain = [{ x: cx, y: cy }];

    let prevDir = null;
    for (const d of DIRS) {
      if (!(grid[cy][cx] & d)) continue;
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      if (!blocked.has(`${nx},${ny}`)) { prevDir = d; break; }
    }
    if (!prevDir) { deadCells.add(`${cx},${cy}`); continue; }

    while (true) {
      if (!(grid[cy][cx] & prevDir)) break;
      const nx = cx + DX[prevDir];
      const ny = cy + DY[prevDir];
      if (blocked.has(`${nx},${ny}`)) break;

      cx = nx;
      cy = ny;

      if (cx === startCell.x && cy === startCell.y) break;
      if (cx === endCell.x && cy === endCell.y) break;

      const op = openings(cx, cy);
      if (op > 2) break;

      chain.push({ x: cx, y: cy });
      if (op === 1) break;

      if (!(grid[cy][cx] & prevDir)) break;
    }

    for (const c of chain) {
      deadCells.add(`${c.x},${c.y}`);
    }
  }

  return deadCells;
}

// ===== Draw hint 2 =====
function drawHint2() {
  if (!currentMaze) return;
  const ctx = hintCanvas.getContext('2d');
  ctx.clearRect(0, 0, hintCanvas.width, hintCanvas.height);

  const pass1 = findStraightDeadEnds(currentMaze);
  fillDeadCells(pass1);

  const pass2 = findStraightDeadEndsWithBlocked(currentMaze, pass1);
  fillDeadCells(pass2);
}

// ===== Answer =====
function drawAnswer() {
  if (!currentMaze) return;
  const ctx = hintCanvas.getContext('2d');
  ctx.clearRect(0, 0, hintCanvas.width, hintCanvas.height);

  let blocked = new Set();
  while (true) {
    const newDead = findStraightDeadEndsWithBlocked(currentMaze, blocked);
    if (newDead.size === 0) break;
    for (const key of newDead) {
      blocked.add(key);
    }
  }
  fillDeadCells(blocked);
}

// ===== Boot =====
function run(onReady) {
  const container = document.getElementById('maze-container');
  container.innerHTML = '<div class="loading" id="loading">產生迷宮中...</div>';

  setTimeout(() => {
    currentMaze = generateMultiSegmentMaze(ROWS, COLS);
    startCell = currentMaze.startCell;
    endCell = currentMaze.endCell;
    mazeCanvas = renderMaze(currentMaze);

    hintCanvas = document.createElement('canvas');
    hintCanvas.width = mazeCanvas.width;
    hintCanvas.height = mazeCanvas.height;
    hintCanvas.style.position = 'absolute';
    hintCanvas.style.left = '0';
    hintCanvas.style.top = '0';
    hintCanvas.style.pointerEvents = 'none';

    pathCanvas = document.createElement('canvas');
    pathCanvas.width = mazeCanvas.width;
    pathCanvas.height = mazeCanvas.height;
    pathCanvas.style.position = 'absolute';
    pathCanvas.style.left = '0';
    pathCanvas.style.top = '0';

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.appendChild(mazeCanvas);
    wrapper.appendChild(hintCanvas);
    wrapper.appendChild(pathCanvas);

    const frame = document.createElement('div');
    frame.className = 'maze-frame';
    frame.appendChild(wrapper);

    container.innerHTML = '';
    container.appendChild(frame);

    path = [{ x: startCell.x, y: startCell.y }];
    drawPath();

    if (onReady) onReady();
  }, 50);
}

// ===== Show win overlay =====
function showWin() {
  setTimeout(() => document.getElementById('win-overlay').classList.add('show'), 100);
}

// ===== Event listeners =====
document.getElementById('btn-regenerate').addEventListener('click', () => {
  // Each page sets window._mazeOnReady
  run(window._mazeOnReady);
});
document.getElementById('btn-hint1').addEventListener('click', () => drawHint1());
document.getElementById('btn-hint2').addEventListener('click', () => drawHint2());
document.getElementById('btn-answer').addEventListener('click', () => drawAnswer());
