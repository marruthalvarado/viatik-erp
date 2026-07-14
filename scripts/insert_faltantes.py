#!/usr/bin/env python3
"""
Inserta las facturas faltantes cuya clave_acceso fue corrompida por Excel
(float64 trunca números de 49 dígitos → duplicados aparentes).
Las inserta con clave_acceso=NULL para evitar el conflicto.
"""
import os, sys
from datetime import date, datetime
from collections import Counter
import pandas as pd
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
EXCEL        = sys.argv[1]
EMPRESA_ID   = sys.argv[2]
DRY_RUN      = "--dry-run" in sys.argv

def to_str(val, max_len=500):
    if pd.isna(val): return None
    s = str(val).strip()
    if "e+" in s.lower() and len(s) < 30:
        try: s = f"{float(s):.0f}"
        except ValueError: pass
    return s[:max_len] if s else None

def to_date_str(val):
    if pd.isna(val): return None
    if isinstance(val, (datetime, date)): return val.strftime("%Y-%m-%d")
    s = str(val).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try: return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError: pass
    return s

def to_float(val):
    try: return float(val) if not pd.isna(val) else 0.0
    except: return 0.0

TIPO_MAP = {"factura": "factura", "nota de crédito": "nota_credito", "nota de credito": "nota_credito"}

df = pd.read_excel(EXCEL)
df.columns = [c.strip().lower() for c in df.columns]

all_rows = []
for i, row in df.iterrows():
    numero = to_str(row.get("factura") or row.get("número") or row.get("numero"), 50) or f"IMP-{i+1:04d}"
    clave  = to_str(row.get("clave de acceso") or row.get("clave_acceso"), 100)
    all_rows.append({
        "empresa_id":   EMPRESA_ID,
        "numero":       numero,
        "fecha":        to_date_str(row.get("fecha")) or date.today().isoformat(),
        "tipo":         TIPO_MAP.get(str(row.get("tipo","factura")).strip().lower(), "factura"),
        "ruc_cliente":  to_str(row.get("ruc"), 20),
        "razon_social": to_str(row.get("razon social") or row.get("razón social"), 255) or "SIN NOMBRE",
        "subtotal":     to_float(row.get("subtotal")),
        "descuento":    to_float(row.get("descuento")),
        "iva":          to_float(row.get("iva")),
        "total":        to_float(row.get("total")),
        "estado_sri":   to_str(row.get("estado sri") or row.get("estado_sri"), 50) or "AUTORIZADO",
        "observacion":  to_str(row.get("observación") or row.get("observacion"), 1000),
        "clave_acceso": clave,
        "proyecto_id":  None,
    })

# Detectar claves duplicadas en el Excel (valor corrupto por precisión float)
claves = [r["clave_acceso"] for r in all_rows if r["clave_acceso"]]
claves_duplicadas = {c for c, n in Counter(claves).items() if n > 1}

# Anular clave_acceso corrupta en filas con duplicados
for r in all_rows:
    if r["clave_acceso"] in claves_duplicadas:
        r["clave_acceso"] = None

# Obtener números ya existentes en la BD
sb = create_client(SUPABASE_URL, SUPABASE_KEY)
resp = sb.table("facturas_emitidas").select("numero").eq("empresa_id", EMPRESA_ID).execute()
numeros_en_db = {r["numero"] for r in resp.data}

# Solo las que faltan
faltantes = [r for r in all_rows if r["numero"] not in numeros_en_db]

print(f"\nFacturas faltantes a insertar: {len(faltantes)}")
print(f"{'#':<4} {'Número':<26} {'Fecha':<12} {'Cliente':<35} {'Total':>12}")
print(f"{'-'*4} {'-'*26} {'-'*12} {'-'*35} {'-'*12}")
for i, r in enumerate(faltantes, 1):
    print(f"{i:<4} {r['numero']:<26} {r['fecha']:<12} {r['razon_social'][:35]:<35} ${r['total']:>11,.2f}")

if DRY_RUN:
    print("\n[DRY RUN] No se insertó nada.")
    sys.exit(0)

if not faltantes:
    print("\nNada que insertar.")
    sys.exit(0)

resp2 = sb.table("facturas_emitidas").insert(faltantes).execute()
print(f"\n✓ {len(resp2.data)} facturas insertadas correctamente.")
