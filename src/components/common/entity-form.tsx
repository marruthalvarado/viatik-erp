import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormProvider,
  useForm,
  type DefaultValues,
  type FieldValues,
  type SubmitHandler,
  type UseFormReturn,
} from "react-hook-form";
import type { ReactNode } from "react";
import type { ZodType } from "zod";

import { Button } from "@/components/ui/button";

interface EntityFormProps<T extends FieldValues> {
  schema: ZodType<T>;
  defaultValues: DefaultValues<T>;
  onSubmit: SubmitHandler<T>;
  children: (form: UseFormReturn<T>) => ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  loading?: boolean;
}

export function EntityForm<T extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  children,
  submitLabel = "Guardar",
  cancelLabel = "Cancelar",
  onCancel,
  loading,
}: EntityFormProps<T>) {
  const form = useForm<T>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
    defaultValues,
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {children(form)}
        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              {cancelLabel}
            </Button>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "Guardando..." : submitLabel}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
