export function formatCurrency(
  value: number | null | undefined,
  currency = "USD",
  locale = "es-EC",
) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: string | Date | null | undefined, locale = "es-CL") {
  if (!value) return "—";
  // Parse YYYY-MM-DD as local time to avoid UTC-to-local shift (e.g., July 7 → July 6 in UTC-5)
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, day] = value.split("-").map(Number);
    const local = new Date(y, m - 1, day);
    if (Number.isNaN(local.getTime())) return "—";
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(local);
  }
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined, locale = "es-CL") {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function formatNumber(value: number | null | undefined, locale = "es-CL") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale).format(value);
}

/** Convierte strings vacíos o undefined a null (para campos opcionales en BD). */
export function emptyToNull(v: string | null | undefined): string | null {
  return v === "" || v === undefined ? null : v;
}
