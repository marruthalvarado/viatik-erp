/**
 * PropuestaComercialSection
 * Configura los textos que se incluyen automáticamente en las
 * exportaciones PDF/Word de cotizaciones: resumen ejecutivo y
 * términos & condiciones.
 */
import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/common/toast";
import { LoadingState } from "@/components/common/loading-state";
import { useCompany } from "@/contexts/company-context";
import { supabase } from "@/integrations/supabase/client";

export function PropuestaComercialSection() {
  const { empresaActivaId } = useCompany();

  const [resumen,   setResumen]   = useState("");
  const [terminos,  setTerminos]  = useState("");
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    if (!empresaActivaId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("parametros_sistema")
        .select("clave, valor")
        .eq("empresa_id", empresaActivaId)
        .in("clave", ["propuesta_resumen_ejecutivo", "propuesta_terminos_condiciones"]);
      if (cancelled) return;
      if (data) {
        const map = Object.fromEntries(data.map((r) => [r.clave, r.valor ?? ""]));
        setResumen(map["propuesta_resumen_ejecutivo"] ?? "");
        setTerminos(map["propuesta_terminos_condiciones"] ?? "");
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [empresaActivaId]);

  async function handleSave() {
    if (!empresaActivaId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("parametros_sistema").upsert(
        [
          {
            empresa_id: empresaActivaId,
            clave:      "propuesta_resumen_ejecutivo",
            valor:      resumen,
            descripcion: "Resumen ejecutivo para propuestas técnico-comerciales",
          },
          {
            empresa_id: empresaActivaId,
            clave:      "propuesta_terminos_condiciones",
            valor:      terminos,
            descripcion: "Términos y condiciones para propuestas técnico-comerciales",
          },
        ],
        { onConflict: "empresa_id,clave" },
      );
      if (error) throw error;
      toast.success("Propuesta comercial guardada correctamente.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          Propuesta Comercial
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Estos textos se incluirán automáticamente en todas las cotizaciones
          exportadas en PDF o Word.
        </p>
      </div>

      {loading ? (
        <LoadingState label="Cargando…" />
      ) : (
        <div className="space-y-5 max-w-2xl">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Resumen ejecutivo</label>
            <p className="text-xs text-muted-foreground">
              Aparece en la portada de cada cotización (descripción de la empresa,
              experiencia y propuesta de valor).
            </p>
            <Textarea
              value={resumen}
              onChange={(e) => setResumen(e.target.value)}
              placeholder="Descripción de la empresa, experiencia y propuesta de valor…"
              className="min-h-[140px] text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Términos y condiciones</label>
            <p className="text-xs text-muted-foreground">
              Aparece al cierre de cada cotización (condiciones de entrega, pago,
              garantías, etc.).
            </p>
            <Textarea
              value={terminos}
              onChange={(e) => setTerminos(e.target.value)}
              placeholder="Condiciones comerciales, de entrega, de pago, garantías…"
              className="min-h-[140px] text-sm"
            />
          </div>

          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar propuesta comercial"}
          </Button>
        </div>
      )}
    </div>
  );
}
