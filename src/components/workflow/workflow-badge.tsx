import { StatusBadge } from "@/components/common/status-badge";
import { workflowTone, estadoLabel } from "./workflow-types";

interface WorkflowBadgeProps {
  estadoCodigo: string | null | undefined;
  className?: string;
}

export function WorkflowBadge({ estadoCodigo, className }: WorkflowBadgeProps) {
  return (
    <StatusBadge tone={workflowTone(estadoCodigo)} className={className}>
      {estadoLabel(estadoCodigo)}
    </StatusBadge>
  );
}
