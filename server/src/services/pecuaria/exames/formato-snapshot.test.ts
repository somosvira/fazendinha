import { expect, it } from "vitest";
import { hashFormatoExame } from "./formato-snapshot.js";
it("assinatura do formato independe da ordem das chaves e detecta mudança da unidade ou de versão", () => {
  const tipo = { id: "tipo", tipoResultado: "MULTIPLO", versaoFormato: 1, unidade: null, opcoes: null, campos: [{ codigo: "MEDIDA", tipo: "NUMERO", unidade: "mm" }] };
  expect(hashFormatoExame(tipo)).toBe(hashFormatoExame({ ...tipo, campos: [{ unidade: "mm", tipo: "NUMERO", codigo: "MEDIDA" }] }));
  expect(hashFormatoExame(tipo)).not.toBe(hashFormatoExame({ ...tipo, campos: [{ codigo: "MEDIDA", tipo: "NUMERO", unidade: "cm" }] }));
  expect(hashFormatoExame(tipo)).not.toBe(hashFormatoExame({ ...tipo, versaoFormato: 2 }));
});
