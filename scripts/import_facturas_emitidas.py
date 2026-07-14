#!/usr/bin/env python3
"""
Script: import_facturas_emitidas.py
Importa el histórico de facturas emitidas desde Facturas_emitidas.xlsx
a la tabla `facturas_emitidas` de Supabase.

Uso:
    pip install pandas openpyxl supabase python-dotenv
    python scripts/import_facturas_emitidas.py \
        --excel "Facturas_emitidas.xlsx" \
        --empresa-id "UUID-DE-PROTONMEDICAL"

Variables de entorno (o archivo .env en la raíz del proyecto):
    SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=eyJ...   (service role, no anon key)
"""

import argparse
import os
import sys
from datetime import date, datetime

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

# ─── Configuración ───────────────────────────────────────────────────────────

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

TIPO_MAP = {
    "factura": "factura",
    "nota de crédito": "nota_credito",
    "nota de credito": "nota_credito",
}

# ─── Helpers ─────────────────────────────────────────────────────────────────


def to_date_str(val) -> str | None:
    """Convierte fecha de Excel (datetime / date / str) a 'YYYY-MM-DD'."""
    if pd.isna(val):
        return None
    if isinstance(val, (datetime, date)):
        return val.strftime("%Y-%m-%d")
    s = str(val).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return s  # devolver tal cual si no se puede parsear


def to_str(val, max_len: int = 500) -> str | None:
    """Convierte valor a string, limpiando NaN."""
    if pd.isna(val):
        return None
    s = str(val).strip()
    # Manejo especial: claves de acceso en notación científica desde Excel
    # Ej: 3.101202e+48 → '310120220240131110000001234567890123456789012345678'
    if "e+" in s.lower() and len(s) < 30:
        try:
            s = f"{float(s):.0f}"
        except ValueError:
            pass
    return s[:max_len] if s else None


def to_float(val, default: float = 0.0) -> float:
    """Convierte valor a float, devolviendo 0 si es NaN."""
    try:
        return float(val) if not pd.isna(val) else default
    except (TypeError, ValueError):
        return default


def map_tipo(val: str) -> str:
    """Normaliza el tipo de documento."""
    key = str(val).strip().lower()
    return TIPO_MAP.get(key, "factura")


# ─── Main ─────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(description="Importar facturas emitidas a Supabase")
    parser.add_argument("--excel", required=True, help="Ruta al archivo .xlsx")
    parser.add_argument("--empresa-id", required=True, help="UUID de la empresa en Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Solo mostrar filas, no insertar")
    parser.add_argument("--skip-duplicates", action="store_true", default=True,
                        help="Saltar filas con clave_acceso duplicada (default: True)")
    args = parser.parse_args()

    # Validar credenciales
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env", file=sys.stderr)
        sys.exit(1)

    # Leer Excel
    print(f"Leyendo {args.excel}...")
    df = pd.read_excel(args.excel)
    print(f"  {len(df)} filas encontradas")

    # Normalizar columnas (lower + strip)
    df.columns = [c.strip().lower() for c in df.columns]

    # Construir registros
    rows = []
    for i, row in df.iterrows():
        numero_raw = to_str(row.get("factura") or row.get("número") or row.get("numero"), 50)
        fecha_str = to_date_str(row.get("fecha"))
        tipo = map_tipo(row.get("tipo", "factura"))

        record = {
            "empresa_id":   args.empresa_id,
            "numero":       numero_raw or f"IMP-{i+1:04d}",
            "fecha":        fecha_str or date.today().isoformat(),
            "tipo":         tipo,
            "ruc_cliente":  to_str(row.get("ruc"), 20),
            "razon_social": to_str(row.get("razon social") or row.get("razón social"), 255) or "SIN NOMBRE",
            "subtotal":     to_float(row.get("subtotal")),
            "descuento":    to_float(row.get("descuento")),
            "iva":          to_float(row.get("iva")),
            "total":        to_float(row.get("total")),
            "estado_sri":   to_str(row.get("estado sri") or row.get("estado_sri"), 50) or "AUTORIZADO",
            "observacion":  to_str(row.get("observación") or row.get("observacion"), 1000),
            "clave_acceso": to_str(row.get("clave de acceso") or row.get("clave_acceso"), 100),
            "proyecto_id":  None,
        }
        rows.append(record)

    if args.dry_run:
        print("\n[DRY RUN] Primeras 5 filas a insertar:")
        for r in rows[:5]:
            print(f"  {r['numero']:25s} | {r['fecha']} | {r['razon_social'][:40]:40s} | ${r['total']:>12,.2f}")
        print(f"\nTotal: {len(rows)} registros (no se insertó nada)")
        return

    # Conectar a Supabase
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Insertar en lotes
    BATCH = 50
    inserted = 0
    skipped = 0
    errors = 0

    for start in range(0, len(rows), BATCH):
        batch = rows[start : start + BATCH]
        try:
            resp = (
                supabase.table("facturas_emitidas")
                .upsert(batch, on_conflict="empresa_id,clave_acceso", ignore_duplicates=args.skip_duplicates)
                .execute()
            )
            n = len(resp.data) if resp.data else 0
            inserted += n
            skipped += len(batch) - n
            print(f"  Lote {start // BATCH + 1}: {n}/{len(batch)} insertados")
        except Exception as exc:
            errors += len(batch)
            print(f"  ERROR en lote {start // BATCH + 1}: {exc}", file=sys.stderr)

    print(f"\nResultado: {inserted} insertados, {skipped} omitidos, {errors} errores")

    if inserted > 0:
        print("\n✓ Importación completada. Recarga la app para ver las facturas en el módulo Facturas Emitidas.")


if __name__ == "__main__":
    main()
