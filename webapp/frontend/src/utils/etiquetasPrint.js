// Geração da folha de etiquetas para impressão (2 colunas x 10 linhas).
// Padrão: Pimaco 6281 / 6181 (Avery 5161) — folha Carta, etiquetas 25,4 x 101,6 mm,
// sem espaço entre linhas. Todas as medidas são absolutas em mm a partir da
// borda da folha, com @page margin 0, para que a posição impressa não dependa
// das margens do diálogo de impressão nem da área não imprimível da impressora.

export const FOLHAS = {
  Carta: { largura: 215.9, altura: 279.4 },
  A4: { largura: 210, altura: 297 }
};
export const COLUNAS = 2;
export const LINHAS = 10;
export const POR_PAGINA = COLUNAS * LINHAS;

export const LAYOUT_PADRAO = {
  folha: "Carta",
  largura: 101.6,
  altura: 25.4,
  espacoColunas: 4.8,
  espacoLinhas: 0,
  margemEsquerda: 3.9,
  margemSuperior: 12.7,
  recuoTexto: 5
};

// v2: o layout salvo anteriormente (A4, passo de 27,5 mm) gerava deslocamento
// acumulado a cada linha; a chave nova descarta esse valor antigo.
export const LAYOUT_STORAGE_KEY = "unacob_etiquetas_layout_v2";

export function dimensoesFolha(layout) {
  return FOLHAS[layout.folha] || FOLHAS.Carta;
}

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
  const folha = dimensoesFolha(layout);
  const larguraTotal = COLUNAS * layout.largura + (COLUNAS - 1) * layout.espacoColunas;
  const alturaTotal = LINHAS * layout.altura + (LINHAS - 1) * layout.espacoLinhas;
  return {
    ...layout,
    margemEsquerda: arredondar((folha.largura - larguraTotal) / 2),
    margemSuperior: arredondar((folha.altura - alturaTotal) / 2)
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
  const folha = dimensoesFolha(layout);
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
    @page { size: ${folha.largura}mm ${folha.altura}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; font-family: Arial, sans-serif; }
    .pagina {
      position: relative;
      width: ${folha.largura}mm;
      height: ${folha.altura - 1}mm;
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
