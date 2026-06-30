/**
 * ai-expense-wizard.tsx — IA-3
 *
 * Wizard completo: subida de factura → OCR → IA → revisión → guardar gasto.
 *
 * Estados del wizard:
 *   idle          → Zona de drop, esperando archivo
 *   subiendo      → Upload + OCR en curso (OcrProgress)
 *   ai_procesando → Extracción IA en curso
 *   revision      → Formulario pre-llenado para revisar
 *   guardando     → Creando gasto en BD
 *   completado    → Éxito
 *   error         → Error recuperable
 *
 * Arquitectura: Componente → Hook (upload + AI) → Service → Provider → API
 * No accede a Supabase ni a OpenAI directamente.
 */
import { useState, useEffect } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { OcrUpload } from "@/components/ocr/ocr-upload";
import { OcrPreview } from "@/components/ocr/ocr-preview";
import { OcrProgress } from "@/components/ocr/ocr-progress";
import { AiExpenseReview } from "./ai-expense-review";

import { useUploadDocument } from "@/hooks/use-upload-document";
import { useAiExpense } from "@/hooks/use-ai-expense";
import { useCrearGasto } from "@/hooks/entities/use-gastos";
import { useRendiciones } from "@/hooks/entities/use-rendiciones";
import { useProveedores } from "@/hooks/entities/use-proveedores";
import { useCategoriasGasto, useEstadosGasto, useMonedas } from "@/hooks/entities/use-catalogs";
import { useCompany } from "@/contexts/company-context";
import { toast } from "@/components/common/toast";
import { emptyToNull } from "@/utils/formatters";

import type { GastoFormValues } from "@/components/gastos/gasto-types";
import type { GastoInsert } from "@/types/entities";
import type { ExpenseExtraction } from "@/services/ai/document-ai-provider";
import { EMPTY_FORM } from "@/components/gastos/gasto-types";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AiExpenseWizardProps {
  rendicionIdInicial?: string;
  onSuccess: (documentoId: string, gastoId: string) => void;
  onCancel: () => void;
}

type WizardEstado =
  | "idle"
  | "subiendo"
  | "ai_procesando"
  | "revision"
  | "guardando"
  | "completado"
  | "error";

// ─── Componente ───────────────────────────────────────────────────────────────

export function AiExpenseWizard({
  rendicionIdInicial = "",
  onSuccess,
  onCancel,
}: AiExpenseWizardProps) {
  const { empresaActivaId } = useCompany();
  const queryClient = useQueryClient();

  const [wizardEstado, setWizardEstado] = useState<WizardEstado>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [documentoId, setDocumentoId] = useState<string | null>(null);
  const [propuesta, setPropuesta] = useState<ExpenseExtraction | null>(null);

  // ─── Catálogos ─────────────────────────────────────────────────────────
  const { data: rendicionesData } = useRendiciones({ pageSize: 200 });
  const { data: proveedoresData } = useProveedores({ pageSize: 200 });
  const { data: categoriasData } = useCategoriasGasto({ pageSize: 200 });
  const { data: estadosData } = useEstadosGasto({ pageSize: 200 });
  const { data: monedasData } = useMonedas({ pageSize: 200 });

  const rendiciones = rendicionesData?.rows ?? [];
  const proveedores = proveedoresData?.rows ?? [];
  const categorias = categoriasData?.rows ?? [];
  const estados = estadosData?.rows ?? [];
  const monedas = monedasData?.rows ?? [];

  // ─── Hooks ─────────────────────────────────────────────────────────────
  const upload = useUploadDocument({
    empresaId: empresaActivaId ?? "",
    rendicionId: rendicionIdInicial || null,
    onSuccess: (res) => {
      setDocumentoId(res.documentoId);
      // Upload + OCR completados → iniciar IA
    },
    onError: (err) => {
      setErrorMsg(err.message);
      setWizardEstado("error");
    },
  });

  const ai = useAiExpense();
  const crearGasto = useCrearGasto();

  // ─── Progreso: subida → OCR terminado → disparar IA ──────────────────
  useEffect(() => {
    if (upload.estado === "subiendo" || upload.estado === "validando") {
      setWizardEstado("subiendo");
    }
    if (upload.estado === "procesando_ocr") {
      setWizardEstado("subiendo"); // continúa mostrando barra
    }
    if (upload.estado === "completado" && upload.resultado?.documentoId) {
      const docId = upload.resultado.documentoId;
      setDocumentoId(docId);
      // PDF, XML e imágenes: todos pasan por la pipeline IA
      setWizardEstado("ai_procesando");
      ai.extraer({ documentoId: docId });
    }
    if (upload.estado === "error") {
      setErrorMsg(upload.error ?? "Error durante la subida");
      setWizardEstado("error");
    }
    if (upload.estado === "cancelado") {
      setWizardEstado("idle");
    }
  }, [upload.estado, upload.resultado, upload.error]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Cuando la IA termina → pasar a revisión ────────────────────────
  useEffect(() => {
    if (ai.procesando) return;
    if (ai.propuesta) {
      setPropuesta(ai.propuesta);
      setWizardEstado("revision");
    }
    if (ai.error && wizardEstado === "ai_procesando") {
      setErrorMsg(ai.error);
      setWizardEstado("error");
    }
  }, [ai.propuesta, ai.procesando, ai.error, wizardEstado]);

  // ─── Construir defaultValues para el formulario ──────────────────────
  function buildDefaultValues(): GastoFormValues {
    if (!propuesta) return { ...EMPTY_FORM, rendicion_id: rendicionIdInicial };

    const catSugerida = categorias.find(
      (c) => c.nombre.toLowerCase() === propuesta.categoriasSugeridas[0]?.toLowerCase(),
    );

    const notas: string[] = [];
    if (propuesta.observaciones) notas.push(propuesta.observaciones);
    if (propuesta.inconsistencias.length) {
      notas.push(`⚠ Revisar: ${propuesta.inconsistencias.join("; ")}`);
    }

    return {
      rendicion_id: rendicionIdInicial,
      descripcion: propuesta.proveedor ?? "",
      numero_documento: propuesta.numeroFactura ?? "",
      fecha: propuesta.fecha ?? "",
      categoria_gasto_id: catSugerida?.id ?? null,
      estado_gasto_id: null,
      proveedor_id: null,
      moneda_codigo: propuesta.moneda ?? null,
      valor_factura: propuesta.total ?? null,
      valor_moneda_origen: propuesta.total ?? null,
      tipo_cambio: null,
      valor_reembolsable: null,
      observaciones: notas.join("\n") || "",
    };
  }

  // ─── Confirmar y crear gasto ─────────────────────────────────────────
  async function handleConfirmar(values: GastoFormValues) {
    if (!empresaActivaId) {
      toast.error("Selecciona una empresa activa.");
      return;
    }
    setWizardEstado("guardando");

    const payload: GastoInsert = {
      empresa_id: empresaActivaId,
      rendicion_id: values.rendicion_id,
      documento_id: documentoId ?? null,
      descripcion: emptyToNull(values.descripcion),
      numero_documento: emptyToNull(values.numero_documento),
      fecha: emptyToNull(values.fecha),
      categoria_gasto_id: values.categoria_gasto_id ?? null,
      estado_gasto_id: values.estado_gasto_id ?? null,
      proveedor_id: values.proveedor_id ?? null,
      moneda_codigo: values.moneda_codigo ?? null,
      valor_factura: values.valor_factura ?? null,
      valor_moneda_origen: values.valor_moneda_origen ?? null,
      tipo_cambio: values.tipo_cambio ?? null,
      valor_reembolsable: values.valor_reembolsable ?? null,
      observaciones: emptyToNull(values.observaciones),
      es_manual: false,
    };

    try {
      const nuevo = await crearGasto.mutateAsync(payload);
      await queryClient.invalidateQueries({ queryKey: ["gastos"] });
      await queryClient.invalidateQueries({ queryKey: ["documentos"] });
      setWizardEstado("completado");
      toast.success("Gasto creado correctamente.");
      onSuccess(documentoId ?? "", nuevo.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al guardar el gasto.");
      setWizardEstado("error");
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────

  if (wizardEstado === "idle") {
    return (
      <OcrUpload
        onFileSelected={(file) => {
          upload.upload(file);
        }}
      />
    );
  }

  if (wizardEstado === "subiendo") {
    return (
      <div className="flex flex-col gap-3">
        {upload.archivoActual && (
          <OcrPreview
            file={upload.archivoActual}
            onRemove={upload.cancelar}
            removeDisabled={upload.estado === "procesando_ocr"}
          />
        )}
        <OcrProgress
          estado={upload.estado}
          progreso={upload.progreso}
          error={upload.error}
          onCancelar={upload.cancelar}
          onReintentar={upload.reintentar}
          onReset={() => {
            upload.reset();
            setWizardEstado("idle");
          }}
        />
      </div>
    );
  }

  if (wizardEstado === "ai_procesando") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm font-medium">Interpretando documento con IA…</p>
        <p className="text-xs text-muted-foreground">
          Extrayendo proveedor, montos, fecha y categoría sugerida.
        </p>
      </div>
    );
  }

  if (wizardEstado === "revision") {
    return (
      <div className="flex flex-col gap-3">

        <AiExpenseReview
          propuesta={propuesta}
        defaultValues={buildDefaultValues()}
        onConfirm={handleConfirmar}
        onCancel={onCancel}
        loading={crearGasto.isPending}
        rendiciones={rendiciones.map((r) => ({
          id: r.id,
          numero: r.numero ?? r.id,
        }))}
        proveedores={proveedores.map((p) => ({
          id: p.id,
          nombre: p.nombre,
        }))}
        categorias={categorias.map((c) => ({
          id: c.id,
          nombre: c.nombre,
        }))}
        estados={estados.map((e) => ({
          id: e.id,
          nombre: e.nombre,
          codigo: e.codigo,
        }))}
        monedas={monedas.map((m) => ({
          codigo: m.codigo,
          nombre: m.nombre,
          simbolo: m.simbolo ?? null,
        }))}
        />
      </div>
    );
  }

  if (wizardEstado === "guardando") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm font-medium">Guardando gasto…</p>
      </div>
    );
  }

  if (wizardEstado === "error") {
    return (
      <div className="flex flex-col gap-3 py-4">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm font-semibold text-destructive">Ocurrió un error</p>
          {errorMsg && <p className="mt-1 text-xs text-destructive">{errorMsg}</p>}
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => {
              upload.reset();
              ai.reset();
              setErrorMsg(null);
              setWizardEstado("idle");
            }}
            className="text-sm underline text-muted-foreground hover:text-foreground"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  // completado — el padre cerrará el dialog en onSuccess
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <Sparkles className="size-8 text-emerald-500" aria-hidden="true" />
      <p className="text-sm font-semibold text-emerald-600">¡Gasto creado correctamente!</p>
    </div>
  );
}
