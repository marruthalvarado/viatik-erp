"""
import_vitager.py — Importación masiva desde Vitager CRM a VIATIQ
Importa: productos (57), servicios (3) y clientes (3) desde CSVs exportados de Vitager.

Uso:
    pip install supabase python-dotenv
    python scripts/import_vitager.py

Variables de entorno requeridas (en .env.local):
    SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=eyJ...
    VIATIQ_EMPRESA_ID=149fb49a-71ee-4c7a-851f-810e78914eee
"""

import csv
import json
import os
import sys
from pathlib import Path

# ── Dependencias ───────────────────────────────────────────────────────────────
try:
    from supabase import create_client
    from dotenv import load_dotenv
except ImportError:
    print("Instala dependencias: pip install supabase python-dotenv")
    sys.exit(1)

# ── Config ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
CSV_DIR     = SCRIPT_DIR  # Pon los CSVs junto a este script, o ajusta la ruta

# Carga .env.local desde la raíz del proyecto
# Intenta .env.local primero, luego .env
load_dotenv(PROJECT_DIR / ".env.local")
load_dotenv(PROJECT_DIR / ".env")

SUPABASE_URL      = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL", "")
SERVICE_ROLE_KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
EMPRESA_ID        = os.environ.get("VIATIQ_EMPRESA_ID", "149fb49a-71ee-4c7a-851f-810e78914eee")

if not all([SUPABASE_URL, SERVICE_ROLE_KEY, EMPRESA_ID]):
    print("❌ Faltan variables de entorno:")
    print("   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VIATIQ_EMPRESA_ID")
    print("   Defínelas en el archivo .env.local de la raíz del proyecto.")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

# ── Helpers ────────────────────────────────────────────────────────────────────
def leer_csv(nombre_archivo: str) -> list[dict]:
    ruta = CSV_DIR / nombre_archivo
    if not ruta.exists():
        # También busca en la carpeta raíz
        ruta = PROJECT_DIR / nombre_archivo
    if not ruta.exists():
        print(f"  ⚠️  Archivo no encontrado: {nombre_archivo}")
        return []
    with open(ruta, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))

def precio_float(valor: str) -> float | None:
    if not valor or valor.strip() == "":
        return None
    try:
        return float(valor.replace(",", "").strip())
    except ValueError:
        return None

def iva_float(valor: str) -> float | None:
    if not valor or valor.strip() == "":
        return 15.0
    try:
        return float(valor.replace("%", "").strip())
    except ValueError:
        return 15.0

# ── 1. Importar PRODUCTOS ──────────────────────────────────────────────────────
def importar_productos():
    print("\n📦 Importando Productos...")
    filas = leer_csv("Productos_2026-09-28_1156.csv")
    if not filas:
        return 0

    registros = []
    for f in filas:
        nombre = f.get("Nombre del producto", "").strip()
        if not nombre:
            continue

        numero_pieza    = f.get("Número de pieza", "").strip() or None
        precio_unitario = precio_float(f.get("Precio unitario", ""))
        costo_compra    = precio_float(f.get("Costo de compra", ""))
        iva_pct         = iva_float(f.get("IVA", ""))
        descripcion     = f.get("Descripción", "").strip() or None
        fabricante      = f.get("Fabricante", "").strip() or None
        categoria       = f.get("Categoría del producto", "").strip() or None

        especificaciones = {}
        if fabricante:
            especificaciones["fabricante"] = fabricante
        if categoria:
            especificaciones["categoria_vitager"] = categoria
        if numero_pieza:
            especificaciones["numero_pieza"] = numero_pieza
        if precio_unitario is not None:
            especificaciones["precio_referencia_usd"] = precio_unitario
        if costo_compra is not None:
            especificaciones["costo_compra_usd"] = costo_compra
        if iva_pct is not None:
            especificaciones["iva_pct"] = iva_pct

        registros.append({
            "empresa_id":       EMPRESA_ID,
            "nombre":           nombre,
            "descripcion":      descripcion,
            "codigo":           numero_pieza,          # Si es None, el trigger genera PROD-XXX
            "tipo_seguimiento": "unidad",
            "unidad_medida":    "unidad",
            "estado":           "activo",
            "especificaciones": especificaciones if especificaciones else None,
        })

    if not registros:
        print("  Sin registros para importar.")
        return 0

    # Upsert por (empresa_id, codigo) — si no tiene código, INSERT siempre
    con_codigo    = [r for r in registros if r["codigo"]]
    sin_codigo    = [r for r in registros if not r["codigo"]]

    importados = 0

    if con_codigo:
        resp = supabase.table("productos_catalogo").upsert(
            con_codigo,
            on_conflict="codigo",
            ignore_duplicates=False
        ).execute()
        importados += len(resp.data)
        print(f"  ✅ {len(resp.data)} productos con código importados/actualizados")

    if sin_codigo:
        # Insert simple (sin código, el trigger asignará PROD-XXX)
        resp = supabase.table("productos_catalogo").insert(sin_codigo).execute()
        importados += len(resp.data)
        print(f"  ✅ {len(resp.data)} productos sin código insertados")

    return importados


# ── 2. Importar SERVICIOS ──────────────────────────────────────────────────────
def importar_servicios():
    print("\n🔧 Importando Servicios...")
    filas = leer_csv("Servicios_2026-09-28_1156.csv")
    if not filas:
        return 0

    registros = []
    for f in filas:
        nombre = f.get("Nombre del servicio", "").strip()
        if not nombre:
            continue

        precio_unitario = precio_float(f.get("Precio", ""))
        costo_compra    = precio_float(f.get("Costo de compra", ""))
        iva_pct         = iva_float(f.get("IVA", ""))
        descripcion     = f.get("Descripción", "").strip() or None
        id_servicio     = f.get("ID de servicio", "").strip() or None

        especificaciones: dict = {"tipo": "servicio"}
        if id_servicio:
            especificaciones["id_vitager"] = id_servicio
        if precio_unitario is not None:
            especificaciones["precio_referencia_usd"] = precio_unitario
        if costo_compra is not None:
            especificaciones["costo_compra_usd"] = costo_compra
        if iva_pct is not None:
            especificaciones["iva_pct"] = iva_pct

        registros.append({
            "empresa_id":       EMPRESA_ID,
            "nombre":           nombre,
            "descripcion":      descripcion,
            "codigo":           id_servicio,
            "tipo_seguimiento": "unidad",
            "unidad_medida":    "hora",
            "estado":           "activo",
            "especificaciones": especificaciones,
        })

    if not registros:
        print("  Sin registros para importar.")
        return 0

    con_codigo = [r for r in registros if r["codigo"]]
    sin_codigo = [r for r in registros if not r["codigo"]]
    importados = 0

    if con_codigo:
        resp = supabase.table("productos_catalogo").upsert(
            con_codigo,
            on_conflict="codigo",
            ignore_duplicates=False
        ).execute()
        importados += len(resp.data)
        print(f"  ✅ {len(resp.data)} servicios importados/actualizados")

    if sin_codigo:
        resp = supabase.table("productos_catalogo").insert(sin_codigo).execute()
        importados += len(resp.data)
        print(f"  ✅ {len(resp.data)} servicios sin código insertados")

    return importados


# ── 3. Importar CLIENTES (Organizaciones + Contactos) ─────────────────────────
def importar_clientes():
    print("\n🏢 Importando Clientes (Organizaciones + Contactos)...")

    orgs      = leer_csv("Organizaciones_2026-09-28_1157.csv")
    contactos = leer_csv("Contactos_2026-09-28_1157.csv")

    # Índice contactos por organización
    contactos_por_org: dict[str, dict] = {}
    for c in contactos:
        org_raw = c.get("Nombre de la organización", "")
        # Formato: "Accounts::::NombreOrg"
        org_nombre = org_raw.split("::::")[-1].strip() if "::::" in org_raw else org_raw.strip()
        if org_nombre:
            contactos_por_org[org_nombre] = c

    registros = []
    for o in orgs:
        nombre = o.get("Nombre de la organización", "").strip()
        if not nombre:
            continue

        # Buscar contacto asociado
        contacto = contactos_por_org.get(nombre, {})
        contacto_nombre = ""
        if contacto:
            cn = contacto.get("Nombre", "").strip()
            ca = contacto.get("Apellido", "").strip()
            contacto_nombre = f"{cn} {ca}".strip()

        correo    = o.get("Correo electrónico principal", "").strip() or \
                    contacto.get("Correo electrónico principal", "").strip() or None
        telefono  = o.get("Teléfono principal", "").strip() or \
                    contacto.get("Teléfono de oficina", "").strip() or \
                    contacto.get("Teléfono móvil", "").strip() or None
        sitio_web = o.get("Sitio web", "").strip() or None

        # Dirección: priorizar facturación de organización
        ciudad    = o.get("Ciudad de facturación", "").strip() or None
        estado_geo= o.get("Estado de facturación", "").strip() or None
        pais      = o.get("País de facturación", "").strip() or "Ecuador"
        direccion_parts = [p for p in [
            o.get("Dirección de facturación", "").strip(),
            ciudad, estado_geo, pais
        ] if p]
        direccion = ", ".join(direccion_parts) or None

        tipo_vitager = o.get("Tipo", "").strip()
        estado_crm   = "activo"  # Todos activos por defecto

        # Número de organización de Vitager como código
        num_org = o.get("Número de la organización", "").strip() or None

        registros.append({
            "empresa_id":       EMPRESA_ID,
            "nombre":           nombre,
            "codigo":           num_org,
            "correo":           correo,
            "telefono":         telefono if telefono and telefono != "+" else None,
            "direccion":        direccion,
            "estado":           estado_crm,
            "contacto_nombre":  contacto_nombre or None,
            "contacto_cargo":   contacto.get("Título", "").strip() or None,
        })

    if not registros:
        print("  Sin registros para importar.")
        return 0

    # Upsert por nombre + empresa_id (no hay unique constraint en nombre, usamos insert)
    # Para evitar duplicados, primero verificamos nombres existentes
    nombres = [r["nombre"] for r in registros]
    existentes_resp = supabase.table("clientes") \
        .select("nombre") \
        .eq("empresa_id", EMPRESA_ID) \
        .in_("nombre", nombres) \
        .execute()
    nombres_existentes = {e["nombre"] for e in (existentes_resp.data or [])}

    nuevos    = [r for r in registros if r["nombre"] not in nombres_existentes]
    existentes= [r for r in registros if r["nombre"] in nombres_existentes]

    importados = 0

    if nuevos:
        resp = supabase.table("clientes").insert(nuevos).execute()
        importados += len(resp.data)
        print(f"  ✅ {len(resp.data)} clientes nuevos insertados")

    if existentes:
        print(f"  ℹ️  {len(existentes)} clientes ya existían (se omiten):")
        for e in existentes:
            print(f"       • {e['nombre']}")

    return importados


# ── MAIN ───────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("  VIATIQ — Importación masiva desde Vitager CRM")
    print("=" * 60)
    print(f"  Empresa ID : {EMPRESA_ID}")
    print(f"  Supabase   : {SUPABASE_URL}")
    print()

    total_productos = importar_productos()
    total_servicios = importar_servicios()
    total_clientes  = importar_clientes()

    print()
    print("=" * 60)
    print("  RESUMEN FINAL")
    print("=" * 60)
    print(f"  Productos importados : {total_productos}")
    print(f"  Servicios importados : {total_servicios}")
    print(f"  Clientes importados  : {total_clientes}")
    print()
    print("  ✅ Importación completada.")
    print()
    print("  NOTAS IMPORTANTES:")
    print("  • Los precios (precio_referencia_usd) están en el campo")
    print("    'especificaciones' de cada producto. Al crear cotizaciones,")
    print("    los precios se ingresan en los items de la cotización.")
    print("  • Productos con precio $0 en Vitager fueron importados igual.")
    print("    Revisa y actualiza sus precios desde el catálogo en VIATIQ.")
    print("  • Las cotizaciones históricas (presupuestos) deben crearse")
    print("    manualmente desde la UI de VIATIQ.")

if __name__ == "__main__":
    main()
