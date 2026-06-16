(function () {
  "use strict";

  // ── Config ────────────────────────────────────────────────────────────────
  const params      = new URLSearchParams(location.search);
  const sessionId   = params.get("sessionId");
  const storageKey  = sessionId ? `sapl-pauta-state-${sessionId}` : null;
  const TRANSITION  = 380;
  const QR_API      = "https://api.qrserver.com/v1/create-qr-code/?margin=1&size=200x200&data=";

  // ── State ─────────────────────────────────────────────────────────────────
  let items        = [];
  let expCount     = 0;   // qtd de matérias do Expediente
  let ordCount     = 0;   // qtd de matérias da Ordem do Dia
  let sessao       = { titulo: "", data: "", hora: "" };
  let pautaPageUrl = "";
  let pdfUrl       = null;
  let currentIdx   = -2;
  let paused       = false;
  let intervalMs   = 12000;
  let progressStart  = 0;
  let elapsedAtPause = 0;
  let advanceTimer   = null;

  // ── DOM ───────────────────────────────────────────────────────────────────
  const slideArea    = document.getElementById("slide-area");
  const slideContent = document.getElementById("slide-content");
  const progressFill = document.getElementById("progress-fill");
  const counterEl    = document.getElementById("counter");
  const sessaoInfoEl = document.getElementById("sessao-info");
  const clockEl      = document.getElementById("clock");
  const btnPrev      = document.getElementById("btn-prev");
  const btnPP        = document.getElementById("btn-pp");
  const btnNext      = document.getElementById("btn-next");
  const btnFs        = document.getElementById("btn-fs");
  const speedSelect  = document.getElementById("speed-select");

  // ── Utilitários ───────────────────────────────────────────────────────────
  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function periodClass(p) {
    const s = (p || "").toLowerCase();
    if (s.includes("expediente")) return "card-exp";
    if (s.includes("ordem"))      return "card-ord";
    return "";
  }

  function periodLabel(p) {
    const s = (p || "").toLowerCase();
    if (s.includes("expediente")) return "Expediente";
    if (s.includes("ordem"))      return "Ordem do Dia";
    return p || "Matéria";
  }

  function setAccent(periodo) {
    const root = document.documentElement;
    const isOrd = (periodo || "").toLowerCase().includes("ordem");
    if (isOrd) {
      root.style.setProperty("--accent",      "var(--ord)");
      root.style.setProperty("--accent-glow", "var(--ord-glow)");
      root.style.setProperty("--accent-text", "var(--ord-text)");
    } else {
      root.style.setProperty("--accent",      "var(--exp)");
      root.style.setProperty("--accent-glow", "var(--exp-glow)");
      root.style.setProperty("--accent-text", "var(--exp-text)");
    }
  }

  // ── QR Code Panel ─────────────────────────────────────────────────────────
  function renderQRPanel() {
    const existing = document.getElementById("qr-panel");
    if (existing) existing.remove();
    if (!pautaPageUrl) return;

    const panel = document.createElement("div");
    panel.id        = "qr-panel";
    panel.className = "qr-panel";

    panel.innerHTML = `
      <div class="qr-card">
        <img class="qr-img"
             src="${QR_API}${encodeURIComponent(pautaPageUrl)}"
             alt="QR Pauta online"
             loading="lazy">
        <span class="qr-lbl">Ver pauta online</span>
      </div>
      ${pdfUrl ? `
      <div class="qr-card">
        <img class="qr-img"
             src="${QR_API}${encodeURIComponent(pdfUrl)}"
             alt="QR PDF da pauta"
             loading="lazy">
        <span class="qr-lbl">Ver Pauta<br>Versão PDF</span>
      </div>` : ""}
    `;

    slideArea.appendChild(panel);
  }

  // ── Templates HTML ────────────────────────────────────────────────────────
  function buildCoverHTML() {
    const expCount = items.filter(i => (i.periodo || "").toLowerCase().includes("expediente")).length;
    const ordCount = items.filter(i => (i.periodo || "").toLowerCase().includes("ordem")).length;

    return `
      <div class="cover-wrap slide-entering">
        <div class="cover-eyebrow">Câmara Municipal de Itabirito</div>
        <div class="cover-title">Pauta da Sessão</div>
        ${sessao.titulo ? `<div class="cover-sub">${esc(sessao.titulo)}</div>` : ""}
        ${sessao.data   ? `<div class="cover-date">${esc(sessao.data)}${sessao.hora ? " · " + esc(sessao.hora) : ""}</div>` : ""}
        <div class="cover-stats">
          <div class="stat-blk">
            <span class="stat-n">${items.length}</span>
            <span class="stat-l">Matérias</span>
          </div>
          ${expCount > 0 ? `
          <div class="stat-blk">
            <span class="stat-n" style="color:var(--exp-text)">${expCount}</span>
            <span class="stat-l">Expediente</span>
          </div>` : ""}
          ${ordCount > 0 ? `
          <div class="stat-blk">
            <span class="stat-n" style="color:var(--ord-text)">${ordCount}</span>
            <span class="stat-l">Ordem do Dia</span>
          </div>` : ""}
        </div>
      </div>
    `;
  }

  function buildItemHTML(item) {
    const pCls = periodClass(item.periodo);
    const pLbl = periodLabel(item.periodo);

    return `
      <div class="item-wrap ${pCls} slide-entering">
        <div class="card-head">
          <span class="period-badge">${esc(pLbl)}</span>
        </div>
        <h1 class="slide-titulo">${esc(item.titulo || "")}</h1>
        <div class="slide-meta">
          <div class="meta-row">
            <span class="meta-lbl">Autor</span>
            <span class="meta-val">${esc(item.autor || "—")}</span>
          </div>
        </div>
        <div class="ementa-wrap">
          <span class="ementa-lbl">Ementa</span>
          <p class="ementa-text">${esc(item.ementa || "")}</p>
        </div>
      </div>
    `;
  }

  // ── Contador e sessão info ────────────────────────────────────────────────
  function updateCounter() {
    if (!counterEl) return;

    if (currentIdx < 0) {
      // Capa: mostra totais de cada período como links clicáveis
      const parts = [];
      if (expCount > 0)
        parts.push(`<span class="counter-part" data-goto="0">${expCount} Expediente</span>`);
      if (ordCount > 0)
        parts.push(`<span class="counter-part" data-goto="${expCount}">${ordCount} Ordem do Dia</span>`);
      counterEl.innerHTML = parts.length > 0
        ? `Capa  ·  ${parts.join("  ·  ")}`
        : "Carregando…";
      return;
    }

    const item  = items[currentIdx];
    const isExp = (item?.periodo || "").toLowerCase().includes("expediente");

    // Posição dentro do grupo (itens já ordenados: expediente primeiro)
    const posExp = currentIdx + 1;
    const posOrd = currentIdx - expCount + 1;

    const parts = [];
    if (expCount > 0) {
      const lbl = isExp ? `${posExp}/${expCount} Expediente` : `${expCount} Expediente`;
      parts.push(`<span class="counter-part" data-goto="0">${lbl}</span>`);
    }
    if (ordCount > 0) {
      const lbl = !isExp ? `${posOrd}/${ordCount} Ordem do Dia` : `${ordCount} Ordem do Dia`;
      parts.push(`<span class="counter-part" data-goto="${expCount}">${lbl}</span>`);
    }

    counterEl.innerHTML = parts.join("  ·  ");
  }

  function updateSessaoInfo() {
    if (!sessaoInfoEl) return;
    const parts = [sessao.titulo, sessao.data].filter(Boolean);
    sessaoInfoEl.textContent = parts.join(" · ") || "Pauta da Sessão";
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function doRender() {
    if (currentIdx === -1 || items.length === 0) {
      slideContent.innerHTML = buildCoverHTML();
      setAccent(null);
    } else {
      const item = items[currentIdx];
      slideContent.innerHTML = buildItemHTML(item);
      setAccent(item?.periodo);
    }
    updateCounter();
  }

  function renderSlide(animate) {
    if (!animate) { doRender(); return; }

    const current = slideContent.firstElementChild;
    if (current) {
      current.classList.remove("slide-entering");
      current.classList.add("slide-leaving");
      setTimeout(doRender, TRANSITION * 0.75);
    } else {
      doRender();
    }
  }

  // ── Navegação ─────────────────────────────────────────────────────────────
  function normalizeIndex(idx) {
    if (idx < -1) return items.length - 1;
    if (idx >= items.length) return -1;
    return idx;
  }

  function goTo(idx, animate = true) {
    if (items.length === 0) return;
    currentIdx = normalizeIndex(idx);
    renderSlide(animate);
    resetProgress();
  }

  const next = () => goTo(currentIdx + 1);
  const prev = () => goTo(currentIdx - 1);

  // ── Progresso & timer ─────────────────────────────────────────────────────
  function startProgressBar(duration) {
    if (!progressFill) return;
    progressFill.style.transition = "none";
    progressFill.style.width = "0%";
    void progressFill.offsetWidth;
    progressFill.style.transition = `width ${duration}ms linear`;
    progressFill.style.width = "100%";
  }

  function freezeProgressBar() {
    if (!progressFill) return;
    const pct = Math.min(100, (elapsedAtPause / intervalMs) * 100);
    progressFill.style.transition = "none";
    progressFill.style.width = `${pct}%`;
  }

  function resetProgress() {
    clearTimeout(advanceTimer);
    progressStart  = Date.now();
    elapsedAtPause = 0;
    if (!paused) {
      startProgressBar(intervalMs);
      advanceTimer = setTimeout(next, intervalMs);
    } else {
      freezeProgressBar();
    }
  }

  function pauseProgress() {
    clearTimeout(advanceTimer);
    elapsedAtPause = Date.now() - progressStart;
    freezeProgressBar();
  }

  function resumeProgress() {
    const remaining = Math.max(500, intervalMs - elapsedAtPause);
    progressStart = Date.now() - elapsedAtPause;
    startProgressBar(remaining);
    clearTimeout(advanceTimer);
    advanceTimer = setTimeout(next, remaining);
  }

  // ── Pausar / Retomar ──────────────────────────────────────────────────────
  function togglePause() {
    paused = !paused;
    if (btnPP) {
      btnPP.innerHTML = paused ? "&#9654;" : "&#9646;&#9646;";
      btnPP.title     = paused ? "Retomar (Espaço)" : "Pausar (Espaço)";
      btnPP.classList.toggle("is-paused", paused);
    }
    if (paused) pauseProgress();
    else        resumeProgress();
  }

  // ── Tela cheia ────────────────────────────────────────────────────────────
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  // ── Relógio ───────────────────────────────────────────────────────────────
  function tickClock() {
    if (clockEl) {
      clockEl.textContent = new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      });
    }
  }

  // ── Dados ─────────────────────────────────────────────────────────────────
  function applyData(state) {
    if (!state || !Array.isArray(state.items)) return false;
    sessao       = { titulo: state.titulo || "", data: state.data || "", hora: state.hora || "" };
    pautaPageUrl = state.pautaPageUrl || "";
    pdfUrl       = state.pdfUrl || null;
    items        = state.items;
    expCount     = items.filter(i => (i.periodo || "").toLowerCase().includes("expediente")).length;
    ordCount     = items.length - expCount;
    updateSessaoInfo();
    renderQRPanel();   // ← reconstrói o painel de QR com as URLs recebidas
    return true;
  }

  function startSlideshow() {
    currentIdx = -1;
    renderSlide(false);
    resetProgress();
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  async function bootstrap() {
    document.addEventListener("keydown", (e) => {
      if (e.target?.tagName === "SELECT") return;
      switch (e.key) {
        case "ArrowLeft":  prev(); break;
        case "ArrowRight": next(); break;
        case " ": e.preventDefault(); togglePause(); break;
        case "f": case "F": toggleFullscreen(); break;
      }
    });

    btnPrev?.addEventListener("click", prev);
    btnNext?.addEventListener("click", next);
    btnPP?.addEventListener("click",   togglePause);
    btnFs?.addEventListener("click",   toggleFullscreen);

    // Clique nos segmentos do contador (Expediente / Ordem do Dia) → salta para a seção
    counterEl?.addEventListener("click", (e) => {
      const part = e.target.closest(".counter-part");
      if (!part) return;
      const idx = parseInt(part.dataset.goto, 10);
      if (!isNaN(idx) && idx >= 0 && idx < items.length) goTo(idx);
    });

    speedSelect?.addEventListener("change", () => {
      intervalMs = parseInt(speedSelect.value, 10) || 12000;
      resetProgress();
    });

    setInterval(tickClock, 1000);
    tickClock();

    if (!storageKey) {
      slideContent.innerHTML = `
        <div class="msg-screen">
          <div class="msg-title" style="color:#ef4444">Sessão não informada</div>
          <div class="msg-sub">Abra esta página a partir do painel do SAPL</div>
        </div>`;
      return;
    }

    try {
      const stored = await chrome.storage.local.get(storageKey);
      if (stored[storageKey] && applyData(stored[storageKey])) {
        startSlideshow();
      }
    } catch (err) {
      console.error("[SAPL pauta display] erro ao ler storage:", err);
    }

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[storageKey]?.newValue) return;
      const wasEmpty = items.length === 0;
      applyData(changes[storageKey].newValue);
      if (wasEmpty && items.length > 0) startSlideshow();
      else if (currentIdx === -1) renderSlide(false);
    });
  }

  bootstrap().catch((err) => {
    console.error("[SAPL pauta] bootstrap falhou:", err);
    if (slideContent) {
      slideContent.innerHTML = `
        <div class="msg-screen">
          <div class="msg-title" style="color:#ef4444">Erro ao iniciar</div>
          <div class="msg-sub">${esc(err?.message || String(err))}</div>
        </div>`;
    }
  });
})();
