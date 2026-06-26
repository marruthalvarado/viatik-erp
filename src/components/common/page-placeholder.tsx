import { PageHeader, type Breadcrumb } from "./page-header";
import { EmptyState } from "./empty-state";
import { Plug } from "lucide-react";

interface PagePlaceholderProps {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
}

/**
 * Generic empty page used for routes pending implementation.
 */
export function PagePlaceholder({ title, description, breadcrumbs }: PagePlaceholderProps) {
  return (
    <>
      <PageHeader title={title} description={description} breadcrumbs={breadcrumbs} />
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon={Plug}
          title="Pendiente de implementación"
          description="Esta sección está planificada y se habilitará en una próxima fase."
        />
      </div>
    </>
  );
}
