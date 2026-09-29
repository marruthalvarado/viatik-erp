/**
 * banco-guayaquil-sync — Edge Function
 *
 * Sincroniza movimientos de cuenta corriente del Banco Guayaquil
 * usando el API OAuth2 (Microsoft Entra ID).
 *
 * Secrets requeridos (Supabase Dashboard → Edge Functions → Secrets):
 *   BG_CLIENT_ID        — client_id de la app registrada en Entra ID
 *   BG_CLIENT_SECRET    — client_secret
 *   BG_ACCOUNT_ID       — número de cuenta corriente
 *   BG_SCOPE            — scope OAuth2 (ej: api://a01aa610-.../.default)
 *
 * Request body (JSON):
 *   { cuenta_id: UUID, empresa_id: UUID, fecha_desde: "YYYY-MM-DD", fecha_hasta: "YYYY-MM-DD" }
 *
 * Response:
 *   { insertados: number, duplicados: number, total_paginas: number }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// ─── Tipos internos ────────────────────────────────────────────────────────────

interface SyncRequest {
  cuenta_id: string;
  empresa_id: string;
  fecha_desde: string; // YYYY-MM-DD
  fecha_hasta: string; // YYYY-MM-DD
}

interface BgTransaction {
  entryId: string;
  document: string;
  sequence?: string;
  bookingDate: string;        // YYYY-MM-DD
  valueDate?: string;
  transactionType: {
    identification: string;   // DEP | RET | CHQ | N/C | N/D | TT ...
    description: string;
  };
  concept?: string;
  channel?: string;
  creditDebit: "CREDIT" | "DEBIT";
  amount: {
    amountValue: string;       // sin punto decimal, ej: "00000027000"
    amountCurrency: string;
    decimalPointPosition: string; // posiciones desde la derecha
  };
  accountBalance?: Array<{
    type: string;              // "Available" | "Expected"
    amount: { amountValue: string; decimalPointPosition: string };
  }>;
  reference1?: string;
  reference2?: string;
}

interface BgPage {
  pointer: string;
  mark: "S" | "N";  // S = hay más páginas, N = fin
  programName: string;
}

interface BgResponse {
  serviceOutcome: { code: string; message: string };
  account?: { identification: string; baseCurrency: string };
  period?: { from: string; to: string };
  page?: BgPage;
  transactions?: BgTransaction[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Convierte amountValue + decimalPointPosition a número decimal */
function parseAmount(value: string, decimals: string): number {
  const raw = parseInt(value, 10);
  const places = parseInt(decimals, 10);
  return raw / Math.pow(10, places);
}

/** Obtiene token OAuth2 de Microsoft Entra ID */
async function getEntraToken(
  clientId: string,
  clientSecret: string,
  scope: string,
  isProduction: boolean,
): Promise<string> {
  const tokenUrl = isProduction
    ? "https://integrations.bancoguayaquil.com/dc001/std/secure/oauth2/v2.0/token"
    : "https://devintegrations.bancoguayaquil.com/dc001/std/secure/oauth2/v2.0/token";

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope,
    grant_type: "client_credentials",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error obteniendo token BG: ${res.status} ${text}`);
  }

  const json = await res.json() as { access_token?: string };
  if (!json.access_token) throw new Error("Token BG vacío en la respuesta");
  return json.access_token;
}

/** Llama al endpoint de movimientos con paginación completa */
async function fetchAllTransactions(
  token: string,
  accountId: string,
  fechaDesde: string,
  fechaHasta: string,
  isProduction: boolean,
): Promise<{ transactions: BgTransaction[]; totalPages: number }> {
  const baseUrl = isProduction
    ? `https://integrations.bancoguayaquil.com/dc001/std/secure/current-account/v1/accounts/${accountId}/transactions`
    : `https://devintegrations.bancoguayaquil.com/dc001/std/secure/current-account/v1/accounts/${accountId}/transactions`;

  const allTransactions: BgTransaction[] = [];
  let totalPages = 0;

  // Estado de paginación
  let pageMark = "N";
  let pagePointer = "";
  let pageProgramName = "";

  do {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "periodFrom": fechaDesde,
      "periodTo": fechaHasta,
      "filtersTransactionTypeIdentification": "TT",
      "pageMark": pageMark,
    };

    // En páginas subsiguientes, incluir pointer y programName
    if (pageMark === "S" && pagePointer) {
      headers["pagePointer"] = pagePointer;
      headers["pageProgramName"] = pageProgramName;
    }

    const res = await fetch(baseUrl, { method: "GET", headers });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Error en API Banco Guayaquil: ${res.status} ${text}`);
    }

    const body = await res.json() as BgResponse;

    // Código de éxito: 0000 (con movimientos) o 0006 (sin movimientos)
    if (body.serviceOutcome.code !== "0000" && body.serviceOutcome.code !== "0006") {
      throw new Error(`BG API error ${body.serviceOutcome.code}: ${body.serviceOutcome.message}`);
    }

    const txs = body.transactions ?? [];
    allTransactions.push(...txs);
    totalPages++;

    // Preparar siguiente página
    if (body.page && body.page.mark === "S") {
      pageMark = "S";
      pagePointer = body.page.pointer;
      pageProgramName = body.page.programName;
    } else {
      pageMark = "N"; // fin de registros
    }
  } while (pageMark === "S");

  return { transactions: allTransactions, totalPages };
}

// ─── Handler principal ─────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    // ── 1. Leer y validar body ────────────────────────────────────────────────
    const payload = await req.json() as SyncRequest;
    const { cuenta_id, empresa_id, fecha_desde, fecha_hasta } = payload;

    if (!cuenta_id || !empresa_id || !fecha_desde || !fecha_hasta) {
      return new Response(
        JSON.stringify({ error: "Faltan parámetros: cuenta_id, empresa_id, fecha_desde, fecha_hasta" }),
        { status: 400, headers: corsHeaders },
      );
    }

    // ── 2. Leer secrets ───────────────────────────────────────────────────────
    const clientId     = Deno.env.get("BG_CLIENT_ID")     ?? "";
    const clientSecret = Deno.env.get("BG_CLIENT_SECRET") ?? "";
    const accountId    = Deno.env.get("BG_ACCOUNT_ID")    ?? "";
    const scope        = Deno.env.get("BG_SCOPE")
      ?? "api://a01aa610-dff0-41cb-9398-4392be56c042/.default";
    const isProd       = Deno.env.get("BG_PRODUCTION") === "true";

    if (!clientId || !clientSecret || !accountId) {
      return new Response(
        JSON.stringify({
          error: "Secrets no configurados. Agrega BG_CLIENT_ID, BG_CLIENT_SECRET y BG_ACCOUNT_ID en Supabase Edge Function Secrets.",
        }),
        { status: 500, headers: corsHeaders },
      );
    }

    // ── 3. Obtener token OAuth2 ───────────────────────────────────────────────
    const token = await getEntraToken(clientId, clientSecret, scope, isProd);

    // ── 4. Obtener todos los movimientos (paginado) ───────────────────────────
    const { transactions, totalPages } = await fetchAllTransactions(
      token,
      accountId,
      fecha_desde,
      fecha_hasta,
      isProd,
    );

    if (transactions.length === 0) {
      return new Response(
        JSON.stringify({ insertados: 0, duplicados: 0, total_paginas: totalPages, message: "Sin movimientos en el rango" }),
        { status: 200, headers: corsHeaders },
      );
    }

    // ── 5. Mapear al formato VIATIQ ───────────────────────────────────────────
    const movimientos = transactions.map((tx) => {
      const monto = parseAmount(tx.amount.amountValue, tx.amount.decimalPointPosition);

      // Saldo disponible (Available) si existe
      const balanceAvailable = tx.accountBalance?.find((b) => b.type === "Available");
      const saldo = balanceAvailable
        ? parseAmount(balanceAvailable.amount.amountValue, balanceAvailable.amount.decimalPointPosition)
        : null;

      // Descripción: tipo_tx + concepto + referencia1
      const partesDesc = [
        tx.transactionType.description,
        tx.concept,
        tx.reference1,
        tx.reference2,
      ].filter(Boolean);
      const descripcion = partesDesc.join(" · ");

      return {
        bg_document_id: tx.document,
        fecha: tx.bookingDate,                             // YYYY-MM-DD
        descripcion,
        referencia: tx.document,
        tipo: tx.creditDebit === "CREDIT" ? "CREDITO" : "DEBITO",
        monto,
        ...(saldo !== null ? { saldo } : {}),
      };
    });

    // ── 6. Guardar en Supabase via RPC con service_role ───────────────────────
    const supabaseUrl     = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: result, error: rpcError } = await supabase.rpc(
      "importar_movimientos_banco_guayaquil",
      {
        p_cuenta_id: cuenta_id,
        p_empresa_id: empresa_id,
        p_movimientos: movimientos,
      },
    );

    if (rpcError) throw new Error(`Error RPC: ${rpcError.message}`);

    const row = Array.isArray(result) ? result[0] : result;

    return new Response(
      JSON.stringify({
        insertados:    Number(row?.insertados  ?? 0),
        duplicados:    Number(row?.duplicados  ?? 0),
        total_paginas: totalPages,
        total_api:     transactions.length,
      }),
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: corsHeaders },
    );
  }
});
