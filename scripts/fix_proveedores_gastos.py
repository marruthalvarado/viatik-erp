#!/usr/bin/env python3
"""
fix_proveedores_gastos.py
=========================
Corrige los gastos_empresa que quedaron sin proveedor_id después de la
importación masiva. Lee el Excel, cruza por observacion y asigna/crea
el proveedor correcto.

Uso:
    python scripts/fix_proveedores_gastos.py \
        --excel "Plantilla_Importacion_Gastos.xlsx" \
        --empresa-id "149fb49a-71ee-4c7a-851f-810e78914eee"
"""

import argparse
import os
import sys
from datetime import datetime, date

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client


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


def normalize(s: str) -> str:
    return str(s).strip().lower()


def main():
    load_dotenv()

    parser = argparse.ArgumentParser()
    parser.add_argument("--excel", required=True)
    parser.add_argument("--empresa-id", default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("❌  Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env")
        sys.exit(1)

    sb = create_client(url, key)
    print(f"✅  Conectado a Supabase: {url}")

    # ── Empresa ──────────────────────────────────────────────────────────────
    empresa_id = args.empresa_id
    if not empresa_id:
        res = sb.table("empresas").select("id, nombre").execute()
        empresas = res.data or []
        if len(empresas) == 1:
            empresa_id = empresas[0]["id"]
            print(f"🏢  Empresa: {empresas[0]['nombre']}")
        else:
            for e in empresas:
                print(f"  {e['id']}  {e['nombre']}")
            empresa_id = input("UUID de la empresa: ").strip()

    # ── Proveedores existentes ───────────────────────────────────────────────
    res_prov = (
        sb.table("proveedores")
        .select("id, nombre")
        .eq("empresa_id", empresa_id)
        .is_("deleted_at", "null")
        .execute()
    )
    prov_by_nombre: dict[str, str] = {}
    for p in res_prov.data or []:
        prov_by_nombre[normalize(p["nombre"])] = p["id"]
    print(f"🏪  {len(prov_by_nombre)} proveedores en BD")

    prov_creados: dict[str, str] = {}
    nuevos = 0

    def get_or_create(nombre: str) -> str | None:
        nonlocal nuevos
        key_n = normalize(nombre)
        if key_n in prov_by_nombre:
            return prov_by_nombre[key_n]
        if key_n in prov_creados:
            return prov_creados[key_n]
        if args.dry_run:
            prov_creados[key_n] = f"__dry_{key_n}__"
            nuevos += 1
            return prov_creados[key_n]
        # Intentar insertar; si viola unique, buscar el existente
        try:
            r = (
                sb.table("proveedores")
                .insert({"empresa_id": empresa_id, "nombre": nombre})
                .select("id")
                .execute()
            )
            new_id = r.data[0]["id"]
        except Exception as e:
            if "unique" in str(e).lower() or "duplicate" in str(e).lower() or "23505" in str(e):
                # Ya existe con ese nombre — buscarlo
                try:
                    r2 = (
                        sb.table("proveedores")
                        .select("id")
                        .eq("empresa_id", empresa_id)
                        .ilike("nombre", nombre)
                        .limit(1)
                        .execute()
                    )
                    if r2.data:
                        new_id = r2.data[0]["id"]
                    else:
                        print(f"  ⚠️  No se encontró proveedor '{nombre}' tras unique violation")
                        return None
                except Exception as e2:
                    print(f"  ⚠️  Error buscando '{nombre}': {e2}")
                    return None
            else:
                print(f"  ⚠️  Error creando '{nombre}': {e}")
                return None
        prov_creados[key_n] = new_id
        prov_by_nombre[key_n] = new_id
        nuevos += 1
        return new_id

    # ── Gastos sin proveedor ─────────────────────────────────────────────────
    res_gastos = (
        sb.table("gastos_empresa")
        .select("id, observacion, descripcion")
        .eq("empresa_id", empresa_id)
        .is_("deleted_at", "null")
        .is_("proveedor_id", "null")
        .execute()
    )
    gastos_sin_prov = res_gastos.data or []
    print(f"🔍  Gastos sin proveedor: {len(gastos_sin_prov)}")

    if not gastos_sin_prov:
        print("✅  Todos los gastos ya tienen proveedor asignado.")
        return

    # Índice observacion → {id, descripcion}
    obs_to_gasto: dict[str, dict] = {
        g["observacion"]: g for g in gastos_sin_prov if g.get("observacion")
    }

    # ── Leer Excel ───────────────────────────────────────────────────────────
    df = pd.read_excel(args.excel, sheet_name=0, header=2, dtype=str)
    df.columns = [
        "RENDICION", "MES", "FECHA", "N_FACTURA",
        "RUC_PROVEEDOR", "PROVEEDOR", "MONTO",
        "PROYECTO", "CATEGORIA", "DESCRIPCION", "IMPORTAR",
    ]
    df = df[df["RENDICION"].notna() & (df["RENDICION"].str.strip() != "")]
    df_imp = df[df["IMPORTAR"].str.strip().str.upper() == "S"].reset_index(drop=True)

    # ── Construir mapa observacion → proveedor_nombre ────────────────────────
    obs_to_nombre: dict[str, str] = {}
    for _, row in df_imp.iterrows():
        n_factura = str(row.get("N_FACTURA", "")).strip()
        ruc = str(row.get("RUC_PROVEEDOR", "")).strip()
        nombre = str(row.get("PROVEEDOR", "")).strip()
        obs = f"Serie: {n_factura} · RUC: {ruc}" if n_factura else f"RUC: {ruc}"
        if nombre:
            obs_to_nombre[obs] = nombre

    # ── Procesar ─────────────────────────────────────────────────────────────
    updates = []
    no_match = []

    for obs, gasto in obs_to_gasto.items():
        nombre = obs_to_nombre.get(obs)
        if not nombre:
            # Intentar usar descripcion como fallback
            nombre = gasto.get("descripcion", "").strip()
        if not nombre:
            no_match.append(obs)
            continue
        prov_id = get_or_create(nombre)
        if prov_id and not prov_id.startswith("__dry_"):
            updates.append({"id": gasto["id"], "proveedor_id": prov_id})

    print(f"\n─── Resumen ───────────────────────────────────────────")
    print(f"  Con match para actualizar : {len(updates)}")
    print(f"  Sin match (quedan null)   : {len(no_match)}")
    print(f"  Proveedores nuevos        : {nuevos}")

    if no_match:
        print("\n⚠️  Observaciones sin proveedor en Excel:")
        for o in no_match[:10]:
            print(f"    · {o}")

    if args.dry_run:
        print("\n🔵  DRY RUN — nada fue actualizado.")
        return

    if not updates:
        print("\nℹ️  Nada que actualizar.")
        return

    # ── Actualizar uno a uno (no hay upsert masivo con filtros) ─────────────
    ok = 0
    for u in updates:
        try:
            sb.table("gastos_empresa").update({"proveedor_id": u["proveedor_id"]}).eq("id", u["id"]).execute()
            ok += 1
        except Exception as e:
            print(f"  ⚠️  Error actualizando {u['id']}: {e}")

    print(f"\n✅  {ok}/{len(updates)} registros actualizados con proveedor_id")


if __name__ == "__main__":
    main()
