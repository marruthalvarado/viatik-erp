import { ConfirmDialog } from "./confirm-dialog";

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityLabel?: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

export function DeleteDialog({
  open,
  onOpenChange,
  entityLabel = "este elemento",
  onConfirm,
  loading,
}: DeleteDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`¿Eliminar ${entityLabel}?`}
      description="Esta acción no se puede deshacer."
      confirmLabel="Eliminar"
      onConfirm={onConfirm}
      loading={loading}
    />
  );
}
