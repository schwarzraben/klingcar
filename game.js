/* Expediente Letal — jogo de ação top-down ambientado na sede da KlingCar, Av. Paulista, São Paulo. */
'use strict';
(function () {
  const TILE = 48;
  const $ = (s) => document.querySelector(s);
  const canvas = $('#game');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;
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

  /* ---------------- Save ---------------- */
  const SAVE_KEY = 'expediente-letal-v1';
  let save = { done: {}, bank: 0 };
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.done) save = s; } catch (e) { /* sem storage */ }
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignora */ } }

  /* ---------------- Áudio sintetizado ---------------- */
  let AC = null, master = null, noiseBuf = null;
  function initAudio() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = 0.45; master.connect(AC.destination);
      noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { AC = null; }
  }
  function noise(dur, freq, q, vol, type, decay) {
    const t = AC.currentTime; const src = AC.createBufferSource(); src.buffer = noiseBuf;
    const f = AC.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq; f.Q.value = q;
    const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + (decay || dur));
    src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random() * 0.4); src.stop(t + dur);
  }
  function tone(freq, dur, vol, type, slide) {
    const t = AC.currentTime; const o = AC.createOscillator(); o.type = type || 'square';
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

  /* ---------------- Dados: tiles, armas, inimigos, missões ---------------- */
  // s = bloqueia movimento, b = bloqueia bala, v = bloqueia visão
  const TILES = {
    O: { s: 1, b: 1, v: 1 }, W: { s: 1, b: 1, v: 0 }, '#': { s: 1, b: 1, v: 1 }, G: { s: 1, b: 1, v: 0 },
    D: { s: 1, b: 1, v: 0 }, d: { s: 1, b: 1, v: 0 }, P: { s: 1, b: 0, v: 0 }, K: { s: 1, b: 1, v: 0 },
    V: { s: 1, b: 1, v: 0 }, B: { s: 1, b: 1, v: 1 }, S: { s: 1, b: 1, v: 1 }, X: { s: 1, b: 1, v: 0 },
    L: { s: 1, b: 0, v: 0 }, T: { s: 1, b: 1, v: 0 },
    '.': {}, ',': {}, _: {}, E: {}, H: {},
  };
  const FLOOR_CH = '.,_';

  const WEAPONS = {
    golf: { name: 'Taco de Golfe', short: 'TACO DE GOLFE', kind: 'melee', dmg: 60, rate: 0.48, range: 64, arc: 1.6,
      note: 'Presente do conselho. Silencioso e não precisa de munição.', stats: [0.7, 0.45, 0.1] },
    stapler: { name: 'Grampeador Pneumático', short: 'GRAMPEADOR', kind: 'gun', dmg: 11, rate: 0.11, mag: 30, reserve: 180, speed: 820,
      spread: 0.07, auto: true, reload: 1.1, sound: 'stapler', noise: 200, tracer: '#d6dee8',
      note: 'Dispara grampos em rajada. Fraco, mas quase não faz barulho.', stats: [0.25, 0.85, 0.5] },
    pistol: { name: 'Pistola .380', short: 'PISTOLA .380', kind: 'gun', dmg: 27, rate: 0.26, mag: 12, reserve: 72, speed: 1150,
      spread: 0.025, auto: false, reload: 1.2, sound: 'pistol', noise: 620, tracer: '#ffe7a0',
      note: 'Guardada na gaveta da diretoria. Precisa e confiável.', stats: [0.5, 0.5, 0.75] },
    shotgun: { name: 'Escopeta Calibre 12', short: 'ESCOPETA 12', kind: 'gun', dmg: 14, pellets: 8, rate: 0.8, mag: 6, reserve: 36, speed: 1000,
      spread: 0.24, auto: false, reload: 1.8, sound: 'shotgun', noise: 820, tracer: '#ffd27a', knock: 160,
      note: 'Devastadora de perto. Ideal entre os racks de servidor.', stats: [0.95, 0.2, 0.3] },
    extinguisher: { name: 'Extintor de Incêndio', short: 'EXTINTOR', kind: 'spray', dmg: 3, rate: 0.05, mag: 100, reserve: 100, range: 175,
      cone: 0.42, reload: 1.6, stun: 1.6, sound: 'spray', noise: 150,
      note: 'Atordoa quem estiver na frente por quase dois segundos.', stats: [0.15, 1, 0.25] },
    smg: { name: 'Submetralhadora', short: 'SUBMETRALHADORA', kind: 'gun', dmg: 16, rate: 0.075, mag: 32, reserve: 224, speed: 1100,
      spread: 0.085, auto: true, reload: 1.4, sound: 'smg', noise: 700, tracer: '#ffe7a0',
      note: 'Cadência altíssima. Segure o gatilho e controle o recuo.', stats: [0.4, 0.95, 0.55] },
    rifle: { name: 'Fuzil de Assalto', short: 'FUZIL', kind: 'gun', dmg: 33, rate: 0.12, mag: 30, reserve: 180, speed: 1400,
      spread: 0.03, auto: true, reload: 1.7, sound: 'rifle', noise: 900, tracer: '#fff1b8',
      note: 'Alcance e dano altos. A melhor resposta para a segurança privada.', stats: [0.7, 0.75, 0.95] },
    grenade: { name: 'Granadas de Fragmentação', short: 'GRANADAS', kind: 'throw', dmg: 170, rate: 0.9, mag: 1, reserve: 7, radius: 125, reload: 0.45,
      note: 'Mire, solte e afaste-se. Estilhaça vidros no raio da explosão.', stats: [1, 0.15, 0.6] },
  };

  const ENEMIES = {
    intern: { name: 'Espião', hp: 45, speed: 105, dmg: 6, rate: 1.1, spread: 0.2, pellets: 1, react: 0.75, range: 380,
      shirt: '#e9c46a', body: '#3a3f4b', hair: '#3b2a1e', giveUp: 6, cash: [40, 90], drop: 0.35, pref: 230 },
    guard: { name: 'Mercenário', hp: 75, speed: 120, dmg: 8, rate: 0.75, spread: 0.14, pellets: 1, react: 0.5, range: 430,
      shirt: '#2b2f36', body: '#14171c', hair: '#111', giveUp: 14, cash: [80, 160], drop: 0.35, pref: 260 },
    heavy: { name: 'Brutamontes', hp: 170, speed: 88, dmg: 6, rate: 1.3, spread: 0.26, pellets: 5, react: 0.6, range: 320,
      shirt: '#6a4b35', body: '#2a2119', hair: '#1a1a1a', giveUp: 20, cash: [150, 250], drop: 0.6, pref: 140, big: true },
    merc: { name: 'Segurança Privado', hp: 95, speed: 135, dmg: 9, rate: 0.13, spread: 0.12, pellets: 1, react: 0.4, range: 480,
      shirt: '#4b5a3a', body: '#20261a', hair: '#222', giveUp: 999, cash: [120, 220], drop: 0.4, burst: 3, pref: 270 },
    boss: { name: 'Otávio Vasconcelos', hp: 1100, speed: 105, dmg: 8, rate: 0.1, spread: 0.13, pellets: 1, react: 0.3, range: 540,
      shirt: '#ece6d6', body: '#d8cfbb', hair: '#9a9a9a', giveUp: 999, cash: [5000, 5000], drop: 1, burst: 6, pref: 300, boss: true, big: true },
  };

  const MISSIONS = [
    {
      code: 'FÁCIL', diff: 'easy', color: 'var(--easy)', name: 'Papelada Perdida', floor: '12º andar · Administrativo',
      desc: 'Espiões disfarçados de estagiários roubaram três pastas de contratos. Recupere tudo antes que saiam do prédio.',
      story: 'Uma equipe do Grupo Vasconcelos entrou no prédio com crachás falsos de estagiário e levou três pastas com os contratos da nova linha de carros da KlingCar. Eles ainda estão no 12º andar, esperando o fim do expediente para sair. Ricardo decide resolver pessoalmente.',
      objectives: ['Recupere as 3 pastas de contratos', 'Volte ao elevador do saguão'],
      type: 'collect', weapons: ['golf', 'stapler', 'pistol'], enemy: 'intern', armor: 0, dmgMult: 0.75,
      maxStars: 2, startStars: 0, reward: 5000, exitChar: 'E', timeLimit: 0,
      intro: [['Ricardo', 'Três pastas de contrato sumiram da diretoria. Ninguém sai deste andar com elas.'], ['Ricardo', 'Eu sabia que aqueles estagiários novos eram estranhos.']],
      map: [
        ',,,,,,,,,,,,,,,,,' + '#' + ',,P,,,,,,,,,,,,P,,',
        ',DD,,DD,,DD,,DD,,' + '#' + ',,,,,dddddddd,,,,,',
        ',,,,,,,,e,,,,,,,,' + '#' + ',,,,,dddddddd,,f,,',
        ',DD,,DD,,DD,,DD,,' + '#' + ',,,,,,,,e,,,,,,,,,',
        ',,,,,,,,,,,,,,,,,' + '#' + ',,,,,,,,,,,,,,,,,,',
        ',DD,,DD,,DD,,DD,,' + ',' + ',,,,,,,,,,,,,,,,,,',
        ',,,,,,,,,,,,,,,,,' + '#' + ',,,,,,,,,,,,,,,,,,',
        ',,,,f,,,,,,,,,,,,' + '#' + ',,,,,,,,,,,,,,,BBB',
        ',DD,,DD,,DD,,DD,,' + '#' + ',,,,,,,,,,,,,,,BBB',
        ',,,,,,,,,,,,,,,,,' + '#' + 'GGGGGG,,GGGGGGGGGG',
        '................e...................',
        '....................................',
        '#####..#####' + '#######,,###' + '............',
        'KKKK.......#' + '#,,,,,,,,,,#' + '............',
        'V..........#' + '#,BB,,,,,,,#' + '............',
        '....dd..e..#' + '#,,,,ddd,,,#' + '....m.......',
        '....dd.....#' + '#,,,,,f,,e,#' + '............',
        'a..........#' + '#,P,,,,,,,P#' + '............',
        '#####..#####' + '############' + '............',
        '..B..B..B..B..B..B..a...' + '............',
        '..B..B..B..B..B..B.e....' + '........EEEE',
        '..B..B..B..B..B..B......' + '....p...EEEE',
      ],
    },
    {
      code: 'MÉDIA', diff: 'medium', color: 'var(--medium)', name: 'Auditoria Hostil', floor: '7º andar · Data Center',
      desc: 'Mercenários invadiram o data center para apagar os backups. Invada três terminais e segure a posição.',
      story: 'Mercenários contratados por Vasconcelos tomaram o data center do 7º andar e estão apagando os backups da KlingCar. Ricardo precisa acessar três terminais e copiar os dados antes que seja tarde. Quando o primeiro terminal for aberto, o alarme vai disparar e reforços vão subir pelas escadas.',
      objectives: ['Invada os 3 terminais (segure E ao lado de cada um)', 'Fuja pelo elevador do saguão'],
      type: 'hack', weapons: ['pistol', 'shotgun', 'extinguisher'], enemy: 'guard', armor: 50, dmgMult: 1,
      maxStars: 4, startStars: 0, reward: 15000, exitChar: 'E', timeLimit: 0,
      intro: [['Ricardo', 'Se eles apagarem os backups, a KlingCar perde dez anos de projetos.'], ['Ricardo', 'Três terminais. Copio os dados e saio pelo elevador.']],
      map: [
        'EEEE...L' + '#' + ',,,,,,,,,,,' + '#' + '..............R',
        '......LL' + '#' + ',DD,DD,DD,,' + '#' + '.SSSS.SSSS.SSS.',
        '........' + '#' + ',,,,e,,,,,,' + '#' + '.SSSS.SSSS.SSS.',
        '...P....' + '#' + ',DD,DD,DD,,' + '#' + '...............',
        '........' + '#' + ',,,,,,,,,,,' + '.' + '......h........',
        '........' + ',' + ',DD,DD,DD,,' + '#' + '.SSSS.SSSS.SSS.',
        '..p.....' + '#' + ',,,,,,,,,,a' + '#' + '.SSSS.SSSS.SSS.',
        '........' + '#' + ',DD,DD,DD,,' + '#' + '...........e..T',
        '...P....' + '#' + ',,,,,,,,,,,' + '#' + '.SSSS.SSSS.SSS.',
        '........' + '#' + ',,,,,,m,,,,' + '#' + '.SSSS.SSSS.SSS.',
        '........' + '#' + '##,,#######' + '#' + '#####.####.####',
        '....................e...............',
        '..A.................................',
        '####.###.####' + '#' + '####..#####' + '#' + '####..####',
        '.SSS.SSS.SSS.' + '#' + '...........' + '#' + 'XX......XX',
        '.SSS.SSS.SSS.' + '#' + '...SSSSS...' + '#' + 'X........X',
        '......e......' + '#' + '...S...S...' + '#' + '....h.....',
        '.SSS.SSS.SSS.' + '.' + '...S.T.S...' + '#' + 'X........X',
        '.SSS.SSS.SSS.' + '#' + '...S...S...' + '.' + 'XX..a...XX',
        '.............' + '#' + '...SS.SS...' + '#' + '..........',
        'T............' + '#' + '....e......' + '#' + 'XX.....XXX',
        '.............' + '#' + '...........' + '#' + 'X....e...X',
        '.SSS.SSS.SSS.' + '#' + '...........' + '#' + '.........R',
        '.....e.......' + '#' + '...........' + '#' + '..........',
      ],
    },
    {
      code: 'DIFÍCIL', diff: 'hard', color: 'var(--hard)', name: 'Aquisição Hostil', floor: 'Cobertura · 30º andar',
      desc: 'Vasconcelos tomou a cobertura com segurança privada. Derrube o rival e fuja pelo heliponto em 5 minutos.',
      story: 'Otávio Vasconcelos ocupou a cobertura com uma equipe de segurança privada e quer obrigar o conselho a assinar a venda da KlingCar ainda esta noite. A polícia já foi chamada e vai cercar o prédio em cinco minutos. Ricardo precisa derrubar Vasconcelos e chegar ao heliponto antes disso.',
      objectives: ['Elimine Otávio Vasconcelos', 'Chegue ao heliponto no terraço', 'Tudo em menos de 5 minutos'],
      type: 'boss', weapons: ['smg', 'rifle', 'grenade'], enemy: 'merc', armor: 100, dmgMult: 1.1,
      maxStars: 5, startStars: 2, reward: 40000, exitChar: 'H', timeLimit: 300,
      intro: [['Vasconcelos', 'Kling! Assine a venda e todo mundo sai daqui vivo.'], ['Ricardo', 'A KlingCar não está à venda, Otávio.']],
      map: [
        '_____________R' + '#' + 'B,,,,,,,,,,,,,,,,,,,B',
        '__HHHH________' + '#' + 'B,,,,,,,ddddd,,,,,,,B',
        '__HHHH____X___' + '#' + ',,,,,,,,,,b,,,,,,,,,,',
        '__HHHH________' + '#' + ',,h,,,,,,,,,,,,,,h,,,',
        '__HHHH____X___' + '#' + ',,,,,,,,,,,,,,,,,,,,,',
        '______________' + '#' + ',,LLL,,,,,,,,,,,LLL,,',
        '____X____X____' + '#' + ',,,,,,,e,,,,,e,,,,,,,',
        '______________' + '#' + 'GGGGGGGG,,,GGGGGGGGGG',
        '__X______X____' + '#' + '.....................',
        '______e_______' + '#' + '.........h...........',
        '____X____X____' + '#' + 'XX...XX...XX...XX....',
        '_____m________' + '#' + '.....................',
        '______________' + '.' + '...e.......X.X.......',
        '____X____X____' + '.' + '.....................',
        '#####..#######' + '#' + '###..##########..####',
        ',,,,,,,,,,,,,,' + '#' + ',DD,,DD,,DD,,DD,,DD,,',
        ',,DD,,,,DD,,,,' + '#' + ',,,,,,e,,,,,,,,,e,,,,',
        ',,,,,,,e,,,,,,' + '#' + ',DD,,DD,,DD,,DD,,DD,,',
        ',,DD,,,,DD,,,,' + ',' + ',,,,,,,,,,,,,,,,,,,,,',
        ',,,,,,A,,,,,,,' + '#' + ',DD,,DD,,DD,,DD,,DD,,',
        '##########..##' + '#' + ',,,,,,,,,,,h,,,,,,,,,',
        '....a.........' + '#' + ',DD,,DD,,DD,,DD,,DD,,',
        '..............' + '.' + ',,,,,,,,,,,,,,,,,,,R,',
        '..p...........' + '#' + ',,,,,e,,,,,,,,,,,,,,,',
        'EEE...........' + '#' + ',,,,,,,,,,,,,,,,,,,m,',
        '..............' + '#' + ',,,,,,,,,,,,,,,,,,,,,',
      ],
    },
  ];

  const BARKS = ['Ei! Parado aí!', 'É o Kling!', 'Alvo avistado!', 'Chama reforço!', 'Pega ele!', 'Ele está armado!'];

  /* ---------------- Cenário: cidade vista do alto ---------------- */
  let city = null;
  function makeCity() {
    const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = '#060912'; g.fillRect(0, 0, S, S);
    const bs = 256, st = 36, antennas = [];
    g.fillStyle = '#0c111b';
    for (let i = 0; i < 4; i++) { g.fillRect(i * bs, 0, st, S); g.fillRect(0, i * bs, S, st); }
    g.fillStyle = 'rgba(245,184,46,0.22)';
    for (let i = 0; i < 4; i++) for (let j = 0; j < S; j += 26) { g.fillRect(i * bs + st / 2 - 1, j, 2, 11); g.fillRect(j, i * bs + st / 2 - 1, 11, 2); }
    for (let i = 0; i < 4; i++) for (let j = 0; j < S; j += 64) {
      for (const [x, y] of [[i * bs + 3, j], [j, i * bs + 3], [i * bs + st - 3, j + 32], [j + 32, i * bs + st - 3]]) {
        const rg = g.createRadialGradient(x, y, 0, x, y, 22); rg.addColorStop(0, 'rgba(255,170,70,0.35)'); rg.addColorStop(1, 'rgba(255,170,70,0)');
        g.fillStyle = rg; g.fillRect(x - 22, y - 22, 44, 44);
      }
    }
    let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let bx = 0; bx < 4; bx++) for (let by = 0; by < 4; by++) {
      const x0 = bx * bs + st + 8, y0 = by * bs + st + 8, size = bs - st - 16;
      const split = r() < 0.5;
      const parts = 1 + Math.floor(r() * 3);
      for (let k = 0; k < parts; k++) {
        const a = k / parts, b = (k + 1) / parts;
        const x = split ? x0 + size * a : x0, y = split ? y0 : y0 + size * a;
        const w = split ? size * (b - a) - 8 : size, h = split ? size : size * (b - a) - 8;
        const shade = 18 + Math.floor(r() * 16);
        g.fillStyle = `rgb(${shade},${shade + 4},${shade + 14})`; g.fillRect(x, y, w, h);
        g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 3; g.strokeRect(x + 2, y + 2, w - 4, h - 4);
        for (let q = 0; q < 4; q++) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 10 + r() * (w - 40), y + 10 + r() * (h - 40), 14 + r() * 16, 10 + r() * 14); }
        for (let q = 0; q < 6; q++) { g.fillStyle = r() < 0.5 ? 'rgba(255,214,140,0.5)' : 'rgba(170,210,255,0.35)'; g.fillRect(x + 6 + r() * (w - 12), y + 6 + r() * (h - 12), 3, 3); }
        if (r() < 0.6) antennas.push([x + w * (0.3 + r() * 0.4), y + h * (0.3 + r() * 0.4), r() * 6]);
        if (r() < 0.15) { g.fillStyle = '#163a52'; g.fillRect(x + w * 0.2, y + h * 0.2, w * 0.25, h * 0.15); }
      }
    }
    const cars = [];
    for (let i = 0; i < 26; i++) cars.push({ h: Math.random() < 0.5, lane: randi(0, 3), dir: Math.random() < 0.5 ? 1 : -1, p: Math.random() * S, sp: rand(40, 110) });
    return { c, S, st, bs, antennas, cars };
  }
  function drawCity(cx, cy, z, t, dt) {
    const pz = z * 0.55, k = 0.5, S = city.S;
    ctx.setTransform(DPR * pz, 0, 0, DPR * pz, 0, 0);
    const vw = W / pz, vh = H / pz;
    const ox = -(((cx * k) % S) + S) % S, oy = -(((cy * k) % S) + S) % S;
    for (const car of city.cars) car.p = (car.p + car.sp * car.dir * dt + S) % S;
    for (let x = ox; x < vw; x += S) for (let y = oy; y < vh; y += S) {
      ctx.drawImage(city.c, x, y);
      for (const [ax, ay, ph] of city.antennas) {
        if (Math.sin(t * 2.2 + ph) > 0.2) { ctx.fillStyle = 'rgba(255,40,40,0.95)'; ctx.fillRect(x + ax - 2, y + ay - 2, 4, 4); ctx.fillStyle = 'rgba(255,40,40,0.18)'; ctx.fillRect(x + ax - 8, y + ay - 8, 16, 16); }
      }
      for (const car of city.cars) {
        const off = car.lane * city.bs + city.st / 2 + (car.dir > 0 ? 6 : -6);
        const px = car.h ? car.p : off, py = car.h ? off : car.p;
        ctx.fillStyle = car.dir > 0 ? 'rgba(255,245,220,0.9)' : 'rgba(255,60,60,0.85)';
        ctx.fillRect(x + px - 2, y + py - 2, 4, 4);
      }
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = 'rgba(4,7,14,0.35)'; ctx.fillRect(0, 0, W, H);
  }

  /* ---------------- Mapa ---------------- */
  function buildLevel(m) {
    const iw = Math.max(...m.map.map((r) => r.length));
    const raw = [];
    const w = iw + 4;
    raw.push('O'.repeat(w)); raw.push('O' + 'W'.repeat(w - 2) + 'O');
    for (const r of m.map) raw.push('OW' + r.padEnd(iw, '.') + 'WO');
    raw.push('O' + 'W'.repeat(w - 2) + 'O'); raw.push('O'.repeat(w));
    const h = raw.length;
    const grid = [], floor = [];
    const sp = { player: null, enemies: [], pickups: [], terminals: [], reinf: [], exits: [], heli: [] };
    const floorGuess = (x, y) => {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) {
        const c = (raw[y + dy] || '')[x + dx];
        if (c && FLOOR_CH.includes(c)) return c;
      }
      return '.';
    };
    for (let y = 0; y < h; y++) {
      grid.push([]); floor.push([]);
      for (let x = 0; x < w; x++) {
        const ch = raw[y][x];
        const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
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
    L.mapCanvas = document.createElement('canvas'); L.mapCanvas.width = w * TILE; L.mapCanvas.height = h * TILE;
    L.decal = document.createElement('canvas'); L.decal.width = w * TILE; L.decal.height = h * TILE;
    const g = L.mapCanvas.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) drawTile(g, L, x, y);
    // heliponto
    let hx0 = 1e9, hy0 = 1e9, hx1 = -1, hy1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (grid[y][x] === 'H') { hx0 = Math.min(hx0, x); hy0 = Math.min(hy0, y); hx1 = Math.max(hx1, x); hy1 = Math.max(hy1, y); }
    if (hx1 >= 0) {
      const cx = (hx0 + hx1 + 1) / 2 * TILE, cy = (hy0 + hy1 + 1) / 2 * TILE, R = (hx1 - hx0 + 1) * TILE / 2 - 8;
      g.strokeStyle = '#f5b82e'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#eef1f6'; g.font = `${R * 1.1}px ${FONT_D}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', cx, cy + 4);
      L.heli = [cx, cy];
    }
    // minimapa
    L.mini = document.createElement('canvas'); L.mini.width = w; L.mini.height = h;
    const mg = L.mini.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = grid[y][x];
      mg.fillStyle = ch === 'O' ? 'rgba(0,0,0,0)' : ch === '#' || ch === 'W' ? '#56627a' : TILES[ch].s ? '#2c3547' : ch === '_' ? '#3a3a3c' : ch === 'E' ? '#4b5566' : ch === 'H' ? '#5a4a1e' : '#1a2232';
      mg.fillRect(x, y, 1, 1);
    }
    return L;
  }

  function drawFloor(g, f, x, y, px, py) {
    if (f === '.') {
      g.fillStyle = '#b9bec6'; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(px + 1, py + 1, 22, 22); g.fillRect(px + 25, py + 25, 22, 22);
      g.strokeStyle = 'rgba(40,50,70,0.18)'; g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, 24, 24); g.strokeRect(px + 24.5, py + 24.5, 24, 24); g.strokeRect(px + 24.5, py + 0.5, 24, 24); g.strokeRect(px + 0.5, py + 24.5, 24, 24);
    } else if (f === ',') {
      g.fillStyle = '#3e4960'; g.fillRect(px, py, TILE, TILE);
      for (let i = 0; i < 10; i++) { g.fillStyle = hash(x * 13 + i, y * 7 - i) < 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)'; g.fillRect(px + hash(x + i, y) * 44, py + hash(x, y + i) * 44, 4, 4); }
    } else if (f === '_') {
      g.fillStyle = '#6a523e'; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = 'rgba(0,0,0,0.22)'; for (let i = 0; i < 4; i++) g.fillRect(px, py + i * 12 + 11, TILE, 1);
      g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(px + ((x * 17 + y * 5) % 40), py, 1, TILE);
    }
  }

  function drawTile(g, L, x, y) {
    const ch = L.grid[y][x], px = x * TILE, py = y * TILE;
    g.clearRect(px, py, TILE, TILE);
    if (ch === 'O') return;
    const wallAt = (xx, yy) => { const c = (L.grid[yy] || [])[xx]; return c === '#' || c === 'W' || c === 'O'; };
    if (ch === '#') {
      g.fillStyle = '#262c36'; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = '#353d4a'; if (!wallAt(x, y - 1)) g.fillRect(px, py, TILE, 6);
      g.fillStyle = '#1a1f27'; if (!wallAt(x, y + 1)) g.fillRect(px, py + TILE - 4, TILE, 4);
      return;
    }
    if (ch === 'W') {
      g.fillStyle = 'rgba(70,130,190,0.22)'; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = '#7d8ea3';
      const v = x === 1 || x === L.w - 2;
      if (v) { g.fillRect(px + 20, py, 8, TILE); g.fillRect(px + 16, py + TILE - 3, 16, 3); } else { g.fillRect(px, py + 20, TILE, 8); g.fillRect(px + TILE - 3, py + 16, 3, 16); }
      g.fillStyle = 'rgba(180,220,255,0.25)'; if (v) g.fillRect(px + 22, py + 4, 2, 18); else g.fillRect(px + 4, py + 22, 18, 2);
      return;
    }
    drawFloor(g, L.floor[y][x], x, y, px, py);
    switch (ch) {
      case 'E': {
        g.fillStyle = '#8b949f'; g.fillRect(px, py, TILE, TILE);
        const grd = g.createLinearGradient(px, py, px + TILE, py); grd.addColorStop(0, 'rgba(255,255,255,0.15)'); grd.addColorStop(0.5, 'rgba(0,0,0,0.05)'); grd.addColorStop(1, 'rgba(255,255,255,0.12)');
        g.fillStyle = grd; g.fillRect(px, py, TILE, TILE);
        g.fillStyle = '#4c535c'; g.fillRect(px + TILE / 2 - 1, py, 2, TILE);
        g.strokeStyle = '#5d6570'; g.lineWidth = 2; g.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
        break;
      }
      case 'H': g.fillStyle = '#2b2e34'; g.fillRect(px, py, TILE, TILE); g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(px + 4, py + 4, 2, 2); break;
      case 'G':
        g.fillStyle = 'rgba(170,220,255,0.30)'; g.fillRect(px, py + 14, TILE, 20);
        g.fillStyle = '#cfe6ff'; g.fillRect(px, py + 14, TILE, 2); g.fillRect(px, py + 32, TILE, 2);
        g.fillStyle = '#7d8ea3'; g.fillRect(px, py + 14, 3, 20);
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(px + 10, py + 19, 14, 2);
        break;
      case 'D': {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px + 4, py + 6, TILE - 4, TILE - 4);
        g.fillStyle = '#9a7752'; g.fillRect(px + 2, py + 3, TILE - 4, TILE - 6);
        g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(px + 2, py + 3, TILE - 4, 3);
        const up = hash(x, y) < 0.5;
        g.fillStyle = '#1b1f26'; g.fillRect(px + 10, up ? py + 7 : py + TILE - 15, 26, 7);
        g.fillStyle = hash(y, x) < 0.5 ? '#5ec2ff' : '#7de0b0'; g.fillRect(px + 12, up ? py + 8 : py + TILE - 14, 22, 3);
        g.fillStyle = '#d9dde3'; g.fillRect(px + 14, up ? py + 20 : py + 22, 18, 6);
        g.fillStyle = '#f2f2ea'; g.fillRect(px + 36, py + 18, 7, 9);
        if (hash(x + 3, y) < 0.4) { g.fillStyle = '#c0392b'; g.beginPath(); g.arc(px + 8, py + 24, 3, 0, Math.PI * 2); g.fill(); }
        break;
      }
      case 'd': {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px, py + 6, TILE, TILE - 6);
        const l = L.grid[y][x - 1] === 'd', r = L.grid[y][x + 1] === 'd', u = (L.grid[y - 1] || [])[x] === 'd', dn = (L.grid[y + 1] || [])[x] === 'd';
        g.fillStyle = '#5b3f2c'; g.fillRect(px + (l ? 0 : 4), py + (u ? 0 : 4), TILE - (l ? 0 : 4) - (r ? 0 : 4), TILE - (u ? 0 : 4) - (dn ? 0 : 4));
        g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(px + (l ? 0 : 4), py + (u ? 0 : 4), TILE - (l ? 0 : 4) - (r ? 0 : 4), 2);
        if (hash(x, y) < 0.35) { g.fillStyle = '#f1efe6'; g.fillRect(px + 14, py + 16, 14, 18); }
        break;
      }
      case 'P':
        g.fillStyle = '#6b4a2e'; g.beginPath(); g.arc(px + 24, py + 24, 13, 0, Math.PI * 2); g.fill();
        for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + hash(x, y); g.fillStyle = i % 2 ? '#2f7d3b' : '#3f9b4c'; g.beginPath(); g.ellipse(px + 24 + Math.cos(a) * 9, py + 24 + Math.sin(a) * 9, 11, 5, a, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#56b862'; g.beginPath(); g.arc(px + 24, py + 24, 6, 0, Math.PI * 2); g.fill();
        break;
      case 'K':
        g.fillStyle = '#4a4f57'; g.fillRect(px, py + 2, TILE, TILE - 8);
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(px, py + 2, TILE, 3);
        if (x % 2) { g.fillStyle = '#9aa3ad'; g.fillRect(px + 12, py + 12, 24, 18); g.fillStyle = '#6f7a86'; g.fillRect(px + 15, py + 15, 18, 12); }
        else { g.fillStyle = '#20242b'; g.fillRect(px + 10, py + 10, 16, 20); g.fillStyle = '#c0392b'; g.fillRect(px + 30, py + 14, 6, 6); }
        break;
      case 'V':
        g.fillStyle = '#d8dde3'; g.fillRect(px + 12, py + 12, 24, 24);
        g.fillStyle = '#4fa3e0'; g.beginPath(); g.arc(px + 24, py + 24, 10, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(px + 21, py + 21, 3, 0, Math.PI * 2); g.fill();
        break;
      case 'B':
        g.fillStyle = '#3b2a1e'; g.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
        for (let i = 0; i < 9; i++) { g.fillStyle = ['#8e3b2e', '#2d5d7c', '#c7a24a', '#4d6b3a', '#ddd6c6'][Math.floor(hash(x * 9 + i, y) * 5)]; g.fillRect(px + 4 + i * 4.6, py + 5, 3.5, 16); g.fillRect(px + 4 + i * 4.6, py + 27, 3.5, 16); }
        break;
      case 'S': {
        g.fillStyle = '#12151b'; g.fillRect(px + 1, py + 2, TILE - 2, TILE - 4);
        g.fillStyle = '#1e232c'; for (let i = 0; i < 6; i++) g.fillRect(px + 4, py + 5 + i * 7, TILE - 8, 5);
        g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(px + 1, py + 2, TILE - 2, 2);
        break;
      }
      case 'X':
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px + 5, py + 7, TILE - 6, TILE - 6);
        g.fillStyle = '#8a6a43'; g.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
        g.strokeStyle = '#5e4529'; g.lineWidth = 3; g.strokeRect(px + 4.5, py + 4.5, TILE - 9, TILE - 9);
        g.beginPath(); g.moveTo(px + 6, py + 6); g.lineTo(px + TILE - 6, py + TILE - 6); g.moveTo(px + TILE - 6, py + 6); g.lineTo(px + 6, py + TILE - 6); g.stroke();
        break;
      case 'L':
        g.fillStyle = '#5a3424'; g.fillRect(px + 2, py + 4, TILE - 4, TILE - 8);
        g.fillStyle = '#74452f'; g.fillRect(px + 6, py + 12, TILE - 12, TILE - 20);
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(px + 6, py + 12, TILE - 12, 3);
        break;
      case 'T':
        g.fillStyle = '#30363f'; g.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        g.fillStyle = '#1b1f26'; g.fillRect(px + 9, py + 9, TILE - 18, TILE - 22);
        break;
    }
  }

  /* ---------------- Estado do jogo ---------------- */
  let game = null;
  let mode = 'menu';
  const menuCam = { x: 800, y: 600 };

  function makePerson(x, y) {
    return { x, y, r: 14, vx: 0, vy: 0, angle: 0 };
  }

  function newGame(mi) {
    const m = MISSIONS[mi];
    const L = buildLevel(m);
    const g = {
      m, mi, L, enemies: [], bullets: [], grenades: [], parts: [], pickups: [], floaters: [], toasts: [], subs: [], sub: null,
      time: 0, kills: 0, shots: 0, hits: 0, cash: 0, stars: m.startStars, calm: 0, starFlash: 0, reinfT: 6,
      shake: 0, hurtFlash: 0, timeLeft: m.timeLimit, state: 'play', endT: 0, titleT: 4.5,
      stage: m.type === 'collect' ? 'collect' : m.type === 'hack' ? 'hack' : 'boss',
      cam: { x: 0, y: 0 }, flow: new Int16Array(L.w * L.h), flowT: 0, seen: false, docs: 0, docsTotal: 0, terminals: L.sp.terminals,
      boss: null, hacking: null, alarm: false, slow: 1,
    };
    const p = makePerson(L.sp.player[0], L.sp.player[1]);
    Object.assign(p, { hp: 100, armor: m.armor, cur: 0, cool: 0, reload: 0, swing: 0, bloom: 0, lastHurt: 9, trig: false, dead: false, step: 0,
      weapons: m.weapons.map((k) => { const d = WEAPONS[k]; return { k, d, mag: d.mag || 0, reserve: d.reserve || 0 }; }) });
    g.player = p;
    g.cam.x = p.x; g.cam.y = p.y;
    for (const [x, y, k] of L.sp.enemies) g.enemies.push(makeEnemy(x, y, k, false));
    g.boss = g.enemies.find((e) => e.T.boss) || null;
    for (const [x, y, t] of L.sp.pickups) { g.pickups.push({ x, y, t, bob: Math.random() * 6 }); if (t === 'doc') g.docsTotal++; }
    for (const [who, text] of m.intro) g.subs.push({ who, text, dur: 3.8 });
    game = g;
    computeFlow();
    return g;
  }

  function makeEnemy(x, y, k, alert) {
    const T = ENEMIES[k];
    const e = makePerson(x, y);
    Object.assign(e, { k, T, hp: T.hp, maxHp: T.hp, r: T.big ? 17 : 14, alert, react: T.react, cool: rand(0.2, 1), lastSeen: 0, stun: 0, hurtT: 0,
      hx: x, hy: y, wx: x, wy: y, wanderT: rand(0, 3), idleMove: false, strafe: 0, strafeT: 0, burstLeft: 0, dead: false, deadT: 0,
      angle: rand(0, Math.PI * 2), pref: T.pref + rand(-40, 40), nadeT: 6, step: 0 });
    return e;
  }

  /* ---------------- Física e visão ---------------- */
  function tileAt(tx, ty) { if (ty < 0 || ty >= game.L.h || tx < 0 || tx >= game.L.w) return 'O'; return game.L.grid[ty][tx]; }
  function solidAt(tx, ty) { return !!TILES[tileAt(tx, ty)].s; }
  function los(x1, y1, x2, y2, key) {
    const d = Math.hypot(x2 - x1, y2 - y1); const n = Math.ceil(d / 12);
    for (let i = 1; i < n; i++) {
      const t = i / n; const ch = tileAt(Math.floor((x1 + (x2 - x1) * t) / TILE), Math.floor((y1 + (y2 - y1) * t) / TILE));
      if (TILES[ch][key]) return false;
    }
    return true;
  }
  function resolve(e) {
    const r = e.r;
    for (let it = 0; it < 2; it++) {
      const x0 = Math.floor((e.x - r) / TILE), x1 = Math.floor((e.x + r) / TILE), y0 = Math.floor((e.y - r) / TILE), y1 = Math.floor((e.y + r) / TILE);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (!solidAt(tx, ty)) continue;
        const cx = clamp(e.x, tx * TILE, tx * TILE + TILE), cy = clamp(e.y, ty * TILE, ty * TILE + TILE);
        let dx = e.x - cx, dy = e.y - cy; let d = Math.hypot(dx, dy);
        if (d < r) {
          if (d < 0.001) { dx = e.x - (tx * TILE + TILE / 2); dy = e.y - (ty * TILE + TILE / 2); d = Math.hypot(dx, dy) || 1; e.x += dx / d * 2; e.y += dy / d * 2; continue; }
          const push = r - d; e.x += dx / d * push; e.y += dy / d * push;
        }
      }
    }
  }
  function moveEnt(e, dx, dy) { e.x += dx; e.y += dy; resolve(e); }

  function computeFlow() {
    const { w, h } = game.L; const f = game.flow; f.fill(-1);
    const px = Math.floor(game.player.x / TILE), py = Math.floor(game.player.y / TILE);
    const q = new Int32Array(w * h); let qh = 0, qt = 0;
    f[py * w + px] = 0; q[qt++] = py * w + px;
    while (qh < qt) {
      const i = q[qh++]; const x = i % w, y = (i - x) / w; const d = f[i];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of nb) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx; if (f[ni] !== -1 || TILES[game.L.grid[ny][nx]].s) continue;
        f[ni] = d + 1; q[qt++] = ni;
      }
    }
  }
  function flowDir(e) {
    const { w } = game.L; const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE);
    const here = game.flow[ty * w + tx];
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

  /* ---------------- Partículas e efeitos ---------------- */
  function part(x, y, vx, vy, life, color, size, kind) { game.parts.push({ x, y, vx, vy, life, max: life, color, size, kind: kind || 'dot', rot: rand(0, 6), vr: rand(-8, 8) }); }
  function burst(x, y, n, color, sp, life, size, kind) { for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), s = rand(sp * 0.3, sp); part(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(life * 0.5, life), color, size, kind); } }
  function decalBlood(x, y, r) {
    const g = game.L.decal.getContext('2d');
    for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(${110 + randi(0, 30)},12,16,${rand(0.35, 0.6)})`; g.beginPath(); g.arc(x + rand(-r, r) * 0.6, y + rand(-r, r) * 0.6, rand(r * 0.3, r), 0, Math.PI * 2); g.fill(); }
  }
  function decalScorch(x, y, r) {
    const g = game.L.decal.getContext('2d'); const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(10,8,6,0.75)'); rg.addColorStop(1, 'rgba(10,8,6,0)'); g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  function floater(x, y, text, color) { game.floaters.push({ x, y, text, color: color || '#eef1f6', t: 1.6 }); }
  function toast(text, color) { game.toasts.unshift({ text, color: color || '#eef1f6', t: 3 }); if (game.toasts.length > 4) game.toasts.pop(); }
  function say(who, text, dur) { game.subs.push({ who, text, dur: dur || 3.5 }); }

  function breakGlass(tx, ty) {
    const L = game.L; if (L.grid[ty][tx] !== 'G') return;
    L.grid[ty][tx] = L.floor[ty][tx];
    drawTile(L.mapCanvas.getContext('2d'), L, tx, ty);
    const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2;
    burst(cx, cy, 18, 'rgba(200,235,255,0.9)', 260, 0.9, 3, 'shard');
    const g = L.decal.getContext('2d'); g.fillStyle = 'rgba(210,240,255,0.55)';
    for (let i = 0; i < 26; i++) g.fillRect(cx + rand(-30, 30), cy + rand(-30, 30), rand(1, 4), rand(1, 3));
    const mg = L.mini.getContext('2d'); mg.fillStyle = '#1a2232'; mg.fillRect(tx, ty, 1, 1);
    sfx('glass', cx, cy);
    computeFlow();
  }

  /* ---------------- Alerta (estrelas) ---------------- */
  function raiseStars(n) {
    const m = game.m; const v = Math.min(m.maxStars, n);
    if (v > game.stars) { game.stars = v; game.starFlash = 1.2; sfx('star'); }
    game.calm = 0;
  }
  function alertEnemies(x, y, radius) {
    if (radius <= 0) return;
    for (const e of game.enemies) {
      if (e.dead || e.alert) continue;
      if (dist(x, y, e.x, e.y) < radius) { e.alert = true; e.react = e.T.react + 0.3; e.lastSeen = 0; }
    }
  }

  /* ---------------- Jogador ---------------- */
  const keys = {}; const mouse = { x: 0, y: 0, down: false, used: false };
  const touch = { move: { id: null, ox: 0, oy: 0, x: 0, y: 0 }, aim: { id: null, ox: 0, oy: 0, x: 0, y: 0 }, btn: {}, use: false };

  function zoom() { return clamp(Math.min(W / 1150, H / 720), isTouch ? 0.62 : 0.6, 1.25); }
  function screenToWorld(sx, sy) { const z = zoom(); return [(sx - W / 2) / z + game.cam.x, (sy - H / 2) / z + game.cam.y]; }

  function stickVec(s) {
    if (s.id === null) return [0, 0, 0];
    const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy), R = 56;
    const m = Math.min(1, d / R); return d > 4 ? [dx / d * m, dy / d * m, m] : [0, 0, 0];
  }

  function curWeapon() { return game.player.weapons[game.player.cur]; }
  function switchWeapon(i) {
    const p = game.player; if (i === p.cur || i < 0 || i >= p.weapons.length) return;
    p.cur = i; p.reload = 0; p.cool = Math.max(p.cool, 0.15); sfx('switch');
  }
  function startReload() {
    const p = game.player, w = curWeapon(); const d = w.d;
    if (d.kind === 'melee' || p.reload > 0 || w.mag >= d.mag || w.reserve <= 0) return;
    p.reload = d.reload; if (d.kind !== 'throw') sfx('reload');
  }
  function finishReload(w) { const n = Math.min(w.d.mag - w.mag, w.reserve); w.mag += n; w.reserve -= n; }

  function updatePlayer(dt) {
    const p = game.player; if (p.dead) return;
    let mx = 0, my = 0;
    if (keys.KeyW || keys.ArrowUp) my -= 1; if (keys.KeyS || keys.ArrowDown) my += 1;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
    const mv = stickVec(touch.move); mx += mv[0]; my += mv[1];
    const len = Math.hypot(mx, my); if (len > 1) { mx /= len; my /= len; }
    const sprint = keys.ShiftLeft || keys.ShiftRight || mv[2] > 0.97;
    const sp = sprint ? 300 : 205;
    const k = Math.min(1, dt * 12);
    p.vx = lerp(p.vx, mx * sp, k); p.vy = lerp(p.vy, my * sp, k);
    moveEnt(p, p.vx * dt, p.vy * dt);
    const moving = Math.hypot(p.vx, p.vy) > 30; if (moving) p.step += dt * Math.hypot(p.vx, p.vy) / 30;

    const av = stickVec(touch.aim);
    if (av[2] > 0.15) p.angle = Math.atan2(av[1], av[0]);
    else if (!isTouch || mouse.used) { const [wx, wy] = screenToWorld(mouse.x, mouse.y); p.angle = Math.atan2(wy - p.y, wx - p.x); }
    else if (len > 0.1) p.angle = Math.atan2(my, mx);

    p.cool -= dt; p.swing = Math.max(0, p.swing - dt); p.bloom = Math.max(0, p.bloom - dt * 1.6); p.lastHurt += dt;
    if (p.lastHurt > 5 && p.hp < 50) p.hp = Math.min(50, p.hp + 4 * dt);
    const w = curWeapon();
    if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) { p.reload = 0; finishReload(w); } }
    const trigger = mouse.down || av[2] > 0.6;
    if (trigger) tryFire(w, !p.trig || isTouch, moving);
    p.trig = trigger;
    if ((w.d.kind === 'gun' || w.d.kind === 'spray') && w.mag <= 0 && w.reserve > 0 && p.reload <= 0 && !trigger) startReload();

    // interação: terminais
    game.hacking = null;
    if (game.stage === 'hack') {
      for (const t of game.terminals) {
        if (t.done || dist(p.x, p.y, t.x, t.y) > 74) continue;
        game.hacking = t;
        if (keys.KeyE || touch.use) {
          t.p += dt / 4;
          if (Math.random() < 0.3) sfx('hack');
          if (!game.alarm) { game.alarm = true; raiseStars(3); alertEnemies(p.x, p.y, 2000); say('Sistema', 'ALARME: invasão detectada no data center.', 3); }
          if (t.p >= 1) {
            t.p = 1; t.done = true; sfx('done');
            const n = game.terminals.filter((q) => q.done).length;
            toast(`Terminal invadido ${n}/${game.terminals.length}`, '#f5b82e');
          }
        }
        break;
      }
    }
  }

  function tryFire(w, fresh, moving) {
    const p = game.player, d = w.d;
    if (p.cool > 0 || p.reload > 0) return;
    if (d.kind === 'melee') {
      p.cool = d.rate; p.swing = 0.25; sfx('swing');
      let hit = false;
      for (const e of game.enemies) {
        if (e.dead) continue;
        const dd = dist(p.x, p.y, e.x, e.y);
        if (dd > d.range + e.r) continue;
        if (Math.abs(angDiff(p.angle, Math.atan2(e.y - p.y, e.x - p.x))) > d.arc / 2) continue;
        if (!los(p.x, p.y, e.x, e.y, 'b')) continue;
        damageEnemy(e, d.dmg, Math.cos(p.angle), Math.sin(p.angle), 260); e.stun = Math.max(e.stun, 0.45); hit = true;
      }
      if (hit) { sfx('hit'); game.shake += 4; }
      return;
    }
    if (d.kind === 'throw') {
      if (!fresh) return;
      if (w.mag <= 0) { if (w.reserve > 0) startReload(); else { sfx('empty'); p.cool = 0.3; } return; }
      w.mag--; p.cool = d.rate; sfx('throw');
      let tx, ty;
      const av = stickVec(touch.aim);
      if (av[2] > 0.15 || (isTouch && !mouse.used)) { tx = p.x + Math.cos(p.angle) * 260; ty = p.y + Math.sin(p.angle) * 260; }
      else [tx, ty] = screenToWorld(mouse.x, mouse.y);
      const dd = clamp(dist(p.x, p.y, tx, ty), 60, 340); const kk = 2.6;
      game.grenades.push({ x: p.x + Math.cos(p.angle) * 18, y: p.y + Math.sin(p.angle) * 18, vx: Math.cos(p.angle) * dd * kk, vy: Math.sin(p.angle) * dd * kk, k: kk, fuse: 1.6, t: 0, owner: 'player' });
      if (w.mag <= 0 && w.reserve > 0) startReload();
      return;
    }
    if (!d.auto && !fresh) return;
    if (w.mag <= 0) { if (w.reserve > 0) startReload(); else if (fresh) { sfx('empty'); p.cool = 0.25; toast('Sem munição', '#ef5350'); } return; }
    w.mag--; p.cool = d.rate;
    if (d.kind === 'spray') {
      sfx('spray');
      for (let i = 0; i < 3; i++) { const a = p.angle + rand(-d.cone, d.cone) * 0.8, s = rand(220, 420); part(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, Math.cos(a) * s, Math.sin(a) * s, rand(0.35, 0.55), 'rgba(240,244,250,0.75)', rand(6, 12), 'foam'); }
      for (const e of game.enemies) {
        if (e.dead) continue; const dd = dist(p.x, p.y, e.x, e.y);
        if (dd > d.range + e.r) continue;
        if (Math.abs(angDiff(p.angle, Math.atan2(e.y - p.y, e.x - p.x))) > d.cone) continue;
        if (!los(p.x, p.y, e.x, e.y, 'b')) continue;
        damageEnemy(e, d.dmg, Math.cos(p.angle), Math.sin(p.angle), 40, true); e.stun = Math.max(e.stun, d.stun);
      }
      alertEnemies(p.x, p.y, d.noise);
      return;
    }
    const n = d.pellets || 1; const spread = d.spread * (moving ? 1.5 : 1) + p.bloom * 0.05;
    const mx = p.x + Math.cos(p.angle) * 22, my = p.y + Math.sin(p.angle) * 22;
    for (let i = 0; i < n; i++) {
      const a = p.angle + rand(-spread, spread);
      game.bullets.push({ x: mx, y: my, px: mx, py: my, vx: Math.cos(a) * d.speed, vy: Math.sin(a) * d.speed, dmg: d.dmg, owner: 'player', life: 0.9, color: d.tracer, knock: d.knock || 60 });
      game.shots++;
    }
    p.bloom = Math.min(1, p.bloom + (w.k === 'shotgun' ? 0.6 : 0.18));
    part(mx, my, 0, 0, 0.06, '#fff2b0', 16, 'flash');
    part(p.x, p.y, Math.cos(p.angle + 1.6) * rand(60, 120), Math.sin(p.angle + 1.6) * rand(60, 120), 0.5, '#d9b35b', 2.5, 'casing');
    game.shake += w.k === 'shotgun' ? 6 : w.k === 'stapler' ? 0.6 : 1.8;
    sfx(d.sound);
    alertEnemies(p.x, p.y, d.noise);
    if (d.noise >= 500) raiseStars(1);
    if (w.mag <= 0 && w.reserve > 0) startReload();
  }

  function damagePlayer(dmg, ang) {
    const p = game.player; if (p.dead || game.state !== 'play') return;
    if (p.armor > 0) { const a = Math.min(p.armor, dmg * 0.7); p.armor -= a; dmg -= a; }
    p.hp -= dmg; p.lastHurt = 0; game.hurtFlash = Math.min(1, game.hurtFlash + 0.35); game.shake += 3;
    burst(p.x, p.y, 4, '#a3141c', 120, 0.4, 3);
    if (Math.random() < 0.4) sfx('hurt');
    if (p.hp <= 0) { p.hp = 0; p.dead = true; decalBlood(p.x, p.y, 22); endMission(false, 'Ricardo Kling caiu no próprio escritório. O conselho já procura um novo CEO.'); }
  }

  function damageEnemy(e, dmg, dx, dy, knock, quiet) {
    if (e.dead) return;
    e.hp -= dmg; e.hurtT = 0.1;
    if (!e.alert) { e.alert = true; e.react = 0.15; }
    e.lastSeen = 0;
    e.vx += dx * knock; e.vy += dy * knock;
    if (!quiet) burst(e.x, e.y, 5, '#a3141c', 150, 0.45, 3);
    if (e.hp <= 0) killEnemy(e, dx, dy);
  }

  function killEnemy(e, dx, dy) {
    e.dead = true; e.deadT = 0; e.angle = Math.atan2(dy, dx); game.kills++;
    decalBlood(e.x + dx * 10, e.y + dy * 10, e.T.big ? 26 : 20);
    const c = randi(e.T.cash[0], e.T.cash[1]);
    game.pickups.push({ x: e.x + rand(-10, 10), y: e.y + rand(-10, 10), t: 'cash', v: c, bob: 0 });
    if (Math.random() < e.T.drop) game.pickups.push({ x: e.x + rand(-16, 16), y: e.y + rand(-16, 16), t: Math.random() < 0.6 ? 'ammo' : 'med', bob: 0 });
    raiseStars(Math.min(game.m.maxStars, 1 + Math.floor(game.kills / 4)));
    if (e.T.boss) {
      game.stage = 'escape'; game.stars = game.m.maxStars; game.starFlash = 2;
      say('Ricardo', 'Acabou, Otávio. Agora, para o heliponto!', 3.5);
      say('Rádio', 'Atenção: polícia chegando ao prédio. Todas as unidades para a cobertura.', 3.5);
      toast('Vasconcelos eliminado', '#f5b82e');
      sfx('done');
    }
  }

  function enemyFire(e, ang) {
    const T = e.T, n = T.pellets;
    const mx = e.x + Math.cos(ang) * 22, my = e.y + Math.sin(ang) * 22;
    const pm = Math.hypot(game.player.vx, game.player.vy) > 150 ? 1.25 : 1;
    for (let i = 0; i < n; i++) {
      const a = ang + rand(-T.spread, T.spread) * pm;
      game.bullets.push({ x: mx, y: my, px: mx, py: my, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, dmg: T.dmg * game.m.dmgMult, owner: 'enemy', life: 0.9, color: '#ffb36b', knock: 0 });
    }
    part(mx, my, 0, 0, 0.06, '#ffd9a0', 14, 'flash');
    sfx(n > 1 ? 'shotgun' : 'enemy', e.x, e.y);
    if (T.burst) {
      if (e.burstLeft <= 0) e.burstLeft = T.burst;
      e.burstLeft--;
      e.cool = e.burstLeft > 0 ? T.rate : rand(0.9, 1.5);
    } else e.cool = T.rate * rand(0.85, 1.3);
  }

  function updateEnemy(e, dt) {
    if (e.dead) { e.deadT += dt; return; }
    const p = game.player, T = e.T;
    e.cool -= dt; e.hurtT -= dt; e.nadeT -= dt;
    if (e.stun > 0) {
      e.stun -= dt; e.vx *= Math.pow(0.02, dt); e.vy *= Math.pow(0.02, dt);
      moveEnt(e, e.vx * dt, e.vy * dt);
      if (Math.random() < 0.2) part(e.x + rand(-8, 8), e.y + rand(-8, 8), rand(-20, 20), rand(-20, 20), 0.5, 'rgba(240,244,250,0.6)', 6, 'foam');
      return;
    }
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, toP = Math.atan2(dy, dx);
    let sees = false;
    if (!p.dead && d < T.range + (e.alert ? 220 : 0)) {
      const inCone = e.alert || d < 150 || Math.abs(angDiff(e.angle, toP)) < 1.1;
      if (inCone && los(e.x, e.y, p.x, p.y, 'v')) sees = true;
    }
    if (sees) {
      if (!e.alert) {
        e.alert = true; e.react = T.react * rand(0.8, 1.3);
        if (Math.random() < 0.55) floater(e.x, e.y - 30, BARKS[randi(0, BARKS.length - 1)], '#f5b82e');
      }
      e.lastSeen = 0; game.seen = true;
      raiseStars(T.boss ? 3 : 2);
    } else e.lastSeen += dt;
    if (e.alert && e.lastSeen > T.giveUp && game.stars < 3 && !T.boss) { e.alert = false; e.hx = e.x; e.hy = e.y; }

    let tx = 0, ty = 0, speed = T.speed, want = e.angle;
    if (e.alert) {
      e.react -= dt;
      const clear = sees && los(e.x, e.y, p.x, p.y, 'b');
      if (clear) {
        want = toP;
        if (d > e.pref + 40) { const f = flowDir(e); tx = f[0]; ty = f[1]; }
        else if (d < e.pref - 90) { tx = -dx / d; ty = -dy / d; }
        e.strafeT -= dt;
        if (e.strafeT <= 0) { e.strafeT = rand(0.8, 2.2); e.strafe = Math.random() < 0.3 ? 0 : (Math.random() < 0.5 ? -1 : 1); }
        tx += -dy / d * e.strafe * 0.8; ty += dx / d * e.strafe * 0.8;
        speed *= 0.7;
        if (e.react <= 0 && e.cool <= 0 && Math.abs(angDiff(e.angle, toP)) < 0.3) enemyFire(e, e.angle);
        if (T.boss && e.nadeT <= 0 && d > 160 && d < 420) {
          e.nadeT = rand(7, 10);
          const kk = 2.6, dd = d * 0.95;
          game.grenades.push({ x: e.x, y: e.y, vx: dx / d * dd * kk, vy: dy / d * dd * kk, k: kk, fuse: 1.7, t: 0, owner: 'enemy' });
          floater(e.x, e.y - 34, 'Granada!', '#ef5350');
        }
      } else {
        const f = flowDir(e); tx = f[0]; ty = f[1];
        if (tx || ty) want = Math.atan2(ty, tx);
        if (sees) want = toP;
      }
    } else {
      e.wanderT -= dt;
      if (e.wanderT <= 0) { e.wanderT = rand(2, 5); const a = rand(0, Math.PI * 2), r = rand(0, 90); e.wx = e.hx + Math.cos(a) * r; e.wy = e.hy + Math.sin(a) * r; e.idleMove = Math.random() < 0.6; }
      if (e.idleMove) { const ddx = e.wx - e.x, ddy = e.wy - e.y, dd = Math.hypot(ddx, ddy); if (dd > 10) { tx = ddx / dd; ty = ddy / dd; want = Math.atan2(ty, tx); } else e.idleMove = false; }
      speed *= 0.4;
    }
    const tl = Math.hypot(tx, ty); if (tl > 0) { tx /= tl; ty /= tl; }
    const kk = Math.min(1, dt * 8);
    e.vx = lerp(e.vx, tx * speed, kk); e.vy = lerp(e.vy, ty * speed, kk);
    // separação
    for (const o of game.enemies) {
      if (o === e || o.dead) continue;
      const sx = e.x - o.x, sy = e.y - o.y, sd = Math.hypot(sx, sy), min = e.r + o.r + 4;
      if (sd < min && sd > 0.01) { e.x += sx / sd * (min - sd) * 0.5; e.y += sy / sd * (min - sd) * 0.5; }
    }
    { const sx = e.x - p.x, sy = e.y - p.y, sd = Math.hypot(sx, sy), min = e.r + p.r; if (sd < min && sd > 0.01) { e.x += sx / sd * (min - sd); e.y += sy / sd * (min - sd); } }
    moveEnt(e, e.vx * dt, e.vy * dt);
    if (Math.hypot(e.vx, e.vy) > 20) e.step += dt * Math.hypot(e.vx, e.vy) / 30;
    const turn = e.alert ? 6.5 : 3;
    e.angle += clamp(angDiff(e.angle, want), -turn * dt, turn * dt);
  }

  function updateBullets(dt) {
    const p = game.player;
    for (const b of game.bullets) {
      b.px = b.x; b.py = b.y;
      const sp = Math.hypot(b.vx, b.vy); const steps = Math.max(1, Math.ceil(sp * dt / 10));
      const sx = b.vx * dt / steps, sy = b.vy * dt / steps;
      for (let s = 0; s < steps && !b.dead; s++) {
        b.x += sx; b.y += sy;
        const tx = Math.floor(b.x / TILE), ty = Math.floor(b.y / TILE), ch = tileAt(tx, ty);
        if (TILES[ch].b) { hitTile(b, tx, ty, ch); b.dead = true; break; }
        if (b.owner === 'player') {
          for (const e of game.enemies) {
            if (e.dead) continue;
            if (dist(b.x, b.y, e.x, e.y) < e.r + 3) { const l = sp || 1; damageEnemy(e, b.dmg, b.vx / l, b.vy / l, b.knock); game.hits++; b.dead = true; sfx('hit'); break; }
          }
        } else if (!p.dead && dist(b.x, b.y, p.x, p.y) < p.r + 2) { damagePlayer(b.dmg, Math.atan2(b.vy, b.vx)); b.dead = true; }
      }
      b.life -= dt; if (b.life <= 0) b.dead = true;
    }
    game.bullets = game.bullets.filter((b) => !b.dead);
  }

  function hitTile(b, tx, ty, ch) {
    const l = Math.hypot(b.vx, b.vy) || 1, nx = -b.vx / l, ny = -b.vy / l;
    if (ch === 'G') { breakGlass(tx, ty); return; }
    if (ch === 'D' || ch === 'd' || ch === 'K') {
      for (let i = 0; i < 3; i++) part(b.x, b.y, nx * rand(40, 140) + rand(-60, 60), ny * rand(40, 140) + rand(-60, 60), rand(0.8, 1.6), Math.random() < 0.8 ? '#f4f2ea' : '#9a7752', rand(4, 7), 'paper');
    } else if (ch === 'S' || ch === 'T') {
      burst(b.x, b.y, 5, '#7fd3ff', 180, 0.35, 2);
    } else if (ch === 'X') {
      burst(b.x, b.y, 4, '#b08a5a', 140, 0.5, 3);
    } else {
      for (let i = 0; i < 4; i++) part(b.x, b.y, nx * rand(60, 180) + rand(-70, 70), ny * rand(60, 180) + rand(-70, 70), rand(0.15, 0.35), '#ffe0a0', 2);
      part(b.x, b.y, nx * 20, ny * 20, 0.5, 'rgba(160,160,160,0.35)', 8, 'smoke');
    }
  }

  function explode(x, y, owner) {
    const R = WEAPONS.grenade.radius, D = WEAPONS.grenade.dmg * (owner === 'enemy' ? 0.45 : 1);
    sfx('boom', x, y); game.shake += 18;
    part(x, y, 0, 0, 0.15, '#fff6d0', R * 1.2, 'flash');
    burst(x, y, 26, '#ffb347', 380, 0.5, 6);
    burst(x, y, 16, 'rgba(70,70,70,0.6)', 120, 1.6, 20, 'smoke');
    decalScorch(x, y, R * 0.6);
    const tx0 = Math.floor((x - R) / TILE), tx1 = Math.floor((x + R) / TILE), ty0 = Math.floor((y - R) / TILE), ty1 = Math.floor((y + R) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (tileAt(tx, ty) === 'G' && dist(x, y, tx * TILE + 24, ty * TILE + 24) < R) breakGlass(tx, ty);
    for (const e of game.enemies) {
      if (e.dead) continue; const d = dist(x, y, e.x, e.y);
      if (d < R && los(x, y, e.x, e.y, 'v')) { const f = 1 - d / R; const l = d || 1; damageEnemy(e, D * (0.35 + 0.65 * f), (e.x - x) / l, (e.y - y) / l, 400 * f); if (owner === 'player' && !e.dead) game.hits++; }
    }
    const p = game.player; const d = dist(x, y, p.x, p.y);
    if (d < R && los(x, y, p.x, p.y, 'v')) damagePlayer(D * 0.5 * (1 - d / R) + 6, 0);
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

  function updateParts(dt) {
    for (const q of game.parts) {
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
      const fr = q.kind === 'paper' ? 2.2 : q.kind === 'smoke' ? 1.2 : q.kind === 'foam' ? 4 : 5;
      const f = Math.exp(-fr * dt); q.vx *= f; q.vy *= f;
      if (q.kind === 'smoke') q.size += dt * 12;
      if ((q.kind === 'paper' || q.kind === 'casing' || q.kind === 'shard') && q.life <= 0 && Math.random() < 0.6) {
        const g = game.L.decal.getContext('2d'); g.fillStyle = q.color; g.globalAlpha = 0.85;
        g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.fillRect(-q.size / 2, -q.size / 3, q.size, q.size * 0.66); g.restore(); g.globalAlpha = 1;
      }
    }
    game.parts = game.parts.filter((q) => q.life > 0);
    if (game.parts.length > 900) game.parts.splice(0, game.parts.length - 900);
    for (const f of game.floaters) { f.t -= dt; f.y -= 18 * dt; }
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
        for (const w of p.weapons) { if (!w.d.reserve) continue; const add = Math.ceil(w.d.reserve * 0.4); if (w.reserve < w.d.reserve * 2) { w.reserve += add; got = true; } }
        if (!got) continue; toast('+ Munição', '#eef1f6'); sfx('pickup');
      } else if (k.t === 'cash') { game.cash += k.v; toast('+ ' + fmtMoney(k.v), '#7bd88f'); sfx('cash'); }
      else if (k.t === 'doc') { game.docs++; toast(`Pasta de contratos ${game.docs}/${game.docsTotal}`, '#f5b82e'); sfx('done'); raiseStars(1); }
      k.taken = true;
    }
    game.pickups = game.pickups.filter((k) => !k.taken);
  }

  function updateStars(dt) {
    if (game.seen) game.calm = 0; else game.calm += dt;
    game.seen = false;
    game.starFlash = Math.max(0, game.starFlash - dt);
    const floor = game.stage === 'escape' ? game.m.maxStars : game.alarm ? (game.stage === 'exit' ? 4 : 3) : game.m.startStars;
    if (game.stars > floor && game.calm > 9) { game.stars--; game.calm = 4; }
    if (game.alarm && game.stage === 'exit' && game.stars < Math.min(4, game.m.maxStars)) game.stars = Math.min(4, game.m.maxStars);
    // reforços
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
    if (game.stage === 'collect' && game.docs >= game.docsTotal) {
      game.stage = 'exit'; say('Ricardo', 'Pastas recuperadas. Agora, para o elevador.', 3); sfx('done');
    }
    if (game.stage === 'hack' && game.terminals.every((t) => t.done)) {
      game.stage = 'exit'; raiseStars(4); say('Ricardo', 'Backup copiado. Hora de sair pelo saguão.', 3);
    }
    if (m.timeLimit) {
      game.timeLeft -= dt;
      if (game.timeLeft <= 0) { game.timeLeft = 0; endMission(false, 'O tempo acabou. A polícia cercou o prédio antes da fuga.'); return; }
    }
    if (game.stage === 'exit' || game.stage === 'escape') {
      const ch = tileAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
      if (ch === m.exitChar) endMission(true);
    }
  }

  function endMission(win, reason) {
    if (game.state !== 'play') return;
    game.state = win ? 'won' : 'lost'; game.endT = 0; game.reason = reason || '';
    if (win) {
      sfx('win');
      const total = game.m.reward + game.cash;
      const prev = save.done[game.mi];
      save.done[game.mi] = { best: prev ? Math.min(prev.best, game.time) : game.time };
      save.bank = (save.bank || 0) + total; persist();
      game.total = total;
    } else sfx('lose');
  }

  /* ---------------- Loop ---------------- */
  let last = performance.now(), T = 0;
  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
    if (mode === 'play' && game) {
      if (game.state === 'play') step(dt);
      else {
        game.endT += dt;
        const sdt = dt * 0.3; updateParts(sdt); updateBullets(sdt); updateGrenades(sdt);
        for (const e of game.enemies) if (!e.dead) { e.vx *= 0.9; e.vy *= 0.9; }
        if (game.endT > 1.6 && $('#result').hidden) showResult();
      }
      render(dt);
    } else if (mode === 'pause' && game) {
      render(0);
    } else {
      menuCam.x += 22 * dt; menuCam.y += 9 * dt;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#05080f'; ctx.fillRect(0, 0, W, H);
      drawCity(menuCam.x, menuCam.y, 1.4, T, dt);
    }
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
    if (game.enemies.length > 40) game.enemies = game.enemies.filter((e) => !e.dead || e.deadT < 20);
  }

  /* ---------------- Render ---------------- */
  function drawPerson(e, opt) {
    const { shirt, body, hair, skin, gun, tie, big } = opt;
    ctx.save(); ctx.translate(e.x, e.y);
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(3, 5, e.r + 2, e.r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(e.angle);
    const s = big ? 1.2 : 1;
    ctx.scale(s, s);
    const sw = Math.sin(e.step || 0) * 5;
    // pernas/pés
    ctx.fillStyle = '#15171c';
    ctx.beginPath(); ctx.ellipse(-2 + sw, -6, 5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-2 - sw, 6, 5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    // arma
    if (gun) {
      ctx.fillStyle = '#16181c';
      if (gun === 'melee') { const sa = opt.swing ? (opt.swing / 0.25 - 0.5) * 2.4 : 0.6; ctx.save(); ctx.translate(6, 8); ctx.rotate(-sa); ctx.fillStyle = '#c9ced6'; ctx.fillRect(0, -1.5, 34, 3); ctx.fillStyle = '#e8e8e8'; ctx.fillRect(31, -3, 7, 6); ctx.restore(); }
      else if (gun === 'spray') { ctx.fillStyle = '#c0392b'; ctx.fillRect(6, -5, 18, 10); ctx.fillStyle = '#111'; ctx.fillRect(22, -1.5, 10, 3); }
      else if (gun === 'throw') { ctx.fillStyle = '#4a5a32'; ctx.beginPath(); ctx.arc(16, 6, 4.5, 0, Math.PI * 2); ctx.fill(); }
      else { const len = gun === 'long' ? 30 : gun === 'mid' ? 24 : 18; ctx.fillRect(6, -2.5, len, 5); ctx.fillStyle = '#2a2d33'; ctx.fillRect(8, -3.5, 8, 7); }
    }
    // braços
    ctx.fillStyle = shirt;
    ctx.beginPath(); ctx.ellipse(8, -8, 7, 3.6, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8, 8, 7, 3.6, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(14, -3, 3, 0, Math.PI * 2); ctx.arc(14, 3, 3, 0, Math.PI * 2); ctx.fill();
    // tronco
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, 9, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shirt; ctx.beginPath(); ctx.ellipse(1, 0, 6.5, 12.5, 0, 0, Math.PI * 2); ctx.fill();
    if (tie) { ctx.fillStyle = '#f2f2f2'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(2, -4); ctx.lineTo(2, 4); ctx.fill(); ctx.fillStyle = tie; ctx.fillRect(3, -1.2, 6, 2.4); }
    // cabeça
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(1, 0, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(-1, 0, 7, Math.PI * 0.5, Math.PI * 1.5); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-0.5, 0, 6, 6.5, 0, 0, Math.PI * 2); ctx.fill();
    if (opt.flash) { ctx.globalAlpha = 0.6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  function gunShape(k) {
    const d = WEAPONS[k]; if (!d) return 'short';
    if (d.kind === 'melee') return 'melee'; if (d.kind === 'spray') return 'spray'; if (d.kind === 'throw') return 'throw';
    return k === 'rifle' || k === 'shotgun' ? 'long' : k === 'smg' ? 'mid' : 'short';
  }
  const ENEMY_GUN = { intern: 'short', guard: 'mid', heavy: 'long', merc: 'long', boss: 'mid' };

  function drawDead(e) {
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle);
    const s = e.T.big ? 1.2 : 1; ctx.scale(s, s);
    ctx.globalAlpha = clamp(1 - (e.deadT - 18) / 2, 0, 1);
    ctx.fillStyle = e.T.body; ctx.beginPath(); ctx.ellipse(0, 0, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = e.T.shirt; ctx.beginPath(); ctx.ellipse(1, 0, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c99a78'; ctx.beginPath(); ctx.arc(17, 0, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = e.T.hair; ctx.beginPath(); ctx.arc(19, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#15171c'; ctx.fillRect(-22, -7, 9, 4); ctx.fillRect(-22, 3, 9, 4);
    ctx.restore();
  }

  function drawPickup(k) {
    const y = k.y + Math.sin(k.bob) * 3;
    ctx.save(); ctx.translate(k.x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(2, 10 - Math.sin(k.bob) * 3, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (k.t === 'doc') {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 34); g.addColorStop(0, 'rgba(245,184,46,0.45)'); g.addColorStop(1, 'rgba(245,184,46,0)'); ctx.fillStyle = g; ctx.fillRect(-34, -34, 68, 68);
      ctx.fillStyle = '#d9a441'; ctx.fillRect(-12, -9, 24, 18); ctx.fillStyle = '#f0c35d'; ctx.fillRect(-12, -9, 10, 4); ctx.fillStyle = '#fff8e6'; ctx.fillRect(-8, -5, 18, 2); ctx.fillRect(-8, 0, 14, 2);
    } else if (k.t === 'med') {
      ctx.fillStyle = '#f2f2f2'; ctx.fillRect(-11, -9, 22, 18); ctx.fillStyle = '#d33'; ctx.fillRect(-2.5, -6, 5, 12); ctx.fillRect(-6, -2.5, 12, 5);
    } else if (k.t === 'armor') {
      ctx.fillStyle = '#2f4b73'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-11, -11, 22, 22, 5) : ctx.rect(-11, -11, 22, 22); ctx.fill(); ctx.fillStyle = '#5aa9ff'; ctx.fillRect(-7, -6, 14, 3);
    } else if (k.t === 'ammo') {
      ctx.fillStyle = '#4c5a35'; ctx.fillRect(-12, -8, 24, 16); ctx.fillStyle = '#d9b35b'; for (let i = 0; i < 4; i++) ctx.fillRect(-9 + i * 5, -5, 3, 10);
    } else if (k.t === 'cash') {
      ctx.rotate(0.3); ctx.fillStyle = '#3d8b4f'; ctx.fillRect(-10, -6, 20, 12); ctx.fillStyle = '#7bd88f'; ctx.fillRect(-8, -4, 16, 8); ctx.fillStyle = '#3d8b4f'; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function marker(x, y, color) {
    const b = Math.sin(T * 4) * 4;
    ctx.save(); ctx.translate(x, y - 34 + b);
    ctx.fillStyle = color; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-9, -8); ctx.lineTo(9, -8); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
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

  function render(dt) {
    const g = game, p = g.player, z = zoom();
    // câmera
    let tx = p.x, ty = p.y;
    if (!isTouch || mouse.used) { const [wx, wy] = screenToWorld(mouse.x, mouse.y); tx += clamp(wx - p.x, -400, 400) * 0.2; ty += clamp(wy - p.y, -300, 300) * 0.2; }
    else { tx += Math.cos(p.angle) * 70; ty += Math.sin(p.angle) * 70; }
    const ck = 1 - Math.exp(-dt * 6); g.cam.x = lerp(g.cam.x, tx, ck); g.cam.y = lerp(g.cam.y, ty, ck);
    g.shake = Math.min(26, g.shake) * Math.exp(-dt * 10);
    const sx = rand(-1, 1) * g.shake * 0.6, sy = rand(-1, 1) * g.shake * 0.6;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#05080f'; ctx.fillRect(0, 0, W, H);
    drawCity(g.cam.x, g.cam.y, z, T, dt);
    const ox = W / 2 - (g.cam.x + sx) * z, oy = H / 2 - (g.cam.y + sy) * z;
    ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * ox, DPR * oy);
    // sombra do prédio
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(TILE + 14, TILE + 18, (g.L.w - 2) * TILE, (g.L.h - 2) * TILE);
    ctx.drawImage(g.L.mapCanvas, 0, 0);
    ctx.drawImage(g.L.decal, 0, 0);

    const vx0 = Math.floor((g.cam.x - W / 2 / z) / TILE) - 1, vx1 = Math.ceil((g.cam.x + W / 2 / z) / TILE) + 1;
    const vy0 = Math.floor((g.cam.y - H / 2 / z) / TILE) - 1, vy1 = Math.ceil((g.cam.y + H / 2 / z) / TILE) + 1;
    // LEDs de servidores
    for (let y = Math.max(0, vy0); y <= Math.min(g.L.h - 1, vy1); y++) for (let x = Math.max(0, vx0); x <= Math.min(g.L.w - 1, vx1); x++) {
      if (g.L.grid[y][x] !== 'S') continue;
      for (let i = 0; i < 6; i++) {
        const on = Math.sin(T * (2 + hash(x, y + i) * 6) + i * 3) > 0;
        ctx.fillStyle = on ? (hash(x + i, y) < 0.8 ? '#42f59b' : '#ff6b5a') : '#1c3a2b';
        ctx.fillRect(x * TILE + 36, y * TILE + 6 + i * 7, 3, 3);
        if (hash(y, x + i) < 0.5) { ctx.fillStyle = on ? '#5ec2ff' : '#1b2a3a'; ctx.fillRect(x * TILE + 30, y * TILE + 6 + i * 7, 3, 3); }
      }
    }
    // terminais
    for (const t of g.terminals) {
      const px = t.tx * TILE, py = t.ty * TILE;
      ctx.fillStyle = t.done ? '#38d27a' : Math.sin(T * 6) > 0 ? '#ef5350' : '#a33a37';
      ctx.fillRect(px + 10, py + 10, TILE - 20, TILE - 24);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 0; i < 3; i++) ctx.fillRect(px + 13, py + 13 + i * 5, 10 + hash(i, t.tx) * 10, 2);
      if (!t.done && t.p > 0) { ctx.strokeStyle = '#f5b82e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(px + 24, py + 24, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t.p); ctx.stroke(); }
    }
    // marcador de saída (coluna amarela)
    if (g.stage === 'exit' || g.stage === 'escape') {
      const [ex, ey] = objectiveTargets()[0] || [0, 0];
      const pr = 30 + Math.sin(T * 3) * 4;
      const grd = ctx.createRadialGradient(ex, ey, 0, ex, ey, pr * 1.6); grd.addColorStop(0, 'rgba(245,184,46,0.55)'); grd.addColorStop(1, 'rgba(245,184,46,0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(ex, ey, pr * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f5b82e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ex, ey, pr, 0, Math.PI * 2); ctx.stroke();
    }
    for (const k of g.pickups) drawPickup(k);
    for (const k of g.pickups) if (k.t === 'doc') marker(k.x, k.y, '#f5b82e');
    for (const e of g.enemies) if (e.dead) drawDead(e);
    // granadas
    for (const n of g.grenades) {
      const h = Math.max(0, Math.sin(Math.min(1, n.t / 0.6) * Math.PI)) * 8;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(n.x + 2, n.y + 3, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a5a32'; ctx.beginPath(); ctx.arc(n.x, n.y - h, 5 + h * 0.2, 0, Math.PI * 2); ctx.fill();
      if (Math.sin(T * 30) > 0) { ctx.fillStyle = '#ff4040'; ctx.fillRect(n.x - 1, n.y - h - 6, 2, 2); }
    }
    // personagens
    for (const e of g.enemies) {
      if (e.dead) continue;
      drawPerson(e, { shirt: e.T.shirt, body: e.T.body, hair: e.T.hair, skin: '#c99a78', gun: ENEMY_GUN[e.k], big: e.T.big, flash: e.hurtT > 0, tie: e.T.boss ? '#7a1f2b' : null });
      if (e.stun > 0) { ctx.fillStyle = 'rgba(245,248,252,0.55)'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4, 0, Math.PI * 2); ctx.fill(); }
      if (!e.T.boss && e.hp < e.maxHp) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(e.x - 16, e.y - e.r - 12, 32, 4); ctx.fillStyle = '#ef5350'; ctx.fillRect(e.x - 16, e.y - e.r - 12, 32 * e.hp / e.maxHp, 4); }
      if (e.alert && !e.T.boss && e.lastSeen < 0.5 && e.react > 0) { ctx.fillStyle = '#f5b82e'; ctx.font = `bold 20px ${FONT_D}`; ctx.textAlign = 'center'; ctx.fillText('!', e.x, e.y - e.r - 16); }
    }
    if (!p.dead) {
      const w = curWeapon();
      drawPerson(p, { shirt: '#1f2a44', body: '#141c2f', hair: '#2a1d14', skin: '#d6a57f', gun: gunShape(w.k), swing: p.swing, tie: '#b3242f', flash: p.lastHurt < 0.08 });
    } else drawDead({ x: p.x, y: p.y, angle: p.angle, deadT: 0, T: { big: false, body: '#141c2f', shirt: '#1f2a44', hair: '#2a1d14' } });
    // balas
    ctx.lineCap = 'round';
    for (const b of g.bullets) {
      ctx.strokeStyle = b.color; ctx.globalAlpha = 0.9; ctx.lineWidth = b.owner === 'player' ? 2.2 : 2.6;
      const l = Math.hypot(b.vx, b.vy) || 1;
      ctx.beginPath(); ctx.moveTo(b.x - b.vx / l * 18, b.y - b.vy / l * 18); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // partículas
    for (const q of g.parts) {
      const a = clamp(q.life / q.max, 0, 1);
      if (q.kind === 'flash') {
        ctx.globalCompositeOperation = 'lighter';
        const rg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.size); rg.addColorStop(0, q.color); rg.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.globalAlpha = a; ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else if (q.kind === 'smoke' || q.kind === 'foam') {
        ctx.globalAlpha = a * (q.kind === 'smoke' ? 0.6 : 0.9); ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.fill();
      } else if (q.kind === 'paper' || q.kind === 'shard' || q.kind === 'casing') {
        ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = q.color; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillRect(-q.size / 2, -q.size / 3, q.size, q.size * 0.66); ctx.restore();
      } else { ctx.globalAlpha = a; ctx.fillStyle = q.color; ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); }
    }
    ctx.globalAlpha = 1;
    // textos flutuantes
    ctx.textAlign = 'center';
    for (const f of g.floaters) { ctx.globalAlpha = clamp(f.t, 0, 1); ctx.font = `600 16px ${FONT_H}`; ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(f.text, f.x + 1, f.y + 1); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;

    drawHUD(dt, z, ox, oy);
  }

  /* ---------------- HUD ---------------- */
  function hudText(t, x, y, size, color, font, align, weight) {
    ctx.font = `${weight || ''} ${size}px ${font || FONT_H}`; ctx.textAlign = align || 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillText(t, x + 2, y + 2);
    ctx.fillStyle = color; ctx.fillText(t, x, y);
  }
  function star(cx, cy, r, fill, stroke) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
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
    const sb = 0;
    touchLayout = {
      swap: { x: W - 64, y: H - 250 - sb, r: 30, label: 'ARMA' },
      reload: { x: W - 140, y: H - 210 - sb, r: 28, label: 'REC' },
      use: { x: W - 64, y: H - 170 - sb, r: 30, label: 'E' },
      pause: { x: W / 2, y: 30, r: 22, label: 'II' },
    };
  }

  function drawHUD(dt, z, ox, oy) {
    const g = game, p = g.player, w = curWeapon();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // vinheta
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (g.hurtFlash > 0 || p.hp < 30) {
      const a = Math.max(g.hurtFlash * 0.6, p.hp < 30 ? 0.25 + Math.sin(T * 5) * 0.1 : 0);
      const rg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.7);
      rg.addColorStop(0, 'rgba(160,0,0,0)'); rg.addColorStop(1, `rgba(160,0,0,${a})`); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    }
    const compact = W < 700;
    const M = 16;
    // topo direito: arma, munição, dinheiro, estrelas
    let y = M + 26;
    const rx = W - M;
    hudText(w.d.short, rx, y, compact ? 20 : 24, '#eef1f6', FONT_D, 'right');
    y += compact ? 28 : 34;
    let ammo = '∞';
    if (w.d.kind === 'throw') ammo = String(w.mag + w.reserve);
    else if (w.d.kind !== 'melee') ammo = `${w.mag}  |  ${w.reserve}`;
    hudText(p.reload > 0 ? 'RECARREGANDO' : ammo, rx, y, compact ? 22 : 28, p.reload > 0 ? '#f5b82e' : (w.d.kind !== 'melee' && w.mag === 0 ? '#ef5350' : '#eef1f6'), FONT_H, 'right', 700);
    y += compact ? 32 : 40;
    hudText(fmtMoney(g.cash), rx, y, compact ? 26 : 34, '#7bd88f', FONT_D, 'right');
    y += 24;
    for (let i = 0; i < 5; i++) {
      const cx = rx - 12 - i * 26, filled = 5 - i <= g.stars;
      const flash = g.starFlash > 0 && Math.sin(T * 18) > 0;
      if (filled) star(cx, y, 10, flash ? '#ffffff' : '#f5f5f5', 'rgba(0,0,0,0.7)');
      else star(cx, y, 10, 'rgba(0,0,0,0.35)', 'rgba(255,255,255,0.35)');
    }
    y += 26;
    // toasts
    for (const t of g.toasts) { ctx.globalAlpha = clamp(t.t, 0, 1); hudText(t.text, rx, y, 18, t.color, FONT_H, 'right', 600); y += 22; }
    ctx.globalAlpha = 1;

    // minimapa + vida
    const mmW = isTouch ? 150 : compact ? 160 : 230, mmH = Math.round(mmW * 0.64);
    const mmX = M, mmY = isTouch ? M : H - M - mmH - 18;
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,20,0.85)'; ctx.fillRect(mmX - 3, mmY - 3, mmW + 6, mmH + 6 + 16);
    ctx.beginPath(); ctx.rect(mmX, mmY, mmW, mmH); ctx.clip();
    ctx.fillStyle = '#0b1220'; ctx.fillRect(mmX, mmY, mmW, mmH);
    const s = Math.min(mmW / g.L.w, mmH / g.L.h) * 1.0;
    const mx0 = mmX + (mmW - g.L.w * s) / 2, my0 = mmY + (mmH - g.L.h * s) / 2;
    ctx.imageSmoothingEnabled = false; ctx.drawImage(g.L.mini, mx0, my0, g.L.w * s, g.L.h * s); ctx.imageSmoothingEnabled = true;
    const toM = (x, yy) => [mx0 + x / TILE * s, my0 + yy / TILE * s];
    for (const e of g.enemies) {
      if (e.dead) continue; const [ex, ey] = toM(e.x, e.y);
      if (e.T.boss) { ctx.fillStyle = '#ef5350'; ctx.beginPath(); ctx.arc(ex, ey, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); }
      else if (e.alert || dist(e.x, e.y, p.x, p.y) < 420) { ctx.fillStyle = e.alert ? '#ef5350' : 'rgba(239,83,80,0.55)'; ctx.beginPath(); ctx.arc(ex, ey, 2.6, 0, Math.PI * 2); ctx.fill(); }
    }
    for (const k of g.pickups) { if (k.t === 'cash') continue; const [kx, ky] = toM(k.x, k.y); ctx.fillStyle = k.t === 'doc' ? '#f5b82e' : k.t === 'med' ? '#7bd88f' : k.t === 'armor' ? '#5aa9ff' : '#cfd6e0'; ctx.fillRect(kx - 2, ky - 2, 4, 4); }
    for (const [ox2, oy2] of objectiveTargets()) { const [kx, ky] = toM(ox2, oy2); ctx.fillStyle = '#f5b82e'; ctx.beginPath(); ctx.arc(kx, ky, 4 + Math.sin(T * 6) * 1.2, 0, Math.PI * 2); ctx.fill(); }
    {
      const [px2, py2] = toM(p.x, p.y);
      ctx.save(); ctx.translate(px2, py2); ctx.rotate(p.angle); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-2, 0); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.restore();
    // barras
    const by = mmY + mmH + 5, bw = (mmW - 4) / 2;
    ctx.fillStyle = '#1d3a24'; ctx.fillRect(mmX, by, bw, 8); ctx.fillStyle = p.hp < 30 ? '#ef5350' : '#5cc26f'; ctx.fillRect(mmX, by, bw * p.hp / 100, 8);
    ctx.fillStyle = '#1b2a40'; ctx.fillRect(mmX + bw + 4, by, bw, 8); ctx.fillStyle = '#5aa9ff'; ctx.fillRect(mmX + bw + 4, by, bw * p.armor / 100, 8);

    // objetivo
    const oText = objectiveText();
    ctx.font = `600 ${compact ? 16 : 19}px ${FONT_H}`;
    const objX = isTouch ? M : M, objY = isTouch ? mmY + mmH + 34 : M;
    const tw = Math.min(ctx.measureText(oText).width, W - 2 * M - (isTouch ? 0 : 220));
    ctx.fillStyle = 'rgba(8,12,20,0.78)'; ctx.fillRect(objX, objY, tw + 24, g.m.timeLimit ? 66 : 46);
    ctx.fillStyle = '#f5b82e'; ctx.fillRect(objX, objY, 3, g.m.timeLimit ? 66 : 46);
    hudText('OBJETIVO', objX + 12, objY + 16, 12, '#9aa6bb', FONT_H, 'left', 700);
    hudText(oText, objX + 12, objY + 37, compact ? 16 : 19, '#eef1f6', FONT_H, 'left', 600);
    if (g.m.timeLimit) hudText('POLÍCIA EM ' + fmtTime(g.timeLeft), objX + 12, objY + 58, 16, g.timeLeft < 60 ? '#ef5350' : '#f5b82e', FONT_H, 'left', 700);

    // chefe
    if (g.boss && !g.boss.dead && g.boss.alert) {
      const bw2 = Math.min(420, W - 2 * M - 40), bx = (W - bw2) / 2, byy = isTouch ? 64 : M + 8;
      hudText(g.boss.T.name.toUpperCase(), W / 2, byy + 2, 16, '#eef1f6', FONT_H, 'center', 700);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx, byy + 8, bw2, 9);
      ctx.fillStyle = '#ef5350'; ctx.fillRect(bx, byy + 8, bw2 * g.boss.hp / g.boss.maxHp, 9);
    }

    // seta para objetivo fora da tela
    const tg = objectiveTargets();
    if (tg.length) {
      let best = null, bd = 1e9; for (const t of tg) { const d = dist(p.x, p.y, t[0], t[1]); if (d < bd) { bd = d; best = t; } }
      const sx = best[0] * z + ox, sy = best[1] * z + oy;
      if (sx < 30 || sy < 30 || sx > W - 30 || sy > H - 30) {
        const a = Math.atan2(sy - H / 2, sx - W / 2);
        const ex = clamp(W / 2 + Math.cos(a) * W, 40, W - 40), ey = clamp(H / 2 + Math.sin(a) * H, 40, H - 40);
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
        ctx.fillStyle = '#f5b82e'; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }

    // slots de arma
    if (!isTouch) {
      const sw = 128, sh = 34, gap = 6; let sx2 = W - M - (sw * 3 + gap * 2); const sy2 = H - M - sh;
      p.weapons.forEach((ww, i) => {
        const act = i === p.cur;
        ctx.fillStyle = act ? 'rgba(245,184,46,0.92)' : 'rgba(8,12,20,0.78)'; ctx.fillRect(sx2, sy2, sw, sh);
        ctx.font = `700 15px ${FONT_H}`; ctx.textAlign = 'left'; ctx.fillStyle = act ? '#11151d' : '#9aa6bb'; ctx.fillText(String(i + 1), sx2 + 9, sy2 + 22);
        ctx.fillStyle = act ? '#11151d' : '#eef1f6'; ctx.font = `600 15px ${FONT_H}`;
        let nm = ww.d.short; while (ctx.measureText(nm).width > sw - 34 && nm.length > 3) nm = nm.slice(0, -1);
        ctx.fillText(nm, sx2 + 24, sy2 + 22);
        sx2 += sw + gap;
      });
    }

    // prompt de interação
    if (g.hacking) {
      const t = g.hacking; const txt = isTouch ? 'Segure E para invadir o terminal' : 'Segure [E] para invadir o terminal';
      const yy = H * 0.68;
      hudText(txt, W / 2, yy, 20, '#eef1f6', FONT_H, 'center', 700);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - 120, yy + 10, 240, 8); ctx.fillStyle = '#f5b82e'; ctx.fillRect(W / 2 - 120, yy + 10, 240 * t.p, 8);
    }

    // legendas
    if (g.sub) {
      const yy = H - (isTouch ? 300 : 90);
      ctx.font = `600 ${compact ? 17 : 21}px ${FONT_H}`; ctx.textAlign = 'center';
      const who = g.sub.who + ': ', full = who + g.sub.text;
      const fw = ctx.measureText(full).width; const maxw = W - 40;
      const lines = [];
      if (fw > maxw) { const words = full.split(' '); let cur = ''; for (const wd of words) { const tst = cur ? cur + ' ' + wd : wd; if (ctx.measureText(tst).width > maxw) { lines.push(cur); cur = wd; } else cur = tst; } lines.push(cur); }
      else lines.push(full);
      ctx.globalAlpha = clamp(g.sub.t * 2, 0, 1);
      lines.forEach((ln, i) => {
        const ly = yy + i * 24;
        if (i === 0) {
          const lw = ctx.measureText(ln).width, ww2 = ctx.measureText(who).width, x0 = W / 2 - lw / 2;
          ctx.textAlign = 'left';
          ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillText(ln, x0 + 2, ly + 2);
          ctx.fillStyle = g.sub.who === 'Ricardo' ? '#5aa9ff' : g.sub.who === 'Vasconcelos' ? '#ef5350' : '#f5b82e'; ctx.fillText(who, x0, ly);
          ctx.fillStyle = '#eef1f6'; ctx.fillText(ln.slice(who.length), x0 + ww2, ly);
        } else { ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillText(ln, W / 2 + 2, ly + 2); ctx.fillStyle = '#eef1f6'; ctx.fillText(ln, W / 2, ly); }
      });
      ctx.globalAlpha = 1;
    }

    // título da missão
    if (g.titleT > 0) {
      const a = clamp(g.titleT, 0, 1) * clamp((4.5 - g.titleT) * 2, 0, 1);
      ctx.globalAlpha = a;
      hudText(g.m.name.toUpperCase(), W / 2, H * 0.36, compact ? 44 : 72, '#f5b82e', FONT_D, 'center');
      hudText(`${g.m.code}  ·  ${g.m.floor.toUpperCase()}`, W / 2, H * 0.36 + 34, compact ? 16 : 20, '#eef1f6', FONT_H, 'center', 700);
      ctx.globalAlpha = 1;
    }

    // mira
    if (!isTouch || mouse.used) {
      const r = 9 + p.bloom * 16 + (Math.hypot(p.vx, p.vy) > 30 ? 6 : 0);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(mouse.x + Math.cos(a) * r, mouse.y + Math.sin(a) * r); ctx.lineTo(mouse.x + Math.cos(a) * (r + 7), mouse.y + Math.sin(a) * (r + 7)); ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.fillRect(mouse.x - 1, mouse.y - 1, 2, 2);
    }

    if (isTouch) drawTouch();

    // fim
    if (g.state !== 'play') {
      const a = clamp(g.endT / 1.2, 0, 1);
      ctx.fillStyle = `rgba(0,0,0,${a * 0.45})`; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, H * 0.42 - 50, W, 90);
      hudText(g.state === 'won' ? 'MISSÃO CUMPRIDA' : 'DEMITIDO', W / 2, H * 0.42 + 18, compact ? 48 : 78, g.state === 'won' ? '#f5b82e' : '#ef5350', FONT_D, 'center');
      ctx.globalAlpha = 1;
    }
  }

  function drawTouch() {
    const drawStick = (s, label) => {
      if (s.id === null) return;
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.ox, s.oy, 56, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const v = stickVec(s);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(s.ox + v[0] * 56, s.oy + v[1] * 56, 24, 0, Math.PI * 2); ctx.fill();
    };
    drawStick(touch.move); drawStick(touch.aim);
    if (touch.move.id === null) hudText('MOVER', 70, H - 70, 14, 'rgba(255,255,255,0.35)', FONT_H, 'center', 700);
    if (touch.aim.id === null) hudText('MIRAR / ATIRAR', W - 90, H - 70, 14, 'rgba(255,255,255,0.35)', FONT_H, 'center', 700);
    for (const [k, b] of Object.entries(touchLayout)) {
      const on = touch.btn[k] !== undefined;
      const hl = k === 'use' && game.hacking;
      ctx.fillStyle = on ? 'rgba(245,184,46,0.85)' : hl ? 'rgba(245,184,46,0.55)' : 'rgba(8,12,20,0.6)';
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.font = `700 ${b.label.length > 2 ? 13 : 18}px ${FONT_H}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = on ? '#11151d' : '#eef1f6'; ctx.fillText(b.label, b.x, b.y + 1); ctx.textBaseline = 'alphabetic';
    }
  }

  /* ---------------- Entrada ---------------- */
  addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && mode === 'play') e.preventDefault();
    keys[e.code] = true;
    if (mode === 'play' && game && game.state === 'play') {
      if (e.code === 'Digit1') switchWeapon(0); if (e.code === 'Digit2') switchWeapon(1); if (e.code === 'Digit3') switchWeapon(2);
      if (e.code === 'KeyQ') switchWeapon((game.player.cur + 2) % 3);
      if (e.code === 'KeyR') startReload();
      if (e.code === 'Escape' || e.code === 'KeyP') pauseGame();
    } else if (mode === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) resumeGame();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; if (mode === 'play' && game && game.state === 'play') pauseGame(); });
  canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.used = true; });
  canvas.addEventListener('mousedown', (e) => { initAudio(); mouse.x = e.clientX; mouse.y = e.clientY; mouse.used = true; if (e.button === 0) mouse.down = true; });
  addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { if (mode !== 'play' || !game) return; e.preventDefault(); const n = game.player.weapons.length; switchWeapon((game.player.cur + (e.deltaY > 0 ? 1 : n - 1)) % n); }, { passive: false });

  function hitButton(x, y) { for (const [k, b] of Object.entries(touchLayout)) if (dist(x, y, b.x, b.y) < b.r + 8) return k; return null; }
  canvas.addEventListener('touchstart', (e) => {
    if (mode !== 'play') return;
    e.preventDefault(); initAudio(); mouse.used = false;
    for (const t of e.changedTouches) {
      const b = hitButton(t.clientX, t.clientY);
      if (b) {
        touch.btn[b] = t.identifier;
        if (b === 'swap' && game) switchWeapon((game.player.cur + 1) % game.player.weapons.length);
        if (b === 'reload' && game) startReload();
        if (b === 'use') touch.use = true;
        if (b === 'pause') pauseGame();
        continue;
      }
      const s = t.clientX < W / 2 ? touch.move : touch.aim;
      if (s.id !== null) continue;
      s.id = t.identifier; s.ox = s.x = t.clientX; s.oy = s.y = t.clientY;
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) for (const s of [touch.move, touch.aim]) if (s.id === t.identifier) { s.x = t.clientX; s.y = t.clientY; }
  }, { passive: false });
  const endTouch = (e) => {
    for (const t of e.changedTouches) {
      for (const s of [touch.move, touch.aim]) if (s.id === t.identifier) s.id = null;
      for (const k of Object.keys(touch.btn)) if (touch.btn[k] === t.identifier) { delete touch.btn[k]; if (k === 'use') touch.use = false; }
    }
  };
  canvas.addEventListener('touchend', endTouch); canvas.addEventListener('touchcancel', endTouch);

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    layoutTouch();
  }
  addEventListener('resize', resize);

  /* ---------------- Telas ---------------- */
  const show = (id) => { for (const s of ['#menu', '#brief', '#pause', '#result']) $(s).hidden = s !== id; document.body.classList.toggle('playing', id === null); };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function renderMenu() {
    mode = 'menu'; show('#menu');
    $('#bank').textContent = fmtMoney(save.bank || 0);
    $('#controls').innerHTML = isTouch
      ? '<dt>Lado esquerdo</dt><dd>Arraste para mover (até o fim corre)</dd><dt>Lado direito</dt><dd>Arraste para mirar e atirar</dd><dt>Botões</dt><dd>ARMA troca · REC recarrega · E interage</dd>'
      : '<dt>WASD</dt><dd>Mover · Shift corre</dd><dt>Mouse</dt><dd>Mirar e atirar</dd><dt>1 2 3 / Roda</dt><dd>Trocar de arma</dd><dt>R</dt><dd>Recarregar</dd><dt>E</dt><dd>Interagir (segurar)</dd><dt>Esc</dt><dd>Pausar</dd>';
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
    for (const b of document.querySelectorAll('.mcard')) b.addEventListener('click', () => { initAudio(); showBrief(+b.dataset.i); });
  }

  function showBrief(i) {
    const m = MISSIONS[i]; mode = 'brief'; show('#brief');
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
    mouse.down = false; touch.move.id = touch.aim.id = null; touch.btn = {}; touch.use = false;
  }

  function pauseGame() {
    if (mode !== 'play' || !game || game.state !== 'play') return;
    mode = 'pause'; mouse.down = false;
    $('#pause').innerHTML = `<div class="card"><h2>Pausado</h2><p>${esc(game.m.name)} · ${esc(objectiveText())}</p>
      <div class="btns"><button class="btn" id="resume">Continuar</button><button class="btn ghost" id="restart">Recomeçar</button><button class="btn ghost" id="quit">Sair para o menu</button></div></div>`;
    show('#pause');
    $('#resume').addEventListener('click', resumeGame);
    $('#restart').addEventListener('click', () => startMission(game.mi));
    $('#quit').addEventListener('click', renderMenu);
    $('#resume').focus();
  }
  function resumeGame() { mode = 'play'; show(null); last = performance.now(); }

  function showResult() {
    const g = game, won = g.state === 'won';
    const acc = g.shots ? Math.round(g.hits / g.shots * 100) + '%' : '—';
    const next = won && g.mi < MISSIONS.length - 1;
    $('#result').innerHTML = `<div class="card">
      <h2 class="${won ? 'win' : 'lose'}">${won ? 'Missão cumprida' : 'Demitido'}</h2>
      <p>${won ? esc(g.m.name) + ' concluída. ' + (g.mi === 2 ? 'A KlingCar continua sendo de Ricardo Kling.' : 'O próximo andar espera por você.') : esc(g.reason)}</p>
      <dl class="stats">
        <dt>Tempo</dt><dd>${fmtTime(g.time)}</dd>
        <dt>Abates</dt><dd>${g.kills}</dd>
        <dt>Precisão</dt><dd>${acc}</dd>
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

  /* ---------------- Início ---------------- */
  function boot() {
    resize();
    city = makeCity();
    renderMenu();
    requestAnimationFrame((t) => { last = t; frame(t); });
  }
  // expõe ganchos de teste
  window.__EL = { get game() { return game; }, startMission, MISSIONS, explode: (x, y) => explode(x, y, 'player'), killAll: () => { for (const e of game.enemies) if (!e.dead) { e.hp = 1; damageEnemy(e, 5, 1, 0, 0); } } };
  if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(boot); else boot();
})();
