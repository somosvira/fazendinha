import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../rebanho/animais.js", () => ({ registrarPesagemTx: vi.fn(), editarPesagemTx: vi.fn() }));
vi.mock("../fatos.js", () => ({ conferirAnimalNoFato: vi.fn(async () => ({ sexo: "F" })) }));
import { registrarPesagemTx, editarPesagemTx } from "../rebanho/animais.js";
import { aplicarPesoSecagemTx, prepararVinculoPesoSecagemTx, vincularPesoSecagemTx } from "./peso-secagem.js";
const data = new Date("2026-10-20T00:00:00Z");
function fonte() {
  const lactacao = { id: "l", animalId: "a", propriedadeId: 1, inicio: new Date("2026-01-01"), encerradaEm: data, versao: 1 };
  const pesagem = { id: "p", animalId: "a", propriedadeId: 1, data, pesoKg: new Prisma.Decimal(500), tipo: "ROTINA", origem: "MANUAL", precisao: "ESTIMADO", contextoHistorico: "INTERNO", referenciaHistorica: null };
  const localizacao = { id: "loc", animalId: "a", propriedadeId: 1, desde: new Date("2025-01-01"), ate: null };
  const vinculos: Record<string, unknown>[] = [];
  const mock = {
    $executeRaw: vi.fn(), usuario: { findUnique: vi.fn(async () => ({ id: 7, status: "ATIVO" })) },
    lactacaoAnimal: { findUnique: vi.fn(async () => lactacao) },
    pesagem: { findUnique: vi.fn(async () => pesagem) },
    baixaAnimal: { findFirst: vi.fn(async () => null) },
    localizacaoAnimal: { findMany: vi.fn(async () => [localizacao]) },
    vinculoPesagemSecagem: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => vinculos.find(v => Object.entries(where).every(([k,x]) => v[k] === x)) ?? null),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => vinculos.filter(v => Object.entries(where).every(([k,x]) => v[k] === x))),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const v = { id: `v${vinculos.length}`, ...data, criadoEm: new Date("2026-10-20"), revogadoEm: null }; vinculos.push(v); return v; }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => { const v = vinculos.find(v => v.id === where.id)!; Object.assign(v,data); return v; }),
    }, auditoriaPecuaria: { create: vi.fn(async () => ({})) },
  };
  vi.mocked(registrarPesagemTx).mockImplementation(async (_tx, input) => Object.assign(pesagem, input, {data:new Date(input.data)}) as never);
  vi.mocked(editarPesagemTx).mockImplementation(async (_tx, _id, input) => Object.assign(pesagem, input, { data: new Date(input.data ?? pesagem.data) }) as never);
  return { tx: mock as unknown as Prisma.TransactionClient, mock, lactacao, pesagem, localizacao, vinculos };
}
beforeEach(() => vi.clearAllMocks());
describe("peso da secagem usa o mesmo fato e encerramento comprovado", () => {
  it("prepara sem gravar, preservando tipo, origem e precisão da pesagem existente", async () => {
    const { tx, mock } = fonte();
    const r = await prepararVinculoPesoSecagemTx(tx, { lactacaoId: "l", pesagemId: "p", propriedadeId: 1 });
    expect(r).toMatchObject({ snapshot: { pesagem: { id: "p", tipo: "ROTINA", precisao: "ESTIMADO" } }, vinculoExistente: null });
    expect(mock.vinculoPesagemSecagem.create).not.toHaveBeenCalled(); expect(mock.$executeRaw).not.toHaveBeenCalled();
  });
  it("vincula uma vez e reenvio conserva ID sem nova pesagem ou auditoria", async () => {
    const { tx, mock } = fonte(); const input = { lactacaoId: "l", pesagemId: "p", propriedadeId: 1 };
    const r = await vincularPesoSecagemTx(tx, input, 7);
    expect(await vincularPesoSecagemTx(tx, input, 7)).toEqual(r);
    expect(mock.vinculoPesagemSecagem.create).toHaveBeenCalledOnce(); expect(mock.auditoriaPecuaria.create).toHaveBeenCalledOnce();
    expect(registrarPesagemTx).not.toHaveBeenCalled();
  });
  it.each([null, 0, -1])("autor %s não grava vínculo", async usuarioId => {
    const { tx, mock } = fonte();
    await expect(vincularPesoSecagemTx(tx, { lactacaoId: "l", pesagemId: "p", propriedadeId: 1 }, usuarioId)).rejects.toThrow("usuário real");
    expect(mock.vinculoPesagemSecagem.create).not.toHaveBeenCalled();
  });
  it("lactação aberta fica sem associação, sem fabricar encerramento", async () => {
    const { tx, lactacao, mock } = fonte(); Object.assign(lactacao,{encerradaEm:null});
    await expect(prepararVinculoPesoSecagemTx(tx, { lactacaoId: "l", pesagemId: "p", propriedadeId: 1 })).rejects.toMatchObject({ campo: "encerradaEm" });
    expect(mock.vinculoPesagemSecagem.create).not.toHaveBeenCalled();
  });
  it.each(["animal", "data", "sitio", "externo", "sobreposicao"])("rejeita incompatibilidade de %s sem janela presumida", async caso => {
    const { tx, pesagem, localizacao, mock } = fonte();
    if(caso === "animal") pesagem.animalId="outro";
    if(caso === "data") pesagem.data=new Date("2026-10-19");
    if(caso === "sitio") pesagem.propriedadeId=2;
    if(caso === "externo") pesagem.contextoHistorico="EXTERNO";
    if(caso === "sobreposicao") mock.localizacaoAnimal.findMany.mockResolvedValue([localizacao, {...localizacao,id:"duplicada"}]);
    await expect(prepararVinculoPesoSecagemTx(tx, { lactacaoId: "l", pesagemId: "p", propriedadeId: 1 })).rejects.toMatchObject({ campo: "pesoSecagem" });
  });
  it("outro peso ativo exige substituição explícita", async () => {
    const { tx, vinculos } = fonte(); vinculos.push({id:"anterior",lactacaoId:"l",pesagemId:"outro",revogadoEm:null});
    await expect(vincularPesoSecagemTx(tx,{lactacaoId:"l",pesagemId:"p",propriedadeId:1},7)).rejects.toMatchObject({code:"CONFLITO"});
  });
  it("não informar peso não cria pesagem nem associação", async () => {
    const { tx, lactacao, mock } = fonte();
    await aplicarPesoSecagemTx(tx,lactacao as never,{acao:"NAO_INFORMAR"},null,1);
    expect(mock.vinculoPesagemSecagem.create).not.toHaveBeenCalled(); expect(registrarPesagemTx).not.toHaveBeenCalled();
  });
});

it("legado sem contexto/sítio próprios reutiliza a pesagem pela localização única sem reclassificar a origem", async () => {
  const { tx, pesagem } = fonte(); Object.assign(pesagem, { contextoHistorico: "NAO_INFORMADO", propriedadeId: null, precisao: "NAO_INFORMADO" });
  const r = await prepararVinculoPesoSecagemTx(tx,{lactacaoId:"l",pesagemId:"p",propriedadeId:1});
  expect(r.snapshot).toMatchObject({ pesagem: { propriedadeId: null, contextoHistorico: "NAO_INFORMADO", precisao: "NAO_INFORMADO" }, localizacao: { propriedadeId: 1 } });
  expect(pesagem.propriedadeId).toBeNull();
});
it("registro usa SECAGEM e conserva precisão declarada; correção preserva a pesagem e revoga o snapshot anterior", async () => {
  const { tx, lactacao, vinculos, mock } = fonte();
  await aplicarPesoSecagemTx(tx,lactacao as never,{acao:"REGISTRAR",data:"2026-10-20",pesoKg:500,origem:"MANUAL",precisao:"ESTIMADO"},7,1);
  expect(registrarPesagemTx).toHaveBeenCalledWith(tx,expect.objectContaining({tipo:"SECAGEM",precisao:"ESTIMADO"}),7);
  await aplicarPesoSecagemTx(tx,lactacao as never,{acao:"CORRIGIR",vinculoId:String(vinculos[0].id),data:"2026-10-20",pesoKg:510,precisao:"MEDIDO",motivo:"Conferência na balança"},7,1);
  expect(vinculos).toHaveLength(2); expect(vinculos[0].revogadoEm).toBeInstanceOf(Date);
  expect(vinculos[1]).toMatchObject({pesagemId:"p",revogadoEm:null});
  expect(mock.vinculoPesagemSecagem.update).toHaveBeenCalledOnce();
});
