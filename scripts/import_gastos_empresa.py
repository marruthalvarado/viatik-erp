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
PROJECT_ALIASES: dict[str, str] = {
    "Ludlum": "MEDIKA_Ludlum",
    "HCAM - SPECT": "HCAM Medika - Mant. Radiofarmacia",
    "HCAM Medika": "HCAM Medika - Mant. Radiofarmacia",
    "Solca - Distribuidor automático": "Gammalife - Activímetro",
}

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
    parser.add_argument("--empresa-id", default=None, help="UUID de la empresa")
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
    proyectos_db: dict[str, str] = {}
    for p in res.data or []:
        proyectos_db[normalize(p["nombre"])] = p["id"]
    print(f"📁  {len(proyectos_db)} proyectos cargados desde BD")

    # ── Categorías ──────────────────────────────────────────────────────────
    # es_deducible puede no existir en producción; se omite del SELECT.
    res = sb.table("categorias_gasto").select("id, nombre").execute()
    categorias_db: dict[str, dict] = {}
    for c in res.data or []:
        categorias_db[normalize(c["nombre"])] = {
            "id": c["id"],
            "es_deducible": True,
        }
    print(f"🏷️   {len(categorias_db)} categorías cargadas desde BD")

    # ── Proveedores (matching por RUC y nombre) ──────────────────────────────
    res_prov = (
        sb.table("proveedores")
        .select("id, nombre")
        .eq("empresa_id", empresa_id)
        .is_("deleted_at", "null")
        .execute()
    )
    prov_by_ruc: dict[str, str] = {}   # ruc → id (poblado al crear nuevos)
    prov_by_nombre: dict[str, str] = {}  # nombre_lower → id
    for p in res_prov.data or []:
        prov_by_nombre[normalize(p["nombre"])] = p["id"]
    print(f"🏪  {len(res_prov.data or [])} proveedores cargados desde BD")

    # Cache de proveedores creados en esta sesión (RUC → id)
    prov_creados: dict[str, str] = {}
    nuevos_prov = 0

    def get_or_create_proveedor(nombre: str, ruc: str) -> str | None:
        nonlocal nuevos_prov
        # 1. Buscar por RUC (más confiable)
        if ruc and ruc in prov_by_ruc:
            return prov_by_ruc[ruc]
        # 2. Buscar por nombre
        if normalize(nombre) in prov_by_nombre:
            return prov_by_nombre[normalize(nombre)]
        # 3. Revisar cache de sesión
        cache_key = ruc if ruc else normalize(nombre)
        if cache_key in prov_creados:
            return prov_creados[cache_key]
        # 4. Crear nuevo proveedor
        if not nombre:
            return None
        if args.dry_run:
            # En dry-run simular el ID para no crear registros
            prov_creados[cache_key] = f"__dry_{cache_key}__"
            nuevos_prov += 1
            return prov_creados[cache_key]
        try:
            r = (
                sb.table("proveedores")
                .insert({
                    "empresa_id": empresa_id,
                    "nombre": nombre,
                })
                .select("id")
                .execute()
            )
            new_id = r.data[0]["id"]
            prov_creados[cache_key] = new_id
            if ruc:
                prov_by_ruc[ruc] = new_id
            prov_by_nombre[normalize(nombre)] = new_id
            nuevos_prov += 1
            return new_id
        except Exception as e:
            print(f"  ⚠️  No se pudo crear proveedor '{nombre}' (RUC: {ruc}): {e}")
            return None

    # ── Leer Excel ──────────────────────────────────────────────────────────
    df = pd.read_excel(args.excel, sheet_name=0, header=2, dtype=str)
    df.columns = [
        "RENDICION", "MES", "FECHA", "N_FACTURA",
        "RUC_PROVEEDOR", "PROVEEDOR", "MONTO",
        "PROYECTO", "CATEGORIA", "DESCRIPCION", "IMPORTAR",
    ]
    df = df[df["RENDICION"].notna() & (df["RENDICION"].str.strip() != "")]
    df_import = df[df["IMPORTAR"].str.strip().str.upper() == "S"].reset_index(drop=True)
    print(f"\n📄  Filas a importar: {len(df_import)}")

    # ── Deduplicación por observacion ────────────────────────────────────────
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
        proveedor_nombre = str(row.get("PROVEEDOR", "")).strip()
        monto = to_float(row.get("MONTO", 0))
        observacion = f"Serie: {n_factura} · RUC: {ruc}" if n_factura else f"RUC: {ruc}"

        if observacion in obs_existentes:
            skipped_dup += 1
            continue

        # Proyecto
        proy_nombre = str(row.get("PROYECTO", "")).strip()
        proy_busqueda = PROJECT_ALIASES.get(proy_nombre, proy_nombre)
        proyecto_id = proyectos_db.get(normalize(proy_busqueda))
        if not proyecto_id and proy_nombre:
            for db_nombre, db_id in proyectos_db.items():
                if normalize(proy_busqueda) in db_nombre or db_nombre in normalize(proy_busqueda):
                    proyecto_id = db_id
                    break
        if not proyecto_id and proy_nombre:
            unmatched_proyectos.add(proy_nombre)

        # Categoría
        cat_nombre = str(row.get("CATEGORIA", "")).strip()
        cat_data = categorias_db.get(normalize(cat_nombre))
        if not cat_data and cat_nombre:
            for db_nombre, db_data in categorias_db.items():
                if normalize(cat_nombre) in db_nombre or db_nombre in normalize(cat_nombre):
                    cat_data = db_data
                    break
        categoria_id = cat_data["id"] if cat_data else None
        es_deducible = cat_data["es_deducible"] if cat_data else True
        if not cat_data and cat_nombre:
            unmatched_categorias.add(cat_nombre)

        # Proveedor — matchear por RUC o crear
        proveedor_id = get_or_create_proveedor(proveedor_nombre, ruc) if proveedor_nombre else None

        # Descripción: usar columna DESCRIPCION del Excel; si vacía, usar nombre proveedor
        descripcion_col = str(row.get("DESCRIPCION", "")).strip()
        descripcion = (
            descripcion_col
            if descripcion_col and descripcion_col != "nan"
            else proveedor_nombre or n_factura
        )

        rows_to_insert.append({
            "empresa_id": empresa_id,
            "fecha": fecha,
            "descripcion": descripcion,
            "categoria_id": categoria_id,
            "proveedor_id": proveedor_id if not args.dry_run else None,
            "proyecto_id": proyecto_id,
            "responsable": None,
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

    # ── Resumen ──────────────────────────────────────────────────────────────
    print(f"\n─── Resumen ───────────────────────────────────────────")
    print(f"  Listas para insertar : {len(rows_to_insert)}")
    print(f"  Duplicadas (skip)    : {skipped_dup}")
    print(f"  Sin fecha (skip)     : {skipped_no_fecha}")
    print(f"  Proveedores nuevos   : {nuevos_prov}")

    if unmatched_proyectos:
        print(f"\n⚠️  Proyectos sin match ({len(unmatched_proyectos)}) — se importarán sin proyecto:")
        for p in sorted(unmatched_proyectos):
            print(f"     · '{p}'")

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
