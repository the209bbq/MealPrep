/** Parse a TheMealDB measure string into quantity + unit (preserve ingredient name separately). */
export function parseMealDbMeasure(measureRaw: string): { quantity: number; unit: string } {
  const trimmed = measureRaw.trim();
  if (!trimmed) {
    return { quantity: 1, unit: 'each' };
  }
  const match = trimmed.match(/^([\d./\s]+)?\s*([a-zA-Z]+(?:\.[a-zA-Z]+)?)?\s*(.*)$/);
  if (!match) {
    return { quantity: 1, unit: trimmed };
  }
  const qtyRaw = (match[1] ?? '').trim();
  const unitRaw = (match[2] ?? '').trim();
  const trailing = (match[3] ?? '').trim();
  let quantity = 1;
  if (qtyRaw) {
    if (qtyRaw.includes('/')) {
      const [a, b] = qtyRaw.split('/').map((p) => Number.parseFloat(p.trim()));
      if (a && b) quantity = a / b;
    } else {
      const n = Number.parseFloat(qtyRaw.replace(/\s+/g, ''));
      if (!Number.isNaN(n)) quantity = n;
    }
  }
  const unit = unitRaw || trailing || 'each';
  return { quantity, unit };
}
