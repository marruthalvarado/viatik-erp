/**
 * Árbol jerárquico del Plan de Cuentas.
 * Muestra cuentas con expand/collapse por nivel.
 */
import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PlanCuenta } from "@/hooks/entities/use-contabilidad";

interface PlanCuentasTreeProps {
  cuentas: PlanCuenta[];
  onCrear?: (parentId?: string) => void;
  onEditar?: (cuenta: PlanCuenta) => void;
  onEliminar?: (cuenta: PlanCuenta) => void;
  readOnly?: boolean;
}

interface NodoArbol extends PlanCuenta {
  hijos: NodoArbol[];
}

function buildTree(cuentas: PlanCuenta[]): NodoArbol[] {
  const map = new Map<string, NodoArbol>();
  cuentas.forEach((c) => map.set(c.id, { ...c, hijos: [] }));
  const raices: NodoArbol[] = [];
  map.forEach((nodo) => {
    if (nodo.parent_id && map.has(nodo.parent_id)) {
      map.get(nodo.parent_id)!.hijos.push(nodo);
    } else {
      raices.push(nodo);
    }
  });
  return raices;
}

const TIPO_COLORS: Record<string, string> = {
  activo: "bg-blue-100 text-blue-700",
  pasivo: "bg-orange-100 text-orange-700",
  patrimonio: "bg-purple-100 text-purple-700",
  ingreso: "bg-green-100 text-green-700",
  costo: "bg-yellow-100 text-yellow-700",
  gasto: "bg-red-100 text-red-700",
};

interface NodoProps {
  nodo: NodoArbol;
  depth: number;
  onCrear?: (parentId?: string) => void;
  onEditar?: (cuenta: PlanCuenta) => void;
  onEliminar?: (cuenta: PlanCuenta) => void;
  readOnly?: boolean;
}

function Nodo({ nodo, depth, onCrear, onEditar, onEliminar, readOnly }: NodoProps) {
  const [abierto, setAbierto] = useState(depth < 2);
  const tieneHijos = nodo.hijos.length > 0;
  const esSistema = nodo.empresa_id === null;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 rounded px-2 py-1 hover:bg-muted/50 cursor-pointer text-sm",
          depth === 0 && "font-semibold",
        )}
        style={{ paddingLeft: `${(depth + 1) * 12}px` }}
      >
        {/* Expand/collapse */}
        <button
          className="flex-shrink-0 size-4 flex items-center justify-center text-muted-foreground"
          onClick={() => tieneHijos && setAbierto((o) => !o)}
        >
          {tieneHijos ? (
            abierto ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )
          ) : null}
        </button>

        {/* Código */}
        <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{nodo.codigo}</span>

        {/* Nombre */}
        <span className="flex-1 truncate">{nodo.nombre}</span>

        {/* Badges */}
        {depth === 0 && (
          <Badge
            variant="secondary"
            className={cn("text-[10px] px-1 py-0", TIPO_COLORS[nodo.tipo])}
          >
            {nodo.tipo}
          </Badge>
        )}
        {nodo.acepta_movimientos && (
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            {nodo.naturaleza === "deudora" ? "D" : "A"}
          </Badge>
        )}
        {esSistema && <Lock className="size-3 text-muted-foreground shrink-0" />}

        {/* Acciones */}
        {!readOnly && (
          <div className="hidden group-hover:flex items-center gap-1">
            {nodo.acepta_movimientos && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onCrear?.(nodo.id);
                }}
              >
                <Plus className="size-3" />
              </Button>
            )}
            {!esSistema && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditar?.(nodo);
                  }}
                >
                  <Pencil className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEliminar?.(nodo);
                  }}
                >
                  <Trash2 className="size-3" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {abierto &&
        nodo.hijos.map((hijo) => (
          <Nodo
            key={hijo.id}
            nodo={hijo}
            depth={depth + 1}
            onCrear={onCrear}
            onEditar={onEditar}
            onEliminar={onEliminar}
            readOnly={readOnly}
          />
        ))}
    </div>
  );
}

export function PlanCuentasTree({
  cuentas,
  onCrear,
  onEditar,
  onEliminar,
  readOnly = false,
}: PlanCuentasTreeProps) {
  const arbol = useMemo(() => buildTree(cuentas), [cuentas]);

  return (
    <div className="rounded-md border bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground w-20 ml-5">Código</span>
        <span className="text-xs font-medium text-muted-foreground flex-1">Nombre</span>
        {!readOnly && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onCrear?.()}>
            <Plus className="size-3 mr-1" />
            Nueva cuenta
          </Button>
        )}
      </div>

      {/* Árbol */}
      <div className="py-1">
        {arbol.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay cuentas disponibles.
          </p>
        ) : (
          arbol.map((nodo) => (
            <Nodo
              key={nodo.id}
              nodo={nodo}
              depth={0}
              onCrear={onCrear}
              onEditar={onEditar}
              onEliminar={onEliminar}
              readOnly={readOnly}
            />
          ))
        )}
      </div>
    </div>
  );
}
