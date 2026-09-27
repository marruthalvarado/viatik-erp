/**
 * Interfaz común para todos los parsers de extractos bancarios.
 */
export interface MovimientoBancarioParsed {
  fecha: string; // YYYY-MM-DD
  descripcion: string;
  referencia: string;
  tipo: "DEBITO" | "CREDITO";
  monto: number;
  saldo?: number;
}

export type BankParser = (file: File) => Promise<MovimientoBancarioParsed[]>;
