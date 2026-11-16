import { describe, expect, it } from "vitest";
import { proporPrazoDaParticipacao, proporReconfirmacoesDaParticipacao } from "./prazos-protocolo.js";
const regra=(intervalo:number)=>({finalidade:"DIAGNOSTICO",ocorrencia:1,publico:"TE",referencia:"TE",intervalo,unidade:"DIAS",antecedencia:2,tolerancia:1,resolucao:"DIAGNOSTICO_CONCLUSIVO"});
const configuracao=(intervalo:number)=>({versao:2,efeito:"ALERTA",regras:[regra(intervalo)]});
const snapshot={versao:1,protocoloId:"modelo",protocoloVersao:1,diagnosticoIndividualEm:null,modelo:configuracao(20),sitio:{id:"politica",versao:3,parametros:configuracao(30)}};
const fato={tentativaId:"tentativa",tipoTentativa:"TE",data:"2026-01-01"};
describe("precedência dos prazos adotados",()=>{
 it("prioriza data individual e congela origem e identidade",()=>expect(proporPrazoDaParticipacao({...snapshot,diagnosticoIndividualEm:"2026-01-15"},fato,"participacao")[0]).toMatchObject({previstaPara:"2026-01-15",origemAdocao:"INDIVIDUAL",politicaId:null,regraSnapshot:{origem:"INDIVIDUAL",protocoloId:"modelo",participacaoId:"participacao"}}));
 it("usa modelo antes do sítio e mantém parâmetros congelados",()=>expect(proporPrazoDaParticipacao(snapshot,fato,"participacao")[0]).toMatchObject({previstaPara:"2026-01-21",origemAdocao:"MODELO",regraSnapshot:{origem:"MODELO",regra:{intervalo:20,referencia:"TE"}}}));
 it("usa somente o sítio adotado se falta regra no modelo",()=>expect(proporPrazoDaParticipacao({...snapshot,modelo:null},fato,"participacao")[0]).toMatchObject({previstaPara:"2026-01-31",origemAdocao:"FATO_NOVO",politicaId:"politica"}));
 it("não substitui data individual anterior ao fato nem inventa prazo",()=>{expect(proporPrazoDaParticipacao({...snapshot,diagnosticoIndividualEm:"2025-12-31"},fato,"participacao")[0]).toMatchObject({previstaPara:null,origemAdocao:"SEM_REGRA",regraSnapshot:{motivo:"AGENDAMENTO_ANTERIOR_A_TENTATIVA"}});expect(proporPrazoDaParticipacao({...snapshot,modelo:null,sitio:null},fato,"participacao")[0]).toMatchObject({previstaPara:null,origemAdocao:"SEM_REGRA",regraSnapshot:{motivo:"REGRA_NAO_CONFIGURADA"}});});
});

it("mescla reconfirmações pelo número de ocorrência e conserva a referência ao primeiro DG positivo",()=>{
 const rec=(ocorrencia:number,intervalo:number)=>({finalidade:"RECONFIRMACAO",ocorrencia,publico:"GESTACAO",referencia:"PRIMEIRO_DG_POSITIVO",intervalo,unidade:"DIAS",antecedencia:0,tolerancia:0,resolucao:"RECONFIRMACAO_CONCLUSIVA"});
 const modelo={versao:2,efeito:"ALERTA",regras:[rec(1,20)]};
 const sitio={id:"politica",versao:3,parametros:{versao:2,efeito:"ALERTA",regras:[rec(1,30),rec(2,60)]}};
 expect(proporReconfirmacoesDaParticipacao({...snapshot,modelo,sitio},{gestacaoId:"g",data:"2026-01-01"},"participacao")).toMatchObject([{ocorrencia:1,previstaPara:"2026-01-21",origemAdocao:"MODELO"},{ocorrencia:2,previstaPara:"2026-03-02",origemAdocao:"FATO_NOVO"}]);
});
