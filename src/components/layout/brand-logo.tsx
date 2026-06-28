/**
 * brand-logo.tsx
 *
 * Componente centralizado del logo VIATIQ.
 * Importa el SVG como URL de Vite para que reciba hash en producción.
 *
 * Uso:
 *   <BrandLogo />              — wordmark completo (220x56 viewBox, ancho por defecto 110px)
 *   <BrandLogo iconOnly />     — solo el icono cuadrado (56x56 viewBox, 28px default)
 *   <BrandLogo className="h-8 w-auto" />
 */
import logoUrl from "@/assets/branding/logo-viatiq.svg";

export interface BrandLogoProps {
  /** Muestra solo el icono cuadrado en lugar del wordmark completo. */
  iconOnly?: boolean;
  className?: string;
  alt?: string;
}

export function BrandLogo({ iconOnly = false, className, alt = "VIATIQ" }: BrandLogoProps) {
  if (iconOnly) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 56 56"
        role="img"
        aria-label={alt}
        className={className ?? "size-8"}
      >
        <rect width="56" height="56" rx="10" fill="currentColor" className="text-primary" />
        <polyline
          points="14,16 28,40 42,16"
          fill="none"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return <img src={logoUrl} alt={alt} className={className ?? "h-8 w-auto"} draggable={false} />;
}
