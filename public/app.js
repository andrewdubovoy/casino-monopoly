// ══════════════════════════════════════════════════
//  DICE DOT PATTERNS
// ══════════════════════════════════════════════════
const DICE_PATTERNS = {
  1: [false,false,false, false,true, false, false,false,false],
  2: [true, false,false, false,false,false, false,false,true ],
  3: [true, false,false, false,true, false, false,false,true ],
  4: [true, false,true,  false,false,false, true, false,true ],
  5: [true, false,true,  false,true, false, true, false,true ],
  6: [true, false,true,  true, false,true,  true, false,true ],
};

function setDieFace(dieEl, val) {
  const dots = dieEl.querySelectorAll('.dot');
  DICE_PATTERNS[val].forEach((show, i) => {
    dots[i].classList.toggle('hidden', !show);
  });
}

// ══════════════════════════════════════════════════
//  BOARD POSITIONS (40 cells, clockwise from СТАРТ)
// ══════════════════════════════════════════════════
const BOARD_CELLS = (() => {
  const cells = [];
  for (let c = 11; c >= 1; c--) cells.push({ col: c, row: 11 }); // bottom r→l
  for (let r = 10; r >= 1; r--) cells.push({ col: 1,  row: r  }); // left b→t
  for (let c = 2; c <= 11; c++) cells.push({ col: c,  row: 1  }); // top l→r
  for (let r = 2; r <= 10; r++) cells.push({ col: 11, row: r  }); // right t→b
  return cells;
})();

let currentCell = 0;

function getCellCorner(idx) {
  const board = document.querySelector('.board');
  const wrap  = document.querySelector('.board-wrap');
  if (!board || !wrap) return { x: -100, y: -100 };

  const wRect = wrap.getBoundingClientRect();
  const { col, row } = BOARD_CELLS[idx % BOARD_CELLS.length];

  // Find cell by grid position — check both "grid-column:N" and "grid-column: N"
  const all = board.querySelectorAll('.cell');
  for (const cell of all) {
    const s = (cell.getAttribute('style') || '').replace(/\s/g, '');
    if (s.includes(`grid-column:${col}`) && s.includes(`grid-row:${row}`)) {
      const r = cell.getBoundingClientRect();
      return {
        x: r.left - wRect.left + 3,
        y: r.top  - wRect.top  + 3,
      };
    }
  }
  return { x: -100, y: -100 };
}

function placeToken(idx, animate = false) {
  const token = document.getElementById('playerToken');
  if (!token) return;
  const { x, y } = getCellCorner(idx);

  // Set position first (triggers CSS transition on left/top)
  token.style.left = x + 'px';
  token.style.top  = y + 'px';

  if (animate) {
    // Bounce fires AFTER position transition starts — no conflict
    requestAnimationFrame(() => {
      token.classList.remove('moving');
      void token.offsetWidth;
      token.classList.add('moving');
    });
  }
}

async function walkToken(from, steps) {
  for (let i = 1; i <= steps; i++) {
    await new Promise(r => setTimeout(r, 310));
    placeToken((from + i) % BOARD_CELLS.length, true);
  }
}

// ══════════════════════════════════════════════════
//  ROLL DICE — раздельная анимация для каждого кубика
// ══════════════════════════════════════════════════
function animateSingleDie(dieEl, finalVal, delay) {
  return new Promise(resolve => {
    setTimeout(() => {
      dieEl.classList.remove('rolling', 'landed');
      void dieEl.offsetWidth;
      dieEl.classList.add('rolling');

      let ticks = 0;
      const interval = setInterval(() => {
        setDieFace(dieEl, Math.ceil(Math.random() * 6));
        ticks++;
        if (ticks >= 9) {
          clearInterval(interval);
          setDieFace(dieEl, finalVal);
          dieEl.classList.remove('rolling');
          void dieEl.offsetWidth;
          dieEl.classList.add('landed');
          resolve();
        }
      }, 65);
    }, delay);
  });
}

async function rollDice() {
  const btn = document.querySelector('.roll-btn');
  const die1 = document.getElementById('die1');
  const die2 = document.getElementById('die2');
  const scoreVal = document.getElementById('scoreVal');
  if (!die1 || !die2 || btn.disabled) return;

  btn.disabled = true;
  scoreVal.classList.remove('visible');

  const v1 = Math.ceil(Math.random() * 6);
  const v2 = Math.ceil(Math.random() * 6);

  // Die1 starts immediately, die2 with 120ms offset — раздельно, не слитно
  await Promise.all([
    animateSingleDie(die1, v1, 0),
    animateSingleDie(die2, v2, 120),
  ]);

  const total = v1 + v2;
  scoreVal.textContent = total;
  scoreVal.classList.add('visible');

  // Walk token
  const from = currentCell;
  currentCell = (currentCell + total) % BOARD_CELLS.length;
  await walkToken(from, total);

  // Update player money display (subtract a small random amount for flavor)
  const moneyEl = document.getElementById('playerMoney');
  if (moneyEl) {
    let current = parseInt(moneyEl.textContent.replace(/\s/g,'')) || 0;
    moneyEl.textContent = current.toLocaleString('ru');
  }

  setTimeout(() => { btn.disabled = false; }, 200);
}

// ══════════════════════════════════════════════════
//  SCREEN TRANSITIONS
// ══════════════════════════════════════════════════
function transitionTo(screenNum) {
  const current = document.querySelector('.screen.active');
  const next = document.getElementById('screen' + screenNum);
  if (!next || current === next) return;

  current.classList.add('exit');
  current.classList.remove('active');

  setTimeout(() => {
    current.classList.remove('exit');
    next.classList.add('active');

    const header = document.getElementById('boardHeader');
    if (screenNum === 3 && header) {
      header.style.display = 'flex';
      document.getElementById('bossBar').style.display = 'flex';
      // Wait for screen to be fully visible, then snap token to START
      const snapToken = (attempts = 0) => {
        const token = document.getElementById('playerToken');
        const wrap  = document.querySelector('.board-wrap');
        const board = document.querySelector('.board');
        if (!token || !wrap || !board) return;

        const { x, y } = getCellCorner(0);
        // If position is valid (not -100), place it
        if (x > 0 && y > 0) {
          token.style.transition = 'none';
          token.style.left = x + 'px';
          token.style.top  = y + 'px';
          requestAnimationFrame(() => { token.style.transition = ''; });
        } else if (attempts < 15) {
          setTimeout(() => snapToken(attempts + 1), 80);
        }
      };
      setTimeout(() => snapToken(), 0);
    } else if (header) {
      header.style.display = 'none';
    }
  }, 380);
}

function startGame() {
  const val = parseInt(document.getElementById('capital-input').value) || 1500;
  window._startCapital = val;

  // Pass money to player panel
  const moneyEl = document.getElementById('playerMoney');
  if (moneyEl) moneyEl.textContent = val.toLocaleString('ru');

  transitionTo(3);
}

// ══════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const screen1 = document.getElementById('screen1');
  if (screen1) {
    screen1.classList.remove('active');
    void screen1.offsetWidth;
    screen1.classList.add('active');
  }

  const die1 = document.getElementById('die1');
  const die2 = document.getElementById('die2');
  if (die1) setDieFace(die1, 1);
  if (die2) setDieFace(die2, 2);

  // Quick capital buttons
  const quickBtns = document.querySelectorAll('.quick-btn');
  const input = document.getElementById('capital-input');
  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      quickBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (input) input.value = btn.dataset.val;
    });
  });
  if (input) {
    input.addEventListener('input', () => {
      const val = parseInt(input.value);
      quickBtns.forEach(btn => btn.classList.toggle('active', parseInt(btn.dataset.val) === val));
    });
  }
});