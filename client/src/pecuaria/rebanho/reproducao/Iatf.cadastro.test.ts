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
it.each([[7.5, "DIAS"], [36, "HORAS"]] as const)("preserva %s %s e alerta ancorado na etapa anterior na derivação", (intervalo, unidade) => {
  const etapa: EtapaIatf = { nome: "Retirada", tipo: "RETIRADA", intervalo, unidade, momento: { nome: "Revisão", ordem: 2, instrucoesGerais: "Conferir identificação", modoAtendimento: "MANUAL" }, orientacaoTemporal: { versao: 1, referencia: "ETAPA_ANTERIOR", intervaloHoras: 36, toleranciaAntesMinutos: 45, toleranciaDepoisMinutos: 120, efeito: "ALERTA" } };
  expect(etapaParaCadastro(etapa, true)).toEqual(etapa);
});
it("novo contrato mantém IA/TE e retira material fixo somente do payload derivado", () => {
  const etapa: EtapaIatf = { nome: "IA", tipo: "TENTATIVA", intervalo: 36, unidade: "HORAS", planoTentativa: { tipo: "IA", materialId: "semen-legado", quantidade: 1 } };
  expect(etapaParaCadastro(etapa, true)).toEqual({ nome: "IA", tipo: "TENTATIVA", intervalo: 36, unidade: "HORAS", tentativaTipo: "IA" });
  expect(etapaParaCadastro(etapa).planoTentativa).toEqual(etapa.planoTentativa);
  expect(etapa.planoTentativa?.materialId).toBe("semen-legado");
});
it("conserva TE sem material fixo no ida e volta do contrato novo", () => {
  const etapa: EtapaIatf = { nome: "Transferência", tipo: "TENTATIVA", tentativaTipo: "TE", intervalo: 36, unidade: "HORAS" };
  expect(etapaParaCadastro(etapa)).toEqual(etapa);
  expect(etapaParaCadastro(etapa, true)).toEqual(etapa);
});
