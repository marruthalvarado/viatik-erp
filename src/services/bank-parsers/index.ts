export type { MovimientoBancarioParsed, BankParser } from "./types";
export { parseProcreditXLS } from "./procredit";
export { parseCsvGenerico } from "./csv-generico";

import { parseProcreditXLS } from "./procredit";
import { parseCsvGenerico } from "./csv-generico";
import type { BankParser } from "./types";

export const BANCOS_SOPORTADOS: {
  id: string;
  nombre: string;
  formatos: string[];
  parser: BankParser;
}[] = [
  {
    id: "procredit",
    nombre: "ProCredit",
    formatos: [".xls", ".xlsx"],
    parser: parseProcreditXLS,
  },
  {
    id: "pichincha_csv",
    nombre: "Pichincha (CSV)",
    formatos: [".csv"],
    parser: parseCsvGenerico,
  },
  {
    id: "internacional_csv",
    nombre: "Internacional (CSV)",
    formatos: [".csv"],
    parser: parseCsvGenerico,
  },
  {
    id: "produbanco_csv",
    nombre: "Produbanco (CSV)",
    formatos: [".csv"],
    parser: parseCsvGenerico,
  },
  {
    id: "pacifico_csv",
    nombre: "Pacífico (CSV)",
    formatos: [".csv"],
    parser: parseCsvGenerico,
  },
  {
    id: "guayaquil_csv",
    nombre: "Guayaquil (CSV)",
    formatos: [".csv"],
    parser: parseCsvGenerico,
  },
  {
    id: "csv_generico",
    nombre: "CSV Genérico (otro banco)",
    formatos: [".csv"],
    parser: parseCsvGenerico,
  },
];

export function getBancoParser(bancoId: string): BankParser {
  const b = BANCOS_SOPORTADOS.find((b) => b.id === bancoId);
  if (!b) return parseCsvGenerico;
  return b.parser;
}
