// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HistoricoReprodutivo } from "./HistoricoReprodutivo";
afterEach(()=>{cleanup();window.history.replaceState({},"","/");});
it("retorna do parto com tipos, período, tamanho e página da consulta",()=>{
 const retorno="/pecuaria/rebanho/animais/a?historicoTipos=Parto&historicoInicio=2020-01-01&historicoFim=2020-12-31&historicoTamanho=5&historicoPagina=2#reproducao";
 window.history.replaceState({},"",retorno);
 const fatos=Array.from({length:12},(_,i)=>({id:`p${i}`,animalId:"a",propriedadeId:7,data:`2020-01-${String(i+1).padStart(2,"0")}`,grupo:"Parto",tipo:"DISTOCICO"}));
 const montar=()=>render(<HistoricoReprodutivo fatos={fatos} animalId="a" onAbrir={vi.fn()}/>);
 const tela=montar();
 expect(screen.getByText("6–10 de 12 registros")).toBeTruthy();
 fireEvent.click(screen.getAllByRole("button",{name:"Ver detalhes"})[0]);
 const url=new URL(window.location.href);
 expect(url.pathname).toBe("/pecuaria/reproducao/partos/p5");
 const restaurado=new URL(url.searchParams.get("retorno")!,"http://localhost");const original=new URL(retorno,"http://localhost");expect(restaurado.pathname).toBe(original.pathname);expect(restaurado.hash).toBe(original.hash);expect([...restaurado.searchParams].sort()).toEqual([...original.searchParams].sort());
 tela.unmount();window.history.replaceState({},"",url.searchParams.get("retorno")!);montar();
 expect(screen.getByText("6–10 de 12 registros")).toBeTruthy();
 expect((screen.getByLabelText("Registros por página") as HTMLSelectElement).value).toBe("5");
 expect(screen.queryByText("PARTO_DISTOCICO")).toBeNull();
});
it("data inválida na URL bloqueia os resultados sem quebrar o seletor",()=>{
 window.history.replaceState({},"","/pecuaria/rebanho/animais/a?historicoInicio=2026-02-30#reproducao");
 render(<HistoricoReprodutivo fatos={[]} animalId="a" onAbrir={vi.fn()}/>);
 expect(screen.getByRole("alert")).toBeTruthy();
 expect(screen.getByText("Nenhum evento registrado neste período e tipo.")).toBeTruthy();
});

it("limita a dez mesmo ao restaurar URL antiga com cinquenta registros por página", () => {
 window.history.replaceState({},"","/pecuaria/rebanho/animais/a?historicoTamanho=50#reproducao");
 const fatos=Array.from({length:21},(_,i)=>({id:`p${i}`,animalId:"a",propriedadeId:7,data:"2020-01-01",grupo:"Parto",tipo:"DISTOCICO"}));
 render(<HistoricoReprodutivo fatos={fatos} onAbrir={()=>{}} />);
 expect((screen.getByLabelText("Registros por página") as HTMLSelectElement).value).toBe("10");
 expect(within(screen.getByRole("table",{name:"Histórico reprodutivo"})).getAllByRole("button",{name:"Ver detalhes"})).toHaveLength(10);
 expect(within(screen.getByRole("list",{name:"Histórico reprodutivo"})).getAllByRole("listitem")).toHaveLength(10);
 expect(screen.queryByRole("option",{name:"50",exact:true})).toBeNull();
});
