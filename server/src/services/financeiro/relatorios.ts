/* Relatórios financeiros persistidos — I/O Prisma e storage.
 *
 * Gerar = validar cadastros → registrar PROCESSANDO → montar o snapshot
 * (relatório gerencial filtrado + composição por item) → gravar o PDF →
 * CONCLUIDO. Falha deixa o registro como FALHOU e preserva o rascunho.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { SEM_VINCULO } from "../../lib/ids.js";
import { getStorage } from "../../lib/storage.js";
import { gerarRelatorioGerencial } from "../relatorio-gerencial.js";
import { FinanceiroError } from "./regras.js";
import { comporItens, descreverFiltros, type SnapshotRelatorio } from "./relatorios.calc.js";
import { gerarPdfRelatorio } from "./relatorios.pdf.js";
import { TIPOS_RELATORIO, type ConfiguracaoRelatorioFinanceiro, type RascunhoConfiguracaoRelatorio } from "./relatorios.schemas.js";
import { hashConfirmacao } from "./idempotencia.js";

const json = (valor: unknown) => valor as Prisma.InputJsonValue;
const inicioDoDia = (dia: string) => new Date(`${dia}T00:00:00.000Z`);
const fimDoDia = (dia: string) => new Date(`${dia}T23:59:59.999Z`);

const camposLista = {
  id: true, nome: true, status: true, parametros: true, propriedadeId: true, autorNome: true,
  geradoEm: true, concluidoEm: true, erro: true, propriedade: { select: { nome: true } },
} satisfies Prisma.RelatorioFinanceiroSelect;
type RelatorioLista = Prisma.RelatorioFinanceiroGetPayload<{ select: typeof camposLista }>;

// O autor exibido é o nome registrado na emissão, não o nome atual do usuário.
const mapear = ({ propriedade, autorNome, ...relatorio }: RelatorioLista) => ({ ...relatorio, autor: autorNome, propriedade: propriedade.nome });

export async function listarRelatorios(propriedadeId: number | null) {
  const relatorios = await prisma.relatorioFinanceiro.findMany({
    where: propriedadeId != null ? { propriedadeId } : {},
    orderBy: [{ geradoEm: "desc" }, { id: "desc" }],
    select: camposLista,
  });
  return relatorios.map(mapear);
}

export async function obterRelatorio(id: string, propriedadeId: number | null) {
  const relatorio = await prisma.relatorioFinanceiro.findFirst({
    where: { id, ...(propriedadeId != null ? { propriedadeId } : {}) },
    select: { ...camposLista, snapshot: true },
  });
  if (!relatorio) throw new FinanceiroError("NAO_ENCONTRADO", "Relatório não encontrado");
  const { snapshot, ...resto } = relatorio;
  return { ...mapear(resto), snapshot: snapshot as unknown as SnapshotRelatorio | null };
}

export const obterRascunho = (propriedadeId: number, usuarioId: number) =>
  prisma.rascunhoRelatorioFinanceiro.findUnique({ where: { propriedadeId_criadoPorId: { propriedadeId, criadoPorId: usuarioId } } });

const CONFLITO_RASCUNHO = "O rascunho foi alterado em outra sessão. Recarregue a página antes de continuar.";

/** Concorrência otimista: só grava sobre a versão que o cliente leu. */
export async function salvarRascunho(propriedadeId: number, usuarioId: number, configuracao: RascunhoConfiguracaoRelatorio, versao?: number) {
  const atual = await obterRascunho(propriedadeId, usuarioId);
  if (!atual) {
    if (versao !== undefined) throw new FinanceiroError("CONFLITO", CONFLITO_RASCUNHO);
    try {
      return await prisma.rascunhoRelatorioFinanceiro.create({ data: { propriedadeId, criadoPorId: usuarioId, configuracao: json(configuracao) } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new FinanceiroError("CONFLITO", CONFLITO_RASCUNHO);
      throw e;
    }
  }
  if (versao !== atual.versao) throw new FinanceiroError("CONFLITO", CONFLITO_RASCUNHO);
  const { count } = await prisma.rascunhoRelatorioFinanceiro.updateMany({ where: { id: atual.id, versao }, data: { configuracao: json(configuracao), versao: { increment: 1 } } });
  if (count === 0) throw new FinanceiroError("CONFLITO", CONFLITO_RASCUNHO);
  return prisma.rascunhoRelatorioFinanceiro.findUniqueOrThrow({ where: { id: atual.id } });
}

export const descartarRascunho = (propriedadeId: number, usuarioId: number) =>
  prisma.rascunhoRelatorioFinanceiro.deleteMany({ where: { propriedadeId, criadoPorId: usuarioId } });

/** Cadastros inativos continuam válidos: o relatório pode olhar para o passado. */
async function carregarCadastros(configuracao: ConfiguracaoRelatorioFinanceiro) {
  const semSentinela = (id: string | typeof SEM_VINCULO): id is string => id !== SEM_VINCULO;
  const categoriaIds = configuracao.categoriaIds.filter(semSentinela);
  const centroCustoIds = configuracao.centroCustoIds.filter(semSentinela);
  const parceiroIds = configuracao.parceiroIds.filter(semSentinela);
  const [categorias, centrosCusto, parceiros] = await Promise.all([
    categoriaIds.length ? prisma.categoria.findMany({ where: { id: { in: categoriaIds } }, select: { id: true, nome: true } }) : [],
    centroCustoIds.length ? prisma.centroCusto.findMany({ where: { id: { in: centroCustoIds } }, select: { id: true, nome: true } }) : [],
    parceiroIds.length ? prisma.parceiro.findMany({ where: { id: { in: parceiroIds } }, select: { id: true, nome: true } }) : [],
  ]);
  if (categorias.length !== categoriaIds.length) throw new FinanceiroError("VALIDACAO", "Uma das categorias selecionadas não existe mais", "categoriaIds");
  if (centrosCusto.length !== centroCustoIds.length) throw new FinanceiroError("VALIDACAO", "Um dos centros de custo selecionados não existe mais", "centroCustoIds");
  if (parceiros.length !== parceiroIds.length) throw new FinanceiroError("VALIDACAO", "Um dos parceiros selecionados não existe mais", "parceiroIds");
  return { categorias, centrosCusto, parceiros };
}

export async function gerarRelatorio(propriedadeId: number, usuario: { id: number | null; nome: string }, configuracao: ConfiguracaoRelatorioFinanceiro, versaoRascunho?: number, idReenvio?: string) {
  const filtros = descreverFiltros(configuracao, await carregarCadastros(configuracao));
  // Chamadores internos podem retomar uma emissão interrompida sem duplicar o registro/PDF.
  // A interface mantém o comportamento anterior (uma emissão nova por pedido).
  const existente = idReenvio ? await prisma.relatorioFinanceiro.findFirst({ where: { id: idReenvio }, include: { propriedade: { select: { nome: true } } } }) : null;
  if (existente && (existente.propriedadeId !== propriedadeId || existente.autorId !== usuario.id || hashConfirmacao(existente.parametros) !== hashConfirmacao(configuracao))) {
    throw new FinanceiroError("CONFLITO", "Identificador de emissão utilizado com outro autor, sítio ou configuração.");
  }
  if (existente?.status === "CONCLUIDO") return mapear(existente);
  const criado = existente ?? await prisma.relatorioFinanceiro.create({
    data: { ...(idReenvio ? { id: idReenvio } : {}), nome: configuracao.nome, parametros: json(configuracao), propriedadeId, autorId: usuario.id, autorNome: usuario.nome },
  });
  if (existente) await prisma.relatorioFinanceiro.update({ where: { id: existente.id }, data: { status: "PROCESSANDO", erro: null } });
  try {
    const [gerencial, operacoes, centros] = await Promise.all([
      gerarRelatorioGerencial({ inicio: configuracao.dataInicio, fim: configuracao.dataFim, regime: configuracao.regime }, propriedadeId, configuracao),
      prisma.operacao.findMany({
        where: {
          propriedadeId,
          data: { gte: inicioDoDia(configuracao.dataInicio), lte: fimDoDia(configuracao.dataFim) },
          tipo: { in: configuracao.tipos.length ? configuracao.tipos : [...TIPOS_RELATORIO] },
          ...(configuracao.status.length ? { status: { in: configuracao.status } } : {}),
        },
        include: { itens: { orderBy: { ordem: "asc" } }, centroCusto: { select: { nome: true } }, parceiro: { select: { nome: true } } },
        orderBy: [{ data: "asc" }, { numero: "asc" }],
      }),
      prisma.centroCusto.findMany({ select: { id: true, nome: true } }),
    ]);
    // Nome vivo por id: o snapshot de um item pode estar desatualizado se o
    // centro foi renomeado depois — sem isso, `comporItens` agruparia pelo
    // nome antigo e duplicaria a linha.
    const nomesCentro = new Map(centros.map((c) => [c.id, c.nome]));
    const snapshot: SnapshotRelatorio = {
      versao: 1, nome: configuracao.nome, geradoEm: criado.geradoEm.toISOString(), autor: usuario.nome,
      propriedade: gerencial.meta.propriedade, configuracao, filtros, gerencial, composicao: comporItens(operacoes, configuracao, nomesCentro),
    };
    const storageKey = `${env.STORAGE_NAMESPACE}/relatorios-financeiros/${propriedadeId}/${criado.id}.pdf`;
    await (await getStorage()).putObject({ key: storageKey, body: gerarPdfRelatorio(snapshot), contentType: "application/pdf" });
    const concluido = await prisma.relatorioFinanceiro.update({
      where: { id: criado.id },
      data: { status: "CONCLUIDO", storageKey, snapshot: json(snapshot), concluidoEm: new Date() },
      select: camposLista,
    });
    // Só consome a versão que gerou este documento. Uma edição posterior em
    // outra aba continua disponível para ser retomada.
    if (usuario.id && versaoRascunho) await prisma.rascunhoRelatorioFinanceiro.deleteMany({ where: { propriedadeId, criadoPorId: usuario.id, versao: versaoRascunho } });
    return mapear(concluido);
  } catch (e) {
    console.error("[relatorios-financeiros]", e);
    await prisma.relatorioFinanceiro.update({ where: { id: criado.id }, data: { status: "FALHOU", erro: "Não foi possível montar o relatório. Tente gerar novamente." } });
    throw e;
  }
}

export async function baixarRelatorio(id: string, propriedadeId: number | null) {
  const relatorio = await prisma.relatorioFinanceiro.findFirst({ where: { id, status: "CONCLUIDO", ...(propriedadeId != null ? { propriedadeId } : {}) } });
  if (!relatorio?.storageKey) throw new FinanceiroError("NAO_ENCONTRADO", "Relatório não encontrado");
  const nome = `${relatorio.nome.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").trim() || "relatorio"}.pdf`;
  return { nome, buffer: await (await getStorage()).getObjectBuffer({ key: relatorio.storageKey }) };
}
