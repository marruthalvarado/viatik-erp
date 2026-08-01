import { createCrudService } from "./_factory";
import { supabase } from "@/integrations/supabase/client";
import type { Proveedor, ProveedorInsert, ProveedorUpdate } from "@/types/entities";

export const proveedoresService = createCrudService<Proveedor, ProveedorInsert, ProveedorUpdate>(
  "proveedores",
  {
    empresaCol: "empresa_id",
    searchCols: ["nombre", "correo", "identificacion", "codigo", "ciudad"],
    defaultSort: { column: "created_at", ascending: false },
    softDeleteCol: "deleted_at",
  },
);

/**
 * Genera todas las variantes de un RUC ecuatoriano para comparación robusta.
 * Cubre casos donde el cero inicial fue omitido al guardar en la BD:
 *   "0704529593001" (13 dígitos) ↔ "704529593001" (12 dígitos, sin cero inicial)
 */
export function rucVariants(ruc: string): string[] {
  const digits = ruc.replace(/\D/g, "");
  const set = new Set<string>([digits]);
  // 12 dígitos → RUC de 13 con cero omitido
  if (digits.length === 12) set.add(digits.padStart(13, "0"));
  // 13 dígitos iniciando en 0 → alguien lo guardó sin el cero
  if (digits.length === 13 && digits.startsWith("0")) set.add(digits.slice(1));
  return Array.from(set);
}

/**
 * Busca un proveedor por su campo `identificacion` (RUC/cédula).
 * Tolera variantes con/sin cero inicial para cubrir datos históricos.
 */
export async function getProveedorPorRuc(
  empresaId: string,
  ruc: string,
): Promise<Pick<Proveedor, "id" | "nombre"> | null> {
  const candidates = rucVariants(ruc);
  const { data } = await supabase
    .from("proveedores")
    .select("id, nombre")
    .eq("empresa_id", empresaId)
    .in("identificacion", candidates)
    .is("deleted_at", null)
    .limit(1);
  return data?.[0] ?? null;
}
