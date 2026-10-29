import { expect, it } from "vitest";
import { identificarDestinoImportacao, validarDestinoImportacao } from "./destino.js";
const hash = "a".repeat(64);
const local = { databaseUrl: "postgresql://usuario:segredo@localhost:54332/fazendinha_seedatev3", namespace: "dev", bancoConfirmado: "fazendinha_seedatev3", manifestoConfirmado: hash };
const stg = { databaseUrl: "postgresql://usuario:segredo@ep-stg.example.neon.tech/neondb?sslmode=require", namespace: "staging", ambienteConfirmado: "staging", destinoConfirmado: "ep-stg.example.neon.tech/neondb", manifestoConfirmado: hash };
it("identifica destino sem expor usuário/senha/parâmetros da conexão", () => {
  expect(identificarDestinoImportacao(local.databaseUrl, local.namespace)).toEqual({ ambiente: "dev", host: "localhost:54332", banco: "fazendinha_seedatev3" });
});
it("local aceita somente a base autorizada e exige confirmação do manifesto", () => {
  expect(validarDestinoImportacao(local).banco).toBe("fazendinha_seedatev3");
  for (const alteracao of [{ databaseUrl: local.databaseUrl.replace("fazendinha_seedatev3", "outra") }, { bancoConfirmado: "outra" }, { manifestoConfirmado: "" }]) expect(() => validarDestinoImportacao({ ...local, ...alteracao })).toThrow();
});
it("STG remoto exige namespace, ambiente e endereço conferidos explicitamente", () => {
  expect(validarDestinoImportacao(stg).ambiente).toBe("staging");
  for (const alteracao of [{ namespace: "prod" }, { namespace: "dev" }, { ambienteConfirmado: undefined }, { destinoConfirmado: "outro/neondb" }, { databaseUrl: stg.databaseUrl.replace("sslmode=require", "sslmode=disable") }]) expect(() => validarDestinoImportacao({ ...stg, ...alteracao })).toThrow();
});
it("produção é recusada também com confirmação idêntica do destino", () => {
  expect(() => validarDestinoImportacao({ ...stg, namespace: "prod" })).toThrow(/produção/i);
  expect(() => validarDestinoImportacao({ ...local, namespace: "prod" })).toThrow(/produção/i);
});
