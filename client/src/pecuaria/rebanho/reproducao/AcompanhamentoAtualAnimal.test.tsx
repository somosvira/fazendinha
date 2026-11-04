// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AcompanhamentoAtualAnimal, resultadoAcompanhamento, separarAcompanhamento } from "./AcompanhamentoAtualAnimal";
import type { FatoHistorico } from "./HistoricoReprodutivo";
import { navegarPara } from "../../../router";
vi.mock("../../../router", () => ({ navegarPara: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const fato = (id: string, data: string, grupo: string, extras: Partial<FatoHistorico> = {}): FatoHistorico => ({ id, animalId:"a", data, grupo, ...extras });
it("mantém DG negativo, protocolo seguinte e nova IA no mesmo acompanhamento", () => {
 const fatos = [fato("antigo","2025-01-01","Tentativa"), fato("parto","2026-01-01","Parto"), fato("ia1","2026-03-01","Tentativa"), fato("dg","2026-04-01","Avaliação",{resultado:"NEGATIVO"}), fato("protocolo","2026-04-10","Protocolo"), fato("ia2","2026-04-20","Tentativa")];
 const dividido=separarAcompanhamento(fatos,{data:"2026-01-01"});
 expect(dividido.atuais.map(f=>f.id)).toEqual(["parto","ia1","dg","protocolo","ia2"]);
 expect(dividido.anteriores.map(f=>f.id)).toEqual(["antigo"]);
});
it("não inventa início quando falta referência e conserva resultado do exame", () => {
 const dg=fato("dg","2026-04-01","Avaliação",{exame:{id:"ex",finalidades:[],finalidadePrincipal:"DIAGNOSTICO_GESTACAO",realizacao:"2026-04-01",responsavel:null,formatoSnapshot:{},resultados:[{campo:"CONCLUSAO_GESTACIONAL",valor:"POSITIVO",unidade:null}]}});
 expect(separarAcompanhamento([dg],null).anteriores).toEqual([]);
 expect(resultadoAcompanhamento(dg)).toBe("Positivo");
 expect(resultadoAcompanhamento({...dg,status:"ANULADO"})).toBe("Anulado");
});
it("abre o parto exato e o protocolo na origem comprovada", () => {
 render(<AcompanhamentoAtualAnimal fatos={[fato("parto-1","2026-01-01","Parto",{propriedadeId:7}),fato("p","2026-02-01","Protocolo",{urlDetalhe:"/pecuaria/reproducao/participacoes/p?sitio=7"})]} onAbrir={vi.fn()}/>);
 fireEvent.click(screen.getByRole("button",{name:"Ver parto"}));
 expect(navegarPara).toHaveBeenCalledWith(expect.stringMatching(/^\/pecuaria\/reproducao\/partos\/parto-1\?retorno=.*&sitio=7$/));
 fireEvent.click(screen.getByRole("button",{name:"Ver protocolo"}));
 expect(navegarPara).toHaveBeenLastCalledWith("/pecuaria/reproducao/participacoes/p?sitio=7");
});

it.each(["PARTO", "ABORTO"] as const)("não inclui tentativa do dia de %s no novo ciclo", tipo => {
 const fatos=[fato("parto","2026-01-01","Parto"),fato("antes","2026-01-01","Tentativa"),fato("depois","2026-01-02","Tentativa")];
 const separado=separarAcompanhamento(fatos,{tipo,data:"2026-01-01"});
 expect(separado.atuais.map(f=>f.id)).toEqual(["parto","depois"]);
 expect(separado.anteriores.map(f=>f.id)).toEqual(["antes"]);
});
it("inclui tentativa na data inicial e não reinicia acompanhamento por perda isolada", () => {
 const fatos=[fato("ia","2026-01-01","Tentativa"),fato("perda","2026-02-01","Gestação",{tipo:"PERDA"}),fato("ia2","2026-03-01","Tentativa")];
 expect(separarAcompanhamento(fatos,{tipo:"SITUACAO_INICIAL",data:"2026-01-01"}).atuais.map(f=>f.id)).toEqual(["ia","perda","ia2"]);
});

it("desempata fatos do mesmo dia por marco, protocolo, tentativa e resultado, sem alterar datas", () => {
 const fatos = [fato("a-ia","2026-11-04","Tentativa"), fato("z-inicio","2026-11-04T00:00:00.000Z","Situação inicial"), fato("b-dg","2026-11-04","Avaliação"), fato("c-gestacao","2026-11-04","Gestação"), fato("y-protocolo","2026-11-04","Protocolo"), fato("antes","2026-11-03","Avaliação")];
 const datas = fatos.map(f=>f.data);
 expect(separarAcompanhamento(fatos).atuais.map(f=>f.id)).toEqual(["antes","z-inicio","y-protocolo","a-ia","b-dg","c-gestacao"]);
 expect(fatos.map(f=>f.data)).toEqual(datas);
});
it("posiciona parto de origem antes dos demais registros do dia", () => {
 const fatos = [fato("a-dg","2026-11-04","Avaliação"),fato("b-protocolo","2026-11-04","Protocolo"),fato("z-parto","2026-11-04","Parto")];
 expect(separarAcompanhamento(fatos,{tipo:"PARTO",data:"2026-11-04"}).atuais.map(f=>f.id)).toEqual(["z-parto","b-protocolo","a-dg"]);
});

it("mantém IA, DG e gestação encerrada juntos nos antecedentes quando o parto ocorre no mesmo dia", () => {
 const data="2026-11-04";
 const fatos=[fato("inicial",data,"Situação inicial"),fato("ia",data,"Tentativa"),fato("dg",data,"Avaliação",{gestacaoId:"g"}),{...fato("g",data,"Gestação",{chaveHistorico:"confirmacao:g"}),tentativaId:"ia",encerradaEm:data,tipoEncerramento:"PARTO"},{...fato("g",data,"Gestação",{chaveHistorico:"encerramento:g"}),tentativaId:"ia",encerradaEm:data,tipoEncerramento:"PARTO"},fato("parto",data,"Parto",{gestacaoId:"g"}),fato("avulsa",data,"Avaliação"),fato("nova","2026-11-05","Tentativa")];
 const separado=separarAcompanhamento(fatos,{tipo:"PARTO",data});
 expect(separado.atuais.map(f=>f.id)).toEqual(["parto","avulsa","nova"]);
 expect(separado.anteriores.map(f=>f.id)).toEqual(["inicial","ia","dg","g","g"]);
});
