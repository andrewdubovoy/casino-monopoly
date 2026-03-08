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
  DICE_PATTERNS[val].forEach((show, i) => dots[i].classList.toggle('hidden', !show));
}

// ══════════════════════════════════════════════════
//  GAME STATE
// ══════════════════════════════════════════════════
let currentCell    = 0;
let lapMultiplier  = 1;
let totalMoves     = 0;
let penaltyMult    = 1;
let doubleDiscount = false;
let playerHearts   = 3;
const BOSS_MAX_HP  = 500000;
let bossHp         = BOSS_MAX_HP;

function getTotalMultiplier() { return lapMultiplier * penaltyMult; }
function getFinalTaskPrice()  {
  let p = 10000 * getTotalMultiplier();
  if (doubleDiscount) p = Math.round(p * 0.5);
  return p;
}

// ══════════════════════════════════════════════════
//  BOARD
// ══════════════════════════════════════════════════
const BOARD_CELLS = (() => {
  const c = [];
  for (let x = 11; x >= 1; x--) c.push({ col: x, row: 11 });
  for (let y = 10; y >= 1; y--) c.push({ col: 1, row: y });
  for (let x = 2; x <= 11; x++) c.push({ col: x, row: 1 });
  for (let y = 2; y <= 10; y++) c.push({ col: 11, row: y });
  return c;
})();

function getCellCorner(idx) {
  const board = document.querySelector('.board');
  const wrap  = document.querySelector('.board-wrap');
  if (!board || !wrap) return { x: -100, y: -100 };
  const wRect = wrap.getBoundingClientRect();
  const { col, row } = BOARD_CELLS[idx % BOARD_CELLS.length];
  // Use data-col/data-row — immune to style re-serialization by browser
  const cell = board.querySelector(
    `.cell[data-col="${col}"][data-row="${row}"]`
  );
  if (!cell) return { x: -100, y: -100 };
  const r = cell.getBoundingClientRect();
  return { x: r.left - wRect.left + 3, y: r.top - wRect.top + 3 };
}

function placeToken(idx, animate) {
  const token = document.getElementById('playerToken');
  if (!token) return;
  const { x, y } = getCellCorner(idx);
  token.style.left = x + 'px';
  token.style.top  = y + 'px';
  if (animate) requestAnimationFrame(() => {
    token.classList.remove('moving'); void token.offsetWidth; token.classList.add('moving');
  });
}


// ══════════════════════════════════════════════════
//  DICE ROLL
// ══════════════════════════════════════════════════
function animateSingleDie(dieEl, finalVal, delay) {
  return new Promise(resolve => {
    setTimeout(() => {
      dieEl.classList.remove('rolling', 'landed'); void dieEl.offsetWidth;
      dieEl.classList.add('rolling');
      let t = 0;
      const iv = setInterval(() => {
        setDieFace(dieEl, Math.ceil(Math.random() * 6));
        if (++t >= 9) {
          clearInterval(iv);
          setDieFace(dieEl, finalVal);
          dieEl.classList.remove('rolling'); void dieEl.offsetWidth;
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
  doubleDiscount = false;
  sfxDice();
  scoreVal.classList.remove('visible');

  const v1 = Math.ceil(Math.random() * 6);
  const v2 = Math.ceil(Math.random() * 6);
  const isDouble = v1 === v2;

  await Promise.all([animateSingleDie(die1, v1, 0), animateSingleDie(die2, v2, 120)]);

  if (isDouble) { doubleDiscount = true; updateMultiplierWidget(); showDoubleAnimation(v1); }

  const total = v1 + v2;
  scoreVal.textContent = total;
  scoreVal.classList.add('visible');
  bumpMoveCounter(1);

  const from = currentCell;
  currentCell = (currentCell + total) % BOARD_CELLS.length;
  await walkTokenWithLapPause(from, total);

  const cellName = getCellNameAtIndex(currentCell);
  if (cellName === 'ШТРАФ') { applyPenalty(); sfxSiren(); mascotScared(); unlockButtons(); return; }
  if (cellName === 'СТАРТ') { mascotDance(); unlockButtons(); return; }
  if (cellName) setTimeout(() => openModal(cellName), 200);
  else unlockButtons();
}

// ══════════════════════════════════════════════════
//  DOUBLE ANIMATION
// ══════════════════════════════════════════════════
function showDoubleAnimation(val) {
  const faces = ['⚀','⚁','⚂','⚃','⚄','⚅'];
  const f = faces[val - 1];
  const el = document.createElement('div');
  el.className = 'double-overlay';
  el.innerHTML = '<div class="double-card">' +
    '<div class="double-dice-row"><div class="double-die">' + f + '</div><div class="double-die">' + f + '</div></div>' +
    '<div class="double-label">ДУБЛЬ!</div>' +
    '<div class="double-sub">Скидка 50% на это задание</div>' +
    '</div>';
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 500); }, 2200);
}

// ══════════════════════════════════════════════════
//  PENALTY
// ══════════════════════════════════════════════════
function applyPenalty() {
  penaltyMult = penaltyMult <= 1 ? 5 : penaltyMult * 5;
  updateMultiplierWidget();
  const msg = penaltyMult > 5
    ? 'Штрафы складываются! Теперь x' + penaltyMult + '!'
    : 'Следующее задание будет стоить в 5 раз дороже!';
  showToast('red', '⛔', 'ШТРАФ ×' + penaltyMult, msg);
}
function clearPenalty() {
  if (penaltyMult > 1) {
    penaltyMult = 1;
    updateMultiplierWidget();
    showToast('green', '✅', 'ШТРАФ ОПЛАЧЕН', 'Штраф снят! Мультипликатор вернулся в норму.');
  }
}

// ══════════════════════════════════════════════════
//  MULTIPLIER WIDGET
// ══════════════════════════════════════════════════
function updateMultiplierWidget() {
  const set  = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const show = (id, vis) => { const el = document.getElementById(id); if (el) el.style.display = vis ? 'inline-flex' : 'none'; };

  const total = getTotalMultiplier();

  set('mwTotal', total + 'x' + (doubleDiscount ? ' −50%' : ''));

  set('mwLap', 'x' + lapMultiplier);
  set('mwPenalty', ' x' + penaltyMult);
  show('mwPenaltyWrap', penaltyMult > 1);
  show('mwDoublWrap',   doubleDiscount);

  set('mwPrice', getFinalTaskPrice().toLocaleString('ru') + ' ₽');

  const w = document.getElementById('multiplierWidget');
  if (w) { w.classList.remove('bump'); void w.offsetWidth; w.classList.add('bump'); }
}

// ══════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════
function showToast(type, icon, title, sub) {
  document.querySelectorAll('.lap-notif').forEach(n => n.remove());
  const n = document.createElement('div');
  n.className = 'lap-notif lap-notif--' + type;
  n.innerHTML = '<span class="lap-notif-icon">' + icon + '</span>' +
    '<div><div class="lap-notif-title">' + title + '</div><div class="lap-notif-sub">' + sub + '</div></div>';
  document.body.appendChild(n);
  requestAnimationFrame(() => requestAnimationFrame(() => n.classList.add('show')));
  setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 500); }, 3500);
}

// ══════════════════════════════════════════════════
//  CELL DATA
// ══════════════════════════════════════════════════
const CELL_DATA = {
  'СТАРТ':                   { icon:'▶️',  tag:'СТАРТ',        task:'Получи бонус за прохождение круга. Вперёд!' },
  'БАНЯ':                    { icon:'🅿️',  tag:'ОТДЫХ',        task:'Пропусти ход — ты на заслуженном отдыхе.' },
  'Шанс':                    { icon:'❓',  tag:'ШАНС',         task:'Тяни карту шанса — удача или беда?' },
  'Розыгрыш Сабам':          { icon:'💰',  tag:'КАССА',        task:'Получи деньги от каждого игрока.' },
  'Электро':                 { icon:'⚡',  tag:'КОММУНАЛКА',   task:'Заплати за электричество.' },
  'Налог Роскошь':           { icon:'💎',  tag:'НАЛОГ',        task:'Заплати налог на роскошь.' },
  'МЕГА ХАЙ РОЛЛ':           { icon:'💀',  tag:'ХАЙ РОЛЛ',     task:'Всё или ничего — испытай удачу!' },
  'Поки-нвазия':             { icon:'🎰',  tag:'КАЗИНО',       task:'Сыграй в покер с боссом.' },
  'Колтуши':                 { icon:'🏠',  tag:'НЕДВИЖИМОСТЬ', task:'Купи участок или заплати аренду.' },
  'Кирюша':                  { icon:'🏠',  tag:'НЕДВИЖИМОСТЬ', task:'Купи квартал или заплати аренду.' },
  'Ильинойс':                { icon:'🏠',  tag:'НЕДВИЖИМОСТЬ', task:'Купи Ильинойс или заплати аренду.' },
  'Атлантик':                { icon:'🏠',  tag:'НЕДВИЖИМОСТЬ', task:'Купи Атлантик или заплати аренду.' },
  'Вентнор':                 { icon:'🏠',  tag:'НЕДВИЖИМОСТЬ', task:'Купи Вентнор или заплати аренду.' },
  'Мэриланд':                { icon:'🏠',  tag:'НЕДВИЖИМОСТЬ', task:'Купи Мэриланд или заплати аренду.' },
  'Нью-Йорк':                { icon:'🏠',  tag:'НЕДВИЖИМОСТЬ', task:'Купи квартал Нью-Йорка или заплати аренду.' },
  'Теннесси':                { icon:'🏠',  tag:'НЕДВИЖИМОСТЬ', task:'Купи Теннесси или заплати аренду.' },
  'Сент-Джеймс':             { icon:'🏠',  tag:'НЕДВИЖИМОСТЬ', task:'Купи Сент-Джеймс или заплати аренду.' },
  'Вирджиния':               { icon:'🏠',  tag:'НЕДВИЖИМОСТЬ', task:'Купи Вирджинию или заплати аренду.' },
  'Стэйтс':                  { icon:'🏠',  tag:'НЕДВИЖИМОСТЬ', task:'Купи Стэйтс или заплати аренду.' },
  'Сент-Чарлз':              { icon:'🏠',  tag:'НЕДВИЖИМОСТЬ', task:'Купи Сент-Чарлз или заплати аренду.' },
  'Пасифик':                 { icon:'🏠',  tag:'НЕДВИЖИМОСТЬ', task:'Купи Пасифик или заплати аренду.' },
  'Сев.Каролина':            { icon:'🏠',  tag:'НЕДВИЖИМОСТЬ', task:'Купи Северную Каролину или заплати аренду.' },
  'Парк Плейс':              { icon:'🏠',  tag:'НЕДВИЖИМОСТЬ', task:'Купи Парк Плейс или заплати аренду.' },
  'Бродвей':                 { icon:'🏠',  tag:'НЕДВИЖИМОСТЬ', task:'Купи Бродвей или заплати аренду.' },
  'Big Bass':                { icon:'🎰',  tag:'КАЗИНО',       task:'Сыграй в Big Bass Bonanza!' },
  'Dragon Money Treasures':  { icon:'🐉',  tag:'КАЗИНО',       task:'Играй в Dragon Money Treasures.' },
  'Starlight Princess 1000': { icon:'⭐',  tag:'КАЗИНО',       task:'Крути Starlight Princess 1000.' },
  'Gates of Olympus 1000':   { icon:'🏛️', tag:'КАЗИНО',       task:'Gates of Olympus ждёт тебя!' },
  'Sweet Bonanza 1000':      { icon:'🍬',  tag:'КАЗИНО',       task:'Sweet Bonanza 1000 — сладкий выигрыш!' },
  'Sugar Rush 1000':         { icon:'🍭',  tag:'КАЗИНО',       task:'Sugar Rush 1000 — максимальный сахар!' },
};

function getCellNameAtIndex(idx) {
  const { col, row } = BOARD_CELLS[idx % BOARD_CELLS.length];
  const board = document.querySelector('.board');
  if (!board) return '';
  const cell = board.querySelector(
    `.cell[data-col="${col}"][data-row="${row}"]`
  );
  if (!cell) return '';
  const el = cell.querySelector('.cell-name, .corner-label');
  return el ? el.textContent.trim() : '';
}

// ══════════════════════════════════════════════════
//  GLOW CLASS HELPER
// ══════════════════════════════════════════════════
function getCellGlowClass(idx) {
  const { col, row } = BOARD_CELLS[idx % BOARD_CELLS.length];
  const board = document.querySelector('.board');
  if (!board) return '';
  const cell = board.querySelector(
    `.cell[data-col="${col}"][data-row="${row}"]`
  );
  if (!cell) return '';
  const strip = cell.querySelector('.strip');
  if (!strip) return '';
  const colorClass = [...strip.classList].find(
    c => c !== 'strip' && c !== 'danger' && c !== 'sabam' && c !== 'chance-strip'
  );
  return colorClass ? 'cm-glow-' + colorClass : '';
}
function applyModalGlow(glowClass) {
  const s1 = document.getElementById('cellModalStep1');
  const s2 = document.getElementById('cellModalStep2');
  [s1, s2].forEach(el => {
    if (!el) return;
    el.className = el.className.replace(/cm-glow-\S+/g, '').trim();
    if (glowClass) el.classList.add(glowClass);
  });
}

// ══════════════════════════════════════════════════
//  MODAL
// ══════════════════════════════════════════════════
function openModal(cellName) {
  if (cellName === 'МЕГА ХАЙ РОЛЛ') { openMhrModal(); return; }
  if (cellName === 'Шанс')           { openChanceModal(); return; }
  if (cellName === 'БАНЯ') {
    showToast('blue', '🛁', 'ПРИШЛО ВРЕМЯ ОТДОХНУТЬ', 'Расслабься, это заслуженный перерыв!');
    unlockButtons();
    return;
  }

  if (cellName === 'Big Bass') {
    // Проверяем баланс до открытия колеса — цена задания та же
    const price = getFinalTaskPrice();
    const moneyNow = parseInt((document.getElementById('playerMoney')?.textContent || '0').replace(/[^\d]/g,'')) || 0;
    if (checkDeath(moneyNow, price)) return;
    openWheelModal(cellName);
    return;
  }

  if (cellName === 'Розыгрыш Сабам') {
    handleNazhid();
    return;
  }

  const style = typeof getSlotStyle !== 'undefined' ? getSlotStyle(cellName) : null;
  const slotTask = generateSlotTask(cellName);
  const fallback = style
    ? { icon: style.icon, tag: 'СЛОТ', task: slotTask }
    : { icon:'🎲', tag:'КЛЕТКА', task:'Специальное событие!' };
  const data  = CELL_DATA[cellName] || fallback;
  const price = getFinalTaskPrice();
  const mult  = getTotalMultiplier();

  let priceHtml = '<span class="cm-price">' + price.toLocaleString('ru') + ' ₽';
  if (mult > 1 || doubleDiscount) {
    const parts = [];
    if (lapMultiplier > 1) parts.push('круг x' + lapMultiplier);
    if (penaltyMult > 1)   parts.push('штраф x' + penaltyMult);
    if (doubleDiscount)    parts.push('дубль −50%');
    priceHtml += ' <span class="cm-price-meta">(' + parts.join(', ') + ')</span>';
  }
  priceHtml += '</span>';

  document.getElementById('cmIcon').textContent  = data.icon;
  document.getElementById('cmTag').textContent   = data.tag;
  document.getElementById('cmTitle').textContent = cellName;
  document.getElementById('cmTask').innerHTML    = data.task + '<br>' + priceHtml;

  const moneyNow = parseInt((document.getElementById('playerMoney')?.textContent || '0').replace(/[^\d]/g,'')) || 0;
  if (checkDeath(moneyNow, price)) return;

  applyModalGlow(getCellGlowClass(currentCell));

  const overlay = document.getElementById('cellModalOverlay');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('open')));
}

function closeModal(accepted) {
  if (!accepted && playerHearts <= 0) {
    showModalError('У тебя нет жизней для отказа!');
    return;
  }

  const overlay = document.getElementById('cellModalOverlay');
  overlay.classList.remove('open');
  setTimeout(() => {
    overlay.style.display = 'none';
    const s1 = document.getElementById('cellModalStep1');
    const s2 = document.getElementById('cellModalStep2');
    s1.style.display = 'flex'; s1.style.animation = '';
    s2.style.display = 'none'; s2.style.animation = '';
    const err = document.getElementById('cmError');
    if (err) err.style.display = 'none';
    const declineBtn = document.querySelector('#cellModalStep1 .cm-decline');
    if (declineBtn) declineBtn.style.display = '';
  }, 320);

  if (!accepted) {
    if (doubleDiscount) {
      doubleDiscount = false;
      updateMultiplierWidget();
    }
    streakBreak();
    mascotSad();
    setTimeout(() => loseHeart(), 200);
  }
  unlockButtons();
}

function showModalError(msg) {
  let err = document.getElementById('cmError');
  if (!err) {
    err = document.createElement('div');
    err.id = 'cmError'; err.className = 'cm-error';
    document.getElementById('cellModalStep1').appendChild(err);
  }
  err.textContent = msg;
  err.style.display = 'block';
  err.classList.remove('shake'); void err.offsetWidth; err.classList.add('shake');
}

let _balanceBeforeTask = 0;

function goToStep2() {
  const moneyEl = document.getElementById('playerMoney');
  _balanceBeforeTask = parseInt((moneyEl ? moneyEl.textContent : '0').replace(/[^\d]/g,'')) || 0;
  window._currentTaskName = document.getElementById('cmTitle')?.textContent || '?';
  window._currentTaskCost = getFinalTaskPrice();
  const s1 = document.getElementById('cellModalStep1');
  const s2 = document.getElementById('cellModalStep2');
  s1.style.animation = 'cmSlideOut 0.25s ease-in forwards';
  setTimeout(() => {
    s1.style.display = 'none'; s1.style.animation = '';
    s2.style.display = 'flex';
    s2.style.animation = 'cmSlideIn 0.3s cubic-bezier(.22,1,.36,1) forwards';
    document.getElementById('cmIcon2').textContent  = document.getElementById('cmIcon').textContent;
    document.getElementById('cmTitle2').textContent = document.getElementById('cmTitle').textContent;
    document.getElementById('resultInput').value = '';
    document.getElementById('resultInput').focus();
  }, 220);
}

function submitResult() {
  const inputEl = document.getElementById('resultInput');
  const val = inputEl.value.trim();
  if (!val) {
    inputEl.style.borderColor = 'rgba(230,57,70,0.8)';
    inputEl.classList.remove('shake'); void inputEl.offsetWidth; inputEl.classList.add('shake');
    setTimeout(() => { inputEl.style.borderColor = ''; }, 700);
    return;
  }
  const newBalance = parseInt(val) || 0;
  const cost = window._currentTaskCost || getFinalTaskPrice();
  totalTasksSpent += cost;
  const diff = newBalance - _balanceBeforeTask;
  const moneyEl = document.getElementById('playerMoney');
  if (moneyEl) moneyEl.textContent = newBalance.toLocaleString('ru');

  // Record task for leaderboard (skip giveaways)
  const taskName = window._currentTaskName || '?';
  const skipNames = ['Розыгрыш Сабам', 'Шанс', 'МЕГА ХАЙ РОЛЛ', 'Налог Роскошь', 'ШТРАФ', 'БАНЯ', 'Электро'];
  const isSkip = skipNames.some(s => taskName.includes(s));
  if (!isSkip && cost > 0) {
    // ROI: чистый профит / ставка
    // Например: было 100к, потратил 10к, стало 121к → профит +21к → ROI = 21к/10к = 2.1x
    const returned = newBalance - _balanceBeforeTask;
    const roiCoef  = cost > 0 ? returned / cost : 0;
    taskHistory.push({
      name: taskName,
      cost: cost,
      balanceBefore: _balanceBeforeTask,
      balanceAfter: newBalance,
      returned: returned,   // сколько получили обратно из слота
      roiCoef: roiCoef      // 1.5x = хорошо, 0.5x = плохо
    });
    updateLeaderboard();
  }

  clearPenalty();
  doubleDiscount = false;
  updateMultiplierWidget();
  streakAccept();
  mascotHappy();
  closeModal(true);
  if (diff > 0) setTimeout(() => dealDamageToBoss(Math.round(diff * 0.1)), 350);
}

// ══════════════════════════════════════════════════
//  HEARTS  (unlimited extra HP)
// ══════════════════════════════════════════════════
function gainHeart() {
  playerHearts++;
  const container = document.querySelector('.pp-hearts');
  if (!container) return;
  if (playerHearts <= 3) {
    const heartEl = document.getElementById('heart' + playerHearts);
    if (heartEl) {
      heartEl.classList.remove('lost');
      heartEl.classList.add('heart-regain');
      setTimeout(() => heartEl.classList.remove('heart-regain'), 900);
    }
  } else {
    const extra = document.createElement('span');
    extra.className = 'pp-heart pp-heart-extra heart-regain';
    extra.id = 'heart' + playerHearts;
    extra.textContent = '💚';
    container.appendChild(extra);
    setTimeout(() => extra.classList.remove('heart-regain'), 900);
  }
}

function loseHeart() {
  sfxHeartLost();
  if (playerHearts <= 0) return;
  const hearts = document.querySelectorAll('.pp-heart');
  const el = hearts[playerHearts - 1];
  if (!el) { playerHearts--; return; }
  if (el.classList.contains('pp-heart-extra')) {
    el.classList.add('losing');
    setTimeout(() => { el.remove(); playerHearts--; }, 600);
  } else {
    el.classList.add('losing');
    setTimeout(() => { el.classList.remove('losing'); el.classList.add('lost'); playerHearts--; }, 600);
  }
}

// ══════════════════════════════════════════════════
//  BOSS
// ══════════════════════════════════════════════════
function dealDamageToBoss(amount) {
  totalDamageDealt += amount;
  bossHp = Math.max(0, bossHp - amount);
  const pct = (bossHp / BOSS_MAX_HP) * 100;
  const fill = document.getElementById('bossBarFill');
  const hpEl = document.getElementById('bossHp');
  if (fill) {
    fill.style.width = pct + '%';
    fill.style.background = pct < 30 ? 'linear-gradient(90deg,#e63946,#ff6b6b)'
      : pct < 60 ? 'linear-gradient(90deg,#f4a261,#f5b731)'
      : 'linear-gradient(90deg,#e89010,#f5b731)';
  }
  if (hpEl) hpEl.textContent = bossHp.toLocaleString('ru');
  const bar = document.getElementById('bossBar');
  if (bar) { bar.classList.remove('hit'); void bar.offsetWidth; bar.classList.add('hit'); }
  showDamagePopup(amount);

  if (bossHp <= 0) setTimeout(() => showWin(), 800);
}

function showDamagePopup(amount) {
  const bar = document.getElementById('bossBar');
  if (!bar) return;
  const rect = bar.getBoundingClientRect();
  const popup = document.createElement('div');
  popup.className = 'damage-popup';
  popup.textContent = '-' + amount.toLocaleString('ru');
  popup.style.left = (rect.left + rect.width / 2 - 40) + 'px';
  popup.style.top  = (rect.top - 10) + 'px';
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 1200);
}

// ══════════════════════════════════════════════════
//  SCREEN TRANSITIONS
// ══════════════════════════════════════════════════
function transitionTo(screenNum) {
  const current = document.querySelector('.screen.active');
  const next = document.getElementById('screen' + screenNum);
  if (!next || current === next) return;
  current.classList.add('exit'); current.classList.remove('active');
  setTimeout(() => {
    current.classList.remove('exit');
    next.classList.add('active');
    const header = document.getElementById('boardHeader');
    if (screenNum === 3 && header) {
      header.style.display = 'flex';
      const bar = document.getElementById('bossBar');
      bar.style.opacity = '0'; bar.style.display = 'flex'; bar.style.animation = 'none';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        bar.style.animation = 'bossBarIn 0.8s cubic-bezier(.22,1,.36,1) forwards';
      }));
      updateMultiplierWidget();
      const mw = document.getElementById('multiplierWidget');
      if (mw) {
        mw.style.opacity = '0';
        mw.style.display = 'flex';
        // entrance animation after short delay
        setTimeout(() => {
          mw.style.opacity = '';
          mw.style.animation = 'none';
          void mw.offsetWidth;
          mw.style.animation = 'bossBarIn 0.8s cubic-bezier(.22,1,.36,1) forwards';
        }, 650);
      }
      const mc = document.getElementById('moveCounter');
      if (mc) mc.style.display = 'flex';
      const db = document.getElementById('demoBar');
      if (db) db.style.display = 'flex';
      const sb = document.getElementById('surrenderBtn');
      if (sb) sb.style.display = 'block';
      // Show leaderboard immediately on screen 3 (empty state shown if no tasks yet)
      const lb = document.getElementById('leaderboardWidget');
      if (lb) lb.style.display = 'flex';
      updateLeaderboard();
      const snap = (n = 0) => {
        const tok = document.getElementById('playerToken');
        if (!tok) return;
        const { x, y } = getCellCorner(0);
        if (x > 0 && y > 0) {
          tok.style.transition = 'none';
          tok.style.left = x + 'px'; tok.style.top = y + 'px';
          requestAnimationFrame(() => { tok.style.transition = ''; });
        } else if (n < 15) setTimeout(() => snap(n + 1), 80);
      };
      setTimeout(() => snap(), 0);
      setTimeout(() => initBoardSlots(), 200);
    } else if (header) {
      header.style.display = 'none';
    }
  }, 380);
}

function startGame() {
  const val = parseInt(document.getElementById('capital-input').value) || 1500;
  window._startCapital = val;
  const moneyEl = document.getElementById('playerMoney');
  if (moneyEl) moneyEl.textContent = val.toLocaleString('ru');
  transitionTo(3);
}

// ══════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const s1 = document.getElementById('screen1');
  if (s1) { s1.classList.remove('active'); void s1.offsetWidth; s1.classList.add('active'); }

  const die1 = document.getElementById('die1');
  const die2 = document.getElementById('die2');
  if (die1) setDieFace(die1, 1);
  if (die2) setDieFace(die2, 2);

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
      quickBtns.forEach(b => b.classList.toggle('active', parseInt(b.dataset.val) === val));
    });
  }
});

// ══════════════════════════════════════════════════
//  DEMO WALK
// ══════════════════════════════════════════════════
function unlockButtons() {
  // Always clear double discount when turn ends — regardless of accept/decline/skip
  if (doubleDiscount) {
    doubleDiscount = false;
    updateMultiplierWidget();
  }
  const btn     = document.querySelector('.roll-btn');
  const demoBtn = document.getElementById('demoBtnEl');
  if (btn)     btn.disabled     = false;
  if (demoBtn) demoBtn.disabled = false;
}

async function demoWalk() {
  const input   = document.getElementById('demoSteps');
  const steps   = Math.max(1, Math.min(40, parseInt(input?.value) || 1));
  const btn     = document.querySelector('.roll-btn');
  const demoBtn = document.getElementById('demoBtnEl');
  if (btn)     btn.disabled     = true;
  if (demoBtn) demoBtn.disabled = true;

  const from = currentCell;
  currentCell = (currentCell + steps) % BOARD_CELLS.length;
  bumpMoveCounter(1);
  await walkTokenWithLapPause(from, steps);

  const cellName = getCellNameAtIndex(currentCell);
  if (cellName === 'ШТРАФ') { applyPenalty(); sfxSiren(); mascotScared(); unlockButtons(); return; }
  if (cellName === 'СТАРТ') { mascotDance(); unlockButtons(); return; }
  if (cellName) setTimeout(() => openModal(cellName), 200);
  else unlockButtons();
}

// ══════════════════════════════════════════════════
//  WIN / LOSE
// ══════════════════════════════════════════════════
let totalDamageDealt = 0;
let totalTasksSpent  = 0;
const taskHistory = []; // { name, cost, balanceBefore, balanceAfter, roi }

function checkDeath(playerBalance, taskPrice) {
  if (playerBalance < taskPrice) {
    setTimeout(() => showLose(taskPrice, playerBalance), 400);
    return true;
  }
  return false;
}

function showWin() {
  const balance = parseInt((document.getElementById('playerMoney')?.textContent || '0').replace(/[^\d]/g,'')) || 0;
  const el = document.getElementById('winDamage');
  const el2 = document.getElementById('winBalance');
  if (el)  el.textContent  = totalDamageDealt.toLocaleString('ru');
  if (el2) el2.textContent = balance.toLocaleString('ru') + ' ₽';

  const screen = document.getElementById('screenWin');
  screen.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => screen.classList.add('show')));
  spawnConfetti();
}

function showLose(required, balance) {
  const startCapital = window._startCapital || 0;
  // Сколько проиграли в этой попытке (от текущего стартового до текущего баланса)
  const lostThisSession = Math.max(0, startCapital - balance);
  // Накапливаем: предыдущие проигрыши + додепы + текущий проигрыш
  totalLostAmount += lostThisSession;
  // Сдвигаем базис: после додепа следующий showLose будет считать от нового стартового
  window._startCapital = balance;
  const el1 = document.getElementById('loseRequired');
  const el2 = document.getElementById('loseBalance');
  if (el1) el1.textContent = totalTasksSpent.toLocaleString('ru') + ' ₽';
  if (el2) el2.textContent = totalLostAmount.toLocaleString('ru') + ' ₽';

  const screen = document.getElementById('screenLose');
  screen.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => screen.classList.add('show')));
  spawnLoseFlash();
}

function spawnConfetti() {
  const container = document.getElementById('winParticles');
  if (!container) return;
  const colors = ['#f5b731','#e89010','#fff','#ffd700','#ff9f43','#54a0ff','#00d2d3'];
  for (let i = 0; i < 90; i++) {
    setTimeout(() => {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      const size = 6 + Math.random() * 10;
      p.style.cssText = `
        left: ${Math.random() * 100}%;
        top: -20px;
        width: ${size}px;
        height: ${size}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        animation-duration: ${1.8 + Math.random() * 2.5}s;
        animation-delay: ${Math.random() * 0.3}s;
      `;
      container.appendChild(p);
      setTimeout(() => p.remove(), 4500);
    }, i * 30);
  }
  setTimeout(spawnConfetti, 3500);
}

function spawnLoseFlash() {
  const flash = document.createElement('div');
  flash.style.cssText = `
    position:fixed; inset:0; background:rgba(180,0,20,0.35);
    z-index:999; pointer-events:none;
    animation: loseFlash 0.6s ease-out forwards;
  `;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 700);

  if (!document.getElementById('loseFlashKF')) {
    const style = document.createElement('style');
    style.id = 'loseFlashKF';
    style.textContent = '@keyframes loseFlash { 0%{opacity:1} 100%{opacity:0} }';
    document.head.appendChild(style);
  }
}

// ══════════════════════════════════════════════════
//  BIG BASS WHEEL
// ══════════════════════════════════════════════════
const BIG_BASS_SLOTS = [
  'Big Bass Boxing Bonus Round','Big Bass Reel Repeat','Big Bass Halloween 3',
  'Big Bass Christmas Frozen Lake','Big Bass Day at the Races','Big Bass Christmas Bash',
  'Big Bass Halloween','Big Bass Hold & Spinner Megaways','Big Bass Amazon Xtreme',
  'Big Bass Hold & Spinner','Big Bass Keeping it Reel','Big Bass Splash',
  'Christmas Big Bass Bonanza','Big Bass Bonanza Megaways','Big Bass Bonanza',
  'Big Bass Secrets of the Golden Lake','Big Bass Halloween 2','Big Bass Bonanza 1000',
  'Big Bass Vegas Double Down Deluxe','Big Bass Mission Fishin','Big Bass Floats My Boat',
  'Big Bass Bonanza 3 Reeler','Big Bass Xmas Xtreme',
];

// Teal/blue-family Big Bass palette
const WHEEL_COLORS = [
  '#003847','#00506a','#00293a','#004d60','#001e2e',
  '#003554','#00436a','#002745','#005070','#001a30',
  '#003d5c','#00486a','#002238','#005580','#001525',
  '#004060','#003050','#002040','#004870','#001830',
  '#003848','#004458','#002535',
];

let wheelAngle    = 0;
let wheelSpinning = false;
let wheelSlot     = null;
let _wheelCellName = '';

function openWheelModal(cellName) {
  _wheelCellName = cellName;
  wheelSlot      = null;
  wheelSpinning  = false;

  wmShowScreen(1);

  const spinBtn = document.getElementById('wheelSpinBtn');
  if (spinBtn) spinBtn.disabled = false;
  document.querySelectorAll('.wm-decline').forEach(b => b.disabled = false);

  // Clear any error
  const err = document.getElementById('wheelError');
  if (err) err.style.display = 'none';

  drawWheel(wheelAngle);

  const overlay = document.getElementById('wheelOverlay');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('open')));
}

// Switch visible screen inside wheel modal
function wmShowScreen(n) {
  [1,2,3].forEach(i => {
    const s = document.getElementById('wmScreen' + i);
    if (s) s.style.display = (i === n) ? 'flex' : 'none';
  });
}

// Back button handler (kept for possible future use)
function closeWheelModal() {
  const overlay = document.getElementById('wheelOverlay');
  overlay.classList.remove('open');
  setTimeout(() => { overlay.style.display = 'none'; }, 320);
}

function drawWheel(rotation) {
  const canvas = document.getElementById('wheelCanvas');
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  const cx     = canvas.width  / 2;
  const cy     = canvas.height / 2;
  const r      = cx - 4;
  const n      = BIG_BASS_SLOTS.length;
  const arc    = (2 * Math.PI) / n;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  BIG_BASS_SLOTS.forEach((slot, i) => {
    const startAngle = rotation + i * arc;
    const endAngle   = startAngle + arc;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,180,216,0.35)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startAngle + arc / 2);
    ctx.textAlign    = 'right';
    ctx.fillStyle    = '#ffffff';
    ctx.font         = 'bold 11px Montserrat, sans-serif';
    ctx.shadowColor  = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur   = 4;

    let label = slot.replace('Big Bass ', '').replace('Christmas ', 'Xmas ');
    if (label.length > 18) label = label.substring(0, 17) + '…';
    ctx.fillText(label, r - 10, 4);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(cx, cy, 28, 0, 2 * Math.PI);
  ctx.fillStyle = '#00080f';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,180,216,0.9)';
  ctx.lineWidth   = 2.5;
  ctx.stroke();

  ctx.font      = '22px serif';
  ctx.textAlign = 'center';
  ctx.fillText('🎣', cx, cy + 8);
}

function spinWheel() {
  if (wheelSpinning) return;
  wheelSpinning = true;

  const spinBtn    = document.getElementById('wheelSpinBtn');
  const declineBtn = document.querySelector('.wm-decline');
  spinBtn.disabled = true;
  if (declineBtn) declineBtn.disabled = true;

  const n         = BIG_BASS_SLOTS.length;
  const arc       = (2 * Math.PI) / n;
  const targetIdx = Math.floor(Math.random() * n);
  const extraSpins   = 6;
  const targetCenter = -Math.PI / 2 - (targetIdx * arc + arc / 2);
  let finalAngle = targetCenter + extraSpins * 2 * Math.PI;
  while (finalAngle < wheelAngle + extraSpins * 2 * Math.PI) {
    finalAngle += 2 * Math.PI;
  }

  const duration  = 5000;
  const startTime = performance.now();
  const startAngle = wheelAngle;

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function animate(now) {
    const elapsed = now - startTime;
    const t       = Math.min(elapsed / duration, 1);
    const eased   = easeOut(t);

    wheelAngle = startAngle + (finalAngle - startAngle) * eased;
    drawWheel(wheelAngle);

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      wheelAngle    = finalAngle;
      wheelSpinning = false;
      wheelSlot     = BIG_BASS_SLOTS[targetIdx];
      snapWheelToCenter(targetIdx, finalAngle, () => { showWheelResult(wheelSlot); });
    }
  }

  requestAnimationFrame(animate);
}

function snapWheelToCenter(targetIdx, currentAngle, callback) {
  const n   = BIG_BASS_SLOTS.length;
  const arc = (2 * Math.PI) / n;
  const exactAngle = -Math.PI / 2 - (targetIdx * arc + arc / 2);
  let snapTarget = exactAngle;
  while (snapTarget < currentAngle - 0.1) snapTarget += 2 * Math.PI;
  while (snapTarget > currentAngle + 0.1) snapTarget -= 2 * Math.PI;

  const diff       = snapTarget - currentAngle;
  const snapDur    = 350;
  const startTime  = performance.now();
  const startAngle = currentAngle;

  function animSnap(now) {
    const t      = Math.min((now - startTime) / snapDur, 1);
    const eased  = 1 - Math.pow(1 - t, 2);
    wheelAngle   = startAngle + diff * eased;
    drawWheel(wheelAngle);
    if (t < 1) requestAnimationFrame(animSnap);
    else callback();
  }
  requestAnimationFrame(animSnap);
}

function showWheelResult(slotName) {
  const valEl = document.getElementById('wheelResultText');
  if (valEl) valEl.textContent = slotName;
  // Animate the result card
  const card = document.getElementById('wmResultCard');
  if (card) { card.classList.remove('wr-pop'); void card.offsetWidth; card.classList.add('wr-pop'); }
  wmShowScreen(2);
}

function wheelProceed() {
  // Teal flash transition effect
  const flash = document.createElement('div');
  flash.className = 'wm-proceed-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 700);

  setTimeout(() => closeWheelModal(), 80);
  setTimeout(() => { openModalWithSlot(_wheelCellName, wheelSlot); }, 430);
}

function wheelDecline() {
  if (playerHearts <= 0) {
    let err = document.getElementById('wheelError');
    if (!err) {
      err = document.createElement('div');
      err.id = 'wheelError'; err.className = 'cm-error';
      err.style.marginTop = '0';
      // Insert error before the currently visible decline button
      const activeDecline = document.querySelector('#wmScreen1 .wm-decline, #wmScreen2 .wm-decline');
      if (activeDecline) activeDecline.before(err);
      else document.querySelector('.wm-decline').before(err);
    }
    err.textContent = 'У тебя нет жизней для отказа!';
    err.style.display = 'block';
    err.classList.remove('shake'); void err.offsetWidth; err.classList.add('shake');
    return;
  }
  closeWheelModal();
  setTimeout(() => loseHeart(), 200);
  unlockButtons();
}

function openModalWithSlot(cellName, slotName) {
  const price = getFinalTaskPrice();
  const mult  = getTotalMultiplier();

  let priceHtml = '<span class="cm-price">' + price.toLocaleString('ru') + ' ₽';
  if (mult > 1 || doubleDiscount) {
    const parts = [];
    if (lapMultiplier > 1) parts.push('круг x' + lapMultiplier);
    if (penaltyMult > 1)   parts.push('штраф x' + penaltyMult);
    if (doubleDiscount)    parts.push('дубль −50%');
    priceHtml += ' <span class="cm-price-meta">(' + parts.join(', ') + ')</span>';
  }
  priceHtml += '</span>';

  const moneyNow = parseInt((document.getElementById('playerMoney')?.textContent || '0').replace(/[^\d]/g,'')) || 0;
  if (checkDeath(moneyNow, price)) return;

  applyModalGlow(getCellGlowClass(currentCell));

  document.getElementById('cmIcon').textContent  = '🎣';
  document.getElementById('cmTag').textContent   = 'BIG BASS';
  document.getElementById('cmTitle').textContent = slotName;
  document.getElementById('cmTask').innerHTML    =
    'Сыграй в <b>' + slotName + '</b>!<br>' + priceHtml;

  const declineBtn = document.querySelector('#cellModalStep1 .cm-decline');
  if (declineBtn) declineBtn.style.display = 'none';

  const overlay = document.getElementById('cellModalOverlay');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('open')));
}

// ══════════════════════════════════════════════════
//  ALL SLOTS
// ══════════════════════════════════════════════════
const ALL_SLOTS = [
  'Jammin Jars','Jammin Jars 2','Fat Banker','Razor Shark','Wild Swarm','Wild Swarm 2',
  'Joker Troupe','Tiki Tumble',"Squealin' Riches",'Wheel of Wishes','Land of Zenith',
  'Mystery Reels','Mystery Reels Megaways','Gemix 2','Blunderbust','Fat Drac','Chocolates',
  'Retrigger','Redfeather Falls','Midnight Marauder','Dinopolis','Boat Bonanza',
  'Boat Bonanza Colossal Catch','Snake Arena','Kraken Conquest','Cashpot Kegs','Giga Jar',
  'Honeycomb Bank','Gorilla Gold Megaways','Forge of Fortunes','Happy Riches','Lucky Joker 40',
  'Pulse of the City','Pine of Plinko','Burning Returns','Hand of Anubis','Pigs of Riches',
  'Book of Gold','Tombstone','Gold Party','Vegas Nights','Wild Fireworks','Cash Chips',
  'Inferno Joker','Book of Pyramids','Sticky Piggy','The Bowery Boys','King of Cats Megaways',
  'Fire Hopper','Midnight Rush',
  'Gates of Olympus','Gates of Olympus 1000','Sweet Bonanza','Sweet Bonanza 1000',
  'Starlight Princess','Starlight Princess 1000','Sugar Rush','Sugar Rush 1000',
  'The Dog House','The Dog House Megaways','The Dog House Multihold','Wolf Gold',
  'Fruit Party','Fruit Party 2','5 Lions Gold','5 Lions Megaways','Power of Thor Megaways',
  'Floating Dragon','Floating Dragon Hold & Spin','Fire Strike','Fire Strike 2',
  'John Hunter and the Tomb of the Scarab Queen','John Hunter and the Book of Tut',
  'John Hunter and the Aztec Treasure','Aztec Gems','Aztec Gems Deluxe','Congo Cash',
  'Wild West Gold','Wild West Gold Megaways','The Hand of Midas','Chilli Heat',
  'Chilli Heat Megaways','Pirate Gold','Pirate Gold Deluxe','Curse of the Werewolf Megaways',
  'Release the Kraken','Release the Kraken 2','Emerald King','Emerald King Rainbow Road',
  'Eye of Cleopatra','Queen of Gold','Gems Bonanza','Madame Destiny Megaways','Book of Fallen',
  'Joker King','Extra Juicy Megaways','Buffalo King','Buffalo King Megaways','Hot to Burn',
  'Hot to Burn Hold and Spin',"Fishin' Reels","Fishin' Reels Big Catch",'Ancient Egypt Classic',
  'Ancient Egypt','Asgard','Hercules and Pegasus','Lucky Grace and Charm','Lucky Lightning',
  'Pyramid Bonanza','Dragon Kingdom Eyes of Fire','Spirit of Adventure','Ultra Hold and Spin',
  'Cash Elevator','Striking Hot 5','Chicken Chase','Barn Festival','Big Juan','Smugglers Cove',
  'Tropical Tiki','Safari King','Three Star Fortune','Dragon Tiger','Muertos Multiplier Megaways',
  'xWays Hoarder xSplit','San Quentin xWays','Tombstone No Mercy','Mental','Punk Rocker',
  'San Quentin','Fire in the Hole 2','Deadwood','Deadwood xNudge','Poison Eve',
  'Infectious 5 xWays','Folsom Prison','El Paso Gunfight xNudge','Road Rage','Tombstone RIP',
  'Serial','Ice Ice Yeti','Thor Hammer Time','Pixies vs Pirates','Vegas Megaways','Dragon Tribe',
  'Barbarian Fury','Boot Hill Bandits','West Town','Bust the Bank','Misery Mining',
  'Space Wars 2 Powerpoints','Warrior Ways',"Monkey's Gold xPays",'Land of the Free xWays',
  'Hot Slot 777 Cash Out','San Quentin 2','Wixx','Village People Macho Moves','The Rave',
  'Blood & Shadow','Milky Ways','Tombstone: Blood & Gold',
  'Wanted Dead or a Wild','Chaos Crew','Chaos Crew 2','Stick Em','Stick Em Up','Stick Em Up 2',
  'Xways Hoarder','Cubes','Cubes 2','Cash Buster Towers','Cash Buster Extreme',
  'Scratchy McScratch','Lowdown Showdown',"Raider Jane's Crypt of Fortune",'Reel Joke',
  'Reel Joker','Space Miners','Fisticuffs','Cheeky Monkeys','Starzmania',
  'Goblin Heist Powernudge','Knife Hit','Viking Runecraft Bingo','Clover Rollout',
  'Flexi Fruits','Book of Rampage',"Wheel O'Gold",'The Respinners',
];

const STATIC_CELLS = new Set([
  'СТАРТ','БАНЯ','ШТРАФ','Шанс','Розыгрыш Сабам','МЕГА ХАЙ РОЛЛ','Big Bass'
]);

function getSlotStyle(slotName) {
  const push = ['Jammin Jars','Fat Banker','Razor Shark','Wild Swarm','Joker Troupe',
    'Tiki Tumble','Squealin','Wheel of Wishes','Land of Zenith','Mystery Reels','Gemix',
    'Blunderbust','Fat Drac','Chocolates','Retrigger','Redfeather','Midnight Marauder',
    'Dinopolis','Boat Bonanza','Snake Arena','Kraken','Cashpot','Giga Jar','Honeycomb',
    'Gorilla','Forge','Happy Riches','Lucky Joker','Pulse','Pine of Plinko','Burning',
    'Hand of Anubis','Pigs','Book of Gold','Tombstone','Gold Party','Vegas Nights',
    'Wild Fireworks','Cash Chips','Inferno Joker','Book of Pyramids','Sticky Piggy',
    'Bowery','King of Cats','Fire Hopper','Midnight Rush'];
  const nolimit = ['xWays','San Quentin','Tombstone No Mercy','Mental','Punk Rocker',
    'Fire in the Hole','Deadwood','Poison Eve','Infectious','Folsom','El Paso','Road Rage',
    'Serial','Ice Ice Yeti','Thor Hammer','Pixies vs Pirates','Vegas Megaways','Dragon Tribe',
    'Barbarian','Boot Hill','West Town','Bust the Bank','Misery','Space Wars','Warrior Ways',
    "Monkey's Gold",'Land of the Free','Hot Slot','Wixx','Village People','The Rave',
    'Blood & Shadow','Milky Ways'];
  const hacksaw = ['Wanted Dead','Chaos Crew','Stick Em','Xways Hoarder','Cubes',
    'Cash Buster','Scratchy','Lowdown','Raider Jane','Reel Joke','Reel Joker','Space Miners',
    'Fisticuffs','Cheeky','Starzmania','Goblin Heist','Knife Hit','Viking Runecraft',
    'Clover Rollout','Flexi Fruits','Book of Rampage',"Wheel O'Gold",'Respinners'];

  const s = slotName;
  if (push.some(p => s.includes(p)))    return { color:'#f4a261', css:'orange', icon:'🎰' };
  if (nolimit.some(p => s.includes(p))) return { color:'#e63946', css:'red',    icon:'🔫' };
  if (hacksaw.some(p => s.includes(p))) return { color:'#a78bfa', css:'purple', icon:'⚔️' };
  return { color:'#f5c842', css:'yellow', icon:'🎰' };
}

function applySlotToCell(cellEl, slotName) {
  const style = getSlotStyle(slotName);
  const strip  = cellEl.querySelector('.strip');
  const icon   = cellEl.querySelector('.cell-icon');
  const name   = cellEl.querySelector('.cell-name');
  if (!strip || !icon || !name) return;

  strip.className = 'strip';
  strip.removeAttribute('style');
  if (style.css) strip.classList.add(style.css);

  icon.textContent = style.icon;
  name.textContent = slotName;
  name.style.cssText = '--c:' + style.color + ';color:var(--c)';

  // Tiny neon glow: use a data attribute so CSS does the work,
  // never touching inline style (which would break grid-column lookup)
  cellEl.dataset.glowColor = style.css || '';

  cellEl.classList.remove('cell-refresh');
  void cellEl.offsetWidth;
  cellEl.classList.add('cell-refresh');
}

function getRandomSlots(count) {
  const shuffled = [...ALL_SLOTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function getChangeableCells() {
  const board = document.querySelector('.board');
  if (!board) return [];
  return [...board.querySelectorAll('.cell:not(.corner)')].filter(cell => {
    const name = cell.querySelector('.cell-name');
    if (!name) return false;
    return !STATIC_CELLS.has(name.textContent.trim());
  });
}

function initBoardSlots() {
  const cells = getChangeableCells();
  const slots = getRandomSlots(cells.length);
  cells.forEach((cell, i) => applySlotToCell(cell, slots[i]));
}

function refreshBoardSlots() {
  const cells = getChangeableCells();
  const slots = getRandomSlots(cells.length);
  cells.forEach((cell, i) => {
    setTimeout(() => applySlotToCell(cell, slots[i]), i * 40);
  });
}

// ══════════════════════════════════════════════════
//  WALK WITH LAP PAUSE
// ══════════════════════════════════════════════════
async function walkTokenWithLapPause(from, steps) {
  const N = BOARD_CELLS.length;
  let lapTriggered = false;

  for (let i = 1; i <= steps; i++) {
    const prev = (from + i - 1) % N;
    const next = (from + i)     % N;

    await new Promise(r => setTimeout(r, 310));
    placeToken(next, true);

    // Lap = wraparound: next numerically < prev means we crossed index 0
    if (next < prev && !lapTriggered) {
      lapTriggered = true;
      await new Promise(r => setTimeout(r, 500));
      lapMultiplier++;
      updateMultiplierWidget();
      showToast('gold', '\u{1F504}', 'ЗАДАНИЯ МЕНЯЮТСЯ', 'Новый круг! Мультипликатор x' + lapMultiplier);
      refreshBoardSlots();
      await new Promise(r => setTimeout(r, 700));
    }
  }
}

// ══════════════════════════════════════════════════
//  SLOT TASK GENERATOR
// ══════════════════════════════════════════════════
const BONUS_BUY_SLOTS = new Set([
  'Gates of Olympus','Gates of Olympus 1000','Sweet Bonanza','Sweet Bonanza 1000',
  'Starlight Princess','Starlight Princess 1000','Sugar Rush','Sugar Rush 1000',
  'The Dog House','The Dog House Megaways','The Dog House Multihold','Wolf Gold',
  'Fruit Party','Fruit Party 2','5 Lions Gold','5 Lions Megaways','Power of Thor Megaways',
  'Floating Dragon','Floating Dragon Hold & Spin','Fire Strike','Fire Strike 2',
  'John Hunter and the Tomb of the Scarab Queen','John Hunter and the Book of Tut',
  'John Hunter and the Aztec Treasure','Aztec Gems Deluxe','Wild West Gold',
  'Wild West Gold Megaways','The Hand of Midas','Chilli Heat Megaways','Pirate Gold Deluxe',
  'Curse of the Werewolf Megaways','Release the Kraken','Release the Kraken 2',
  'Emerald King Rainbow Road','Queen of Gold','Gems Bonanza','Madame Destiny Megaways',
  'Book of Fallen','Extra Juicy Megaways','Buffalo King Megaways','Hot to Burn Hold and Spin',
  "Fishin' Reels","Fishin' Reels Big Catch",'Pyramid Bonanza',
  'Dragon Kingdom Eyes of Fire','Ultra Hold and Spin','Muertos Multiplier Megaways',
  'Chicken Chase','Big Juan','Barn Festival',
  'Jammin Jars','Jammin Jars 2','Fat Banker','Razor Shark','Wild Swarm','Wild Swarm 2',
  'Joker Troupe','Land of Zenith','Gemix 2','Fat Drac','Dinopolis','Boat Bonanza',
  'Boat Bonanza Colossal Catch','Giga Jar','Gorilla Gold Megaways','Hand of Anubis',
  'Book of Pyramids','King of Cats Megaways','Fire Hopper',
  'xWays Hoarder xSplit','San Quentin xWays','Tombstone No Mercy','Mental','Punk Rocker',
  'San Quentin','Fire in the Hole 2','Deadwood','Deadwood xNudge','Poison Eve',
  'Infectious 5 xWays','Folsom Prison','El Paso Gunfight xNudge','Road Rage',
  'Tombstone RIP','Serial','Ice Ice Yeti','Thor Hammer Time','Dragon Tribe',
  'Barbarian Fury','Boot Hill Bandits','Misery Mining','Space Wars 2 Powerpoints',
  'Warrior Ways',"Monkey's Gold xPays",'Land of the Free xWays','Hot Slot 777 Cash Out',
  'San Quentin 2','Village People Macho Moves','Blood & Shadow','Tombstone: Blood & Gold',
  'Wanted Dead or a Wild','Chaos Crew','Chaos Crew 2','Stick Em Up','Stick Em Up 2',
  'Cubes','Cubes 2','Lowdown Showdown',"Raider Jane's Crypt of Fortune",
  'Starzmania','Goblin Heist Powernudge','Book of Rampage','The Respinners',
]);

function generateSlotTask(slotName) {
  const canBuy = BONUS_BUY_SLOTS.has(slotName);
  const roll   = Math.random();
  if (canBuy) {
    return roll < 0.75
      ? 'Купи бонуску в <b>' + slotName + '</b>!'
      : 'Поспинь <b>' + slotName + '</b>!';
  }
  return 'Поспинь <b>' + slotName + '</b>!';
}

// ══════════════════════════════════════════════════
//  ВСЕОБЩИЙ НАЖИД
// ══════════════════════════════════════════════════
function handleNazhid() {
  const roll = Math.random();
  if (roll < 0.2) {
    openDropsModal();
  } else {
    openNazhidModal();
  }
}

function openNazhidModal() {
  const price = Math.round(getFinalTaskPrice() * 0.1);

  let priceHtml = '<span class="cm-price">' + price.toLocaleString('ru') + ' ₽';
  const mult = getTotalMultiplier();
  if (mult > 1 || doubleDiscount) {
    const parts = [];
    if (lapMultiplier > 1) parts.push('круг x' + lapMultiplier);
    if (penaltyMult > 1)   parts.push('штраф x' + penaltyMult);
    if (doubleDiscount)    parts.push('дубль −50%');
    priceHtml += ' <span class="cm-price-meta">(' + parts.join(', ') + ')</span>';
  }
  priceHtml += '</span>';

  const moneyNow = parseInt((document.getElementById('playerMoney')?.textContent || '0').replace(/[^\d]/g,'')) || 0;
  if (checkDeath(moneyNow, price)) return;

  document.getElementById('cmIcon').textContent  = '🎁';
  document.getElementById('cmTag').textContent   = 'РОЗЫГРЫШ';
  document.getElementById('cmTitle').textContent = 'Розыгрыш Сабам';
  document.getElementById('cmTask').innerHTML    =
    'Разыграй сумму подписчикам — колесо, бот или пикни из чата!<br>' + priceHtml;

  const overlay = document.getElementById('cellModalOverlay');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('open')));
}

// ══════════════════════════════════════════════════
//  DROPS MODAL — EPIC CINEMATIC ENTRANCE
// ══════════════════════════════════════════════════
function openDropsModal() {
  const el = document.getElementById('dropsModal');
  el.style.display = 'flex';

  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.classList.add('open');
    spawnDropsCoins();
    spawnDropsLightRays();
  }));
}

function closeDropsModal() {
  const el = document.getElementById('dropsModal');

  const card = el.querySelector('.drops-card');
  if (card) {
    card.style.transition = 'transform 0.35s cubic-bezier(.55,0,1,.45), opacity 0.3s ease';
    card.style.transform  = 'scale(1.1) translateY(-20px) rotate(3deg)';
    card.style.opacity    = '0';
  }

  el.style.transition = 'opacity 0.4s ease';
  el.style.opacity    = '0';

  setTimeout(() => {
    el.classList.remove('open');
    el.style.display    = 'none';
    el.style.opacity    = '';
    el.style.transition = '';
    if (card) {
      card.style.transition = '';
      card.style.transform  = '';
      card.style.opacity    = '';
    }
  }, 420);

  unlockButtons();
}

function spawnDropsCoins() {
  const coins  = ['🪙','💰','🤑','💎','⭐','✨'];
  const count  = 22;
  const cx     = window.innerWidth  / 2;
  const cy     = window.innerHeight / 2;

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const coinEl = document.createElement('div');
      coinEl.className = 'drops-coin';
      coinEl.textContent = coins[Math.floor(Math.random() * coins.length)];
      coinEl.style.left = cx + 'px';
      coinEl.style.top  = cy + 'px';
      coinEl.style.fontSize = (18 + Math.random() * 22) + 'px';
      document.body.appendChild(coinEl);

      const angle = (Math.random() * 360) * (Math.PI / 180);
      const dist  = 200 + Math.random() * 350;
      const dx    = Math.cos(angle) * dist;
      const dy    = Math.sin(angle) * dist;
      const rot   = (Math.random() - 0.5) * 720;
      const dur   = 900 + Math.random() * 600;

      coinEl.animate([
        { transform: `translate(-50%,-50%) scale(0) rotate(0deg)`, opacity: 0 },
        { transform: `translate(calc(-50% + ${dx*0.3}px), calc(-50% + ${dy*0.3}px)) scale(1.4) rotate(${rot*0.3}deg)`, opacity: 1, offset: 0.25 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.6) rotate(${rot}deg)`, opacity: 0 }
      ], {
        duration: dur,
        easing: 'cubic-bezier(.2,.6,.4,1)',
        fill: 'forwards'
      });

      setTimeout(() => coinEl.remove(), dur + 100);
    }, i * 35);
  }
}

function spawnDropsLightRays() {
  const rayCount = 10;
  const cx = window.innerWidth  / 2;
  const cy = window.innerHeight / 2;

  for (let i = 0; i < rayCount; i++) {
    const ray   = document.createElement('div');
    const angle = (i / rayCount) * 360;
    const len   = 600 + Math.random() * 400;

    ray.style.cssText = `
      position: fixed;
      left: ${cx}px;
      top:  ${cy}px;
      width: ${2 + Math.random() * 3}px;
      height: ${len}px;
      background: linear-gradient(180deg, rgba(80,255,80,0.8) 0%, rgba(80,255,80,0) 100%);
      transform-origin: top center;
      transform: translateX(-50%) rotate(${angle}deg);
      border-radius: 2px;
      pointer-events: none;
      z-index: 708;
      opacity: 0;
      filter: blur(1px);
    `;
    document.body.appendChild(ray);

    ray.animate([
      { opacity: 0,   transform: `translateX(-50%) rotate(${angle}deg) scaleY(0)` },
      { opacity: 0.7, transform: `translateX(-50%) rotate(${angle}deg) scaleY(1)`, offset: 0.3 },
      { opacity: 0,   transform: `translateX(-50%) rotate(${angle + 15}deg) scaleY(1.2)` }
    ], {
      duration: 700,
      delay: i * 30,
      easing: 'cubic-bezier(.2,.8,.4,1)',
      fill: 'forwards'
    });

    setTimeout(() => ray.remove(), 900 + i * 30);
  }
}

// ══════════════════════════════════════════════════
//  ДОДЕП
// ══════════════════════════════════════════════════
let totalLostAmount = 0; // накопленная сумма проигрышей + додепов

function openDodepModal() {
  const overlay = document.getElementById('dodepOverlay');
  const input   = document.getElementById('dodepInput');
  if (!overlay) return;
  input.value = '';
  overlay.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    overlay.classList.add('open');
    setTimeout(() => input.focus(), 350);
  }));
}

function closeDodepModal() {
  const overlay = document.getElementById('dodepOverlay');
  overlay.classList.remove('open');
  setTimeout(() => { overlay.style.display = 'none'; }, 320);
}

function confirmDodep() {
  const input  = document.getElementById('dodepInput');
  const amount = parseInt(input.value) || 0;
  if (amount <= 0) {
    input.style.borderColor = 'rgba(230,57,70,0.7)';
    input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
    setTimeout(() => { input.style.borderColor = 'rgba(245,166,35,0.3)'; }, 600);
    return;
  }

  // Добавляем к балансу игрока
  const moneyEl  = document.getElementById('playerMoney');
  const curBal   = parseInt((moneyEl ? moneyEl.textContent : '0').replace(/[^\d]/g,'')) || 0;
  const newBal   = curBal + amount;
  if (moneyEl) moneyEl.textContent = newBal.toLocaleString('ru');

  // Обновляем стартовый капитал — додеп увеличивает базис,
  // чтобы следующий showLose правильно считал проигрыш (включая сумму додепа)
  window._startCapital = (window._startCapital || 0) + amount;

  // Закрываем модал додепа
  closeDodepModal();

  // Закрываем экран поражения
  const screenLose = document.getElementById('screenLose');
  if (screenLose) {
    screenLose.classList.remove('show');
    setTimeout(() => { screenLose.style.display = 'none'; }, 500);
  }

  // Тост об успешном додепе
  setTimeout(() => showDodepToast(amount), 350);

  // Разблокируем кнопки
  setTimeout(() => unlockButtons(), 400);
}

function showDodepToast(amount) {
  // Убираем старые тосты додепа
  document.querySelectorAll('.dodep-toast').forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = 'dodep-toast';
  toast.innerHTML =
    '<span class="dodep-toast-icon">💰</span>' +
    '<div>' +
      '<div class="dodep-toast-title">ДОДЕП ЗАСЧИТАН!</div>' +
      '<div class="dodep-toast-sub">+' + amount.toLocaleString('ru') + ' ₽ добавлено к балансу</div>' +
    '</div>';
  document.body.appendChild(toast);

  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 500);
  }, 3500);
}

/* Shake for dodep input */

// ══════════════════════════════════════════════════
//  SURRENDER
// ══════════════════════════════════════════════════
function surrender() {
  const moneyEl = document.getElementById('playerMoney');
  const balance = parseInt((moneyEl ? moneyEl.textContent : '0').replace(/[^\d]/g,'')) || 0;
  // Force the lose screen immediately
  showLose(0, 0);
}

// ══════════════════════════════════════════════════
//  LEADERBOARD WIDGET
// ══════════════════════════════════════════════════
function updateLeaderboard() {
  const widget = document.getElementById('leaderboardWidget');
  if (!widget) return;
  widget.style.display = 'flex';
  if (taskHistory.length === 0) {
    // show empty state, widget stays visible
    document.getElementById('lbBest').innerHTML = '<div class="lb-empty">Заданий пока нет…</div>';
    document.getElementById('lbWorst').innerHTML = '<div class="lb-empty">Заданий пока нет…</div>';
    document.getElementById('lbAll').innerHTML = '';
    const avgBadge = document.getElementById('lbAvgBadge');
    if (avgBadge) avgBadge.style.display = 'none';
    return;
  }

  // Update header stats badge: total profit | avg x
  const totalProfit = taskHistory.reduce((s, t) => s + t.returned, 0);
  // ROI = currentBalance / startCapital (e.g. 140к / 100к = 1.4x)
  const startCap  = window._startCapital || 1;
  const moneyNowEl = document.getElementById('playerMoney');
  const curBalance = parseInt((moneyNowEl ? moneyNowEl.textContent : '0').replace(/[^\d]/g,'')) || 0;
  const sessionRoi = startCap > 0 ? curBalance / startCap : 0;
  const avgBadge = document.getElementById('lbAvgBadge');
  if (avgBadge) {
    avgBadge.style.display = 'inline-flex';
    const roiColor  = sessionRoi >= 1 ? '#2dc653' : '#e63946';
    const profColor = totalProfit >= 0 ? '#2dc653' : '#e63946';
    function fmtShort(n) {
      const abs = Math.abs(n);
      let s;
      if (abs >= 1000000) s = (n/1000000).toFixed(1) + 'М';
      else if (abs >= 1000) s = (n/1000).toFixed(0) + 'к';
      else s = n.toString();
      return (n > 0 ? '+' : '') + s;
    }
    avgBadge.innerHTML =
      '<span class="lb-avg-total" style="color:' + profColor + '">' + fmtShort(totalProfit) + '₽</span>' +
      '<span class="lb-avg-sep">|</span>' +
      '<span class="lb-avg-x" style="color:' + roiColor + '">' + sessionRoi.toFixed(2) + 'x</span>';
  }

  const sorted = [...taskHistory].sort((a, b) => b.roiCoef - a.roiCoef);
  const best  = sorted[0];
  const worst = sorted[sorted.length - 1];

  function fmt(n) {
    const abs = Math.abs(n);
    if (abs >= 1000000) return (n/1000000).toFixed(1) + 'М';
    if (abs >= 1000) return (n/1000).toFixed(0) + 'к';
    return n.toString();
  }
  function roiStr(r) {
    return (r >= 0 ? '' : '') + r.toFixed(2) + 'x';
  }
  function roiColor(r) {
    return r >= 1 ? '#2dc653' : '#e63946';
  }
  function taskRow(t, isBest) {
    const color = roiColor(t.roiCoef);
    const badge = isBest === true ? '🏆' : isBest === false ? '💀' : '▸';
    // Compact: name | cost | roi (result hidden via CSS)
    return `<div class="lb-row ${isBest === true ? 'lb-best' : isBest === false ? 'lb-worst' : 'lb-normal'}">
      <span class="lb-badge">${badge}</span>
      <span class="lb-name" title="${t.name}">${t.name}</span>
      <span class="lb-cost">${fmt(t.cost)}₽</span>
      <span class="lb-roi" style="color:${color}">${roiStr(t.roiCoef)}</span>
      <span class="lb-result"></span>
    </div>`;
  }

  const allRows = taskHistory.map((t, i) => {
    const isBest  = t === best && taskHistory.length > 1;
    const isWorst = t === worst && taskHistory.length > 1;
    return taskRow(t, isBest ? true : isWorst ? false : null);
  }).join('');

  // If only 1 task, show it as best
  const bestHtml  = taskRow(best, true);
  const worstHtml = taskHistory.length > 1 ? taskRow(worst, false) : '';

  document.getElementById('lbBest').innerHTML  = bestHtml;
  document.getElementById('lbWorst').innerHTML = taskHistory.length > 1 ? worstHtml : '<div class="lb-empty">Нужно больше заданий…</div>';
  document.getElementById('lbAll').innerHTML   = allRows;

  // Auto-scroll to bottom so newest entry is always visible
  requestAnimationFrame(() => {
    const scrollEl = document.querySelector('.lb-all-scroll');
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  });
}

// ══════════════════════════════════════════════════
//  MOVE COUNTER
// ══════════════════════════════════════════════════
function bumpMoveCounter(n) {
  totalMoves += n;
  const el = document.getElementById('moveCount');
  if (!el) return;
  el.textContent = totalMoves;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 350);
}

// ══════════════════════════════════════════════════
//  МЕГА ХАЙ РОЛЛ
// ══════════════════════════════════════════════════
const MHR_TASKS = [
  { name: 'АРБУЗ АРБУЗ',  task: 'Смирно встал нахуй! Сделай 40 спинов по 5к!', cost: 200000 },
  { name: 'Я НЕ АНДРЕЙ',  task: 'САНЯ ЗА 400 ЛЕТС ГОУУУУУУУУ',                  cost: 400000 },
  { name: 'КУРИЦА УПАЛА', task: 'ЧИКЕН ДРОП ЗА 200 ПОД Я КУРИЦА!',              cost: 200000 },
];

let _mhrCurrentTask   = null;
let _mhrBalanceBefore = 0;

function openMhrModal() {
  const rand = Math.random();
  let result;
  if      (rand < 0.40) result = { type: 'lucky' };
  else if (rand < 0.60) result = { type: 'task', ...MHR_TASKS[0] };
  else if (rand < 0.80) result = { type: 'task', ...MHR_TASKS[1] };
  else                  result = { type: 'task', ...MHR_TASKS[2] };

  // Проверяем баланс только для задания
  if (result.type === 'task') {
    const moneyNow = parseInt((document.getElementById('playerMoney')?.textContent || '0').replace(/[^\d]/g,'')) || 0;
    if (checkDeath(moneyNow, result.cost)) return;
  }

  _mhrCurrentTask = result.type === 'task' ? result : null;

  const overlay   = document.getElementById('vnOverlay');
  const modal     = document.getElementById('vnModal');
  const s1        = document.getElementById('vnStep1');
  const s2        = document.getElementById('vnStep2');
  const strip     = document.getElementById('vnHeaderStrip');
  const icon      = document.getElementById('vnIcon');
  const title     = document.getElementById('vnTitle');
  const label     = document.getElementById('vnResultLabel');
  const name      = document.getElementById('vnResultName');
  const taskEl    = document.getElementById('vnResultTask');
  const noMult    = document.getElementById('vnNoMult');
  const btn       = document.getElementById('vnBtn');
  const shockwave = document.getElementById('vnShockwave');

  s1.style.display = 'flex'; s1.style.animation = '';
  s2.style.display = 'none'; s2.style.animation = '';
  document.getElementById('vnResultInput').value = '';

  modal.classList.remove('vn-lucky', 'vn-danger', 'vn-close-red', 'vn-close-green');
  overlay.classList.remove('vn-lucky-bg', 'vn-danger-bg');

  if (result.type === 'lucky') {
    gainHeart();
    modal.classList.add('vn-lucky');
    overlay.classList.add('vn-lucky-bg');
    strip.style.background = 'linear-gradient(90deg,#2dc653,#00ff88,#2dc653)';
    icon.textContent   = '❤️';
    title.textContent  = 'ТЕБЕ ПОВЕЗЛО!';
    label.textContent  = '+1 ❤️ ПОЛУЧЕНО';
    name.textContent   = 'ЭКСТРА ЖИЗНЬ!';
    taskEl.textContent = '';
    if (noMult) noMult.style.display = 'none';
    btn.textContent = '🎉 КРАСОТА!';
    btn.onclick     = () => closeMhrGreen();
  } else {
    modal.classList.add('vn-danger');
    overlay.classList.add('vn-danger-bg');
    strip.style.background = 'linear-gradient(90deg,#e63946,#ff2244,#e63946)';
    icon.textContent   = '💀';
    title.textContent  = 'МЕГА ХАЙ РОЛЛ!';
    label.textContent  = result.name;
    name.textContent   = '';
    taskEl.textContent = result.task;
    if (noMult) {
      noMult.style.display = 'flex';
      noMult.textContent   = '⚠️ Усложнения не применяются · ' + (result.cost / 1000) + 'к ₽';
    }
    btn.textContent = '💀 ПРИНЯЛ';
    btn.onclick     = () => goToMhrStep2();
  }

  overlay.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    overlay.classList.add('open');
    modal.classList.add('vn-explode');
    shockwave.classList.remove('vn-sw-active');
    void shockwave.offsetWidth;
    shockwave.classList.add('vn-sw-active');
    setTimeout(() => shockwave.classList.remove('vn-sw-active'), 700);
    setTimeout(() => modal.classList.remove('vn-explode'), 600);
  }));
}

function goToMhrStep2() {
  const moneyEl = document.getElementById('playerMoney');
  _mhrBalanceBefore = parseInt((moneyEl ? moneyEl.textContent : '0').replace(/[^\d]/g,'')) || 0;
  const s1 = document.getElementById('vnStep1');
  const s2 = document.getElementById('vnStep2');
  s1.style.animation = 'cmSlideOut 0.25s ease-in forwards';
  setTimeout(() => {
    s1.style.display = 'none'; s1.style.animation = '';
    s2.style.display = 'flex';
    s2.style.animation = 'cmSlideIn 0.3s cubic-bezier(.22,1,.36,1) forwards';
    const input = document.getElementById('vnResultInput');
    input.value = ''; input.focus();
    const nameEl = document.getElementById('vnStep2TaskName');
    if (nameEl && _mhrCurrentTask) nameEl.textContent = _mhrCurrentTask.name;
  }, 220);
}

// ── Закрытие: зелёное (ТЕБЕ ПОВЕЗЛО!) — улетает вверх ──
function closeMhrGreen() {
  const overlay = document.getElementById('vnOverlay');
  const modal   = document.getElementById('vnModal');
  // Зелёное конфетти-вспышка
  spawnMhrGreenFlash();
  modal.classList.add('vn-close-green');
  setTimeout(() => {
    overlay.classList.remove('open');
    setTimeout(() => {
      overlay.style.display = 'none';
      modal.classList.remove('vn-close-green');
    }, 350);
  }, 280);
  setTimeout(() => unlockButtons(), 650);
}

// ── Закрытие: красное (после ввода баланса) — схлопывается вниз ──
function closeMhrRed() {
  const overlay = document.getElementById('vnOverlay');
  const modal   = document.getElementById('vnModal');
  modal.classList.add('vn-close-red');
  setTimeout(() => {
    overlay.classList.remove('open');
    setTimeout(() => {
      overlay.style.display = 'none';
      modal.classList.remove('vn-close-red');
    }, 320);
  }, 250);
  setTimeout(() => unlockButtons(), 580);
}

function spawnMhrGreenFlash() {
  const flash = document.createElement('div');
  flash.style.cssText = `
    position:fixed; inset:0;
    background:radial-gradient(ellipse at center, rgba(45,198,83,0.35) 0%, transparent 70%);
    z-index:799; pointer-events:none;
    animation:mhrGreenFlash 0.6s ease-out forwards;
  `;
  document.body.appendChild(flash);
  if (!document.getElementById('mhrGreenFlashKF')) {
    const st = document.createElement('style');
    st.id = 'mhrGreenFlashKF';
    st.textContent = '@keyframes mhrGreenFlash{0%{opacity:1;transform:scale(0.5)}50%{opacity:1;transform:scale(1.2)}100%{opacity:0;transform:scale(1.5)}}';
    document.head.appendChild(st);
  }
  setTimeout(() => flash.remove(), 700);
}

function submitMhrResult() {
  const input = document.getElementById('vnResultInput');
  const val   = input.value.trim();
  if (!val) {
    input.style.borderColor = 'rgba(230,57,70,0.8)';
    input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
    setTimeout(() => { input.style.borderColor = ''; }, 700);
    return;
  }
  const newBalance = parseInt(val) || 0;
  const moneyEl    = document.getElementById('playerMoney');
  if (moneyEl) moneyEl.textContent = newBalance.toLocaleString('ru');

  if (_mhrCurrentTask) {
    const cost     = _mhrCurrentTask.cost;
    const returned = newBalance - _mhrBalanceBefore;
    const roiCoef  = cost > 0 ? returned / cost : 0;
    taskHistory.push({
      name: _mhrCurrentTask.name, cost, returned, roiCoef,
      balanceBefore: _mhrBalanceBefore, balanceAfter: newBalance,
    });
    totalTasksSpent += cost;
    updateLeaderboard();
  }

  const diff = newBalance - _mhrBalanceBefore;
  if (diff > 0) setTimeout(() => dealDamageToBoss(Math.round(diff * 0.1)), 350);

  closeMhrRed();
}

// ══════════════════════════════════════════════════
//  ШАНС — КАРТЫ
// ══════════════════════════════════════════════════
const CHANCE_CARDS = [
  {
    id: 1, name: 'АПТЕЧКА', icon: '❤️‍🩹', color: 'ch-green',
    title: 'АПТЕЧКА',
    body: 'Восстанови одно красное ❤️!<br><span class="ch-note">Только базовое — не зелёное доп. сердце.</span>',
    effect: 'heal', btn: '❤️ ПОЛУЧИТЬ'
  },
  {
    id: 2, name: 'ЗЕРО НЕ ПРОЙДЁТ', icon: '🎲', color: 'ch-red',
    title: 'НА ТРЕТИЙ СЕКТОР!',
    body: 'Поставь <b>50 000 ₽</b> на третий сектор в любой лайв-рулетке прямо сейчас!',
    effect: 'roulette', buyCost: 50000, btn: '🎲 ЛЕТС ГОУ!'
  },
  {
    id: 3, name: 'ВИП КЛУБ', icon: '💎', color: 'ch-purple',
    title: 'ВИП КЛУБ',
    body: 'Дай Эле Сик Севен VIP-ку.<br><span class="ch-note">Опционально. Никто не принуждает.</span>',
    effect: null, btn: '💎 ОКЕЙ'
  },
  {
    id: 4, name: 'ЧТО ИДЁТ ПОСЛЕ ШЕСТИ?', icon: '7️⃣', color: 'ch-mystery',
    title: 'ПРАВИЛЬНО — СЕМЬ.',
    body: 'Что идёт после шести?<br>Правильно, СЕМЬ.',
    image: '/images/chance_seven.png', effect: null, btn: '7️⃣ ПОНЯЛ!'
  },
  {
    id: 5, name: 'МОЛЧИ, САБЁНОК', icon: '🔇', color: 'ch-blue',
    title: 'ТИХИЙ ЧАС',
    body: 'Пикни рандомного саба из чата и дай ему мут на 30 минут.<br><span class="ch-note">Хаотичная нейтральность.</span>',
    effect: null, btn: '🔇 ПРИНЯЛ!'
  },
  {
    id: 6, name: 'ЛИФТОВОЙ АПОКАЛИПСИС', icon: '🛗', color: 'ch-amber',
    title: 'ЛИФТ ЖДЁТ!',
    body: 'Проверь лифт. Там могут быть твои родители.<br>Они ждут. Уже давно.',
    image: '/images/chance_lift.png', effect: null, btn: '🛗 ПОНЯЛ!'
  },
  {
    id: 7, name: 'МЕЦЕНАТ', icon: '💸', color: 'ch-gold',
    title: 'ДЛЯ НЕГО ЭТО ДЕНЬГИ?',
    body: '<b>Дай 500 ₽</b> первому, кто напишет свой айди в чате.<br><span class="ch-note">Парни, прикиньте!</span>',
    effect: null, btn: '💸 ПРИНЯЛ!'
  },
  {
    id: 8, name: 'СЛАДКАЯ КОНФЕТКА', icon: '💋', color: 'ch-pink',
    title: 'О ДА ДЕТКА ТЫ ТАКАЯ СЛАДКАЯ КОНФЕТКА',
    body: 'Поцелуй Настю 💋<br><span class="ch-note">Если Настя недоступна — скипни. Каблук.</span>',
    effect: null, btn: '💋 УЖЕ ЦЕЛУЮ'
  },
  {
    id: 9, name: 'НА РЫБАЛКУ!', icon: '🎣', color: 'ch-teal',
    title: 'НЕМНОГО РЫБАЛКИ',
    body: 'Крути Колесо Фортуны Big Bass! Удача не ждёт.',
    effect: 'wheel', btn: '🎣 НА РЫБАЛКУ!'
  },
  {
    id: 10, name: 'ПОПРЫГАЕМ?', icon: '🏟️', color: 'ch-orange',
    title: 'КУПИ МИНОТАВРА!',
    body: 'Купи Минотавра на 4-м секторе за <b>50 000 ₽</b>.<br><span class="ch-note">Попрыгаем?</span>',
    effect: 'buy', buyCost: 50000, btn: '🏟️ ПРИНЯЛ!'
  },
];

let _currentChanceCard = null;
let _chanceBalanceBefore = 0;

function openChanceModal() {
  sfxDrumRoll(1.2);
  const idx  = Math.floor(Math.random() * CHANCE_CARDS.length);
  _currentChanceCard = CHANCE_CARDS[idx];
  _renderChanceStep1(_currentChanceCard);
}

function _renderChanceStep1(card) {
  const overlay = document.getElementById('chanceOverlay');
  const cardEl  = document.getElementById('chanceCard');
  const step1   = document.getElementById('chanceStep1');
  const step2   = document.getElementById('chanceStep2');

  if (step2) { step2.style.display = 'none'; step2.style.animation = ''; }
  if (step1) { step1.style.display = 'flex'; step1.style.animation = ''; }

  cardEl.className = 'chance-card ' + card.color;
  document.getElementById('chanceCardIcon').textContent = card.icon;
  document.getElementById('chanceCardNum').textContent  = card.id + ' / ' + CHANCE_CARDS.length;
  document.getElementById('chanceImgWrap').style.display = 'none';

  if (card.image) {
    const imgEl = document.getElementById('chanceImg');
    imgEl.src = card.image;
    document.getElementById('chanceImgWrap').style.display = 'flex';
  }

  // Heal: check max HP before showing
  if (card.effect === 'heal') {
    const healed = restoreRedHeart();
    if (!healed) {
      document.getElementById('chanceCardTitle').textContent = 'ПОЛНОЕ ЗДОРОВЬЕ!';
      document.getElementById('chanceCardBody').innerHTML =
        'У тебя уже все сердца целые ❤️!<br><span class="ch-note">Бонус сгорает. Повезёт в другой раз.</span>';
      document.getElementById('chanceActionBtn').textContent = '😊 ОК';
    } else {
      document.getElementById('chanceCardTitle').textContent = card.title;
      document.getElementById('chanceCardBody').innerHTML    = card.body;
      document.getElementById('chanceActionBtn').textContent = card.btn;
    }
  } else {
    document.getElementById('chanceCardTitle').textContent = card.title;
    document.getElementById('chanceCardBody').innerHTML    = card.body;
    document.getElementById('chanceActionBtn').textContent = card.btn;
  }

  overlay.style.display = 'flex';
  cardEl.classList.remove('ch-flip-in', 'ch-flip-out');
  void cardEl.offsetWidth;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    overlay.classList.add('open');
    cardEl.classList.add('ch-flip-in');
  }));
}

function handleChanceBtnClick() {
  const card = _currentChanceCard;

  if (card && card.effect === 'wheel') {
    closeChanceModal(true);
    const price = getFinalTaskPrice();
    const moneyNow = parseInt((document.getElementById('playerMoney')?.textContent||'0').replace(/[^\d]/g,''))||0;
    if (checkDeath(moneyNow, price)) return;
    setTimeout(() => openWheelModal('Big Bass'), 400);
    return;
  }

  if (card && card.effect === 'buy') {
    const moneyEl = document.getElementById('playerMoney');
    _chanceBalanceBefore = parseInt((moneyEl ? moneyEl.textContent : '0').replace(/[^\d]/g,'')) || 0;
    const step1 = document.getElementById('chanceStep1');
    const step2 = document.getElementById('chanceStep2');
    const nameEl  = document.getElementById('chanceStep2Name');
    const costEl  = document.getElementById('chanceStep2Cost');
    const iconEl2 = document.getElementById('chanceStep2Icon');
    if (nameEl)  nameEl.textContent  = card.title;
    if (costEl)  costEl.textContent  = (card.buyCost / 1000) + 'к ₽';
    if (iconEl2) iconEl2.textContent = card.icon;
    const inp = document.getElementById('chanceBalanceInput');
    if (inp) inp.value = '';
    step1.style.animation = 'cmSlideOut 0.22s ease-in forwards';
    setTimeout(() => {
      step1.style.display = 'none'; step1.style.animation = '';
      step2.style.display = 'flex';
      step2.style.animation = 'cmSlideIn 0.3s cubic-bezier(.22,1,.36,1) forwards';
      if (inp) inp.focus();
    }, 200);
    return;
  }

  if (card && card.effect === 'roulette') {
    spawnRouletteAnimation(() => {
      const moneyEl = document.getElementById('playerMoney');
      _chanceBalanceBefore = parseInt((moneyEl ? moneyEl.textContent : '0').replace(/[^\d]/g,'')) || 0;
      const step1   = document.getElementById('chanceStep1');
      const step2   = document.getElementById('chanceStep2');
      const nameEl  = document.getElementById('chanceStep2Name');
      const costEl  = document.getElementById('chanceStep2Cost');
      const iconEl2 = document.getElementById('chanceStep2Icon');
      if (nameEl)  nameEl.textContent  = card.title;
      if (costEl)  costEl.textContent  = (card.buyCost / 1000) + 'к ₽';
      if (iconEl2) iconEl2.textContent = card.icon;
      const inp = document.getElementById('chanceBalanceInput');
      if (inp) inp.value = '';
      step1.style.animation = 'cmSlideOut 0.22s ease-in forwards';
      setTimeout(() => {
        step1.style.display = 'none'; step1.style.animation = '';
        step2.style.display = 'flex';
        step2.style.animation = 'cmSlideIn 0.3s cubic-bezier(.22,1,.36,1) forwards';
        if (inp) inp.focus();
      }, 200);
    });
    return;
  }

  closeChanceModal(false);
}

// ── Roulette ball animation ──────────────────────
function spawnRouletteAnimation(callback) {
  const el = document.createElement('div');
  el.className = 'roulette-anim-overlay';
  el.innerHTML = `
    <div class="roul-card">
      <div class="roul-wheel-wrap">
        <div class="roul-wheel">
          <div class="roul-num roul-red">3</div>
          <div class="roul-num roul-blk">6</div>
          <div class="roul-num roul-red">9</div>
          <div class="roul-num roul-blk">12</div>
          <div class="roul-num roul-red">3</div>
          <div class="roul-num roul-blk">6</div>
        </div>
        <div class="roul-ball"></div>
      </div>
      <div class="roul-sector-badge">
        <span class="roul-s-num">3</span>
        <span class="roul-s-label">СЕКТОР</span>
      </div>
      <div class="roul-title">НА ТРЕТИЙ!</div>
      <div class="roul-amount">50 000 ₽</div>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('open')));

  setTimeout(() => {
    el.classList.add('closing');
    setTimeout(() => { el.remove(); callback(); }, 450);
  }, 2200);
}

function submitChanceBuy() {
  const input = document.getElementById('chanceBalanceInput');
  const val = input ? input.value.trim() : '';
  if (!val) {
    if (input) {
      input.style.borderColor = 'rgba(244,162,97,0.9)';
      input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
      setTimeout(() => { input.style.borderColor = ''; }, 700);
    }
    return;
  }
  const newBalance = parseInt(val) || 0;
  const card = _currentChanceCard;
  const cost = card ? card.buyCost : 0;

  const moneyEl = document.getElementById('playerMoney');
  if (moneyEl) moneyEl.textContent = newBalance.toLocaleString('ru');

  if (cost > 0) {
    const returned = newBalance - _chanceBalanceBefore;
    const roiCoef  = cost > 0 ? returned / cost : 0;
    taskHistory.push({ name: card.title, cost, returned, roiCoef,
      balanceBefore: _chanceBalanceBefore, balanceAfter: newBalance });
    totalTasksSpent += cost;
    updateLeaderboard();
  }

  const diff = newBalance - _chanceBalanceBefore;
  if (diff > 0) setTimeout(() => dealDamageToBoss(Math.round(diff * 0.1)), 300);

  closeChanceModal(false);
}

function closeChanceModal(keepButtons) {
  const overlay = document.getElementById('chanceOverlay');
  const cardEl  = document.getElementById('chanceCard');
  cardEl.classList.add('ch-flip-out');
  overlay.classList.remove('open');
  setTimeout(() => {
    overlay.style.display = 'none';
    cardEl.classList.remove('ch-flip-out', 'ch-flip-in');
    const s1 = document.getElementById('chanceStep1');
    const s2 = document.getElementById('chanceStep2');
    if (s1) { s1.style.display = 'flex'; s1.style.animation = ''; }
    if (s2) { s2.style.display = 'none';  s2.style.animation = ''; }
  }, 380);
  if (!keepButtons) setTimeout(() => unlockButtons(), 420);
}

function restoreRedHeart() {
  // Returns false if all 3 base hearts are intact (full HP)
  let anyLost = false;
  for (let i = 1; i <= 3; i++) {
    const h = document.getElementById('heart' + i);
    if (h && h.classList.contains('lost')) { anyLost = true; break; }
  }
  if (!anyLost) return false;

  for (let i = 1; i <= 3; i++) {
    const h = document.getElementById('heart' + i);
    if (h && h.classList.contains('lost')) {
      h.classList.remove('lost');
      h.classList.add('heart-regain');
      setTimeout(() => h.classList.remove('heart-regain'), 900);
      playerHearts++;
      return true;
    }
  }
  return false;
}

// ══════════════════════════════════════════════════
//  MASCOT TOKEN
// ══════════════════════════════════════════════════
const MASCOT_IDLE    = '😎';
const MASCOT_HAPPY   = '🤩';
const MASCOT_SAD     = '😢';
const MASCOT_DANCE   = '🕺';
const MASCOT_FIRE    = '🔥';
const MASCOT_SCARED  = '😨';

function setMascot(emoji, stateClass, duration) {
  const m = document.getElementById('tokenMascot');
  if (!m) return;
  m.textContent = emoji;
  m.className = 'token-mascot token-mascot-' + stateClass;
  if (duration) setTimeout(() => setMascot(MASCOT_IDLE, 'idle', 0), duration);
}

// Called from various events
function mascotHappy()  { setMascot(MASCOT_HAPPY,  'happy',  2000); sfxCoin(); }
function mascotSad()    { setMascot(MASCOT_SAD,    'sad',    2000); }
function mascotDance()  { setMascot(MASCOT_DANCE,  'dance',  3000); }
function mascotScared() { setMascot(MASCOT_SCARED, 'scared', 1500); }
function mascotFire()   { setMascot(MASCOT_FIRE,   'fire',   0); }

// ══════════════════════════════════════════════════
//  STREAK SYSTEM
// ══════════════════════════════════════════════════
let streakCount   = 0;
let streakActive  = false;
const STREAK_THRESHOLD = 3;

function streakAccept() {
  streakCount++;
  if (streakCount >= STREAK_THRESHOLD) {
    if (!streakActive) {
      streakActive = true;
      sfxStreak();
      showToast('gold', '🔥', 'СТРИК x' + streakCount + '!', 'Продолжай выполнять задания!');
    }
    updateStreakWidget();
    mascotFire();
  }
}

function streakBreak() {
  if (streakActive || streakCount > 0) {
    if (streakActive) {
      // Burn animation before reset
      const sw = document.getElementById('streakWidget');
      if (sw) { sw.classList.add('streak-burn'); setTimeout(() => { sw.classList.remove('streak-burn'); }, 600); }
      showToast('red', '💔', 'СТРИК СГОРЕЛ!', 'Было ' + streakCount + ' заданий подряд');
    }
    streakCount  = 0;
    streakActive = false;
    updateStreakWidget();
  }
}

function updateStreakWidget() {
  const sw = document.getElementById('streakWidget');
  if (!sw) return;
  if (streakCount < 1) { sw.style.display = 'none'; return; }
  sw.style.display = 'flex';
  sw.innerHTML = `<span class="streak-fire">🔥</span><span class="streak-num">${streakCount}</span><span class="streak-label">СТРИК</span>`;
  if (streakActive) sw.classList.add('streak-on');
  else sw.classList.remove('streak-on');
}

// ══════════════════════════════════════════════════
//  WEB AUDIO SFX
// ══════════════════════════════════════════════════
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

function sfxPlay(fn) {
  try { const ctx = getAudioCtx(); if (ctx.state === 'suspended') ctx.resume().then(fn); else fn(ctx); }
  catch(e) {}
}

// Dice roll — fast random clicks
function sfxDice() {
  sfxPlay(ctx => {
    for (let i = 0; i < 8; i++) {
      const t = ctx.currentTime + i * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(120 + Math.random() * 200, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.start(t); osc.stop(t + 0.06);
    }
  });
}

// Coin profit sound
function sfxCoin() {
  sfxPlay(ctx => {
    [880, 1100, 1320].forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.15);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t); osc.stop(t + 0.25);
    });
  });
}

// Penalty siren
function sfxSiren() {
  sfxPlay(ctx => {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.linearRampToValueAtTime(600, t + 0.3);
    osc.frequency.linearRampToValueAtTime(300, t + 0.6);
    osc.frequency.linearRampToValueAtTime(600, t + 0.9);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    osc.start(t); osc.stop(t + 1.0);
  });
}

// Chance card drum roll
function sfxDrumRoll(duration = 1.2) {
  sfxPlay(ctx => {
    let t = ctx.currentTime;
    let interval = 0.18;
    while (t < ctx.currentTime + duration) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, t);
      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + interval * 0.8);
      osc.start(t); osc.stop(t + interval * 0.8);
      interval = Math.max(0.04, interval * 0.88);
      t += interval;
    }
    // Final hit
    const osc2  = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2); gain2.connect(ctx.destination);
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(220, t);
    gain2.gain.setValueAtTime(0.15, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc2.start(t); osc2.stop(t + 0.3);
  });
}

// Heart lost
function sfxHeartLost() {
  sfxPlay(ctx => {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.5);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.start(t); osc.stop(t + 0.5);
  });
}

// Streak pop
function sfxStreak() {
  sfxPlay(ctx => {
    [440, 660, 880, 1100].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.start(t); osc.stop(t + 0.15);
    });
  });
}

// ══════════════════════════════════════════════════
//  SESSION END SCREEN
// ══════════════════════════════════════════════════
function showSessionEnd() {
  const moneyEl  = document.getElementById('playerMoney');
  const balance  = parseInt((moneyEl ? moneyEl.textContent : '0').replace(/[^\d]/g,'')) || 0;
  const start    = window._startCapital || 1500;
  const profit   = balance - start;
  const profitSign = profit >= 0 ? '+' : '';

  // Stats
  const avgRoi = taskHistory.length
    ? (taskHistory.reduce((s,t) => s+t.roiCoef,0) / taskHistory.length).toFixed(2)
    : '—';
  const sorted = [...taskHistory].sort((a,b) => b.roiCoef - a.roiCoef);
  const best   = sorted[0];
  const worst  = sorted[sorted.length-1];

  function fmt(n) {
    const abs = Math.abs(n);
    if (abs >= 1000000) return (n/1000000).toFixed(1) + 'М';
    if (abs >= 1000)    return (n/1000).toFixed(0) + 'к';
    return n.toString();
  }

  // Sub title
  const subs = profit > 0
    ? ['Монстр! 🤑','Красавчик! 💰','Вот это результат! 🚀']
    : ['Ну бывает... 😅','Следующая сессия лучше! 💪','Нет потерянных денег — нет боли!'];
  document.getElementById('sessionSub').textContent = subs[Math.floor(Math.random()*subs.length)];

  // Stats grid
  document.getElementById('sessionStats').innerHTML = `
    <div class="ss-stat">
      <div class="ss-icon">🎲</div>
      <div class="ss-val">${totalMoves}</div>
      <div class="ss-label">ХОДОВ</div>
    </div>
    <div class="ss-stat">
      <div class="ss-icon">🔄</div>
      <div class="ss-val">${lapMultiplier}</div>
      <div class="ss-label">КРУГОВ</div>
    </div>
    <div class="ss-stat">
      <div class="ss-icon">🎰</div>
      <div class="ss-val">${taskHistory.length}</div>
      <div class="ss-label">ЗАДАНИЙ</div>
    </div>
    <div class="ss-stat">
      <div class="ss-icon">💸</div>
      <div class="ss-val">${fmt(totalTasksSpent)}</div>
      <div class="ss-label">ПОТРАЧЕНО</div>
    </div>
    <div class="ss-stat ${profit>=0?'ss-green':'ss-red'}">
      <div class="ss-icon">${profit>=0?'📈':'📉'}</div>
      <div class="ss-val">${profitSign}${fmt(profit)}</div>
      <div class="ss-label">ИТОГ</div>
    </div>
    <div class="ss-stat">
      <div class="ss-icon">📊</div>
      <div class="ss-val">${avgRoi}x</div>
      <div class="ss-label">AVG ROI</div>
    </div>
  `;

  // Podium top-3
  const top3 = sorted.slice(0, 3);
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const heights = ['160px','200px','130px'];
  const places  = ['🥈','🥇','🥉'];
  const delays  = ['0.4s','0.1s','0.7s'];

  document.getElementById('sessionPodium').innerHTML = top3.length === 0
    ? '<div class="ss-no-tasks">Задания не выполнялись</div>'
    : podiumOrder.map((t, i) => t ? `
      <div class="ss-podium-col" style="animation-delay:${delays[i]}">
        <div class="ss-podium-name">${t.name.length > 18 ? t.name.slice(0,16)+'…' : t.name}</div>
        <div class="ss-podium-roi" style="color:${t.roiCoef>=1?'#2dc653':'#e63946'}">${t.roiCoef.toFixed(2)}x</div>
        <div class="ss-podium-bar" style="height:${heights[i]}">
          <div class="ss-podium-place">${places[i]}</div>
        </div>
      </div>` : '<div class="ss-podium-col"></div>'
    ).join('');

  // Spawn session particles
  spawnSessionParticles();

  const overlay = document.getElementById('sessionOverlay');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('open')));

  // SFX fanfare
  sfxPlay(ctx => {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      const t = ctx.currentTime + i * 0.18;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = f;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t); osc.stop(t + 0.4);
    });
  });
}

function closeSessionEnd() {
  const overlay = document.getElementById('sessionOverlay');
  overlay.classList.remove('open');
  setTimeout(() => { overlay.style.display = 'none'; }, 400);
}

function spawnSessionParticles() {
  const wrap = document.getElementById('sessionParticles');
  if (!wrap) return;
  wrap.innerHTML = '';
  const emojis = ['🏆','💰','⭐','🎲','🎰','💎','🔥','✨','🌟','🎯'];
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'sess-particle';
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    p.style.cssText = `left:${Math.random()*100}%;animation-duration:${7+Math.random()*8}s;animation-delay:${Math.random()*4}s;font-size:${14+Math.random()*18}px`;
    wrap.appendChild(p);
  }
}