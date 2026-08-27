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
