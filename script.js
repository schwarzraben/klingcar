/* =========================================================
   KLING CAR — Showroom 3D
   Ciclo de cada transição:
     1) o carro "arranca" (se mexe para frente)
     2) a plataforma gira e traz o próximo carro
     3) o próximo carro chega e assenta na suspensão
   ========================================================= */
(() => {
  "use strict";

  const CARS = [
    {
      id: "aston-martin", brand: "Aston Martin", model: "Vanquish", big: "VANQUISH",
      img: "assets/cars/aston-martin.webp",
      xray: { size: [684, 196], engine: [45, 52, 200, 58], cabin: [285, 28, 170, 95], cyl: 12, turbo: false, rear: false, rearSeats: true },
      interior: "Couro semi-anilina, 2+2 lugares",
      tagline: "Grand tourer V12 com alma britânica.",
      specs: [["Motor", "V12 5.9"], ["Potência", "576 cv"], ["0–100", "3,6 s"], ["Máx.", "323 km/h"]],
      body: "Cupê GT", year: "2024",
    },
    {
      id: "bmw-m4", brand: "BMW M", model: "M4 Competition", big: "M4",
      img: "assets/cars/bmw-m4.webp",
      xray: { size: [640, 314], engine: [85, 95, 300, 60], cabin: [250, 25, 210, 85], cyl: 6, turbo: true, rear: false, rearSeats: true },
      interior: "Bancos concha M Carbon",
      tagline: "Precisão de pista para o dia a dia.",
      specs: [["Motor", "6 cil. 3.0 biturbo"], ["Potência", "510 cv"], ["0–100", "3,9 s"], ["Máx.", "290 km/h"]],
      body: "Cupê esportivo", year: "2025",
    },
    {
      id: "ferrari-purosangue", brand: "Ferrari", model: "Purosangue", big: "PUROSANGUE",
      img: "assets/cars/ferrari-purosangue.webp",
      xray: { size: [568, 175], engine: [30, 55, 190, 52], cabin: [225, 22, 220, 90], cyl: 12, turbo: false, rear: false, rearSeats: true },
      interior: "4 bancos individuais em couro",
      tagline: "Quatro portas, quatro lugares, um V12 aspirado.",
      specs: [["Motor", "V12 6.5"], ["Potência", "725 cv"], ["0–100", "3,3 s"], ["Máx.", "310 km/h"]],
      body: "FUV 4 lugares", year: "2025",
    },
    {
      id: "mercedes-g63", brand: "Mercedes-AMG", model: "G 63", big: "G 63",
      img: "assets/cars/mercedes-g63.webp",
      xray: { size: [618, 277], engine: [25, 100, 180, 60], cabin: [215, 35, 330, 115], cyl: 8, turbo: true, rear: false, rearSeats: true },
      interior: "Couro Nappa AMG, 5 lugares",
      tagline: "O ícone off-road com força AMG.",
      specs: [["Motor", "V8 4.0 biturbo"], ["Potência", "585 cv"], ["0–100", "4,5 s"], ["Tração", "4MATIC"]],
      body: "SUV", year: "2024",
    },
    {
      id: "lamborghini-urus", brand: "Lamborghini", model: "Urus", big: "URUS",
      img: "assets/cars/lamborghini-urus.webp",
      xray: { size: [604, 318], engine: [60, 75, 300, 70], cabin: [190, 15, 300, 95], cyl: 8, turbo: true, rear: false, rearSeats: true },
      interior: "Couro e Alcantara, 4 lugares",
      tagline: "O primeiro Super SUV do mundo.",
      specs: [["Motor", "V8 4.0 biturbo"], ["Potência", "650 cv"], ["0–100", "3,6 s"], ["Máx.", "305 km/h"]],
      body: "Super SUV", year: "2024",
    },
    {
      id: "porsche-gt3", brand: "Porsche", model: "911 GT3", big: "GT3",
      img: "assets/cars/porsche-gt3.webp",
      xray: { size: [652, 201], engine: [455, 58, 165, 62], cabin: [225, 25, 240, 90], cyl: 6, turbo: false, rear: true, rearSeats: false },
      interior: "Bancos full bucket em carbono",
      tagline: "Nascido no autódromo, homologado para a rua.",
      specs: [["Motor", "Boxer 4.0 aspirado"], ["Potência", "510 cv"], ["0–100", "3,4 s"], ["Máx.", "318 km/h"]],
      body: "Cupê esportivo", year: "2025",
    },
  ];

  const AUTOPLAY_MS = 5000;
  const DRIVE_MS = 700;   // fase 1 — carro se mexe
  const SPIN_MS = 1200;   // fase 2 — plataforma gira (igual ao CSS)
  const STEP = 360 / CARS.length;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (s, r = document) => r.querySelector(s);
  const stage = $("#stage");
  const ring = $("#ring");
  const disc = $(".turntable__disc");
  const bigname = $("#bigname");
  const info = $("#info");
  const dotsEl = $("#dots");

  /* ---------- Raio-X: motor e interior desenhados sobre a foto ---------- */
  const pct = (v, t) => `${((v / t) * 100).toFixed(2)}%`;

  function engineSVG([x, y, w, h], { cyl, turbo, rear }) {
    const n = cyl === 12 ? 6 : cyl === 8 ? 4 : 3; // cilindros visíveis de lado
    const bx = x + w * 0.12, bw = w * 0.74, by = y + h * 0.42, bh = h * 0.46;
    let heads = "";
    for (let k = 0; k < n; k++) {
      const cw = bw / n;
      heads += `<rect x="${bx + k * cw + cw * 0.1}" y="${y + h * 0.24}" width="${cw * 0.8}" height="${h * 0.2}" rx="${h * 0.04}" class="xr-head"/>`;
    }
    const pr = h * 0.17, px = x + w * 0.07, py = y + h * 0.62;
    const tb = turbo
      ? `<circle cx="${x + w * 0.9}" cy="${y + h * 0.5}" r="${h * 0.15}" class="xr-turbo"/><path d="M${x + w * 0.9} ${y + h * 0.5} m-${h * 0.09} 0 a${h * 0.09} ${h * 0.09} 0 1 1 ${h * 0.09} ${h * 0.09}" class="xr-line"/>`
      : "";
    const g = `
      <ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w * 0.62}" ry="${h * 0.75}" fill="url(#xrGlow)"/>
      <rect x="${x - w * 0.02}" y="${y + h * 0.18}" width="${w * 0.035}" height="${h * 0.72}" rx="2" class="xr-rad"/>
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${h * 0.08}" class="xr-block"/>
      ${heads}
      <rect x="${bx + bw * 0.12}" y="${y + h * 0.04}" width="${bw * 0.72}" height="${h * 0.18}" rx="${h * 0.09}" class="xr-intake"/>
      <circle cx="${px}" cy="${py}" r="${pr}" class="xr-pulley"/>
      <circle cx="${px}" cy="${py}" r="${pr * 0.45}" class="xr-pulley xr-pulley--in"/>
      <path d="M${bx + bw * 0.2} ${by + bh} q ${w * 0.1} ${h * 0.25} ${w * 0.75} ${h * 0.12}" class="xr-pipe"/>
      <path d="M${bx + bw * 0.45} ${by + bh} q ${w * 0.08} ${h * 0.2} ${w * 0.5} ${h * 0.08}" class="xr-pipe"/>
      ${tb}`;
    // motor traseiro (911): espelha horizontalmente para o radiador/polia ficarem do lado certo
    return rear ? `<g transform="translate(${2 * x + w} 0) scale(-1 1)">${g}</g>` : g;
  }

  function cabinSVG([x, y, w, h], { rearSeats }) {
    const P = (u, v) => `${(x + u * w).toFixed(1)} ${(y + v * h).toFixed(1)}`;
    const seat = (o, s) => {
      const Q = (u, v) => P(o + (u - 0.45) * s, 0.15 + (v - 0.15) * (0.55 + s * 0.45));
      return `
      <path d="M${Q(0.3, 0.8)} L${Q(0.58, 0.8)} Q${Q(0.63, 0.88)} ${Q(0.58, 0.93)} L${Q(0.32, 0.93)} Q${Q(0.27, 0.87)} ${Q(0.3, 0.8)}Z" class="xr-seat"/>
      <path d="M${Q(0.55, 0.86)} L${Q(0.6, 0.3)} Q${Q(0.65, 0.24)} ${Q(0.7, 0.3)} L${Q(0.68, 0.88)}Z" class="xr-seat"/>
      <rect x="${(x + (o + (0.6 - 0.45) * s) * w).toFixed(1)}" y="${(y + (0.15 + (0.12 - 0.15) * (0.55 + s * 0.45)) * h).toFixed(1)}" width="${(w * 0.09 * s).toFixed(1)}" height="${(h * 0.12).toFixed(1)}" rx="3" class="xr-seat"/>`;
    };
    return `
      <ellipse cx="${x + w / 2}" cy="${y + h * 0.55}" rx="${w * 0.6}" ry="${h * 0.62}" fill="url(#xrGlowWarm)"/>
      <path d="M${P(0, 0.5)} Q${P(0.12, 0.36)} ${P(0.3, 0.42)} L${P(0.3, 0.56)} Q${P(0.12, 0.6)} ${P(0, 0.66)}Z" class="xr-dash"/>
      <path d="M${P(0.02, 0.5)} Q${P(0.12, 0.4)} ${P(0.29, 0.45)}" class="xr-ambient"/>
      <line x1="${x + w * 0.2}" y1="${y + h * 0.5}" x2="${x + w * 0.29}" y2="${y + h * 0.44}" class="xr-line"/>
      <ellipse cx="${x + w * 0.3}" cy="${y + h * 0.44}" rx="${w * 0.025}" ry="${h * 0.15}" class="xr-wheel"/>
      ${seat(0.45, 1)}
      ${rearSeats ? seat(0.78, 0.8) : ""}
      <line x1="${x + w * 0.05}" y1="${y + h * 0.97}" x2="${x + w * 0.98}" y2="${y + h * 0.97}" class="xr-floor"/>`;
  }

  function xrayFrame(car, i) {
    const { size: [W, H], engine: e, cabin: c } = car.xray;
    const hole = (b, sx, sy) => ({
      cx: pct(b[0] + b[2] / 2, W), cy: pct(b[1] + b[3] / 2, H),
      rx: pct((b[2] / 2) * sx, W), ry: pct((b[3] / 2) * sy, H),
    });
    const he = hole(e, 1.18, 1.45), hc = hole(c, 1.12, 1.25);
    const vars = `--ex:${he.cx};--ey:${he.cy};--erx:${he.rx};--ery:${he.ry};--ix:${hc.cx};--iy:${hc.cy};--irx:${hc.rx};--iry:${hc.ry};--ar:${W / H}`;
    const engineName = car.specs[0][1];
    return `
      <div class="frame" style="${vars}" tabindex="0" role="button" aria-pressed="false"
           aria-label="Ver motor e interior do ${car.brand} ${car.model}">
        <img class="frame__ghost" src="${car.img}" alt="" draggable="false" ${i > 1 ? 'loading="lazy"' : ""}>
        <svg class="frame__xray" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <radialGradient id="xrGlow${i}"><stop offset="0" stop-color="#ff7a1a" stop-opacity=".55"/><stop offset="1" stop-color="#ff7a1a" stop-opacity="0"/></radialGradient>
            <radialGradient id="xrGlowWarm${i}"><stop offset="0" stop-color="#f2b705" stop-opacity=".35"/><stop offset="1" stop-color="#f2b705" stop-opacity="0"/></radialGradient>
          </defs>
          <g class="xr-engine">${engineSVG(e, car.xray).replace(/#xrGlow/g, `#xrGlow${i}`)}</g>
          <g class="xr-cabin">${cabinSVG(c, car.xray).replace(/#xrGlowWarm/g, `#xrGlowWarm${i}`)}</g>
        </svg>
        <img class="frame__body" src="${car.img}" alt="${car.brand} ${car.model}" draggable="false" ${i > 1 ? 'loading="lazy"' : ""}>
        <div class="pin pin--engine" style="left:${he.cx};top:${pct(e[1], H)}"><i></i><span><b>Motor${car.xray.rear ? " traseiro" : ""}</b>${engineName} · ${car.specs[1][1]}</span></div>
        <div class="pin pin--cabin" style="left:${hc.cx};top:${pct(c[1], H)}"><i></i><span><b>Interior</b>${car.interior}</span></div>
      </div>`;
  }

  /* ---------- Montagem ---------- */
  const slots = CARS.map((car, i) => {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.style.setProperty("--a", `${i * STEP}deg`);
    slot.setAttribute("role", "group");
    slot.setAttribute("aria-roledescription", "slide");
    slot.setAttribute("aria-label", `${i + 1} de ${CARS.length}: ${car.brand} ${car.model}`);
    slot.innerHTML = `<div class="car">${xrayFrame(car, i)}</div>`;
    ring.appendChild(slot);
    return slot;
  });

  const dots = CARS.map((car, i) => {
    const b = document.createElement("button");
    b.className = "dot";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-label", `${car.brand} ${car.model}`);
    b.addEventListener("click", () => goTo(i));
    dotsEl.appendChild(b);
    return b;
  });
  dotsEl.style.setProperty("--autoplay", `${AUTOPLAY_MS}ms`);

  /* ---------- Geometria responsiva ---------- */
  function layout() {
    const vw = window.innerWidth;
    const w = Math.min(760, vw * (vw < 600 ? 0.9 : 0.62));
    const h = w * 0.44;
    const r = (w / 2 / Math.tan(Math.PI / CARS.length)) * 1.22;
    const root = document.documentElement.style;
    root.setProperty("--slot-w", `${w}px`);
    root.setProperty("--slot-h", `${h}px`);
    root.setProperty("--radius-ring", `${r}px`);
    // encaixa cada foto no slot mantendo a proporção (as camadas do raio-X usam o mesmo quadro)
    document.querySelectorAll(".frame").forEach((f) => {
      const ar = parseFloat(f.style.getPropertyValue("--ar"));
      const fw = Math.min(w, h * ar);
      f.style.width = `${fw}px`;
      f.style.height = `${fw / ar}px`;
    });
  }
  layout();
  window.addEventListener("resize", layout);

  /* ---------- Estado ---------- */
  let index = 0;
  let angle = 0;       // ângulo acumulado do anel (gira sempre no mesmo sentido)
  let busy = false;
  let timer = null;
  let paused = false;
  let inView = true;

  const mod = (n, m) => ((n % m) + m) % m;

  function paintSlots() {
    slots.forEach((s, i) => {
      const d = Math.min(mod(i - index, CARS.length), mod(index - i, CARS.length));
      s.classList.toggle("is-active", d === 0);
      s.classList.toggle("is-near", d === 1);
      s.setAttribute("aria-hidden", d === 0 ? "false" : "true");
    });
    dots.forEach((d, i) => {
      d.classList.remove("is-active");
      d.setAttribute("aria-selected", i === index ? "true" : "false");
    });
    void dotsEl.offsetWidth; // reinicia a barra de progresso
    dots[index].classList.add("is-active");
  }

  function paintInfo() {
    const c = CARS[index];
    $("#info-brand").textContent = c.brand;
    $("#info-tagline").textContent = c.tagline;
    $("#info-specs").innerHTML = c.specs.map(([k, v]) => `<li>${k} <b>${v}</b></li>`).join("");
    bigname.textContent = c.big;
  }

  /* ---------- Transição ---------- */
  const carEl = (i) => slots[i].querySelector(".car");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function goTo(target, dirHint) {
    target = mod(target, CARS.length);
    if (busy || target === index) return;
    busy = true;
    clearTimeout(timer);

    // menor caminho, a menos que a direção seja forçada (setas / autoplay)
    let steps = mod(target - index, CARS.length);
    if (dirHint === -1 || (dirHint === undefined && steps > CARS.length / 2)) steps -= CARS.length;
    const dir = Math.sign(steps);

    xrPinned = "none"; xrHover = false;
    setXray("none");
    const from = index;
    const oldCar = carEl(from);

    // 1) o carro se mexe -------------------------------------------
    info.classList.add("is-hidden");
    bigname.classList.add("is-out");
    let driveAnim = null;
    if (!reduceMotion) {
      if (dir > 0) stage.classList.add("is-moving");
      const x = dir > 0 ? -14 : 14;
      driveAnim = oldCar.animate(
        [
          { transform: "translateX(0) rotate(0deg)", filter: "blur(0)" },
          { transform: `translateX(${-x * 0.06}%) rotate(${dir * 0.6}deg)`, offset: 0.18 }, // traseira "agacha"
          { transform: `translateX(${x}%) rotate(${-dir * 0.3}deg)`, filter: "blur(1.5px)" },
        ],
        { duration: DRIVE_MS, easing: "cubic-bezier(.55,0,.9,.45)", fill: "forwards" }
      );
      await wait(DRIVE_MS * 0.82);
    }

    // 2) a plataforma gira -----------------------------------------
    index = target;
    angle -= steps * STEP;
    ring.style.transform = `translateZ(calc(var(--radius-ring) * -1)) rotateY(${angle}deg)`;
    disc.style.transform = `rotate(${-angle * 1.5}deg)`;
    paintSlots();

    // devolve o carro antigo à posição de origem, suavemente, enquanto sai de cena
    if (driveAnim) {
      const back = oldCar.animate(
        [{ transform: getComputedStyle(oldCar).transform, filter: "blur(1.5px)" }, { transform: "none", filter: "blur(0)" }],
        { duration: SPIN_MS, easing: "cubic-bezier(.16,1,.3,1)" }
      );
      driveAnim.cancel();
      back.onfinish = () => back.cancel();
    }

    await wait(reduceMotion ? 50 : SPIN_MS * 0.55);

    // 3) o novo carro chega e assenta -------------------------------
    paintInfo();
    bigname.classList.remove("is-out");
    bigname.classList.add("is-in-start");
    void bigname.offsetWidth;
    bigname.classList.remove("is-in-start");
    info.classList.remove("is-hidden");
    stage.classList.remove("is-moving");

    if (!reduceMotion) {
      const s = dir > 0 ? 1 : -1;
      carEl(index).animate(
        [
          { transform: `translateX(${s * 6}%)`, filter: "blur(1px)" },
          { transform: `translateX(${-s * 1.2}%) rotate(${-s * 0.5}deg)`, filter: "blur(0)", offset: 0.55 },
          { transform: `translateX(${s * 0.3}%) rotate(${s * 0.2}deg)`, offset: 0.78 },
          { transform: "translateX(0) rotate(0deg)" },
        ],
        { duration: 900, easing: "cubic-bezier(.16,1,.3,1)" }
      );
      await wait(SPIN_MS * 0.45);
    }

    busy = false;
    schedule();
  }

  /* ---------- Raio-X: estado ---------- */
  const xrMenu = document.querySelectorAll(".xr-menu button");
  let xrPinned = "none"; // escolha feita no menu ou com toque/clique
  let xrHover = false;

  function setXray(mode) {
    const f = slots[index].querySelector(".frame");
    slots.forEach((s) => s.querySelector(".frame").classList.remove("xr-engine", "xr-cabin"));
    const m = busy ? "none" : mode;
    f.classList.toggle("xr-engine", m === "both" || m === "engine");
    f.classList.toggle("xr-cabin", m === "both" || m === "cabin");
    f.setAttribute("aria-pressed", String(m !== "none"));
    xrMenu.forEach((b) => b.classList.toggle("is-active", b.dataset.view === (m === "none" ? "overview" : m === "both" ? "overview" : m)));
    stage.classList.toggle("is-xray", m !== "none");
  }
  const refreshXray = () => setXray(xrPinned !== "none" ? xrPinned : xrHover ? "both" : "none");

  ring.addEventListener("mouseover", (e) => {
    if (e.target.closest(".slot.is-active .frame") && !xrHover) { xrHover = true; refreshXray(); }
  });
  ring.addEventListener("mouseout", (e) => {
    const f = e.target.closest(".frame");
    if (f && !f.contains(e.relatedTarget)) { xrHover = false; refreshXray(); }
  });
  ring.addEventListener("focusin", (e) => { if (e.target.closest(".slot.is-active .frame")) { xrHover = true; refreshXray(); } });
  ring.addEventListener("focusout", () => { xrHover = false; refreshXray(); });
  ring.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.closest(".frame")) {
      e.preventDefault();
      xrPinned = xrPinned === "none" ? "both" : "none";
      refreshXray(); schedule();
    }
  });
  xrMenu.forEach((b) => b.addEventListener("click", () => {
    const v = b.dataset.view;
    xrPinned = v === "overview" ? "none" : xrPinned === v ? "none" : v;
    refreshXray(); schedule();
  }));

  const next = () => goTo(index + 1, 1);
  const prev = () => goTo(index - 1, -1);

  /* ---------- Autoplay ---------- */
  function schedule() {
    clearTimeout(timer);
    const stop = paused || !inView || document.hidden || xrPinned !== "none";
    dotsEl.classList.toggle("is-paused", stop);
    if (!stop) timer = setTimeout(next, AUTOPLAY_MS);
  }
  function setPaused(p) {
    paused = p;
    if (!busy) {
      // reinicia a contagem do zero ao retomar
      if (!p) paintSlots();
      schedule();
    }
  }

  stage.addEventListener("mouseenter", () => setPaused(true));
  stage.addEventListener("mouseleave", () => setPaused(false));
  document.addEventListener("visibilitychange", () => !busy && schedule());
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (!busy) schedule(); }, { threshold: 0.3 }).observe(stage);

  $("#next").addEventListener("click", next);
  $("#prev").addEventListener("click", prev);
  document.addEventListener("keydown", (e) => {
    if (!inView || /input|select|textarea/i.test(e.target.tagName)) return;
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  });

  // gesto de arrastar (touch / mouse)
  let startX = null;
  stage.addEventListener("pointerdown", (e) => { if (!e.target.closest(".arrow")) startX = e.clientX; });
  window.addEventListener("pointerup", (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 50) return (dx < 0 ? next : prev)();
    if (Math.abs(dx) < 8 && e.pointerType !== "mouse" && e.target.closest && e.target.closest(".slot.is-active .frame")) {
      xrPinned = xrPinned === "none" ? "both" : "none";
      refreshXray(); schedule();
    }
  });

  paintSlots();
  paintInfo();
  schedule();

  /* =========================================================
     Diferenciais (abas)
     ========================================================= */
  const FEATURES = {
    curadoria: [
      { cls: "card--dark", num: "160", title: "Pontos de inspeção", text: "Cada carro passa por laudo cautelar, histórico de manutenção e vistoria técnica antes de entrar no showroom." },
      { cls: "", img: "assets/cars/porsche-gt3.webp", title: "Procedência garantida", text: "Somente veículos com documentação limpa, revisões em concessionária e baixa quilometragem." },
      { cls: "card--accent", num: "12m", title: "Garantia Kling Car", text: "Cobertura de motor e câmbio por 12 meses em todo o estoque de seminovos." },
    ],
    performance: [
      { cls: "", img: "assets/cars/ferrari-purosangue.webp", title: "Até 725 cv", text: "De GTs V12 a esportivos de pista: potência para quem não aceita meio-termo." },
      { cls: "card--dark", num: "3,3s", title: "De 0 a 100 km/h", text: "Acelerações de supercarro com o conforto de uso diário que você espera." },
      { cls: "card--accent", num: "Pista", title: "Track days exclusivos", text: "Clientes Kling Car participam de eventos em autódromo com instrutores profissionais." },
    ],
    experiencia: [
      { cls: "card--accent", num: "1h", title: "Resposta do consultor", text: "Atendimento dedicado do primeiro contato à entrega — inclusive pelo WhatsApp." },
      { cls: "", img: "assets/cars/mercedes-g63.webp", title: "Entrega na sua casa", text: "Levamos o carro para test drive e entrega com motorista e transporte fechado." },
      { cls: "card--dark", num: "24h", title: "Crédito aprovado", text: "Financiamento, leasing e aceitação do seu usado na troca, com avaliação no mesmo dia." },
    ],
  };
  const cardsEl = $("#feature-cards");
  function renderFeatures(key) {
    cardsEl.innerHTML = FEATURES[key].map((f) => `
      <article class="card ${f.cls}">
        ${f.img ? `<img class="card__img" src="${f.img}" alt="" loading="lazy">` : `<div class="card__num">${f.num}</div>`}
        <h3>${f.title}</h3>
        <p>${f.text}</p>
      </article>`).join("");
  }
  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => {
        x.classList.toggle("is-active", x === t);
        x.setAttribute("aria-selected", x === t ? "true" : "false");
      });
      renderFeatures(t.dataset.tab);
    });
  });
  renderFeatures("performance");

  /* =========================================================
     Estoque
     ========================================================= */
  const grid = $("#grid");
  grid.innerHTML = CARS.map((c) => `
    <article class="tile">
      <div class="tile__img"><img src="${c.img}" alt="${c.brand} ${c.model}" loading="lazy"></div>
      <span class="tile__brand">${c.brand}</span>
      <h3 class="tile__name">${c.model}</h3>
      <span class="tile__meta">${c.body} · ${c.year} · ${c.specs[1][1]}</span>
      <div class="tile__foot">
        <span class="tile__tag">Sob consulta</span>
        <a class="tile__link" href="#contato" data-model="${c.brand} ${c.model}">Tenho interesse →</a>
      </div>
    </article>`).join("");

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const i = [...grid.children].indexOf(e.target);
      setTimeout(() => e.target.classList.add("is-visible"), (i % 3) * 90);
      io.unobserve(e.target);
    });
  }, { threshold: 0.15 });
  [...grid.children].forEach((t) => io.observe(t));

  /* =========================================================
     Contadores
     ========================================================= */
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const end = +el.dataset.count;
      const suffix = el.dataset.suffix || "";
      const t0 = performance.now();
      const dur = reduceMotion ? 1 : 1400;
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const v = Math.round(end * (1 - Math.pow(1 - p, 3)));
        el.textContent = v.toLocaleString("pt-BR") + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      countIO.unobserve(el);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll("[data-count]").forEach((el) => countIO.observe(el));

  /* =========================================================
     Formulário
     ========================================================= */
  const select = $("#form-model");
  select.innerHTML = CARS.map((c) => `<option>${c.brand} ${c.model}</option>`).join("");
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-model]");
    if (link) select.value = link.dataset.model;
  });
  $("#form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    let ok = true;
    form.querySelectorAll("input[required]").forEach((inp) => {
      const bad = !inp.value.trim();
      inp.classList.toggle("is-invalid", bad);
      if (bad) ok = false;
    });
    const msg = $("#form-msg");
    if (!ok) { msg.textContent = "Preencha nome e telefone para continuarmos."; return; }
    msg.textContent = `Obrigado, ${form.nome.value.trim().split(" ")[0]}! Um consultor entrará em contato sobre o ${select.value}.`;
    form.reset();
  });

  /* =========================================================
     Header / menu
     ========================================================= */
  const header = $(".header");
  window.addEventListener("scroll", () => header.classList.toggle("is-scrolled", window.scrollY > 10), { passive: true });

  const menuBtn = $(".menu-btn");
  const menu = $("#mobile-menu");
  const toggleMenu = (open) => {
    menuBtn.setAttribute("aria-expanded", String(open));
    menu.hidden = !open;
    document.body.style.overflow = open ? "hidden" : "";
  };
  menuBtn.addEventListener("click", () => toggleMenu(menu.hidden));
  menu.addEventListener("click", (e) => e.target.closest("a") && toggleMenu(false));

  $("#year").textContent = new Date().getFullYear();
})();
