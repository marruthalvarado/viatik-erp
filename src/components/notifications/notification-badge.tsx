/**
 * notification-badge.tsx — FASE 9A
 *
 * Badge numérico sobre la campana.
 * Oculto cuando count === 0. Truncado en 99+.
 */

interface NotificationBadgeProps {
  count: number;
  className?: string;
}

export function NotificationBadge({ count, className = "" }: NotificationBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-[3px] text-[10px] font-semibold leading-none text-destructive-foreground ${className}`}
      aria-label={`${count > 99 ? "más de 99" : String(count)} notificaciones sin leer`}
    >
      {count > 99 ? "99+" : String(count)}
    </span>
  );
}
