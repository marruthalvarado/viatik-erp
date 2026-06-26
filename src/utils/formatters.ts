export function formatCurrency(
  value: number | null | undefined,
  currency = "CLP",
  locale = "es-CL",
) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | Date | null | undefined, locale = "es-CL") {
  if (!value) return "—";
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
