import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useCompany } from "@/contexts/company-context";

/**
 * Selector de empresa activa.
 * Lee del CompanyContext (que ya consulta empresas_usuarios + RLS).
 */
export function CompanySwitcher() {
  const [open, setOpen] = useState(false);
  const { empresas, empresaActiva, empresaActivaId, setEmpresaActiva, loading } =
    useCompany();

  const label = empresaActiva?.nombre ?? (loading ? "Cargando…" : "Seleccionar empresa");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={loading || empresas.length === 0}
          className="w-full justify-between h-9 px-2 font-normal"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Building2 className="size-4 text-muted-foreground shrink-0" />
            <span className="truncate text-sm">{label}</span>
          </span>
          <ChevronsUpDown className="size-3.5 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar empresa..." />
          <CommandList>
            <CommandEmpty>
              {loading ? "Cargando..." : "No hay empresas disponibles."}
            </CommandEmpty>
            {empresas.length > 0 && (
              <CommandGroup heading="Tus empresas">
                {empresas.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.nombre ?? c.id}
                    onSelect={() => {
                      setEmpresaActiva(c.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        empresaActivaId === c.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{c.nombre ?? c.id}</span>
                    {c.codigo && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {c.codigo}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
