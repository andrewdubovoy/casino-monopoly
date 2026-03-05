// ── Переход между экранами ──────────────────────────────
function transitionTo(screenNum) {
  const current = document.querySelector('.screen.active');
  const next = document.getElementById('screen' + screenNum);
  if (!next || current === next) return;

  // Выход текущего экрана
  current.classList.add('exit');
  current.classList.remove('active');

  // Небольшая пауза, потом показываем следующий
  setTimeout(() => {
    current.classList.remove('exit');
    next.classList.add('active');

    // Сбрасываем анимацию входа на новом экране
    const inner = next.querySelector('.s2-inner, .s1-inner');
    if (inner) {
      inner.style.animation = 'none';
      void inner.offsetWidth;
      inner.style.animation = '';
    }
  }, 380);
}

// ── Старт игры ──────────────────────────────────────────
function startGame() {
  const val = parseInt(document.getElementById('capital-input').value) || 1500;
  alert('Старт! Стартовый капитал: ' + val.toLocaleString('ru') + ' ₽\nЗдесь будет игровое поле!');
}

// ── DOMContentLoaded ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Replay экрана 1 при загрузке
  const screen1 = document.getElementById('screen1');
  if (screen1) {
    screen1.classList.remove('active');
    void screen1.offsetWidth;
    screen1.classList.add('active');
  }

  // Быстрые кнопки выбора суммы
  const quickBtns = document.querySelectorAll('.quick-btn');
  const input = document.getElementById('capital-input');

  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      quickBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (input) input.value = btn.dataset.val;
    });
  });

  // Синхронизация ввода с кнопками
  if (input) {
    input.addEventListener('input', () => {
      const val = parseInt(input.value);
      quickBtns.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.val) === val);
      });
    });
  }
});