# SAPL Pauta – Telão

Extensão Chrome/Edge que abre automaticamente um slideshow com as matérias da pauta da sessão plenária, ideal para exibição no **telão do plenário** antes ou durante a sessão.

---

## O que aparece em cada slide

Cada matéria ocupa a tela inteira mostrando:

- **Período** — "Expediente" (azul) ou "Ordem do Dia" (dourado) — clicável para saltar para a seção
- **Título** — ex: *Projeto de Lei Ordinária nº XXX de 2026*
- **Autor** — ex: *Vereador*
- **Ementa** — texto descritivo da matéria

O slide da **capa** aparece antes das matérias e mostra o título da sessão, a data e os totais por período.

Dois QR codes aparecem no canto inferior direito (quando disponíveis):
- **Ver pauta online** — link direto para a lista de matérias no SAPL
- **Ver pauta versão PDF** — link para o PDF da pauta (aparece apenas se já publicado)

---

## Como instalar no Chrome ou Edge

1. Abra `chrome://extensions` (Chrome) ou `edge://extensions` (Edge)
2. Ative **Modo do desenvolvedor**
3. Clique em **Carregar sem compactação**
4. Selecione a pasta desta extensão

---

## Como usar

1. Faça login no SAPL
2. Acesse o painel eletrônico da sessão: `/painel-principal/{ID}`
3. A extensão abre automaticamente o slideshow em nova janela
4. Coloque essa janela no telão em modo tela cheia (tecla **F**)

---

## Controles

| Ação | Teclado | Botão |
|------|---------|-------|
| Próximo slide | `→` | ▶ |
| Slide anterior | `←` | ◀ |
| Pausar / Retomar | `Espaço` | ⏸ |
| Tela cheia | `F` | ⛶ |
| Saltar para Expediente | — | clica no contador |
| Saltar para Ordem do Dia | — | clica no contador |

O seletor **Intervalo** no rodapé ajusta o tempo por slide (6 s a 30 s, padrão 12 s).

---

## Adaptar para outra Câmara

### Passo 1 — Alterar o domínio no manifest.json

Abra `manifest.json` e substitua `sapl.suacidade.uf.leg.br` pelo domínio do seu SAPL em **dois lugares**:

```json
"host_permissions": [
  "https://sapl.suacamara.uf.leg.br/*"
],
"content_scripts": [
  {
    "matches": [
      "https://sapl.suacamara.uf.leg.br/painel-principal/*"
    ]
  }
]
```

### Passo 2 — Alterar o nome da Câmara no display-pauta.html

Procure esta linha e substitua pelo nome da sua Câmara:

```html
<!-- PERSONALIZE: altere o nome da sua Câmara aqui -->
<div class="camara-nome" id="camara-nome">CÂMARA MUNICIPAL DE ITABIRITO</div>
```

### Passo 3 — Alterar as cores institucionais no display-pauta.html

No início do arquivo, encontre o bloco marcado com `PERSONALIZAÇÃO` e ajuste as variáveis:

```css
/* --- Cor do EXPEDIENTE ------------------------------------------- */
--exp:        #3b82f6;   /* ← cor primária da sua instituição        */
--exp-text:   #93c5fd;   /* ← versão clara da cor (texto do badge)   */

/* --- Cor da ORDEM DO DIA ----------------------------------------- */
--ord:        #f59e0b;   /* ← cor secundária da sua instituição      */
--ord-text:   #fcd34d;   /* ← versão clara (texto do badge)          */
```

Para o **tema claro** (sapl-pauta-telaon-claro), os mesmos campos existem mas a paleta de fundo é diferente. As instruções são idênticas.

### Passo 4 — Personalizar o banner de aviso (LGPD ou outro)

O banner azul no rodapé exibe o aviso de gravação/transmissão. Para personalizá-lo, abra `display-pauta.html`:

**Alterar a cor** — localize `.lgpd-banner` no CSS e troque o valor de `background`:
```css
background: #1059c1;  /* ← coloque aqui a cor da sua instituição */
```

**Alterar o texto** — localize o bloco `<!-- BANNER DE AVISO -->` no HTML e edite o conteúdo do `<p>`:
```html
<p class="lgpd-text">Seu texto aqui.</p>
```

**Remover o banner** — apague o bloco `<div class="lgpd-banner">...</div>` no HTML e os blocos CSS `.lgpd-banner`, `.lgpd-logo` e `.lgpd-text`.

### Passo 5 — Substituir o logo (opcional)

Substitua o arquivo `logo.png` pelo brasão da sua Câmara. Recomendado: fundo transparente ou preto, formato PNG, pelo menos 200×200 px.

### Passo 5 — Recarregar a extensão

Após qualquer alteração: `chrome://extensions` → botão **Recarregar** na extensão.

---

## Arquivos

| Arquivo | O que faz |
|---------|-----------|
| `manifest.json` | Define permissões e em qual domínio a extensão roda — **alterar o domínio aqui** |
| `content.js` | Detecta o painel, busca a pauta e grava no storage — não precisa alterar |
| `background.js` | Abre a janela do slideshow — não precisa alterar |
| `display-pauta.html` | Layout visual — **alterar nome da Câmara e cores aqui** |
| `display-pauta.js` | Lógica do slideshow — não precisa alterar |
| `logo.png` | Brasão exibido no banner LGPD — substituir pelo da sua Câmara |

---

## Créditos

Desenvolvido para a **Câmara Municipal de Itabirito – MG**
com assistência de [Claude](https://claude.ai) (Anthropic).

Compartilhado livremente para uso e adaptação por outras Câmaras Municipais.
Nenhuma atribuição obrigatória — fique à vontade para adaptar.
