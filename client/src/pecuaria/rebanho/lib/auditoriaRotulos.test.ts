import { expect, it } from "vitest";
import { resumoAuditoriaLegivel } from "./auditoriaRotulos";

it("traduz o resumo técnico sem alterar o evento de origem", () => {
  expect(resumoAuditoriaLegivel({ entidade: "ExecucaoProtocoloSanitario", acao: "INCLUSAO_RODADA", resumo: "ExecucaoProtocoloSanitario — INCLUSAO_RODADA" })).toBe("Participação em protocolo — inclusão no ciclo");
});
it("preserva descrições específicas e eventos ainda sem tradução", () => {
  expect(resumoAuditoriaLegivel({ entidade: "Animal", acao: "REGISTRO", resumo: "Cadastro do animal" })).toBe("Cadastro do animal");
  expect(resumoAuditoriaLegivel({ entidade: "Outro", acao: "NOVA_ACAO", resumo: "Outro — NOVA_ACAO" })).toBe("Outro — NOVA_ACAO");
});
