(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('bestScore');
  const speedEl = document.getElementById('speed');
  const levelEl = document.getElementById('level');
  const overlay = document.getElementById('overlay');
  const titleEl = document.getElementById('overlayTitle');
  const eyebrowEl = document.getElementById('overlayEyebrow');
  const textEl = document.getElementById('overlayText');
  const startButton = document.getElementById('startButton');
  const pauseButton = document.getElementById('pauseButton');
  const pauseLabel = document.getElementById('pauseLabel');
  const countdown = document.getElementById('countdown');
  const toast = document.getElementById('toast');

  let width = 0, height = 0, dpr = 1, lastTime = 0;
  let state = 'ready';
  let score = 0, best = loadBest(), elapsed = 0, roadOffset = 0, spawnTimer = 0;
  let speed = 290, level = 1, playerX = 0, targetX = 0, crashTimer = 0;
  let traffic = [], particles = [];
  const keys = { left: false, right: false };
  const colors = ['#ed6659', '#e9b84f', '#4b9bdb', '#b97bdb', '#e5e9df'];
  bestEl.textContent = formatScore(best);

  function loadBest() { try { return Number(localStorage.getItem('neon-run-best')) || 0; } catch { return 0; } }
  function saveBest() { try { localStorage.setItem('neon-run-best', String(best)); } catch { /* storage may be disabled */ } }
  function formatScore(value) { return Math.floor(value).toString().padStart(6, '0'); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width; height = rect.height;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!playerX) playerX = width / 2;
    targetX = clamp(targetX || width / 2, road().left + 30, road().right - 30);
    draw();
  }
  window.addEventListener('resize', resize, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);

  function road() {
    const rw = Math.min(width * .77, 390);
    return { left: (width - rw) / 2, right: (width + rw) / 2, width: rw };
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  }

  function drawCar(x, y, w, h, color, player = false) {
    ctx.save(); ctx.translate(x, y);
    if (player) { ctx.shadowColor = '#bdf45a88'; ctx.shadowBlur = 15; }
    // Wheels
    ctx.fillStyle = '#10161a';
    roundedRect(-w * .53, -h * .31, w * .17, h * .29, 3); ctx.fill();
    roundedRect(w * .36, -h * .31, w * .17, h * .29, 3); ctx.fill();
    roundedRect(-w * .53, h * .08, w * .17, h * .29, 3); ctx.fill();
    roundedRect(w * .36, h * .08, w * .17, h * .29, 3); ctx.fill();
    // Body
    const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    grad.addColorStop(0, shade(color, -.2)); grad.addColorStop(.45, color); grad.addColorStop(1, shade(color, -.1));
    ctx.fillStyle = grad; roundedRect(-w * .4, -h * .5, w * .8, h, w * .2); ctx.fill();
    // Windshield and glass
    ctx.fillStyle = player ? '#25414a' : '#23353c';
    roundedRect(-w * .29, -h * .26, w * .58, h * .25, w * .09); ctx.fill();
    ctx.fillStyle = '#17262d'; roundedRect(-w * .29, h * .12, w * .58, h * .2, w * .06); ctx.fill();
    ctx.fillStyle = '#f9e7a0'; roundedRect(-w * .31, -h * .47, w * .18, h * .045, 2); ctx.fill();
    roundedRect(w * .13, -h * .47, w * .18, h * .045, 2); ctx.fill();
    ctx.fillStyle = '#fa6059'; roundedRect(-w * .3, h * .43, w * .18, h * .045, 2); ctx.fill();
    roundedRect(w * .12, h * .43, w * .18, h * .045, 2); ctx.fill();
    if (player) { ctx.fillStyle = '#ddf3bd'; roundedRect(-w * .06, -h * .32, w * .12, h * .035, 2); ctx.fill(); }
    ctx.restore();
  }

  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16), r = clamp((n >> 16) + amount * 255, 0, 255), g = clamp(((n >> 8) & 255) + amount * 255, 0, 255), b = clamp((n & 255) + amount * 255, 0, 255);
    return `rgb(${r|0},${g|0},${b|0})`;
  }

  function draw() {
    if (!width || !height) return;
    const r = road();
    ctx.clearRect(0, 0, width, height);
    // Landscape, verge, and subtle texture
    ctx.fillStyle = '#445244'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#718060';
    for (let y = -35 + (roadOffset * .42 % 70); y < height; y += 70) {
      for (let x = 14; x < width; x += 38) {
        ctx.globalAlpha = .15; ctx.beginPath(); ctx.arc(x + ((y / 70|0) % 2) * 12, y, 1.1, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    // Road shadow and asphalt
    ctx.fillStyle = '#242b2d'; ctx.fillRect(r.left - 7, 0, r.width + 14, height);
    ctx.fillStyle = '#383d3e'; ctx.fillRect(r.left, 0, r.width, height);
    // Asphalt grain
    ctx.fillStyle = '#ffffff';
    for (let y = -16 + (roadOffset % 32); y < height; y += 32) {
      ctx.globalAlpha = .035; ctx.fillRect(r.left + 8 + ((y * 13) % Math.max(1, r.width - 20)), y, 2, 1);
    }
    ctx.globalAlpha = 1;
    // Edge lines and lane dashes
    ctx.fillStyle = '#ece4cb'; ctx.fillRect(r.left + 7, 0, 2, height); ctx.fillRect(r.right - 9, 0, 2, height);
    ctx.fillStyle = '#b8b8a6';
    const dash = Math.max(20, height * .065), gap = dash * .9;
    for (let lane = 1; lane <= 2; lane++) {
      const x = r.left + r.width * lane / 3;
      for (let y = -dash + (roadOffset % (dash + gap)); y < height; y += dash + gap) ctx.fillRect(x - 1, y, 2, dash);
    }
    // Roadside reflectors
    for (let y = -18 + (roadOffset * 1.3 % 44); y < height; y += 44) {
      ctx.fillStyle = '#d9d4ba'; ctx.fillRect(r.left - 5, y, 3, 8); ctx.fillRect(r.right + 2, y, 3, 8);
    }
    traffic.forEach(car => drawCar(car.x, car.y, car.w, car.h, car.color));
    if (state !== 'ready') drawCar(playerX, height * .78, width * .105, height * .14, '#c4f365', true);
    particles.forEach(p => { ctx.globalAlpha = Math.max(0, p.life / .55); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;
    // Soft vignette
    const vignette = ctx.createLinearGradient(0, 0, 0, height);
    vignette.addColorStop(0, '#07100e33'); vignette.addColorStop(.18, '#0000'); vignette.addColorStop(.85, '#0000'); vignette.addColorStop(1, '#07100e33');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
  }

  function startGame() {
    if (state === 'running') return;
    score = 0; elapsed = 0; speed = 290; level = 1; spawnTimer = .4; traffic = []; particles = [];
    playerX = width / 2; targetX = playerX; roadOffset = 0; state = 'running';
    overlay.classList.add('hidden'); pauseButton.disabled = false; pauseLabel.textContent = 'PAUSE';
    pauseButton.setAttribute('aria-label', 'Pause game');
    updateHud();
  }
  function togglePause() {
    if (state === 'running') { state = 'paused'; showOverlay('PAUSED', 'TAKE A BREATHER.', 'The road will be right here.'); pauseLabel.textContent = 'RESUME'; pauseButton.setAttribute('aria-label', 'Resume game'); }
    else if (state === 'paused') { state = 'running'; overlay.classList.add('hidden'); pauseLabel.textContent = 'PAUSE'; pauseButton.setAttribute('aria-label', 'Pause game'); lastTime = performance.now(); }
  }
  function showOverlay(eyebrow, title, text) {
    eyebrowEl.textContent = eyebrow; titleEl.innerHTML = title; textEl.innerHTML = text;
    startButton.querySelector('span:first-child').textContent = state === 'paused' ? 'RESUME RACE' : 'RACE AGAIN';
    overlay.classList.remove('hidden');
  }
  function endGame() {
    state = 'over'; pauseButton.disabled = true;
    const finalScore = Math.floor(score);
    const newBest = finalScore > best;
    if (newBest) { best = finalScore; saveBest(); bestEl.textContent = formatScore(best); }
    showOverlay(newBest ? 'NEW PERSONAL BEST' : 'RACE COMPLETE', 'THAT WAS A<br><span>GOOD RUN.</span>', `DISTANCE &nbsp; ${formatScore(finalScore)}<br>BEST &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${formatScore(best)}`);
    startButton.querySelector('span:first-child').textContent = 'RACE AGAIN';
  }
  startButton.addEventListener('click', () => state === 'paused' ? togglePause() : startGame());
  pauseButton.addEventListener('click', togglePause);

  function steer(direction) {
    if (state !== 'running') return;
    const r = road(); targetX = clamp(targetX + direction * r.width * .19, r.left + width * .07, r.right - width * .07);
  }
  function bindSteer(id, direction) {
    const button = document.getElementById(id);
    const down = e => { e.preventDefault(); keys[direction < 0 ? 'left' : 'right'] = true; button.classList.add('pressed'); steer(direction); };
    const up = e => { if (e) e.preventDefault(); keys[direction < 0 ? 'left' : 'right'] = false; button.classList.remove('pressed'); };
    button.addEventListener('pointerdown', down); button.addEventListener('pointerup', up); button.addEventListener('pointercancel', up); button.addEventListener('pointerleave', up);
    button.addEventListener('contextmenu', e => e.preventDefault());
  }
  bindSteer('leftButton', -1); bindSteer('rightButton', 1);
  canvas.addEventListener('pointerdown', e => {
    if (state !== 'running') return;
    const rect = canvas.getBoundingClientRect(); steer(e.clientX - rect.left < rect.width / 2 ? -1 : 1);
  });
  window.addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'A', 'd', 'D'].includes(e.key)) e.preventDefault();
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') { keys.left = true; steer(-1); }
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') { keys.right = true; steer(1); }
    if ((e.key === ' ' || e.key.toLowerCase() === 'p') && !e.repeat) state === 'ready' || state === 'over' ? startGame() : togglePause();
  });
  window.addEventListener('keyup', e => { if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') keys.left = false; if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') keys.right = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'running') togglePause(); });

  function spawnCar() {
    const r = road(), lanes = [1/6, 3/6, 5/6];
    let lane = Math.floor(Math.random() * 3);
    for (let tries = 0; tries < 4 && traffic.some(c => Math.abs(c.x - (r.left + r.width * lanes[lane])) < width * .13 && c.y < height * .3); tries++) lane = Math.floor(Math.random() * 3);
    const carW = width * .105, carH = height * .14;
    traffic.push({ x: r.left + r.width * lanes[lane], y: -carH, w: carW, h: carH, color: colors[Math.floor(Math.random() * colors.length)], extra: .72 + Math.random() * .38 });
  }
  function updateHud() {
    scoreEl.textContent = formatScore(score); speedEl.textContent = Math.round(speed / 4.2); levelEl.textContent = String(level).padStart(2, '0');
  }
  function burst(x, y) {
    for (let i = 0; i < 20; i++) particles.push({ x, y, vx: (Math.random() - .5) * 180, vy: (Math.random() - .5) * 190, size: 2 + Math.random() * 4, life: .3 + Math.random() * .35, color: ['#f1c75b', '#f27454', '#f3e7c3'][i % 3] });
  }
  function update(dt) {
    if (state !== 'running') return;
    elapsed += dt; level = Math.floor(elapsed / 16) + 1; speed = Math.min(700, 290 + elapsed * 8.2); score += dt * (speed * .22); roadOffset = (roadOffset + speed * dt) % 10000;
    if (keys.left) steer(-dt * 4); if (keys.right) steer(dt * 4);
    const r = road(); targetX = clamp(targetX, r.left + width * .07, r.right - width * .07);
    playerX += (targetX - playerX) * Math.min(1, dt * 13);
    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawnCar(); spawnTimer = Math.max(.48, 1.12 - elapsed * .008) * (.82 + Math.random() * .36); }
    const playerY = height * .78, playerW = width * .105, playerH = height * .14;
    for (const car of traffic) {
      car.y += speed * car.extra * dt;
      const dx = Math.abs(car.x - playerX), dy = Math.abs(car.y - playerY);
      if (dx < (car.w + playerW) * .36 && dy < (car.h + playerH) * .38) { burst(playerX, playerY); crashTimer = .35; state = 'crashing'; break; }
    }
    traffic = traffic.filter(car => car.y < height + car.h);
    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }); particles = particles.filter(p => p.life > 0);
    updateHud();
  }
  function frame(now) {
    const dt = Math.min(.04, Math.max(0, (now - (lastTime || now)) / 1000)); lastTime = now;
    if (state === 'crashing') { crashTimer -= dt; if (crashTimer <= 0) endGame(); }
    update(dt); draw(); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  resize();
})();
