import { describe, it, expect, beforeAll } from "vitest";

// Testa o helper de criptografia de campos (LGPD): round-trip, retrocompatibilidade
// (texto legado em claro deve passar intacto) e segurança com null/vazio.
describe("crypto field encryption", () => {
  let enc: typeof import("./crypto");
  beforeAll(async () => {
    process.env.DATA_ENC_KEY = "chave-de-teste-vitest-1234567890";
    enc = await import("./crypto"); // import dinâmico DEPOIS de setar a env (a chave é memoizada)
  });

  it("cifra e decifra (round-trip)", () => {
    const plain = "Observação sensível do cliente — CPF e telefone particular";
    const c = enc.encField(plain);
    expect(c).not.toBe(plain);
    expect(c!.startsWith("enc:1:")).toBe(true);
    expect(enc.decField(c)).toBe(plain);
  });

  it("texto legado em claro passa intacto pelo decField", () => {
    expect(enc.decField("texto antigo sem cifra")).toBe("texto antigo sem cifra");
  });

  it("cifrar duas vezes não duplica (idempotente no prefixo)", () => {
    const c = enc.encField("abc");
    expect(enc.encField(c)).toBe(c);
  });

  it("null, undefined e vazio não quebram", () => {
    expect(enc.encField(null)).toBe(null);
    expect(enc.encField(undefined)).toBe(undefined);
    expect(enc.encField("")).toBe("");
    expect(enc.decField(null)).toBe(null);
    expect(enc.decField(undefined)).toBe(undefined);
  });
});
