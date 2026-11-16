// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { CabecalhoProtocolo } from "../protocolos/api";
import { ListaProtocolosReprodutivos, secaoProtocolo } from "./ListaProtocolosReprodutivos";
afterEach(cleanup);
function grupo(id: string, contagens: Partial<CabecalhoProtocolo["contagens"]> = {}, status = "ABERTA"): CabecalhoProtocolo {
  return { id, modo: "COLETIVO", tipo: "REPRODUTIVO", nome: id, protocolo: {id:"m1",nome:"Preparo",versao:3}, propriedadeId:1, inicioReferencia:"2026-11-20T12:00:00Z", precisaoTemporal:"DIA", status, animal:null, participantesTotal:8, contagens:{total:8,atendidos:0,pendentes:0,atrasadas:0,naoAtendidos:0,adiados:0,semRegistro:0,previstos:8,regularizacoes:0,encerradas:0,...contagens} };
}
describe("protocolos agrupados pela evidência operacional", () => {
  it("não transforma previsão passada em execução nem execução futura em programado", () => {
    expect(secaoProtocolo({...grupo("Previsto"),inicioReferencia:"2020-01-01T12:00:00Z"})).toBe("Programados");
    expect(secaoProtocolo(grupo("Em execução", {previstos:7,atendidos:1}))).toBe("Em execução");
    expect(secaoProtocolo(grupo("Resultado", {previstos:0,atendidos:8,pendenciasOperacionais:0,pendentes:8,acompanhamentosPendentes:8}))).toBe("Aguardando resultados");
    expect(secaoProtocolo(grupo("Pendência", {previstos:0,atendidos:7,pendenciasOperacionais:1,acompanhamentosPendentes:1}))).toBe("Em execução");
  });
  it("preserva histórico, estados desconhecidos, nomes e navegação contextual sem tag de situação", () => {
    const abrir=vi.fn();
    render(<ListaProtocolosReprodutivos itens={[grupo("Novilhas"),grupo("Outubro",{},"ENCERRADA"),grupo("Legado",{},"LEGADO")]} sitio={1} modo="tabela" aoAbrir={abrir}/>);
    expect(within(screen.getByRole("region",{name:"Histórico"})).getAllByRole("link",{name:"Outubro"})[0]).toBeTruthy();
    expect(within(screen.getByRole("region",{name:"A conferir"})).getAllByRole("link",{name:"Legado"})[0]).toBeTruthy();
    expect(screen.queryByRole("columnheader",{name:"Situação"})).toBeNull();
    const link=screen.getAllByRole("link",{name:"Novilhas"})[0];
    expect(link.getAttribute("href")).toContain("sitio=1");
    fireEvent.click(link);
    expect(abrir).toHaveBeenCalledWith("Novilhas");
  });
});
