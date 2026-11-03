import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  tx: { $executeRaw: vi.fn(), propriedade: { findUnique: vi.fn() },
    formatoQualidadeLeite: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), findUniqueOrThrow: vi.fn() },
    amostraQualidadeLeite: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    resultadoQualidadeLeite: { updateMany: vi.fn(), createMany: vi.fn() },
    exameAnimal: { update: vi.fn() }, entradaProducaoLeite: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    requisicaoPecuaria: { findUnique: vi.fn(), create: vi.fn() }, auditoriaPecuaria: { findMany: vi.fn(), count: vi.fn() },
  }, registrarExame: vi.fn(), corrigirExame: vi.fn(), editarTipo: vi.fn(), criarTipo: vi.fn(), travarTipo: vi.fn(), auditar: vi.fn(), travarAnimal: vi.fn(),
}));
vi.mock("../../../db.js", () => ({ prisma: { ...m.tx, $transaction: async (f: (tx: typeof m.tx) => unknown) => f(m.tx) } }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: async (f: (tx: typeof m.tx) => unknown) => f(m.tx) }));
vi.mock("../sanidade/exames.js", () => ({ registrarExameTx: m.registrarExame, corrigirExameTx: m.corrigirExame, criarTipoExameTx: m.criarTipo, editarTipoExame: m.editarTipo, travarTiposExame: m.travarTipo }));
vi.mock("../sanidade/detalhes.js", () => ({ ocultarCustosDetalhe: (v: unknown) => v }));
vi.mock("../rebanho/regras.js", async original => ({ ...await original<typeof import("../rebanho/regras.js")>(), auditar: m.auditar, travarAnimais: m.travarAnimal, hojeFazendaDate: () => new Date("2026-10-19") }));
import { hashFormatoExame } from "../exames/formato-snapshot.js";
import { registrarQualidade, corrigirQualidade, listarAmostrasQualidade, listarOrigensQualidade, criarFormatoQualidade, consultarParametrosQualidade, historicoQualidade } from "./qualidade.js";
const uid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const campos = [{ codigo: "DADO", tipo: "NUMERO" as const, unidade: "unidade do laudo", obrigatorio: true }, { codigo: "PRESENTE", tipo: "BOOLEANO" as const, obrigatorio: false }];
const tipo = { id: uid(1), nome: "Formato informado", tipoResultado: "MULTIPLO", campos, versaoFormato: 1, versaoAnteriorId: null, opcoes: null, unidade: null, contexto: "SANITARIO", ativo: true };
const agora = new Date("2026-10-19T15:00:00Z");
const input = () => ({ chave: uid(2), propriedadeId: 1, data: "2026-10-19", tipoExameId: tipo.id, formatoExameHash: hashFormatoExame(tipo), sujeito: { tipo: "COLETIVO" as const, origem: "Identificação transcrita do laudo" }, resultados: [{ campo: "DADO", valor: 0 }, { campo: "PRESENTE", valor: false }] });
function amostra() { return { id: uid(3), propriedadeId: 1, data: new Date("2026-10-19"), sujeito: "COLETIVO", tipoExameId: tipo.id,
  dataResultadoLaboratorial: null, dataRecebimentoLaudo: null, exameAnimalId: null, exameAnimal: null, origemColetiva: "Identificação transcrita do laudo", entradaId: null,
  formatoSnapshot: { nome: tipo.nome, tipoResultado: "MULTIPLO", versao: 1, campos }, formato: { tipoExame: tipo },
  resultados: [{ id: uid(4), campo: "DADO", valor: "0", unidade: "unidade do laudo", criadoEm: agora, criadoPorId: 7 }],
  realizacao: "REALIZADO", status: "VALIDO", versao: 1, responsavel: null, anotacaoOriginal: null, motivoAnulacao: null, anuladoEm: null, criadoEm: agora, atualizadoEm: agora, criadoPorId: 7, laudos: [] };
}
beforeEach(() => {
  vi.resetAllMocks();
  m.tx.propriedade.findUnique.mockResolvedValue({ id: 1, ativo: true });
  m.tx.formatoQualidadeLeite.findFirst.mockResolvedValue({ tipoExame: tipo });
  m.tx.amostraQualidadeLeite.create.mockResolvedValue(amostra());
  m.tx.amostraQualidadeLeite.findFirst.mockResolvedValue(amostra());
});
describe("amostras de qualidade com sujeito e formato explícitos", () => {
  it("coletivo preserva zero/falso e não chama executor nem trava de animal", async () => {
    const r = await registrarQualidade(input(), 7);
    expect(r).toMatchObject({ sujeito: { tipo: "COLETIVO", origem: "Identificação transcrita do laudo" }, animal: null, resultados: [{ valor: "0", unidade: "unidade do laudo" }] });
    expect(m.registrarExame).not.toHaveBeenCalled(); expect(m.travarAnimal).not.toHaveBeenCalled();
    expect(m.tx.amostraQualidadeLeite.create).toHaveBeenCalledWith({ data: expect.objectContaining({ exameAnimalId: null, formatoSnapshot: { nome: tipo.nome, tipoResultado: "MULTIPLO", versao: 1, campos }, resultados: { create: [{ campo: "DADO", valor: "0", unidade: "unidade do laudo", criadoPorId: 7 }, { campo: "PRESENTE", valor: false, unidade: null, criadoPorId: 7 }] } }) });
  });
  it("individual delega ao núcleo comum e não duplica resultados coletivos", async () => {
    m.registrarExame.mockResolvedValue({ id: uid(5) });
    await registrarQualidade({ ...input(), sujeito: { tipo: "ANIMAL", animalId: uid(6) } }, 7);
    expect(m.registrarExame).toHaveBeenCalledWith(m.tx, expect.objectContaining({ animalId: uid(6), propriedadeId: 1, resultados: input().resultados }), 7, true);
    expect(m.tx.amostraQualidadeLeite.create).toHaveBeenCalledWith({ data: expect.objectContaining({ exameAnimalId: uid(5), formatoSnapshot: expect.anything() }) });
    expect(m.tx.amostraQualidadeLeite.create.mock.calls[0][0].data.resultados).toBeUndefined();
  });
  it("coleta pendente aceita lista vazia e não transforma ausência em resultado zero", async () => {
    await registrarQualidade({ ...input(), resultados: [] }, 7);
    expect(m.tx.amostraQualidadeLeite.create.mock.calls[0][0].data).toMatchObject({ realizacao: "COLETA_REGISTRADA", resultados: { create: [] } });
  });
  it("hash alterado e formato inativo bloqueiam gravação antes do resultado", async () => {
    await expect(registrarQualidade({ ...input(), formatoExameHash: "b".repeat(64) }, 7)).rejects.toMatchObject({ code: "CONFLITO" });
    m.tx.formatoQualidadeLeite.findFirst.mockResolvedValue(null);
    await expect(registrarQualidade(input(), 7)).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(m.tx.amostraQualidadeLeite.create).not.toHaveBeenCalled();
  });
  it("coletivo futuro e sítio indisponível são recusados antes de gravar", async () => {
    await expect(registrarQualidade({ ...input(), data: "2026-10-20" }, 7)).rejects.toMatchObject({ code: "VALIDACAO", campo: "data" });
    m.tx.propriedade.findUnique.mockResolvedValue({ id: 1, ativo: false });
    await expect(registrarQualidade(input(), 7)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(m.tx.amostraQualidadeLeite.create).not.toHaveBeenCalled();
  });
  it("valida entrada coletiva por sítio, confirmação e data, sem exigir saldo", async () => {
    const p = { ...input(), sujeito: { tipo: "COLETIVO" as const, origem: "Laudo", entradaId: uid(7) } };
    m.tx.entradaProducaoLeite.findFirst.mockResolvedValue(null);
    await expect(registrarQualidade(p, 7)).rejects.toMatchObject({ campo: "entradaId" });
    expect(m.tx.entradaProducaoLeite.findFirst).toHaveBeenCalledWith({ where: { id: uid(7), status: "CONFIRMADA", sessao: { dia: { propriedadeId: 1, dataOperacional: { lte: new Date("2026-10-19") } } } }, select: { id: true } });
    m.tx.entradaProducaoLeite.findFirst.mockResolvedValue({ id: uid(7) });
    await registrarQualidade(p, 7);
    expect(m.tx.amostraQualidadeLeite.create).toHaveBeenCalled();
  });
  it("reenvio relê a amostra sem criar outro exame/resultado", async () => {
    m.tx.requisicaoPecuaria.findUnique.mockResolvedValue({ hashPayload: (await import("../reproducao/operacoes.js")).hashDados(input()), usuarioId: 7, propriedadeId: 1, operacao: "QUALIDADE_LEITE_REGISTRAR", resultadoIds: { id: uid(3) } });
    expect((await registrarQualidade(input(), 7)).id).toBe(uid(3));
    expect(m.tx.amostraQualidadeLeite.create).not.toHaveBeenCalled();
    expect(m.registrarExame).not.toHaveBeenCalled();
  });
});
describe("correção e consultas da qualidade", () => {
  const corrigir = () => ({ chave: uid(8), propriedadeId: 1, versaoEsperada: 1, motivo: "Revisão do laudo", resultados: [{ campo: "DADO", valor: 2 }], anular: false });
  it("correção usa formato da coleta, encerra resultados e registra autoria sem apagar", async () => {
    await corrigirQualidade(uid(3), corrigir(), 9);
    expect(m.tx.resultadoQualidadeLeite.updateMany).toHaveBeenCalledWith({ where: { amostraId: uid(3), vigente: true }, data: { vigente: false, substituidoEm: expect.any(Date) } });
    expect(m.tx.resultadoQualidadeLeite.createMany).toHaveBeenCalledWith({ data: [{ amostraId: uid(3), campo: "DADO", valor: "2", unidade: "unidade do laudo", criadoPorId: 9 }] });
    expect(m.auditar).toHaveBeenCalledWith(m.tx, expect.objectContaining({ antes: expect.objectContaining({ resultados: [{ id: uid(4), campo: "DADO", valor: "0", unidade: "unidade do laudo", criadoEm: agora.toISOString(), criadoPorId: 7 }] }), depois: expect.objectContaining({ motivo: "Revisão do laudo" }) }));
  });
  it("versão antiga recusa sobrescrever e anulação não elimina resultados", async () => {
    await expect(corrigirQualidade(uid(3), { ...corrigir(), versaoEsperada: 2 }, 7)).rejects.toMatchObject({ code: "CONFLITO" });
    await corrigirQualidade(uid(3), { ...corrigir(), resultados: undefined, anular: true }, 7);
    expect(m.tx.resultadoQualidadeLeite.updateMany).not.toHaveBeenCalled();
    expect(m.tx.amostraQualidadeLeite.update).toHaveBeenCalledWith({ where: { id: uid(3) }, data: { versao: { increment: 1 }, status: "ANULADO", motivoAnulacao: "Revisão do laudo", anuladoEm: expect.any(Date) } });
  });
  it("individual corrige apenas pelo núcleo, com identidade interna da amostra", async () => {
    m.tx.amostraQualidadeLeite.findFirst.mockResolvedValue({ ...amostra(), sujeito: "ANIMAL", exameAnimalId: uid(5) });
    await corrigirQualidade(uid(3), corrigir(), 9);
    expect(m.corrigirExame).toHaveBeenCalledWith(m.tx, uid(5), 1, expect.objectContaining({ motivo: "Revisão do laudo" }), 9, uid(3));
    expect(m.tx.resultadoQualidadeLeite.createMany).not.toHaveBeenCalled();
  });
  it("lista vazia conserva sítio resolvido e filtra por data/animal antes da paginação", async () => {
    m.tx.amostraQualidadeLeite.findMany.mockResolvedValue([]); m.tx.amostraQualidadeLeite.count.mockResolvedValue(0);
    expect(await listarAmostrasQualidade(3, { animalId: uid(6), inicio: "2026-10-01", pagina: 2, tamanho: 10 })).toEqual({ propriedadeId: 3, itens: [], total: 0, pagina: 2, tamanho: 10 });
    expect(m.tx.amostraQualidadeLeite.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { propriedadeId: 3, exameAnimal: { animalId: uid(6) }, data: { gte: new Date("2026-10-01") } }, skip: 10, take: 10 }));
  });
  it("seletor inclui entradas consumidas sem deduzir saldo ou tanque", async () => {
    m.tx.entradaProducaoLeite.findMany.mockResolvedValue([]); m.tx.entradaProducaoLeite.count.mockResolvedValue(0);
    expect(await listarOrigensQualidade(3, { data: "2026-10-19", busca: "manhã", pagina: 2 })).toMatchObject({ total: 0, pagina: 2, tamanho: 20 });
    const consulta = m.tx.entradaProducaoLeite.findMany.mock.calls[0][0];
    expect(consulta.where).toMatchObject({ status: "CONFIRMADA", sessao: { dia: { propriedadeId: 3, dataOperacional: { lte: new Date("2026-10-19") } } } });
    expect(JSON.stringify(consulta)).not.toMatch(/saldo|alocacoes/);
  });
  it("formato global reusa chave somente com os mesmos campos, versão e autor", async () => {
    m.tx.formatoQualidadeLeite.findUnique.mockResolvedValue({ chave: uid(1), criadoPorId: 7, hashPayload: "outro" });
    await expect(criarFormatoQualidade({ chave: uid(1), nome: "Formato", campos }, 7)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(m.criarTipo).not.toHaveBeenCalled();
  });
});

describe("histórico por parâmetro", () => {
  const filtro = { campo: "DADO", inicio: "2026-10-01", fim: "2026-10-31", pagina: 2, tamanho: 2 };
  it("pagina pelo período da amostra, só resultados vigentes válidos, e não transforma registro em data laboratorial", async () => {
    m.tx.amostraQualidadeLeite.findMany.mockResolvedValue([amostra()]);
    m.tx.amostraQualidadeLeite.count.mockResolvedValue(3);
    const r = await consultarParametrosQualidade(1, filtro);
    expect(r).toMatchObject({ total: 3, pagina: 2, itens: [{ dataAmostra: "2026-10-19", registradoEm: agora.toISOString(), dataResultadoLaboratorial: null, valor: "0", unidade: "unidade do laudo" }] });
    expect(m.tx.amostraQualidadeLeite.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 2, take: 2, where: expect.objectContaining({ propriedadeId: 1, status: "VALIDO", data: { gte: new Date("2026-10-01"), lte: new Date("2026-10-31") }, OR: [
      { exameAnimalId: null, resultados: { some: { campo: "DADO", vigente: true } } },
      { exameAnimal: { status: "VALIDO", resultados: { some: { campo: "DADO", vigente: true } } } },
    ] }) }));
    expect(m.tx.amostraQualidadeLeite.create).not.toHaveBeenCalled();
  });
  it("separa séries por origem, unidade e formato snapshot sem reinterpretar o passado", async () => {
    const a = amostra();
    const b = { ...amostra(), id: uid(9), origemColetiva: "Tanque B" };
    const c = { ...amostra(), id: uid(10), formatoSnapshot: { ...a.formatoSnapshot, versao: 2 }, resultados: [{ ...a.resultados[0], unidade: null }] };
    m.tx.amostraQualidadeLeite.findMany.mockResolvedValue([a, { ...a, id: uid(11) }, b, c]);
    m.tx.amostraQualidadeLeite.count.mockResolvedValue(4);
    const r = await consultarParametrosQualidade(1, { ...filtro, pagina: 1, tamanho: 20 });
    expect(r.itens[0].serie).toBe(r.itens[1].serie);
    expect(new Set(r.itens.map(i => i.serie)).size).toBe(3);
    expect(r.itens[0].formato.versao).toBe(1);
    expect(r.itens[3].unidade).toBeNull();
  });
});


describe("datas da qualidade sem duplicar resultados", () => {
  const datas = { dataResultadoLaboratorial: "2026-10-15", dataRecebimentoLaudo: "2026-10-16" };
  const correcao = { chave: uid(20), propriedadeId: 1, versaoEsperada: 1, motivo: "Datas conferidas no laudo", anular: false };
  it.each(["COLETIVO", "ANIMAL"] as const)("cria %s com coleta, resultado, recebimento e cadastro distintos", async sujeito => {
    const a = { ...amostra(), data: new Date("2026-10-10"), dataResultadoLaboratorial: new Date(datas.dataResultadoLaboratorial), dataRecebimentoLaudo: new Date(datas.dataRecebimentoLaudo), criadoEm: new Date("2026-10-23T15:00:00Z") };
    m.tx.amostraQualidadeLeite.findFirst.mockResolvedValue(a);
    m.registrarExame.mockResolvedValue({ id: uid(5) });
    const r = await registrarQualidade({ ...input(), data: "2026-10-10", ...datas, sujeito: sujeito === "ANIMAL" ? { tipo: "ANIMAL", animalId: uid(6) } : input().sujeito }, 7);
    expect(r).toMatchObject({ data: "2026-10-10", ...datas, criadoEm: "2026-10-23T15:00:00.000Z" });
    expect(m.tx.amostraQualidadeLeite.create.mock.calls[0][0].data).toMatchObject({ dataResultadoLaboratorial: new Date("2026-10-15"), dataRecebimentoLaudo: new Date("2026-10-16") });
    if (sujeito === "ANIMAL") {
      expect(m.registrarExame.mock.calls[0][1]).not.toHaveProperty("dataResultadoLaboratorial");
      expect(m.registrarExame.mock.calls[0][1]).not.toHaveProperty("dataRecebimentoLaudo");
      expect(m.tx.exameAnimal.update.mock.calls[0][0].data).not.toHaveProperty("dataResultadoLaboratorial");
    }
  });
  it.each(["COLETIVO", "ANIMAL"] as const)("corrige apenas datas de %s e preserva resultados, realização e data omitida", async sujeito => {
    const exame = sujeito === "ANIMAL" ? { animalId: uid(6), animal: { id: uid(6), brinco: "123", nome: "Aurora" }, formatoSnapshot: amostra().formatoSnapshot, resultados: [], realizacao: "COLETA_REGISTRADA", status: "VALIDO", motivoAnulacao: null } : null;
    const antes = { ...amostra(), dataResultadoLaboratorial: new Date("2026-10-15"), sujeito, exameAnimalId: sujeito === "ANIMAL" ? uid(5) : null, exameAnimal: exame, resultados: [], realizacao: "COLETA_REGISTRADA" };
    const depois = { ...antes, versao: 2, dataRecebimentoLaudo: new Date("2026-10-16") };
    m.tx.amostraQualidadeLeite.findFirst.mockResolvedValueOnce(antes).mockResolvedValue(depois);
    const r = await corrigirQualidade(uid(3), { ...correcao, dataRecebimentoLaudo: datas.dataRecebimentoLaudo }, 9);
    expect(r).toMatchObject({ ...datas, versao: 2, resultados: [], realizacao: "COLETA_REGISTRADA" });
    expect(m.tx.amostraQualidadeLeite.update).toHaveBeenCalledWith({ where: { id: uid(3) }, data: { versao: { increment: 1 }, dataRecebimentoLaudo: new Date("2026-10-16") } });
    expect(m.corrigirExame).not.toHaveBeenCalled();
    expect(m.tx.resultadoQualidadeLeite.updateMany).not.toHaveBeenCalled();
    expect(m.tx.resultadoQualidadeLeite.createMany).not.toHaveBeenCalled();
    expect(m.auditar).toHaveBeenCalledWith(m.tx, expect.objectContaining({ acao: "DATAS_CORRIGIDAS", usuarioId: 9, antes: expect.objectContaining({ dataRecebimentoLaudo: null, versao: 1 }), depois: expect.objectContaining({ ...datas, versao: 2, motivo: correcao.motivo }) }));
  });
  it("versão antiga também bloqueia correção exclusiva de datas antes de qualquer gravação", async () => {
    await expect(corrigirQualidade(uid(3), { ...correcao, versaoEsperada: 2, dataRecebimentoLaudo: "2026-10-16" }, 9)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(m.tx.amostraQualidadeLeite.update).not.toHaveBeenCalled();
    expect(m.auditar).not.toHaveBeenCalled();
  });
  it("limpeza explícita não limpa o outro campo e mantém os resultados vigentes", async () => {
    await corrigirQualidade(uid(3), { ...correcao, dataResultadoLaboratorial: null }, 9);
    expect(m.tx.amostraQualidadeLeite.update).toHaveBeenCalledWith({ where: { id: uid(3) }, data: { versao: { increment: 1 }, dataResultadoLaboratorial: null } });
    expect(m.tx.resultadoQualidadeLeite.updateMany).not.toHaveBeenCalled();
    expect(m.corrigirExame).not.toHaveBeenCalled();
  });
  it("consulta de parâmetro transporta datas sem mudar filtro pela coleta ou registro do resultado", async () => {
    m.tx.amostraQualidadeLeite.findMany.mockResolvedValue([{ ...amostra(), dataResultadoLaboratorial: new Date("2026-10-15"), dataRecebimentoLaudo: new Date("2026-10-16") }]);
    m.tx.amostraQualidadeLeite.count.mockResolvedValue(1);
    expect(await consultarParametrosQualidade(1, { campo: "DADO", inicio: "2026-10-01", fim: "2026-10-31", pagina: 1, tamanho: 20 })).toMatchObject({ itens: [{ ...datas, registradoEm: agora.toISOString(), dataAmostra: "2026-10-19" }] });
  });
  it("histórico devolve evidência preservada, sem completar datas antigas", async () => {
    m.tx.auditoriaPecuaria.findMany.mockResolvedValue([{ id: uid(30), em: agora, acao: "DATAS_CORRIGIDAS", usuarioId: 9, usuario: { id: 9, nome: "Operador" }, antes: { data: "2026-10-10" }, depois: { ...datas, motivo: correcao.motivo } }]);
    m.tx.auditoriaPecuaria.count.mockResolvedValue(1);
    expect(await historicoQualidade(uid(3), 1)).toMatchObject({ itens: [{ antes: { data: "2026-10-10" }, depois: datas, motivo: correcao.motivo }] });
  });
});

 it("entrega série completa do recorte sem confundir com a página de resultados", async () => {
 m.tx.amostraQualidadeLeite.findMany.mockResolvedValue([amostra()]);m.tx.amostraQualidadeLeite.count.mockResolvedValue(1);
 const r=await consultarParametrosQualidade(1,{campo:"DADO",inicio:"2026-10-01",fim:"2026-10-31",pagina:1,tamanho:20,incluirSerie:true});
 expect(r).toMatchObject({serieCompleta:true,serieItens:[{tipo:"NUMERO",valor:"0"}]});
 expect(m.tx.amostraQualidadeLeite.findMany).toHaveBeenCalledWith(expect.objectContaining({take:2000,skip:0}));
 });
 it("não apresenta série truncada como evolução completa", async () => {
 m.tx.amostraQualidadeLeite.findMany.mockResolvedValue([amostra()]);m.tx.amostraQualidadeLeite.count.mockResolvedValue(2001);
 const r=await consultarParametrosQualidade(1,{campo:"DADO",inicio:"2026-10-01",fim:"2026-10-31",pagina:1,tamanho:20,incluirSerie:true});
 expect(r).toMatchObject({serieCompleta:false,serieItens:[]});
 });
