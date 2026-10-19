// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { ParticipanteIatf, ProgramacaoIatf, TarefaIatf } from "./Iatf";
import { estadoEtapa, ProtocoloTimeline } from "./ProtocoloTimeline";
import { ProtocolosAnimal } from "./ProtocolosAnimal";
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
 expect(screen.getByText("01/01/2020 · horário não informado")).toBeTruthy();
 expect(screen.getByText("Atrasada")).toBeTruthy();
 rerender(<ProtocoloTimeline participante={{...participante,inicioEfetivo:"2020-03-01",tarefas:[{...tarefa,previstaEm:"2020-03-02",realizadaEm:"2020-03-03",precisaoRealizacao:"DIA"}]}}/>);
 expect(screen.queryByText("01/01/2020 · horário não informado")).toBeNull();
 expect(screen.getByText("01/03/2020 · horário não informado")).toBeTruthy();
 expect(screen.getByText("03/03/2020 · horário não informado")).toBeTruthy();
});
it("cartão só mostra participação do animal e mantém link operacional e versão", () => {
 const g: ProgramacaoIatf = {id:"g",nome:"Turma A",protocoloId:"v2",inicioPrevisto:"2020-01-01",status:"ABERTA",protocolo:{id:"v2",nome:"Protocolo 10 dias",versao:2,publicado:true,etapas:[]},participantes:[participante,{...participante,id:"p2",animalId:"b",inicioEfetivo:"1990-01-01"}]};
 render(<ProtocolosAnimal programacoes={[g]} animalId="a" propriedadeId={4}/>);
 expect(screen.getByText("Protocolo 10 dias · v2")).toBeTruthy();
 const url=new URL(screen.getByRole("link",{name:"Ver programação"}).getAttribute("href")!,"http://localhost"); expect(url.pathname).toBe("/pecuaria/reproducao/programacoes/g"); expect(url.searchParams.get("sitio")).toBe("4"); expect(url.searchParams.get("retorno")).toBe(window.location.pathname+window.location.search+window.location.hash);
 expect(screen.queryByText(/1990/)).toBeNull();
 expect(screen.getByText(/IA planejada · 02\/01\/2020/)).toBeTruthy();
});
