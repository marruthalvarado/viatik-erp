/**
 * sri-emitir — Edge Function
 *
 * Genera, firma (XAdES-BES) y envía una factura electrónica al SRI Ecuador.
 * Soporta tipo 'factura' inicialmente. Factura de servicio (1 línea).
 *
 * Request body (JSON):
 *   {
 *     empresa_id: string,
 *     factura_id: string,         -- ID en facturas_emitidas
 *     descripcion_servicio?: string,
 *     forma_pago?: string,        -- código SRI: "01" efectivo, "16" transferencia, etc.
 *   }
 *
 * Response:
 *   { ok: true, clave_acceso, estado, numero_autorizacion?, mensaje_sri? }
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
// @ts-ignore
import forge from "npm:node-forge@1.3.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Dígito verificador módulo 11 SRI */
function calcDigitoVerificador(numero48: string): string {
  const coeffs = [2, 3, 4, 5, 6, 7];
  let sum = 0;
  for (let i = numero48.length - 1, j = 0; i >= 0; i--, j++) {
    sum += parseInt(numero48[i], 10) * coeffs[j % 6];
  }
  const res = sum % 11;
  const v = res === 0 ? 0 : res === 1 ? 1 : 11 - res;
  return v.toString();
}

/** Genera clave de acceso SRI (49 dígitos) */
function generarClaveAcceso(
  fecha: Date,
  tipoDoc: string,
  ruc: string,
  ambiente: "1" | "2",
  serie: string,     // "001001"
  secuencial: string, // 9 digits
): string {
  const d = fecha.getDate().toString().padStart(2, "0");
  const m = (fecha.getMonth() + 1).toString().padStart(2, "0");
  const y = fecha.getFullYear().toString();
  const ddmmaaaa = `${d}${m}${y}`;
  const codigoNumerico = Math.floor(Math.random() * 99999999).toString().padStart(8, "0");
  const tipoEmision = "1";
  const key48 = `${ddmmaaaa}${tipoDoc}${ruc}${ambiente}${serie}${secuencial}${codigoNumerico}${tipoEmision}`;
  const verif = calcDigitoVerificador(key48);
  return key48 + verif;
}

/** Tipo de identificación según el RUC/cédula */
function tipoIdentificacion(id: string | null): string {
  if (!id) return "07"; // consumidor final
  if (id === "9999999999999") return "07"; // consumidor final
  if (id.length === 13) return "04"; // RUC
  if (id.length === 10) return "05"; // cédula
  return "06"; // pasaporte u otro
}

/** Código SRI de IVA según la tasa */
function codigoPorcentajeIva(tasa: number): { codigo: string; porcentaje: string } {
  if (tasa <= 0) return { codigo: "0", porcentaje: "0" };
  if (tasa <= 5) return { codigo: "5", porcentaje: "5" };
  if (tasa <= 12) return { codigo: "2", porcentaje: "12" };
  if (tasa <= 14) return { codigo: "3", porcentaje: "14" };
  return { codigo: "4", porcentaje: "15" };
}

/** Format number to 2 decimals for XML (montos, valores) */
function fmt(n: number): string {
  return n.toFixed(2);
}

/** Format number to 6 decimals for XML (precioUnitario, cantidad unitaria) */
function fmt6(n: number): string {
  return n.toFixed(6);
}

/** Format date dd/MM/yyyy */
function fmtFecha(d: Date): string {
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear().toString();
  return `${dd}/${mm}/${yyyy}`;
}

// ─── Generación XML Factura ───────────────────────────────────────────────────

interface FacturaData {
  claveAcceso: string;
  ambiente: string;   // "1" | "2"
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  dirMatriz: string;
  dirEstablecimiento: string;
  estab: string;
  ptoEmi: string;
  secuencial: string;
  obligadoContabilidad: string;
  contribuyenteEspecial: string;
  fechaEmision: string; // dd/MM/yyyy
  tipoIdentificacion: string;
  razonSocialComprador: string;
  identificacionComprador: string;
  subtotal: number;
  descuento: number;
  iva: number;
  ivaTasa: number;
  total: number;
  descripcionServicio: string;
  formaPago: string;
  moneda: string;
}

function generarXmlFactura(d: FacturaData): string {
  const ivaInfo = codigoPorcentajeIva(d.ivaTasa);
  const baseImponible = d.subtotal - d.descuento;

  return `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.0.0">
  <infoTributaria>
    <ambiente>${d.ambiente}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${escXml(d.razonSocial)}</razonSocial>
    <nombreComercial>${escXml(d.nombreComercial || d.razonSocial)}</nombreComercial>
    <ruc>${d.ruc}</ruc>
    <claveAcceso>${d.claveAcceso}</claveAcceso>
    <codDoc>01</codDoc>
    <estab>${d.estab}</estab>
    <ptoEmi>${d.ptoEmi}</ptoEmi>
    <secuencial>${d.secuencial}</secuencial>
    <dirMatriz>${escXml(d.dirMatriz)}</dirMatriz>${d.contribuyenteEspecial ? `\n    <contribuyenteEspecial>${d.contribuyenteEspecial}</contribuyenteEspecial>` : ""}
  </infoTributaria>
  <infoFactura>
    <fechaEmision>${d.fechaEmision}</fechaEmision>
    <dirEstablecimiento>${escXml(d.dirEstablecimiento || d.dirMatriz)}</dirEstablecimiento>
    <obligadoContabilidad>${d.obligadoContabilidad}</obligadoContabilidad>
    <tipoIdentificacionComprador>${d.tipoIdentificacion}</tipoIdentificacionComprador>
    <razonSocialComprador>${escXml(d.razonSocialComprador)}</razonSocialComprador>
    <identificacionComprador>${d.identificacionComprador || "9999999999999"}</identificacionComprador>
    <totalSinImpuestos>${fmt(baseImponible)}</totalSinImpuestos>
    <totalDescuento>${fmt(d.descuento)}</totalDescuento>
    <totalConImpuestos>
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${ivaInfo.codigo}</codigoPorcentaje>
        <baseImponible>${fmt(baseImponible)}</baseImponible>
        <valor>${fmt(d.iva)}</valor>
      </totalImpuesto>
    </totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>${fmt(d.total)}</importeTotal>
    <moneda>${d.moneda || "DOLAR"}</moneda>
    <pagos>
      <pago>
        <formaPago>${d.formaPago || "01"}</formaPago>
        <total>${fmt(d.total)}</total>
        <plazo>0</plazo>
        <unidadTiempo>dias</unidadTiempo>
      </pago>
    </pagos>
  </infoFactura>
  <detalles>
    <detalle>
      <codigoPrincipal>SERV-001</codigoPrincipal>
      <descripcion>${escXml(d.descripcionServicio)}</descripcion>
      <cantidad>1.000000</cantidad>
      <precioUnitario>${fmt6(baseImponible)}</precioUnitario>
      <descuento>${fmt(d.descuento)}</descuento>
      <precioTotalSinImpuesto>${fmt(baseImponible)}</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>${ivaInfo.codigo}</codigoPorcentaje>
          <tarifa>${ivaInfo.porcentaje}.00</tarifa>
          <baseImponible>${fmt(baseImponible)}</baseImponible>
          <valor>${fmt(d.iva)}</valor>
        </impuesto>
      </impuestos>
    </detalle>
  </detalles>
</factura>`;
}

function escXml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── XAdES-BES Signing ────────────────────────────────────────────────────────

interface SignedResult {
  xml: string;
}

function firmarXadesBeS(xmlSinFirma: string, p12Bytes: Uint8Array, clave: string): SignedResult {
  // 1. Parsear .p12
  const p12Der = forge.util.binary.raw.encode(p12Bytes);
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, clave);

  // 2. Extraer clave privada
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  if (!keyBag?.key) throw new Error("No se pudo extraer la clave privada del .p12");
  const privateKey = keyBag.key as forge.pki.rsa.PrivateKey;

  // 3. Extraer certificado
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag]?.[0];
  if (!certBag?.cert) throw new Error("No se pudo extraer el certificado del .p12");
  const cert = certBag.cert as forge.pki.Certificate;

  // 4. Certificado en base64 DER
  const certAsn1 = forge.pki.certificateToAsn1(cert);
  const certDer = forge.asn1.toDer(certAsn1).getBytes();
  const certBase64 = forge.util.encode64(certDer);

  // 5. SHA-1 del certificado (para CertDigest)
  const certMd = forge.md.sha1.create();
  certMd.update(certDer);
  const certDigest = forge.util.encode64(certMd.digest().getBytes());

  // 6. Issuer y serial
  const issuerAttrs = cert.issuer.attributes
    .map((a: forge.pki.CertificateField) => `${a.shortName}=${a.value}`)
    .join(",");
  const serialNumber = new forge.jsbn.BigInteger(cert.serialNumber, 16).toString(10);

  // 7. Signing time
  const now = new Date();
  const signingTime = now.toISOString().replace("Z", "-05:00");

  // 8. SHA-1 del contenido del XML (sin declaración XML)
  const xmlBody = xmlSinFirma.replace(/^<\?xml[^?]*\?>\n?/, "");
  const contentMd = forge.md.sha1.create();
  contentMd.update(forge.util.encodeUtf8(xmlBody));
  const contentDigest = forge.util.encode64(contentMd.digest().getBytes());

  // ── EXCLUSIVE C14N (exc-c14n) ────────────────────────────────────────────────
  // Con exc-c14n el canonical form NO depende del contexto de ancestros:
  // cada elemento emite SOLO los namespaces que él/su subtree utilizan y que
  // no hayan sido emitidos por un ancestro DENTRO DEL MISMO SUBTREE.
  // Resultado: hash standalone == hash en-documento → siempre coinciden.
  //
  // Reglas aplicadas:
  // 1. signedInfoXml: xmlns:ds en <ds:SignedInfo>; hijos ds:* lo heredan.
  // 2. signedPropsXml: xmlns:xades en raíz; cada ds:* HERMANO necesita xmlns:ds propio
  //    (hermanos no se heredan entre sí en exc-c14n).
  // 3. Tags self-closing → start-end. Attrs regulares: orden alfabético.
  // ─────────────────────────────────────────────────────────────────────────────

  // 9. Construir SignedProperties — exc-c14n
  const signedPropsXml = `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="Signature-SignedProperties"><xades:SignedSignatureProperties><xades:SigningTime>${signingTime}</xades:SigningTime><xades:SigningCertificate><xades:Cert><xades:CertDigest><ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></ds:DigestMethod><ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certDigest}</ds:DigestValue></xades:CertDigest><xades:IssuerSerial><ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${escXml(issuerAttrs)}</ds:X509IssuerName><ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${serialNumber}</ds:X509SerialNumber></xades:IssuerSerial></xades:Cert></xades:SigningCertificate></xades:SignedSignatureProperties><xades:SignedDataObjectProperties></xades:SignedDataObjectProperties></xades:SignedProperties>`;

  // 10. SHA-1 de SignedProperties
  const spMd = forge.md.sha1.create();
  spMd.update(forge.util.encodeUtf8(signedPropsXml));
  const spDigest = forge.util.encode64(spMd.digest().getBytes());

  // 11. Construir SignedInfo — exc-c14n
  // xmlns:ds en <ds:SignedInfo>; hijos ds:* heredan (mismo subtree).
  // CanonicalizationMethod apunta a exc-c14n. Reference attrs: Id < Type < URI.
  const signedInfoXml = `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="Signature-SignedInfo"><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></ds:CanonicalizationMethod><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></ds:SignatureMethod><ds:Reference Id="SignedPropertiesID" Type="http://uri.etsi.org/01903#SignedProperties" URI="#Signature-SignedProperties"><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></ds:DigestMethod><ds:DigestValue>${spDigest}</ds:DigestValue></ds:Reference><ds:Reference URI="#comprobante"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></ds:DigestMethod><ds:DigestValue>${contentDigest}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;

  // 12. Firmar SignedInfo con RSA-SHA1
  const signMd = forge.md.sha1.create();
  signMd.update(forge.util.encodeUtf8(signedInfoXml));
  const signatureBytes = privateKey.sign(signMd);
  const signatureValue = forge.util.encode64(signatureBytes);

  // 13. Ensamblar XML firmado — signedPropsXml verbatim (mismo string hasheado)
  const signatureBlock = `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="Signature">${signedInfoXml}<ds:SignatureValue Id="SignatureValue">${signatureValue}</ds:SignatureValue><ds:KeyInfo Id="Certificate"><ds:X509Data><ds:X509Certificate>${certBase64}</ds:X509Certificate></ds:X509Data></ds:KeyInfo><ds:Object Id="Signature-QualifyingProperties"><xades:QualifyingProperties Target="#Signature">${signedPropsXml}</xades:QualifyingProperties></ds:Object></ds:Signature>`;

  // Insertar firma antes del cierre del elemento raíz
  const xmlFirmado = xmlSinFirma.replace(/(<\/factura>)$/, `${signatureBlock}</factura>`);

  return { xml: xmlFirmado };
}

// ─── SOAP SRI ─────────────────────────────────────────────────────────────────

const SRI_ENDPOINTS = {
  pruebas: {
    recepcion: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline",
    autorizacion: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline",
  },
  produccion: {
    recepcion: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline",
    autorizacion: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline",
  },
};

async function enviarSoap(url: string, xmlFirmado: string): Promise<{ estado: string; mensajes: string }> {
  const xmlB64 = btoa(xmlFirmado);
  const soapEnv = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:validarComprobante>
      <xml>${xmlB64}</xml>
    </ec:validarComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": "",
    },
    body: soapEnv,
  });

  const respText = await resp.text();

  // Parsear respuesta con regex (evitar dependencia de DOMParser)
  const estadoMatch = respText.match(/<estado>([^<]+)<\/estado>/);
  const estado = estadoMatch?.[1] ?? "DESCONOCIDO";

  const mensajesMatch = respText.match(/<mensaje>([^<]*)<\/mensaje>/g) ?? [];
  const mensajes = mensajesMatch
    .map((m) => m.replace(/<\/?mensaje>/g, "").trim())
    .filter(Boolean)
    .join("; ");

  return { estado, mensajes };
}

async function consultarAutorizacion(
  url: string,
  claveAcceso: string,
): Promise<{ estado: string; numeroAutorizacion: string; fechaAutorizacion: string; mensajes: string }> {
  const soapEnv = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:autorizacionComprobante>
      <claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>
    </ec:autorizacionComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": "",
    },
    body: soapEnv,
  });

  const respText = await resp.text();

  const estadoMatch = respText.match(/<estado>([^<]+)<\/estado>/);
  const estado = estadoMatch?.[1] ?? "NO AUTORIZADO";

  const numAuthMatch = respText.match(/<numeroAutorizacion>([^<]+)<\/numeroAutorizacion>/);
  const numeroAutorizacion = numAuthMatch?.[1] ?? "";

  const fechaMatch = respText.match(/<fechaAutorizacion>([^<]+)<\/fechaAutorizacion>/);
  const fechaAutorizacion = fechaMatch?.[1] ?? "";

  const mensajesMatch = respText.match(/<mensaje>([^<]*)<\/mensaje>/g) ?? [];
  const mensajes = mensajesMatch
    .map((m) => m.replace(/<\/?mensaje>/g, "").trim())
    .filter(Boolean)
    .join("; ");

  return { estado, numeroAutorizacion, fechaAutorizacion, mensajes };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "No autorizado" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !caller) return json({ error: "Sesión inválida" }, 401);

  let body: { empresa_id: string; factura_id: string; descripcion_servicio?: string; forma_pago?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const { empresa_id, factura_id, descripcion_servicio, forma_pago } = body;
  if (!empresa_id || !factura_id) return json({ error: "empresa_id y factura_id son obligatorios" }, 400);

  // Verificar membresía
  const { data: mem } = await supabase
    .from("empresas_usuarios")
    .select("id")
    .eq("empresa_id", empresa_id)
    .eq("usuario_id", caller.id)
    .maybeSingle();
  if (!mem) return json({ error: "Acceso denegado" }, 403);

  // Cargar configuración
  const { data: config, error: configErr } = await supabase
    .from("empresa_facturacion_config")
    .select("*")
    .eq("empresa_id", empresa_id)
    .maybeSingle();
  if (configErr || !config) return json({ error: "Empresa sin configuración de facturación electrónica" }, 400);
  if (!config.cert_storage_path || !config.cert_clave) {
    return json({ error: "El certificado .p12 no ha sido cargado" }, 400);
  }

  // Cargar factura_emitida
  const { data: factura, error: factErr } = await supabase
    .from("facturas_emitidas")
    .select("*")
    .eq("id", factura_id)
    .eq("empresa_id", empresa_id)
    .maybeSingle();
  if (factErr || !factura) return json({ error: "Factura no encontrada" }, 404);

  // Verificar que no esté ya emitida
  const { data: existente } = await supabase
    .from("comprobantes_electronicos")
    .select("id, estado, clave_acceso, numero_autorizacion")
    .eq("referencia_id", factura_id)
    .eq("tipo", "factura")
    .maybeSingle();
  if (existente?.estado === "autorizado") {
    return json({
      ok: true,
      clave_acceso: existente.clave_acceso,
      estado: "autorizado",
      numero_autorizacion: existente.numero_autorizacion,
      mensaje_sri: "Ya autorizado anteriormente",
    });
  }

  // Obtener siguiente secuencial (atómico)
  const { data: secData, error: secErr } = await supabase
    .rpc("sri_siguiente_secuencial", { p_empresa_id: empresa_id, p_tipo: "factura" });
  if (secErr) return json({ error: `Error obteniendo secuencial: ${secErr.message}` }, 500);
  const secuencial = (secData as number).toString().padStart(9, "0");

  // Serie
  const serie = `${config.establecimiento}${config.punto_emision}`;
  const numero = `${config.establecimiento}-${config.punto_emision}-${secuencial}`;

  // Fecha
  const fechaEmision = factura.fecha ? new Date(factura.fecha + "T12:00:00") : new Date();
  const ambienteCodigo: "1" | "2" = config.ambiente === "produccion" ? "2" : "1";

  // Clave de acceso
  const claveAcceso = generarClaveAcceso(fechaEmision, "01", config.ruc, ambienteCodigo, serie, secuencial);

  // Calcular IVA tasa
  const subtotal = Number(factura.subtotal ?? 0);
  const iva = Number(factura.iva ?? 0);
  const ivaTasa = subtotal > 0 ? Math.round((iva / subtotal) * 100) : 15;

  // Datos para XML
  const facturaData: FacturaData = {
    claveAcceso,
    ambiente: ambienteCodigo,
    ruc: config.ruc,
    razonSocial: config.razon_social,
    nombreComercial: config.nombre_comercial ?? config.razon_social,
    dirMatriz: config.dir_matriz,
    dirEstablecimiento: config.dir_establecimiento ?? config.dir_matriz,
    estab: config.establecimiento,
    ptoEmi: config.punto_emision,
    secuencial,
    obligadoContabilidad: config.obligado_contabilidad ? "SI" : "NO",
    contribuyenteEspecial: config.contribuyente_especial ?? "",
    fechaEmision: fmtFecha(fechaEmision),
    tipoIdentificacion: tipoIdentificacion(factura.ruc_cliente),
    razonSocialComprador: factura.razon_social ?? "CONSUMIDOR FINAL",
    identificacionComprador: factura.ruc_cliente ?? "9999999999999",
    subtotal,
    descuento: Number(factura.descuento ?? 0),
    iva,
    ivaTasa,
    total: Number(factura.total ?? 0),
    descripcionServicio: descripcion_servicio ?? factura.observacion ?? "Servicios profesionales",
    formaPago: forma_pago ?? "01",
    moneda: "DOLAR",
  };

  // Generar XML
  const xmlSinFirma = generarXmlFactura(facturaData);

  // Cargar .p12 de storage
  const { data: certData, error: certErr } = await supabase.storage
    .from("certificados-sri")
    .download(config.cert_storage_path);
  if (certErr || !certData) return json({ error: `Error cargando certificado: ${certErr?.message}` }, 500);
  const certBytes = new Uint8Array(await certData.arrayBuffer());

  // Firmar XAdES-BES
  let xmlFirmado: string;
  try {
    const resultado = firmarXadesBeS(xmlSinFirma, certBytes, config.cert_clave);
    xmlFirmado = resultado.xml;
  } catch (e) {
    return json({ error: `Error firmando: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }

  // Guardar comprobante pendiente (o actualizar si ya existía)
  const compPayload = {
    empresa_id,
    tipo: "factura",
    numero,
    clave_acceso: claveAcceso,
    estado: "pendiente",
    fecha_emision: fechaEmision.toISOString().split("T")[0],
    xml_sin_firma: xmlSinFirma,
    xml_firmado: xmlFirmado,
    referencia_tipo: "factura_emitida",
    referencia_id: factura_id,
    updated_at: new Date().toISOString(),
  };

  let compId: string;
  if (existente) {
    const { data: updated } = await supabase
      .from("comprobantes_electronicos")
      .update(compPayload)
      .eq("id", existente.id)
      .select("id")
      .single();
    compId = updated?.id ?? existente.id;
  } else {
    const { data: inserted } = await supabase
      .from("comprobantes_electronicos")
      .insert(compPayload)
      .select("id")
      .single();
    compId = inserted?.id ?? "";
  }

  // Enviar al SRI
  const endpoints = SRI_ENDPOINTS[config.ambiente as "pruebas" | "produccion"] ?? SRI_ENDPOINTS.pruebas;
  let estadoFinal = "enviado";
  let mensajeSri = "";

  try {
    const recv = await enviarSoap(endpoints.recepcion, xmlFirmado);
    mensajeSri = recv.mensajes;

    if (recv.estado === "RECIBIDA") {
      // Consultar autorización (puede demorar, reintentar 3 veces)
      let autorizacion = { estado: "PENDIENTE", numeroAutorizacion: "", fechaAutorizacion: "", mensajes: "" };
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        autorizacion = await consultarAutorizacion(endpoints.autorizacion, claveAcceso);
        if (autorizacion.estado === "AUTORIZADO") break;
      }

      if (autorizacion.estado === "AUTORIZADO") {
        estadoFinal = "autorizado";
        mensajeSri = autorizacion.mensajes || "Autorizado por el SRI";
        await supabase.from("comprobantes_electronicos").update({
          estado: "autorizado",
          numero_autorizacion: autorizacion.numeroAutorizacion || claveAcceso,
          fecha_autorizacion: autorizacion.fechaAutorizacion || new Date().toISOString(),
          mensaje_sri: mensajeSri,
          updated_at: new Date().toISOString(),
        }).eq("id", compId);

        return json({
          ok: true,
          clave_acceso: claveAcceso,
          numero,
          estado: "autorizado",
          numero_autorizacion: autorizacion.numeroAutorizacion || claveAcceso,
          fecha_autorizacion: autorizacion.fechaAutorizacion,
          mensaje_sri: mensajeSri,
        });
      } else {
        estadoFinal = "enviado";
        mensajeSri = autorizacion.mensajes || "En proceso de autorización";
      }
    } else {
      // DEVUELTA = errores en el XML
      estadoFinal = "rechazado";
      mensajeSri = recv.mensajes || "Comprobante devuelto por el SRI";
    }
  } catch (e) {
    estadoFinal = "enviado";
    mensajeSri = `Error de comunicación con SRI: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Actualizar estado
  await supabase.from("comprobantes_electronicos").update({
    estado: estadoFinal,
    mensaje_sri: mensajeSri,
    updated_at: new Date().toISOString(),
  }).eq("id", compId);

  return json({
    ok: estadoFinal !== "rechazado",
    clave_acceso: claveAcceso,
    numero,
    estado: estadoFinal,
    mensaje_sri: mensajeSri,
  });
});
