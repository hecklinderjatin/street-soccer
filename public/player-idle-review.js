const canvas = document.getElementById('preview');
const ctx = canvas.getContext('2d');
const slider = document.getElementById('height');
const output = document.getElementById('size');
const button = document.getElementById('toggle');
const status = document.getElementById('state');
const image = new Image();
image.src = '/art/player-idle-authored.png';
let paused = false;
let frame = 0;
let last = 0;
button.addEventListener('click', () => {
  paused = !paused;
  button.textContent = paused ? 'Play' : 'Pause';
});
slider.addEventListener('input', () => { output.value = `${slider.value} px`; });
image.addEventListener('error', () => { status.textContent = 'Could not load the character image. Refresh the page to try again.'; });
image.addEventListener('load', () => {
  function draw(now) {
    if (!paused && now - last >= 250) { frame = (frame + 1) % 4; last = now; }
    ctx.fillStyle = '#465839';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    const small = Number(slider.value);
    for (const [center, height] of [[260, 450], [690, small]]) {
      const width = (352 / 724) * height;
      const y = 500 - (695 / 724) * height;
      ctx.fillStyle = '#33442c';
      ctx.beginPath();
      ctx.ellipse(center, 499, width * 0.45, Math.max(3, height * 0.015), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(image, frame * 352, 0, 352, 724, center - width / 2, y, width, height);
    }
    ctx.fillStyle = '#f5eee6';
    ctx.font = '17px system-ui';
    ctx.fillText('Enlarged', 215, 535);
    ctx.fillText(`Gameplay size (${small} px)`, 602, 535);
    status.textContent = `Idle frame ${frame + 1} of 4. Game artwork is unchanged during this review.`;
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
});
