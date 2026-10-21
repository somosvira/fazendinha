import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uid } from "../../../lib/uid.fixture.js";

const contexto = vi.hoisted(() => ({ tx: undefined as unknown }));
vi.mock("../../../db.js", () => ({ prisma: { $transaction: (executar: (tx: unknown) => Promise<unknown>) => executar(contexto.tx) } }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: (executar: (tx: unknown) => Promise<unknown>) => executar(contexto.tx) }));
vi.mock("../reproducao/operacoes.js", () => ({ operacaoIdempotenteTx: (_tx: unknown, _input: unknown, _autor: unknown, _operacao: unknown, executar: () => Promise<unknown>) => executar() }));
vi.mock("../rebanho/regras.js", async original => ({ ...await original<typeof import("../rebanho/regras.js")>(), auditar: vi.fn(), travarAnimais: vi.fn() }));
vi.mock("../../financeiro/regras.js", async original => ({ ...await original<typeof import("../../financeiro/regras.js")>(), exigirPeriodoAberto: vi.fn() }));
import { classificarCusto, consultarCustosTx, vincularPreparo } from "./custos.js";
import { consultaCustosSchema } from "./custos.schemas.js";

const D = (valor: string) => new Prisma.Decimal(valor);
const ids = { animal: uid(1), tentativa: uid(2), preparo: uid(3), protocolo: uid(4), movimento: uid(5), servico: uid(6), compartilhado: uid(7), vinculo: uid(8) };
const classificacao = () => ({ id: uid(9), versao: 1, finalidade: "REPRODUCAO", materialNaoAplicavel: false, servicoNaoAplicavel: true,
  coberturaServico: "PROCEDIMENTO", valorMaterialDocumentado: null as Prisma.Decimal | null, documentoMaterial: null as unknown });
function criarTx() {
  const tentativas = [{ id: ids.tentativa, animalId: ids.animal, propriedadeId: 1, data: new Date("2026-01-10"), tipo: "IA", ciclo: 1, ordem: 1,
    status: "VALIDO", consumoMantido: false, origemMaterial: "ESTOQUE", movimentoEstoqueId: ids.movimento, operacaoServicoId: ids.servico,
    valorProdutoAtribuido: D("50.00"), valorServicoAtribuido: D("20.00"), classificacaoCusto: null,
    tarefa: { execucaoId: ids.protocolo }, vinculosProtocolo: [] }];
  const aplicacoes = [{ id: ids.preparo, animalId: ids.animal, propriedadeId: 1, data: new Date("2026-01-05"), nomeProdutoAplicado: "Preparatório",
    status: "VALIDO", consumoMantido: false, origemInsumo: "ESTOQUE", movimentoEstoqueId: uid(10), operacaoServicoId: null,
    valorProdutoAtribuido: D("30.00") as Prisma.Decimal | null, valorServicoAtribuido: null,
    classificacaoCusto: classificacao(), tarefa: { execucaoId: ids.protocolo } as { execucaoId: string } | null, vinculosProtocolo: [] }];
  const vinculos = [{ id: ids.vinculo, tentativaId: ids.tentativa, aplicacaoId: ids.preparo, exameId: null, participacaoId: null,
    modo: "INTEGRAL", valorMaterial: null as Prisma.Decimal | null, valorServico: null as Prisma.Decimal | null, encerradoEm: null }];
  type Condicao = { id?: { in?: string[] }; OR?: Array<{ tarefa?: { execucaoId: { in: string[] } } }>; AND?: Condicao[] };
  const selecionar = <T extends { id: string; tarefa: { execucaoId: string } | null }>(fontes: T[], query: { where?: Condicao }) => {
    const grupo = [query.where, ...query.where?.AND ?? []].flatMap(c => c?.OR ?? []).find(c => c.tarefa)?.tarefa?.execucaoId.in;
    return fontes.filter(f => (!query.where?.id?.in || query.where.id.in.includes(f.id)) && (!grupo || f.tarefa && grupo.includes(f.tarefa.execucaoId)));
  };
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(0),
    animal: { findFirst: vi.fn().mockResolvedValue({ id: ids.animal }) },
    tentativaReprodutiva: { findFirst: vi.fn().mockResolvedValue({ id: ids.tentativa }), findMany: vi.fn().mockImplementation(async q => selecionar(tentativas,q)) },
    aplicacaoProduto: { findMany: vi.fn().mockImplementation(async q => selecionar(aplicacoes,q)) },
    manejoAnimal: {findMany:vi.fn().mockResolvedValue([])},
    exameAnimal: { findMany: vi.fn().mockResolvedValue([]) },
    participacaoProtocolo: { findFirst: vi.fn().mockResolvedValue({ id: ids.protocolo }), findMany: vi.fn().mockResolvedValue([]) },
    programacaoProtocolo: { findFirst: vi.fn().mockResolvedValue({ id: uid(11) }) },
    fechamentoConsumo: { findMany: vi.fn().mockResolvedValue([]) },
    vinculoPreparoTentativa: { findMany: vi.fn().mockImplementation(async q => vinculos.filter(v => !q.where?.tentativaId || typeof q.where.tentativaId === "string" ? !q.where?.tentativaId || v.tentativaId === q.where.tentativaId : q.where.tentativaId.in.includes(v.tentativaId))), create: vi.fn(), update: vi.fn() },
    classificacaoCustoPecuaria: { findFirst: vi.fn().mockResolvedValue(aplicacoes[0].classificacaoCusto), create: vi.fn(),
      update: vi.fn().mockImplementation(async ({data: valor}) => ({ id: uid(9), ...valor })) },
  };
  contexto.tx = tx;
  return { tx, tentativas, aplicacoes, vinculos };
}
const banco = (tx: ReturnType<typeof criarTx>["tx"]) => tx as unknown as Prisma.TransactionClient;
const consulta = (filtro: Record<string, unknown>) => consultaCustosSchema.parse(filtro);
beforeEach(() => { vi.clearAllMocks(); });

describe("contraprovas do serviço de custos sem banco", () => {
  it("consulta tentativa, protocolo e animal retorna100 nas três visões sem somar200", async () => {
    const {tx} = criarTx();
    for (const filtro of [{ tentativaId: ids.tentativa }, { participacaoId: ids.protocolo }, { animalId: ids.animal }]) {
      const resultado = await consultarCustosTx(banco(tx),1,consulta(filtro),true);
      expect(resultado).toMatchObject({ totalConhecido: "100.00", cobertura: "COMPLETO" });
    }
  });

  it("preparatório compartilhado ainda sem vínculo fica no protocolo/animal e não é jogado na tentativa", async () => {
    const {tx, aplicacoes} = criarTx();
    aplicacoes.push({ ...aplicacoes[0], id: ids.compartilhado, movimentoEstoqueId: uid(12), nomeProdutoAplicado: "Preparatório ainda não atribuído", valorProdutoAtribuido: D("10.00") });
    expect((await consultarCustosTx(banco(tx),1,consulta({tentativaId:ids.tentativa}),true)).totalConhecido).toBe("100.00");
    const protocolo = await consultarCustosTx(banco(tx),1,consulta({participacaoId:ids.protocolo}),true);
    expect(protocolo.totalConhecido).toBe("110.00");
    expect(protocolo.atribuicoesPreparos.find(p => p.fonteId === ids.compartilhado)).toMatchObject({ aAtribuir: true, vinculos: [] });
  });

  it("preparo avulso30 repartido10/20 mantém cada protocolo com sua parcela e animal com30", async () => {
    const {tx,tentativas,aplicacoes,vinculos} = criarTx();
    tentativas[0].valorProdutoAtribuido = D("0"); tentativas[0].valorServicoAtribuido = D("0");
    tentativas.push({ ...tentativas[0], id:uid(30), movimentoEstoqueId:uid(31), tarefa:{execucaoId:uid(32)} });
    aplicacoes[0].tarefa = null;
    vinculos[0].modo = "PARCELA"; vinculos[0].valorMaterial = D("10.00");
    vinculos.push({ ...vinculos[0], id:uid(33), tentativaId:uid(30), valorMaterial:D("20.00") });
    for (const [filtro,esperado] of [
      [{tentativaId:ids.tentativa},"10.00"], [{tentativaId:uid(30)},"20.00"],
      [{participacaoId:ids.protocolo},"10.00"], [{participacaoId:uid(32)},"20.00"], [{animalId:ids.animal},"30.00"],
    ] as const) {
      expect((await consultarCustosTx(banco(tx),1,consulta(filtro),true)).totalConhecido).toBe(esperado);
    }
  });

  it("recorte pela data do fato e paginação preservam total integral e subtotal conferível", async () => {
    const {tx} = criarTx();
    const resultado = await consultarCustosTx(banco(tx),1,consulta({tentativaId:ids.tentativa,inicio:"2026-01-08",fim:"2026-01-12",limite:1}),true);
    expect(resultado.totalConhecido).toBe("70.00");
    expect(resultado.totalIntegral?.totalConhecido).toBe("100.00");
    expect(resultado.totalComponentes).toBe(2); expect(resultado.componentes).toHaveLength(1);
    expect(resultado.periodo).toMatchObject({ referencia: "DATA_DO_FATO" });
  });

  it("sem verValores oculta composição, documentos com preços e saldos das atribuições", async () => {
    const {tx, aplicacoes} = criarTx();
    aplicacoes[0].classificacaoCusto.documentoMaterial = { referencia: "Preço R$30,00", evidencia: "Comprovante: R$30,00" };
    const resultado = await consultarCustosTx(banco(tx),1,consulta({tentativaId:ids.tentativa}),false);
    expect(resultado).toMatchObject({ situacao: "OCULTO", cobertura: "COMPLETO", totalConhecido: null });
    expect(resultado.componentes.every(c => c.valor === null && c.origemId === null)).toBe(true);
    expect(resultado.fontes.every(f => f.documentoMaterial === null)).toBe(true);
    expect(resultado.atribuicoesPreparos.flatMap(p => p.parcelas).every(p => p.valorOrigem === null && p.valorAtribuido === null && p.restante === null)).toBe(true);
    expect(JSON.stringify(resultado)).not.toContain("30,00");
  });
  it("leitura operacional revela o custo conhecido sem liberar a evidência documental", async () => {
    const {tx, aplicacoes} = criarTx();
    aplicacoes[0].classificacaoCusto.documentoMaterial = { referencia: "Nota privada", evidencia: "Documento financeiro privado" };
    const resultado = await consultarCustosTx(banco(tx),1,consulta({tentativaId:ids.tentativa}),true,false);
    expect(resultado).toMatchObject({ situacao: "COMPLETO", totalConhecido: "100.00" });
    expect(resultado.fontes.every(f => f.documentoMaterial === null)).toBe(true);
    expect(JSON.stringify(resultado)).not.toContain("Documento financeiro privado");
  });
  it("consulta de animal exige passagem pelo sítio, preservando o vínculo histórico", async () => {
    const {tx} = criarTx();
    await consultarCustosTx(banco(tx),1,consulta({animalId:ids.animal}),true,false);
    expect(tx.animal.findFirst).toHaveBeenCalledWith({where:{id:ids.animal,localizacoes:{some:{propriedadeId:1}}},select:{id:true}});
    tx.animal.findFirst.mockResolvedValue(null);
    await expect(consultarCustosTx(banco(tx),2,consulta({animalId:ids.animal}),true,false)).rejects.toMatchObject({code:"NAO_ENCONTRADO"});
  });

  it("classificação simples sem documento produz SQL NULL, sem fabricar JSON null incompatível", async () => {
    const {tx} = criarTx();
    await classificarCusto({ chave:uid(20),propriedadeId:1,tipo:"APLICACAO",fonteId:ids.preparo,versao:1,motivo:"Finalidade conferida no fato",
      finalidade:"REPRODUCAO",materialNaoAplicavel:false,servicoNaoAplicavel:true,coberturaServico:"PROCEDIMENTO",materialDocumentado:null },null);
    expect(tx.classificacaoCustoPecuaria.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({ documentoMaterial:Prisma.DbNull })}));
  });

  it("corrigir valor documental abaixo da parcela já atribuída é recusado antes da gravação", async () => {
    const {tx, aplicacoes, vinculos} = criarTx();
    aplicacoes[0].origemInsumo = "SEM_ORIGEM_JUSTIFICADA"; aplicacoes[0].movimentoEstoqueId = null as unknown as string; aplicacoes[0].valorProdutoAtribuido = null;
    aplicacoes[0].classificacaoCusto.valorMaterialDocumentado = D("30.00");
    vinculos[0].modo = "PARCELA"; vinculos[0].valorMaterial = D("20.00");
    await expect(classificarCusto({ chave:uid(21),propriedadeId:1,tipo:"APLICACAO",fonteId:ids.preparo,versao:1,motivo:"Correção documental conferida",
      finalidade:"REPRODUCAO",materialNaoAplicavel:false,servicoNaoAplicavel:true,coberturaServico:"PROCEDIMENTO",materialDocumentado:{valor:"19.99",referencia:"Documento corrigido",evidencia:"Correção observada no comprovante"} },null))
      .rejects.toMatchObject({code:"CONFLITO"});
    expect(tx.classificacaoCustoPecuaria.update).not.toHaveBeenCalled();
  });

  it("cronologia da tentativa é relida após a trava, evitando vincular preparo posterior ao alvo corrigido", async () => {
    const {tx,tentativas} = criarTx(); let leiturasAlvo = 0;
    tx.tentativaReprodutiva.findMany.mockImplementation(async q => {
      if (q.where?.id?.in?.includes(ids.tentativa)) { leiturasAlvo++; return [{ ...tentativas[0],data:new Date(leiturasAlvo === 1 ? "2026-01-10" : "2026-01-04") }]; }
      return [];
    });
    await expect(vincularPreparo({chave:uid(22),propriedadeId:1,tentativaId:ids.tentativa,tipo:"APLICACAO",fonteId:ids.preparo,modo:"INTEGRAL",valorMaterial:null,valorServico:null,motivo:"Preparo vinculado à tentativa"},null))
      .rejects.toMatchObject({code:"CONFLITO"});
    expect(leiturasAlvo).toBeGreaterThanOrEqual(2);
    expect(tx.vinculoPreparoTentativa.create).not.toHaveBeenCalled();
  });
});

it("filtra preparatórios por data inclusiva e finalidade antes de paginar, conservando fontes de edição", async () => {
  const { tx, vinculos } = criarTx();
  vinculos.length = 0;
  for (const filtro of [{ inicio: "2026-01-06" }, { fim: "2026-01-04" }, { finalidade: "SANIDADE" }, { finalidade: "SEM_CLASSIFICACAO" }]) {
    const r = await consultarCustosTx(banco(tx), 1, consulta({ animalId: ids.animal, ...filtro }), true);
    expect(r.atribuicoesPreparos).toEqual([]);
    expect(r.fontes.some(f => f.id === ids.preparo)).toBe(true);
  }
  const r = await consultarCustosTx(banco(tx), 1, consulta({ animalId: ids.animal, inicio: "2026-01-05", fim: "2026-01-05", finalidade: "REPRODUCAO", limite: 1, pagina: 2 }), true);
  expect(r.atribuicoesPreparos).toEqual([expect.objectContaining({ fonteId: ids.preparo, aAtribuir: true })]);
});
it("o editor da tentativa conserva vínculos fora do recorte para permitir sua correção", async () => {
  const { tx } = criarTx();
  const r = await consultarCustosTx(banco(tx), 1, consulta({ tentativaId: ids.tentativa, inicio: "2026-01-10" }), true);
  expect(r.atribuicoesPreparos[0].vinculos[0].id).toBe(ids.vinculo);
});
