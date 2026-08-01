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
 * Busca un proveedor por su campo `identificacion` (RUC/cédula).
 * Usado para auto-seleccionar el proveedor al cargar un XML/PDF de gasto.
 */
export async function getProveedorPorRuc(
  empresaId: string,
  ruc: string,
): Promise<Pick<Proveedor, "id" | "nombre"> | null> {
  const { data } = await supabase
    .from("proveedores")
    .select("id, nombre")
    .eq("empresa_id", empresaId)
    .eq("identificacion", ruc)
    .is("deleted_at", null)
    .maybeSingle();
  return data ?? null;
}
