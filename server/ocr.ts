/**
 * Reconhecimento de documentos contábeis brasileiros
 * Estratégia: extração de texto do PDF + templates de regex por tipo de documento
 * Sem dependência de IA externa — funciona 100% offline
 */

export interface DocumentRecognition {
  documentType: string; // DAS | DAS_MEI | NFS | DCTF | SPED | OUTROS | UNKNOWN
  cnpj?: string;
  cpf?: string;
  competencia?: string; // MM/YYYY
  valorPrincipal?: string;
  codigoBarras?: string;
  dataVencimento?: string;
  confidence: number; // 0-100
  extractedText?: string;
}

// ── Extração de texto do PDF via descompressão zlib ───────────────────────────
function extractRawTextFromPdf(base64: string): string {
  try {
    const pdfBuffer = Buffer.from(base64, "base64");
    const allStrings: string[] = [];

    // PDFs usam streams comprimidos com zlib (FlateDecode)
    // Varre o arquivo procurando bytes de cabeçalho zlib válidos: 0x78 0x9C, 0x78 0xDA, etc.
    const zlibHeaders = [0x9c, 0xda, 0x01, 0x5e, 0x9d, 0xdb];
    let i = 0;
    while (i < pdfBuffer.length - 2) {
      if (pdfBuffer[i] === 0x78 && zlibHeaders.includes(pdfBuffer[i + 1]!)) {
        try {
          const chunk = pdfBuffer.slice(i, Math.min(i + 500_000, pdfBuffer.length));
          const decompressed = (require("zlib") as any).inflateSync(chunk);
          const text = decompressed.toString("latin1");

          // Só processa streams que contenham conteúdo relevante
          const hasTaxKeywords = /Simples|Arrecada|CNPJ|SENDA|Vencimento|Nota Fiscal|DCTFWeb|DARF|SPED|MEI/i.test(text);
          if (hasTaxKeywords) {
            // Extrai strings entre parênteses: padrão PDF para texto
            const matches = text.match(/\(([^\)]{1,300})\)/g) ?? [];
            for (const m of matches) {
              const s = m.slice(1, -1).trim();
              if (s.length > 0) allStrings.push(s);
            }
          }
        } catch {
          // Stream inválido — continua
        }
      }
      i++;
    }

    if (allStrings.length === 0) return "";

    const result = allStrings.join(" ").slice(0, 10_000);
    console.log(`[OCR] Extracted ${result.length} chars from PDF (${allStrings.length} strings)`);
    return result;
  } catch (err) {
    console.warn("[OCR] PDF extraction error:", err);
    return "";
  }
}

// ── Templates de reconhecimento por tipo de documento ────────────────────────

interface DocTemplate {
  name: string;
  documentType: string;
  // Qualquer um desses padrões no texto identifica o documento
  identifiers: RegExp[];
  // Extrai campos específicos do documento
  extractors: {
    cnpj?: RegExp;
    cpf?: RegExp;
    competencia?: RegExp; // retorna string MM/YYYY
    valor?: RegExp;
    codigoBarras?: RegExp;
    dataVencimento?: RegExp;
  };
  // Peso de confiança (0-100) quando identificado
  baseConfidence: number;
}

const DOCUMENT_TEMPLATES: DocTemplate[] = [
  // ── DAS Simples Nacional ────────────────────────────────────────────────────
  {
    name: "DAS Simples Nacional",
    documentType: "DAS",
    identifiers: [
      /Documento de Arrecada[çc][aã]o\s+do\s+Simples Nacional/i,
      /PGDAS/i,
      /Simples Nacional/i,
      /SENDA/i, // software que gera o DAS
      /DAS[\s\-]Simples/i,
    ],
    extractors: {
      // CNPJ no formato XX.XXX.XXX/XXXX-XX
      cnpj: /(\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[\-\s]?\d{2})/,
      // Competência: "Abril/2026" ou "04/2026"
      competencia: /(Janeiro|Fevereiro|Mar[çc]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)[\/\s]*(20\d{2})|(0[1-9]|1[0-2])[\/\-](20\d{2})/i,
      // Data de vencimento: a primeira data DD/MM/YYYY encontrada após "Pagar" ou "Vencimento"
      dataVencimento: /(?:Pagar\s+este\s+documento\s+at[eé]|Pagar\s+at[eé]|Data\s+de\s+Vencimento)[^0-9]*(\d{2}\/\d{2}\/20\d{2})/i,
      // Valor total
      valor: /(?:Valor\s+Total\s+do\s+Documento|Valor:)[^0-9]*([\d]{1,6}[,]\d{2})/i,
      // Linha digitável (começa com 8 e tem muitos dígitos)
      codigoBarras: /(\d{5}\s?\d{5}\s?\d{5}\s?\d{6}\s?\d{5}\s?\d{6}\s?\d{1}\s?\d{14}|\d{47,48})/,
    },
    baseConfidence: 90,
  },

  // ── DAS MEI ─────────────────────────────────────────────────────────────────
  {
    name: "DAS MEI / SIMEI",
    documentType: "DAS_MEI",
    identifiers: [
      /SIMEI/i,
      /Microempreendedor Individual/i,
      /MEI[\s\-]/i,
      /CCMEI/i,
    ],
    extractors: {
      cpf: /(\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[\-\s]?\d{2})(?!\d)/,
      cnpj: /(\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[\-\s]?\d{2})/,
      competencia: /(?:Jan(?:eiro)?|Fev(?:ereiro)?|Mar(?:[çc]o)?|Abr(?:il)?|Mai(?:o)?|Jun(?:ho)?|Jul(?:ho)?|Ago(?:sto)?|Set(?:embro)?|Out(?:ubro)?|Nov(?:embro)?|Dez(?:embro)?)[\/\s]?(20\d{2})|(0[1-9]|1[0-2])[\/\-](20\d{2})/i,
      dataVencimento: /(?:Pagar at[eé]|vencimento)[:\s]*(\d{2}\/\d{2}\/20\d{2})/i,
      valor: /(?:Valor Total|Valor:)[:\s]*([\d\.]+,\d{2})/i,
      codigoBarras: /(\d{5}\s?\d{5}\s?\d{5}\s?\d{6}\s?\d{5}\s?\d{6}\s?\d{1}\s?\d{14}|\d{47,48})/,
    },
    baseConfidence: 90,
  },

  // ── DCTFWeb / DARF ──────────────────────────────────────────────────────────
  {
    name: "DCTFWeb / DARF",
    documentType: "DCTF",
    identifiers: [
      /DCTFWeb/i,
      /DCTF[\s\-]/i,
      /Documento de Arrecada[çc][aã]o de Receitas Federais/i,
      /DARF/i,
    ],
    extractors: {
      cnpj: /(\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[\-\s]?\d{2})/,
      competencia: /(0[1-9]|1[0-2])[\/\-](20\d{2})/,
      dataVencimento: /(?:Vencimento|Data)[:\s]*(\d{2}\/\d{2}\/20\d{2})/i,
      valor: /(?:Valor Principal|Valor Total|Valor)[:\s]*([\d\.]+,\d{2})/i,
      codigoBarras: /(\d{47,48})/,
    },
    baseConfidence: 85,
  },

  // ── NFS-e / Nota Fiscal de Serviço ──────────────────────────────────────────
  {
    name: "NFS-e / ISS",
    documentType: "NFS",
    identifiers: [
      /Nota Fiscal Eletr[oô]nica de Servi[çc]os/i,
      /NFS-?e/i,
      /ISS[\s\-]/i,
      /Imposto Sobre Servi[çc]os/i,
    ],
    extractors: {
      cnpj: /(?:Prestador|CNPJ)[:\s]*(\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[\-\s]?\d{2})/i,
      competencia: /(0[1-9]|1[0-2])[\/\-](20\d{2})/,
      valor: /(?:Valor do ISS|ISS a Recolher|Valor)[:\s]*([\d\.]+,\d{2})/i,
      dataVencimento: /(?:Vencimento|Pagar at[eé])[:\s]*(\d{2}\/\d{2}\/20\d{2})/i,
    },
    baseConfidence: 80,
  },

  // ── SPED ────────────────────────────────────────────────────────────────────
  {
    name: "SPED",
    documentType: "SPED",
    identifiers: [
      /SPED[\s\-]/i,
      /Escritura[çc][aã]o Cont[áa]bil\s+Digital/i,
      /ECD[\s\-]/i,
      /ECF[\s\-]/i,
    ],
    extractors: {
      cnpj: /(\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[\-\s]?\d{2})/,
      competencia: /(0[1-9]|1[0-2])[\/\-](20\d{2})/,
    },
    baseConfidence: 80,
  },
];

// ── Normaliza competência para MM/YYYY ────────────────────────────────────────
const MONTHS_PT: Record<string, string> = {
  janeiro: "01", fevereiro: "02", março: "03", marco: "03",
  abril: "04", maio: "05", junho: "06", julho: "07",
  agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};

function normalizeCompetencia(matchText: string): string | undefined {
  if (!matchText) return undefined;

  // Formato numérico: 04/2026
  const numericMatch = matchText.match(/(0[1-9]|1[0-2])[\/\-](20\d{2})/);
  if (numericMatch) return `${numericMatch[1]}/${numericMatch[2]}`;

  // Formato por extenso: Abril/2026, Abril 2026, etc.
  const extMatch = matchText.match(/(Janeiro|Fevereiro|Mar[çc]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)[\/\s]*(20\d{2})/i);
  if (extMatch) {
    const monthKey = extMatch[1]!.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace("ç", "c");
    const mm = MONTHS_PT[monthKey];
    if (mm) return `${mm}/${extMatch[2]}`;
  }

  return undefined;
}

function cleanCnpj(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 14);
}

function cleanCpf(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 11);
}

function formatCnpj(digits: string): string {
  if (digits.length !== 14) return digits;
  return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12,14)}`;
}

// ── Função principal de reconhecimento ────────────────────────────────────────
export async function recognizeDocument(
  _fileUrl: string,
  _mimeType: string,
  rawBase64?: string
): Promise<DocumentRecognition> {

  if (!rawBase64) {
    return { documentType: "UNKNOWN", confidence: 0 };
  }

  // Extrai texto do PDF
  const text = extractRawTextFromPdf(rawBase64);

  if (text.length < 10) {
    console.warn("[OCR] Could not extract text from PDF (possibly scanned/image-only)");
    return { documentType: "UNKNOWN", confidence: 0, extractedText: "" };
  }

  console.log(`[OCR] Extracted ${text.length} chars from PDF`);

  // Tenta cada template na ordem
  for (const tmpl of DOCUMENT_TEMPLATES) {
    const matched = tmpl.identifiers.some(rx => rx.test(text));
    if (!matched) continue;

    console.log(`[OCR] Matched template: ${tmpl.name}`);

    // Extrai campos
    const cnpjMatch = tmpl.extractors.cnpj ? text.match(tmpl.extractors.cnpj) : null;
    const cpfMatch  = tmpl.extractors.cpf  ? text.match(tmpl.extractors.cpf)  : null;
    const compMatch = tmpl.extractors.competencia ? text.match(tmpl.extractors.competencia) : null;
    const valorMatch = tmpl.extractors.valor ? text.match(tmpl.extractors.valor) : null;
    const cbMatch = tmpl.extractors.codigoBarras ? text.match(tmpl.extractors.codigoBarras) : null;
    const vencMatch = tmpl.extractors.dataVencimento ? text.match(tmpl.extractors.dataVencimento) : null;

    const cnpjRaw = cnpjMatch?.[1] ?? cnpjMatch?.[0];
    const cnpjDigits = cnpjRaw ? cleanCnpj(cnpjRaw) : undefined;
    const cpfRaw = cpfMatch?.[1] ?? cpfMatch?.[0];
    const cpfDigits = cpfRaw ? cleanCpf(cpfRaw) : undefined;

    // Para DAS MEI: verifica se o CNPJ encontrado é MEI (termina em /0001)
    // e se há CPF do titular — se tiver CPF, aumenta confiança para DAS_MEI
    let docType = tmpl.documentType;
    if (docType === "DAS" && cpfDigits && cpfDigits.length === 11) {
      // Presença de CPF junto com DAS pode indicar MEI
      // Mas o template já separou: se SIMEI/MEI aparece no texto, vai para DAS_MEI
    }

    const competencia = normalizeCompetencia(compMatch?.[0] ?? "");

    // Calcula confiança baseado em quantos campos foram extraídos
    let confidence = tmpl.baseConfidence;
    if (!cnpjDigits && !cpfDigits) confidence -= 20; // sem identificador do contribuinte
    if (!competencia)              confidence -= 15; // sem período de apuração
    if (!valorMatch)               confidence -= 5;  // sem valor (menos crítico)
    confidence = Math.max(0, Math.min(100, confidence));

    return {
      documentType: docType,
      cnpj: cnpjDigits ? formatCnpj(cnpjDigits) : undefined,
      cpf: cpfDigits && cpfDigits.length === 11 ? cpfDigits : undefined,
      competencia,
      valorPrincipal: valorMatch?.[1]?.replace(/\./g, "").replace(",", "."),
      codigoBarras: cbMatch?.[0]?.replace(/\s/g, ""),
      dataVencimento: vencMatch?.[1],
      confidence,
      extractedText: text.slice(0, 500),
    };
  }

  // Nenhum template reconheceu
  console.warn("[OCR] No template matched. Text sample:", text.slice(0, 200));
  return {
    documentType: "UNKNOWN",
    confidence: 0,
    extractedText: text.slice(0, 300),
  };
}

export function mapDocumentTypeToTaskType(documentType: string): string {
  const mapping: Record<string, string> = {
    DAS: "DAS Simples Nacional",
    DAS_MEI: "DAS MEI",
    NFS: "Emissão de Nota de Serviço",
    DCTF: "DCTF / DCTFWeb",
    SPED: "SPED Fiscal",
  };
  return mapping[documentType] || documentType;
}
