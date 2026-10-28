// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PainelIndicadores } from "./PainelIndicadores";
import type { SnapshotIndicadoresReprodutivos } from "./indicadores-api";
afterEach(cleanup);
function snapshot(): SnapshotIndicadoresReprodutivos {
  const contagens = {
    vaziasAptasInicio: 0,
    negativasAnteriores: 0,
    anterioresSemDiagnostico: 2,
    estimativaVaziasAnteriores: null,
    saidasPev: 0,
    contribuicaoPev: 0,
    elegiveisConhecidas: 3.5,
    elegiveis: null,
    matrizesServidas: 4,
    tentativas: 8,
    positivas: 2,
    negativas: 2,
    abertas: 4,
    naoClassificaveis: 0,
    denominadorConcepcao: 4,
    animaisComPendenciaElegibilidade: 2,
  };
  const taxas = { servico: null, concepcao: 50, prenhez: null };
  return {
    versao: 1,
    versaoMetodologia: "v1",
    metodologia: {
      rotulo: "Método preservado",
      fontes: [],
      regras: ["Regra original"],
      deslocamentoTeDias: 7,
      concepcaoEstimada: null,
    },
    filtros: {
      propriedadeId: 9,
      inicio: "2026-01-01",
      fim: "2026-05-06",
      corte: "2026-10-17",
      deslocamentoTeDias: 7,
    },
    sobraInicial: null,
    periodos: Array.from({ length: 6 }, (_, i) => ({
      id: `p${i}`,
      inicio: `2026-${String(i + 1).padStart(2, "0")}-01`,
      fim: `2026-${String(i + 1).padStart(2, "0")}-21`,
      contagens,
      taxas,
      pendencias: ["ELEGIBILIDADE_PENDENTE"],
      maturidade: { corte: "2026-10-17", diasAposFim: 5, tentativasAbertas: 4 },
      detalhamento: [],
    })),
    totais: {
      contagens,
      taxas,
      animaisUnicos: 8,
      participacoesAnimalPeriodo: 20,
    },
    pendencias: ["ELEGIBILIDADE_PENDENTE"],
  };
}
it("conserva zero e mostra cobertura parcial com acesso contextualizado", () => {
  const s=snapshot();s.totais.taxas={servico:50,concepcao:0,prenhez:0};s.totais.contagens.positivas=0;
  s.totais.baseCalculo={animaisValidos:8,animaisPendentes:2,participacoesValidas:20,participacoesPendentes:2,parcial:true};
  render(<PainelIndicadores snapshot={s}/>);
  expect(screen.getAllByText("0%").length).toBeGreaterThan(0);
  expect(screen.getByText("0 positivas / 4 tentativas com resultado")).toBeTruthy();
  expect(screen.getByText("Resultado parcial · 2 animais com pendências")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Revisar pendências"}));
  expect(screen.getByRole("dialog",{name:/Pendências fora da base/})).toBeTruthy();
  expect(screen.queryByRole("tab",{name:"Pendências"})).toBeNull();
});
it("pagina períodos e abre os animais da janela com datas completas",()=>{
 const s=snapshot();s.periodos=[...s.periodos,...s.periodos.map(p=>({...p,id:`outro-${p.id}`}))];
 render(<PainelIndicadores snapshot={s}/>);
 expect(screen.getByText("1–10 de 12 períodos")).toBeTruthy();
 fireEvent.click(within(screen.getByRole("navigation",{name:"Paginação de períodos"})).getByRole("button",{name:"Próxima"}));
 expect(screen.getByText("11–12 de 12 períodos")).toBeTruthy();
 fireEvent.click(screen.getAllByRole("button",{name:"Ver animais"})[0]);
 expect(screen.getByRole("dialog",{name:"Animais da base válida"})).toBeTruthy();
 expect(screen.getAllByText(/01\/02\/2026.*21\/02\/2026/).length).toBeGreaterThan(0);
});
it("mostra ambos os anos quando a janela cruza dezembro",()=>{
 const s=snapshot();s.periodos[0].inicio="2025-12-20";s.periodos[0].fim="2026-01-09";
 render(<PainelIndicadores snapshot={s}/>);
 expect(screen.getAllByText("20/12/2025 – 09/01/2026").length).toBeGreaterThan(0);
});
it("orienta ampliar intervalos menores que 21 dias sem inventar taxa zero",()=>{
 const s=snapshot();s.periodos=[];s.totais.taxas={servico:null,concepcao:null,prenhez:null};
 render(<PainelIndicadores snapshot={s}/>);
 expect(screen.getByText(/Nenhum período completo de 21 dias/)).toBeTruthy();
 expect(screen.getAllByText("Sem base suficiente").length).toBeGreaterThan(0);
});
it('alterna cartões e tabela mantendo janela, taxas e consulta dos animais',()=>{
 history.replaceState(null,'','/pecuaria/reproducao?rotina=indicadores&inicio=2026-01-01');localStorage.clear();
 const s=snapshot();s.periodos[0].taxas={servico:0,concepcao:null,prenhez:null};render(<PainelIndicadores snapshot={s}/>);
 expect(screen.getByRole('group',{name:'Visualização do desempenho'})).toBeTruthy();
 expect(screen.queryByRole('table',{name:'Indicadores na base válida'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Tabela'}));
 expect(screen.getByRole('table',{name:'Indicadores na base válida'})).toBeTruthy();
 expect(new URLSearchParams(location.search).get('inicio')).toBe('2026-01-01');
 fireEvent.click(screen.getAllByRole('button',{name:'Ver animais'})[0]);expect(screen.getByRole('dialog',{name:'Animais da base válida'})).toBeTruthy();
});
