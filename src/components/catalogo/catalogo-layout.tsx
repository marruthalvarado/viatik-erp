/**
 * Layout del Catálogo de Productos — lista, form, acciones CRUD.
 */
import { useState } from "react";
import { Plus, Pencil, Trash2, Package, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  useCatalogoCotizar,
  useCreateProductoCatalogo,
  useUpdateProductoCatalogo,
  useDeleteProductoCatalogo,
} from "@/hooks/entities/use-cotizaciones";
import type { ProductoCatalogo } from "@/services/cotizaciones";
import { ProductoForm } from "./producto-form";

export function CatalogoLayout() {
  const { data: productos = [], isLoading } = useCatalogoCotizar();
  const create = useCreateProductoCatalogo();
  const update = useUpdateProductoCatalogo();
  const remove = useDeleteProductoCatalogo();

  const [busqueda, setBusqueda] = useState("");
  const [form, setForm] = useState<{
    open: boolean;
    producto?: ProductoCatalogo;
  }>({ open: false });

  const filtrados = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.fabricante ?? "").toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.modelo ?? "").toLowerCase().includes(busqueda.toLowerCase()),
  );

  const handleGuardar = async (
    payload: Parameters<typeof create.mutateAsync>[0],
  ) => {
    if (form.producto) {
      await update.mutateAsync({ id: form.producto.id, payload });
      toast.success("Producto actualizado");
    } else {
      await create.mutateAsync(payload);
      toast.success("Producto creado");
    }
    setForm({ open: false });
  };

  const handleEliminar = async (p: ProductoCatalogo) => {
    if (!confirm(`¿Desactivar "${p.nombre}"?`)) return;
    await remove.mutateAsync(p.id);
    toast.success("Producto desactivado");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Catálogo de Productos</h1>
        <p className="text-sm text-muted-foreground">
          Productos y servicios disponibles para cotizar.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Buscar por nombre, fabricante o modelo…"
          className="max-w-xs h-8 text-sm"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Button size="sm" onClick={() => setForm({ open: true })}>
          <Plus className="size-4 mr-1" /> Nuevo producto
        </Button>
      </div>

      {/* Tabla */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Fabricante</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead className="text-right">Precio ref.</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Cargando catálogo…
                </TableCell>
              </TableRow>
            ) : filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No hay productos. Crea el primero.
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{p.nombre}</div>
                    {p.descripcion_tecnica && (
                      <div className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                        {p.descripcion_tecnica}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs gap-1">
                      {p.tipo_item === "servicio" ? (
                        <><Wrench className="size-3" /> Servicio</>
                      ) : (
                        <><Package className="size-3" /> Producto</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{p.fabricante ?? "—"}</TableCell>
                  <TableCell className="text-sm">{p.modelo ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {p.precio_referencial != null
                      ? `$${p.precio_referencial.toLocaleString("es-EC", { minimumFractionDigits: 2 })}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        p.estado === "activo"
                          ? "text-xs bg-green-50 text-green-700 border-green-200"
                          : "text-xs bg-gray-50 text-gray-500 border-gray-200"
                      }
                    >
                      {p.estado === "activo" ? "Activo" : "Descontinuado"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => setForm({ open: true, producto: p })}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => handleEliminar(p)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ProductoForm
        open={form.open}
        producto={form.producto}
        onGuardar={handleGuardar}
        onClose={() => setForm({ open: false })}
      />
    </div>
  );
}
