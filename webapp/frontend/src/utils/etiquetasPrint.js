// Geração da folha de etiquetas para impressão (A4, 2 colunas x 10 linhas).
// Todas as medidas são absolutas em mm a partir da borda da folha, com
// @page margin 0, para que a posição impressa não dependa das margens do
// diálogo de impressão nem da área não imprimível da impressora.

export const FOLHA_LARGURA = 210;
export const FOLHA_ALTURA = 297;
export const COLUNAS = 2;
export const LINHAS = 10;
export const POR_PAGINA = COLUNAS * LINHAS;

export const LAYOUT_PADRAO = {
  largura: 99,
  altura: 26.5,
  espacoColunas: 4,
  espacoLinhas: 1,
  margemEsquerda: 4,
  margemSuperior: 11.5,
  recuoTexto: 4
};

export const LAYOUT_STORAGE_KEY = "unacob_etiquetas_layout";

export function carregarLayout() {
  try {
    const salvo = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) || "null");
    if (salvo && typeof salvo === "object") {
      return { ...LAYOUT_PADRAO, ...salvo };
    }
  } catch {
    // ignora storage indisponível ou inválido
  }
  return { ...LAYOUT_PADRAO };
}

export function salvarLayout(layout) {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignora storage indisponível
  }
}

// Margens que deixam o bloco de etiquetas centralizado na folha.
export function centralizarLayout(layout) {
  const larguraTotal = COLUNAS * layout.largura + (COLUNAS - 1) * layout.espacoColunas;
  const alturaTotal = LINHAS * layout.altura + (LINHAS - 1) * layout.espacoLinhas;
  return {
    ...layout,
    margemEsquerda: arredondar((FOLHA_LARGURA - larguraTotal) / 2),
    margemSuperior: arredondar((FOLHA_ALTURA - alturaTotal) / 2)
  };
}

function arredondar(v) {
  return Math.round(v * 10) / 10;
}

function esc(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function etiquetaHtml(m, pos, layout) {
  const col = pos % COLUNAS;
  const lin = Math.floor(pos / COLUNAS);
  const left = layout.margemEsquerda + col * (layout.largura + layout.espacoColunas);
  const top = layout.margemSuperior + lin * (layout.altura + layout.espacoLinhas);
  const endNum = [m.endereco, m.numero].filter(Boolean).join(", ") + (m.complemento ? ` - ${m.complemento}` : "");
  const linha4 = [m.cep, `${m.cidade || "Bauru"}/${m.estado || "SP"}`].filter(Boolean).join(" - ");

  return `
    <div class="etiqueta" style="left:${left}mm;top:${top}mm;">
      <strong>${esc(m.nome_completo)}</strong>
      <div class="etiqueta-linha">${esc(endNum) || "&nbsp;"}</div>
      <div class="etiqueta-linha">${esc(m.bairro) || "&nbsp;"}</div>
      <div class="etiqueta-linha">${esc(linha4) || "&nbsp;"}</div>
    </div>`;
}

export function gerarHtmlEtiquetas(lista, layout) {
  const paginas = [];
  for (let i = 0; i < lista.length; i += POR_PAGINA) {
    const itens = lista.slice(i, i + POR_PAGINA)
      .map((m, pos) => etiquetaHtml(m, pos, layout))
      .join("");
    paginas.push(`<div class="pagina">${itens}</div>`);
  }

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Etiquetas Postais UNACOB</title>
  <style>
    @page { size: 210mm 297mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; font-family: Arial, sans-serif; }
    .pagina {
      position: relative;
      width: ${FOLHA_LARGURA}mm;
      height: 296mm;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }
    .pagina:last-child { page-break-after: auto; break-after: auto; }
    .etiqueta {
      position: absolute;
      width: ${layout.largura}mm;
      height: ${layout.altura}mm;
      padding: 0 ${layout.recuoTexto}mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      font-size: 9.5pt;
      line-height: 1.35;
      overflow: hidden;
    }
    .etiqueta strong {
      font-size: 10.5pt;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
      margin-bottom: 2px;
    }
    .etiqueta-linha {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }
    @media screen {
      body { background: #ddd; padding: 10mm 0; }
      .pagina { margin: 0 auto 10mm; background: #fff; box-shadow: 0 0 4px rgba(0,0,0,.3); }
      .etiqueta { outline: 1px dashed #bbb; }
    }
  </style>
</head>
<body>
${paginas.join("\n")}
</body>
</html>`;
}
