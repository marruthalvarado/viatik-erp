/**
 * about-dialog.tsx
 *
 * Diálogo "Acerca del sistema" con identidad corporativa y aviso legal de VIATIQ.
 * Se activa desde el menú de usuario (UserProfileMenu).
 * No tiene lógica de negocio ni accede a Supabase.
 */
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { BrandLogo } from "./brand-logo";

const APP_NAME = "VIATIQ";
const APP_VERSION = "v1.0 RC1";
const APP_PRODUCT = "Plataforma Inteligente para Gestión de Viáticos y Gastos";
const COMPANY = "Nuclearpet S.A.S.";
const COPYRIGHT = `© 2026 ${COMPANY}`;
const LICENSE = "Software propietario.";
const LEGAL_NOTICE =
  `${APP_NAME} es un software propietario desarrollado por ${COMPANY}. ` +
  "Queda prohibida su reproducción, modificación, distribución, ingeniería inversa " +
  "o utilización parcial o total sin autorización expresa y por escrito de " +
  `${COMPANY}`;

export interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex flex-col items-center gap-3 pb-1 text-center">
            <BrandLogo className="h-9 w-auto" alt={APP_NAME} />
            <div>
              <p className="text-lg font-bold tracking-tight">{APP_NAME}</p>
              <p className="text-xs text-muted-foreground">{APP_PRODUCT}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-1 space-y-2.5 text-sm">
          <InfoRow label="Versión" value={APP_VERSION} />
          <InfoRow label="Desarrollado por" value={COMPANY} />
          <InfoRow label="Copyright" value={`${COPYRIGHT} Todos los derechos reservados.`} />
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
