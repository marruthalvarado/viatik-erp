/**
 * ImportProtocoloPdfDialog
 * Permite cargar un PDF de protocolo de mantenimiento, extraer su texto con pdfjs,
 * enviarlo a la Edge Function de IA y previsualizar las secciones/actividades antes
 * de importarlas al protocolo actual.
 */
import { useRef, useState } from "react";
import { Upload, FileText, AlertCircle, ChevronDown, ChevronRight, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useExtractProtocoloPdf, useImportarSeccionesYActividades } from "@/hooks/entities/use-servicio-tecnico";
import type { SeccionIA } from "@/services/servicio-tecnico/protocolos";

// ── pdfjs CDN ────────────────────────────────────────────────────────────────

const PDFJS_VERSION = "3.11.174";
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadPdfjs(): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  if (win.pdfjsLib?.getDocument) return win.pdfjsLib;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar pdf.js desde CDN"));
    document.head.appendChild(script);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lib: any = win.pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
  return lib;
}

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageText = content.items.map((item: any) => item.str).join(" ");
    parts.push(pageText);
  }
  return parts.join("\n");
}

// ── Helpers UI ────────────────────────────────────────────────────────────────

function intervalLabel(meses: number | null): string {
  if (meses === null) return "Cada visita";
  if (meses === 6) return "Semestral";
  if (meses === 12) return "Anual";
  if (meses === 24) return "Bianual";
  if (meses === 60) return "Quinquenal";
  return `c/${meses} meses`;
}

// ── Preview de secciones extraídas ───────────────────────────────────────────

function SeccionPreview({ seccion, index }: { seccion: SeccionIA; index: number }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 text-sm font-medium text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          <span>{seccion.titulo}</span>
          <Badge variant="outline" className="text-xs">{intervalLabel(seccion.intervalo_meses)}</Badge>
        </span>
        <span className="text-xs text-muted-foreground">{seccion.actividades.length} actividades</span>
      </button>
      {open && (
        <div className="divide-y text-sm">
          {seccion.actividades.map((act, ai) => (
            <div key={ai} className="flex gap-2 px-3 py-1.5">
              {act.numero_paso && (
                <span className="font-mono text-xs text-muted-foreground w-10 shrink-0 pt-0.5">{act.numero_paso}</span>
              )}
              <span className={`flex-1 ${act.es_critico ? "text-destructive font-medium" : ""}`}>
                {act.descripcion}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">{act.tipo_campo}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Dialog principal ──────────────────────────────────────────────────────────

type Phase = "idle" | "extracting" | "ai" | "preview" | "importing" | "done";

interface Props {
  open: boolean;
  protocoloId: string;
  protocoloNombre: string;
  onClose: () => void;
  onImported: () => void;
}

export function ImportProtocoloPdfDialog({
  open, protocoloId, protocoloNombre, onClose, onImported,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [secciones, setSecciones] = useState<SeccionIA[] | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const extract = useExtractProtocoloPdf();
  const importar = useImportarSeccionesYActividades();

  const totalActividades = secciones?.reduce((s, sec) => s + sec.actividades.length, 0) ?? 0;

  async function handleFile(file: File) {
    setFileName(file.name);
    setError(null);
    setSecciones(null);

    try {
      setPhase("extracting");
      setProgress(20);
      const text = await extractTextFromPdf(file);

      if (text.trim().length < 50) {
        throw new Error("El PDF no contiene texto extraíble. Puede ser un PDF escaneado.");
      }

      setPhase("ai");
      setProgress(55);
      const secs = await extract.mutateAsync(text);

      if (!secs || secs.length === 0) {
        throw new Error("La IA no pudo extraer actividades del PDF. Verifica que sea un protocolo de mantenimiento.");
      }

      setSecciones(secs);
      setPhase("preview");
      setProgress(100);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("idle");
      setProgress(0);
    }
  }

  async function handleImport() {
    if (!secciones) return;
    setPhase("importing");
    setProgress(50);
    try {
      await importar.mutateAsync({ protocoloId, secciones });
      setPhase("done");
      setProgress(100);
      setTimeout(() => {
        onImported();
        handleClose();
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("preview");
      setProgress(100);
    }
  }

  function handleClose() {
    setPhase("idle");
    setProgress(0);
    setError(null);
    setSecciones(null);
    setFileName("");
    onClose();
  }

  const isLoading = phase === "extracting" || phase === "ai" || phase === "importing";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isLoading) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar actividades desde PDF</DialogTitle>
          <DialogDescription className="text-xs">
            Protocolo: <span className="font-medium">{protocoloNombre}</span>
            {" — "}Las actividades se agregarán en nuevas secciones.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Zona de carga */}
          {phase === "idle" && (
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file?.type === "application/pdf") handleFile(file);
              }}
            >
              <Upload className="size-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Arrastra un PDF o haz clic para seleccionar</p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF de mantenimiento preventivo del fabricante (GE, Siemens, Philips, etc.)
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
            </div>
          )}

          {/* Progreso */}
          {(isLoading || phase === "done") && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                {phase === "done"
                  ? <CheckCircle2 className="size-4 text-green-600" />
                  : <Loader2 className="size-4 animate-spin text-primary" />
                }
                <span>
                  {phase === "extracting" && "Extrayendo texto del PDF…"}
                  {phase === "ai" && "La IA está analizando el protocolo…"}
                  {phase === "importing" && "Creando secciones y actividades…"}
                  {phase === "done" && "¡Importación completada!"}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              {fileName && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="size-3.5" />
                  {fileName}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Error en la extracción</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Preview de secciones */}
          {phase === "preview" && secciones && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {secciones.length} secciones · {totalActividades} actividades extraídas
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setPhase("idle");
                    setSecciones(null);
                    setError(null);
                    setProgress(0);
                  }}
                >
                  Cambiar PDF
                </Button>
              </div>
              {secciones.map((sec, i) => (
                <SeccionPreview key={i} seccion={sec} index={i} />
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          {phase === "preview" && secciones && (
            <Button onClick={handleImport} disabled={importar.isPending}>
              {importar.isPending
                ? "Importando…"
                : `Importar ${totalActividades} actividades`
              }
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
