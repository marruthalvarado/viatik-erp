/**
 * OrdenDetalleSheet — Vista completa y unificada de una Orden de Servicio.
 *
 * Reemplaza el panel lateral de Checklist + el diálogo Cerrar Orden con una
 * sola pantalla que el ingeniero puede gestionar de arriba a abajo:
 *   1. Actividades del protocolo (solo OS preventiva)
 *   2. Informe de trabajo (trabajos realizados + observaciones)
 *   3. Repuestos y materiales
 *   4. Costos
 *   5. Firmas
 *
 * Generar PDF / Word disponible siempre en el header.
 * "Cerrar orden" disponible en el footer cuando la OS está activa.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  FileDown, FileText, CheckCircle2, XCircle, Clock,
  Loader2, ClipboardCheck, Wrench, Plus, Trash2,
  Package, PenLine, DollarSign, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  useActualizarOrdenServicio,
  useCerrarOrdenServicio,
  useGuardarFirmaOrden,
} from "@/hooks/entities/use-servicio-tecnico";
import type { OrdenConRelaciones, OsRepuestoPayload } from "@/services/servicio-tecnico/ordenes-servicio";
import { getOsActividades } from "@/services/servicio-tecnico/ordenes-servicio";
import { OsChecklist } from "./os-checklist";
import { FirmaPad, type FirmaData } from "./firma-pad";
import {
  exportOrdenServicioPdf,
  exportOrdenServicioDocx,
} from "@/services/export/orden-servicio-export";
import { useCompany } from "@/contexts/company-context";

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  pendiente:  { label: "Pendiente",  className: "bg-gray-100 text-gray-600 border-gray-200",      icon: Clock },
  programada: { label: "Programada", className: "bg-blue-50 text-blue-700 border-blue-200",       icon: Clock },
  en_proceso: { label: "En proceso", className: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: Wrench },
  completada: { label: "Completada", className: "bg-green-50 text-green-700 border-green-200",    icon: CheckCircle2 },
  cancelada:  { label: "Cancelada",  className: "bg-red-50 text-red-600 border-red-200",          icon: XCircle },
};

const TIPO_LABEL: Record<string, string> = {
  preventivo:    "Preventivo",
  correctivo:    "Correctivo",
  instalacion:   "Instalación",
  actualizacion: "Actualización",
  repuesto:      "Repuesto",
};

const fmtFecha = (d: string | null | undefined) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("es-EC", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return "—"; }
};

const emptyFirma = (): FirmaData => ({ nombre: "", cargo: "", dataUrl: null });

// ─── Subcomponente: Encabezado de sección ─────────────────────────────────────

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b mb-4">
      <Icon className="size-4 text-primary shrink-0" />
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
  );
}

// ─── Subcomponente: Editor de repuestos ───────────────────────────────────────

type LocalRep = OsRepuestoPayload & { _key: string };

function RepuestosEditor({
  ordenId,
  initial,
  disabled,
}: {
  ordenId: string;
  initial: OsRepuestoPayload[];
  disabled?: boolean;
}) {
  const actualizar = useActualizarOrdenServicio();
  const [rows, setRows] = useState<LocalRep[]>(() =>
    initial.map((r, i) => ({ ...r, _key: String(i) })),
  );

  const persist = async (newRows: LocalRep[]) => {
    const payload: OsRepuestoPayload[] = newRows.map(({ _key: _k, ...r }) => r);
    await actualizar.mutateAsync({ id: ordenId, payload: {}, repuestos: payload }).catch(() => {});
  };

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { descripcion: "", cantidad: 1, precio_unitario: 0, _key: Date.now().toString() },
    ]);

  const removeRow = async (key: string) => {
    const updated = rows.filter((r) => r._key !== key);
    setRows(updated);
    await persist(updated);
  };

  const upd = (key: string, field: keyof OsRepuestoPayload, value: string | number) =>
    setRows((prev) =>
      prev.map((r) => r._key === key ? { ...r, [field]: value } : r),
    );

  const total = rows.reduce((s, r) => s + (r.cantidad ?? 1) * (r.precio_unitario ?? 0), 0);

  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <div className="grid grid-cols-[1fr_72px_88px_68px_36px] gap-2 px-1 mb-1">
          {["Descripción", "Cant.", "P. Unitario", "Subtotal", ""].map((h) => (
            <span key={h} className="text-xs text-muted-foreground font-medium">{h}</span>
          ))}
        </div>
      )}

      {rows.map((row) => (
        <div key={row._key} className="grid grid-cols-[1fr_72px_88px_68px_36px] gap-2 items-center">
          <Input
            value={row.descripcion}
            onChange={(e) => upd(row._key, "descripcion", e.target.value)}
            onBlur={() => persist(rows)}
            placeholder="Material o repuesto…"
            disabled={disabled}
            className="h-8 text-sm"
          />
          <Input
            type="number"
            min={1}
            value={row.cantidad ?? 1}
            onChange={(e) => upd(row._key, "cantidad", Math.max(1, parseInt(e.target.value) || 1))}
            onBlur={() => persist(rows)}
            disabled={disabled}
            className="h-8 text-sm text-center"
          />
          <Input
            type="number"
            min={0}
            step="0.01"
            value={row.precio_unitario ?? 0}
            onChange={(e) => upd(row._key, "precio_unitario", parseFloat(e.target.value) || 0)}
            onBlur={() => persist(rows)}
            disabled={disabled}
            className="h-8 text-sm text-right"
          />
          <div className="text-sm text-right text-muted-foreground">
            ${((row.cantidad ?? 1) * (row.precio_unitario ?? 0)).toFixed(2)}
          </div>
          {!disabled && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive hover:text-destructive"
              onClick={() => removeRow(row._key)}
              type="button"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      ))}

      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground py-2 italic">
          Sin repuestos ni materiales registrados.
        </p>
      )}

      {!disabled && (
        <Button variant="outline" size="sm" onClick={addRow} type="button" className="mt-1">
          <Plus className="size-3.5 mr-1.5" />Agregar material / repuesto
        </Button>
      )}

      {rows.length > 0 && (
        <div className="flex justify-end text-sm pt-1">
          <span className="text-muted-foreground mr-2">Total repuestos:</span>
          <span className="font-semibold">${total.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  orden: OrdenConRelaciones | null;
  open: boolean;
  onClose: () => void;
}

export function OrdenDetalleSheet({ orden, open, onClose }: Props) {
  const { empresaActiva }   = useCompany();
  const actualizar          = useActualizarOrdenServicio();
  const cerrar              = useCerrarOrdenServicio();
  const firmaOrdenMut       = useGuardarFirmaOrden();

  const [trabajos,      setTrabajos]      = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [costo,         setCosto]         = useState("");
  const [firmaCliente,  setFirmaCliente]  = useState<FirmaData>(emptyFirma());
  const [firmaTecnico,  setFirmaTecnico]  = useState<FirmaData>(emptyFirma());
  const [cerrando,      setCerrando]      = useState(false);
  const [exportingPdf,  setExportingPdf]  = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [savedAt,       setSavedAt]       = useState<Date | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-sincroniza los campos cuando cambia la orden abierta
  useEffect(() => {
    if (orden) {
      setTrabajos(orden.trabajos_realizados ?? "");
      setObservaciones(orden.observaciones ?? "");
      setCosto(orden.costo_mano_obra != null ? String(orden.costo_mano_obra) : "");
      setFirmaCliente(emptyFirma());
      setFirmaTecnico(emptyFirma());
    }
  }, [orden?.id]);

  const editable = orden?.estado !== "completada" && orden?.estado !== "cancelada";

  // Opciones de empresa para el export
  const exportOpts = empresaActiva
    ? {
        empresa: {
          nombre:    empresaActiva.nombre,
          ruc:       empresaActiva.ruc,
          telefono:  empresaActiva.telefono,
          correo:    empresaActiva.correo,
          direccion: empresaActiva.direccion,
          logo_url:  empresaActiva.logo_url,
        },
      }
    : {};

  // Orden enriquecida con los valores actuales del formulario (para export sin esperar autosave)
  const ordenParaExport = (): OrdenConRelaciones => ({
    ...orden!,
    trabajos_realizados: trabajos || null,
    observaciones:       observaciones || null,
    costo_mano_obra:     parseFloat(costo) || 0,
  });

  // Indicador visual de guardado
  const flashSaved = useCallback(() => {
    setSavedAt(new Date());
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSavedAt(null), 3000);
  }, []);

  // Autosave silencioso al perder foco
  const autoSave = async (field: Partial<Record<string, unknown>>) => {
    if (!orden || !editable) return;
    try {
      await actualizar.mutateAsync({ id: orden.id, payload: field as never });
      flashSaved();
    } catch { /* silencioso */ }
  };

  const handleGenerarPdf = async () => {
    if (!orden) return;
    setExportingPdf(true);
    try {
      const actividades = await getOsActividades(orden.id).catch(() => []);
      await exportOrdenServicioPdf(ordenParaExport(), { ...exportOpts, actividades });
    } catch {
      toast.error("Error al generar el PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleGenerarDocx = async () => {
    if (!orden) return;
    setExportingDocx(true);
    try {
      const actividades = await getOsActividades(orden.id).catch(() => []);
      await exportOrdenServicioDocx(ordenParaExport(), { ...exportOpts, actividades });
    } catch {
      toast.error("Error al generar el Word");
    } finally {
      setExportingDocx(false);
    }
  };

  const handleCerrar = async () => {
    if (!orden) return;
    if (!trabajos.trim()) {
      toast.error("Completa 'Trabajos realizados' antes de cerrar la orden.");
      return;
    }
    setCerrando(true);
    try {
      await cerrar.mutateAsync({
        id:                   orden.id,
        trabajos_realizados:  trabajos,
        observaciones:        observaciones || undefined,
        costo_mano_obra:      parseFloat(costo) || undefined,
      });

      const tieneFirma = firmaCliente.nombre || firmaCliente.dataUrl || firmaTecnico.dataUrl;
      if (tieneFirma) {
        await firmaOrdenMut.mutateAsync({
          orden_id: orden.id,
          firma: {
            firma_cliente_nombre: firmaCliente.nombre || null,
            firma_cliente_cargo:  firmaCliente.cargo  || null,
            firma_cliente_data:   firmaCliente.dataUrl,
            firma_tecnico_data:   firmaTecnico.dataUrl,
          },
        });
      }

      toast.success("Orden cerrada correctamente");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCerrando(false);
    }
  };

  if (!orden) return null;

  const cfg   = ESTADO_CFG[orden.estado ?? ""] ?? ESTADO_CFG["pendiente"];
  const Icon  = cfg.icon;

  const costoMO  = parseFloat(costo) || 0;
  const costoRep = (orden.repuestos ?? []).reduce(
    (s, r) => s + (r.cantidad ?? 0) * (r.precio_unitario ?? 0), 0,
  );
  const totalOS  = costoMO + costoRep;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col overflow-hidden">

        {/* ── HEADER FIJO ───────────────────────────────────── */}
        <SheetHeader className="px-6 py-4 border-b bg-background shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base flex flex-wrap items-center gap-2">
                <ClipboardCheck className="size-4 text-primary shrink-0" />
                <span className="font-mono">{orden.numero ?? "—"}</span>
                <Badge variant="outline" className={`text-xs ${cfg.className}`}>
                  <Icon className="size-3 mr-1" />{cfg.label}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {TIPO_LABEL[orden.tipo ?? ""] ?? orden.tipo ?? "—"}
                </Badge>
              </SheetTitle>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
                {orden.equipo?.nombre && <span className="font-medium text-foreground">{orden.equipo.nombre}</span>}
                {(orden.cliente?.nombre ?? orden.equipo?.cliente?.nombre) && (
                  <span>{orden.cliente?.nombre ?? orden.equipo?.cliente?.nombre}</span>
                )}
                {orden.tecnico && (
                  <span>{orden.tecnico.nombres} {orden.tecnico.apellidos}</span>
                )}
                {orden.fecha_programada && <span>Prog. {fmtFecha(orden.fecha_programada)}</span>}
                {orden.fecha_cierre     && <span>Cerrada {fmtFecha(orden.fecha_cierre)}</span>}
              </div>
            </div>

            {/* Botones de export */}
            <div className="flex gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                disabled={exportingPdf}
                onClick={handleGenerarPdf}
                title="Descargar PDF"
              >
                {exportingPdf
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <FileDown className="size-3.5" />}
                <span className="ml-1.5 hidden sm:inline text-xs">PDF</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={exportingDocx}
                onClick={handleGenerarDocx}
                title="Descargar Word"
              >
                {exportingDocx
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <FileText className="size-3.5" />}
                <span className="ml-1.5 hidden sm:inline text-xs">Word</span>
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* ── CONTENIDO SCROLLEABLE ────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">

          {/* 1. Actividades del protocolo — solo OS preventiva */}
          {orden.tipo === "preventivo" && (
            <section>
              <SectionHeader icon={ClipboardCheck} title="Actividades del protocolo" />
              <OsChecklist
                ordenId={orden.id}
                equipoId={orden.equipo_id ?? orden.equipo?.id ?? null}
              />
            </section>
          )}

          {/* 2. Informe de trabajo */}
          <section>
            <SectionHeader icon={PenLine} title="Informe de trabajo" />
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Trabajos realizados
                  {editable && <span className="text-destructive ml-0.5">*</span>}
                </Label>
                <Textarea
                  value={trabajos}
                  onChange={(e) => setTrabajos(e.target.value)}
                  onBlur={() => autoSave({ trabajos_realizados: trabajos || null })}
                  placeholder="Describe detalladamente los trabajos realizados…"
                  rows={4}
                  disabled={!editable}
                  className="text-sm resize-none"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Observaciones y recomendaciones
                </Label>
                <Textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  onBlur={() => autoSave({ observaciones: observaciones || null })}
                  placeholder="Observaciones, recomendaciones al cliente…"
                  rows={3}
                  disabled={!editable}
                  className="text-sm resize-none"
                />
              </div>
            </div>
          </section>

          {/* 3. Repuestos y materiales */}
          <section>
            <SectionHeader icon={Package} title="Repuestos y materiales" />
            <RepuestosEditor
              key={orden.id}
              ordenId={orden.id}
              initial={(orden.repuestos ?? []).map((r) => ({
                descripcion:     r.descripcion,
                cantidad:        r.cantidad ?? 1,
                precio_unitario: r.precio_unitario ?? 0,
                notas:           r.notas ?? null,
              }))}
              disabled={!editable}
            />
          </section>

          {/* 4. Costos */}
          <section>
            <SectionHeader icon={DollarSign} title="Costos" />
            <div className="space-y-3 max-w-sm">
              <div className="flex items-center gap-4">
                <Label className="text-sm w-40 shrink-0 text-muted-foreground">Mano de obra ($)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={costo}
                  onChange={(e) => setCosto(e.target.value)}
                  onBlur={() => autoSave({ costo_mano_obra: parseFloat(costo) || 0 })}
                  placeholder="0.00"
                  disabled={!editable}
                  className="w-32 text-sm"
                />
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="w-40 shrink-0">Repuestos / materiales</span>
                <span>${costoRep.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex items-center gap-4 font-semibold">
                <span className="w-40 shrink-0 text-sm">Total orden</span>
                <span className="text-lg">${totalOS.toFixed(2)}</span>
              </div>
            </div>
          </section>

          {/* 5a. Firmas — solo si la OS está activa */}
          {editable && (
            <section>
              <SectionHeader icon={PenLine} title="Firmas" />
              <div className="space-y-5">
                <FirmaPad
                  title="Firma del técnico"
                  value={firmaTecnico}
                  onChange={setFirmaTecnico}
                />
                <Separator />
                <FirmaPad
                  title="Firma del cliente / responsable"
                  value={firmaCliente}
                  onChange={setFirmaCliente}
                />
              </div>
            </section>
          )}

          {/* 5b. Firmas guardadas — solo si la OS está cerrada */}
          {!editable && (orden.firma_tecnico_url || orden.firma_cliente_url) && (
            <section>
              <SectionHeader icon={PenLine} title="Firmas registradas" />
              <div className="grid grid-cols-2 gap-6">
                {orden.firma_tecnico_url && (
                  <div className="text-center space-y-1">
                    <img
                      src={orden.firma_tecnico_url}
                      alt="Firma técnico"
                      className="max-h-24 mx-auto border rounded bg-white"
                    />
                    <p className="text-xs text-muted-foreground">
                      {orden.tecnico
                        ? `${orden.tecnico.nombres} ${orden.tecnico.apellidos}`
                        : "Técnico"}
                    </p>
                  </div>
                )}
                {orden.firma_cliente_url && (
                  <div className="text-center space-y-1">
                    <img
                      src={orden.firma_cliente_url}
                      alt="Firma cliente"
                      className="max-h-24 mx-auto border rounded bg-white"
                    />
                    <p className="text-xs text-muted-foreground">
                      {orden.cliente?.nombre ?? orden.equipo?.cliente?.nombre ?? "Cliente"}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* ── FOOTER FIJO ───────────────────────────────────── */}
        {editable && (
          <div className="border-t px-6 py-4 bg-background shrink-0 space-y-3">
            {/* Indicador de guardado automático */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <AlertCircle className="size-3.5 shrink-0" />
                Los cambios se guardan automáticamente.
              </span>
              {savedAt && (
                <span className="flex items-center gap-1 text-green-700 font-medium animate-in fade-in duration-300">
                  <CheckCircle2 className="size-3.5" />
                  Guardado {savedAt.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              )}
            </div>
            {!trabajos.trim() && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <AlertCircle className="size-3.5 shrink-0" />
                Completa "Trabajos realizados" para poder cerrar la orden.
              </p>
            )}
            <Button
              className="w-full"
              disabled={cerrando || !trabajos.trim()}
              onClick={handleCerrar}
            >
              {cerrando
                ? <Loader2 className="size-4 mr-2 animate-spin" />
                : <CheckCircle2 className="size-4 mr-2" />}
              {cerrando ? "Cerrando…" : "Cerrar orden y registrar firma"}
            </Button>
          </div>
        )}

        {!editable && (
          <div className="border-t px-6 py-3 bg-muted/30 shrink-0 text-center">
            <p className="text-xs text-muted-foreground">
              Esta orden está <strong>{cfg.label.toLowerCase()}</strong> — vista de solo lectura.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
