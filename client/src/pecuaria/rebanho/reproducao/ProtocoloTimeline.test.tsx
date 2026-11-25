// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { ParticipanteIatf, TarefaIatf } from "./Iatf";
import { estadoEtapa, ProtocoloTimeline } from "./ProtocoloTimeline";
afterEach(cleanup);
const tarefa: TarefaIatf = { id:"t",tipo:"TENTATIVA",nome:"IA planejada",previstaEm:"2020-01-02",precisaoTemporal:"DIA",status:"PENDENTE",etapa:0 };
const participante: ParticipanteIatf = { id:"p",animalId:"a",inicioPrevisto:"2020-01-01",inicioEfetivo:"2020-01-01",precisaoInicioEfetivo:"DIA",tarefas:[tarefa] };
it("mostra atraso somente quando calendário e início efetivo são conhecidos", () => {
 expect(estadoEtapa(tarefa,participante)).toBe("Atrasada");
 expect(estadoEtapa({...tarefa,previsaoPendente:true},participante)).toBe("Previsão a definir");
 expect(estadoEtapa(tarefa,{...participante,inicioEfetivo:null})).toBe("Aguardando início");
 expect(estadoEtapa({...tarefa,realizadaEm:"2020-01-02",regularizacaoPendente:true},participante)).toBe("Regularização pendente");
 expect(estadoEtapa({...tarefa,realizadaEm:"2020-01-02"},participante)).toBe("Concluída");
});
it("preserva início e datas de cada participação sem data agregada", () => {
 const { rerender } = render(<ProtocoloTimeline participante={participante}/>);
 expect(screen.getByText("01/01/2020")).toBeTruthy();
 expect(screen.getByText("Atrasada")).toBeTruthy();
 rerender(<ProtocoloTimeline participante={{...participante,inicioEfetivo:"2020-03-01",tarefas:[{...tarefa,previstaEm:"2020-03-02",realizadaEm:"2020-03-03",precisaoRealizacao:"DIA"}]}}/>);
 expect(screen.queryByText("01/01/2020")).toBeNull();
 expect(screen.getByText("01/03/2020")).toBeTruthy();
 expect(screen.getByText("03/03/2020")).toBeTruthy();
});
it("distingue os eventos reprodutivos pendentes de horário de referência desconhecido", () => {
 const pendente = {...tarefa, previsaoPendente:true, planejadoSnapshot:{ etapa:{ nome:"DG", tipo:"AVALIACAO" as const, intervalo:0, unidade:"DIAS" as const, referenciaPrazoDiagnostico:true }, previstaEm:"2020-01-02", previsaoOriginal:"2020-01-02", inicioReferencia:"2020-01-01" }};
 const {rerender} = render(<ProtocoloTimeline participante={{...participante,tarefas:[pendente]}}/>);
 expect(screen.getByText("Aguardando tentativa")).toBeTruthy();
 const reconfirmacao = {...pendente, planejadoSnapshot:{...pendente.planejadoSnapshot, etapa:{ ...pendente.planejadoSnapshot.etapa, nome:"Reconfirmação", referenciaPrazoDiagnostico:undefined, referenciaPrazoReconfirmacao:true }}};
 rerender(<ProtocoloTimeline participante={{...participante,tarefas:[reconfirmacao]}}/>);
 expect(screen.getByText("Aguardando primeiro DG positivo")).toBeTruthy();
 rerender(<ProtocoloTimeline participante={{...participante,tarefas:[{...pendente,planejadoSnapshot:null}]}}/>);
 expect(screen.getByText("Horário de referência desconhecido")).toBeTruthy();
});
