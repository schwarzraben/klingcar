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
      tagline: "Grand tourer V12 com alma britânica.",
      specs: [["Motor", "V12 5.9"], ["Potência", "576 cv"], ["0–100", "3,6 s"], ["Máx.", "323 km/h"]],
      body: "Cupê GT", year: "2024",
    },
    {
      id: "bmw-m4", brand: "BMW M", model: "M4 Competition", big: "M4",
      img: "assets/cars/bmw-m4.webp",
      tagline: "Precisão de pista para o dia a dia.",
      specs: [["Motor", "6 cil. 3.0 biturbo"], ["Potência", "510 cv"], ["0–100", "3,9 s"], ["Máx.", "290 km/h"]],
      body: "Cupê esportivo", year: "2025",
    },
    {
      id: "ferrari-purosangue", brand: "Ferrari", model: "Purosangue", big: "PUROSANGUE",
      img: "assets/cars/ferrari-purosangue.webp",
      tagline: "Quatro portas, quatro lugares, um V12 aspirado.",
      specs: [["Motor", "V12 6.5"], ["Potência", "725 cv"], ["0–100", "3,3 s"], ["Máx.", "310 km/h"]],
      body: "FUV 4 lugares", year: "2025",
    },
    {
      id: "mercedes-g63", brand: "Mercedes-AMG", model: "G 63", big: "G 63",
      img: "assets/cars/mercedes-g63.webp",
      tagline: "O ícone off-road com força AMG.",
      specs: [["Motor", "V8 4.0 biturbo"], ["Potência", "585 cv"], ["0–100", "4,5 s"], ["Tração", "4MATIC"]],
      body: "SUV", year: "2024",
    },
    {
      id: "lamborghini-urus", brand: "Lamborghini", model: "Urus", big: "URUS",
      img: "assets/cars/lamborghini-urus.webp",
      tagline: "O primeiro Super SUV do mundo.",
      specs: [["Motor", "V8 4.0 biturbo"], ["Potência", "650 cv"], ["0–100", "3,6 s"], ["Máx.", "305 km/h"]],
      body: "Super SUV", year: "2024",
    },
    {
      id: "porsche-gt3", brand: "Porsche", model: "911 GT3", big: "GT3",
      img: "assets/cars/porsche-gt3.webp",
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

  /* ---------- Montagem ---------- */
  const slots = CARS.map((car, i) => {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.style.setProperty("--a", `${i * STEP}deg`);
    slot.setAttribute("role", "group");
    slot.setAttribute("aria-roledescription", "slide");
    slot.setAttribute("aria-label", `${i + 1} de ${CARS.length}: ${car.brand} ${car.model}`);
    slot.innerHTML = `<div class="car"><img src="${car.img}" alt="${car.brand} ${car.model}" ${i > 1 ? 'loading="lazy"' : ""} draggable="false"></div>`;
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

  const next = () => goTo(index + 1, 1);
  const prev = () => goTo(index - 1, -1);

  /* ---------- Autoplay ---------- */
  function schedule() {
    clearTimeout(timer);
    const stop = paused || !inView || document.hidden;
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
    if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
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
