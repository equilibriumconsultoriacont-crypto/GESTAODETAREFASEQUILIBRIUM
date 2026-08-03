import QRCode from "qrcode";

// Gera o "copia e cola" do PIX (padrão EMV BR Code do Banco Central) e a imagem do QR.

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

// CRC16-CCITT (polinômio 0x1021, inicial 0xFFFF) — exigido no fim do BR Code.
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function sanitize(s: string, max: number): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase()
    .trim()
    .slice(0, max) || "NA";
}

// Remove máscara da chave se for CPF/CNPJ/telefone (deixa só dígitos); e-mail/aleatória mantém.
export function normalizePixKey(key: string, type?: string): string {
  const k = (key || "").trim();
  if (type === "email" || type === "aleatoria") return k;
  const digits = k.replace(/\D/g, "");
  if (type === "telefone") return digits.startsWith("55") ? "+" + digits : "+55" + digits;
  return digits || k; // cpf/cnpj
}

export function buildPixBRCode(opts: { key: string; keyType?: string; name: string; city: string; amount?: string | null; txid?: string }): string {
  const key = normalizePixKey(opts.key, opts.keyType);
  const mai = tlv("26", tlv("00", "br.gov.bcb.pix") + tlv("01", key));
  let payload = tlv("00", "01") + mai + tlv("52", "0000") + tlv("53", "986");
  const amt = opts.amount ? Number(String(opts.amount).replace(",", ".")) : 0;
  if (amt > 0) payload += tlv("54", amt.toFixed(2));
  payload += tlv("58", "BR") + tlv("59", sanitize(opts.name || "Recebedor", 25)) + tlv("60", sanitize(opts.city || "SAO PAULO", 15));
  const txid = (opts.txid || "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  payload += tlv("62", tlv("05", txid));
  payload += "6304";
  return payload + crc16(payload);
}

export async function pixQrPngBuffer(brcode: string): Promise<Buffer> {
  return QRCode.toBuffer(brcode, { errorCorrectionLevel: "M", margin: 1, width: 320, type: "png" });
}

export async function pixQrDataUrl(brcode: string): Promise<string> {
  return QRCode.toDataURL(brcode, { errorCorrectionLevel: "M", margin: 1, width: 320 });
}
