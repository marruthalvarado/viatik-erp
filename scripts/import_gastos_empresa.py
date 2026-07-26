#!/usr/bin/env python3
"""
import_gastos_empresa.py
========================
Importa el histórico de gastos de empresa desde Plantilla_Importacion_Gastos.xlsx
a la tabla `gastos_empresa` de Supabase.

Uso:
    pip install pandas openpyxl supabase python-dotenv
    python scripts/import_gastos_empresa.py \
        --excel "Plantilla_Importacion_Gastos.xlsx" \
        --empresa-id "UUID-DE-PROTONMEDICAL"   # opcional si solo hay una empresa

Variables de entorno (.env en la raíz del proyecto):
    VITE_SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=eyJ...  (service role key, NO la anon key)
"""

import argparse
import os
import sys
from datetime import datetime, date

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

# ─── Aliases de proyectos: nombre en Excel → nombre en VIATIQ ──────────────
# Ampliar si hay más discrepancias encontradas durante la ejecución.
PROJECT_ALIASES: dict[str, str] = {
    "Ludlum": "MEDIKA_Ludlum",
    "HCAM - SPECT": "HCAM Medika - Mant. Radiofarmacia",
    "HCAM Medika": "HCAM Medika - Mant. Radiofarmacia",
    "Solca - Distribuidor automático": "Gammalife - Activímetro",
}

# ─── Tamaño del lote de inserción ──────────────────────────────────────────
BATCH_SIZE = 50


# ─── Helpers ────────────────────────────────────────────────────────────────

def to_date_str(val) -> str | None:
    if pd.isna(val):
        return None
    if isinstance(val, (datetime, date)):
        return val.strftime("%Y-%m-%d")
    s = str(val).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def to_float(val) -> float:
    try:
        return float(str(val).replace(",", ".").strip())
    except (ValueError, TypeError):
        return 0.0


def normalize(s: str) -> str:
    return str(s).strip().lower()


# ─── Main ───────────────────────────────────────────────────────────────────

def main():
    load_dotenv()

    parser = argparse.ArgumentParser(description="Importar gastos_empresa desde Excel")
    parser.add_argument("--excel", required=True, help="Ruta al Excel de importación")
    parser.add_argument("--empresa-id", default=None, help="UUID de la empresa (Protonmedical)")
    parser.add_argument("--dry-run", action="store_true", help="Simular sin insertar nada")
    args = parser.parse_args()

    # ── Conexión Supabase ───────────────────────────────────────────────────
    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("❌  Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env")
        sys.exit(1)

    sb = create_client(url, key)
    print(f"✅  Conectado a Supabase: {url}")

    # ── Empresa ─────────────────────────────────────────────────────────────
    empresa_id = args.empresa_id
    if not empresa_id:
        res = sb.table("empresas").select("id, nombre").execute()
        empresas = res.data or []
        if len(empresas) == 0:
            print("❌  No hay empresas en la BD.")
            sys.exit(1)
        if len(empresas) == 1:
            empresa_id = empresas[0]["id"]
            print(f"🏢  Empresa: {empresas[0]['nombre']} ({empresa_id})")
        else:
            print("Empresas disponibles:")
            for e in empresas:
                print(f"  {e['id']}  {e['nombre']}")
            empresa_id = input("Ingresa el UUID de la empresa: ").strip()

    # ── Proyectos ───────────────────────────────────────────────────────────
    res = sb.table("proyectos").select("id, nombre").eq("empresa_id", empresa_id).execute()
    proyectos_db: dict[str, str] = {}  # nombre_lower → id
    for p in res.data or []:
        proyectos_db[normalize(p["nombre"])] = p["id"]
    print(f"📁  {len(proyectos_db)} proyectos cargados desde BD")

    # ── Categorías ──────────────────────────────────────────────────────────
    res = sb.table("categorias_gasto").select("id, nombre, es_deducible").execute()
    categorias_db: dict[str, dict] = {}  # nombre_lower → {id, es_deducible}
    for c in res.data or []:
        categorias_db[normalize(c["nombre"])] = {
            "id": c["id"],
            "es_deducible": c.get("es_deducible", True),
        }
    print(f"🏷️   {len(categorias_db)} categorías cargadas desde BD")

    # ── Leer Excel ──────────────────────────────────────────────────────────
    df = pd.read_excel(args.excel, sheet_name=0, header=2, dtype=str)
    df.columns = [
        "RENDICION", "MES", "FECHA", "N_FACTURA",
        "RUC_PROVEEDOR", "PROVEEDOR", "MONTO",
        "PROYECTO", "CATEGORIA", "DESCRIPCION", "IMPORTAR",
    ]
    # Filtrar solo filas con datos y IMPORTAR = S
    df = df[df["RENDICION"].notna() & (df["RENDICION"].str.strip() != "")]
    df_import = df[df["IMPORTAR"].str.strip().str.upper() == "S"].reset_index(drop=True)
    print(f"\n📄  Filas a importar: {len(df_import)}")

    # ── Claves de acceso ya existentes (deduplicación por N_FACTURA) ────────
    # gastos importados desde Excel no tienen clave_acceso (49 chars), usamos
    # N_FACTURA + RUC como identificador natural para evitar dobles inserciones.
    # Cargamos las observaciones ya existentes para detectar duplicados.
    res_exist = (
        sb.table("gastos_empresa")
        .select("observacion")
        .eq("empresa_id", empresa_id)
        .is_("deleted_at", "null")
        .execute()
    )
    obs_existentes: set[str] = {
        r["observacion"] for r in (res_exist.data or []) if r.get("observacion")
    }
    print(f"🔍  Registros existentes en BD: {len(obs_existentes)}")

    # ── Construir filas ──────────────────────────────────────────────────────
    rows_to_insert = []
    skipped_dup = 0
    skipped_no_fecha = 0
    unmatched_proyectos: set[str] = set()
    unmatched_categorias: set[str] = set()

    for _, row in df_import.iterrows():
        fecha = to_date_str(row.get("FECHA"))
        if not fecha:
            skipped_no_fecha += 1
            continue

        n_factura = str(row.get("N_FACTURA", "")).strip()
        ruc = str(row.get("RUC_PROVEEDOR", "")).strip()
        proveedor = str(row.get("PROVEEDOR", "")).strip()
        monto = to_float(row.get("MONTO", 0))
        observacion = f"Serie: {n_factura} · RUC: {ruc}" if n_factura else f"RUC: {ruc}"

        # Deduplicar por observacion
        if observacion in obs_existentes:
            skipped_dup += 1
            continue

        # Proyecto
        proy_nombre = str(row.get("PROYECTO", "")).strip()
        # Aplicar alias conocidos
        proy_nombre_busqueda = PROJECT_ALIASES.get(proy_nombre, proy_nombre)
        proyecto_id = proyectos_db.get(normalize(proy_nombre_busqueda))
        if not proyecto_id and proy_nombre:
            # Intento de coincidencia parcial (contiene)
            for db_nombre, db_id in proyectos_db.items():
                if normalize(proy_nombre_busqueda) in db_nombre or db_nombre in normalize(proy_nombre_busqueda):
                    proyecto_id = db_id
                    break
        if not proyecto_id and proy_nombre:
            unmatched_proyectos.add(proy_nombre)

        # Categoría
        cat_nombre = str(row.get("CATEGORIA", "")).strip()
        cat_data = categorias_db.get(normalize(cat_nombre))
        if not cat_data and cat_nombre:
            # Intento parcial
            for db_nombre, db_data in categorias_db.items():
                if normalize(cat_nombre) in db_nombre or db_nombre in normalize(cat_nombre):
                    cat_data = db_data
                    break
        categoria_id = cat_data["id"] if cat_data else None
        es_deducible = cat_data["es_deducible"] if cat_data else True
        if not cat_data and cat_nombre:
            unmatched_categorias.add(cat_nombre)

        descripcion_extra = str(row.get("DESCRIPCION", "")).strip()
        descripcion = proveedor if proveedor else n_factura

        rows_to_insert.append({
            "empresa_id": empresa_id,
            "fecha": fecha,
            "descripcion": descripcion,
            "categoria_id": categoria_id,
            "proveedor_id": None,
            "proyecto_id": proyecto_id,
            "responsable": descripcion_extra if descripcion_extra and descripcion_extra != "nan" else None,
            "subtotal": round(monto, 2),
            "iva": 0.0,
            "total": round(monto, 2),
            "es_deducible": es_deducible,
            "clave_acceso": None,
            "ruc_emisor": ruc if ruc else None,
            "observacion": observacion,
            "xml_content": None,
            "comprobante_url": None,
            "created_by": None,
        })

    # ── Resumen pre-inserción ────────────────────────────────────────────────
    print(f"\n─── Resumen ───────────────────────────────────────────")
    print(f"  Listas para insertar : {len(rows_to_insert)}")
    print(f"  Duplicadas (skip)    : {skipped_dup}")
    print(f"  Sin fecha (skip)     : {skipped_no_fecha}")

    if unmatched_proyectos:
        print(f"\n⚠️  Proyectos sin match ({len(unmatched_proyectos)}) — se importarán sin proyecto:")
        for p in sorted(unmatched_proyectos):
            print(f"     · '{p}'")
        print("  → Añade los aliases en PROJECT_ALIASES del script si es necesario.")

    if unmatched_categorias:
        print(f"\n⚠️  Categorías sin match ({len(unmatched_categorias)}) — se importarán sin categoría:")
        for c in sorted(unmatched_categorias):
            print(f"     · '{c}'")

    if args.dry_run:
        print("\n🔵  DRY RUN — nada fue insertado.")
        return

    if len(rows_to_insert) == 0:
        print("\nℹ️  Nada que insertar.")
        return

    confirm = input(f"\n¿Insertar {len(rows_to_insert)} registros en gastos_empresa? [s/N] ").strip().lower()
    if confirm != "s":
        print("Cancelado.")
        return

    # ── Insertar en lotes ────────────────────────────────────────────────────
    inserted = 0
    errors = 0
    for i in range(0, len(rows_to_insert), BATCH_SIZE):
        batch = rows_to_insert[i : i + BATCH_SIZE]
        try:
            res = sb.table("gastos_empresa").insert(batch).execute()
            inserted += len(res.data or batch)
            print(f"  Lote {i // BATCH_SIZE + 1}: {len(batch)} registros ✅")
        except Exception as e:
            errors += len(batch)
            print(f"  Lote {i // BATCH_SIZE + 1}: ERROR — {e}")

    print(f"\n{'✅' if errors == 0 else '⚠️ '}  Importación completa: {inserted} insertados, {errors} errores")
    if errors:
        print("  Revisa los lotes con error e intenta nuevamente (los exitosos no se duplicarán).")


if __name__ == "__main__":
    main()
