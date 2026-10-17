/**
 * Diálogo de carga de archivo de batch (.log o .ods).
 * Al confirmar dispara el hook useSubirAnalizarBatch que parsea + analiza + guarda.
 */
import { useRef, useState } from "react";
import { Upload, FileText, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

export function ProduccionUpload({ open, onOpenChange, ciclotrónId, params }: Props) {
  const { mutateAsync, isPending } = useSubirAnalizarBatch();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notas, setNotas] = useState("");
  const [dragOver, setDragOver] = useState(false);

  function handleFileSelect(f: File) {
    setFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }

  async function handleSubmit() {
    if (!file) return;
    await mutateAsync({ ciclotrónId, file, params, notas: notas.trim() || undefined });
    setFile(null);
    setNotas("");
    onOpenChange(false);
  }

  function handleClose() {
    if (isPending) return;
    setFile(null);
    setNotas("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cargar batch de producción</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2 text-sm">
                <FileText className="h-8 w-8 text-primary" />
                <span className="font-medium">{file.name}</span>
                <span className="text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-8 w-8" />
                <span className="text-sm">Arrastra o haz clic para seleccionar</span>
                <span className="text-xs">Formatos: .log, .txt, .ods, .xlsx</span>
              </div>
            )}
          </div>

          <Alert className="text-xs">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              El archivo se analizará en el navegador. Los datos del batch y las
              anomalías detectadas quedarán guardados en el sistema.
            </AlertDescription>
          </Alert>

          <div className="space-y-1.5">
            <Label>Notas (opcional)</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Observaciones del operador para este batch…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!file || isPending}>
            {isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analizando…</>
            ) : (
              "Cargar y analizar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
