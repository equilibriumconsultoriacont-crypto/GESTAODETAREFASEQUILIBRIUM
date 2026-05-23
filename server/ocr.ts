/**
 * OCR de documentos contábeis brasileiros
 * Usa Anthropic Claude (via API) para reconhecer PDFs
 * Fallback: extração por regex do texto do PDF (sem IA)
 */

export interface DocumentRecognition {
  documentType: string; // DAS, DAS_MEI, NFS, DCTF, SPED, OUTROS, UNKNOWN
  cnpj?: string;
  cpf?: string;
  competencia?: string; // MM/YYYY
  valorPrincipal?: string;
  codigoBarras?: string;
  confidence: number; // 0-100
  extractedText?: string;
}

// ── Anthropic API direto (não depende do BUILT_IN_FORGE_API_KEY) ──────────────
async function recognizeViaAnthropic(base64: string, mimeType: string): Promise<DocumentRecognition | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: mimeType.includes("pdf") ? "application/pdf" : mimeType,
                data: base64,
              },
            },
            {
              type: "text",
              text: `Analise este documento contábil brasileiro e extraia as informações em JSON.

Campos obrigatórios:
- documentType: "DAS" (Simples Nacional/PGDAS), "DAS_MEI" (contém MEI/SIMEI/CPF), "NFS" (nota fiscal serviço), "DCTF", "SPED", "OUTROS"
- confidence: 0-100 (sua confiança na identificação)

Campos opcionais (extraia se existirem):
- cnpj: CNPJ no formato XX.XXX.XXX/XXXX-XX
- cpf: CPF no formato XXX.XXX.XXX-XX (comum no DAS MEI)
- competencia: mês/ano no formato MM/YYYY
- valorPrincipal: valor a pagar em reais (ex: "150.00")
- codigoBarras: linha digitável se visível

Dicas: DAS MEI tem "MEI", "Microempreendedor", "SIMEI" ou CPF principal. DAS Simples tem "PGDAS", "Simples Nacional", CNPJ.

Responda APENAS com JSON válido sem markdown.`,
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      console.warn("[OCR] Anthropic API error:", response.status);
      return null;
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;
    if (!content) return null;

    const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
    return {
      documentType: parsed.documentType || "UNKNOWN",
      cnpj: parsed.cnpj || undefined,
      cpf: parsed.cpf || undefined,
      competencia: parsed.competencia || undefined,
      valorPrincipal: parsed.valorPrincipal || undefined,
      codigoBarras: parsed.codigoBarras || undefined,
      confidence: parsed.confidence || 50,
    };
  } catch (err) {
    console.warn("[OCR] Anthropic recognition failed:", err);
    return null;
  }
}

// ── Extração por regex (fallback sem IA) ────────────────────────────────────
function extractFromText(text: string): DocumentRecognition {
  const upper = text.toUpperCase();

  // Tipo de documento
  let documentType = "OUTROS";
  let confidence = 60;

  if (upper.includes("SIMEI") || upper.includes("MEI") || upper.includes("MICROEMPREENDEDOR")) {
    documentType = "DAS_MEI";
    confidence = 85;
  } else if (upper.includes("PGDAS") || upper.includes("SIMPLES NACIONAL") || upper.includes("DAS")) {
    documentType = "DAS";
    confidence = 85;
  } else if (upper.includes("NOTA FISCAL") || upper.includes("NFS") || upper.includes("ISS")) {
    documentType = "NFS";
    confidence = 75;
  } else if (upper.includes("DCTF") || upper.includes("DCTFWeb")) {
    documentType = "DCTF";
    confidence = 80;
  } else if (upper.includes("SPED")) {
    documentType = "SPED";
    confidence = 80;
  }

  // CNPJ: XX.XXX.XXX/XXXX-XX
  const cnpjMatch = text.match(/\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[\-\s]?\d{2}/);
  const cnpj = cnpjMatch ? cnpjMatch[0].replace(/\s/g, "") : undefined;

  // CPF: XXX.XXX.XXX-XX
  const cpfMatch = text.match(/\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[\-\s]?\d{2}(?!\d)/);
  const cpf = cpfMatch && documentType === "DAS_MEI" ? cpfMatch[0] : undefined;

  // Competência: MM/YYYY ou MM-YYYY
  const compMatch = text.match(/\b(0[1-9]|1[0-2])[\/\-](20\d{2})\b/);
  const competencia = compMatch ? `${compMatch[1]}/${compMatch[2]}` : undefined;

  // Valor: R$ X.XXX,XX ou X.XXX,XX
  const valorMatch = text.match(/R\$\s*([\d\.,]+)/);
  const valorPrincipal = valorMatch ? valorMatch[1].replace(".", "").replace(",", ".") : undefined;

  return { documentType, cnpj, cpf, competencia, valorPrincipal, confidence };
}

// ── Extração de texto de PDF base64 (sem biblioteca externa) ────────────────
function extractTextFromPdfBase64(base64: string): string {
  try {
    const buffer = Buffer.from(base64, "base64");
    const str = buffer.toString("latin1");
    // Extrai streams de texto do PDF (objetos BT/ET com Tj/TJ)
    const textParts: string[] = [];
    const patterns = [
      /\(([^)]{1,200})\)\s*Tj/g,           // (texto) Tj
      /\[((?:[^[\]]*\([^)]*\)[^[\]]*)*)\]\s*TJ/g, // [texto] TJ
      /<<.*?\/BaseFont\s*\/([^\s\/]+)/g,   // fontes (para contexto)
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(str)) !== null) {
        const text = match[1]
          .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
          .replace(/\\n/g, " ").replace(/\\r/g, " ").replace(/\\\\/g, "\\")
          .replace(/\\'/g, "'").replace(/\\\(/g, "(").replace(/\\\)/g, ")");
        if (text.trim().length > 1) textParts.push(text.trim());
      }
    }
    return textParts.join(" ").substring(0, 3000);
  } catch {
    return "";
  }
}

// ── Função principal exportada ────────────────────────────────────────────────
export async function recognizeDocument(
  fileUrlOrBase64: string,
  mimeType: string,
  rawBase64?: string // base64 bruto para Anthropic (mais eficiente)
): Promise<DocumentRecognition> {
  try {
    // Estratégia 1: usar Anthropic API se disponível (mais preciso)
    const base64ToUse = rawBase64 || (fileUrlOrBase64.startsWith("data:") ? fileUrlOrBase64.split(",")[1] : null);

    if (base64ToUse) {
      const anthropicResult = await recognizeViaAnthropic(base64ToUse, mimeType);
      if (anthropicResult && anthropicResult.confidence >= 40) {
        console.log(`[OCR] Anthropic recognized: ${anthropicResult.documentType} (${anthropicResult.confidence}%)`);
        return anthropicResult;
      }
    }

    // Estratégia 2: extração de texto do PDF por regex (sem IA)
    const pdfBase64 = base64ToUse || "";
    if (pdfBase64) {
      const text = extractTextFromPdfBase64(pdfBase64);
      if (text.length > 20) {
        const result = extractFromText(text);
        console.log(`[OCR] Regex extracted: ${result.documentType} (${result.confidence}%)`);
        return { ...result, extractedText: text.substring(0, 500) };
      }
    }

    // Estratégia 3: usar forge API legada se configurada
    if (process.env.BUILT_IN_FORGE_API_KEY) {
      const { invokeLLM } = await import("./_core/llm");
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Você é um especialista em documentos contábeis brasileiros. Analise o documento e responda APENAS com JSON: {documentType, cnpj, cpf, competencia, valorPrincipal, codigoBarras, confidence}`,
          },
          {
            role: "user",
            content: [{ type: "file_url", file_url: { url: fileUrlOrBase64, detail: "high" } } as any],
          },
        ],
        response_format: { type: "json_schema", json_schema: { name: "doc_recognition", strict: true, schema: { type: "object", properties: { documentType: { type: "string" }, cnpj: { type: "string" }, cpf: { type: "string" }, competencia: { type: "string" }, valorPrincipal: { type: "string" }, codigoBarras: { type: "string" }, confidence: { type: "integer" } }, required: ["documentType", "confidence"], additionalProperties: false } } },
      });
      const content = typeof response.choices[0]?.message?.content === "string" ? response.choices[0].message.content : JSON.stringify(response.choices[0]?.message?.content);
      if (content) {
        const parsed = JSON.parse(content);
        return { documentType: parsed.documentType || "UNKNOWN", cnpj: parsed.cnpj, cpf: parsed.cpf, competencia: parsed.competencia, valorPrincipal: parsed.valorPrincipal, codigoBarras: parsed.codigoBarras, confidence: parsed.confidence || 0 };
      }
    }

    return { documentType: "UNKNOWN", confidence: 0 };
  } catch (error) {
    console.error("[OCR] Error recognizing document:", error);
    return { documentType: "UNKNOWN", confidence: 0 };
  }
}

export function mapDocumentTypeToTaskType(documentType: string): string {
  const mapping: Record<string, string> = {
    DAS: "DAS Simples Nacional",
    DAS_MEI: "DAS MEI",
    NFS: "Emissão de Nota de Serviço",
    DCTF: "DCTF - Declaração de Débitos e Créditos",
    SPED: "SPED Fiscal",
    IRPF: "IRPF - Imposto de Renda",
    ECF: "ECF - Escrituração Contábil Fiscal",
    RPA: "RPA - Recibo de Pagamento Autônomo",
  };
  return mapping[documentType] || documentType;
}
