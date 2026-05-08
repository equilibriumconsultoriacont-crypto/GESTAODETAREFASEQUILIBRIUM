import { invokeLLM } from "./_core/llm";

export interface DocumentRecognition {
  documentType: string; // DAS, DAS_MEI, NFS, DCTF, SPED, etc.
  cnpj?: string;
  cpf?: string;
  competencia?: string; // MM/YYYY
  valorPrincipal?: string;
  codigoBarras?: string;
  confidence: number; // 0-100
  extractedText?: string;
}

/**
 * Reconhecer tipo de guia e extrair informações do PDF usando IA
 * Suporta: DAS, DAS_MEI, NFS, DCTF, SPED, e outros documentos contábeis
 */
export async function recognizeDocument(
  fileUrl: string,
  mimeType: string
): Promise<DocumentRecognition> {
  try {
    if (!mimeType.includes("pdf") && !mimeType.includes("image")) {
      return { documentType: "UNKNOWN", confidence: 0 };
    }

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Você é um especialista em documentos contábeis brasileiros, com foco especial em guias DAS (Simples Nacional) e DAS MEI.

Analise o documento fornecido e extraia em JSON:
- documentType: tipo exato do documento. Use "DAS" para DAS Simples Nacional, "DAS_MEI" para DAS do MEI (Microempreendedor Individual), "NFS" para Nota Fiscal de Serviço, "DCTF", "SPED", "IRPF", "ECF", ou "OUTROS"
- cnpj: CNPJ do contribuinte (formato XX.XXX.XXX/XXXX-XX), se presente
- cpf: CPF do contribuinte (formato XXX.XXX.XXX-XX), se presente (comum no DAS MEI)
- competencia: mês/ano de competência (formato MM/YYYY)
- valorPrincipal: valor principal em reais (ex: "150.00")
- codigoBarras: linha digitável ou código de barras se visível
- confidence: sua confiança de 0 a 100 na identificação

Dicas de reconhecimento:
- DAS MEI: contém "MEI", "Microempreendedor", "SIMEI" ou CPF como identificador principal
- DAS Simples Nacional: contém "PGDAS", "Simples Nacional", CNPJ como identificador

Responda APENAS com JSON válido, sem markdown.`,
        },
        {
          role: "user",
          content: [
            {
              type: "file_url",
              file_url: { url: fileUrl, detail: "high" },
            } as any,
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "document_recognition",
          strict: true,
          schema: {
            type: "object",
            properties: {
              documentType: { type: "string", description: "Tipo de documento (DAS, DAS_MEI, NFS, DCTF, etc.)" },
              cnpj: { type: "string", description: "CNPJ extraído do documento" },
              cpf: { type: "string", description: "CPF extraído do documento" },
              competencia: { type: "string", description: "Competência do documento (MM/YYYY)" },
              valorPrincipal: { type: "string", description: "Valor principal em reais" },
              codigoBarras: { type: "string", description: "Código de barras ou linha digitável" },
              confidence: { type: "integer", description: "Confiança da identificação (0-100)" },
              extractedText: { type: "string", description: "Texto relevante extraído" },
            },
            required: ["documentType", "confidence"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = typeof response.choices[0]?.message?.content === "string"
      ? response.choices[0]?.message?.content
      : JSON.stringify(response.choices[0]?.message?.content);

    if (!content) return { documentType: "UNKNOWN", confidence: 0 };

    const parsed = JSON.parse(content);
    return {
      documentType: parsed.documentType || "UNKNOWN",
      cnpj: parsed.cnpj,
      cpf: parsed.cpf,
      competencia: parsed.competencia,
      valorPrincipal: parsed.valorPrincipal,
      codigoBarras: parsed.codigoBarras,
      confidence: parsed.confidence || 0,
      extractedText: parsed.extractedText,
    };
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
