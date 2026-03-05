document.addEventListener('DOMContentLoaded', () => {
  // Replay entrance animations on load
  const screen = document.getElementById('screen1');
  if (screen) {
    screen.classList.remove('active');
    void screen.offsetWidth;
    screen.classList.add('active');
  }

  // Play button
  const play = document.getElementById('play');
  if (play) {
    play.addEventListener('click', () => {
      play.disabled = true;
      play.textContent = 'ЗАГРУЗКА...';
      setTimeout(() => {
        play.textContent = '🎲 ИГРАТЬ!';
        play.disabled = false;
        alert('Запуск батла! Скоро здесь будет игровое поле.');
      }, 700);
    });
  }
});