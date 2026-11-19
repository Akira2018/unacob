/**
 * Central utility for Brazilian date formatting (DD/MM/YYYY)
 */

export const formatDateBR = (val) => {
  if (val === null || val === undefined) return '-';
  const str = String(val).trim();
  if (!str) return '-';

  // Already DD/MM/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    return str.slice(0, 10);
  }

  // Matches YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return `${dd}/${mm}/${yyyy}`;
  }

  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch {
    // fallback
  }

  return str;
};

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MESES_ABREV = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

/**
 * Formata mês/ano a partir de "YYYY-MM" para exibição em português.
 * @param {string} mesAno Ex: "2026-11"
 * @param {boolean} curto Se true: "Nov/2026" (ou "Nov/26"), se false: "Novembro/2026"
 */
export const formatMesAno = (mesAno, curto = false) => {
  if (!mesAno) return '';
  const parts = String(mesAno).trim().split('-');
  if (parts.length < 2) return String(mesAno);
  const [yyyy, mm] = parts;
  const idx = parseInt(mm, 10) - 1;
  if (idx < 0 || idx > 11) return String(mesAno);
  return curto ? `${MESES_ABREV[idx]}/${yyyy}` : `${MESES_NOMES[idx]}/${yyyy}`;
};

/**
 * Converte valor monetário (número ou string brasileira com vírgula) para float numérico seguro.
 * Ex: "35,50" -> 35.5, "35.50" -> 35.5, "1.250,00" -> 1250, 35 -> 35
 */
export const parseMoedaBR = (val) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (!str) return 0;
  let clean = str.replace(/[^\d.,-]/g, '');
  if (clean.includes(',') && clean.includes('.')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
};

/**
 * Formata um número ou string com 2 casas decimais e vírgula como separador decimal.
 * Ex: 35 -> "35,00", 35.5 -> "35,50", "35" -> "35,00"
 */
export const formatMoedaBR = (val) => {
  if (val === '' || val === null || val === undefined) return '';
  const num = typeof val === 'number' ? val : parseMoedaBR(val);
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

