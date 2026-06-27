/**
 * Servicio de exportación para impresión — FASE 8F
 *
 * Genera un HTML de impresión limpio en una nueva ventana.
 * Oculta sidebar, botones y filtros secundarios.
 * Solo muestra el reporte: título, metadatos, tabla.
 * No accede a Supabase. No manipula el DOM del componente llamador.
 */
import { type ExportConfig, type ExportResult, formatCell, buildHeaderLines } from "./export-utils";

function buildPrintHtml(config: ExportConfig): string {
  const headerLines = buildHeaderLines(config);

  const metaRows = headerLines
    .slice(1)
    .map((line) => `<p class="meta">${escHtml(line)}</p>`)
    .join("");

  const thead = `<thead><tr>${config.columns
    .map((c) => `<th class="${c.align ?? "left"}">${escHtml(c.header)}</th>`)
    .join("")}</tr></thead>`;

  const tbody = `<tbody>${config.rows
    .map(
      (row, i) =>
        `<tr class="${i % 2 === 0 ? "even" : "odd"}">${config.columns
          .map((col) => {
            const val = formatCell(row[col.key], col.format);
            const align =
              col.align ??
              (col.format === "number" || col.format === "currency" || col.format === "percent"
                ? "right"
                : "left");
            return `<td class="${align}">${escHtml(val)}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("")}</tbody>`;

  const tfoot = `<tfoot><tr><td colspan="${config.columns.length}" class="left">
    ${config.rows.length} registros exportados
  </td></tr></tfoot>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(config.title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, Arial, sans-serif;
      font-size: 11px;
      color: #111;
      padding: 16mm 14mm;
    }
    h1 { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
    .meta { font-size: 10px; color: #555; margin-bottom: 2px; }
    .meta-block { margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 10px;
    }
    thead tr { background: #1e40af; color: #fff; }
    thead th {
      padding: 5px 6px;
      font-weight: 600;
      border: 1px solid #c7d2fe;
    }
    tbody tr.even { background: #f8fafc; }
    tbody tr.odd  { background: #fff; }
    tbody td {
      padding: 4px 6px;
      border: 1px solid #e5e7eb;
    }
    tfoot td {
      padding: 4px 6px;
      font-size: 9px;
      color: #6b7280;
      border-top: 2px solid #e5e7eb;
    }
    .left  { text-align: left; }
    .right { text-align: right; }
    .center { text-align: center; }
    @media print {
      body { padding: 0; }
      @page { margin: 12mm; size: landscape; }
    }
  </style>
</head>
<body>
  <h1>${escHtml(headerLines[0])}</h1>
  <div class="meta-block">${metaRows}</div>
  <table>
    ${thead}
    ${tbody}
    ${tfoot}
  </table>
  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() { window.close(); };
    };
  </script>
</body>
</html>`;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function exportToPrint(config: ExportConfig): Promise<ExportResult> {
  try {
    const html = buildPrintHtml(config);
    const win = window.open("", "_blank", "width=1100,height=750");
    if (!win) {
      return {
        success: false,
        error:
          "El navegador bloqueó la ventana emergente. Permite ventanas emergentes para imprimir.",
      };
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al preparar impresión",
    };
  }
}
