/**
 * about-dialog.tsx
 *
 * Diálogo "Acerca del sistema" con identidad corporativa y aviso legal de Viatik ERP.
 * Se activa desde el menú de usuario (UserProfileMenu).
 * No tiene lógica de negocio ni accede a Supabase.
 */
import { Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

// ─── Constantes corporativas ──────────────────────────────────────────────────

const APP_NAME = "Viatik ERP";
const APP_VERSION = "1.0.0 RC1";
const APP_PRODUCT = "Sistema Inteligente de Gestión de Viáticos y Rendiciones de Gastos";
const COMPANY = "Nuclearpet S.A.S.";
const COPYRIGHT = `© 2026 ${COMPANY} Todos los derechos reservados.`;
const LICENSE = "Software propietario.";
const LEGAL_NOTICE =
  `${APP_NAME} es un software propietario desarrollado por ${COMPANY}. ` +
  "Queda prohibida su reproducción, modificación, distribución, ingeniería inversa " +
  "o utilización no autorizada sin autorización expresa y por escrito de " +
  `${COMPANY}`;

// ─── Componente ───────────────────────────────────────────────────────────────

export interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
              aria-hidden="true"
            >
              <Sparkles className="size-5" />
            </span>
            {APP_NAME}
          </DialogTitle>
          <DialogDescription>{APP_PRODUCT}</DialogDescription>
        </DialogHeader>

        <div className="mt-1 space-y-3 text-sm">
          <InfoRow label="Versión" value={APP_VERSION} />
          <InfoRow label="Desarrollado por" value={COMPANY} />
          <InfoRow label="Copyright" value={COPYRIGHT} />
          <InfoRow label="Licencia" value={LICENSE} />

          <Separator />

          <div className="rounded-md border bg-muted/50 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Aviso legal
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">{LEGAL_NOTICE}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helper interno ───────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
