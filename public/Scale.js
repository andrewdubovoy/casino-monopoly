// ══════════════════════════════════════════════════
//  ADAPTIVE SCALE — масштабирует весь интерфейс
//  под текущее разрешение/зум браузера
// ══════════════════════════════════════════════════

const BASE_W = 1440;
const BASE_H = 900;

function applyScale() {
  // Реальный размер окна с учётом devicePixelRatio и зума
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Считаем scale по обеим осям, берём минимум чтобы всё влезло
  const scaleX = vw / BASE_W;
  const scaleY = vh / BASE_H;
  const scale  = Math.min(scaleX, scaleY);

  const body = document.body;

  // Применяем transform к body
  body.style.transformOrigin = 'top left';
  body.style.transform       = `scale(${scale})`;

  // Компенсируем размер — body в браузере остаётся BASE размера,
  // но визуально занимает scale*BASE, поэтому растягиваем wrapper
  body.style.width  = BASE_W + 'px';
  body.style.height = BASE_H + 'px';

  // Контейнер html подстраиваем чтобы не было скролла
  document.documentElement.style.width    = vw + 'px';
  document.documentElement.style.height   = vh + 'px';
  document.documentElement.style.overflow = 'hidden';
}

// Запуск
applyScale();

// При изменении размера окна / зума
window.addEventListener('resize', applyScale);

// ResizeObserver на случай зума через Ctrl+/- (меняет innerWidth)
if (window.ResizeObserver) {
  new ResizeObserver(applyScale).observe(document.documentElement);
}