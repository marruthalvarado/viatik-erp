/**
 * brand-logo.tsx
 *
 * Componente centralizado del logo oficial VIATIQ.
 * Importa el SVG como URL de Vite para que reciba hash en producción.
 *
 * Uso:
 *   <BrandLogo />                    — logo completo (responsive)
 *   <BrandLogo iconOnly />           — solo el ícono V (para sidebar colapsado)
 *   <BrandLogo className="h-10 w-auto" />
 */
import logoUrl from "@/assets/branding/logo-viatiq.svg";
import faviconUrl from "/favicon.svg";

export interface BrandLogoProps {
  /** Muestra solo el ícono V en lugar del logo completo. */
  iconOnly?: boolean;
  className?: string;
  alt?: string;
}

export function BrandLogo({ iconOnly = false, className, alt = "VIATIQ" }: BrandLogoProps) {
  if (iconOnly) {
    return (
      <img
        src={faviconUrl}
        alt={alt}
        className={className ?? "size-8"}
        draggable={false}
        style={{ objectFit: "contain" }}
      />
    );
  }

  return (
    <img
      src={logoUrl}
      alt={alt}
      className={className ?? "h-8 w-auto"}
      draggable={false}
      style={{ objectFit: "contain" }}
    />
  );
}
