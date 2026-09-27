import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/common/toast";
import {
  TIPO_CONTRIBUYENTE_LABELS,
  periodoIva,
} from "@/services/impuestos";
import type { TipoContribuyente } from "@/services/impuestos";
import {
  useTipoContribuyente,
  useSetTipoContribuyente,
} from "@/hooks/entities/use-impuestos";

interface Props {
  empresaId: string;
}

export function TipoContribuyenteConfig({ empresaId }: Props) {
  const { data: tipoActual, isLoading } = useTipoContribuyente(empresaId);
  const setTipo = useSetTipoContribuyente();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<TipoContribuyente>("sociedad");

  function handleEdit() {
    setSelected(tipoActual ?? "sociedad");
    setEditing(true);
  }

  async function handleSave() {
    try {
      await setTipo.mutateAsync({ empresaId, tipo: selected });
      toast.success("Tipo de contribuyente actualizado");
      setEditing(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (isLoading) return null;

  const tipo = tipoActual ?? "sociedad";
  const periodo = periodoIva(tipo);

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
      <Settings className="size-4 text-muted-foreground shrink-0" />
      {editing ? (
        <>
          <Select value={selected} onValueChange={(v) => setSelected(v as TipoContribuyente)}>
            <SelectTrigger className="h-8 w-72 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(TIPO_CONTRIBUYENTE_LABELS) as [TipoContribuyente, string][]).map(
                ([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleSave} disabled={setTipo.isPending}>
            Guardar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">{TIPO_CONTRIBUYENTE_LABELS[tipo]}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              · IVA {periodo === "mensual" ? "mensual (Form. 104)" : "semestral (Form. 104A)"}
            </span>
          </div>
          <Button size="sm" variant="ghost" onClick={handleEdit} className="shrink-0">
            Cambiar
          </Button>
        </>
      )}
    </div>
  );
}
