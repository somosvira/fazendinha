import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { diferencas } from "./auditoria.calc.js";
import { resumoAuditoria } from "./mappers.js";
import type { AuditoriaAnimalQuery } from "./schemas.js";

const ENTIDADES = {
  REBANHO: {
    Animal: "Identificação do animal", Pesagem: "Pesagem", ManejoAnimal: "Manejo",
    BaixaAnimal: "Baixa do animal", ComposicaoRacial: "Composição racial", FinalidadeAnimal: "Finalidade",
    // Alias para leitura, busca e filtros das auditorias anteriores à renomeação.
    DestinoAnimal: "Finalidade",
    LocalizacaoAnimal: "Localização", CategoriaManualAnimal: "Categoria manual", Movimentacao: "Movimentação",
  },
  REPRODUCAO: {
    PeriodoReprodutivoAnimal: "Papel reprodutivo", TentativaReprodutiva: "Tentativa reprodutiva",
    AvaliacaoReprodutiva: "Avaliação reprodutiva", GestacaoAnimal: "Gestação", PartoAnimal: "Parto",
    CriaParto: "Cria do parto", LactacaoAnimal: "Lactação", FornecimentoColostro: "Fornecimento de colostro",
    RestricaoReprodutiva: "Restrição reprodutiva", SituacaoInicialReprodutiva: "Situação inicial reprodutiva",
    ExposicaoTouro: "Exposição ao touro", ParticipanteVisita: "Participação em visita", ParticipanteIatf: "Participação IATF",
    TarefaIatf: "Tarefa IATF", DecisaoElegibilidadeCiclo: "Decisão de elegibilidade",
    VinculoPesagemParto: "Pesagem do parto", DemandaAcompanhamentoReprodutivo: "Demanda de acompanhamento reprodutivo",
    VinculoPoliticaCiclo: "Política reprodutiva aplicada",
  },
  SANIDADE: {
    OcorrenciaSanitaria: "Ocorrência sanitária", AplicacaoProduto: "Aplicação sanitária", ExameAnimal: "Exame",
    ExecucaoProtocoloSanitario: "Execução de protocolo sanitário", TarefaSanitaria: "Tarefa sanitária",
    TarefaProtocolo: "Tarefa de protocolo", ParticipacaoProtocolo: "Participação em protocolo",
  },
  NUTRICAO: { FechamentoConsumo: "Fechamento de consumo nutricional" },
} satisfies Record<string, Record<string, string>>;

type Eixo = keyof typeof ENTIDADES;
const REGISTROS: Record<string, { eixo: Eixo | null; nome: string }> = {
  ...Object.fromEntries(Object.entries(ENTIDADES).flatMap(([eixo, entidades]) => Object.entries(entidades).map(([entidade, nome]) => [entidade, { eixo: eixo as Eixo, nome }]))),
  // Finalidade gerencial não determina o eixo operacional do fato de origem.
  ClassificacaoCustoPecuaria: { eixo: null, nome: "Classificação de custo" },
};
const ACOES: Record<string, string> = {
  CADASTRO: "Cadastro", REGISTRO: "Registro", REGISTRO_MANEJO: "Registro por manejo", CONFIRMACAO: "Confirmação",
  EDICAO: "Alteração", EDITAR: "Edição", EXCLUSAO: "Exclusão", ANULACAO: "Anulação", ESTORNO: "Estorno",
  RESULTADO_CORRIGIDO: "Correção de resultado", ORIGEM_RECONCILIADA: "Reconciliação da origem", CARENCIA_CORRIGIDA: "Correção de carência",
  ENCERRAMENTO: "Encerramento", DESFAZER: "Desfazer", SUBSTITUICAO: "Substituição", FILIACAO: "Filiação",
  COMPOSICAO: "Composição racial", CORRECAO: "Correção", CRIACAO: "Criação", DEFINICAO: "Definição",
  BAIXA: "Baixa", MOVIMENTACAO: "Movimentação", MUDANCA_DESTINO: "Mudança de finalidade",
  PAPEL_REGISTRADO: "Registro de papel", ENCERRAMENTO_PAPEL: "Encerramento de papel", DESFAZER_PAPEL: "Desfazer papel",
  HISTORICO_INFORMADO: "Histórico informado", REGULARIZACAO: "Regularização", REVISAO_PREVISAO: "Revisão da previsão",
  IDENTIFICACAO_COMPLETADA: "Identificação completada", NASCIMENTO_POR_PARTO: "Nascimento por parto",
  PARTICIPACAO_ADICIONADA: "Inclusão de participante", REMOCAO: "Remoção", EXECUCAO: "Execução", REPROGRAMACAO: "Reprogramação",
  VINCULO_POLITICA_CICLO: "Vínculo de política reprodutiva", CLASSIFICADA: "Classificação de custo",
  INICIO_EFETIVO: "Início efetivo",
};
function rotuloAcao(acao: string) {
  if (ACOES[acao]) return ACOES[acao];
  const texto = acao.replaceAll("_", " ").toLocaleLowerCase("pt-BR");
  return texto.charAt(0).toLocaleUpperCase("pt-BR") + texto.slice(1);
}

function snapshot(entidade: string, valor: unknown): unknown {
  // A confirmação nutricional grava { fechamento, itens }; o estorno grava
  // a linha original diretamente. Projetar só o fechamento evita expor custos
  // e a participação de outros animais presentes no snapshot coletivo.
  if (entidade === "FechamentoConsumo" && valor && typeof valor === "object" && "fechamento" in valor) return valor.fechamento;
  return valor;
}

export async function consultarAuditoriaAnimal(animalId: string, filtros: AuditoriaAnimalQuery, verValores: boolean, propriedadeId: number | null = null) {
  return prisma.$transaction(async (tx) => {
    const fechamentos = await tx.fechamentoConsumo.findMany({ where: { participacoes: { some: { animalId } } }, select: { id: true } });
    const base: Prisma.AuditoriaPecuariaWhereInput = { OR: [
      { animalId },
      { entidade: "FechamentoConsumo", entidadeId: { in: fechamentos.map((f) => f.id) } },
    ] };
    const condicoes: Prisma.AuditoriaPecuariaWhereInput[] = [base];
    if (filtros.inicio || filtros.fim) condicoes.push({ em: { ...(filtros.inicio ? { gte: new Date(filtros.inicio) } : {}), ...(filtros.fim ? { lte: new Date(filtros.fim) } : {}) } });
    if (filtros.eixo === "NAO_CLASSIFICADO") condicoes.push({ entidade: { notIn: Object.keys(ENTIDADES).flatMap((e) => Object.keys(ENTIDADES[e as Eixo])) } });
    else if (filtros.eixo) condicoes.push({ entidade: { in: Object.keys(ENTIDADES[filtros.eixo]) } });
    if (filtros.acao) condicoes.push({ acao: filtros.acao });
    if (filtros.responsavel !== undefined) condicoes.push({ usuarioId: filtros.responsavel === "sem" ? null : filtros.responsavel });
    if (filtros.busca) {
      const busca = filtros.busca;
      const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
      const entidades = Object.entries(REGISTROS).filter(([, r]) => normalizar(r.nome).includes(normalizar(busca))).map(([e]) => e);
      // Busca só nas identidades públicas; snapshots e valores financeiros não
      // participam do filtro, nem indiretamente através da contagem.
      condicoes.push({ OR: [
        { entidade: { contains: busca, mode: "insensitive" } }, { entidadeId: { contains: busca, mode: "insensitive" } },
        { entidade: { in: entidades } },
      ] });
    }
    const where: Prisma.AuditoriaPecuariaWhereInput = { AND: condicoes };
    const [total, entradas, opcoes] = await Promise.all([
      tx.auditoriaPecuaria.count({ where }),
      tx.auditoriaPecuaria.findMany({ where, include: { usuario: { select: { nome: true } } },
        orderBy: [{ em: "desc" }, { id: "desc" }], skip: (filtros.page - 1) * filtros.pageSize, take: filtros.pageSize }),
      tx.auditoriaPecuaria.findMany({ where: base, distinct: ["acao", "usuarioId"],
        select: { acao: true, usuarioId: true, usuario: { select: { nome: true } } } }),
    ]);
    const responsaveis = new Map<number, string>();
    for (const o of opcoes) if (o.usuarioId != null && o.usuario) responsaveis.set(o.usuarioId, o.usuario.nome);
    return {
      itens: entradas.map((e) => {
        const justificativa = e.entidade === "ComposicaoRacial" && e.depois && typeof e.depois === "object" && !Array.isArray(e.depois)
          ? e.depois.justificativaExcecao : null;
        const resumo = resumoAuditoria(e.entidade, e.acao);
        const resumoLegivel = REGISTROS[e.entidade] && resumo === `${e.entidade} — ${e.acao}`
          ? `${REGISTROS[e.entidade].nome} · ${rotuloAcao(e.acao)}` : resumo;
        return {
          id: e.id, em: e.em.toISOString(), acao: e.acao, acaoRotulo: rotuloAcao(e.acao),
          eixo: REGISTROS[e.entidade]?.eixo ?? null, registro: REGISTROS[e.entidade]?.nome ?? e.entidade,
          entidade: e.entidade, entidadeId: e.entidadeId, usuarioNome: e.usuario?.nome ?? null,
          resumo: typeof justificativa === "string" ? "Exceção na composição racial" : resumoLegivel,
          alteracoes: [
            ...diferencas(e.entidade, snapshot(e.entidade, e.antes), snapshot(e.entidade, e.depois), {}, verValores && (propriedadeId == null || e.propriedadeId === propriedadeId)),
            ...(typeof justificativa === "string" ? [{ campo: "justificativaExcecao", rotulo: "Justificativa", antes: null, depois: justificativa }] : []),
          ],
        };
      }),
      total,
      filtros: {
        acoes: [...new Set(opcoes.map((o) => o.acao))].sort().map((acao) => ({ valor: acao, rotulo: rotuloAcao(acao) })),
        responsaveis: [...responsaveis].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
        semResponsavel: opcoes.some((o) => o.usuarioId == null),
      },
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
