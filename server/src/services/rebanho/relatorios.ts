import type { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import {
  extrairCelulas,
  obterTemplateRelatorio,
  type AcaoTemplateRelatorio,
  type GranularidadeRelatorio,
  type TipoColunaRelatorio,
  type ValorCelulaRelatorio,
} from "./relatorios.catalogo.js";
import type { RelatorioQuery } from "./relatorios.schemas.js";
import { getNumero } from "./parametros.js";
import { sugerirAptidaoAutomatica } from "./aptidao.js";

const LIMITE = 2000;
const GESTACAO_DIAS_PADRAO = 283;
const MS_DIA = 86_400_000;
const dataUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (data?: Date | null) => data ? new Date(data).toISOString().slice(0, 10) : null;
const somarDias = (data: Date, dias: number) => new Date(data.getTime() + dias * MS_DIA);

function filtrarLinhas(query: RelatorioQuery, linhas: LinhaRelatorioDTO[], colunas: ColunaRelatorioDTO[]) {
  if (!query.filtrosColunas?.length) return linhas;
  const indicePorChave = new Map(colunas.map((coluna, indice) => [coluna.chave, { indice, tipo: coluna.tipo }]));
  return linhas.filter((linha) => query.filtrosColunas!.every((filtro) => {
    const coluna = indicePorChave.get(filtro.chave);
    if (!coluna || coluna.tipo !== filtro.tipo) return false;
    const valor = linha.celulas[coluna.indice];
    if (valor == null) return false;
    if (filtro.tipo === "texto") return String(valor).toLocaleLowerCase("pt-BR").includes((filtro.valor ?? "").toLocaleLowerCase("pt-BR"));
    const atual = filtro.tipo === "numero" ? Number(valor) : String(valor);
    const minimo = filtro.tipo === "numero" ? Number(filtro.minimo) : String(filtro.minimo ?? "");
    const maximo = filtro.tipo === "numero" ? Number(filtro.maximo) : String(filtro.maximo ?? "");
    return (filtro.minimo == null || filtro.minimo === "" || atual >= minimo)
      && (filtro.maximo == null || filtro.maximo === "" || atual <= maximo);
  }));
}

export interface ColunaRelatorioDTO {
  chave: string;
  rotulo: string;
  tipo: TipoColunaRelatorio;
}

export interface LinhaRelatorioDTO {
  animalId: number;
  numero: string;
  nome: string | null;
  categoria: string;
  grupo: string | null;
  setor: string | null;
  eventoId: number | null;
  data: string | null;
  celulas: ValorCelulaRelatorio[];
}

export interface ResultadoRelatorioDTO {
  templateId: string;
  titulo: string;
  descricao: string;
  granularidade: GranularidadeRelatorio;
  colunas: ColunaRelatorioDTO[];
  acao: AcaoTemplateRelatorio | null;
  linhas: LinhaRelatorioDTO[];
  total: number;
  truncado: boolean;
  meta: {
    geradoEm: string;
    periodo: { inicio: string | null; fim: string | null };
    propriedadeId: number | null;
  };
}

function filtroAnimal(query: RelatorioQuery, propriedadeId: number | null) {
  return {
    ...(propriedadeId != null ? { propriedadeId } : {}),
    ...(query.status !== "TODOS" ? { status: query.status } : {}),
    ...(query.grupoId != null ? { grupoId: query.grupoId } : {}),
    ...(query.setor ? { setor: query.setor } : {}),
    ...(query.categoria ? { categoria: query.categoria } : {}),
    ...(query.animal ? { OR: [
      { numero: { contains: query.animal, mode: "insensitive" as const } },
      { nome: { contains: query.animal, mode: "insensitive" as const } },
    ] } : {}),
  };
}

function baseResultado(query: RelatorioQuery, propriedadeId: number | null, total: number, linhas: LinhaRelatorioDTO[]): ResultadoRelatorioDTO {
  const template = obterTemplateRelatorio(query.templateId);
  const colunas = template.colunas.map(({ chave, rotulo, tipo }) => ({ chave, rotulo, tipo }));
  const filtradas = filtrarLinhas(query, linhas, colunas);
  const totalFiltrado = query.filtrosColunas?.length ? filtradas.length : total;
  return {
    templateId: template.id,
    titulo: template.titulo,
    descricao: template.descricao,
    granularidade: template.granularidade,
    colunas,
    acao: template.acao,
    linhas: filtradas.slice(0, LIMITE),
    total: totalFiltrado,
    truncado: totalFiltrado > LIMITE,
    meta: {
      geradoEm: new Date().toISOString(),
      periodo: { inicio: query.dataInicio ?? null, fim: query.dataFim ?? null },
      propriedadeId,
    },
  };
}

async function gerarPorEvento(query: RelatorioQuery, propriedadeId: number | null): Promise<ResultadoRelatorioDTO> {
  const template = obterTemplateRelatorio(query.templateId);
  const where: Prisma.EventoReprodutivoWhereInput = {
    tipo: template.tipoEvento,
    data: { gte: dataUtc(query.dataInicio!), lte: dataUtc(query.dataFim!) },
    ...(query.reprodutor ? { reprodutor: { contains: query.reprodutor, mode: "insensitive" } } : {}),
    ...(query.protocolo ? { protocolo: { contains: query.protocolo, mode: "insensitive" } } : {}),
    ...(query.resultado ? { resultado: query.resultado } : {}),
    animal: filtroAnimal(query, propriedadeId),
  };
  const [total, eventos] = await Promise.all([
    prisma.eventoReprodutivo.count({ where }),
    prisma.eventoReprodutivo.findMany({
      where,
      select: {
        id: true,
        animalId: true,
        data: true,
        reprodutor: true,
        protocolo: true,
        resultado: true,
        dtPartoPrevista: true,
        tipoParto: true,
        auxilioParto: true,
        numCrias: true,
        criasVivas: true,
        criasNatimortas: true,
        sexoCria: true,
        motivoSecagem: true,
        observacao: true,
        doadoraNumero: true,
        doadoraNome: true,
        animal: { select: { numero: true, nome: true, categoria: true, setor: true, grupo: { select: { nome: true } } } },
      },
      orderBy: [{ data: "desc" }, { id: "desc" }],
      ...(query.filtrosColunas?.length ? {} : { take: LIMITE }),
    }),
  ]);
  const linhas = eventos.map((evento) => ({
    animalId: evento.animalId,
    numero: evento.animal.numero,
    nome: evento.animal.nome,
    categoria: evento.animal.categoria,
    grupo: evento.animal.grupo?.nome ?? null,
    setor: evento.animal.setor,
    eventoId: evento.id,
    data: iso(evento.data),
    celulas: extrairCelulas(template, evento),
  }));
  return baseResultado(query, propriedadeId, total, linhas);
}

function janelaConcepcao(query: RelatorioQuery, gestacaoDias: number) {
  if (query.templateId !== "partos-previstos") return null;
  return {
    // Previsão do parto = última tentativa + duração configurada do manejo.
    gte: somarDias(dataUtc(query.dataInicio!), -gestacaoDias),
    lte: somarDias(dataUtc(query.dataFim!), -gestacaoDias),
  };
}

async function gerarPorAnimal(query: RelatorioQuery, propriedadeId: number | null): Promise<ResultadoRelatorioDTO> {
  const template = obterTemplateRelatorio(query.templateId);
  const gestacaoDias = query.templateId === "partos-previstos"
    ? await getNumero("GESTACAO_DIAS") ?? GESTACAO_DIAS_PADRAO
    : GESTACAO_DIAS_PADRAO;
  const janela = janelaConcepcao(query, gestacaoDias);
  const where: Prisma.AnimalWhereInput = {
    ...filtroAnimal(query, propriedadeId),
    ...(template.statusReprodutivo || janela ? { resumo: {
      ...(template.statusReprodutivo ? { statusReprodutivo: template.statusReprodutivo } : {}),
      ...(janela ? { ultimaInseminacao: janela } : {}),
    } } : {}),
  };
  const [total, animais] = await Promise.all([
    prisma.animal.count({ where }),
    prisma.animal.findMany({
      where,
      select: {
        id: true,
        numero: true,
        nome: true,
        categoria: true,
        setor: true,
        grupo: { select: { nome: true } },
        resumo: { select: { statusReprodutivo: true, diasGestacao: true, ultimaInseminacao: true, previsaoSecagem: true } },
        pesagens: { orderBy: { data: "desc" }, take: 1, select: { peso: true } },
      },
      orderBy: [{ numero: "asc" }, { id: "asc" }],
      ...(query.filtrosColunas?.length ? {} : { take: LIMITE }),
    }),
  ]);
  const linhas = animais.map((animal) => {
    const resumo = animal.resumo;
    const partoPrevisto = janela && resumo?.ultimaInseminacao ? somarDias(resumo.ultimaInseminacao, gestacaoDias) : null;
    const fonte = { ...(resumo ?? {}), dtPartoPrevista: partoPrevisto };
    return {
      animalId: animal.id,
      numero: animal.numero,
      nome: animal.nome,
      categoria: animal.categoria,
      grupo: animal.grupo?.nome ?? null,
      setor: animal.setor,
      eventoId: null,
      data: iso(partoPrevisto),
      celulas: template.id === "pesagem-corporal-lote"
        ? [animal.pesagens[0]?.peso == null ? null : Number(animal.pesagens[0].peso)]
        : extrairCelulas(template, fonte),
    };
  });
  return baseResultado(query, propriedadeId, total, linhas);
}

async function gerarNovilhasAptas(query: RelatorioQuery, propriedadeId: number | null): Promise<ResultadoRelatorioDTO> {
  const hoje = new Date().toISOString().slice(0, 10);
  const sugestoes = await sugerirAptidaoAutomatica(propriedadeId, hoje);
  const ids = sugestoes.map((item) => item.animalId);
  const animais = ids.length ? await prisma.animal.findMany({
    where: { id: { in: ids }, ...filtroAnimal(query, propriedadeId) },
    select: {
      id: true, numero: true, nome: true, categoria: true, dataNascimento: true, setor: true,
      grupo: { select: { nome: true } },
      pesagens: { orderBy: { data: "desc" }, take: 1, select: { peso: true } },
    },
    orderBy: [{ numero: "asc" }, { id: "asc" }],
  }) : [];
  const motivoPorAnimal = new Map(sugestoes.map((item) => [item.animalId, item.motivo]));
  const hojeMs = dataUtc(hoje).getTime();
  const linhas = animais.map((animal) => ({
    animalId: animal.id,
    numero: animal.numero,
    nome: animal.nome,
    categoria: animal.categoria,
    grupo: animal.grupo?.nome ?? null,
    setor: animal.setor,
    eventoId: null,
    data: hoje,
    celulas: [
      animal.dataNascimento ? Math.floor((hojeMs - animal.dataNascimento.getTime()) / (30.436875 * MS_DIA)) : null,
      animal.pesagens[0]?.peso == null ? null : Number(animal.pesagens[0].peso),
      motivoPorAnimal.get(animal.id) ?? null,
    ],
  }));
  return baseResultado(query, propriedadeId, linhas.length, linhas);
}

export async function gerarRelatorio(query: RelatorioQuery, propriedadeId: number | null): Promise<ResultadoRelatorioDTO> {
  const template = obterTemplateRelatorio(query.templateId);
  if (template.id === "novilhas-aptas") return gerarNovilhasAptas(query, propriedadeId);
  return template.granularidade === "evento"
    ? gerarPorEvento(query, propriedadeId)
    : gerarPorAnimal(query, propriedadeId);
}
