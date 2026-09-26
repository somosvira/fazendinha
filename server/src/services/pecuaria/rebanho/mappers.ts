import type { TipoBaixa, OrigemComposicao } from "@prisma/client";
import { idadeEmMeses, type AvaliacaoCategoria, type CategoriaRef, type OrigemCategoria } from "./categoria.calc.js";
import { normalizarComposicao, rotuloComposicao, type FracaoRaca } from "./composicao.calc.js";
import { gmdEntre } from "./peso.calc.js";

function iso(v: Date | string): string {
  return typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10);
}

export interface AnimalResumo {
  id: string;
  brinco: string;
  nome: string | null;
  sexo: "F" | "M";
  // Dimensão básica apenas; as demais (produtiva, reprodutiva…) entram como campos próprios —
  // ver a nota "DIMENSÕES FUTURAS" em categoria.calc.ts.
  categoria: CategoriaRef | null;
  categoriaOrigem: OrigemCategoria;
  /** o que as regras dariam — difere de `categoria` quando há troca manual */
  categoriaCalculada: CategoriaRef | null;
  idadeMeses: number;
  /** true quando idade/categoria foram avaliadas na data da baixa, não em hoje (animal baixado, K5) */
  idadeNaBaixa: boolean;
  dataNascimento: string;
  dataEntrada: string;
  origem: "NASCIDO" | "COMPRADO";
  propriedade: { id: number; nome: string } | null;
  lote: { id: string; nome: string } | null;
  aptidao: "LEITE" | "CORTE" | null;
  papelReprodutivo: "NENHUM" | "RECEPTORA" | "DOADORA" | null;
  composicaoRotulo: string;
  ultimoPeso: { kg: number; data: string } | null;
  /** GMD entre a última pesagem e a anterior (kg/dia, 3 casas) — `null` sem as duas */
  gmdRecente: number | null;
  /** `desde` da localização aberta — `null` quando o animal não tem uma (baixado) */
  noLocalDesde: string | null;
  /** a baixa que vale (a mais recente não estornada) — `null` quando o animal está ativo */
  baixa: { data: string; tipo: TipoBaixa } | null;
  situacao: "ATIVO" | "BAIXADO";
}

type AnimalBase = {
  id: string;
  brinco: string;
  nome: string | null;
  sexo: "F" | "M";
  dataNascimento: Date;
  dataEntrada: Date;
  origem: "NASCIDO" | "COMPRADO";
};

export function mapearAnimalResumo(input: {
  animal: AnimalBase;
  categoria: AvaliacaoCategoria;
  hoje: Date;
  propriedade: { id: number; nome: string } | null;
  lote: { id: string; nome: string } | null;
  destino: { aptidao: "LEITE" | "CORTE"; papelReprodutivo: "NENHUM" | "RECEPTORA" | "DOADORA" } | null;
  composicao: FracaoRaca[];
  ultimoPeso: { pesoKg: number; data: Date } | null;
  /** pesagem imediatamente anterior à última (para `gmdRecente`) — omitido quando não relevante (ex.: painel) */
  pesagemAnterior?: { pesoKg: number; data: Date } | null;
  situacao: "ATIVO" | "BAIXADO";
  /** ver `AnimalResumo.idadeNaBaixa` — default false (a maioria das chamadas é para animal ativo) */
  idadeNaBaixa?: boolean;
  /** ver `AnimalResumo.noLocalDesde` */
  noLocalDesde?: Date | string | null;
  /** ver `AnimalResumo.baixa` */
  baixa?: { data: Date | string; tipo: TipoBaixa } | null;
}): AnimalResumo {
  const { animal } = input;
  return {
    id: animal.id,
    brinco: animal.brinco,
    nome: animal.nome,
    sexo: animal.sexo,
    categoria: input.categoria.categoria,
    categoriaOrigem: input.categoria.origem,
    categoriaCalculada: input.categoria.calculada,
    idadeMeses: idadeEmMeses(animal.dataNascimento, input.hoje),
    idadeNaBaixa: input.idadeNaBaixa ?? false,
    dataNascimento: animal.dataNascimento.toISOString().slice(0, 10),
    dataEntrada: animal.dataEntrada.toISOString().slice(0, 10),
    origem: animal.origem,
    propriedade: input.propriedade,
    lote: input.lote,
    aptidao: input.destino?.aptidao ?? null,
    papelReprodutivo: input.destino?.papelReprodutivo ?? null,
    composicaoRotulo: rotuloComposicao(normalizarComposicao(input.composicao)),
    ultimoPeso: input.ultimoPeso ? { kg: Number(input.ultimoPeso.pesoKg), data: input.ultimoPeso.data.toISOString().slice(0, 10) } : null,
    gmdRecente: input.ultimoPeso && input.pesagemAnterior
      ? gmdEntre({ data: input.pesagemAnterior.data, pesoKg: Number(input.pesagemAnterior.pesoKg) }, { data: input.ultimoPeso.data, pesoKg: Number(input.ultimoPeso.pesoKg) })
      : null,
    noLocalDesde: input.noLocalDesde != null ? iso(input.noLocalDesde) : null,
    baixa: input.baixa ? { data: iso(input.baixa.data), tipo: input.baixa.tipo } : null,
    situacao: input.situacao,
  };
}

/** Composição na ficha: com o id e a situação da raça, para editar sem reconstruir pela sigla. */
export interface ItemComposicaoFicha extends FracaoRaca {
  racaId: string;
  nome: string;
  racaAtiva: boolean;
  origem: OrigemComposicao;
}

export interface FiliacaoLadoDTO {
  tipo: "ANIMAL" | "EXTERNO";
  id: string;
  nome: string | null;
  sexo?: "F" | "M";
  brinco?: string;
  baixado?: boolean;
  codigo?: string | null;
  fornecedor?: string | null;
}

export interface FichaPeso {
  ultimo: { kg: number; data: string } | null;
  gmdRecente: number | null;
  gmdDesdeEntrada: number | null;
  gmdPeriodo: { dias: number | null; valor: number | null; pesagens: number };
}

export interface HistoricoBaixaFicha {
  id: string;
  data: string;
  tipo: TipoBaixa;
  motivo: { nome: string; classe: string } | null;
  observacao: string | null;
  estornadaEm: string | null;
  estornoMotivo: string | null;
  criadoPor: string | null;
}

export interface AnimalFicha extends AnimalResumo {
  brincoEletronico: string | null;
  sisbov: string | null;
  nascimentoEstimado: boolean;
  partosAntesDaEntrada: number;
  observacao: string | null;
  composicao: ItemComposicaoFicha[];
  historicoLocalizacoes: Array<{ id: string; propriedade: { id: number; nome: string } | null; lote: { id: string; nome: string } | null; desde: string; ate: string | null; motivo: string | null; movimentacaoId: string | null }>;
  historicoDestinos: Array<{ id: string; aptidao: "LEITE" | "CORTE"; papelReprodutivo: "NENHUM" | "RECEPTORA" | "DOADORA"; desde: string; ate: string | null }>;
  historicoPesagens: Array<{ id: string; data: string; pesoKg: number; tipo: string; origem: string; observacao: string | null }>;
  historicoCategoriasManuais: Array<{ id: string; categoria: CategoriaRef; desde: string; ate: string | null; motivo: string; motivoEncerramento: string | null }>;
  /** mantido por compatibilidade — a baixa que vale, igual a `AnimalResumo.baixa` mas com id/motivo/observação */
  baixa: { id: string; data: string; tipo: TipoBaixa; motivo: { nome: string; classe: string } | null; observacao: string | null; estornadaEm: string | null; estornoMotivo: string | null } | null;
  /** todas as baixas do animal, inclusive as estornadas (data desc, criadoEm desc) */
  historicoBaixas: HistoricoBaixaFicha[];
  peso: FichaPeso;
  /** v2 · Genética: mãe e pai, cada um `null` ou um animal nosso ou um genitor externo */
  filiacao: { mae: FiliacaoLadoDTO | null; pai: FiliacaoLadoDTO | null };
  /** quantos filhos (como mãe ou pai) este animal tem registrados */
  filhosCount: number;
}

export interface PainelRebanho {
  totalAtivos: number;
  /** `categoria` nulo = animais sem categoria (nenhuma regra casou) */
  porCategoria: Array<{ categoria: CategoriaRef | null; total: number }>;
  porSitio: Array<{ propriedadeId: number | null; nome: string; total: number }>;
  femeasAtivas: number;
  receptorasAtivas: number;
}

/** Contagens do painel sobre TODO o conjunto filtrado (antes da paginação). `ordem` = posição de cada categoria na configuração. */
export function agregarPainel(resumos: AnimalResumo[], ordem: Map<string, number> = new Map()): PainelRebanho {
  const ativos = resumos.filter((r) => r.situacao === "ATIVO");
  const cat = new Map<string, { categoria: CategoriaRef | null; total: number }>();
  const sitio = new Map<number | null, { nome: string; total: number }>();
  let femeas = 0;
  let receptoras = 0;
  for (const a of ativos) {
    const chave = a.categoria?.id ?? "";
    cat.set(chave, { categoria: a.categoria, total: (cat.get(chave)?.total ?? 0) + 1 });
    const sitioId = a.propriedade?.id ?? null;
    const atual = sitio.get(sitioId);
    sitio.set(sitioId, { nome: a.propriedade?.nome ?? "Sem sítio", total: (atual?.total ?? 0) + 1 });
    if (a.sexo === "F") {
      femeas += 1;
      if (a.papelReprodutivo === "RECEPTORA") receptoras += 1;
    }
  }
  return {
    totalAtivos: ativos.length,
    // na ordem da configuração; "sem categoria" por último
    porCategoria: [...cat.values()].sort((x, y) => (x.categoria ? ordem.get(x.categoria.id) ?? 1e9 : 2e9) - (y.categoria ? ordem.get(y.categoria.id) ?? 1e9 : 2e9)),
    porSitio: Array.from(sitio, ([propriedadeId, v]) => ({ propriedadeId, ...v })).sort((a, b) => b.total - a.total),
    femeasAtivas: femeas,
    receptorasAtivas: receptoras,
  };
}

// ---------- auditoria (resumo legível em PT-BR por entidade + ação) ----------

const RESUMOS_AUDITORIA: Record<string, string> = {
  "Animal:CADASTRO": "Cadastro do animal",
  "Animal:IMPORTACAO": "Importado do IDEAGRI",
  "Animal:EDICAO": "Edição dos dados do animal",
  "Animal:FILIACAO": "Filiação definida",
  "ComposicaoRacial:EDICAO": "Composição racial alterada",
  "GenitorExterno:CADASTRO": "Genitor externo cadastrado",
  "GenitorExterno:EDICAO": "Genitor externo editado",
  "GenitorExterno:COMPOSICAO": "Composição do genitor externo alterada",
  "MaterialGenetico:CADASTRO": "Material genético cadastrado",
  "MaterialGenetico:EDICAO": "Material genético editado",
  "LocalizacaoAnimal:MOVIMENTACAO": "Movimentação de localização/lote",
  "LocalizacaoAnimal:DESFAZER": "Movimentação de localização desfeita",
  "Movimentacao:MOVIMENTACAO": "Movimentação registrada",
  "Movimentacao:DESFAZER": "Movimentação desfeita",
  "DestinoAnimal:MUDANCA_DESTINO": "Mudança de destino/aptidão",
  "DestinoAnimal:DESFAZER": "Mudança de destino desfeita",
  "BaixaAnimal:BAIXA": "Baixa registrada",
  "BaixaAnimal:ESTORNO": "Baixa estornada",
  "Lote:CADASTRO": "Lote cadastrado",
  "Lote:EDICAO": "Lote editado",
  "Raca:CADASTRO": "Raça cadastrada",
  "Raca:EDICAO": "Raça editada",
  "CategoriaAnimal:CADASTRO": "Categoria cadastrada",
  "CategoriaAnimal:EDICAO": "Categoria editada",
  "CategoriaAnimal:REORDENACAO": "Ordem das categorias alterada",
  "CategoriaAnimal:RESTAURAR_PADROES": "Categorias restauradas para o padrão",
  "MotivoBaixa:CADASTRO": "Motivo de baixa cadastrado",
  "MotivoBaixa:EDICAO": "Motivo de baixa editado",
  "Pesagem:REGISTRO": "Pesagem registrada",
  "Pesagem:EDICAO": "Pesagem editada",
  "Pesagem:EXCLUSAO": "Pesagem excluída",
  "CategoriaManualAnimal:DEFINICAO": "Categoria alterada manualmente",
  "CategoriaManualAnimal:REMOCAO": "Categoria voltou ao cálculo automático",
};

/** Resumo legível em PT-BR de uma entrada de auditoria; cai num rótulo genérico para combinações não mapeadas. */
export function resumoAuditoria(entidade: string, acao: string): string {
  return RESUMOS_AUDITORIA[`${entidade}:${acao}`] ?? `${entidade} — ${acao}`;
}
