import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
type Linha = Record<string, unknown>;
type Estado = { lactacao: Linha; pesagens: Linha[]; vinculos: Linha[]; auditorias: Linha[]; requisicoes: Linha[] };
const m = vi.hoisted(() => ({ tx: {} as Prisma.TransactionClient, estado: {} as Estado, falharAssociacao: false, alterarDuranteTrava: false, rollback: 0 }));
vi.mock("../../../db.js", () => ({ prisma: { $transaction: async (fn: (tx: Prisma.TransactionClient) => unknown) => {
  const antes = structuredClone(m.estado);
  try { return await fn(m.tx); } catch (e) { m.estado = antes; m.rollback++; throw e; }
} } }));
vi.mock("../fatos.js", () => ({ conferirAnimalNoFato: vi.fn(async () => ({ sexo: "F" })) }));
vi.mock("../leite/guardas.js", () => ({ conferirLactacaoComProducaoTx: vi.fn() }));
vi.mock("../rebanho/animais.js", () => ({
  registrarPesagemTx: vi.fn(async (_tx: unknown, input: Linha) => { const p = { id: `p${m.estado.pesagens.length}`, ...input, data: new Date(String(input.data)), propriedadeId: 1, contextoHistorico: "INTERNO", referenciaHistorica: null }; m.estado.pesagens.push(p); return p; }),
  editarPesagemTx: vi.fn(async (_tx: unknown, id: string, input: Linha) => { const p = m.estado.pesagens.find(p => p.id === id)!; Object.assign(p,input,{data:new Date(String(input.data))}); return p; }),
}));
import { encerrarLactacao, corrigirLactacao } from "./registros.js";
import { manterPesoSecagem } from "./peso-secagem.js";
const data = new Date("2026-10-20T00:00:00Z");
const registro = { acao: "REGISTRAR" as const, data: "2026-10-20", pesoKg: 500, origem: "MANUAL" as const, precisao: "ESTIMADO" as const };
function montar() {
  m.estado = { lactacao: { id: "l", animalId: "a", propriedadeId: 1, inicio: new Date("2026-01-01"), encerradaEm: null, versao: 1 }, pesagens: [], vinculos: [], auditorias: [], requisicoes: [] };
  const filtrar = (lista: Linha[], where: Linha) => lista.filter(v => Object.entries(where).every(([k,x]) => v[k] === x));
  const lerLactacao = () => ({ ...m.estado.lactacao, vinculosPesagemSecagem: m.estado.vinculos.map(v => ({ ...v, pesagem: m.estado.pesagens.find(p => p.id === v.pesagemId) })) });
  const mock = {
    $executeRaw: vi.fn(async () => { if(m.alterarDuranteTrava) { m.alterarDuranteTrava=false; m.estado.lactacao.encerradaEm=data; m.estado.lactacao.versao=2; } }),
    usuario: { findUnique: vi.fn(async () => ({ id: 7, status: "ATIVO" })) },
    lactacaoAnimal: {
      findFirst: vi.fn(async ({where}:{where:Linha}) => Object.entries(where).every(([k,v]) => m.estado.lactacao[k] === v) ? {...m.estado.lactacao}:null),
      findUnique: vi.fn(async () => ({...m.estado.lactacao})), findUniqueOrThrow: vi.fn(async () => lerLactacao()),
      findMany: vi.fn(async () => []),
      update: vi.fn(async ({data:campos}:{data:Linha}) => { const {versao,...resto}=campos; Object.assign(m.estado.lactacao,resto); if(versao) m.estado.lactacao.versao=Number(m.estado.lactacao.versao)+1; return {...m.estado.lactacao}; }),
    },
    pesagem: { findUnique: vi.fn(async ({where}:{where:{id:string}}) => m.estado.pesagens.find(p=>p.id===where.id) ?? null) },
    baixaAnimal: { findFirst: vi.fn(async()=>null) },
    localizacaoAnimal: { findMany: vi.fn(async()=>[{id:"local",animalId:"a",propriedadeId:1,desde:new Date("2025-01-01"),ate:null}]) },
    vinculoPesagemSecagem: {
      findFirst: vi.fn(async ({where}:{where:Linha}) => filtrar(m.estado.vinculos,where)[0] ?? null),
      findMany: vi.fn(async ({where}:{where:Linha}) => filtrar(m.estado.vinculos,where).map(v=>({...v,pesagem:m.estado.pesagens.find(p=>p.id===v.pesagemId)}))),
      create: vi.fn(async ({data:campos}:{data:Linha}) => { if(m.falharAssociacao) throw new Error("Falha controlada na associação"); const v={id:`v${m.estado.vinculos.length}`,...campos,criadoEm:new Date("2026-10-20"),revogadoEm:null};m.estado.vinculos.push(v);return {...v}; }),
      update: vi.fn(async ({where, data:campos}:{where:{id:string};data:Linha}) => {const v=m.estado.vinculos.find(v=>v.id===where.id)!;const retorno={...v,...campos};Object.assign(v,campos);return retorno;}),
    },
    auditoriaPecuaria: { create: vi.fn(async ({data:campos}:{data:Linha})=>{m.estado.auditorias.push(structuredClone(campos));return campos;}) },
    requisicaoPecuaria: { findUnique: vi.fn(async ({where}:{where:{chave:string}})=>m.estado.requisicoes.find(r=>r.chave===where.chave)??null),create: vi.fn(async ({data:campos}:{data:Linha})=>{m.estado.requisicoes.push(structuredClone(campos));return campos;}) },
  };
  m.tx=mock as unknown as Prisma.TransactionClient;
  return mock;
}
beforeEach(()=>{vi.clearAllMocks();m.falharAssociacao=false;m.alterarDuranteTrava=false;m.rollback=0;montar();});
describe("encerramento e manutenção atômicos e idempotentes",()=>{
  it("encerra sem peso e conserva a opção do contrato anterior",async()=>{
    await encerrarLactacao("l",1,"2026-10-20","Secagem manual observada",null);
    expect(m.estado.lactacao.encerradaEm).toEqual(data);expect(m.estado.pesagens).toHaveLength(0);expect(m.estado.vinculos).toHaveLength(0);
  });
  it("encerra com uma pesagem e um vínculo; reenvio mantém todos IDs sem nova auditoria",async()=>{
    const opcoes={chave:"req1",pesoSecagem:registro};
    const r=await encerrarLactacao("l",1,"2026-10-20","Secagem manual observada",7,opcoes);
    const auditorias=m.estado.auditorias.length;
    const repetido=await encerrarLactacao("l",1,"2026-10-20","Secagem manual observada",7,opcoes);
    expect(repetido.id).toBe(r.id);expect(m.estado.pesagens).toHaveLength(1);expect(m.estado.vinculos).toHaveLength(1);expect(m.estado.auditorias).toHaveLength(auditorias);
  });
  it("falha da associação reverte encerramento, peso e auditorias no executor transacional",async()=>{
    m.falharAssociacao=true;
    await expect(encerrarLactacao("l",1,"2026-10-20","Secagem manual observada",7,{chave:"req1",pesoSecagem:registro})).rejects.toThrow("Falha controlada");
    expect(m.rollback).toBe(1);expect(m.estado.lactacao).toMatchObject({encerradaEm:null,versao:1});expect(m.estado.pesagens).toHaveLength(0);expect(m.estado.vinculos).toHaveLength(0);expect(m.estado.auditorias).toHaveLength(0);expect(m.estado.requisicoes).toHaveLength(0);
  });
  it("null não encerra com peso nem altera manutenção NAO_INFORMAR",async()=>{
    await expect(encerrarLactacao("l",1,"2026-10-20","Secagem manual observada",null,{chave:"req1",pesoSecagem:registro})).rejects.toThrow("usuário real");
    await expect(manterPesoSecagem("l",{chave:"req2",propriedadeId:1,motivo:"Sem nova pesagem",pesoSecagem:{acao:"NAO_INFORMAR"}},null)).rejects.toThrow("usuário real");
    expect(m.estado.lactacao.versao).toBe(1);expect(m.estado.requisicoes).toHaveLength(0);
  });
  it("relê estado sob trava e não sobrescreve encerramento concorrente",async()=>{
    const mock=montar();m.alterarDuranteTrava=true;
    await expect(encerrarLactacao("l",1,"2026-10-20","Outra secagem observada",7,{chave:"req1"})).rejects.toThrow("já encerrada");
    expect(mock.lactacaoAnimal.update).not.toHaveBeenCalled();
  });
  it("mudança de data exige revisão do peso; correção conjunta conserva ID e registra novo snapshot",async()=>{
    await encerrarLactacao("l",1,"2026-10-20","Secagem manual observada",7,{chave:"req1",pesoSecagem:registro});
    await expect(corrigirLactacao("l",{chave:"req2",propriedadeId:1,encerradaEm:"2026-10-21",motivo:"Corrigir data comprovada"},7)).rejects.toThrow("exige corrigir");
    await corrigirLactacao("l",{chave:"req3",propriedadeId:1,encerradaEm:"2026-10-21",motivo:"Corrigir data comprovada",pesoSecagem:{acao:"CORRIGIR",vinculoId:"v0",data:"2026-10-21",pesoKg:510,motivo:"Data conferida no registro"}},7);
    expect(m.estado.pesagens).toHaveLength(1);expect(m.estado.pesagens[0]).toMatchObject({id:"p0",data:new Date("2026-10-21")});expect(m.estado.vinculos).toHaveLength(2);expect(m.estado.vinculos[0].revogadoEm).toBeInstanceOf(Date);
  });
  it("reabre revogando associação com motivo e mantém peso/histórico; reenvio não repete revisão",async()=>{
    await encerrarLactacao("l",1,"2026-10-20","Secagem manual observada",7,{chave:"req1",pesoSecagem:registro});
    const input={chave:"req2",propriedadeId:1,encerradaEm:null,motivo:"Reabertura confirmada na ficha"};
    await corrigirLactacao("l",input,7);const auditorias=m.estado.auditorias.length;
    await corrigirLactacao("l",input,7);
    expect(m.estado.lactacao.encerradaEm).toBeNull();expect(m.estado.vinculos[0]).toMatchObject({motivoRevogacao:input.motivo,revogadoPorId:7});expect(m.estado.pesagens).toHaveLength(1);expect(m.estado.auditorias).toHaveLength(auditorias);
  });
});
it("associação posterior e substituição reutilizam pesagens sem duplicar e conservam os dois vínculos",async()=>{
  await encerrarLactacao("l",1,"2026-10-20","Secagem manual observada",null);
  m.estado.pesagens.push({id:"existente",animalId:"a",data,pesoKg:490,tipo:"ROTINA",origem:"MANUAL",precisao:"NAO_INFORMADO",contextoHistorico:"NAO_INFORMADO",propriedadeId:null});
  const r=await manterPesoSecagem("l",{chave:"manter1",propriedadeId:1,motivo:"Peso já registrado conferido",pesoSecagem:{acao:"VINCULAR",pesagemId:"existente"}},7);
  expect(r.vinculosPesagemSecagem[0].pesagem).toMatchObject({id:"existente",precisao:"NAO_INFORMADO",pesoKg:490});
  m.estado.pesagens.push({id:"substituta",animalId:"a",data,pesoKg:495,tipo:"ENTRADA",origem:"BALANCA",precisao:"MEDIDO",contextoHistorico:"INTERNO",propriedadeId:1});
  await manterPesoSecagem("l",{chave:"manter2",propriedadeId:1,motivo:"Substituir pela aferição comprovada",pesoSecagem:{acao:"SUBSTITUIR",vinculoId:"v0",pesagem:{acao:"VINCULAR",pesagemId:"substituta"}}},7);
  expect(m.estado.pesagens).toHaveLength(2);expect(m.estado.vinculos).toHaveLength(2);expect(m.estado.vinculos[0].revogadoEm).toBeInstanceOf(Date);
  await manterPesoSecagem("l",{chave:"manter3",propriedadeId:1,motivo:"Associação desfeita após conferência",pesoSecagem:{acao:"DESVINCULAR",vinculoId:"v1"}},7);
  expect(m.estado.vinculos.every(v=>v.revogadoEm instanceof Date)).toBe(true);expect(m.estado.pesagens).toHaveLength(2);
});
it("versão obsoleta e autor inativo bloqueiam manutenção antes de gravar",async()=>{
  const mock=montar();
  await encerrarLactacao("l",1,"2026-10-20","Secagem manual observada",7,{chave:"req1",pesoSecagem:registro});
  const input={chave:"manter1",propriedadeId:1,motivo:"Revisar peso na secagem",pesoSecagem:{acao:"DESVINCULAR" as const,vinculoId:"v0"}};
  await expect(manterPesoSecagem("l",{...input,versaoEsperada:1},7)).rejects.toMatchObject({code:"CONFLITO",campo:"versaoEsperada"});
  mock.usuario.findUnique.mockResolvedValue({id:7,status:"INATIVO"});
  await expect(manterPesoSecagem("l",input,7)).rejects.toThrow("usuário real");
  expect(m.estado.vinculos[0].revogadoEm).toBeNull();expect(m.estado.lactacao.versao).toBe(2);
});

it("reenvio de reabertura também revalida o autor real, sem reativar peso revogado",async()=>{
  const mock=montar();
  await encerrarLactacao("l",1,"2026-10-20","Secagem manual observada",7,{chave:"req1",pesoSecagem:registro});
  const input={chave:"req2",propriedadeId:1,encerradaEm:null,motivo:"Reabertura conferida na ficha"};
  await corrigirLactacao("l",input,7);const auditorias=m.estado.auditorias.length;
  mock.usuario.findUnique.mockResolvedValue({id:7,status:"INATIVO"});
  await expect(corrigirLactacao("l",input,7)).rejects.toThrow("usuário real");
  expect(m.estado.auditorias).toHaveLength(auditorias);expect(m.estado.vinculos[0].revogadoEm).toBeInstanceOf(Date);expect(m.estado.pesagens).toHaveLength(1);
});
