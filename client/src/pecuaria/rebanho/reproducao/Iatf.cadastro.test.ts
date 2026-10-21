import { expect, it } from "vitest";
import { etapaParaCadastro, type EtapaIatf } from "./Iatf";
it("preserva momento e inserção na edição e derivação da versão", () => {
  const etapa: EtapaIatf = { nome: "Inserção", tipo: "APLICACAO", intervalo: 0, unidade: "DIAS", momento: { nome: "D0", ordem: 1 }, subtipo: "INSERCAO_DISPOSITIVO", planoAplicacao: { produtoId: "dispositivo", dose: "1", unidadeDose: "UN" } };
  expect(etapaParaCadastro(etapa)).toEqual(etapa);
  const aplicacao: EtapaIatf = { ...etapa, nome: "Aplicação", subtipo: "APLICACAO" };
  expect([etapaParaCadastro(etapa), etapaParaCadastro(aplicacao)]).toHaveLength(2);
});
it("não inventa momento para legado e descarta subtipo de outras ações", () => {
  const etapa: EtapaIatf = { nome: "Retirada", tipo: "RETIRADA", intervalo: 7, unidade: "DIAS", subtipo: "INSERCAO_DISPOSITIVO" };
  expect(etapaParaCadastro(etapa)).toEqual({ nome: "Retirada", tipo: "RETIRADA", intervalo: 7, unidade: "DIAS" });
});
it("conserva referências monetárias explícitas ao editar ou derivar sem perder prova de zero",()=>{
  const referenciasCusto={material:{valorUnitario:"0.00",unidade:"ML",origem:"Bonificação comprovada",data:"2026-10-20"},servico:{valorUnitario:"15.00",unidade:"POR_ATENDIMENTO" as const,origem:"Cotação clínica",data:"2026-10-20"}};
  const etapa:EtapaIatf={nome:"Aplicação",tipo:"APLICACAO",intervalo:0,unidade:"DIAS",referenciasCusto};
  expect(etapaParaCadastro(etapa).referenciasCusto).toEqual(referenciasCusto);
});
