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
  // Para nodos de texto XML: sólo &, <, > requieren escape.
  // C14N NO encode " → &quot; ni ' → &apos; en contenido de texto;
  // usar esas entidades causaría un hash diferente al que el validador SRI computa.
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── XAdES-BES Signing ────────────────────────────────────────────────────────

interface SignedResult {
  xml: string;
  debug: {
    certSubject: string;
    certSerial: string;
    certExpiry: string;
    issuerAttrs: string;
    contentDigest: string;
    spDigest: string;
    signedPropsXml: string;
    signedInfoXml: string;
    signingMethod: string;
    sigVerified: boolean;
    xmlFirmadoEnd: string;
  };
}

/** Bytes a base64 (sin encapsulación PEM) */
function toB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** SHA-1 via Web Crypto → base64 */
async function sha1b64(data: Uint8Array): Promise<string> {
  return toB64(new Uint8Array(await crypto.subtle.digest("SHA-1", data)));
}

async function firmarXadesBeS(xmlSinFirma: string, p12Bytes: Uint8Array, clave: string): Promise<SignedResult> {
  // 1. Parsear .p12 con forge (sólo para PKCS12 unpacking)
  const p12Der = forge.util.binary.raw.encode(p12Bytes);
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, clave);

  // 2. Extraer clave privada
  let privateKey: forge.pki.rsa.PrivateKey | null = null;
  const shroudedBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const shroudedKey = shroudedBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  if (shroudedKey?.key) privateKey = shroudedKey.key as forge.pki.rsa.PrivateKey;
  if (!privateKey) {
    const plainBags = p12.getBags({ bagType: forge.pki.oids.keyBag });
    const plainKey = plainBags[forge.pki.oids.keyBag]?.[0];
    if (plainKey?.key) privateKey = plainKey.key as forge.pki.rsa.PrivateKey;
  }
  if (!privateKey) throw new Error("No se pudo extraer la clave privada del .p12");

  // 3. Extraer certificado (por módulo RSA)
  const allCertBags = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]) ?? [];
  const keyModulus = (privateKey as forge.pki.rsa.PrivateKey).n.toString(16);
  let cert: forge.pki.Certificate | null = null;
  let certBagFound: Record<string, unknown> | null = null;
  for (const bag of allCertBags) {
    if (!bag.cert) continue;
    try {
      const pubKey = bag.cert.publicKey as forge.pki.rsa.PublicKey;
      if (pubKey?.n && pubKey.n.toString(16) === keyModulus) { cert = bag.cert; certBagFound = bag as unknown as Record<string, unknown>; break; }
    } catch { /* skip */ }
  }
  if (!cert) { cert = allCertBags[0]?.cert ?? null; certBagFound = (allCertBags[0] as unknown as Record<string, unknown>) ?? null; }
  if (!cert) throw new Error("No se pudo extraer el certificado del .p12");

  // 4. Cert DER → base64
  // Usar el ASN1 crudo del bag (evitar posibles diferencias en el re-encoding de forge).
  // bag.asn1 contiene el CertBag; el certificado DER está en bag.asn1.value[0].
  // Si no está disponible, caer en el re-encoding via pki.certificateToAsn1.
  let certDerBytes: Uint8Array;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawBagAsn1 = (certBagFound as any)?.asn1;
    const certAsn1Raw = rawBagAsn1?.value?.[0] ?? rawBagAsn1;
    if (certAsn1Raw && typeof certAsn1Raw === "object" && certAsn1Raw.tagClass !== undefined) {
      const derStr = forge.asn1.toDer(certAsn1Raw).getBytes();
      certDerBytes = Uint8Array.from(derStr, c => c.charCodeAt(0));
    } else {
      throw new Error("no raw asn1");
    }
  } catch {
    // Fallback: re-encode desde el objeto cert
    const certAsn1 = forge.pki.certificateToAsn1(cert);
    const certDerStr = forge.asn1.toDer(certAsn1).getBytes();
    certDerBytes = Uint8Array.from(certDerStr, c => c.charCodeAt(0));
  }
  const certBase64 = toB64(certDerBytes);

  // 5. SHA-1 del cert (Web Crypto)
  const certDigest = await sha1b64(certDerBytes);

  // 6. Issuer DN y serial
  // RFC 2253 requiere orden INVERSO al DER (CN,...,C). forge devuelve orden DER.
  // El validador SRI usa X500Principal.getName() que produce RFC 2253 (invertido).
  const issuerAttrs = cert.issuer.attributes
    .slice()
    .reverse()
    .map((a: forge.pki.CertificateField) => `${a.shortName ?? a.type}=${a.value}`)
    .join(",");
  const serialNumber = new forge.jsbn.BigInteger(cert.serialNumber, 16).toString(10);

  // 7. Signing time (ISO sin ms, offset Ecuador UTC-5)
  // El Edge Function corre en UTC. Para expresar la hora en Ecuador (-05:00) hay que
  // restar 5h al tiempo UTC y luego agregarle el offset literal "-05:00".
  const now = new Date();
  const ecuadorMs = now.getTime() - 5 * 60 * 60 * 1000;
  const signingTime = new Date(ecuadorMs).toISOString().split(".")[0] + "-05:00";

  // 8. Content digest — C14N del documento sin declaración XML (Web Crypto SHA-1).
  //    C14N normaliza \r\n y \r → \n en nodos de texto. Lo aplicamos antes de hashear
  //    para que coincida con lo que Apache XMLSec computa en el servidor SRI.
  const xmlBodyRaw = xmlSinFirma.replace(/^<\?xml[^?]*\?>\n?/, "");
  const xmlBody = xmlBodyRaw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const contentDigest = await sha1b64(new TextEncoder().encode(xmlBody));

  // 9. SignedProperties SIN namespace declarations en el root.
  //
  //    REGLA C14N (W3C Canonical XML 1.0):
  //    Un namespace NO se re-renderiza en un elemento hijo si ya está declarado
  //    en un antecesor con el mismo valor. El validador SRI (Java/Apache XMLSec)
  //    hace C14N del <xades:SignedProperties> *dentro del documento*, donde
  //    xmlns:ds y xmlns:xades ya vienen del <ds:Signature> padre.
  //    → C14N de SignedProperties embebido = string SIN esas declaraciones.
  //    → Debemos hashear el mismo string (sin declaraciones) para que spDigest coincida.
  //
  //    REGLA C14N SUBTREE (W3C Canonical XML 1.0, sec 2.3):
  //    Cuando el validador SRI extrae un nodo por URI="#Signature-SignedProperties"
  //    y aplica C14N, el nodo raíz del subtree NO tiene ancestor en el output →
  //    TODOS los namespaces en-scope desde el documento se renderizan EN el nodo raíz.
  //    El parent <ds:Signature xmlns:ds="..." xmlns:xades="..."> no está en el subtree
  //    → sus namespaces se "re-declaran" en <xades:SignedProperties>.
  //    Lo mismo para <ds:SignedInfo> al canonicalizar para verificar la firma RSA.
  //    → Debemos incluir xmlns:ds y xmlns:xades en AMBOS elementos (orden alfabético).
  const NS_DS = `xmlns:ds="http://www.w3.org/2000/09/xmldsig#"`;
  const NS_XADES = `xmlns:xades="http://uri.etsi.org/01903/v1.3.2#"`;
  const signedPropsXml = `<xades:SignedProperties ${NS_DS} ${NS_XADES} Id="Signature-SignedProperties"><xades:SignedSignatureProperties><xades:SigningTime>${signingTime}</xades:SigningTime><xades:SigningCertificate><xades:Cert><xades:CertDigest><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></ds:DigestMethod><ds:DigestValue>${certDigest}</ds:DigestValue></xades:CertDigest><xades:IssuerSerial><ds:X509IssuerName>${escXml(issuerAttrs)}</ds:X509IssuerName><ds:X509SerialNumber>${serialNumber}</ds:X509SerialNumber></xades:IssuerSerial></xades:Cert></xades:SigningCertificate></xades:SignedSignatureProperties></xades:SignedProperties>`;

  // 10. SP digest — hashear el mismo string que el validador obtiene de C14N
  const spDigest = await sha1b64(new TextEncoder().encode(signedPropsXml));

  // 11. SignedInfo — SÓLO xmlns:ds, NO xmlns:xades.
  //
  //    REGLA C14N CRÍTICA: Apache XMLSec canonicaliza <ds:SignedInfo> DESDE el documento
  //    parsed. En-scope en ese contexto: xmlns:ds (utilizado — todos los elementos usan ds:)
  //    y xmlns:xades (en-scope desde <ds:Signature> pero NO utilizado en <ds:SignedInfo>
  //    — ningún elemento ni atributo usa el prefijo xades: dentro de SignedInfo).
  //    C14N SÓLO renderiza namespaces "visibly utilized" (W3C C14N 1.0 sec 2.3).
  //    → C14N produce: <ds:SignedInfo xmlns:ds="..."> SIN xmlns:xades.
  //    → Debemos firmar ese mismo string (sin xmlns:xades) para que la verificación RSA
  //      del SRI coincida con nuestra firma.
  //
  //    sigVerified=true localmente no detectaba este bug porque verificábamos contra
  //    el mismo string que firmamos (con xmlns:xades extra), no contra el C14N real.
  // 11. SignedInfo — URI="#comprobante" (obligatorio SRI Ecuador).
  //
  //    El SRI Ecuador valida explícitamente que exista una <ds:Reference URI="#comprobante">
  //    que apunte al elemento <factura id="comprobante">. Usar URI="" produce el error
  //    "El nodo [comprobante] no se encuentra firmado."
  //
  //    Con URI="#comprobante" + enveloped-signature + C14N:
  //    – El validador extrae el elemento <factura id="comprobante"> y sus descendientes
  //    – Enveloped-signature elimina <ds:Signature> del node-set
  //    – C14N del node-set restante = idéntico a nuestro xmlBody (sin declaración XML)
  //    – El contentDigest calculado sobre xmlSinFirma sigue siendo correcto.
  //
  //    SÓLO xmlns:ds (no xmlns:xades): C14N de <ds:SignedInfo> sólo renderiza namespaces
  //    utilizados en el subtree; xades: no aparece en ningún elemento/atributo de SignedInfo.
  // 11. SignedInfo SIN declaraciones de namespace.
  //
  //    REGLA C14N (full-document context, NO subtree):
  //    Apache XMLSec canonicaliza <ds:SignedInfo> dentro del documento completo.
  //    El padre <ds:Signature xmlns:ds="..." xmlns:xades="..."> ya renderizó xmlns:ds.
  //    C14N considera esa declaración REDUNDANTE en el hijo <ds:SignedInfo> → no la emite.
  //    → C14N produce: <ds:SignedInfo>...(sin namespaces)...</ds:SignedInfo>
  //    → Debemos firmar ese mismo string (sin xmlns:ds ni xmlns:xades).
  //
  //    Contraste con signedPropsXml:
  //    <xades:SignedProperties> se extrae por ID reference (subtree C14N) → los ancestros
  //    están FUERA del node-set → C14N re-declara todos los namespaces en-scope en la raíz
  //    del subtree → signedPropsXml sí debe llevar xmlns:ds y xmlns:xades.
  //
  //    Lo mismo aplica a <ds:SignedInfo>: Apache XMLSec también lo canonicaliza como
  //    subtree extraction. Los namespaces en-scope desde <ds:Signature> (ds y xades) son
  //    ancestros FUERA del node-set → C14N Inclusivo los re-declara en <ds:SignedInfo>.
  //    Orden C14N: namespaces antes que atributos, ordenados por prefijo (ds < xades).
  const signedInfoXml = `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#"><ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></ds:CanonicalizationMethod><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></ds:SignatureMethod><ds:Reference URI="#comprobante"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></ds:Transform><ds:Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></ds:DigestMethod><ds:DigestValue>${contentDigest}</ds:DigestValue></ds:Reference><ds:Reference Type="http://uri.etsi.org/01903#SignedProperties" URI="#Signature-SignedProperties"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></ds:DigestMethod><ds:DigestValue>${spDigest}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;

  // 12. Firmar con forge RSA-SHA1 nativo (evita el pipeline PKCS8 de Web Crypto
  //     y el posible problema con SHA-1 deprecado en ring/Deno crypto.subtle)
  const md = forge.md.sha1.create();
  md.update(signedInfoXml, "utf8");
  const sigBinary = privateKey.sign(md);
  // Use toB64 (btoa-based, no line breaks) instead of forge.util.encode64
  const sigBytes = Uint8Array.from(sigBinary as string, (c: string) => c.charCodeAt(0));
  const signatureValue = toB64(sigBytes);

  // 12b. Local RSA self-verification (diagnostic)
  const pubKey = cert.publicKey as forge.pki.rsa.PublicKey;
  const mdVerify = forge.md.sha1.create();
  mdVerify.update(signedInfoXml, "utf8");
  let sigVerified = false;
  try {
    sigVerified = pubKey.verify(mdVerify.digest().bytes(), sigBinary as string);
  } catch { sigVerified = false; }

  // 13. Ensamblar bloque de firma.
  //     xmlns:ds y xmlns:xades se declaran UNA SOLA VEZ en <ds:Signature>.
  //     Los elementos hijos (SignedInfo, SignedProperties) los heredan — no los repiten.
  const signatureBlock = `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="Signature">${signedInfoXml}<ds:SignatureValue Id="SignatureValue">${signatureValue}</ds:SignatureValue><ds:KeyInfo Id="Certificate"><ds:X509Data><ds:X509Certificate>${certBase64}</ds:X509Certificate></ds:X509Data></ds:KeyInfo><ds:Object Id="Signature-QualifyingProperties"><xades:QualifyingProperties Target="#Signature">${signedPropsXml}</xades:QualifyingProperties></ds:Object></ds:Signature>`;

  const xmlFirmado = xmlSinFirma.replace(/(<\/factura>)$/, `${signatureBlock}</factura>`);

  return {
    xml: xmlFirmado,
    debug: {
      certSubject: cert.subject.attributes.map((a: forge.pki.CertificateField) => `${a.shortName ?? a.type}=${a.value}`).join(","),
      certSerial: serialNumber,
      certExpiry: cert.validity.notAfter.toISOString(),
      issuerAttrs,
      contentDigest,
      spDigest,
      signedPropsXml,
      signedInfoXml,
      signingMethod: "forge-rsa-sha1",
      sigVerified,
      xmlFirmadoEnd: xmlFirmado.substring(xmlFirmado.length - 200),
    },
  };
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

/** Encode a string to base64 using UTF-8 byte representation (not Latin-1) */
function base64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function enviarSoap(url: string, xmlFirmado: string): Promise<{ estado: string; mensajes: string }> {
  const xmlB64 = base64Utf8(xmlFirmado);
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

  return { estado, mensajes, rawText: respText.substring(0, 2000) };
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

  // Extraer errores — el bloque <mensajes> está DESPUÉS del <comprobante> enorme (base64)
  // Capturar el bloque mensajes directamente; si no cabe en el inicio, buscar desde el final
  const mensajesBlockMatch = respText.match(/<mensajes>([\s\S]*?)<\/mensajes>/);
  const mensajesBlock = mensajesBlockMatch?.[0] ?? "";

  const identificadores = [...respText.matchAll(/<identificador>([^<]*)<\/identificador>/g)].map(m => m[1]);
  const tiposErr = [...respText.matchAll(/<tipo>([^<]*)<\/tipo>/g)].map(m => m[1]);
  const mensajeTextos = [...respText.matchAll(/<mensaje>([^<]{1,200})<\/mensaje>/g)].map(m => m[1]).filter(t => !t.includes("<"));
  const infoAdicional = [...respText.matchAll(/<informacionAdicional>([^<]{1,500})<\/informacionAdicional>/g)].map(m => m[1]);
  const mensajes = identificadores.length
    ? identificadores.map((id, i) => `${id}:${tiposErr[i] ?? ""}:${mensajeTextos[i] ?? ""}${infoAdicional[i] ? " [" + infoAdicional[i] + "]" : ""}`).join("; ")
    : mensajeTextos.join("; ");

  // rawText: primeros 500 chars + bloque mensajes completo + últimos 500 chars
  const rawSnippet = respText.substring(0, 500) + "\n...\n" + mensajesBlock + "\n...\n" + respText.substring(Math.max(0, respText.length - 500));

  return { estado, numeroAutorizacion, fechaAutorizacion, mensajes, rawText: rawSnippet };
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
  let debugInfo: Record<string, unknown> = {};
  try {
    const resultado = await firmarXadesBeS(xmlSinFirma, certBytes, config.cert_clave);
    xmlFirmado = resultado.xml;
    debugInfo = resultado.debug;
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
  let rawRecepcion = "";
  let rawAutorizacion = "";

  try {
    const recv = await enviarSoap(endpoints.recepcion, xmlFirmado);
    rawRecepcion = recv.rawText ?? "";
    mensajeSri = recv.mensajes;

    if (recv.estado === "RECIBIDA") {
      // Consultar autorización (puede demorar, reintentar 3 veces)
      let autorizacion = { estado: "PENDIENTE", numeroAutorizacion: "", fechaAutorizacion: "", mensajes: "", rawText: "" };
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        autorizacion = await consultarAutorizacion(endpoints.autorizacion, claveAcceso);
        rawAutorizacion = autorizacion.rawText ?? "";
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
    ...(config.ambiente !== "produccion" ? {
      debug: {
        ...debugInfo,
        rawRecepcion,
        rawAutorizacion,
      },
    } : {}),
  });
});
