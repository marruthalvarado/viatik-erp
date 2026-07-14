#!/usr/bin/env python3
import os, sys
import pandas as pd
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
EXCEL        = sys.argv[1]
EMPRESA_ID   = sys.argv[2]

def to_str(val, max_len=500):
    if pd.isna(val): return None
    s = str(val).strip()
    if "e+" in s.lower() and len(s) < 30:
        try: s = f"{float(s):.0f}"
        except ValueError: pass
    return s[:max_len] if s else None

df = pd.read_excel(EXCEL)
df.columns = [c.strip().lower() for c in df.columns]

excel_rows = []
for i, row in df.iterrows():
    numero  = to_str(row.get("factura") or row.get("número") or row.get("numero"), 50) or f"IMP-{i+1:04d}"
    clave   = to_str(row.get("clave de acceso") or row.get("clave_acceso"), 100)
    razon   = to_str(row.get("razon social") or row.get("razón social"), 255) or "SIN NOMBRE"
    fecha   = str(row.get("fecha",""))[:10]
    total   = float(row.get("total",0)) if not pd.isna(row.get("total",0)) else 0
    excel_rows.append({"numero": numero, "clave_acceso": clave, "razon_social": razon, "fecha": fecha, "total": total})

sb = create_client(SUPABASE_URL, SUPABASE_KEY)
resp = sb.table("facturas_emitidas").select("numero,clave_acceso").eq("empresa_id", EMPRESA_ID).execute()
db_claves  = {r["clave_acceso"] for r in resp.data if r["clave_acceso"]}
db_numeros = {r["numero"] for r in resp.data}

# ── 1. Filas del Excel NO en la BD (por numero) ──────────────────────────────
db_numeros_list = [r["numero"] for r in resp.data]
omitidas = [r for r in excel_rows if r["numero"] not in db_numeros]

print(f"\n{'='*70}")
print(f"FALTANTES EN BD (Excel tiene {len(excel_rows)}, BD tiene {len(resp.data)}):")
print(f"{'='*70}")
print(f"{'#':<4} {'Número':<26} {'Fecha':<12} {'Cliente':<35} {'Total':>12}")
print(f"{'-'*4} {'-'*26} {'-'*12} {'-'*35} {'-'*12}")
for i, r in enumerate(omitidas, 1):
    print(f"{i:<4} {r['numero']:<26} {r['fecha']:<12} {r['razon_social'][:35]:<35} ${r['total']:>11,.2f}")

# ── 2. Duplicados de clave_acceso dentro del Excel ───────────────────────────
from collections import Counter
claves = [r["clave_acceso"] for r in excel_rows if r["clave_acceso"]]
dupes = {c: cnt for c, cnt in Counter(claves).items() if cnt > 1}
if dupes:
    print(f"\n{'='*70}")
    print(f"CLAVES DE ACCESO DUPLICADAS EN EL EXCEL ({len(dupes)} grupos):")
    print(f"{'='*70}")
    for clave, cnt in dupes.items():
        rows = [r for r in excel_rows if r["clave_acceso"] == clave]
        print(f"\n  Clave: ...{clave[-20:]}  ({cnt} ocurrencias)")
        for r in rows:
            print(f"    {r['numero']:<26} {r['fecha']:<12} {r['razon_social'][:35]}")

# ── 3. Duplicados de número dentro del Excel ─────────────────────────────────
nums = [r["numero"] for r in excel_rows]
dupe_nums = {n: cnt for n, cnt in Counter(nums).items() if cnt > 1}
if dupe_nums:
    print(f"\n{'='*70}")
    print(f"NÚMEROS DUPLICADOS EN EL EXCEL ({len(dupe_nums)} grupos):")
    print(f"{'='*70}")
    for num, cnt in dupe_nums.items():
        rows = [r for r in excel_rows if r["numero"] == num]
        print(f"\n  Número: {num}  ({cnt} ocurrencias)")
        for r in rows:
            print(f"    {r['fecha']:<12} {r['razon_social'][:35]} ${r['total']:>11,.2f}")
