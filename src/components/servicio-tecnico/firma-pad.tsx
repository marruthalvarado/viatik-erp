/**
 * Componente: Pad de firma digital para cliente y técnico
 * Usa un canvas nativo para capturar trazos. Exporta como PNG base64.
 */
import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Pen } from "lucide-react";

export interface FirmaData {
  nombre: string;
  cargo: string;
  dataUrl: string | null; // PNG base64
}

interface Props {
  title: string;
  value: FirmaData;
  onChange: (value: FirmaData) => void;
}

export function FirmaPad({ title, value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  const getCtx = () => canvasRef.current?.getContext("2d");

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    e.preventDefault();
    isDrawing.current = true;
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    e.preventDefault();
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasStrokes(true);
  }, []);

  const endDraw = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange({ ...value, dataUrl: canvas.toDataURL("image/png") });
  }, [onChange, value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", endDraw);
    canvas.addEventListener("mouseleave", endDraw);
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", endDraw);

    return () => {
      canvas.removeEventListener("mousedown", startDraw);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", endDraw);
      canvas.removeEventListener("mouseleave", endDraw);
      canvas.removeEventListener("touchstart", startDraw);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", endDraw);
    };
  }, [startDraw, draw, endDraw]);

  const limpiar = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
    onChange({ ...value, dataUrl: null });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{title}</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Nombre</Label>
          <Input
            value={value.nombre}
            onChange={(e) => onChange({ ...value, nombre: e.target.value })}
            placeholder="Nombre completo"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Cargo</Label>
          <Input
            value={value.cargo}
            onChange={(e) => onChange({ ...value, cargo: e.target.value })}
            placeholder="Cargo / función"
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="relative border rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          className="w-full touch-none cursor-crosshair"
          style={{ height: "120px" }}
        />
        {!hasStrokes && !value.dataUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Pen className="size-3" /> Firmar aquí
            </span>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 size-6 text-muted-foreground hover:text-destructive"
          onClick={limpiar}
          title="Limpiar firma"
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
}
