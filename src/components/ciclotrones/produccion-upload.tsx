/**
 * Diálogo de carga de uno o varios archivos de batch (.log o .ods).
 * Soporta selección múltiple (100+ archivos) y drag-and-drop de carpeta.
 * Procesa los archivos en secuencia usando el hook useSubirAnalizarBatch.
 */
import { useRef, useState } from "react";
import { Upload, FileText, Loader2, X, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { CiclotrónParametros } from "@/services/servicio-tecnico/ciclotrones";
import { useSubirAnalizarBatch } from "@/hooks/entities/use-ciclotrones";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ciclotrónId: string;
  params: CiclotrónParametros;
}

const ACCEPT = ".log,.txt,.ods,.xlsx";
const ACCEPTED_EXTS = ["log", "txt", "ods", "xlsx"];

function isAccepted(f: File) {
  const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
  return ACCEPTED_EXTS.includes(ext);
}

export function ProduccionUpload({ open, onOpenChange, ciclotrónId, params }: Props) {
  const { mutateAsync } = useSubirAnalizarBatch();
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [notas, setNotas] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // Estado durante el procesamiento
  const [processing, setProcessing] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [currentFile, setCurrentFile] = useState("");

  function addFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming).filter(isAccepted);
    if (arr.length === 0) return;
    setFiles((prev) => {
      // deduplicar por nombre+tamaño
      const existing = new Set(prev.map((f) => `${f.name}|${f.size}`));
      const novel = arr.filter((f) => !existing.has(`${f.name}|${f.size}`));
      return [...prev, ...novel];
    });
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    // reset input para permitir volver a seleccionar los mismos archivos
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const items = e.dataTransfer.items;
    if (items) {
      // Recolectar archivos de items (soporta carpetas vía webkitGetAsEntry)
      const collected: File[] = [];
      const promises: Promise<void>[] = [];

      function traverseEntry(entry: FileSystemEntry): Promise<void> {
        if (entry.isFile) {
          return new Promise((res) => {
            (entry as FileSystemFileEntry).file((f) => {
              collected.push(f);
              res();
            });
          });
        } else if (entry.isDirectory) {
          const reader = (entry as FileSystemDirectoryEntry).createReader();
          return new Promise((res) => {
            reader.readEntries(async (entries) => {
              await Promise.all(entries.map(traverseEntry));
              res();
            });
          });
        }
        return Promise.resolve();
      }

      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) promises.push(traverseEntry(entry));
      }

      void Promise.all(promises).then(() => addFiles(collected));
    } else {
      addFiles(e.dataTransfer.files);
    }
  }

  async function handleSubmit() {
    if (files.length === 0) return;
    setProcessing(true);
    setDoneCount(0);
    setErrorCount(0);

    let done = 0;
    let errors = 0;

    for (const file of files) {
      setCurrentFile(file.name);
      try {
        await mutateAsync({
          ciclotrónId,
          file,
          params,
          notas: notas.trim() || undefined,
        });
        done++;
        setDoneCount(done);
      } catch {
        errors++;
        setErrorCount(errors);
      }
    }

    setProcessing(false);
    setCurrentFile("");
    setFiles([]);
    setNotas("");
    onOpenChange(false);
  }

  function handleClose() {
    if (processing) return;
    setFiles([]);
    setNotas("");
    setDoneCount(0);
    setErrorCount(0);
    onOpenChange(false);
  }

  const total = files.length;
  const progressPct = total > 0 ? Math.round(((doneCount + errorCount) / total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cargar batch{total > 1 ? `s (${total} archivos)` : " de producción"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
              ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
              ${processing ? "pointer-events-none opacity-50" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !processing && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={handleInputChange}
            />
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Upload className="h-7 w-7" />
              <span className="text-sm font-medium">
                {total > 0
                  ? "Haz clic o arrastra para añadir más"
                  : "Arrastra archivos o carpetas, o haz clic"}
              </span>
              <span className="text-xs">Formatos: .log, .txt, .ods, .xlsx · Sin límite de archivos</span>
            </div>
          </div>

          {/* Lista de archivos seleccionados */}
          {total > 0 && (
            <div className="rounded-md border bg-muted/30 max-h-48 overflow-y-auto divide-y text-sm">
              {files.map((f, i) => (
                <div key={`${f.name}|${i}`} className="flex items-center gap-2 px-3 py-1.5">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-xs">{f.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {(f.size / 1024).toFixed(0)} KB
                  </span>
                  {!processing && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Barra de progreso mientras procesa */}
          {processing && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="truncate max-w-[70%]">{currentFile}</span>
                <span>{doneCount + errorCount} / {total}</span>
              </div>
              <Progress value={progressPct} className="h-2" />
              {errorCount > 0 && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errorCount} archivo{errorCount > 1 ? "s" : ""} con error
                </p>
              )}
              {doneCount > 0 && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {doneCount} procesado{doneCount > 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}

          <Alert className="text-xs">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Cada archivo se analiza en el navegador. Los batches se procesan en secuencia;
              puedes seleccionar 100+ archivos a la vez.
            </AlertDescription>
          </Alert>

          <div className="space-y-1.5">
            <Label>Notas (opcional — aplica a todos los archivos)</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Observaciones del operador para este lote…"
              disabled={processing}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={processing}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={total === 0 || processing}>
            {processing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando…</>
            ) : (
              total > 1 ? `Cargar ${total} archivos` : "Cargar y analizar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
