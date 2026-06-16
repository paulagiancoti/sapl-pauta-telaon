/**
 * content.js — SAPL Pauta Telão
 *
 * Roda automaticamente quando o operador abre a página do painel eletrônico
 * (/painel-principal/{id}) no SAPL. Busca os dados da sessão e da pauta via
 * API, grava no chrome.storage.local e abre a janela do slideshow (display-pauta.html).
 *
 * NENHUMA alteração é necessária aqui para adaptar a outra Câmara —
 * o domínio é lido automaticamente de location.origin.
 * Ajuste o domínio apenas no manifest.json.
 */
(function () {
  "use strict";

  // Detecta o ID da sessão na URL /painel-principal/{id}
  const m = location.pathname.match(/\/painel-principal\/([^/]+)\b/);
  if (!m) return;

  const sessionId  = m[1];
  const storageKey = `sapl-pauta-state-${sessionId}`;

  // ── Lê informações da sessão direto do DOM do painel ─────────────────────
  function readSessionInfoFromDOM() {
    function text(id) {
      const el = document.getElementById(id);
      if (!el) return "";
      return ("value" in el ? el.value : el.textContent || "").trim();
    }
    return {
      titulo: text("sessao_plenaria") ||
              (document.querySelector(".page-header h1")?.textContent || "").trim() ||
              document.title.trim() ||
              `Sessão nº ${sessionId}`,
      data: text("sessao_plenaria_data"),
      hora: text("sessao_plenaria_hora_inicio")
    };
  }

  // ── Busca a lista de matérias da pauta via API ────────────────────────────
  async function fetchPauta() {
    const url = `${location.origin}/sessao/pauta-sessao/${sessionId}/?format=json`;
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    const data = await res.json();
    if (!Array.isArray(data?.results)) throw new Error("Formato inesperado da API");
    return data;
  }

  // ── Busca a URL do PDF da pauta (campo upload_pauta) ─────────────────────
  // Tenta múltiplas URLs da API em ordem de prioridade.
  async function fetchPdfUrl() {
    const candidates = [
      `${location.origin}/api/sessao/sessaoplenaria/${sessionId}/`,
      `${location.origin}/api/sessao/sessaoplenaria/${sessionId}/?format=json`,
      `${location.origin}/sessao/${sessionId}/?format=json`,
      `${location.origin}/sessao/${sessionId}?format=json`,
    ];

    for (const url of candidates) {
      try {
        console.info(`[SAPL pauta] tentando PDF via: ${url}`);
        const res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) {
          console.warn(`[SAPL pauta] ${url} → HTTP ${res.status}`);
          continue;
        }
        const data = await res.json();
        const pdf  = data?.upload_pauta || null;
        console.info(`[SAPL pauta] upload_pauta: ${pdf}`);
        if (pdf) return pdf;
      } catch (err) {
        console.warn(`[SAPL pauta] falha em ${url}:`, err.message);
      }
    }

    console.warn("[SAPL pauta] PDF não encontrado.");
    return null;
  }

  // ── Inicializa e grava estado no storage ──────────────────────────────────
  async function init() {
    try {
      const [pauta, info, pdfUrl] = await Promise.all([
        fetchPauta(),
        Promise.resolve(readSessionInfoFromDOM()),
        fetchPdfUrl()
      ]);

      const state = {
        sessionId,
        origin:       location.origin,
        // URL da pauta online (sempre acessível)
        pautaPageUrl: `${location.origin}/sessao/pauta-sessao/${sessionId}/`,
        // URL do PDF (null se ainda não publicado)
        pdfUrl,
        titulo: info.titulo,
        data:   info.data,
        hora:   info.hora,
        // Matérias ordenadas: Expediente primeiro, depois Ordem do Dia
        items: [
          ...pauta.results.filter(i => (i.periodo || "").toLowerCase().includes("expediente")),
          ...pauta.results.filter(i => !((i.periodo || "").toLowerCase().includes("expediente")))
        ],
        fetchedAt: Date.now()
      };

      await chrome.storage.local.set({ [storageKey]: state });
      chrome.runtime.sendMessage({ type: "sapl-open-pauta-display", sessionId }).catch(() => {});

    } catch (err) {
      console.error("[SAPL pauta] erro ao inicializar:", err);
    }
  }

  init();
})();
