// ─── Image pool (30 items, matching Android CardContentCreater) ───────────────
const IMAGES = [
  'vespa',     // index 0 (default)
  'alarm',     // 1
  'bed',       // 2
  'bird',      // 3
  'book',      // 4
  'cap',       // 5
  'cleanser',  // 6
  'clothes',   // 7
  'coco',      // 8
  'cracers',   // 9
  'dinosaur',  // 10
  'drink',     // 11
  'fan',       // 12
  'fishjar',   // 13
  'icebox',    // 14
  'jellyfish', // 15
  'knife',     // 16
  'lollipop',  // 17
  'mug',       // 18
  'notebook',  // 19
  'postbox',   // 20
  'radio',     // 21
  'rainy',     // 22
  'rocket',    // 23
  'shark',     // 24
  'skeleton',  // 25
  'taipei',    // 26
  'tank',      // 27
  'toaster',   // 28
  'tv',        // 29
];

const GAME_TIME = 99;

// ─── Board layouts (mirrors board_a/b/c/d.xml) ────────────────────────────────
// slots[i] = grid-area for card index i ("rowStart/colStart/rowEnd/colEnd")
// Rows use a 6-row grid so fractional weights stay integer-friendly.
// large: true = 大格子 (size 90–100%), false = 小格子 (size 70–100%)
const LAYOUTS = [
  {
    // A: cols 3:4:3 | left: 3 equal | centre: top 60% / bottom 40% | right: 3 equal
    cols: '3fr 4fr 3fr',
    rows: '1fr 1fr 1fr 1fr 1fr 1fr',
    slots: [
      { area: '1/1/3/2', large: false }, // 0 A
      { area: '3/1/5/2', large: false }, // 1 B
      { area: '5/1/7/2', large: false }, // 2 C
      { area: '1/2/5/3', large: true  }, // 3 D – centre big
      { area: '5/2/7/3', large: false }, // 4 E – centre small
      { area: '1/3/3/4', large: false }, // 5 F
      { area: '3/3/5/4', large: false }, // 6 G
      { area: '5/3/7/4', large: false }, // 7 H
    ],
  },
  {
    // B: cols 3:4:3 | centre: top 40% / bottom 60%
    cols: '3fr 4fr 3fr',
    rows: '1fr 1fr 1fr 1fr 1fr 1fr',
    slots: [
      { area: '1/1/3/2', large: false }, // 0 A
      { area: '3/1/5/2', large: false }, // 1 B
      { area: '5/1/7/2', large: false }, // 2 C
      { area: '1/2/3/3', large: false }, // 3 D – centre small
      { area: '3/2/7/3', large: true  }, // 4 E – centre big
      { area: '1/3/3/4', large: false }, // 5 F
      { area: '3/3/5/4', large: false }, // 6 G
      { area: '5/3/7/4', large: false }, // 7 H
    ],
  },
  {
    // C: cols 3:3:4 | left: 3 equal | centre: 3 equal | right: 2 large
    cols: '3fr 3fr 4fr',
    rows: '1fr 1fr 1fr 1fr 1fr 1fr',
    slots: [
      { area: '1/1/3/2', large: false }, // 0 A
      { area: '3/1/5/2', large: false }, // 1 B
      { area: '5/1/7/2', large: false }, // 2 C
      { area: '1/2/3/3', large: false }, // 3 D
      { area: '3/2/5/3', large: false }, // 4 E
      { area: '5/2/7/3', large: false }, // 5 F
      { area: '1/3/4/4', large: true  }, // 6 G – right top large
      { area: '4/3/7/4', large: true  }, // 7 H – right bot large
    ],
  },
  {
    // D: cols 4:3:3 | left: 2 large | centre: 3 equal | right: 3 equal
    cols: '4fr 3fr 3fr',
    rows: '1fr 1fr 1fr 1fr 1fr 1fr',
    slots: [
      { area: '1/1/4/2', large: true  }, // 0 A – left top large
      { area: '4/1/7/2', large: true  }, // 1 B – left bot large
      { area: '1/2/3/3', large: false }, // 2 C
      { area: '3/2/5/3', large: false }, // 3 D
      { area: '5/2/7/3', large: false }, // 4 E
      { area: '1/3/3/4', large: false }, // 5 F
      { area: '3/3/5/4', large: false }, // 6 G
      { area: '5/3/7/4', large: false }, // 7 H
    ],
  },
];

// ─── State ────────────────────────────────────────────────────────────────────
let playerScore = 0;
let challengerScore = 0;
let timeLeft = GAME_TIME;
let timerInterval = null;
let playerBlocked = false;    // true while answer animation plays
let challengerBlocked = false;
let playerTarget = 0;
let challengerTarget = 0;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const tutorialOverlay  = document.getElementById('tutorial-overlay');
const resultOverlay    = document.getElementById('result-overlay');
const btnStart         = document.getElementById('btn-start');
const btnNewGame       = document.getElementById('btn-new-game');
const timerRingBar     = document.getElementById('timer-ring-bar');
const playerCountEl    = document.getElementById('player-count');
const challengerCountEl= document.getElementById('challenger-count');
const playerBoard      = document.getElementById('player-board');
const challengerBoard  = document.getElementById('challenger-board');
const resultPlayerScore    = document.getElementById('result-player-score');
const resultChallengerScore= document.getElementById('result-challenger-score');
const resultWinner     = document.getElementById('result-winner');


// ─── Helpers ──────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randInt(n) {
  return Math.floor(Math.random() * n);
}

function imgSrc(name) {
  return `images/${name}.png`;
}

// ─── Content generation ───────────────────────────────────────────────────────
// Rule: exactly 1 image is shared between both boards (the target).
// Each board has 7 unique decoys that never appear on the other board.
// Total distinct images used per round: 1 + 7 + 7 = 15.
function createNewGame() {
  // Shuffle all 30 indices and take the first 15
  const pool = shuffle(Array.from({ length: 30 }, (_, i) => i)).slice(0, 15);

  const targetImgIndex       = pool[0];          // shared target
  const playerDecoyIndices   = pool.slice(1, 8); // 7 decoys for player
  const challengerDecoyIndices = pool.slice(8, 15); // 7 different decoys for challenger

  const playerTargetSlot     = randInt(8);
  const challengerTargetSlot = randInt(8);

  function buildBoard(targetSlot, decoyIndices) {
    const board = new Array(8);
    board[targetSlot] = IMAGES[targetImgIndex];
    const decoyPool = shuffle(decoyIndices);
    let d = 0;
    for (let i = 0; i < 8; i++) {
      if (board[i] === undefined) board[i] = IMAGES[decoyPool[d++]];
    }
    return { board, targetSlot };
  }

  const player     = buildBoard(playerTargetSlot, playerDecoyIndices);
  const challenger = buildBoard(challengerTargetSlot, challengerDecoyIndices);

  return { player, challenger };
}

// ─── Board rendering ──────────────────────────────────────────────────────────
function renderBoard(container, boardData, onCorrect, onWrong) {
  container.innerHTML = '';

  // Pick a random layout and apply grid structure
  const layout = LAYOUTS[randInt(LAYOUTS.length)];
  container.style.gridTemplateColumns = layout.cols;
  container.style.gridTemplateRows = layout.rows;

  boardData.board.forEach((imgName, index) => {
    const btn = document.createElement('div');
    btn.className = 'card-btn';
    const slot = layout.slots[index];
    btn.style.gridArea = slot.area;

    const img = document.createElement('img');
    img.src = imgSrc(imgName);
    img.alt = imgName;
    const rotation = randInt(360);
    const size = slot.large ? 90 + randInt(11) : 70 + randInt(31); // large: 90–100%, small: 70–100%
    const maxOffset = (100 - size) / 2;
    const dx = (Math.random() * 2 - 1) * maxOffset;
    const dy = (Math.random() * 2 - 1) * maxOffset;
    img.style.transform = `translate(${dx}%, ${dy}%) rotate(${rotation}deg)`;
    img.style.width = `${size}%`;
    img.style.height = `${size}%`;

    btn.appendChild(img);
    btn.addEventListener('click', () => {
      if (index === boardData.targetSlot) {
        onCorrect(btn, container);
      } else {
        onWrong(btn);
      }
    });
    container.appendChild(btn);
  });
}

// ─── Answer highlight ─────────────────────────────────────────────────────────
function highlightCorrect(container, targetSlot, callback) {
  const cards = container.querySelectorAll('.card-btn');
  const target = cards[targetSlot];
  target.classList.add('correct');
  setTimeout(() => {
    target.classList.remove('correct');
    if (callback) callback();
  }, 600);
}

// ─── Score updates ────────────────────────────────────────────────────────────
function popCount(el) {
  el.classList.remove('pop');
  // Force reflow
  void el.offsetWidth;
  el.classList.add('pop');
}

function setPlayerScore(val) {
  playerScore = Math.max(0, val);
  playerCountEl.textContent = playerScore;
  popCount(playerCountEl);
}

function setChallengerScore(val) {
  challengerScore = Math.max(0, val);
  challengerCountEl.textContent = challengerScore;
  popCount(challengerCountEl);
}

// ─── Round management ─────────────────────────────────────────────────────────
let currentGame = null;

function loadRound() {
  playerBlocked = false;
  challengerBlocked = false;
  currentGame = createNewGame();

  renderBoard(
    playerBoard,
    currentGame.player,
    // Correct
    (btn, container) => {
      if (playerBlocked) return;
      playerBlocked = true;
      setPlayerScore(playerScore + 1);
      // Show answer on challenger's side too
      highlightCorrect(challengerBoard, currentGame.challenger.targetSlot, () => {
        loadRound();
      });
      highlightCorrect(playerBoard, currentGame.player.targetSlot, null);
    },
    // Wrong
    (btn) => {
      if (playerBlocked) return;
      setPlayerScore(playerScore - 1);
      btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 300);
    }
  );

  renderBoard(
    challengerBoard,
    currentGame.challenger,
    // Correct
    (btn, container) => {
      if (challengerBlocked) return;
      challengerBlocked = true;
      setChallengerScore(challengerScore + 1);
      highlightCorrect(playerBoard, currentGame.player.targetSlot, () => {
        loadRound();
      });
      highlightCorrect(challengerBoard, currentGame.challenger.targetSlot, null);
    },
    // Wrong
    (btn) => {
      if (challengerBlocked) return;
      setChallengerScore(challengerScore - 1);
      btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 300);
    }
  );
}

// ─── Timer ────────────────────────────────────────────────────────────────────
const RING_CIRCUMFERENCE = 2 * Math.PI * 17; // ≈ 106.81

function updateTimerUI(t) {
  const ratio = Math.max(0, t) / GAME_TIME;
  timerRingBar.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - ratio);
  timerRingBar.classList.toggle('urgent', t <= 10);
}

function startTimer() {
  clearInterval(timerInterval);
  timeLeft = GAME_TIME;
  updateTimerUI(timeLeft);

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerUI(timeLeft);
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      showResult();
    }
  }, 1000);
}

// ─── Game flow ────────────────────────────────────────────────────────────────
function startGame() {
  playerScore = 0;
  challengerScore = 0;
  playerCountEl.textContent = '0';
  challengerCountEl.textContent = '0';

  hideOverlay(tutorialOverlay);
  hideOverlay(resultOverlay);

  loadRound();
  startTimer();
}

function showResult() {
  playerBlocked = true;
  challengerBlocked = true;

  resultPlayerScore.textContent = playerScore;
  resultChallengerScore.textContent = challengerScore;

  if (playerScore > challengerScore) {
    resultWinner.textContent = '玩家 1 獲勝！🎉';
  } else if (challengerScore > playerScore) {
    resultWinner.textContent = '玩家 2 獲勝！🎉';
  } else {
    resultWinner.textContent = '平手！';
  }

  showOverlay(resultOverlay);
}

function showOverlay(el) {
  el.classList.add('active');
}

function hideOverlay(el) {
  el.classList.remove('active');
}

// ─── Event listeners ──────────────────────────────────────────────────────────
btnStart.addEventListener('click', startGame);
btnNewGame.addEventListener('click', startGame);

// Prevent context menu on long press (mobile)
document.addEventListener('contextmenu', e => e.preventDefault());
