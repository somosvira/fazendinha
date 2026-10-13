import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { cadastrar, editar, movimentar, darBaixa } from "../rebanho/animais.js";
import {
  cadastrarAnimalSchema,
  editarAnimalSchema,
  movimentarSchema,
} from "../rebanho/schemas.js";
import {
  criarTentativa,
  criarAvaliacao,
  criarParto,
  registrarPerda,
  criarRestricao,
  encerrarRestricao,
  configurarRegraSanitaria,
  criarExposicao,
  painelReproducao,
  completarIdentificacao,
  atualizarPrevisao,
  corrigirVinculoGestacao,
  corrigirLactacao,
} from "./registros.js";
import { previaAnulacao, anularFato } from "./correcoes.js";
import {
  criarVisita,
  adicionarAtividade,
  imprimirVisita,
  salvarRascunho,
  confirmarAtividade,
  detalheVisita,
  previaAtividade,
} from "./visitas.js";
import { criarTipoExame } from "../sanidade/exames.js";
import {
  criarProtocolo,
  publicarProtocolo,
  iniciarExecucao,
} from "../sanidade/protocolos.js";
const suite =
  process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const run = crypto.randomUUID().slice(0, 8);
let propriedadeId: number, propriedade2: number;
const animais: string[] = [],
  produtos: string[] = [],
  protocolos: string[] = [],
  tiposExame: string[] = [],
  doencas: string[] = [];
async function animal(sexo: "F" | "M" = "F", loteId?: string) {
  const a = await cadastrar(
    cadastrarAnimalSchema.parse({
      brinco: `V4-${run}-${animais.length}`,
      sexo,
      origem: "COMPRADO",
      aptidao: "LEITE",
      dataNascimento: "2024-01-01",
      dataEntrada: "2026-01-01",
      propriedadeId,
      loteId,
    }),
    null,
  );
  animais.push(a.id);
  return a.id;
}
async function material(
  tipo: "SEMEN" | "EMBRIAO" = "SEMEN",
  doadoraId?: string,
) {
  const touro = await animal("M"),
    produto = await prisma.produto.create({
      data: {
        nome: `Gen V4 ${run}-${produtos.length}`,
        usoGenetico: true,
        unidade: "DOSE",
      },
    });
  produtos.push(produto.id);
  await prisma.movimentoEstoque.create({
    data: {
      propriedadeId,
      produtoId: produto.id,
      tipo: "ENTRADA",
      origem: "INVENTARIO_INICIAL",
      data: new Date("2026-01-01"),
      quantidade: 3,
      custoUnitario: 10,
      valorTotal: 30,
    },
  });
  return prisma.materialGenetico.create({
    data: { produtoId: produto.id, tipo, touroId: touro, doadoraId },
  });
}
const base = (animalId: string, data = "2026-09-01") => ({
  animalId,
  data,
  propriedadeId,
  chave: crypto.randomUUID(),
});
afterAll(async () => {
  if (!propriedadeId) return;
  const props = { in: [propriedadeId, propriedade2].filter(Boolean) },
    ids = { in: animais },
    ps = { in: produtos };
  const visitas = await prisma.visitaVeterinaria.findMany({
      where: { propriedadeId: props },
    }),
    atividades = await prisma.atividadeVisita.findMany({
      where: { visitaId: { in: visitas.map((v) => v.id) } },
    });
  await prisma.participanteVisita.deleteMany({
    where: { atividadeId: { in: atividades.map((a) => a.id) } },
  });
  await prisma.atividadeVisita.deleteMany({
    where: { id: { in: atividades.map((a) => a.id) } },
  });
  await prisma.impressaoVisita.deleteMany({
    where: { visitaId: { in: visitas.map((v) => v.id) } },
  });
  await prisma.visitaVeterinaria.deleteMany({
    where: { propriedadeId: props },
  });
  await prisma.avaliacaoReprodutiva.deleteMany({
    where: { propriedadeId: props },
  });
  const partos = await prisma.partoAnimal.findMany({
    where: { propriedadeId: props },
  });
  await prisma.criaParto.deleteMany({
    where: { partoId: { in: partos.map((p) => p.id) } },
  });
  await prisma.lactacaoAnimal.deleteMany({ where: { propriedadeId: props } });
  await prisma.partoAnimal.deleteMany({ where: { propriedadeId: props } });
  const gs = await prisma.gestacaoAnimal.findMany({
    where: { propriedadeId: props },
  });
  await prisma.historicoPrevisaoParto.deleteMany({
    where: { gestacaoId: { in: gs.map((g) => g.id) } },
  });
  await prisma.gestacaoAnimal.deleteMany({ where: { propriedadeId: props } });
  await prisma.tentativaReprodutiva.deleteMany({
    where: { propriedadeId: props },
  });
  await prisma.situacaoInicialReprodutiva.deleteMany({
    where: { propriedadeId: props },
  });
  await prisma.restricaoReprodutiva.deleteMany({
    where: { propriedadeId: props },
  });
  await prisma.regraSanitariaReprodutiva.deleteMany({
    where: { propriedadeId: props },
  });
  const exps = await prisma.exposicaoTouro.findMany({
    where: { propriedadeId: props },
  });
  await prisma.participacaoExposicao.deleteMany({
    where: { exposicaoId: { in: exps.map((e) => e.id) } },
  });
  await prisma.exposicaoTouro.deleteMany({ where: { propriedadeId: props } });
  await prisma.aplicacaoProduto.deleteMany({ where: { propriedadeId: props } });
  await prisma.exameAnimal.deleteMany({ where: { propriedadeId: props } });
  await prisma.ocorrenciaSanitaria.deleteMany({
    where: { propriedadeId: props },
  });
  await prisma.tarefaSanitaria.deleteMany({
    where: { execucao: { propriedadeId: props } },
  });
  await prisma.execucaoProtocoloSanitario.deleteMany({
    where: { propriedadeId: props },
  });
  await prisma.etapaProtocoloSanitario.deleteMany({
    where: { protocoloId: { in: protocolos } },
  });
  await prisma.protocoloSanitario.deleteMany({
    where: { id: { in: protocolos } },
  });
  await prisma.tipoExame.deleteMany({ where: { id: { in: tiposExame } } });
  await prisma.doenca.deleteMany({ where: { id: { in: doencas } } });
  await prisma.materialGenetico.deleteMany({ where: { produtoId: ps } });
  await prisma.alocacaoPartidaEstoque.deleteMany({
    where: { movimentoEstoque: { produtoId: ps } },
  });
  await prisma.movimentoEstoque.deleteMany({ where: { produtoId: ps } });
  await prisma.produto.deleteMany({ where: { id: ps } });
  await prisma.requisicaoPecuaria.deleteMany({
    where: { propriedadeId: props },
  });
  await prisma.auditoriaPecuaria.deleteMany({
    where: {
      OR: [
        { propriedadeId: props },
        { animalId: ids },
        { entidadeId: { in: [...protocolos, ...tiposExame] } },
      ],
    },
  });
  await prisma.movimentacaoAnimal.deleteMany({ where: { animalId: ids } });
  await prisma.baixaAnimal.deleteMany({ where: { animalId: ids } });
  await prisma.localizacaoAnimal.deleteMany({ where: { animalId: ids } });
  await prisma.destinoAnimal.deleteMany({ where: { animalId: ids } });
  await prisma.pesagem.deleteMany({ where: { animalId: ids } });
  await prisma.composicaoRacial.deleteMany({ where: { animalId: ids } });
  await prisma.animal.updateMany({
    where: { id: ids },
    data: { maeId: null, paiId: null },
  });
  await prisma.animal.deleteMany({ where: { id: ids } });
  await prisma.movimentacao.deleteMany({
    where: { propriedadeDestinoId: props },
  });
  await prisma.lote.deleteMany({ where: { propriedadeId: props } });
  await prisma.propriedade.deleteMany({ where: { id: props } });
});
suite("reprodução V4 integra fatos, estoque e visita sem duplicação", () => {
  beforeAll(async () => {
    propriedadeId = (
      await prisma.propriedade.create({
        data: { nome: `V4 reprodução ${run}` },
      })
    ).id;
    propriedade2 = (
      await prisma.propriedade.create({ data: { nome: `V4 outro ${run}` } })
    ).id;
  });
  it("IA concorrente mesma chave consome uma vez; chaves diferentes disputam saldo", async () => {
    const a = await animal(),
      m = await material();
    const input = {
      ...base(a),
      tipo: "IA" as const,
      materialId: m.id,
      origem: "ESTOQUE" as const,
      quantidade: 2,
    };
    const feitos = await Promise.all([
      criarTentativa(input, null),
      criarTentativa(input, null),
    ]);
    expect(feitos[0].id).toBe(feitos[1].id);
    expect(
      await prisma.movimentoEstoque.count({
        where: { produtoId: m.produtoId, tipo: "SAIDA" },
      }),
    ).toBe(1);
    const a2 = await animal(),
      a3 = await animal();
    const resultados = await Promise.allSettled([
      criarTentativa({ ...input, ...base(a2), quantidade: 1 }, null),
      criarTentativa({ ...input, ...base(a3), quantidade: 1 }, null),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await expect(
      criarTentativa({ ...input, quantidade: 1 }, null),
    ).rejects.toMatchObject({ code: "CONFLITO" });
  });
  it("P+, OK e sexagem produzem avaliações da mesma gestação e perda não apaga consumo", async () => {
    const a = await animal(),
      m = await material();
    const t = await criarTentativa(
      {
        ...base(a),
        tipo: "IA",
        materialId: m.id,
        origem: "ESTOQUE",
        quantidade: 1,
      },
      null,
    );
    const p = await criarAvaliacao(
      { ...base(a, "2026-09-20"), resultado: "POSITIVO", tentativaId: t.id },
      null,
    );
    expect(p.gestacaoId).toBeTruthy();
    await criarAvaliacao(
      {
        ...base(a, "2026-09-21"),
        resultado: "RECONFIRMACAO",
        gestacaoId: p.gestacaoId,
      },
      null,
    );
    await criarAvaliacao(
      {
        ...base(a, "2026-09-22"),
        resultado: "SEXAGEM",
        gestacaoId: p.gestacaoId,
        sexoFetal: "F",
      },
      null,
    );
    expect(await prisma.gestacaoAnimal.count({ where: { animalId: a } })).toBe(
      1,
    );
    await expect(
      criarTentativa(
        {
          ...base(a, "2026-09-25"),
          tipo: "IA",
          materialId: m.id,
          origem: "ESTOQUE",
          quantidade: 1,
        },
        null,
      ),
    ).rejects.toThrow(/gestação/);
    await registrarPerda(
      {
        ...base(a, "2026-09-24"),
        gestacaoId: p.gestacaoId!,
        motivo: "Perda constatada pelo exame",
      },
      null,
    );
    expect(
      (
        await prisma.tentativaReprodutiva.findUniqueOrThrow({
          where: { id: t.id },
        })
      ).status,
    ).toBe("VALIDO");
    expect((await painelReproducao(propriedadeId, a)).animais[0].situacao).toBe(
      "VAZIA",
    );
  });
  it("TE cria provisória atomicamente, mãe genética distinta da receptora; corrige identificação", async () => {
    const doadora = await animal(),
      receptora = await animal(),
      m = await material("EMBRIAO", doadora);
    const t = await criarTentativa(
      {
        ...base(receptora),
        tipo: "TE",
        materialId: m.id,
        origem: "ESTOQUE",
        quantidade: 1,
      },
      null,
    );
    const av = await criarAvaliacao(
      {
        ...base(receptora, "2026-09-20"),
        resultado: "POSITIVO",
        tentativaId: t.id,
      },
      null,
    );
    const input = {
      ...base(receptora, "2026-10-01"),
      tipo: "NORMAL" as const,
      gestacaoId: av.gestacaoId,
      iniciarLactacao: true,
      crias: [
        { viva: true, sexo: "F" as const, aptidao: "LEITE" as const },
        { viva: false, sexo: "M" as const, aptidao: "LEITE" as const },
      ],
    };
    const p = await criarParto(input, null),
      a = await prisma.animal.findUniqueOrThrow({
        where: { id: p.crias[0].animalId! },
      });
    animais.push(a.id);
    expect(a.maeId).toBe(doadora);
    expect(a.maeId).not.toBe(receptora);
    expect(a.identificacaoProvisoria).toBe(true);
    expect(a.brinco.length).toBeLessThan(40);
    expect(p.crias[1].animalId).toBeNull();
    expect((await criarParto(input, null)).id).toBe(p.id);
    const completo = await completarIdentificacao(
      a.id,
      propriedadeId,
      `CRIA-${run}`,
      null,
      null,
    );
    expect(completo.identificacaoProvisoria).toBe(false);
    expect(completo.codigoProvisorio).toBe(a.codigoProvisorio);
    await expect(
      editar(a.id, editarAnimalSchema.parse({ sexo: "M" }), null),
    ).rejects.toMatchObject({ code: "CONFLITO" });
  });
  it("aborto/natimorto contam parto sem criar lactação presumida nem animal ativo", async () => {
    const a = await animal();
    const p = await criarParto(
      { ...base(a), tipo: "ABORTO", iniciarLactacao: false, crias: [] },
      null,
    );
    expect(p.crias).toHaveLength(0);
    const p2 = await criarParto(
      {
        ...base(a, "2026-09-10"),
        tipo: "NATIMORTO",
        iniciarLactacao: false,
        crias: [{ viva: false, sexo: "F", aptidao: "LEITE" }],
      },
      null,
    );
    expect(p2.crias[0].animalId).toBeNull();
    expect(await prisma.lactacaoAnimal.count({ where: { animalId: a } })).toBe(
      0,
    );
    expect((await painelReproducao(propriedadeId, a)).animais[0].partos).toBe(
      2,
    );
    await expect(
      criarParto(
        {
          ...base(a, "2026-09-15"),
          tipo: "ABORTO",
          iniciarLactacao: false,
          crias: [{ viva: true, sexo: "F", aptidao: "LEITE" }],
        },
        null,
      ),
    ).rejects.toThrow(/cria viva/);
  });
  it("restrição descarte preserva cuidados e lactação; doença só bloqueia após regra explícita", async () => {
    const a = await animal(),
      m = await material(),
      doenca = await prisma.doenca.create({
        data: { nome: `Doença V4 ${run}` },
      });
    doencas.push(doenca.id);
    await prisma.ocorrenciaSanitaria.create({
      data: {
        animalId: a,
        propriedadeId,
        doencaId: doenca.id,
        inicio: new Date("2026-08-01"),
        observacao: "Condição observada",
      },
    });
    const t = await criarTentativa(
      {
        ...base(a),
        tipo: "IA",
        materialId: m.id,
        origem: "ESTOQUE",
        quantidade: 1,
      },
      null,
    );
    expect(t.id).toBeTruthy();
    await configurarRegraSanitaria(
      {
        propriedadeId,
        doencaId: doenca.id,
        acao: "IA",
        efeito: "BLOQUEAR",
        motivo: "Regra definida pela propriedade",
        ativo: true,
      },
      null,
    );
    await expect(
      criarTentativa(
        {
          ...base(a, "2026-09-02"),
          tipo: "IA",
          materialId: m.id,
          origem: "ESTOQUE",
          quantidade: 1,
        },
        null,
      ),
    ).rejects.toThrow(/sanitária/);
    const r = await criarRestricao(
      {
        ...base(a, "2026-09-03"),
        tipo: "DESCARTE",
        acoes: ["IA", "TE", "COBERTURA", "IATF"],
        motivo: "Não realizar nova reprodução",
      },
      null,
    );
    expect(await prisma.baixaAnimal.count({ where: { animalId: a } })).toBe(0);
    await encerrarRestricao(
      r.id,
      propriedadeId,
      "2026-09-04",
      "Decisão reavaliada expressamente",
      null,
    );
  });
  it("visita confirma subconjunto P+/OK/M; falha numa linha desfaz todas e impressão preserva lista", async () => {
    const a = await animal(),
      b = await animal(),
      c = await animal();
    const vb = await criarAvaliacao(
      {
        ...base(b, "2026-08-01"),
        resultado: "POSITIVO",
        motivoVinculoDesconhecido: "Tentativa anterior sem documento",
      },
      null,
    );
    const vc = await criarAvaliacao(
      {
        ...base(c, "2026-08-01"),
        resultado: "POSITIVO",
        motivoVinculoDesconhecido: "Gestação comprovada sem tentativa",
      },
      null,
    );
    const v = await criarVisita(
      { propriedadeId, data: "2026-09-01", nome: "Avaliação mista" },
      null,
    );
    const atividade = await adicionarAtividade(
      v.id,
      {
        propriedadeId,
        tipo: "AVALIACAO_REPRODUTIVA",
        nome: "Toque",
        extra: false,
        contexto: { filtro: "fêmeas" },
        participantes: [{ animalId: a }, { animalId: b }, { animalId: c }],
      },
      null,
    );
    const impressao = await imprimirVisita(v.id, propriedadeId, null);
    await salvarRascunho(
      v.id,
      atividade.participantes[0].id,
      propriedadeId,
      {
        resultado: "POSITIVO",
        motivoVinculoDesconhecido: "Tentativa não identificada",
      },
      null,
    );
    const entrada = {
      propriedadeId,
      chave: crypto.randomUUID(),
      itens: [
        {
          participanteId: atividade.participantes[0].id,
          status: "CONFIRMADO" as const,
        },
        {
          participanteId: atividade.participantes[1].id,
          status: "CONFIRMADO" as const,
          dados: { resultado: "RECONFIRMACAO", gestacaoId: vc.gestacaoId },
        },
      ],
    };
    await expect(
      confirmarAtividade(v.id, atividade.id, entrada, null),
    ).rejects.toThrow(/Nenhuma linha/);
    expect(
      await prisma.avaliacaoReprodutiva.count({ where: { animalId: a } }),
    ).toBe(0);
    const correto = {
      ...entrada,
      chave: crypto.randomUUID(),
      itens: [
        {
          participanteId: atividade.participantes[0].id,
          status: "CONFIRMADO" as const,
        },
        {
          participanteId: atividade.participantes[1].id,
          status: "CONFIRMADO" as const,
          dados: { resultado: "RECONFIRMACAO", gestacaoId: vb.gestacaoId },
        },
      ],
    };
    const resposta = await confirmarAtividade(
      v.id,
      atividade.id,
      correto,
      null,
    );
    expect(resposta.status).toBe("PARCIAL");
    expect(
      (await confirmarAtividade(v.id, atividade.id, correto, null))
        .participantes,
    ).toHaveLength(2);
    await confirmarAtividade(
      v.id,
      atividade.id,
      {
        propriedadeId,
        chave: crypto.randomUUID(),
        itens: [
          {
            participanteId: atividade.participantes[2].id,
            status: "CONFIRMADO",
            dados: {
              resultado: "SEXAGEM",
              gestacaoId: vc.gestacaoId,
              sexoFetal: "M",
            },
          },
        ],
      },
      null,
    );
    const extra = await adicionarAtividade(
      v.id,
      {
        propriedadeId,
        tipo: "AVALIACAO_REPRODUTIVA",
        nome: "Extra",
        extra: true,
        contexto: {},
        participantes: [{ animalId: a }],
      },
      null,
    );
    expect(extra.extra).toBe(true);
    const detalhe = await detalheVisita(v.id, propriedadeId);
    expect(detalhe.atividades).toHaveLength(2);
    expect(JSON.stringify(impressao.snapshot)).not.toContain(extra.id);
    expect(
      await prisma.gestacaoAnimal.count({
        where: { animalId: { in: [a, b, c] } },
      }),
    ).toBe(3);
  });
  it("atividade sanitária usa a aplicação V3 e consome uma vez; exame aponta ao fato V3", async () => {
    const a = await animal();
    const produto = await prisma.produto.create({
      data: { nome: `San V4 ${run}`, usoSanitario: true, unidade: "ML" },
    });
    produtos.push(produto.id);
    await prisma.movimentoEstoque.create({
      data: {
        produtoId: produto.id,
        propriedadeId,
        tipo: "ENTRADA",
        origem: "INVENTARIO_INICIAL",
        data: new Date("2026-01-01"),
        quantidade: 10,
        custoUnitario: 2,
        valorTotal: 20,
      },
    });
    const tipoAplicacao = await prisma.tipoAplicacaoSanitaria.findFirstOrThrow({
      where: { ativo: true },
    });
    const p = await criarProtocolo(
      {
        nome: `Protocolo visita ${run}`,
        etapas: [
          {
            tipo: "APLICACAO",
            produtoId: produto.id,
            tipoAplicacaoId: tipoAplicacao.id,
            dose: 1,
            unidade: "ML",
            diaRelativo: 0,
          },
        ],
      },
      null,
    );
    protocolos.push(p.id);
    await publicarProtocolo(p.id, null);
    const execucao = await iniciarExecucao(
      { animalId: a, propriedadeId, protocoloId: p.id, inicio: "2026-09-01" },
      null,
    );
    const v = await criarVisita(
        { propriedadeId, data: "2026-09-01", nome: "Sanidade e reprodução" },
        null,
      ),
      atividade = await adicionarAtividade(
        v.id,
        {
          propriedadeId,
          tipo: "APLICACAO_SANITARIA",
          nome: "Dose",
          extra: false,
          contexto: {},
          participantes: [
            { animalId: a, tarefaSanitariaId: execucao.tarefas[0].id },
          ],
        },
        null,
      );
    const input = {
      propriedadeId,
      chave: crypto.randomUUID(),
      itens: [
        {
          participanteId: atividade.participantes[0].id,
          status: "CONFIRMADO" as const,
          dados: {
            aplicadaEm: "2026-09-01T10:00:00-03:00",
            tipoAplicacaoId: tipoAplicacao.id,
            nomeProdutoAplicado: produto.nome,
            produtoId: produto.id,
            dose: "1",
            unidadeDose: "ML",
            origemInsumo: "BAIXA_ESTOQUE",
          },
        },
      ],
    };
    await confirmarAtividade(v.id, atividade.id, input, null);
    await confirmarAtividade(v.id, atividade.id, input, null);
    expect(
      await prisma.aplicacaoProduto.count({ where: { animalId: a } }),
    ).toBe(1);
    expect(
      await prisma.movimentoEstoque.count({
        where: { produtoId: produto.id, tipo: "SAIDA" },
      }),
    ).toBe(1);
    const tipoExame = await criarTipoExame(
      { nome: `Exame visita ${run}`, tipoResultado: "NUMERO", unidade: "mg" },
      null,
    );
    tiposExame.push(tipoExame.id);
    const exame = await adicionarAtividade(
      v.id,
      {
        propriedadeId,
        tipo: "EXAME_SANITARIO",
        nome: "Exame extra",
        extra: true,
        contexto: {},
        participantes: [{ animalId: a }],
      },
      null,
    );
    const r = await confirmarAtividade(
      v.id,
      exame.id,
      {
        propriedadeId,
        chave: crypto.randomUUID(),
        itens: [
          {
            participanteId: exame.participantes[0].id,
            status: "CONFIRMADO",
            dados: { tipoExameId: tipoExame.id, resultadoNumero: 0 },
          },
        ],
      },
      null,
    );
    expect(r.participantes[0].fatoTipo).toBe("ExameAnimal");
    expect(
      (
        await prisma.exameAnimal.findUniqueOrThrow({
          where: { id: r.participantes[0].fatoId! },
        })
      ).resultadoNumero!.toString(),
    ).toBe("0");
  });
  it("exposição recalcula participantes reais quando entram/saem do lote; não inventa coberturas", async () => {
    const lote = await prisma.lote.create({
        data: { propriedadeId, nome: `Exposto ${run}` },
      }),
      a = await animal("F", lote.id),
      b = await animal(),
      touro = await animal("M");
    const exp = await criarExposicao(
      {
        chave: crypto.randomUUID(),
        propriedadeId,
        loteId: lote.id,
        touroId: touro,
        inicio: "2026-08-01",
      },
      null,
    );
    await movimentar(
      movimentarSchema.parse({
        animalIds: [b],
        propriedadeId,
        loteId: lote.id,
        data: "2026-08-10",
      }),
      null,
    );
    await movimentar(
      movimentarSchema.parse({
        animalIds: [a],
        propriedadeId,
        data: "2026-08-20",
      }),
      null,
    );
    const painel = await painelReproducao(propriedadeId);
    const participantes = painel.exposicoes.find(
      (e) => e.id === exp.id,
    )!.participantes;
    expect(participantes.find((p) => p.animalId === b)!.inicio).toEqual(
      new Date("2026-08-10"),
    );
    expect(participantes.find((p) => p.animalId === a)!.fim).toEqual(
      new Date("2026-08-20"),
    );
    expect(
      await prisma.tentativaReprodutiva.count({
        where: { animalId: { in: [a, b] }, tipo: "COBERTURA" },
      }),
    ).toBe(0);
  });
  it("prévia de anulação protege vínculos; anulação de tentativa estorna insumo sem apagar fato", async () => {
    const a = await animal(),
      m = await material(),
      t = await criarTentativa(
        {
          ...base(a),
          tipo: "IA",
          materialId: m.id,
          origem: "ESTOQUE",
          quantidade: 1,
        },
        null,
      );
    const previa = await previaAnulacao("tentativas", t.id, propriedadeId);
    expect(previa.impedimentos).toHaveLength(0);
    const input = {
      propriedadeId,
      chave: crypto.randomUUID(),
      motivo: "Tentativa lançada indevidamente",
      fingerprint: previa.fingerprint,
      destinoConsumo: "DEVOLVER_ESTOQUE" as const,
    };
    await anularFato("tentativas", t.id, input, null);
    await anularFato("tentativas", t.id, input, null);
    expect(
      (
        await prisma.tentativaReprodutiva.findUniqueOrThrow({
          where: { id: t.id },
        })
      ).status,
    ).toBe("ANULADO");
    expect(
      await prisma.movimentoEstoque.count({
        where: { produtoId: m.produtoId },
      }),
    ).toBe(3);
  });
  it("anular sem devolução preserva dose usada e não duplica estorno", async () => {
    const a = await animal(),
      m = await material(),
      t = await criarTentativa(
        {
          ...base(a),
          tipo: "IA",
          materialId: m.id,
          origem: "ESTOQUE",
          quantidade: 1,
        },
        null,
      );
    const previa = await previaAnulacao("tentativas", t.id, propriedadeId);
    const input = {
      propriedadeId,
      chave: crypto.randomUUID(),
      motivo: "Registro errado mas dose já utilizada",
      fingerprint: previa.fingerprint,
      destinoConsumo: "MANTER_CONSUMO" as const,
    };
    await anularFato("tentativas", t.id, input, null);
    await anularFato("tentativas", t.id, input, null);
    expect(
      (
        await prisma.tentativaReprodutiva.findUniqueOrThrow({
          where: { id: t.id },
        })
      ).consumoMantido,
    ).toBe(true);
    expect(
      await prisma.movimentoEstoque.count({
        where: { produtoId: m.produtoId },
      }),
    ).toBe(2);
  });
  it("mudança após folha exige ciência da prévia atual, e alteração após revisão rejeita confirmação", async () => {
    const a = await animal(),
      v = await criarVisita(
        { propriedadeId, data: "2026-09-01", nome: "Revalidar identidade" },
        null,
      );
    const atividade = await adicionarAtividade(
      v.id,
      {
        propriedadeId,
        tipo: "AVALIACAO_REPRODUTIVA",
        nome: "Exame",
        extra: false,
        contexto: {},
        participantes: [{ animalId: a, motivos: ["Revisão registrada"] }],
      },
      null,
    );
    await imprimirVisita(v.id, propriedadeId, null);
    await editar(
      a,
      editarAnimalSchema.parse({ nome: "Nome revisado após papel" }),
      null,
    );
    const input = {
      propriedadeId,
      chave: crypto.randomUUID(),
      itens: [
        {
          participanteId: atividade.participantes[0].id,
          status: "CONFIRMADO" as const,
          dados: { resultado: "NEGATIVO" },
        },
      ],
    };
    await expect(
      confirmarAtividade(v.id, atividade.id, input, null),
    ).rejects.toMatchObject({
      code: "CONFLITO",
      campo: expect.stringContaining("cienciaAlteracoes"),
    });
    const previa = await previaAtividade(v.id, atividade.id, propriedadeId);
    expect(previa.participantes[0].alteracoes).toContain(
      "identidade do animal alterada",
    );
    await editar(
      a,
      editarAnimalSchema.parse({ nome: "Nova alteração depois da revisão" }),
      null,
    );
    await expect(
      confirmarAtividade(
        v.id,
        atividade.id,
        {
          ...input,
          cienciaAlteracoes: true,
          fingerprintPrevia: previa.fingerprint,
        },
        null,
      ),
    ).rejects.toMatchObject({ code: "CONFLITO", campo: "fingerprintPrevia" });
    const atual = await previaAtividade(v.id, atividade.id, propriedadeId);
    await confirmarAtividade(
      v.id,
      atividade.id,
      {
        ...input,
        cienciaAlteracoes: true,
        fingerprintPrevia: atual.fingerprint,
      },
      null,
    );
    expect(
      await prisma.avaliacaoReprodutiva.count({ where: { animalId: a } }),
    ).toBe(1);
  });
  it("correção de previsão/vínculo preserva gêmeas e permite corrigir lactação antes de anular parto", async () => {
    const a = await animal();
    const av = await criarAvaliacao(
      {
        ...base(a, "2026-08-01"),
        resultado: "POSITIVO",
        motivoVinculoDesconhecido: "Gestação com referência desconhecida",
      },
      null,
    );
    await atualizarPrevisao(
      av.gestacaoId!,
      propriedadeId,
      "2026-10-01",
      "Previsão informada pelo responsável",
      "INFORMADA",
      null,
    );
    await atualizarPrevisao(
      av.gestacaoId!,
      propriedadeId,
      "2026-10-02",
      "Previsão revisada em atendimento",
      "AVALIACAO",
      null,
    );
    const p = await criarParto(
      {
        ...base(a, "2026-09-01"),
        tipo: "NORMAL",
        gestacaoId: av.gestacaoId,
        iniciarLactacao: true,
        crias: [
          { viva: true, sexo: "F", aptidao: "LEITE" },
          { viva: true, sexo: "F", aptidao: "LEITE" },
        ],
      },
      null,
    );
    const crias = await prisma.animal.findMany({
      where: { id: { in: p.crias.map((c) => c.animalId!) } },
    });
    animais.push(...crias.map((c) => c.id));
    await corrigirVinculoGestacao(
      av.gestacaoId!,
      propriedadeId,
      null,
      "Origem segue desconhecida sem inventar pedigree",
      null,
    );
    expect(
      await prisma.historicoPrevisaoParto.count({
        where: { gestacaoId: av.gestacaoId! },
      }),
    ).toBe(2);
    const previo = await previaAnulacao("partos", p.id, propriedadeId);
    expect(previo.impedimentos).toContain(
      "Lactação vinculada deve ser corrigida antes de anular o parto",
    );
    const lactacao = await prisma.lactacaoAnimal.findFirstOrThrow({
      where: { partoId: p.id },
    });
    await corrigirLactacao(
      lactacao.id,
      {
        propriedadeId,
        partoId: null,
        motivo: "Lactação real preservada sem vincular parto incorreto",
      },
      null,
    );
    const previa = await previaAnulacao("partos", p.id, propriedadeId);
    await anularFato(
      "partos",
      p.id,
      {
        propriedadeId,
        chave: crypto.randomUUID(),
        motivo: "Parto registrado com vínculo incorreto",
        fingerprint: previa.fingerprint,
        cienciaPreservacaoCrias: true,
      },
      null,
    );
    expect(
      await prisma.animal.count({
        where: { id: { in: crias.map((c) => c.id) } },
      }),
    ).toBe(2);
    expect(
      (
        await prisma.lactacaoAnimal.findUniqueOrThrow({
          where: { id: lactacao.id },
        })
      ).partoId,
    ).toBeNull();
  });
});
