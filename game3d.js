/* Expediente Letal 3D — terceira pessoa com Three.js. Mesma simulação da versão 2D, vista por cima do ombro. */
'use strict';
(function () {
  const { TILES, FLOOR_CH, WEAPONS, ENEMIES, MISSIONS, BARKS } = window.EL_DATA;
  const TILE = 48, S = 1 / 24; // 48 px de simulação = 2 m
  const $ = (s) => document.querySelector(s);
  const glCanvas = $('#gl'), hud = $('#hud'), hctx = hud.getContext('2d');
  let W = innerWidth, H = innerHeight, DPR = 1;
  const isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const dist = (a, b, c, d) => Math.hypot(c - a, d - b);
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const fmtMoney = (n) => 'R$ ' + Math.round(n).toLocaleString('pt-BR');
  const fmtTime = (s) => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const FONT_D = "'Anton', Impact, 'Arial Narrow', sans-serif";
  const FONT_H = "'Barlow Condensed', 'Arial Narrow', sans-serif";

  /* ---------------- Save (compartilhado com a versão 2D) ---------------- */
  const SAVE_KEY = 'expediente-letal-v1';
  let save = { done: {}, bank: 0 };
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.done) save = s; } catch (e) { /* sem storage */ }
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignora */ } }

  /* ---------------- Áudio ---------------- */
  let AC = null, master = null, noiseBuf = null;
  function initAudio() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = 0.45; master.connect(AC.destination);
      noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { AC = null; }
  }
  function noise(dur, freq, q, vol, type, decay) {
    const t = AC.currentTime, src = AC.createBufferSource(); src.buffer = noiseBuf;
    const f = AC.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq; f.Q.value = q;
    const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + (decay || dur));
    src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random() * 0.4); src.stop(t + dur);
  }
  function tone(freq, dur, vol, type, slide) {
    const t = AC.currentTime, o = AC.createOscillator(); o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  const later = (ms, fn) => setTimeout(() => { if (AC) fn(); }, ms);
  function sfx(name, x, y) {
    if (!AC) return;
    let v = 1;
    if (x !== undefined && game && game.player) { v = clamp(1 - dist(x, y, game.player.x, game.player.y) / 1100, 0, 1); if (v < 0.03) return; }
    switch (name) {
      case 'pistol': noise(0.25, 1800, 0.8, 0.6 * v); tone(160, 0.08, 0.25 * v, 'square', 0.4); break;
      case 'stapler': noise(0.06, 4200, 2, 0.3 * v, 'bandpass'); tone(900, 0.04, 0.08 * v, 'square', 0.5); break;
      case 'shotgun': noise(0.45, 900, 0.6, 0.9 * v); tone(90, 0.2, 0.4 * v, 'sawtooth', 0.4); break;
      case 'smg': noise(0.12, 2200, 0.8, 0.45 * v); break;
      case 'rifle': noise(0.22, 1500, 0.9, 0.6 * v); tone(120, 0.1, 0.25 * v, 'square', 0.5); break;
      case 'enemy': noise(0.2, 1300, 0.8, 0.38 * v); break;
      case 'spray': noise(0.09, 3000, 0.5, 0.14 * v, 'highpass'); break;
      case 'swing': noise(0.15, 600, 3, 0.3 * v, 'bandpass'); break;
      case 'hit': tone(240, 0.07, 0.18 * v, 'square', 0.5); break;
      case 'glass': noise(0.5, 6000, 1, 0.45 * v, 'highpass'); tone(2400, 0.15, 0.05 * v, 'sine', 1.4); break;
      case 'boom': noise(1.2, 420, 0.7, 1.0 * v, 'lowpass', 1.1); tone(60, 0.6, 0.5 * v, 'sine', 0.4); break;
      case 'throw': noise(0.12, 800, 2, 0.2, 'bandpass'); break;
      case 'pickup': tone(660, 0.08, 0.15, 'sine'); later(70, () => tone(990, 0.1, 0.15, 'sine')); break;
      case 'cash': tone(1320, 0.06, 0.1, 'triangle'); later(60, () => tone(1760, 0.08, 0.1, 'triangle')); break;
      case 'hurt': tone(140, 0.15, 0.25, 'sawtooth', 0.6); break;
      case 'reload': tone(500, 0.04, 0.1, 'square'); later(140, () => tone(720, 0.04, 0.1, 'square')); break;
      case 'empty': tone(1200, 0.03, 0.08, 'square'); break;
      case 'hack': tone(1100 + Math.random() * 700, 0.03, 0.04, 'square'); break;
      case 'done': [523, 659, 784].forEach((f, i) => later(i * 90, () => tone(f, 0.18, 0.15, 'triangle'))); break;
      case 'win': [392, 523, 659, 784, 1046].forEach((f, i) => later(i * 120, () => tone(f, 0.3, 0.15, 'triangle'))); break;
      case 'lose': [300, 240, 180, 120].forEach((f, i) => later(i * 180, () => tone(f, 0.35, 0.2, 'sawtooth'))); break;
      case 'star': tone(880, 0.1, 0.12, 'triangle'); later(90, () => tone(660, 0.12, 0.1, 'triangle')); break;
      case 'switch': tone(300, 0.04, 0.08, 'square'); break;
    }
  }

  /* ---------------- Three.js ---------------- */
  function fatal(msg) {
    const el = $('#fatal'); if (el) { el.hidden = false; el.textContent = msg; }
  }
  if (!window.THREE) { fatal('Não foi possível carregar o motor 3D (Three.js). Verifique a conexão ou jogue a versão 2D.'); return; }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: !isTouch, powerPreference: 'high-performance' }); }
  catch (e) { fatal('Este navegador não suporta WebGL. Jogue a versão 2D.'); return; }
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#121a30', 90, 340);
  const camera = new THREE.PerspectiveCamera(62, W / H, 0.1, 900);
  camera.rotation.order = 'YXZ';

  const hemi = new THREE.HemisphereLight('#c9d6f0', '#3b342d', 0.72); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0dc', 0.62);
  sun.castShadow = true; sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
  const sc = sun.shadow.camera; sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 80;
  sun.shadow.bias = -0.0008;
  scene.add(sun); scene.add(sun.target);
  const muzzleLight = new THREE.PointLight('#ffcf80', 0, 9, 2); scene.add(muzzleLight);
  const boomLight = new THREE.PointLight('#ff9a40', 0, 26, 2); scene.add(boomLight);
  const markLight = new THREE.PointLight('#f5b82e', 0, 10, 2); scene.add(markLight);

  const G_BOX = new THREE.BoxGeometry(1, 1, 1);
  const G_SPH = new THREE.SphereGeometry(1, 14, 10);
  const G_ICO = new THREE.IcosahedronGeometry(1, 1);
  const G_CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
  const G_CONE = new THREE.ConeGeometry(1, 1, 4);
  const matCache = {};
  function lam(color, extra) { const k = color + JSON.stringify(extra || {}); return matCache[k] || (matCache[k] = new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {}))); }
  function basic(color, extra) { const k = 'b' + color + JSON.stringify(extra || {}); return matCache[k] || (matCache[k] = new THREE.MeshBasicMaterial(Object.assign({ color }, extra || {}))); }
  function canvasTex(w, h, draw, rep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = MAX_ANISO; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t;
  }

  /* --- texturas procedurais --- */
  let seed = 11; const srand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const TEX = {};
  function makeTextures() {
    TEX.sky = canvasTex(4, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#05070f'); gr.addColorStop(0.45, '#0e1630'); gr.addColorStop(0.62, '#2a2440'); gr.addColorStop(0.72, '#5a3b3a'); gr.addColorStop(1, '#121a30');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    scene.background = TEX.sky;
    TEX.facade = canvasTex(128, 128, (g) => {
      g.fillStyle = '#141a26'; g.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const r = srand(); g.fillStyle = r < 0.22 ? '#e9c98a' : r < 0.3 ? '#9cc6f0' : '#1d2638';
        g.fillRect(x * 16 + 3, y * 16 + 4, 10, 9);
      }
    }, true);
    TEX.server = canvasTex(64, 128, (g) => {
      g.fillStyle = '#101318'; g.fillRect(0, 0, 64, 128);
      for (let i = 0; i < 12; i++) { g.fillStyle = '#1d222b'; g.fillRect(4, 4 + i * 10, 56, 8); g.fillStyle = '#2a303b'; g.fillRect(6, 6 + i * 10, 30, 2); }
    });
    TEX.serverE = canvasTex(64, 128, (g) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128);
      for (let i = 0; i < 12; i++) for (let k = 0; k < 4; k++) { const r = srand(); g.fillStyle = r < 0.7 ? '#42f59b' : r < 0.85 ? '#5ec2ff' : '#ff6b5a'; if (srand() < 0.75) g.fillRect(40 + k * 5, 6 + i * 10, 3, 3); }
    });
    TEX.books = canvasTex(64, 64, (g) => {
      g.fillStyle = '#3b2a1e'; g.fillRect(0, 0, 64, 64);
      const cols = ['#8e3b2e', '#2d5d7c', '#c7a24a', '#4d6b3a', '#ddd6c6', '#5b3a6b'];
      for (let s = 0; s < 4; s++) for (let x = 2; x < 62;) { const w = 2 + Math.floor(srand() * 3); g.fillStyle = cols[Math.floor(srand() * cols.length)]; g.fillRect(x, s * 16 + 2, w, 12 - Math.floor(srand() * 4)); x += w + 1; }
    });
    TEX.crate = canvasTex(64, 64, (g) => {
      g.fillStyle = '#8a6a43'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#5e4529'; g.lineWidth = 6; g.strokeRect(3, 3, 58, 58);
      g.beginPath(); g.moveTo(6, 6); g.lineTo(58, 58); g.moveTo(58, 6); g.lineTo(6, 58); g.stroke();
    });
  }

  /* --- cidade lá embaixo --- */
  function makeCityCanvas() {
    const Sz = 1024, c = document.createElement('canvas'); c.width = c.height = Sz;
    const g = c.getContext('2d');
    g.fillStyle = '#070a12'; g.fillRect(0, 0, Sz, Sz);
    const bs = 256, st = 36;
    g.fillStyle = '#10151f';
    for (let i = 0; i < 4; i++) { g.fillRect(i * bs, 0, st, Sz); g.fillRect(0, i * bs, Sz, st); }
    for (let i = 0; i < 4; i++) for (let j = 0; j < Sz; j += 40) {
      for (const [x, y] of [[i * bs + 4, j], [j, i * bs + 4], [i * bs + st - 4, j + 20], [j + 20, i * bs + st - 4]]) {
        const rg = g.createRadialGradient(x, y, 0, x, y, 20); rg.addColorStop(0, 'rgba(255,170,70,0.75)'); rg.addColorStop(1, 'rgba(255,170,70,0)');
        g.fillStyle = rg; g.fillRect(x - 20, y - 20, 40, 40);
      }
    }
    for (let i = 0; i < 4; i++) for (let j = 0; j < Sz; j += 9) { if (srand() < 0.25) { g.fillStyle = srand() < 0.5 ? 'rgba(255,245,220,0.9)' : 'rgba(255,70,70,0.9)'; g.fillRect(i * bs + 10 + srand() * 16, j, 3, 5); g.fillRect(j, i * bs + 10 + srand() * 16, 5, 3); } }
    for (let bx = 0; bx < 4; bx++) for (let by = 0; by < 4; by++) {
      const x0 = bx * bs + st + 8, y0 = by * bs + st + 8, size = bs - st - 16;
      const parts = 1 + Math.floor(srand() * 3), split = srand() < 0.5;
      for (let k = 0; k < parts; k++) {
        const a = k / parts, b = (k + 1) / parts;
        const x = split ? x0 + size * a : x0, y = split ? y0 : y0 + size * a;
        const w = split ? size * (b - a) - 8 : size, h = split ? size : size * (b - a) - 8;
        const sh = 20 + Math.floor(srand() * 18); g.fillStyle = `rgb(${sh},${sh + 4},${sh + 14})`; g.fillRect(x, y, w, h);
        for (let q = 0; q < 10; q++) { g.fillStyle = srand() < 0.5 ? 'rgba(255,214,140,0.8)' : 'rgba(170,210,255,0.6)'; g.fillRect(x + 6 + srand() * (w - 12), y + 6 + srand() * (h - 12), 3, 3); }
      }
    }
    return c;
  }
  const skyline = [];
  function buildWorld() {
    makeTextures();
    const cityTex = new THREE.CanvasTexture(makeCityCanvas()); cityTex.wrapS = cityTex.wrapT = THREE.RepeatWrapping; cityTex.repeat.set(10, 10); cityTex.anisotropy = MAX_ANISO;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), new THREE.MeshBasicMaterial({ map: cityTex }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(40, -96, 30); scene.add(ground);
    // prédios vizinhos (skyline da Paulista)
    const facM = new THREE.MeshLambertMaterial({ map: TEX.facade, emissive: '#ffffff', emissiveMap: TEX.facade, emissiveIntensity: 0.55, color: '#7a8396' });
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + rand(-0.05, 0.05), r = rand(85, 230);
      const w = rand(18, 40), d = rand(18, 40), top = rand(-40, 26);
      const hgt = top + 96;
      const geo = new THREE.BoxGeometry(w, hgt, d);
      const uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / 8, uv.getY(k) * hgt / 8);
      const m = new THREE.Mesh(geo, facM); m.position.set(40 + Math.cos(a) * r, -96 + hgt / 2, 30 + Math.sin(a) * r); scene.add(m);
      if (srand() < 0.7) {
        const ant = new THREE.Mesh(G_SPH, basic('#ff2a2a')); ant.scale.setScalar(0.7); ant.position.set(m.position.x, top + 4, m.position.z); scene.add(ant);
        const pole = new THREE.Mesh(G_CYL, lam('#333')); pole.scale.set(0.15, 4, 0.15); pole.position.set(m.position.x, top + 2, m.position.z); scene.add(pole);
        skyline.push({ m: ant, ph: rand(0, 6) });
      }
    }
  }

  /* ---------------- Mapa ---------------- */
  function buildLevel(m) {
    const iw = Math.max(...m.map.map((r) => r.length));
    const raw = []; const w = iw + 4;
    raw.push('O'.repeat(w)); raw.push('O' + 'W'.repeat(w - 2) + 'O');
    for (const r of m.map) raw.push('OW' + r.padEnd(iw, '.') + 'WO');
    raw.push('O' + 'W'.repeat(w - 2) + 'O'); raw.push('O'.repeat(w));
    const h = raw.length, grid = [], floor = [];
    const sp = { player: null, enemies: [], pickups: [], terminals: [], reinf: [], exits: [] };
    const floorGuess = (x, y) => {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) { const c = (raw[y + dy] || '')[x + dx]; if (c && FLOOR_CH.includes(c)) return c; }
      return '.';
    };
    for (let y = 0; y < h; y++) {
      grid.push([]); floor.push([]);
      for (let x = 0; x < w; x++) {
        const ch = raw[y][x], cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
        const fl = FLOOR_CH.includes(ch) ? ch : floorGuess(x, y);
        floor[y].push(fl);
        if (TILES[ch]) {
          grid[y].push(ch);
          if (ch === 'T') sp.terminals.push({ tx: x, ty: y, x: cx, y: cy, p: 0, done: false });
          if (ch === m.exitChar) sp.exits.push([cx, cy]);
          continue;
        }
        grid[y].push(fl);
        if (ch === 'p') sp.player = [cx, cy];
        else if (ch === 'e') sp.enemies.push([cx, cy, m.enemy]);
        else if (ch === 'h') sp.enemies.push([cx, cy, 'heavy']);
        else if (ch === 'b') sp.enemies.push([cx, cy, 'boss']);
        else if (ch === 'f') sp.pickups.push([cx, cy, 'doc']);
        else if (ch === 'm') sp.pickups.push([cx, cy, 'med']);
        else if (ch === 'a') sp.pickups.push([cx, cy, 'ammo']);
        else if (ch === 'A') sp.pickups.push([cx, cy, 'armor']);
        else if (ch === 'R') sp.reinf.push([cx, cy]);
      }
    }
    const L = { w, h, grid, floor, sp };
    L.floorCanvas = document.createElement('canvas'); L.floorCanvas.width = w * TILE; L.floorCanvas.height = h * TILE;
    L.decal = document.createElement('canvas'); L.decal.width = w * TILE; L.decal.height = h * TILE;
    const g = L.floorCanvas.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) paintFloor(g, L, x, y);
    let hx0 = 1e9, hy0 = 1e9, hx1 = -1, hy1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (grid[y][x] === 'H') { hx0 = Math.min(hx0, x); hy0 = Math.min(hy0, y); hx1 = Math.max(hx1, x); hy1 = Math.max(hy1, y); }
    if (hx1 >= 0) {
      const cx = (hx0 + hx1 + 1) / 2 * TILE, cy = (hy0 + hy1 + 1) / 2 * TILE, R = (hx1 - hx0 + 1) * TILE / 2 - 8;
      g.strokeStyle = '#f5b82e'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#eef1f6'; g.font = `${R * 1.1}px ${FONT_D}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', cx, cy + 4);
      L.heli = [cx, cy];
    }
    L.mini = document.createElement('canvas'); L.mini.width = w; L.mini.height = h;
    const mg = L.mini.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = grid[y][x];
      mg.fillStyle = ch === 'O' ? 'rgba(0,0,0,0)' : ch === '#' || ch === 'W' ? '#56627a' : TILES[ch].s ? '#2c3547' : ch === '_' ? '#3a3a3c' : ch === 'E' ? '#4b5566' : ch === 'H' ? '#5a4a1e' : '#1a2232';
      mg.fillRect(x, y, 1, 1);
    }
    return L;
  }

  function paintFloor(g, L, x, y) {
    const ch = L.grid[y][x], px = x * TILE, py = y * TILE;
    if (ch === 'O') return;
    const f = ch === 'E' || ch === 'H' ? ch : L.floor[y][x];
    if (f === '.') {
      g.fillStyle = '#a7adb6'; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = 'rgba(255,255,255,0.09)'; g.fillRect(px + 1, py + 1, 22, 22); g.fillRect(px + 25, py + 25, 22, 22);
      g.strokeStyle = 'rgba(40,50,70,0.2)'; g.lineWidth = 1;
      for (const [a, b] of [[0, 0], [24, 0], [0, 24], [24, 24]]) g.strokeRect(px + a + 0.5, py + b + 0.5, 24, 24);
    } else if (f === ',') {
      g.fillStyle = '#46526b'; g.fillRect(px, py, TILE, TILE);
      for (let i = 0; i < 14; i++) { g.fillStyle = hash(x * 13 + i, y * 7 - i) < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)'; g.fillRect(px + hash(x + i, y) * 44, py + hash(x, y + i) * 44, 4, 4); }
    } else if (f === '_') {
      g.fillStyle = '#7a5f47'; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 4; i++) g.fillRect(px, py + i * 12 + 11, TILE, 1);
    } else if (f === 'E') {
      g.fillStyle = '#8b949f'; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = '#f5b82e'; g.fillRect(px, py, TILE, 3); g.fillStyle = '#4c535c'; g.fillRect(px + TILE / 2 - 1, py, 2, TILE);
    } else if (f === 'H') { g.fillStyle = '#2b2e34'; g.fillRect(px, py, TILE, TILE); }
  }

  /* ---------------- Construção 3D do nível ---------------- */
  let levelGroup = null, levelDispose = [];
  const solidCh = (c) => c === '#' || c === 'W' || c === 'G' || c === 'O';
  function build3D(L) {
    if (levelGroup) { scene.remove(levelGroup); levelDispose.forEach((d) => d.dispose && d.dispose()); }
    levelDispose = []; levelGroup = new THREE.Group(); scene.add(levelGroup);
    const wm = L.w * 2, hm = L.h * 2;
    const ft = new THREE.CanvasTexture(L.floorCanvas); ft.anisotropy = MAX_ANISO; levelDispose.push(ft);
    const floorM = new THREE.MeshLambertMaterial({ map: ft, alphaTest: 0.5 }); levelDispose.push(floorM);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(wm, hm), floorM);
    floor.rotation.x = -Math.PI / 2; floor.position.set(wm / 2, 0, hm / 2); floor.receiveShadow = true; levelGroup.add(floor); levelDispose.push(floor.geometry);
    L.decalTex = new THREE.CanvasTexture(L.decal); L.decalTex.anisotropy = MAX_ANISO; levelDispose.push(L.decalTex);
    const decM = new THREE.MeshLambertMaterial({ map: L.decalTex, transparent: true, depthWrite: false }); levelDispose.push(decM);
    const dec = new THREE.Mesh(new THREE.PlaneGeometry(wm, hm), decM);
    dec.rotation.x = -Math.PI / 2; dec.position.set(wm / 2, 0.015, hm / 2); dec.receiveShadow = true; levelGroup.add(dec); levelDispose.push(dec.geometry);
    // laje e fachada
    const bw = (L.w - 2) * 2, bh = (L.h - 2) * 2;
    const slab = new THREE.Mesh(G_BOX, lam('#2a2f38')); slab.scale.set(bw, 0.6, bh); slab.position.set(wm / 2, -0.31, hm / 2); levelGroup.add(slab);
    const facGeo = new THREE.BoxGeometry(bw - 0.6, 95, bh - 0.6); levelDispose.push(facGeo);
    const uv = facGeo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * bw / 6, uv.getY(k) * 95 / 6);
    const fac = new THREE.Mesh(facGeo, new THREE.MeshLambertMaterial({ map: TEX.facade, emissive: '#ffffff', emissiveMap: TEX.facade, emissiveIntensity: 0.5, color: '#8a93a6' }));
    fac.position.set(wm / 2, -48.1, hm / 2); levelGroup.add(fac); levelDispose.push(fac.material);

    const lists = {};
    const add = (key, x, y, z, sx, sy, sz, ry, color) => { (lists[key] || (lists[key] = [])).push([x, y, z, sx, sy, sz, ry || 0, color]); return lists[key].length - 1; };
    L.glassIdx = {};
    const screenCols = ['#5ec2ff', '#7de0b0', '#9fb6ff', '#ffd27a'];
    for (let ty = 0; ty < L.h; ty++) for (let tx = 0; tx < L.w; tx++) {
      const ch = L.grid[ty][tx], cx = tx * 2 + 1, cz = ty * 2 + 1, hh = hash(tx, ty);
      const nb = (dx, dy) => (L.grid[ty + dy] || [])[tx + dx];
      switch (ch) {
        case '#': add('wall', cx, 1.5, cz, 2, 3, 2); add('wallTop', cx, 3.01, cz, 2, 0.02, 2); break;
        case 'W': {
          const vert = tx === 1 || tx === L.w - 2, horiz = ty === 1 || ty === L.h - 2;
          if (horiz) { add('win', cx, 1.6, cz, 2, 3.2, 0.1); add('mull', cx - 1, 1.6, cz, 0.12, 3.2, 0.16); add('sill', cx, 0.15, cz, 2, 0.3, 0.3); add('sill', cx, 3.15, cz, 2, 0.12, 0.3); }
          if (vert) { add('win', cx, 1.6, cz, 0.1, 3.2, 2); add('mull', cx, 1.6, cz - 1, 0.16, 3.2, 0.12); add('sill', cx, 0.15, cz, 0.3, 0.3, 2); add('sill', cx, 3.15, cz, 0.3, 0.12, 2); }
          break;
        }
        case 'G': {
          const alongX = solidCh(nb(-1, 0)) || solidCh(nb(1, 0));
          const sx = alongX ? 2 : 0.1, sz = alongX ? 0.1 : 2;
          const i = add('glass', cx, 1.3, cz, sx, 2.6, sz);
          add('railB', cx, 0.06, cz, alongX ? 2 : 0.16, 0.12, alongX ? 0.16 : 2);
          add('railT', cx, 2.6, cz, alongX ? 2 : 0.16, 0.08, alongX ? 0.16 : 2);
          L.glassIdx[ty * L.w + tx] = i;
          break;
        }
        case 'D': {
          const up = hh < 0.5, s = up ? -1 : 1;
          add('deskTop', cx, 0.74, cz, 1.9, 0.06, 1.5);
          add('deskSide', cx - 0.9, 0.37, cz, 0.06, 0.72, 1.4); add('deskSide', cx + 0.9, 0.37, cz, 0.06, 0.72, 1.4);
          add('deskBack', cx, 0.45, cz + s * 0.68, 1.8, 0.5, 0.04);
          add('monitor', cx, 1.06, cz + s * 0.45, 0.62, 0.38, 0.04); add('stand', cx, 0.85, cz + s * 0.5, 0.06, 0.2, 0.06);
          add('screen', cx, 1.06, cz + s * 0.425, 0.56, 0.32, 0.01, 0, screenCols[Math.floor(hash(ty, tx) * 4)]);
          add('keyb', cx, 0.78, cz - s * 0.05, 0.5, 0.02, 0.16);
          if (hash(tx + 3, ty) < 0.5) add('mug', cx + 0.6, 0.83, cz - s * 0.1, 0.06, 0.12, 0.06);
          add('paper', cx - 0.55, 0.775, cz + s * 0.05, 0.3, 0.01, 0.4, hh);
          add('chairSeat', cx + (hh - 0.5) * 0.4, 0.48, cz - s * 0.95, 0.5, 0.08, 0.5);
          add('chairBack', cx + (hh - 0.5) * 0.4, 0.82, cz - s * 1.18, 0.48, 0.6, 0.06);
          add('chairLeg', cx + (hh - 0.5) * 0.4, 0.24, cz - s * 0.95, 0.06, 0.46, 0.06);
          break;
        }
        case 'd': add('tableTop', cx, 0.76, cz, 2.02, 0.08, 2.02); add('tableLeg', cx, 0.38, cz, 0.3, 0.74, 0.3); if (hh < 0.35) add('paper', cx, 0.81, cz, 0.42, 0.01, 0.3, hh * 3); break;
        case 'P': add('pot', cx, 0.28, cz, 0.38, 0.56, 0.38); add('leaf', cx, 0.95, cz, 0.6, 0.55, 0.6); add('leaf', cx + 0.1, 1.35, cz - 0.05, 0.42, 0.45, 0.42); break;
        case 'K': add('counter', cx, 0.47, cz, 2, 0.94, 1.9); add('counterTop', cx, 0.96, cz, 2.02, 0.05, 1.94); if (tx % 2) add('sink', cx, 0.97, cz, 0.7, 0.04, 0.5); else add('appliance', cx, 1.2, cz - 0.4, 0.6, 0.45, 0.4); break;
        case 'V': add('coolerBase', cx, 0.45, cz, 0.5, 0.9, 0.5); add('coolerJug', cx, 1.15, cz, 0.24, 0.5, 0.24); break;
        case 'B': add('shelf', cx, 1.1, cz, 1.9, 2.2, 1.9); break;
        case 'S': add('server', cx, 1.1, cz, 1.8, 2.2, 1.8); break;
        case 'X': add('crate', cx, 0.55, cz, 1.7, 1.1, 1.7, hh * 0.3); if (hh < 0.35) add('crate', cx, 1.45, cz, 1.2, 0.7, 1.2, hh * 2); break;
        case 'L': {
          const backZ = (TILES[nb(0, -1)] || {}).s ? -1 : 1;
          add('sofa', cx, 0.25, cz, 1.9, 0.5, 1.5); add('sofaBack', cx, 0.65, cz + backZ * 0.65, 1.9, 0.8, 0.25); add('cushion', cx, 0.53, cz - backZ * 0.1, 1.7, 0.08, 1.1);
          break;
        }
        case 'T': add('kiosk', cx, 0.5, cz, 1.2, 1.0, 1.2); add('stand', cx, 1.15, cz, 0.1, 0.3, 0.1); break;
      }
    }
    const DEF = {
      wall: [G_BOX, lam('#4a5160'), 1], wallTop: [G_BOX, lam('#2a2f38'), 0],
      win: [G_BOX, new THREE.MeshLambertMaterial({ color: '#6aa6dc', transparent: true, opacity: 0.16, depthWrite: false }), 0],
      mull: [G_BOX, lam('#8b98aa'), 1], sill: [G_BOX, lam('#6d7787'), 1],
      glass: [G_BOX, new THREE.MeshLambertMaterial({ color: '#b8e2ff', transparent: true, opacity: 0.28, depthWrite: false }), 0],
      railB: [G_BOX, lam('#8b98aa'), 1], railT: [G_BOX, lam('#8b98aa'), 1],
      deskTop: [G_BOX, lam('#b08a5e'), 1], deskSide: [G_BOX, lam('#d9dde3'), 1], deskBack: [G_BOX, lam('#d9dde3'), 1],
      monitor: [G_BOX, lam('#15181d'), 1], stand: [G_BOX, lam('#2a2e35'), 1], screen: [G_BOX, new THREE.MeshBasicMaterial({ color: '#ffffff' }), 0],
      keyb: [G_BOX, lam('#2c3038'), 0], mug: [G_CYL, lam('#c0392b'), 0], paper: [G_BOX, lam('#f4f2ea'), 0],
      chairSeat: [G_BOX, lam('#22262d'), 1], chairBack: [G_BOX, lam('#22262d'), 1], chairLeg: [G_BOX, lam('#555b66'), 0],
      tableTop: [G_BOX, lam('#5b3f2c'), 1], tableLeg: [G_CYL, lam('#2a2f38'), 1],
      pot: [G_CYL, lam('#6b4a2e'), 1], leaf: [G_ICO, lam('#3f9b4c', { flatShading: true }), 1],
      counter: [G_BOX, lam('#3f444c'), 1], counterTop: [G_BOX, lam('#6a6f78'), 1], sink: [G_BOX, lam('#a7b0ba'), 0], appliance: [G_BOX, lam('#1b1f26'), 1],
      coolerBase: [G_BOX, lam('#e3e7ec'), 1], coolerJug: [G_CYL, new THREE.MeshLambertMaterial({ color: '#4fa3e0', transparent: true, opacity: 0.75 }), 1],
      shelf: [G_BOX, new THREE.MeshLambertMaterial({ map: TEX.books }), 1],
      server: [G_BOX, new THREE.MeshLambertMaterial({ map: TEX.server, emissive: '#ffffff', emissiveMap: TEX.serverE, emissiveIntensity: 1 }), 1],
      crate: [G_BOX, new THREE.MeshLambertMaterial({ map: TEX.crate }), 1],
      sofa: [G_BOX, lam('#5a3424'), 1], sofaBack: [G_BOX, lam('#5a3424'), 1], cushion: [G_BOX, lam('#74452f'), 0],
      kiosk: [G_BOX, lam('#30363f'), 1],
    };
    L.serverMat = DEF.server[1];
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    L.inst = {};
    for (const [key, arr] of Object.entries(lists)) {
      const [geo, mat, cast] = DEF[key];
      const im = new THREE.InstancedMesh(geo, mat, arr.length);
      arr.forEach((a, i) => {
        dummy.position.set(a[0], a[1], a[2]); dummy.rotation.set(0, a[6], 0); dummy.scale.set(a[3], a[4], a[5]); dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
        if (key === 'screen') { col.set(a[7]); im.setColorAt(i, col); }
      });
      im.castShadow = !!cast; im.receiveShadow = true;
      levelGroup.add(im); L.inst[key] = im; levelDispose.push(im);
    }
    // terminais (cada um com tela própria)
    for (const t of L.sp.terminals) {
      const m = new THREE.MeshBasicMaterial({ color: '#ef5350' }); levelDispose.push(m);
      const scr = new THREE.Mesh(G_BOX, m); scr.scale.set(0.9, 0.6, 0.08); scr.position.set(t.tx * 2 + 1, 1.55, t.ty * 2 + 1);
      scr.rotation.x = -0.3; levelGroup.add(scr); t.screenMat = m; t.screen = scr;
      const back = new THREE.Mesh(G_BOX, lam('#15181d')); back.scale.set(1, 0.7, 0.06); back.position.copy(scr.position); back.position.z -= 0.06; back.rotation.x = -0.3; levelGroup.add(back);
    }
    // marcadores de objetivo
    const beamM = new THREE.MeshBasicMaterial({ color: '#f5b82e', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    levelDispose.push(beamM);
    L.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.4, 24, 1, true), beamM); L.beam.visible = false; levelGroup.add(L.beam); levelDispose.push(L.beam.geometry);
    L.arrows = [];
    for (let i = 0; i < 4; i++) { const a = new THREE.Mesh(G_CONE, basic('#f5b82e')); a.scale.set(0.28, 0.45, 0.28); a.rotation.x = Math.PI; a.visible = false; levelGroup.add(a); L.arrows.push(a); }
  }

  function hideInstance(im, i) {
    const m = new THREE.Matrix4(); im.getMatrixAt(i, m);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s);
    m.compose(p, q, new THREE.Vector3(0, 0, 0)); im.setMatrixAt(i, m); im.instanceMatrix.needsUpdate = true;
  }

  /* ---------------- Personagens 3D ---------------- */
  function makeChar(c) {
    const g = new THREE.Group(); g.rotation.order = 'YXZ';
    const inner = new THREE.Group(); g.add(inner);
    const mats = [];
    const M = (color) => { const m = new THREE.MeshLambertMaterial({ color }); mats.push(m); levelDispose.push(m); return m; };
    const mBody = M(c.body), mShirt = M(c.shirt), mSkin = M(c.skin), mHair = M(c.hair), mPants = M(c.pants || '#1c1f26'), mShoe = M('#0f1013');
    const box = (m, sx, sy, sz, x, y, z, parent) => { const b = new THREE.Mesh(G_BOX, m); b.scale.set(sx, sy, sz); b.position.set(x, y, z); b.castShadow = true; (parent || inner).add(b); return b; };
    const legs = [];
    for (const side of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(0, 0.88, side * 0.11); inner.add(hip);
      box(mPants, 0.2, 0.82, 0.18, 0, -0.42, 0, hip); box(mShoe, 0.28, 0.08, 0.16, 0.05, -0.84, 0, hip);
      legs.push(hip);
    }
    box(mBody, 0.3, 0.62, 0.48, 0, 1.2, 0);
    box(mShirt, 0.02, 0.5, 0.16, 0.155, 1.24, 0);
    if (c.tie) box(M(c.tie), 0.02, 0.38, 0.06, 0.168, 1.2, 0);
    const arms = [];
    for (const side of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(0.02, 1.43, side * 0.28); inner.add(sh);
      box(mBody, 0.5, 0.13, 0.13, 0.2, 0, 0, sh); box(mSkin, 0.1, 0.1, 0.1, 0.48, 0, 0, sh);
      sh.rotation.y = side * 0.35; sh.rotation.z = -0.25;
      arms.push(sh);
    }
    const head = new THREE.Mesh(G_SPH, mSkin); head.scale.setScalar(0.15); head.position.set(0.02, 1.7, 0); head.castShadow = true; inner.add(head);
    const hair = new THREE.Mesh(G_SPH, mHair); hair.scale.set(0.155, 0.12, 0.155); hair.position.set(-0.02, 1.76, 0); inner.add(hair);
    // armas
    const guns = {};
    const gunG = new THREE.Group(); gunG.position.set(0.5, 1.33, 0); inner.add(gunG);
    const gm = lam('#16181c');
    const mk = (name, build) => { const gg = new THREE.Group(); build(gg); gg.visible = false; gunG.add(gg); guns[name] = gg; };
    const gb = (gg, m, sx, sy, sz, x, y, z) => { const b = new THREE.Mesh(G_BOX, m); b.scale.set(sx, sy, sz); b.position.set(x, y, z); b.castShadow = true; gg.add(b); return b; };
    mk('short', (gg) => { gb(gg, gm, 0.24, 0.06, 0.05, 0.08, 0.02, 0); gb(gg, gm, 0.06, 0.12, 0.05, 0, -0.05, 0); });
    mk('mid', (gg) => { gb(gg, gm, 0.45, 0.08, 0.06, 0.12, 0.02, 0); gb(gg, gm, 0.06, 0.18, 0.05, 0.12, -0.1, 0); gb(gg, gm, 0.06, 0.1, 0.05, -0.05, -0.05, 0); });
    mk('long', (gg) => { gb(gg, gm, 0.85, 0.08, 0.07, 0.18, 0.02, 0); gb(gg, lam('#3b2a1e'), 0.25, 0.1, 0.07, -0.25, -0.01, 0); gb(gg, gm, 0.06, 0.16, 0.05, 0.22, -0.09, 0); });
    mk('melee', (gg) => { const s = gb(gg, lam('#c9ced6'), 1.0, 0.03, 0.03, 0.35, 0.25, 0); s.rotation.z = 0.6; gb(gg, lam('#e8e8e8'), 0.12, 0.08, 0.06, 0.75, 0.55, 0); });
    mk('spray', (gg) => { const c1 = new THREE.Mesh(G_CYL, lam('#c0392b')); c1.scale.set(0.09, 0.45, 0.09); c1.rotation.z = Math.PI / 2; c1.position.set(0.1, 0, 0); gg.add(c1); gb(gg, gm, 0.25, 0.03, 0.03, 0.42, 0.02, 0); });
    mk('throw', (gg) => { const s = new THREE.Mesh(G_SPH, lam('#4a5a32')); s.scale.setScalar(0.07); gg.add(s); });
    const foam = new THREE.Mesh(G_SPH, new THREE.MeshLambertMaterial({ color: '#f2f5f8', transparent: true, opacity: 0.6 })); levelDispose.push(foam.material);
    foam.scale.set(0.45, 0.9, 0.45); foam.position.y = 1.1; foam.visible = false; g.add(foam);
    const sc = c.big ? 1.18 : 1; g.scale.setScalar(sc);
    levelGroup.add(g);
    return { g, inner, legs, arms, guns, gunG, mats, foam, cur: null };
  }
  function setGun(ch, kind) { if (ch.cur === kind) return; for (const k in ch.guns) ch.guns[k].visible = k === kind; ch.cur = kind; }
  function gunShape(k) {
    const d = WEAPONS[k]; if (!d) return 'short';
    if (d.kind === 'melee') return 'melee'; if (d.kind === 'spray') return 'spray'; if (d.kind === 'throw') return 'throw';
    return k === 'rifle' || k === 'shotgun' ? 'long' : k === 'smg' ? 'mid' : 'short';
  }
  const ENEMY_GUN = { intern: 'short', guard: 'mid', heavy: 'long', merc: 'long', boss: 'mid' };

  /* ---------------- Estado do jogo ---------------- */
  let game = null, mode = 'menu';
  let yaw = 0, pitch = 0.32;
  function makePerson(x, y) { return { x, y, r: 14, vx: 0, vy: 0, angle: 0 }; }

  function newGame(mi) {
    const m = MISSIONS[mi];
    const L = buildLevel(m);
    build3D(L);
    const g = {
      m, mi, L, enemies: [], bullets: [], grenades: [], parts: [], pickups: [], floaters: [], toasts: [], subs: [], sub: null,
      time: 0, kills: 0, shots: 0, hits: 0, cash: 0, stars: m.startStars, calm: 0, starFlash: 0, reinfT: 6,
      shake: 0, hurtFlash: 0, timeLeft: m.timeLimit, state: 'play', endT: 0, titleT: 4.5,
      stage: m.type === 'collect' ? 'collect' : m.type === 'hack' ? 'hack' : 'boss',
      flow: new Int16Array(L.w * L.h), flowT: 0, seen: false, docs: 0, docsTotal: 0, terminals: L.sp.terminals,
      boss: null, hacking: null, alarm: false, aimBlend: 0, aim: [0, 0], hitMark: 0, decalDirty: false,
    };
    const p = makePerson(L.sp.player[0], L.sp.player[1]);
    Object.assign(p, { hp: 100, armor: m.armor, cur: 0, cool: 0, reload: 0, swing: 0, bloom: 0, lastHurt: 9, trig: false, dead: false, step: 0,
      weapons: m.weapons.map((k) => { const d = WEAPONS[k]; return { k, d, mag: d.mag || 0, reserve: d.reserve || 0 }; }) });
    p.mesh = makeChar({ shirt: '#e8ecf2', body: '#1f2a44', pants: '#18203a', hair: '#2a1d14', skin: '#d6a57f', tie: '#b3242f' });
    g.player = p;
    game = g;
    for (const [x, y, k] of L.sp.enemies) g.enemies.push(makeEnemy(x, y, k, false));
    g.boss = g.enemies.find((e) => e.T.boss) || null;
    for (const [x, y, t] of L.sp.pickups) { addPickup(x, y, t); if (t === 'doc') g.docsTotal++; }
    for (const [who, text] of m.intro) g.subs.push({ who, text, dur: 3.8 });
    // câmera olhando para o interior
    let best = 0, by = 0;
    for (let a = 0; a < 8; a++) { const ang = a / 8 * Math.PI * 2; let d = 0; while (d < 600 && !TILES[tileAt(Math.floor((p.x + Math.cos(ang) * d) / TILE), Math.floor((p.y + Math.sin(ang) * d) / TILE))].v) d += 12; if (d > best) { best = d; by = ang; } }
    yaw = by; pitch = 0.3; p.angle = yaw;
    computeFlow();
    initPools();
    return g;
  }

  function makeEnemy(x, y, k, alert) {
    const T = ENEMIES[k];
    const e = makePerson(x, y);
    Object.assign(e, { k, T, hp: T.hp, maxHp: T.hp, r: T.big ? 17 : 14, alert, react: T.react, cool: rand(0.2, 1), lastSeen: 0, stun: 0, hurtT: 0,
      hx: x, hy: y, wx: x, wy: y, wanderT: rand(0, 3), idleMove: false, strafe: 0, strafeT: 0, burstLeft: 0, dead: false, deadT: 0,
      angle: rand(0, Math.PI * 2), pref: T.pref + rand(-40, 40), nadeT: 6, step: 0 });
    e.mesh = makeChar({ shirt: T.shirt, body: T.body, hair: T.hair, skin: '#c99a78', big: T.big, tie: T.boss ? '#7a1f2b' : null, pants: T.boss ? '#cfc6b1' : '#1c1f26' });
    setGun(e.mesh, ENEMY_GUN[k]);
    return e;
  }

  function addPickup(x, y, t, v) {
    const g = new THREE.Group();
    const box = (color, sx, sy, sz, px, py, pz, basicM) => { const b = new THREE.Mesh(G_BOX, basicM ? basic(color) : lam(color)); b.scale.set(sx, sy, sz); b.position.set(px || 0, py || 0, pz || 0); b.castShadow = true; g.add(b); return b; };
    if (t === 'doc') { box('#d9a441', 0.5, 0.06, 0.38); box('#fff8e6', 0.42, 0.065, 0.3, 0.02, 0.005); box('#f0c35d', 0.2, 0.07, 0.06, -0.1, 0.01, -0.18); }
    else if (t === 'med') { box('#f2f2f2', 0.45, 0.3, 0.3); box('#d33', 0.08, 0.31, 0.22, 0, 0, 0, true); box('#d33', 0.3, 0.31, 0.08, 0, 0, 0, true); }
    else if (t === 'armor') { box('#2f4b73', 0.45, 0.5, 0.15); box('#5aa9ff', 0.3, 0.06, 0.16, 0, 0.12); }
    else if (t === 'ammo') { box('#4c5a35', 0.5, 0.25, 0.3); box('#d9b35b', 0.4, 0.04, 0.2, 0, 0.14); }
    else if (t === 'cash') { box('#3d8b4f', 0.36, 0.12, 0.2); box('#7bd88f', 0.32, 0.125, 0.16); }
    g.position.set(x * S, 0.5, y * S);
    levelGroup.add(g);
    game.pickups.push({ x, y, t, v, bob: Math.random() * 6, mesh: g });
  }

  /* ---------------- Física e visão ---------------- */
  function tileAt(tx, ty) { if (!game || ty < 0 || ty >= game.L.h || tx < 0 || tx >= game.L.w) return 'O'; return game.L.grid[ty][tx]; }
  function solidAt(tx, ty) { return !!TILES[tileAt(tx, ty)].s; }
  function los(x1, y1, x2, y2, key) {
    const d = Math.hypot(x2 - x1, y2 - y1), n = Math.ceil(d / 12);
    for (let i = 1; i < n; i++) { const t = i / n; if (TILES[tileAt(Math.floor((x1 + (x2 - x1) * t) / TILE), Math.floor((y1 + (y2 - y1) * t) / TILE))][key]) return false; }
    return true;
  }
  function resolve(e) {
    const r = e.r;
    for (let it = 0; it < 2; it++) {
      const x0 = Math.floor((e.x - r) / TILE), x1 = Math.floor((e.x + r) / TILE), y0 = Math.floor((e.y - r) / TILE), y1 = Math.floor((e.y + r) / TILE);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (!solidAt(tx, ty)) continue;
        const cx = clamp(e.x, tx * TILE, tx * TILE + TILE), cy = clamp(e.y, ty * TILE, ty * TILE + TILE);
        let dx = e.x - cx, dy = e.y - cy, d = Math.hypot(dx, dy);
        if (d < r) {
          if (d < 0.001) { dx = e.x - (tx * TILE + TILE / 2); dy = e.y - (ty * TILE + TILE / 2); d = Math.hypot(dx, dy) || 1; e.x += dx / d * 2; e.y += dy / d * 2; continue; }
          e.x += dx / d * (r - d); e.y += dy / d * (r - d);
        }
      }
    }
  }
  function moveEnt(e, dx, dy) { e.x += dx; e.y += dy; resolve(e); }
  function computeFlow() {
    const { w, h } = game.L, f = game.flow; f.fill(-1);
    const px = Math.floor(game.player.x / TILE), py = Math.floor(game.player.y / TILE);
    const q = new Int32Array(w * h); let qh = 0, qt = 0;
    f[py * w + px] = 0; q[qt++] = py * w + px;
    while (qh < qt) {
      const i = q[qh++], x = i % w, y = (i - x) / w, d = f[i];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx; if (f[ni] !== -1 || TILES[game.L.grid[ny][nx]].s) continue;
        f[ni] = d + 1; q[qt++] = ni;
      }
    }
  }
  function flowDir(e) {
    const { w } = game.L, tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE), here = game.flow[ty * w + tx];
    if (here <= 1 && here !== -1) { const dx = game.player.x - e.x, dy = game.player.y - e.y, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; }
    let best = here === -1 ? 1e9 : here, bx = 0, by = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = tx + dx, ny = ty + dy; if (solidAt(nx, ny)) continue;
      if (dx && dy && (solidAt(tx + dx, ty) || solidAt(tx, ty + dy))) continue;
      const v = game.flow[ny * w + nx]; if (v < 0) continue;
      if (v < best || (v === best && !(bx || by))) { best = v; bx = dx; by = dy; }
    }
    if (!bx && !by) return [0, 0];
    const gx = (tx + bx) * TILE + TILE / 2 - e.x, gy = (ty + by) * TILE + TILE / 2 - e.y, gd = Math.hypot(gx, gy) || 1;
    return [gx / gd, gy / gd];
  }

  /* ---------------- Partículas (instanciadas) ---------------- */
  const PMAX = 700, TMAX = 260;
  let pools = null;
  function initPools() {
    const mk = (geo, mat, n) => { const im = new THREE.InstancedMesh(geo, mat, n); const c = new THREE.Color('#fff'); for (let i = 0; i < n; i++) im.setColorAt(i, c); im.count = 0; im.frustumCulled = false; levelGroup.add(im); levelDispose.push(im); return im; };
    pools = {
      solid: mk(G_BOX, new THREE.MeshBasicMaterial({ color: '#ffffff' }), PMAX),
      soft: mk(G_SPH, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false }), 300),
      glow: mk(G_SPH, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }), 120),
      tracer: mk(G_BOX, new THREE.MeshBasicMaterial({ color: '#ffffff' }), TMAX),
      nade: mk(G_SPH, lam('#4a5a32'), 24),
    };
    for (const k in pools) levelDispose.push(pools[k].material);
  }
  const _c = new THREE.Color();
  function part(x, y, h, vx, vy, vh, life, color, size, kind) {
    game.parts.push({ x, y, h, vx, vy, vh, life, max: life, color, size, kind: kind || 'spark', rot: rand(0, 6), vr: rand(-8, 8) });
  }
  function burst(x, y, h, n, color, sp, life, size, kind, up) {
    for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), s = rand(sp * 0.3, sp); part(x, y, h, Math.cos(a) * s, Math.sin(a) * s, rand(0.5, 3) * (up || 1), rand(life * 0.5, life), color, size, kind); }
  }
  function decalBlood(x, y, r) {
    const g = game.L.decal.getContext('2d');
    for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(${110 + randi(0, 30)},12,16,${rand(0.35, 0.6)})`; g.beginPath(); g.arc(x + rand(-r, r) * 0.6, y + rand(-r, r) * 0.6, rand(r * 0.3, r), 0, Math.PI * 2); g.fill(); }
    game.decalDirty = true;
  }
  function decalScorch(x, y, r) {
    const g = game.L.decal.getContext('2d'), rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(10,8,6,0.75)'); rg.addColorStop(1, 'rgba(10,8,6,0)'); g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    game.decalDirty = true;
  }
  function floater(x, y, text, color) { game.floaters.push({ x, y, h: 2.2, text, color: color || '#eef1f6', t: 1.6 }); }
  function toast(text, color) { game.toasts.unshift({ text, color: color || '#eef1f6', t: 3 }); if (game.toasts.length > 4) game.toasts.pop(); }
  function say(who, text, dur) { game.subs.push({ who, text, dur: dur || 3.5 }); }

  function breakGlass(tx, ty) {
    const L = game.L; if (L.grid[ty][tx] !== 'G') return;
    L.grid[ty][tx] = L.floor[ty][tx];
    const i = L.glassIdx[ty * L.w + tx];
    if (i !== undefined) { hideInstance(L.inst.glass, i); hideInstance(L.inst.railT, i); }
    const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2;
    for (let k = 0; k < 26; k++) part(cx + rand(-20, 20), cy + rand(-20, 20), rand(0.2, 2.5), rand(-160, 160), rand(-160, 160), rand(-1, 2), rand(0.6, 1.2), '#cfeaff', rand(0.04, 0.1), 'shard');
    const g = L.decal.getContext('2d'); g.fillStyle = 'rgba(210,240,255,0.6)';
    for (let k = 0; k < 30; k++) g.fillRect(cx + rand(-34, 34), cy + rand(-34, 34), rand(1, 4), rand(1, 3));
    game.decalDirty = true;
    const mg = L.mini.getContext('2d'); mg.fillStyle = '#1a2232'; mg.fillRect(tx, ty, 1, 1);
    sfx('glass', cx, cy);
    computeFlow();
  }

  /* ---------------- Alerta ---------------- */
  function raiseStars(n) {
    const v = Math.min(game.m.maxStars, n);
    if (v > game.stars) { game.stars = v; game.starFlash = 1.2; sfx('star'); }
    game.calm = 0;
  }
  function alertEnemies(x, y, radius) {
    if (radius <= 0) return;
    for (const e of game.enemies) { if (e.dead || e.alert) continue; if (dist(x, y, e.x, e.y) < radius) { e.alert = true; e.react = e.T.react + 0.3; e.lastSeen = 0; } }
  }

  /* ---------------- Entrada ---------------- */
  const keys = {}; const mouse = { x: 0, y: 0, down: false, right: false };
  const touch = { move: { id: null, ox: 0, oy: 0, x: 0, y: 0 }, look: { id: null, x: 0, y: 0 }, btn: {}, use: false, fire: false };
  let locked = false, lockFailed = false;
  const SENS = 0.0024;

  function stickVec(s) {
    if (s.id === null) return [0, 0, 0];
    const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy), R = 56, m = Math.min(1, d / R);
    return d > 4 ? [dx / d * m, dy / d * m, m] : [0, 0, 0];
  }
  function curWeapon() { return game.player.weapons[game.player.cur]; }
  function switchWeapon(i) { const p = game.player; if (i === p.cur || i < 0 || i >= p.weapons.length) return; p.cur = i; p.reload = 0; p.cool = Math.max(p.cool, 0.15); sfx('switch'); }
  function startReload() {
    const p = game.player, w = curWeapon(), d = w.d;
    if (d.kind === 'melee' || p.reload > 0 || w.mag >= d.mag || w.reserve <= 0) return;
    p.reload = d.reload; if (d.kind !== 'throw') sfx('reload');
  }
  function finishReload(w) { const n = Math.min(w.d.mag - w.mag, w.reserve); w.mag += n; w.reserve -= n; }

  /* ---------------- Mira (raio da câmera projetado no plano) ---------------- */
  function computeAim() {
    const p = game.player, cy = Math.cos(yaw), sy = Math.sin(yaw);
    const x0 = camera.position.x / S, y0 = camera.position.z / S, camH = camera.position.y;
    let maxD = 1800; const tp = Math.tan(pitch);
    if (tp > 0.01) maxD = Math.min(maxD, Math.max(60, ((camH - 0.9) / tp) / S));
    const cp = dist(x0, y0, p.x, p.y);
    for (let t = cp + 16; t < maxD; t += 8) {
      const qx = x0 + cy * t, qy = y0 + sy * t;
      if (TILES[tileAt(Math.floor(qx / TILE), Math.floor(qy / TILE))].b) return [qx, qy, true];
      for (const e of game.enemies) if (!e.dead && (qx - e.x) ** 2 + (qy - e.y) ** 2 < (e.r + 5) ** 2) return [qx, qy, true, e];
    }
    return [x0 + cy * maxD, y0 + sy * maxD, false];
  }

  /* ---------------- Jogador ---------------- */
  function updatePlayer(dt) {
    const p = game.player; if (p.dead) return;
    let kx = 0, ky = 0;
    if (keys.KeyW || keys.ArrowUp) ky += 1; if (keys.KeyS || keys.ArrowDown) ky -= 1;
    if (keys.KeyA) kx -= 1; if (keys.KeyD) kx += 1;
    if (keys.ArrowLeft) yaw -= 2.2 * dt; if (keys.ArrowRight) yaw += 2.2 * dt;
    const mv = stickVec(touch.move); kx += mv[0]; ky -= mv[1];
    const fx = Math.cos(yaw), fy = Math.sin(yaw), rx = -fy, ry = fx;
    let mx = fx * ky + rx * kx, my = fy * ky + ry * kx;
    const len = Math.hypot(mx, my); if (len > 1) { mx /= len; my /= len; }
    const aiming = mouse.right;
    const sprint = (keys.ShiftLeft || keys.ShiftRight || mv[2] > 0.97) && !aiming;
    const sp = sprint ? 300 : aiming ? 150 : 205;
    const k = Math.min(1, dt * 12);
    p.vx = lerp(p.vx, mx * sp, k); p.vy = lerp(p.vy, my * sp, k);
    moveEnt(p, p.vx * dt, p.vy * dt);
    const spd = Math.hypot(p.vx, p.vy), moving = spd > 30; if (moving) p.step += dt * spd / 34;

    const aim = computeAim(); game.aim = aim;
    // assistência de mira no toque
    if (isTouch && touch.fire) {
      let best = null, bd = 0.22;
      for (const e of game.enemies) { if (e.dead) continue; const a = Math.atan2(e.y - p.y, e.x - p.x), d = Math.abs(angDiff(yaw, a)); if (d < bd && dist(p.x, p.y, e.x, e.y) < 700 && los(p.x, p.y, e.x, e.y, 'b')) { bd = d; best = a; } }
      if (best !== null) yaw += angDiff(yaw, best) * Math.min(1, dt * 6);
    }
    const ad = dist(p.x, p.y, aim[0], aim[1]);
    p.angle = ad > 40 ? Math.atan2(aim[1] - p.y, aim[0] - p.x) : yaw;

    p.cool -= dt; p.swing = Math.max(0, p.swing - dt); p.bloom = Math.max(0, p.bloom - dt * 1.6); p.lastHurt += dt;
    if (p.lastHurt > 5 && p.hp < 50) p.hp = Math.min(50, p.hp + 4 * dt);
    const w = curWeapon();
    if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) { p.reload = 0; finishReload(w); } }
    const trigger = (mouse.down && (locked || lockFailed || isTouch)) || touch.fire;
    if (trigger) tryFire(w, !p.trig || isTouch, moving, aiming);
    p.trig = trigger;
    if ((w.d.kind === 'gun' || w.d.kind === 'spray') && w.mag <= 0 && w.reserve > 0 && p.reload <= 0 && !trigger) startReload();

    game.hacking = null;
    if (game.stage === 'hack') {
      for (const t of game.terminals) {
        if (t.done || dist(p.x, p.y, t.x, t.y) > 74) continue;
        game.hacking = t;
        if (keys.KeyE || touch.use) {
          t.p += dt / 4;
          if (Math.random() < 0.3) sfx('hack');
          if (!game.alarm) { game.alarm = true; raiseStars(3); alertEnemies(p.x, p.y, 2000); say('Sistema', 'ALARME: invasão detectada no data center.', 3); }
          if (t.p >= 1) { t.p = 1; t.done = true; sfx('done'); toast(`Terminal invadido ${game.terminals.filter((q) => q.done).length}/${game.terminals.length}`, '#f5b82e'); }
        }
        break;
      }
    }
  }

  function tryFire(w, fresh, moving, aiming) {
    const p = game.player, d = w.d;
    if (p.cool > 0 || p.reload > 0) return;
    const ca = Math.cos(p.angle), sa = Math.sin(p.angle);
    if (d.kind === 'melee') {
      p.cool = d.rate; p.swing = 0.25; sfx('swing');
      let hit = false;
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (dist(p.x, p.y, e.x, e.y) > d.range + e.r) continue;
        if (Math.abs(angDiff(p.angle, Math.atan2(e.y - p.y, e.x - p.x))) > d.arc / 2) continue;
        if (!los(p.x, p.y, e.x, e.y, 'b')) continue;
        damageEnemy(e, d.dmg, ca, sa, 260); e.stun = Math.max(e.stun, 0.45); hit = true;
      }
      if (hit) { sfx('hit'); game.shake += 4; game.hitMark = 0.2; }
      return;
    }
    if (d.kind === 'throw') {
      if (!fresh) return;
      if (w.mag <= 0) { if (w.reserve > 0) startReload(); else { sfx('empty'); p.cool = 0.3; } return; }
      w.mag--; p.cool = d.rate; sfx('throw');
      const dd = clamp(dist(p.x, p.y, game.aim[0], game.aim[1]), 60, 360), kk = 2.6;
      game.grenades.push({ x: p.x + ca * 18, y: p.y + sa * 18, vx: ca * dd * kk, vy: sa * dd * kk, k: kk, fuse: 1.6, t: 0, owner: 'player' });
      if (w.mag <= 0 && w.reserve > 0) startReload();
      return;
    }
    if (!d.auto && !fresh) return;
    if (w.mag <= 0) { if (w.reserve > 0) startReload(); else if (fresh) { sfx('empty'); p.cool = 0.25; toast('Sem munição', '#ef5350'); } return; }
    w.mag--; p.cool = d.rate;
    const mx = p.x + ca * 22, my = p.y + sa * 22;
    if (d.kind === 'spray') {
      sfx('spray');
      for (let i = 0; i < 4; i++) { const a = p.angle + rand(-d.cone, d.cone) * 0.8, s = rand(220, 420); part(mx, my, 1.3, Math.cos(a) * s, Math.sin(a) * s, rand(-0.5, 0.8), rand(0.35, 0.6), '#f2f5f8', rand(0.12, 0.25), 'foam'); }
      for (const e of game.enemies) {
        if (e.dead || dist(p.x, p.y, e.x, e.y) > d.range + e.r) continue;
        if (Math.abs(angDiff(p.angle, Math.atan2(e.y - p.y, e.x - p.x))) > d.cone) continue;
        if (!los(p.x, p.y, e.x, e.y, 'b')) continue;
        damageEnemy(e, d.dmg, ca, sa, 40, true); e.stun = Math.max(e.stun, d.stun);
      }
      alertEnemies(p.x, p.y, d.noise);
      return;
    }
    const n = d.pellets || 1;
    const spread = (d.spread * (moving ? 1.5 : 1) + p.bloom * 0.05) * (aiming ? 0.55 : 1);
    for (let i = 0; i < n; i++) {
      const a = p.angle + rand(-spread, spread);
      game.bullets.push({ x: mx, y: my, vx: Math.cos(a) * d.speed, vy: Math.sin(a) * d.speed, dmg: d.dmg, owner: 'player', life: 0.9, color: d.tracer, knock: d.knock || 60 });
      game.shots++;
    }
    p.bloom = Math.min(1, p.bloom + (w.k === 'shotgun' ? 0.6 : 0.18));
    part(mx, my, 1.33, 0, 0, 0, 0.06, '#fff2b0', 0.35, 'glow');
    muzzleLight.position.set(mx * S, 1.4, my * S); muzzleLight.intensity = 2.2;
    part(p.x, p.y, 1.3, Math.cos(p.angle + 1.6) * rand(60, 120), Math.sin(p.angle + 1.6) * rand(60, 120), rand(1.5, 2.5), 1.2, '#d9b35b', 0.04, 'casing');
    game.shake += w.k === 'shotgun' ? 6 : w.k === 'stapler' ? 0.6 : 1.8;
    pitch -= (w.k === 'shotgun' ? 0.03 : w.k === 'rifle' ? 0.008 : 0.004);
    sfx(d.sound);
    alertEnemies(p.x, p.y, d.noise);
    if (d.noise >= 500) raiseStars(1);
    if (w.mag <= 0 && w.reserve > 0) startReload();
  }

  function damagePlayer(dmg) {
    const p = game.player; if (p.dead || game.state !== 'play') return;
    if (p.armor > 0) { const a = Math.min(p.armor, dmg * 0.7); p.armor -= a; dmg -= a; }
    p.hp -= dmg; p.lastHurt = 0; game.hurtFlash = Math.min(1, game.hurtFlash + 0.35); game.shake += 3;
    burst(p.x, p.y, 1.3, 4, '#a3141c', 120, 0.5, 0.06, 'blood');
    if (Math.random() < 0.4) sfx('hurt');
    if (p.hp <= 0) { p.hp = 0; p.dead = true; p.deadT = 0; decalBlood(p.x, p.y, 22); endMission(false, 'Ricardo Kling caiu no próprio escritório. O conselho já procura um novo CEO.'); }
  }
  function damageEnemy(e, dmg, dx, dy, knock, quiet) {
    if (e.dead) return;
    e.hp -= dmg; e.hurtT = 0.1;
    if (!e.alert) { e.alert = true; e.react = 0.15; }
    e.lastSeen = 0; e.vx += dx * knock; e.vy += dy * knock;
    if (!quiet) burst(e.x, e.y, 1.3, 6, '#a3141c', 150, 0.6, 0.06, 'blood');
    if (e.hp <= 0) killEnemy(e, dx, dy);
  }
  function killEnemy(e, dx, dy) {
    e.dead = true; e.deadT = 0; e.angle = Math.atan2(dy, dx) + Math.PI; game.kills++;
    decalBlood(e.x + dx * 18, e.y + dy * 18, e.T.big ? 26 : 20);
    addPickup(e.x + rand(-10, 10), e.y + rand(-10, 10), 'cash', randi(e.T.cash[0], e.T.cash[1]));
    if (Math.random() < e.T.drop) addPickup(e.x + rand(-16, 16), e.y + rand(-16, 16), Math.random() < 0.6 ? 'ammo' : 'med');
    raiseStars(Math.min(game.m.maxStars, 1 + Math.floor(game.kills / 4)));
    if (e.T.boss) {
      game.stage = 'escape'; game.stars = game.m.maxStars; game.starFlash = 2;
      say('Ricardo', 'Acabou, Otávio. Agora, para o heliponto!', 3.5);
      say('Rádio', 'Atenção: polícia chegando ao prédio. Todas as unidades para a cobertura.', 3.5);
      toast('Vasconcelos eliminado', '#f5b82e'); sfx('done');
    }
  }

  function enemyFire(e, ang) {
    const T = e.T, n = T.pellets, mx = e.x + Math.cos(ang) * 22, my = e.y + Math.sin(ang) * 22;
    const pm = Math.hypot(game.player.vx, game.player.vy) > 150 ? 1.25 : 1;
    for (let i = 0; i < n; i++) {
      const a = ang + rand(-T.spread, T.spread) * pm;
      game.bullets.push({ x: mx, y: my, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, dmg: T.dmg * game.m.dmgMult, owner: 'enemy', life: 0.9, color: '#ffb36b', knock: 0 });
    }
    part(mx, my, 1.33, 0, 0, 0, 0.06, '#ffd9a0', 0.3, 'glow');
    sfx(n > 1 ? 'shotgun' : 'enemy', e.x, e.y);
    if (T.burst) { if (e.burstLeft <= 0) e.burstLeft = T.burst; e.burstLeft--; e.cool = e.burstLeft > 0 ? T.rate : rand(0.9, 1.5); }
    else e.cool = T.rate * rand(0.85, 1.3);
  }

  function updateEnemy(e, dt) {
    if (e.dead) { e.deadT += dt; return; }
    const p = game.player, T = e.T;
    e.cool -= dt; e.hurtT -= dt; e.nadeT -= dt;
    if (e.stun > 0) {
      e.stun -= dt; e.vx *= Math.pow(0.02, dt); e.vy *= Math.pow(0.02, dt); moveEnt(e, e.vx * dt, e.vy * dt);
      if (Math.random() < 0.2) part(e.x + rand(-8, 8), e.y + rand(-8, 8), rand(0.5, 1.8), rand(-20, 20), rand(-20, 20), 0.3, 0.5, '#f2f5f8', 0.15, 'foam');
      return;
    }
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, toP = Math.atan2(dy, dx);
    let sees = false;
    if (!p.dead && d < T.range + (e.alert ? 220 : 0)) {
      const inCone = e.alert || d < 150 || Math.abs(angDiff(e.angle, toP)) < 1.1;
      if (inCone && los(e.x, e.y, p.x, p.y, 'v')) sees = true;
    }
    if (sees) {
      if (!e.alert) { e.alert = true; e.react = T.react * rand(0.8, 1.3); if (Math.random() < 0.55) floater(e.x, e.y, BARKS[randi(0, BARKS.length - 1)], '#f5b82e'); }
      e.lastSeen = 0; game.seen = true; raiseStars(T.boss ? 3 : 2);
    } else e.lastSeen += dt;
    if (e.alert && e.lastSeen > T.giveUp && game.stars < 3 && !T.boss) { e.alert = false; e.hx = e.x; e.hy = e.y; }
    let tx = 0, ty = 0, speed = T.speed, want = e.angle;
    if (e.alert) {
      e.react -= dt;
      const clear = sees && los(e.x, e.y, p.x, p.y, 'b');
      if (clear) {
        want = toP;
        if (d > e.pref + 40) { const f = flowDir(e); tx = f[0]; ty = f[1]; } else if (d < e.pref - 90) { tx = -dx / d; ty = -dy / d; }
        e.strafeT -= dt;
        if (e.strafeT <= 0) { e.strafeT = rand(0.8, 2.2); e.strafe = Math.random() < 0.3 ? 0 : (Math.random() < 0.5 ? -1 : 1); }
        tx += -dy / d * e.strafe * 0.8; ty += dx / d * e.strafe * 0.8; speed *= 0.7;
        if (e.react <= 0 && e.cool <= 0 && Math.abs(angDiff(e.angle, toP)) < 0.3) enemyFire(e, e.angle);
        if (T.boss && e.nadeT <= 0 && d > 160 && d < 420) {
          e.nadeT = rand(7, 10); const kk = 2.6, dd = d * 0.95;
          game.grenades.push({ x: e.x, y: e.y, vx: dx / d * dd * kk, vy: dy / d * dd * kk, k: kk, fuse: 1.7, t: 0, owner: 'enemy' });
          floater(e.x, e.y, 'Granada!', '#ef5350');
        }
      } else { const f = flowDir(e); tx = f[0]; ty = f[1]; if (tx || ty) want = Math.atan2(ty, tx); if (sees) want = toP; }
    } else {
      e.wanderT -= dt;
      if (e.wanderT <= 0) { e.wanderT = rand(2, 5); const a = rand(0, Math.PI * 2), r = rand(0, 90); e.wx = e.hx + Math.cos(a) * r; e.wy = e.hy + Math.sin(a) * r; e.idleMove = Math.random() < 0.6; }
      if (e.idleMove) { const ddx = e.wx - e.x, ddy = e.wy - e.y, dd = Math.hypot(ddx, ddy); if (dd > 10) { tx = ddx / dd; ty = ddy / dd; want = Math.atan2(ty, tx); } else e.idleMove = false; }
      speed *= 0.4;
    }
    const tl = Math.hypot(tx, ty); if (tl > 0) { tx /= tl; ty /= tl; }
    const kk = Math.min(1, dt * 8);
    e.vx = lerp(e.vx, tx * speed, kk); e.vy = lerp(e.vy, ty * speed, kk);
    for (const o of game.enemies) {
      if (o === e || o.dead) continue;
      const sx = e.x - o.x, sy = e.y - o.y, sd = Math.hypot(sx, sy), min = e.r + o.r + 4;
      if (sd < min && sd > 0.01) { e.x += sx / sd * (min - sd) * 0.5; e.y += sy / sd * (min - sd) * 0.5; }
    }
    { const sx = e.x - p.x, sy = e.y - p.y, sd = Math.hypot(sx, sy), min = e.r + p.r; if (sd < min && sd > 0.01) { e.x += sx / sd * (min - sd); e.y += sy / sd * (min - sd); } }
    moveEnt(e, e.vx * dt, e.vy * dt);
    const spd = Math.hypot(e.vx, e.vy); if (spd > 20) e.step += dt * spd / 34;
    const turn = e.alert ? 6.5 : 3;
    e.angle += clamp(angDiff(e.angle, want), -turn * dt, turn * dt);
  }

  function updateBullets(dt) {
    const p = game.player;
    for (const b of game.bullets) {
      const sp = Math.hypot(b.vx, b.vy), steps = Math.max(1, Math.ceil(sp * dt / 10)), sx = b.vx * dt / steps, sy = b.vy * dt / steps;
      for (let s = 0; s < steps && !b.dead; s++) {
        b.x += sx; b.y += sy;
        const tx = Math.floor(b.x / TILE), ty = Math.floor(b.y / TILE), ch = tileAt(tx, ty);
        if (TILES[ch].b) { hitTile(b, tx, ty, ch); b.dead = true; break; }
        if (b.owner === 'player') {
          for (const e of game.enemies) {
            if (e.dead) continue;
            if (dist(b.x, b.y, e.x, e.y) < e.r + 3) { const l = sp || 1; damageEnemy(e, b.dmg, b.vx / l, b.vy / l, b.knock); game.hits++; game.hitMark = 0.15; b.dead = true; sfx('hit'); break; }
          }
        } else if (!p.dead && dist(b.x, b.y, p.x, p.y) < p.r + 2) { damagePlayer(b.dmg); b.dead = true; }
      }
      b.life -= dt; if (b.life <= 0) b.dead = true;
    }
    game.bullets = game.bullets.filter((b) => !b.dead);
  }
  function hitTile(b, tx, ty, ch) {
    const l = Math.hypot(b.vx, b.vy) || 1, nx = -b.vx / l, ny = -b.vy / l;
    if (ch === 'G') { breakGlass(tx, ty); return; }
    if (ch === 'D' || ch === 'd' || ch === 'K') {
      for (let i = 0; i < 4; i++) part(b.x, b.y, 0.85, nx * rand(40, 140) + rand(-60, 60), ny * rand(40, 140) + rand(-60, 60), rand(1, 3), rand(1.2, 2), Math.random() < 0.8 ? '#f4f2ea' : '#b08a5e', rand(0.08, 0.14), 'paper');
    } else if (ch === 'S' || ch === 'T') burst(b.x, b.y, 1.3, 6, '#7fd3ff', 180, 0.35, 0.04, 'spark');
    else if (ch === 'X') burst(b.x, b.y, 0.8, 5, '#b08a5e', 140, 0.6, 0.06, 'spark');
    else {
      for (let i = 0; i < 4; i++) part(b.x, b.y, 1.3, nx * rand(60, 180) + rand(-70, 70), ny * rand(60, 180) + rand(-70, 70), rand(-1, 2), rand(0.15, 0.35), '#ffe0a0', 0.04, 'spark');
      part(b.x, b.y, 1.3, nx * 20, ny * 20, 0.2, 0.6, '#9a9a9a', 0.15, 'smoke');
    }
  }
  function explode(x, y, owner) {
    const R = WEAPONS.grenade.radius, D = WEAPONS.grenade.dmg * (owner === 'enemy' ? 0.45 : 1);
    sfx('boom', x, y); game.shake += 18;
    boomLight.position.set(x * S, 1.5, y * S); boomLight.intensity = 6;
    part(x, y, 0.8, 0, 0, 0, 0.25, '#fff2c0', 3.2, 'glow');
    for (let i = 0; i < 18; i++) part(x + rand(-20, 20), y + rand(-20, 20), rand(0.3, 1.5), rand(-180, 180), rand(-180, 180), rand(1, 5), rand(0.3, 0.6), i % 2 ? '#ffb347' : '#ff7a2a', rand(0.5, 1.1), 'glow');
    for (let i = 0; i < 14; i++) part(x + rand(-30, 30), y + rand(-30, 30), rand(0.3, 1.5), rand(-60, 60), rand(-60, 60), rand(0.8, 2), rand(1.2, 2.2), '#555555', rand(0.6, 1.2), 'smoke');
    burst(x, y, 0.5, 20, '#ffcc66', 420, 0.5, 0.05, 'spark', 2);
    decalScorch(x, y, R * 0.6);
    const tx0 = Math.floor((x - R) / TILE), tx1 = Math.floor((x + R) / TILE), ty0 = Math.floor((y - R) / TILE), ty1 = Math.floor((y + R) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (tileAt(tx, ty) === 'G' && dist(x, y, tx * TILE + 24, ty * TILE + 24) < R) breakGlass(tx, ty);
    for (const e of game.enemies) {
      if (e.dead) continue; const d = dist(x, y, e.x, e.y);
      if (d < R && los(x, y, e.x, e.y, 'v')) { const f = 1 - d / R, l = d || 1; damageEnemy(e, D * (0.35 + 0.65 * f), (e.x - x) / l, (e.y - y) / l, 400 * f); if (owner === 'player') game.hits++; }
    }
    const p = game.player, d = dist(x, y, p.x, p.y);
    if (d < R && los(x, y, p.x, p.y, 'v')) damagePlayer(D * 0.5 * (1 - d / R) + 6);
    alertEnemies(x, y, 900);
    if (owner === 'player') raiseStars(2);
  }
  function updateGrenades(dt) {
    for (const n of game.grenades) {
      n.t += dt; n.fuse -= dt;
      const f = Math.exp(-n.k * dt); n.vx *= f; n.vy *= f;
      const nx = n.x + n.vx * dt, ny = n.y + n.vy * dt;
      if (solidAt(Math.floor(nx / TILE), Math.floor(n.y / TILE))) n.vx *= -0.45; else n.x = nx;
      if (solidAt(Math.floor(n.x / TILE), Math.floor(ny / TILE))) n.vy *= -0.45; else n.y = ny;
      if (n.fuse <= 0) { n.dead = true; explode(n.x, n.y, n.owner); }
    }
    game.grenades = game.grenades.filter((n) => !n.dead);
  }
  const GRAV = { spark: 9, blood: 9, paper: 1.6, shard: 9, casing: 9, smoke: -0.4, foam: 0.6, glow: 0 };
  function updateParts(dt) {
    const dg = game.L.decal.getContext('2d');
    for (const q of game.parts) {
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.h += q.vh * dt; q.vh -= (GRAV[q.kind] || 0) * dt; q.rot += q.vr * dt;
      const fr = q.kind === 'paper' ? 2.4 : q.kind === 'smoke' ? 1.2 : q.kind === 'foam' ? 4 : q.kind === 'glow' ? 3 : 1.5;
      const f = Math.exp(-fr * dt); q.vx *= f; q.vy *= f;
      if (q.kind === 'smoke') q.size += dt * 0.6;
      if (q.kind === 'paper') { q.vx += Math.sin(q.rot) * 30 * dt; q.vh = Math.max(q.vh, -0.9); }
      if (q.h <= 0.02 && q.vh < 0) {
        q.h = 0.02; q.vh = 0; q.vx *= 0.3; q.vy *= 0.3;
        if (q.kind === 'paper' || q.kind === 'casing' || q.kind === 'shard' || q.kind === 'blood') {
          dg.fillStyle = q.kind === 'blood' ? 'rgba(120,12,16,0.7)' : q.color;
          const sz = q.size / S; dg.save(); dg.translate(q.x, q.y); dg.rotate(q.rot); dg.fillRect(-sz / 2, -sz / 3, sz, sz * 0.66); dg.restore();
          game.decalDirty = true; q.life = 0;
        }
      }
    }
    game.parts = game.parts.filter((q) => q.life > 0);
    if (game.parts.length > PMAX) game.parts.splice(0, game.parts.length - PMAX);
    for (const f of game.floaters) { f.t -= dt; f.h += 0.5 * dt; }
    game.floaters = game.floaters.filter((f) => f.t > 0);
    for (const t of game.toasts) t.t -= dt;
    game.toasts = game.toasts.filter((t) => t.t > 0);
  }
  function updatePickups(dt) {
    const p = game.player;
    for (const k of game.pickups) {
      k.bob += dt * 3;
      if (p.dead || dist(p.x, p.y, k.x, k.y) > 30) continue;
      if (k.t === 'med') { if (p.hp >= 100) continue; p.hp = Math.min(100, p.hp + 45); toast('+ Kit de primeiros socorros', '#7bd88f'); sfx('pickup'); }
      else if (k.t === 'armor') { if (p.armor >= 100) continue; p.armor = Math.min(100, p.armor + 50); toast('+ Colete', '#5aa9ff'); sfx('pickup'); }
      else if (k.t === 'ammo') {
        let got = false;
        for (const w of p.weapons) { if (!w.d.reserve) continue; if (w.reserve < w.d.reserve * 2) { w.reserve += Math.ceil(w.d.reserve * 0.4); got = true; } }
        if (!got) continue; toast('+ Munição', '#eef1f6'); sfx('pickup');
      } else if (k.t === 'cash') { game.cash += k.v; toast('+ ' + fmtMoney(k.v), '#7bd88f'); sfx('cash'); }
      else if (k.t === 'doc') { game.docs++; toast(`Pasta de contratos ${game.docs}/${game.docsTotal}`, '#f5b82e'); sfx('done'); raiseStars(1); }
      k.taken = true; levelGroup.remove(k.mesh);
    }
    game.pickups = game.pickups.filter((k) => !k.taken);
  }
  function updateStars(dt) {
    if (game.seen) game.calm = 0; else game.calm += dt;
    game.seen = false; game.starFlash = Math.max(0, game.starFlash - dt);
    const fl = game.stage === 'escape' ? game.m.maxStars : game.alarm ? (game.stage === 'exit' ? 4 : 3) : game.m.startStars;
    if (game.stars > fl && game.calm > 9) { game.stars--; game.calm = 4; }
    if (game.alarm && game.stage === 'exit' && game.stars < Math.min(4, game.m.maxStars)) game.stars = Math.min(4, game.m.maxStars);
    if (game.stars >= 3 && game.L.sp.reinf.length) {
      game.reinfT -= dt;
      const alive = game.enemies.filter((e) => !e.dead).length;
      if (game.reinfT <= 0 && alive < 14) {
        game.reinfT = Math.max(5, 15 - game.stars * 2);
        const p = game.player;
        const pts = game.L.sp.reinf.filter(([x, y]) => dist(x, y, p.x, p.y) > 380).sort(() => Math.random() - 0.5);
        if (pts.length) {
          const [x, y] = pts[0];
          const k = game.m.type === 'boss' && Math.random() < 0.25 ? 'heavy' : game.m.type === 'hack' && Math.random() < 0.2 ? 'heavy' : game.m.enemy;
          const e = makeEnemy(x, y, k, true); e.react = 0.6; game.enemies.push(e);
        }
      }
    }
  }
  function updateMission(dt) {
    const m = game.m, p = game.player;
    if (game.state !== 'play') return;
    if (game.stage === 'collect' && game.docs >= game.docsTotal) { game.stage = 'exit'; say('Ricardo', 'Pastas recuperadas. Agora, para o elevador.', 3); sfx('done'); }
    if (game.stage === 'hack' && game.terminals.every((t) => t.done)) { game.stage = 'exit'; raiseStars(4); say('Ricardo', 'Backup copiado. Hora de sair pelo saguão.', 3); }
    if (m.timeLimit) { game.timeLeft -= dt; if (game.timeLeft <= 0) { game.timeLeft = 0; endMission(false, 'O tempo acabou. A polícia cercou o prédio antes da fuga.'); return; } }
    if ((game.stage === 'exit' || game.stage === 'escape') && tileAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE)) === m.exitChar) endMission(true);
  }
  function endMission(win, reason) {
    if (game.state !== 'play') return;
    game.state = win ? 'won' : 'lost'; game.endT = 0; game.reason = reason || '';
    if (document.exitPointerLock && locked) document.exitPointerLock();
    if (win) {
      sfx('win');
      const total = game.m.reward + game.cash, prev = save.done[game.mi];
      save.done[game.mi] = { best: prev ? Math.min(prev.best, game.time) : game.time };
      save.bank = (save.bank || 0) + total; persist(); game.total = total;
    } else sfx('lose');
  }

  /* ---------------- Sincronização com a cena ---------------- */
  const dummy = new THREE.Object3D();
  function syncChar(e, isPlayer, dt) {
    const c = e.mesh, g = c.g;
    g.position.set(e.x * S, 0, e.y * S);
    if (e.dead) {
      e.fall = Math.min(1, (e.fall || 0) + dt * 3);
      g.rotation.set(0, -e.angle, 0);
      c.inner.rotation.z = e.fall * Math.PI / 2; c.inner.position.y = 0.05 + (1 - e.fall) * 0.0;
      c.inner.position.x = -e.fall * 0.25;
      c.foam.visible = false;
      if (e.deadT > 20 && !isPlayer) g.visible = false;
      return;
    }
    g.rotation.y = -e.angle;
    const sw = Math.sin(e.step || 0) * 0.6 * clamp(Math.hypot(e.vx, e.vy) / 150, 0, 1);
    c.legs[0].rotation.z = sw; c.legs[1].rotation.z = -sw;
    c.inner.position.y = Math.abs(Math.cos(e.step || 0)) * 0.03;
    if (isPlayer && e.swing > 0) { const s = (e.swing / 0.25 - 0.5) * 2.4; c.gunG.rotation.y = s; c.arms[0].rotation.y = -0.35 + s * 0.5; c.arms[1].rotation.y = 0.35 + s * 0.5; }
    else { c.gunG.rotation.y = 0; c.arms[0].rotation.y = -0.35; c.arms[1].rotation.y = 0.35; }
    const fl = e.hurtT > 0 || (isPlayer && e.lastHurt < 0.08);
    for (const m of c.mats) m.emissive.setRGB(fl ? 0.6 : 0, fl ? 0.6 : 0, fl ? 0.6 : 0);
    c.foam.visible = e.stun > 0;
  }
  function syncScene(dt, t) {
    const g = game, L = g.L;
    syncChar(g.player, true, dt);
    if (!g.player.dead) setGun(g.player.mesh, gunShape(curWeapon().k));
    g.player.mesh.g.visible = true;
    for (const e of g.enemies) syncChar(e, false, dt);
    for (const k of g.pickups) { k.mesh.position.y = 0.45 + Math.sin(k.bob) * 0.08; k.mesh.rotation.y += dt * 1.5; }
    // tracers
    const tr = pools.tracer; let n = 0;
    for (const b of g.bullets) {
      if (n >= TMAX) break;
      const a = Math.atan2(b.vy, b.vx);
      dummy.position.set(b.x * S - Math.cos(a) * 0.5, b.owner === 'player' ? 1.33 : 1.35, b.y * S - Math.sin(a) * 0.5);
      dummy.rotation.set(0, -a, 0); dummy.scale.set(1.0, 0.025, 0.025); dummy.updateMatrix();
      tr.setMatrixAt(n, dummy.matrix); _c.set(b.color); tr.setColorAt(n, _c); n++;
    }
    tr.count = n; tr.instanceMatrix.needsUpdate = true; if (tr.instanceColor) tr.instanceColor.needsUpdate = true;
    // partículas
    const ps = pools.solid, pf = pools.soft, pg = pools.glow; let ns = 0, nf = 0, ng = 0;
    for (const q of g.parts) {
      const a = clamp(q.life / q.max, 0, 1);
      dummy.position.set(q.x * S, q.h, q.y * S);
      if (q.kind === 'glow') {
        if (ng >= 120) continue;
        dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(q.size * (0.4 + a * 0.6)); dummy.updateMatrix();
        pg.setMatrixAt(ng, dummy.matrix); _c.set(q.color).multiplyScalar(a); pg.setColorAt(ng, _c); ng++;
      } else if (q.kind === 'smoke' || q.kind === 'foam') {
        if (nf >= 300) continue;
        dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(q.size * (q.kind === 'foam' ? 1 : 0.6 + a * 0.4)); dummy.updateMatrix();
        pf.setMatrixAt(nf, dummy.matrix); _c.set(q.color); pf.setColorAt(nf, _c); nf++;
      } else {
        if (ns >= PMAX) continue;
        dummy.rotation.set(q.rot, q.rot * 0.7, 0);
        if (q.kind === 'paper') dummy.scale.set(q.size, 0.005, q.size * 0.75); else dummy.scale.setScalar(q.size);
        dummy.updateMatrix(); ps.setMatrixAt(ns, dummy.matrix); _c.set(q.color); ps.setColorAt(ns, _c); ns++;
      }
    }
    for (const [im, c] of [[ps, ns], [pf, nf], [pg, ng]]) { im.count = c; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    // granadas
    const gn = pools.nade; let nn = 0;
    for (const q of g.grenades) {
      const hgt = 0.15 + Math.max(0, Math.sin(Math.min(1, q.t / 0.7) * Math.PI)) * 1.4 + (q.t < 0.7 ? (1 - q.t / 0.7) * 1.1 : 0);
      dummy.position.set(q.x * S, hgt, q.y * S); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(0.09); dummy.updateMatrix();
      gn.setMatrixAt(nn++, dummy.matrix);
    }
    gn.count = nn; gn.instanceMatrix.needsUpdate = true;
    // terminais
    for (const tm of g.terminals) tm.screenMat.color.set(tm.done ? '#38d27a' : Math.sin(t * 6) > 0 ? '#ef5350' : '#7a2826');
    // marcadores
    const tg = objectiveTargets();
    const beamOn = g.stage === 'exit' || g.stage === 'escape';
    L.beam.visible = beamOn && tg.length > 0;
    if (L.beam.visible) { L.beam.position.set(tg[0][0] * S, 1.2, tg[0][1] * S); L.beam.material.opacity = 0.25 + Math.sin(t * 3) * 0.1; markLight.position.set(tg[0][0] * S, 1.5, tg[0][1] * S); markLight.intensity = 1.2; } else markLight.intensity = 0;
    L.arrows.forEach((a, i) => {
      const o = !beamOn && tg[i];
      a.visible = !!o;
      if (o) { const isBoss = g.stage === 'boss'; a.position.set(o[0] * S, (isBoss ? 2.9 : 1.6) + Math.sin(t * 4 + i) * 0.12, o[1] * S); a.rotation.y = t * 2; a.material = basic(isBoss ? '#ef5350' : '#f5b82e'); }
    });
    L.serverMat.emissiveIntensity = 0.75 + Math.sin(t * 9) * 0.25;
    if (g.decalDirty) { L.decalTex.needsUpdate = true; g.decalDirty = false; }
    muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 30);
    boomLight.intensity = Math.max(0, boomLight.intensity - dt * 9);
    for (const s of skyline) s.m.visible = Math.sin(t * 2.2 + s.ph) > 0;
  }

  function camBlocked(x, y) { const c = tileAt(Math.floor(x / TILE), Math.floor(y / TILE)); return c === '#' || c === 'B' || c === 'S' || c === 'W' || c === 'O'; }
  function updateCamera(dt) {
    const g = game, p = g.player;
    const aiming = mouse.right && !p.dead && g.state === 'play';
    g.aimBlend = lerp(g.aimBlend, aiming ? 1 : 0, 1 - Math.exp(-dt * 10));
    pitch = clamp(pitch, -0.3, 1.15);
    const fov = lerp(isTouch && H > W ? 72 : 62, 42, g.aimBlend);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    const dist0 = lerp(5.0, 2.5, g.aimBlend) + (p.dead ? 3 : 0);
    let side = lerp(0.62, 0.78, g.aimBlend);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    if (camBlocked(p.x + (-sy) * side / S, p.y + cy * side / S)) side = 0;
    const pivX = p.x * S + (-sy) * side, pivZ = p.y * S + cy * side, pivY = 1.85;
    let d = dist0;
    for (let t = 0.2; t <= dist0; t += 0.1) { if (camBlocked((pivX - cy * cp * t) / S, (pivZ - sy * cp * t) / S)) { d = Math.max(0.35, t - 0.3); break; } }
    const sh = g.shake * 0.012;
    camera.position.set(pivX - cy * cp * d + rand(-sh, sh), pivY + sp * d + rand(-sh, sh), pivZ - sy * cp * d + rand(-sh, sh));
    camera.lookAt(pivX + cy * cp * 10, pivY - sp * 10, pivZ + sy * cp * 10);
    g.shake = Math.min(26, g.shake) * Math.exp(-dt * 10);
    // sombra segue o jogador
    sun.position.set(p.x * S - 14, 30, p.y * S - 8); sun.target.position.set(p.x * S, 0, p.y * S); sun.target.updateMatrixWorld();
    // esconde o jogador quando a câmera encosta
    p.mesh.g.visible = d > 0.9;
  }

  /* ---------------- Loop ---------------- */
  let last = performance.now(), T = 0, menuAng = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
    try {
      if (mode === 'play' && game) {
        if (game.state === 'play') step(dt);
        else {
          game.endT += dt; const sdt = dt * 0.3;
          updateParts(sdt); updateBullets(sdt); updateGrenades(sdt);
          if (game.player.dead) { game.player.deadT = (game.player.deadT || 0) + dt; yaw += dt * 0.3; }
          if (game.endT > 1.6 && $('#result').hidden) showResult();
        }
        syncScene(dt, T); updateCamera(dt);
        renderer.render(scene, camera);
        drawHUD();
      } else if (mode === 'pause' && game) {
        renderer.render(scene, camera); drawHUD();
      } else if (game) {
        menuAng += dt * 0.08;
        const L = game.L, cx = L.w, cz = L.h, R = Math.max(L.w, L.h) * 1.15;
        camera.fov = 55; camera.updateProjectionMatrix();
        camera.position.set(cx + Math.cos(menuAng) * R, 26, cz + Math.sin(menuAng) * R);
        camera.lookAt(cx, 0, cz);
        sun.position.set(cx - 14, 40, cz - 8); sun.target.position.set(cx, 0, cz); sun.target.updateMatrixWorld();
        syncScene(dt, T);
        renderer.render(scene, camera);
        hctx.setTransform(DPR, 0, 0, DPR, 0, 0); hctx.clearRect(0, 0, W, H);
      }
    } catch (err) { console.error(err); }
    requestAnimationFrame(frame);
  }
  function step(dt) {
    game.time += dt; game.titleT -= dt;
    updatePlayer(dt);
    game.flowT -= dt; if (game.flowT <= 0) { game.flowT = 0.25; computeFlow(); }
    for (const e of game.enemies) updateEnemy(e, dt);
    updateBullets(dt); updateGrenades(dt); updatePickups(dt); updateParts(dt); updateStars(dt); updateMission(dt);
    if (!game.sub && game.subs.length) { game.sub = game.subs.shift(); game.sub.t = game.sub.dur; }
    if (game.sub) { game.sub.t -= dt; if (game.sub.t <= 0) game.sub = null; }
    game.hurtFlash = Math.max(0, game.hurtFlash - dt * 1.5);
    game.hitMark = Math.max(0, game.hitMark - dt);
    if (game.enemies.length > 40) game.enemies = game.enemies.filter((e) => { const keep = !e.dead || e.deadT < 20; if (!keep) levelGroup.remove(e.mesh.g); return keep; });
  }

  /* ---------------- HUD ---------------- */
  const v3 = new THREE.Vector3();
  function project(x, y, h) { v3.set(x * S, h, y * S).project(camera); return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H, behind: v3.z > 1 }; }
  function hudText(t, x, y, size, color, font, align, weight) {
    hctx.font = `${weight || ''} ${size}px ${font || FONT_H}`; hctx.textAlign = align || 'left';
    hctx.fillStyle = 'rgba(0,0,0,0.75)'; hctx.fillText(t, x + 2, y + 2); hctx.fillStyle = color; hctx.fillText(t, x, y);
  }
  function star(cx, cy, r, fill, stroke) {
    hctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; hctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    hctx.closePath(); if (fill) { hctx.fillStyle = fill; hctx.fill(); } if (stroke) { hctx.strokeStyle = stroke; hctx.lineWidth = 1.5; hctx.stroke(); }
  }
  function objectiveTargets() {
    const g = game;
    if (g.stage === 'collect') return g.pickups.filter((k) => k.t === 'doc').map((k) => [k.x, k.y]);
    if (g.stage === 'hack') return g.terminals.filter((t) => !t.done).map((t) => [t.x, t.y]);
    if (g.stage === 'boss') return g.boss && !g.boss.dead ? [[g.boss.x, g.boss.y]] : [];
    if (g.stage === 'exit') { const ex = g.L.sp.exits; if (!ex.length) return []; let sx = 0, sy = 0; for (const [x, y] of ex) { sx += x; sy += y; } return [[sx / ex.length, sy / ex.length]]; }
    if (g.stage === 'escape') return g.L.heli ? [g.L.heli] : [];
    return [];
  }
  function objectiveText() {
    const g = game;
    switch (g.stage) {
      case 'collect': return `Recupere as pastas de contratos  ${g.docs}/${g.docsTotal}`;
      case 'hack': return `Invada os terminais  ${g.terminals.filter((t) => t.done).length}/${g.terminals.length}`;
      case 'boss': return 'Elimine Otávio Vasconcelos';
      case 'escape': return 'Chegue ao heliponto no terraço';
      case 'exit': return 'Saia pelo elevador do saguão';
    }
    return '';
  }
  let touchLayout = {};
  function layoutTouch() {
    touchLayout = {
      fire: { x: W - 78, y: H - 120, r: 44, label: 'ATIRAR' },
      aim: { x: W - 170, y: H - 70, r: 26, label: 'MIRA' },
      swap: { x: W - 60, y: H - 230, r: 28, label: 'ARMA' },
      reload: { x: W - 150, y: H - 185, r: 26, label: 'REC' },
      use: { x: W - 175, y: H - 255, r: 28, label: 'E' },
      pause: { x: W / 2, y: 30, r: 22, label: 'II' },
    };
  }

  function drawHUD() {
    const g = game, p = g.player, w = curWeapon(), c = hctx;
    c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
    const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
    if (g.hurtFlash > 0 || p.hp < 30) {
      const a = Math.max(g.hurtFlash * 0.6, p.hp < 30 ? 0.25 + Math.sin(T * 5) * 0.1 : 0);
      const rg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.7);
      rg.addColorStop(0, 'rgba(160,0,0,0)'); rg.addColorStop(1, `rgba(160,0,0,${a})`); c.fillStyle = rg; c.fillRect(0, 0, W, H);
    }
    // textos e barras no mundo
    for (const e of g.enemies) {
      if (e.dead) continue;
      const d = dist(e.x, e.y, p.x, p.y); if (d > 900) continue;
      const s = project(e.x, e.y, e.T.big ? 2.4 : 2.1); if (s.behind) continue;
      if (!e.T.boss && e.hp < e.maxHp) { c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(s.x - 18, s.y, 36, 5); c.fillStyle = '#ef5350'; c.fillRect(s.x - 18, s.y, 36 * e.hp / e.maxHp, 5); }
      if (e.alert && e.lastSeen < 0.5 && e.react > 0) hudText('!', s.x, s.y - 6, 24, '#f5b82e', FONT_D, 'center');
    }
    for (const f of g.floaters) { const s = project(f.x, f.y, f.h); if (s.behind) continue; c.globalAlpha = clamp(f.t, 0, 1); hudText(f.text, s.x, s.y, 17, f.color, FONT_H, 'center', 600); }
    c.globalAlpha = 1;

    const compact = W < 700, M = 16;
    let y = M + 26; const rx = W - M;
    hudText(w.d.short, rx, y, compact ? 20 : 24, '#eef1f6', FONT_D, 'right');
    y += compact ? 28 : 34;
    let ammo = '∞';
    if (w.d.kind === 'throw') ammo = String(w.mag + w.reserve); else if (w.d.kind !== 'melee') ammo = `${w.mag}  |  ${w.reserve}`;
    hudText(p.reload > 0 ? 'RECARREGANDO' : ammo, rx, y, compact ? 22 : 28, p.reload > 0 ? '#f5b82e' : (w.d.kind !== 'melee' && w.mag === 0 ? '#ef5350' : '#eef1f6'), FONT_H, 'right', 700);
    y += compact ? 32 : 40;
    hudText(fmtMoney(g.cash), rx, y, compact ? 26 : 34, '#7bd88f', FONT_D, 'right');
    y += 24;
    for (let i = 0; i < 5; i++) {
      const cx = rx - 12 - i * 26, filled = 5 - i <= g.stars, flash = g.starFlash > 0 && Math.sin(T * 18) > 0;
      if (filled) star(cx, y, 10, flash ? '#ffffff' : '#f5f5f5', 'rgba(0,0,0,0.7)'); else star(cx, y, 10, 'rgba(0,0,0,0.35)', 'rgba(255,255,255,0.35)');
    }
    y += 26;
    for (const t of g.toasts) { c.globalAlpha = clamp(t.t, 0, 1); hudText(t.text, rx, y, 18, t.color, FONT_H, 'right', 600); y += 22; }
    c.globalAlpha = 1;

    // minimapa circular-retangular que gira com a câmera
    const mmW = isTouch ? 140 : compact ? 160 : 230, mmH = isTouch ? 110 : Math.round(mmW * 0.64);
    const mmX = M, mmY = isTouch ? M : H - M - mmH - 18;
    c.save();
    c.fillStyle = 'rgba(8,12,20,0.88)'; c.fillRect(mmX - 3, mmY - 3, mmW + 6, mmH + 6 + 16);
    c.beginPath(); c.rect(mmX, mmY, mmW, mmH); c.clip();
    c.fillStyle = '#0b1220'; c.fillRect(mmX, mmY, mmW, mmH);
    const sc = isTouch ? 4.2 : 5.5, ccx = mmX + mmW / 2, ccy = mmY + mmH * 0.62;
    c.translate(ccx, ccy); c.rotate(-Math.PI / 2 - yaw); c.translate(-p.x / TILE * sc, -p.y / TILE * sc);
    c.imageSmoothingEnabled = false; c.drawImage(g.L.mini, 0, 0, g.L.w * sc, g.L.h * sc); c.imageSmoothingEnabled = true;
    const toM = (x, yy) => [x / TILE * sc, yy / TILE * sc];
    for (const e of g.enemies) {
      if (e.dead) continue; const [ex, ey] = toM(e.x, e.y);
      if (e.T.boss) { c.fillStyle = '#ef5350'; c.beginPath(); c.arc(ex, ey, 4.5, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke(); }
      else if (e.alert || dist(e.x, e.y, p.x, p.y) < 420) { c.fillStyle = e.alert ? '#ef5350' : 'rgba(239,83,80,0.55)'; c.beginPath(); c.arc(ex, ey, 2.8, 0, Math.PI * 2); c.fill(); }
    }
    for (const k of g.pickups) { if (k.t === 'cash') continue; const [kx, ky] = toM(k.x, k.y); c.fillStyle = k.t === 'doc' ? '#f5b82e' : k.t === 'med' ? '#7bd88f' : k.t === 'armor' ? '#5aa9ff' : '#cfd6e0'; c.fillRect(kx - 2, ky - 2, 4, 4); }
    for (const [ox, oy] of objectiveTargets()) { const [kx, ky] = toM(ox, oy); c.fillStyle = '#f5b82e'; c.beginPath(); c.arc(kx, ky, 4 + Math.sin(T * 6) * 1.2, 0, Math.PI * 2); c.fill(); }
    c.restore();
    // seta do jogador (sempre para cima, relativa à câmera)
    c.save(); c.translate(ccx, ccy); c.rotate(angDiff(yaw, p.angle) - Math.PI / 2);
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, -5); c.lineTo(-2, 0); c.lineTo(-5, 5); c.closePath(); c.fill(); c.restore();
    // objetivos fora do minimapa: indicador na borda
    const by2 = mmY + mmH + 5, bw = (mmW - 4) / 2;
    c.fillStyle = '#1d3a24'; c.fillRect(mmX, by2, bw, 8); c.fillStyle = p.hp < 30 ? '#ef5350' : '#5cc26f'; c.fillRect(mmX, by2, bw * p.hp / 100, 8);
    c.fillStyle = '#1b2a40'; c.fillRect(mmX + bw + 4, by2, bw, 8); c.fillStyle = '#5aa9ff'; c.fillRect(mmX + bw + 4, by2, bw * p.armor / 100, 8);

    // objetivo
    const oText = objectiveText();
    c.font = `600 ${compact ? 16 : 19}px ${FONT_H}`;
    const objX = M, objY = isTouch ? mmY + mmH + 34 : M;
    const tw = Math.min(c.measureText(oText).width, W - 2 * M - (isTouch ? 0 : 220));
    const oh = g.m.timeLimit ? 66 : 46;
    c.fillStyle = 'rgba(8,12,20,0.78)'; c.fillRect(objX, objY, tw + 24, oh); c.fillStyle = '#f5b82e'; c.fillRect(objX, objY, 3, oh);
    hudText('OBJETIVO', objX + 12, objY + 16, 12, '#9aa6bb', FONT_H, 'left', 700);
    hudText(oText, objX + 12, objY + 37, compact ? 16 : 19, '#eef1f6', FONT_H, 'left', 600);
    if (g.m.timeLimit) hudText('POLÍCIA EM ' + fmtTime(g.timeLeft), objX + 12, objY + 58, 16, g.timeLeft < 60 ? '#ef5350' : '#f5b82e', FONT_H, 'left', 700);

    if (g.boss && !g.boss.dead && g.boss.alert) {
      const bw2 = Math.min(420, W - 2 * M - 40), bx = (W - bw2) / 2, byy = isTouch ? 64 : M + 8;
      hudText(g.boss.T.name.toUpperCase(), W / 2, byy + 2, 16, '#eef1f6', FONT_H, 'center', 700);
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(bx, byy + 8, bw2, 9); c.fillStyle = '#ef5350'; c.fillRect(bx, byy + 8, bw2 * g.boss.hp / g.boss.maxHp, 9);
    }
    // indicador do objetivo na tela
    const tg = objectiveTargets();
    if (tg.length) {
      let best = null, bd = 1e9; for (const t of tg) { const d = dist(p.x, p.y, t[0], t[1]); if (d < bd) { bd = d; best = t; } }
      const s = project(best[0], best[1], 1.2);
      const off = s.behind || s.x < 30 || s.y < 30 || s.x > W - 30 || s.y > H - 30;
      if (off) {
        let a = Math.atan2(s.y - H / 2, s.x - W / 2); if (s.behind) a += Math.PI;
        const ex = clamp(W / 2 + Math.cos(a) * W, 40, W - 40), ey = clamp(H / 2 + Math.sin(a) * H, 90, H - 90);
        c.save(); c.translate(ex, ey); c.rotate(a); c.fillStyle = '#f5b82e'; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(16, 0); c.lineTo(-8, -11); c.lineTo(-3, 0); c.lineTo(-8, 11); c.closePath(); c.fill(); c.stroke(); c.restore();
      } else hudText(Math.round(bd * S) + ' m', s.x, s.y - 30, 15, '#f5b82e', FONT_H, 'center', 700);
    }
    if (!isTouch) {
      const sw = 128, sh = 34, gap = 6; let sx2 = W - M - (sw * 3 + gap * 2); const sy2 = H - M - sh;
      p.weapons.forEach((ww, i) => {
        const act = i === p.cur;
        c.fillStyle = act ? 'rgba(245,184,46,0.92)' : 'rgba(8,12,20,0.78)'; c.fillRect(sx2, sy2, sw, sh);
        c.font = `700 15px ${FONT_H}`; c.textAlign = 'left'; c.fillStyle = act ? '#11151d' : '#9aa6bb'; c.fillText(String(i + 1), sx2 + 9, sy2 + 22);
        c.fillStyle = act ? '#11151d' : '#eef1f6'; c.font = `600 15px ${FONT_H}`;
        let nm = ww.d.short; while (c.measureText(nm).width > sw - 34 && nm.length > 3) nm = nm.slice(0, -1);
        c.fillText(nm, sx2 + 24, sy2 + 22); sx2 += sw + gap;
      });
    }
    if (g.hacking) {
      const t = g.hacking, txt = isTouch ? 'Segure E para invadir o terminal' : 'Segure [E] para invadir o terminal', yy = H * 0.68;
      hudText(txt, W / 2, yy, 20, '#eef1f6', FONT_H, 'center', 700);
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(W / 2 - 120, yy + 10, 240, 8); c.fillStyle = '#f5b82e'; c.fillRect(W / 2 - 120, yy + 10, 240 * t.p, 8);
    }
    if (g.sub) {
      const yy = H - (isTouch ? 300 : 90);
      c.font = `600 ${compact ? 17 : 21}px ${FONT_H}`;
      const who = g.sub.who + ': ', full = who + g.sub.text, maxw = W - 40, lines = [];
      if (c.measureText(full).width > maxw) { let cur = ''; for (const wd of full.split(' ')) { const tst = cur ? cur + ' ' + wd : wd; if (c.measureText(tst).width > maxw) { lines.push(cur); cur = wd; } else cur = tst; } lines.push(cur); } else lines.push(full);
      c.globalAlpha = clamp(g.sub.t * 2, 0, 1);
      lines.forEach((ln, i) => {
        const ly = yy + i * 24;
        if (i === 0) {
          const lw = c.measureText(ln).width, ww2 = c.measureText(who).width, x0 = W / 2 - lw / 2;
          c.textAlign = 'left'; c.fillStyle = 'rgba(0,0,0,0.85)'; c.fillText(ln, x0 + 2, ly + 2);
          c.fillStyle = g.sub.who === 'Ricardo' ? '#5aa9ff' : g.sub.who === 'Vasconcelos' ? '#ef5350' : '#f5b82e'; c.fillText(who, x0, ly);
          c.fillStyle = '#eef1f6'; c.fillText(ln.slice(who.length), x0 + ww2, ly);
        } else { c.textAlign = 'center'; c.fillStyle = 'rgba(0,0,0,0.85)'; c.fillText(ln, W / 2 + 2, ly + 2); c.fillStyle = '#eef1f6'; c.fillText(ln, W / 2, ly); }
      });
      c.globalAlpha = 1;
    }
    if (g.titleT > 0) {
      c.globalAlpha = clamp(g.titleT, 0, 1) * clamp((4.5 - g.titleT) * 2, 0, 1);
      hudText(g.m.name.toUpperCase(), W / 2, H * 0.3, compact ? 44 : 72, '#f5b82e', FONT_D, 'center');
      hudText(`${g.m.code}  ·  ${g.m.floor.toUpperCase()}`, W / 2, H * 0.3 + 34, compact ? 16 : 20, '#eef1f6', FONT_H, 'center', 700);
      c.globalAlpha = 1;
    }
    // mira no centro
    if (!p.dead && g.state === 'play') {
      const r = 6 + p.bloom * 14 + (Math.hypot(p.vx, p.vy) > 30 ? 5 : 0) - g.aimBlend * 3;
      const cx = W / 2, cy = H / 2, onEnemy = g.aim && g.aim[3];
      c.strokeStyle = onEnemy ? 'rgba(239,83,80,0.95)' : 'rgba(255,255,255,0.9)'; c.lineWidth = 2;
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; c.beginPath(); c.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); c.lineTo(cx + Math.cos(a) * (r + 6), cy + Math.sin(a) * (r + 6)); c.stroke(); }
      c.fillStyle = c.strokeStyle; c.fillRect(cx - 1, cy - 1, 2, 2);
      if (g.hitMark > 0) {
        c.strokeStyle = '#ffffff'; c.lineWidth = 2.5;
        for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { c.beginPath(); c.moveTo(cx + sx * 7, cy + sy * 7); c.lineTo(cx + sx * 14, cy + sy * 14); c.stroke(); }
      }
    }
    if (isTouch) drawTouch();
    if (g.state !== 'play') {
      const a = clamp(g.endT / 1.2, 0, 1);
      c.fillStyle = `rgba(0,0,0,${a * 0.45})`; c.fillRect(0, 0, W, H);
      c.globalAlpha = a; c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, H * 0.42 - 50, W, 90);
      hudText(g.state === 'won' ? 'MISSÃO CUMPRIDA' : 'DEMITIDO', W / 2, H * 0.42 + 18, compact ? 48 : 78, g.state === 'won' ? '#f5b82e' : '#ef5350', FONT_D, 'center');
      c.globalAlpha = 1;
    }
    $('#lockHint').hidden = !(mode === 'play' && !isTouch && !locked && !lockFailed && g.state === 'play');
  }
  function drawTouch() {
    const c = hctx, s = touch.move;
    if (s.id !== null) {
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 2;
      c.beginPath(); c.arc(s.ox, s.oy, 56, 0, Math.PI * 2); c.fill(); c.stroke();
      const v = stickVec(s); c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(s.ox + v[0] * 56, s.oy + v[1] * 56, 24, 0, Math.PI * 2); c.fill();
    } else hudText('MOVER', 70, H - 70, 14, 'rgba(255,255,255,0.35)', FONT_H, 'center', 700);
    if (touch.look.id === null) hudText('ARRASTE PARA OLHAR', W * 0.62, H * 0.5, 13, 'rgba(255,255,255,0.25)', FONT_H, 'center', 700);
    for (const [k, b] of Object.entries(touchLayout)) {
      const on = touch.btn[k] !== undefined || (k === 'aim' && mouse.right), hl = k === 'use' && game.hacking;
      c.fillStyle = on ? 'rgba(245,184,46,0.85)' : hl ? 'rgba(245,184,46,0.55)' : k === 'fire' ? 'rgba(239,83,80,0.45)' : 'rgba(8,12,20,0.6)';
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2;
      c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill(); c.stroke();
      c.font = `700 ${b.label.length > 2 ? 13 : 18}px ${FONT_H}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = on ? '#11151d' : '#eef1f6'; c.fillText(b.label, b.x, b.y + 1); c.textBaseline = 'alphabetic';
    }
  }

  /* ---------------- Eventos ---------------- */
  addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && mode === 'play') e.preventDefault();
    keys[e.code] = true;
    if (mode === 'play' && game && game.state === 'play') {
      if (e.code === 'Digit1') switchWeapon(0); if (e.code === 'Digit2') switchWeapon(1); if (e.code === 'Digit3') switchWeapon(2);
      if (e.code === 'KeyQ') switchWeapon((game.player.cur + 2) % 3);
      if (e.code === 'KeyR') startReload();
      if (e.code === 'KeyP' || (e.code === 'Escape' && !locked)) pauseGame();
    } else if (mode === 'pause' && e.code === 'KeyP') resumeGame();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = mouse.right = false; if (mode === 'play' && game && game.state === 'play') pauseGame(); });
  function requestLock() {
    if (isTouch || !glCanvas.requestPointerLock) { lockFailed = true; return; }
    try {
      const r = glCanvas.requestPointerLock();
      if (r && r.catch) r.catch(() => { lockFailed = true; });
    } catch (e) { lockFailed = true; }
  }
  document.addEventListener('pointerlockchange', () => {
    const was = locked; locked = document.pointerLockElement === glCanvas;
    if (was && !locked && mode === 'play' && game && game.state === 'play') pauseGame();
  });
  document.addEventListener('pointerlockerror', () => { lockFailed = true; });
  glCanvas.addEventListener('mousedown', (e) => {
    initAudio();
    if (mode !== 'play') return;
    if (!locked && !lockFailed) { requestLock(); return; }
    if (e.button === 0) mouse.down = true; if (e.button === 2) mouse.right = true;
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; if (e.button === 2) mouse.right = false; });
  addEventListener('mousemove', (e) => {
    if (mode !== 'play' || !game || game.state !== 'play') return;
    const look = locked || (lockFailed && (mouse.down || mouse.right || e.buttons));
    if (!look) return;
    const k = SENS * (mouse.right ? 0.6 : 1);
    yaw += e.movementX * k; pitch += e.movementY * k;
  });
  glCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
  glCanvas.addEventListener('wheel', (e) => { if (mode !== 'play' || !game) return; e.preventDefault(); const n = game.player.weapons.length; switchWeapon((game.player.cur + (e.deltaY > 0 ? 1 : n - 1)) % n); }, { passive: false });

  function hitButton(x, y) { for (const [k, b] of Object.entries(touchLayout)) if (dist(x, y, b.x, b.y) < b.r + 8) return k; return null; }
  glCanvas.addEventListener('touchstart', (e) => {
    if (mode !== 'play') return;
    e.preventDefault(); initAudio();
    for (const t of e.changedTouches) {
      const b = hitButton(t.clientX, t.clientY);
      if (b) {
        touch.btn[b] = t.identifier;
        if (b === 'swap' && game) switchWeapon((game.player.cur + 1) % game.player.weapons.length);
        if (b === 'reload' && game) startReload();
        if (b === 'use') touch.use = true;
        if (b === 'fire') { touch.fire = true; touch.fireId = t.identifier; touch.fx = t.clientX; touch.fy = t.clientY; }
        if (b === 'aim') mouse.right = !mouse.right;
        if (b === 'pause') pauseGame();
        continue;
      }
      if (t.clientX < W * 0.42 && touch.move.id === null) { const s = touch.move; s.id = t.identifier; s.ox = s.x = t.clientX; s.oy = s.y = t.clientY; }
      else if (touch.look.id === null) { touch.look.id = t.identifier; touch.look.x = t.clientX; touch.look.y = t.clientY; }
    }
  }, { passive: false });
  glCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (touch.move.id === t.identifier) { touch.move.x = t.clientX; touch.move.y = t.clientY; }
      const lk = touch.look.id === t.identifier ? touch.look : touch.fire && touch.fireId === t.identifier ? null : null;
      if (lk) { yaw += (t.clientX - lk.x) * 0.0065; pitch += (t.clientY - lk.y) * 0.005; lk.x = t.clientX; lk.y = t.clientY; }
      if (touch.fire && touch.fireId === t.identifier) { yaw += (t.clientX - touch.fx) * 0.005; pitch += (t.clientY - touch.fy) * 0.004; touch.fx = t.clientX; touch.fy = t.clientY; }
    }
  }, { passive: false });
  const endTouch = (e) => {
    for (const t of e.changedTouches) {
      if (touch.move.id === t.identifier) touch.move.id = null;
      if (touch.look.id === t.identifier) touch.look.id = null;
      for (const k of Object.keys(touch.btn)) if (touch.btn[k] === t.identifier) { delete touch.btn[k]; if (k === 'use') touch.use = false; if (k === 'fire') touch.fire = false; }
    }
  };
  glCanvas.addEventListener('touchend', endTouch); glCanvas.addEventListener('touchcancel', endTouch);

  function resize() {
    W = innerWidth; H = innerHeight; DPR = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(Math.min(DPR, isTouch ? 1.5 : 1.75)); renderer.setSize(W, H, false);
    hud.width = Math.round(W * DPR); hud.height = Math.round(H * DPR);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    layoutTouch();
  }
  addEventListener('resize', resize);

  /* ---------------- Telas ---------------- */
  const show = (id) => { for (const s of ['#menu', '#brief', '#pause', '#result']) $(s).hidden = s !== id; document.body.classList.toggle('playing', id === null); };
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  function renderMenu() {
    mode = 'menu'; show('#menu');
    if (locked && document.exitPointerLock) document.exitPointerLock();
    $('#bank').textContent = fmtMoney(save.bank || 0);
    $('#controls').innerHTML = isTouch
      ? '<dt>Lado esquerdo</dt><dd>Arraste para andar (até o fim corre)</dd><dt>Lado direito</dt><dd>Arraste para olhar em volta</dd><dt>ATIRAR</dt><dd>Segure; arraste o botão para ajustar a mira</dd><dt>Botões</dt><dd>MIRA aproxima · ARMA troca · REC recarrega · E interage</dd>'
      : '<dt>Clique</dt><dd>Prende o mouse para controlar a câmera</dd><dt>WASD</dt><dd>Andar · Shift corre</dd><dt>Mouse</dt><dd>Olhar · botão esquerdo atira</dd><dt>Botão direito</dt><dd>Mirar com precisão</dd><dt>1 2 3 / Roda</dt><dd>Trocar de arma</dd><dt>R · E</dt><dd>Recarregar · interagir (segurar)</dd><dt>Esc</dt><dd>Pausar</dd>';
    $('#missionList').innerHTML = MISSIONS.map((m, i) => {
      const d = save.done[i];
      return `<button class="mcard" style="--c:${m.color}" data-i="${i}">
        <span class="mrow"><span class="pill">${m.code}</span><span>${esc(m.floor)}</span></span>
        <span class="mname">${esc(m.name)}</span>
        <span class="mdesc">${esc(m.desc)}</span>
        <span class="arsenal">${m.weapons.map((k, j) => `<span class="chip"><b>${j + 1}</b>${esc(WEAPONS[k].name)}</span>`).join('')}</span>
        <span class="status ${d ? 'ok' : ''}">${d ? 'Concluída · melhor tempo ' + fmtTime(d.best) : 'Não concluída'}</span>
      </button>`;
    }).join('');
    for (const b of document.querySelectorAll('.mcard')) {
      b.addEventListener('click', () => { initAudio(); showBrief(+b.dataset.i); });
      b.addEventListener('mouseenter', () => { const i = +b.dataset.i; if (!game || game.mi !== i) { newGame(i); } });
    }
  }
  function showBrief(i) {
    const m = MISSIONS[i]; mode = 'brief'; show('#brief');
    if (!game || game.mi !== i) newGame(i);
    const statNames = ['Dano', 'Cadência', 'Alcance'];
    $('#brief').innerHTML = `<div class="brief-wrap">
      <div class="mrow" style="--c:${m.color}"><span class="pill">${m.code}</span><span>${esc(m.floor)}</span><span>Recompensa ${fmtMoney(m.reward)}</span></div>
      <h2>${esc(m.name)}</h2>
      <p class="brief-story">${esc(m.story)}</p>
      <div><p class="label">Objetivos</p><ol class="objs">${m.objectives.map((o) => `<li>${esc(o)}</li>`).join('')}</ol></div>
      <div><p class="label">Arsenal da fase</p><div class="wgrid">${m.weapons.map((k, j) => {
        const w = WEAPONS[k];
        return `<div class="wcard"><span class="wkey">${j + 1}</span><span class="wname">${esc(w.name)}</span><p class="wnote">${esc(w.note)}</p>
          ${w.stats.map((v, si) => `<div class="stat"><span>${statNames[si]}</span><span class="bar"><i style="width:${Math.round(v * 100)}%"></i></span></div>`).join('')}</div>`;
      }).join('')}</div></div>
      <p class="mdesc">Colete inicial: ${m.armor ? m.armor + '%' : 'nenhum'} · Alerta máximo: ${'★'.repeat(m.maxStars)}${m.timeLimit ? ' · Tempo limite: ' + fmtTime(m.timeLimit) : ''}</p>
      <div class="btns"><button class="btn" id="go">Começar missão</button><button class="btn ghost" id="back">Voltar</button></div>
    </div>`;
    $('#go').addEventListener('click', () => startMission(i));
    $('#back').addEventListener('click', renderMenu);
    $('#go').focus();
  }
  function startMission(i) {
    initAudio();
    newGame(i); mode = 'play'; show(null);
    mouse.down = mouse.right = false; touch.move.id = touch.look.id = null; touch.btn = {}; touch.use = touch.fire = false;
    requestLock();
  }
  function pauseGame() {
    if (mode !== 'play' || !game || game.state !== 'play') return;
    mode = 'pause'; mouse.down = mouse.right = false;
    if (locked && document.exitPointerLock) document.exitPointerLock();
    $('#pause').innerHTML = `<div class="card"><h2>Pausado</h2><p>${esc(game.m.name)} · ${esc(objectiveText())}</p>
      <div class="btns"><button class="btn" id="resume">Continuar</button><button class="btn ghost" id="restart">Recomeçar</button><button class="btn ghost" id="quit">Sair para o menu</button></div></div>`;
    show('#pause');
    $('#resume').addEventListener('click', resumeGame);
    $('#restart').addEventListener('click', () => startMission(game.mi));
    $('#quit').addEventListener('click', renderMenu);
    $('#resume').focus();
  }
  function resumeGame() { mode = 'play'; show(null); last = performance.now(); setTimeout(requestLock, 0); }
  function showResult() {
    const g = game, won = g.state === 'won';
    const acc = g.shots ? Math.round(g.hits / g.shots * 100) + '%' : '—';
    const next = won && g.mi < MISSIONS.length - 1;
    $('#result').innerHTML = `<div class="card">
      <h2 class="${won ? 'win' : 'lose'}">${won ? 'Missão cumprida' : 'Demitido'}</h2>
      <p>${won ? esc(g.m.name) + ' concluída. ' + (g.mi === 2 ? 'A KlingCar continua sendo de Ricardo Kling.' : 'O próximo andar espera por você.') : esc(g.reason)}</p>
      <dl class="stats">
        <dt>Tempo</dt><dd>${fmtTime(g.time)}</dd><dt>Abates</dt><dd>${g.kills}</dd><dt>Precisão</dt><dd>${acc}</dd>
        <dt>Dinheiro recolhido</dt><dd class="money">${fmtMoney(g.cash)}</dd>
        ${won ? `<dt>Recompensa</dt><dd class="money">${fmtMoney(g.m.reward)}</dd><dt>Total</dt><dd class="money">${fmtMoney(g.total)}</dd>` : ''}
      </dl>
      <div class="btns">${next ? '<button class="btn" id="next">Próxima missão</button>' : ''}<button class="btn ${next ? 'ghost' : ''}" id="again">${won ? 'Jogar de novo' : 'Tentar de novo'}</button><button class="btn ghost" id="menu-btn">Menu</button></div>
    </div>`;
    show('#result'); document.body.classList.remove('playing');
    if (next) $('#next').addEventListener('click', () => showBrief(g.mi + 1));
    $('#again').addEventListener('click', () => startMission(g.mi));
    $('#menu-btn').addEventListener('click', renderMenu);
    ($('#next') || $('#again')).focus();
  }
  $('#lockHint').addEventListener('click', () => { initAudio(); requestLock(); });

  function boot() {
    resize();
    buildWorld();
    newGame(0);
    renderMenu();
    requestAnimationFrame((t) => { last = t; frame(t); });
  }
  window.__EL3 = {
    get game() { return game; }, startMission, MISSIONS,
    explode: (x, y) => explode(x, y, 'player'),
    killAll: () => { for (const e of game.enemies) if (!e.dead) { e.hp = 1; damageEnemy(e, 5, 1, 0, 0); } },
    look: (y2, p2) => { yaw = y2; pitch = p2; },
    fire: (on) => { touch.fire = on; },
  };
  if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(boot); else boot();
})();
