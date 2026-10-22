import { Prisma } from "@prisma/client";
import { resolverFinalidadeLeite } from "./leite/finalidade.calc.js";
import { RebanhoError, hojeFazendaDate } from "./rebanho/regras.js";

/** Mesmo uma inclusão depois excluída conserva a origem da folha guardada. */
export async function conferirLocalizacoesComProducaoTx(tx: Prisma.TransactionClient, localizacaoIds: string[]) {
  if (await tx.participanteProducaoLeite.count({ where: { localizacaoId: { in: localizacaoIds } } }))
    throw new RebanhoError("CONFLITO", "A localização tem histórico de ordenha; não pode ser apagada ao desfazer a movimentação. Preserve a origem e registre uma nova movimentação");
}

export async function conferirAnimalNoFato(
  tx: Prisma.TransactionClient,
  animalId: string,
  propriedadeId: number,
  data: Date,
  campo = "data",
) {
  const animal = await tx.animal.findUnique({ where: { id: animalId } });
  if (!animal)
    throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado");
  if (!Number.isFinite(data.getTime()) || data > hojeFazendaDate())
    throw new RebanhoError(
      "VALIDACAO",
      "Informe uma data válida até hoje",
      campo,
    );
  if (data < animal.dataNascimento || data < animal.dataEntrada)
    throw new RebanhoError(
      "VALIDACAO",
      "O fato não pode anteceder o nascimento ou a entrada",
      campo,
    );
  const baixa = await tx.baixaAnimal.findFirst({
    where: { animalId, estornadaEm: null },
  });
  if (baixa && data > baixa.data)
    throw new RebanhoError(
      "VALIDACAO",
      "O fato não pode ocorrer após a baixa do animal",
      campo,
    );
  const local = await tx.localizacaoAnimal.findFirst({
    where: {
      animalId,
      propriedadeId,
      desde: { lte: data },
      OR: [
        { ate: null },
        { ate: { gt: data } },
        ...(baixa &&
        data.getTime() === baixa.data.getTime() &&
        baixa.localizacaoFechadaId
          ? [{ id: baixa.localizacaoFechadaId }]
          : []),
      ],
    },
  });
  if (!local)
    throw new RebanhoError(
      "VALIDACAO",
      "O animal não estava neste sítio na data informada",
      campo,
    );
  return animal;
}

export async function conferirFatosNaBaixa(
  tx: Prisma.TransactionClient,
  animalId: string,
  data: Date,
) {
  const fatos = await Promise.all([
    tx.tentativaReprodutiva.count({
      where: { animalId, status: "VALIDO", data: { gt: data } },
    }),
    tx.avaliacaoReprodutiva.count({
      where: { animalId, status: "VALIDO", data: { gt: data } },
    }),
    tx.partoAnimal.count({
      where: { animalId, status: "VALIDO", data: { gt: data } },
    }),
    tx.situacaoInicialReprodutiva.count({
      where: { animalId, status: "VALIDO", data: { gt: data } },
    }),
    tx.restricaoReprodutiva.count({
      where: { animalId, status: "VALIDO", data: { gt: data } },
    }),
    tx.gestacaoAnimal.count({
      where: {
        animalId,
        status: "VALIDO",
        OR: [{ confirmadaEm: { gt: data } }, { encerradaEm: { gt: data } }],
      },
    }),
    tx.lactacaoAnimal.count({
      where: {
        animalId,
        OR: [{ inicio: { gt: data } }, { encerradaEm: { gt: data } }],
      },
    }),
    tx.aplicacaoProduto.count({
      where: { animalId, status: "VALIDO", data: { gt: data } },
    }),
    tx.exameAnimal.count({
      where: { animalId, status: "VALIDO", data: { gt: data } },
    }),
    tx.manejoAnimal.count({
      where: { animalId, status: "VALIDO", data: { gt: data } },
    }),
    tx.ocorrenciaSanitaria.count({
      where: {
        animalId,
        status: "VALIDO",
        OR: [{ inicio: { gt: data } }, { fim: { gt: data } }],
      },
    }),
    tx.fornecimentoColostro.count({
      where: { cria: { animalId }, status: "VALIDO", data: { gt: data } },
    }),
    tx.participanteProducaoLeite.count({ where: { animalId, excluidoEm: null,
      medicoes: { some: { estado: { in: ["MEDIDO", "NAO_ORDENHADO"] } } },
      dia: { dataOperacional: { gt: data } },
    } }),
    tx.parcelaDestinoLeite.count({ where: { animalId, ativo: true, destino: { status: "CONFIRMADO", data: { gt: data } } } }),
  ]);
  if (fatos.some(Boolean))
    throw new RebanhoError(
      "CONFLITO",
      "A baixa antecede fatos sanitários ou de manejo; revise-os antes",
      "data",
    );
}

/** Confere o histórico proposto antes do commit; lançamentos com sítio desconhecido continuam legíveis. */
export async function conferirHistoricoDosFatos(
  tx: Prisma.TransactionClient,
  animalIds: string[],
) {
  const where = { animalId: { in: animalIds }, status: "VALIDO" as const };
  const [animais, locais, baixas, aplicacoes, exames, manejos, ocorrencias, colostros, pesosParto] =
    await Promise.all([
      tx.animal.findMany({
        where: { id: { in: animalIds } },
        select: {
          id: true,
          sexo: true,
          origem: true,
          dataNascimento: true,
          dataEntrada: true,
        },
      }),
      tx.localizacaoAnimal.findMany({ where: { animalId: { in: animalIds } } }),
      tx.baixaAnimal.findMany({
        where: { animalId: { in: animalIds }, estornadaEm: null },
        select: { animalId: true, data: true, localizacaoFechadaId: true },
      }),
      tx.aplicacaoProduto.findMany({
        where,
        select: {
          animalId: true,
          propriedadeId: true,
          data: true,
          origem: true,
        },
      }),
      tx.exameAnimal.findMany({
        where,
        select: {
          animalId: true,
          propriedadeId: true,
          data: true,
          origem: true,
        },
      }),
      tx.manejoAnimal.findMany({
        where,
        select: {
          animalId: true,
          propriedadeId: true,
          data: true,
          origem: true,
          tipo: true,
        },
      }),
      tx.ocorrenciaSanitaria.findMany({
        where,
        select: {
          animalId: true,
          propriedadeId: true,
          inicio: true,
          origem: true,
        },
      }),
      tx.fornecimentoColostro.findMany({
        where: { cria: { animalId: { in: animalIds } }, status: "VALIDO" },
        select: { data: true, propriedadeId: true, cria: { select: { animalId: true } } },
      }),
      tx.vinculoPesagemParto.findMany({
        where: { revogadoEm: null, pesagem: { animalId: { in: animalIds } } },
        select: { pesagem: { select: { animalId: true, data: true } }, parto: { select: { propriedadeId: true } } },
      }),
    ]);
  const [
    tentativas,
    avaliacoes,
    partos,
    iniciais,
    restricoes,
    gestacoes,
    lactacoes,
  ] = await Promise.all([
    tx.tentativaReprodutiva.findMany({ where }),
    tx.avaliacaoReprodutiva.findMany({ where }),
    tx.partoAnimal.findMany({ where }),
    tx.situacaoInicialReprodutiva.findMany({ where }),
    tx.restricaoReprodutiva.findMany({ where }),
    tx.gestacaoAnimal.findMany({ where }),
    tx.lactacaoAnimal.findMany({ where: { animalId: { in: animalIds } } }),
  ]);
  const producoes = await tx.participanteProducaoLeite.findMany({ where: {
    animalId: { in: animalIds }, excluidoEm: null,
    medicoes: { some: { estado: { in: ["MEDIDO", "NAO_ORDENHADO"] } } },
  }, select: { animalId: true, dia: { select: { propriedadeId: true, dataOperacional: true } } } });
  const destinosLeite = await tx.parcelaDestinoLeite.findMany({ where: { animalId: { in: animalIds }, ativo: true, destino: { status: "CONFIRMADO" } },
    select: { animalId: true, destino: { select: { propriedadeId: true, data: true } } } });
  const reprodutivos = [
    ...tentativas,
    ...avaliacoes,
    ...partos,
    ...iniciais,
    ...restricoes,
    ...gestacoes.map((g) => ({ ...g, data: g.confirmadaEm })),
    ...lactacoes.map((l) => ({ ...l, data: l.inicio })),
  ];
  const crias = await tx.criaParto.findMany({
    where: { animalId: { in: animalIds }, viva: true },
  });
  const partosCrias = await tx.partoAnimal.findMany({
    where: { id: { in: crias.map((c) => c.partoId) } },
  });
  const porId = new Map(animais.map((a) => [a.id, a]));
  for (const cria of crias) {
    const animal = porId.get(cria.animalId!)!,
      parto = partosCrias.find((p) => p.id === cria.partoId)!;
    if (
      animal.origem !== "NASCIDO" ||
      animal.sexo !== cria.sexo ||
      animal.dataNascimento.getTime() !== parto.data.getTime()
    )
      throw new RebanhoError(
        "CONFLITO",
        "Sexo e nascimento da cria devem concordar com o parto vinculado; corrija o fato antes",
        "dataNascimento",
      );
  }
  if ([...reprodutivos, ...producoes].some((r) => porId.get(r.animalId)?.sexo !== "F"))
    throw new RebanhoError(
      "CONFLITO",
      "Animal com histórico reprodutivo válido não pode mudar para macho",
      "sexo",
    );
  if (
    manejos.some(
      (m) => m.tipo === "CASTRACAO" && porId.get(m.animalId)?.sexo !== "M",
    )
  )
    throw new RebanhoError(
      "CONFLITO",
      "Animal com castração válida não pode mudar para fêmea",
      "sexo",
    );
  const fatos = [
    ...destinosLeite.map(p => ({ animalId: p.animalId, propriedadeId: p.destino.propriedadeId, data: p.destino.data, origem: "MANUAL" })),
    ...producoes.map(p => ({ animalId: p.animalId, propriedadeId: p.dia.propriedadeId, data: p.dia.dataOperacional, origem: "MANUAL" })),
    ...reprodutivos,
    ...aplicacoes,
    ...exames,
    ...manejos,
    ...ocorrencias.map((o) => ({ ...o, data: o.inicio })),
    // São fatos de manejo também para crias machos; não integram a guarda de sexo reprodutivo.
    ...colostros.map(c => ({ animalId: c.cria.animalId!, data: c.data, propriedadeId: c.propriedadeId, origem: "MANUAL" })),
    ...pesosParto.map(v => ({ ...v.pesagem, propriedadeId: v.parto.propriedadeId, origem: "MANUAL" })),
  ];
  for (const fato of fatos) {
    const animal = porId.get(fato.animalId)!;
    if (
      fato.data < animal.dataNascimento ||
      (fato.origem !== "IDEAGRI" && fato.data < animal.dataEntrada)
    ) {
      throw new RebanhoError(
        "CONFLITO",
        "A alteração deixa fatos sanitários ou de manejo anteriores ao nascimento/entrada; revise-os antes",
      );
    }
    const baixa = baixas.find((b) => b.animalId === fato.animalId);
    if (
      fato.propriedadeId != null &&
      !locais.some(
        (l) =>
          l.animalId === fato.animalId &&
          l.propriedadeId === fato.propriedadeId &&
          l.desde <= fato.data &&
          (!l.ate ||
            l.ate > fato.data ||
            (baixa?.localizacaoFechadaId === l.id &&
              baixa.data.getTime() === fato.data.getTime())),
      )
    ) {
      throw new RebanhoError(
        "CONFLITO",
        "A alteração muda o sítio de fatos sanitários ou de manejo; revise-os antes",
      );
    }
  }
}

/** Cadastro indevido não serve para ocultar reprodução, gestações ou crias verdadeiras. */
export async function conferirCadastroIndevidoSemFatosTx(
  tx: Prisma.TransactionClient,
  animalId: string,
) {
  const fatos = await Promise.all([
    tx.tentativaReprodutiva.count({ where: { animalId } }),
    tx.avaliacaoReprodutiva.count({ where: { animalId } }),
    tx.partoAnimal.count({ where: { animalId } }),
    tx.criaParto.count({ where: { animalId } }),
    tx.gestacaoAnimal.count({ where: { animalId } }),
    tx.lactacaoAnimal.count({ where: { animalId } }),
    tx.situacaoInicialReprodutiva.count({ where: { animalId } }),
    tx.restricaoReprodutiva.count({ where: { animalId } }),
    tx.participanteIatf.count({ where: { animalId } }),
    tx.participanteVisita.count({ where: { animalId } }),
    tx.participacaoExposicao.count({ where: { animalId } }),
    tx.periodoReprodutivoAnimal.count({ where: { animalId, destinoOrigemId: null, origem: "IDEAGRI" } }),
    tx.participanteProducaoLeite.count({ where: { animalId } }),
    tx.parcelaDestinoLeite.count({ where: { animalId } }),
  ]);
  if (fatos.some(Boolean))
    throw new RebanhoError(
      "CONFLITO",
      "Animal possui histórico reprodutivo ou nascimento vinculado; cadastro indevido não pode ocultar esses fatos",
    );
}

/** Chamador mantém a trava do animal; nunca reclassifica nem remove uma medição. */
export async function conferirFinalidadesComProducaoTx(tx: Prisma.TransactionClient, animalId: string, desde?: Date, ate?: Date) {
  const participantes = await tx.participanteProducaoLeite.findMany({ where: { animalId, excluidoEm: null, ...(desde || ate ? { dia: { dataOperacional: { ...(desde ? { gte: desde } : {}), ...(ate ? { lt: ate } : {}) } } } : {}) }, include: { dia: { select: { dataOperacional: true } } } });
  if (!participantes.length) return;
  const finalidades = await tx.finalidadeAnimal.findMany({ where: { animalId } });
  const baixas = await tx.baixaAnimal.findMany({ where: { animalId, estornadaEm: null } });
  for (const p of participantes) {
    const f = resolverFinalidadeLeite(finalidades, p.dia.dataOperacional, baixas);
    if (!f.elegivel || p.finalidadeId && p.finalidadeId !== f.finalidade.id)
      throw new RebanhoError("CONFLITO", "A alteração da finalidade atinge uma ordenha guardada. Concilie explicitamente a folha e regularize suas confirmações antes de alterar o cadastro", "finalidade");
  }
}
