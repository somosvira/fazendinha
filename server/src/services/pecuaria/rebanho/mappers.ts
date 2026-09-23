import { calcularCategoria, idadeEmMeses, type CategoriaCalculada } from "./categoria.calc.js";
import { normalizarComposicao, rotuloComposicao, type FracaoRaca } from "./composicao.calc.js";

export interface AnimalResumo {
  id: string;
  brinco: string;
  nome: string | null;
  sexo: "F" | "M";
  categoria: CategoriaCalculada;
  idadeMeses: number;
  dataNascimento: string;
  dataEntrada: string;
  origem: "NASCIDO" | "COMPRADO";
  propriedade: { id: number; nome: string } | null;
  lote: { id: string; nome: string } | null;
  aptidao: "LEITE" | "CORTE" | null;
  papelReprodutivo: "NENHUM" | "RECEPTORA" | "DOADORA" | null;
  composicaoRotulo: string;
  ultimoPeso: { kg: number; data: string } | null;
  situacao: "ATIVO" | "SAIU";
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
  partos: number;
  hoje: Date;
  propriedade: { id: number; nome: string } | null;
  lote: { id: string; nome: string } | null;
  destino: { aptidao: "LEITE" | "CORTE"; papelReprodutivo: "NENHUM" | "RECEPTORA" | "DOADORA" } | null;
  composicao: FracaoRaca[];
  ultimoPeso: { pesoKg: number; data: Date } | null;
  situacao: "ATIVO" | "SAIU";
}): AnimalResumo {
  const { animal } = input;
  return {
    id: animal.id,
    brinco: animal.brinco,
    nome: animal.nome,
    sexo: animal.sexo,
    categoria: calcularCategoria({ sexo: animal.sexo, dataNascimento: animal.dataNascimento, partos: input.partos, hoje: input.hoje }),
    idadeMeses: idadeEmMeses(animal.dataNascimento, input.hoje),
    dataNascimento: animal.dataNascimento.toISOString().slice(0, 10),
    dataEntrada: animal.dataEntrada.toISOString().slice(0, 10),
    origem: animal.origem,
    propriedade: input.propriedade,
    lote: input.lote,
    aptidao: input.destino?.aptidao ?? null,
    papelReprodutivo: input.destino?.papelReprodutivo ?? null,
    composicaoRotulo: rotuloComposicao(normalizarComposicao(input.composicao)),
    ultimoPeso: input.ultimoPeso ? { kg: Number(input.ultimoPeso.pesoKg), data: input.ultimoPeso.data.toISOString().slice(0, 10) } : null,
    situacao: input.situacao,
  };
}

export interface AnimalFicha extends AnimalResumo {
  brincoEletronico: string | null;
  sisbov: string | null;
  nascimentoEstimado: boolean;
  partosAntesDaEntrada: number;
  observacao: string | null;
  composicao: FracaoRaca[];
  historicoLocalizacoes: Array<{ id: string; propriedade: { id: number; nome: string } | null; lote: { id: string; nome: string } | null; desde: string; ate: string | null; motivo: string | null }>;
  historicoDestinos: Array<{ id: string; aptidao: "LEITE" | "CORTE"; papelReprodutivo: "NENHUM" | "RECEPTORA" | "DOADORA"; desde: string; ate: string | null }>;
  historicoPesagens: Array<{ id: string; data: string; pesoKg: number; tipo: string; origem: string }>;
  saida: { id: string; data: string; tipo: string; motivo: string | null; observacao: string | null; estornadaEm: string | null; estornoMotivo: string | null } | null;
}

export interface PainelRebanho {
  totalAtivos: number;
  porCategoria: Array<{ categoria: CategoriaCalculada; total: number }>;
  porSitio: Array<{ propriedadeId: number | null; nome: string; total: number }>;
  femeasAtivas: number;
  receptorasAtivas: number;
}

const ORDEM_CATEGORIA: CategoriaCalculada[] = ["BEZERRA", "NOVILHA", "VACA", "BEZERRO", "GARROTE", "TOURO"];

/** Contagens do painel sobre TODO o conjunto filtrado (antes da paginação). */
export function agregarPainel(resumos: AnimalResumo[]): PainelRebanho {
  const ativos = resumos.filter((r) => r.situacao === "ATIVO");
  const cat = new Map<CategoriaCalculada, number>();
  const sitio = new Map<number | null, { nome: string; total: number }>();
  let femeas = 0;
  let receptoras = 0;
  for (const a of ativos) {
    cat.set(a.categoria, (cat.get(a.categoria) ?? 0) + 1);
    const chave = a.propriedade?.id ?? null;
    const atual = sitio.get(chave);
    sitio.set(chave, { nome: a.propriedade?.nome ?? "Sem sítio", total: (atual?.total ?? 0) + 1 });
    if (a.sexo === "F") {
      femeas += 1;
      if (a.papelReprodutivo === "RECEPTORA") receptoras += 1;
    }
  }
  return {
    totalAtivos: ativos.length,
    porCategoria: ORDEM_CATEGORIA.filter((c) => cat.has(c)).map((categoria) => ({ categoria, total: cat.get(categoria)! })),
    porSitio: Array.from(sitio, ([propriedadeId, v]) => ({ propriedadeId, ...v })).sort((a, b) => b.total - a.total),
    femeasAtivas: femeas,
    receptorasAtivas: receptoras,
  };
}

// ---------- auditoria (resumo legível em PT-BR por entidade + ação) ----------

const RESUMOS_AUDITORIA: Record<string, string> = {
  "Animal:CADASTRO": "Cadastro do animal",
  "Animal:EDICAO": "Edição dos dados do animal",
  "ComposicaoRacial:EDICAO": "Composição racial alterada",
  "LocalizacaoAnimal:MOVIMENTACAO": "Movimentação de localização/lote",
  "LocalizacaoAnimal:DESFAZER": "Movimentação de localização desfeita",
  "DestinoAnimal:MUDANCA_DESTINO": "Mudança de destino/aptidão",
  "DestinoAnimal:DESFAZER": "Mudança de destino desfeita",
  "SaidaAnimal:SAIDA": "Saída registrada",
  "SaidaAnimal:ESTORNO": "Saída estornada",
  "Pesagem:REGISTRO": "Pesagem registrada",
  "Pesagem:EDICAO": "Pesagem editada",
  "Pesagem:EXCLUSAO": "Pesagem excluída",
};

/** Resumo legível em PT-BR de uma entrada de auditoria; cai num rótulo genérico para combinações não mapeadas. */
export function resumoAuditoria(entidade: string, acao: string): string {
  return RESUMOS_AUDITORIA[`${entidade}:${acao}`] ?? `${entidade} — ${acao}`;
}
