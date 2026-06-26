import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export function SearchBar({
  value = "",
  onChange,
  placeholder = "Buscar...",
  debounceMs = 300,
  className,
}: SearchBarProps) {
  const [internal, setInternal] = useState(value);

  useEffect(() => setInternal(value), [value]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (internal !== value) onChange(internal);
    }, debounceMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internal, debounceMs]);

  return (
    <div className={cn("relative w-full max-w-sm", className)}>
      <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={internal}
        onChange={(e) => setInternal(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-8 pr-8"
      />
      {internal && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-9 w-9"
          onClick={() => {
            setInternal("");
            onChange("");
          }}
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
