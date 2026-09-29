// Diferença antes/depois de uma entrada de auditoria — cálculo puro, sem I/O.
//
// O mapa `CAMPOS_POR_ENTIDADE` funciona como allowlist: só os campos ali listados entram no
// diff, cada um com rótulo em PT-BR e formatação (data, booleano, enum). Campos técnicos
// (id, criadoEm, atualizadoEm, criadoPorId, animalId) e qualquer objeto aninhado (ex.:
// `historicoAjustado` na edição do animal, ou uma relação incluída) ficam de fora por
// construção — nunca estão no mapa.
//
// `antes` nulo = cadastro: só os campos preenchidos em `depois` aparecem, com `antes: null`.
// `depois` nulo = exclusão: só os campos preenchidos em `antes` aparecem, com `depois: null`.

export interface CampoAlteracao {
  campo: string;
  rotulo: string;
  antes: string | null;
  depois: string | null;
}

type Formatador = (v: unknown) => string | null;

interface CampoConfig {
  rotulo: string;
  formatar?: Formatador;
}

/** dd/mm/aaaa — mesma convenção de `datas.calc.ts` (as datas do domínio são `@db.Date`, sem hora/fuso). */
const data: Formatador = (v) => {
  if (v == null) return null;
  const d = typeof v === "string" ? new Date(v) : v instanceof Date ? v : null;
  if (!d || Number.isNaN(d.getTime())) return String(v);
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getUTCFullYear()}`;
};

/** dd/mm/aaaa HH:mm — para campos com hora de verdade (`estornadaEm`, timestamp completo). */
const dataHora: Formatador = (v) => {
  if (v == null) return null;
  const d = typeof v === "string" ? new Date(v) : v instanceof Date ? v : null;
  if (!d || Number.isNaN(d.getTime())) return String(v);
  const hora = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return `${data(d)} ${hora}`;
};

const booleano: Formatador = (v) => (v == null ? null : v ? "sim" : "não");
// decimais/inteiros formatados como string (o antes/depois vira sempre string|null neste cálculo);
// passa por `Number()` antes de virar texto para normalizar Decimal serializado como "200.00" -> "200"
const numero: Formatador = (v) => (v == null ? null : String(Number(v)));

function enumRotulo(mapa: Record<string, string>): Formatador {
  return (v) => (v == null ? null : mapa[String(v)] ?? String(v));
}

const ROTULO_SEXO: Record<string, string> = { F: "Fêmea", M: "Macho" };
const ROTULO_ORIGEM_ANIMAL: Record<string, string> = { NASCIDO: "Nascido", COMPRADO: "Comprado" };
const ROTULO_APTIDAO: Record<string, string> = { LEITE: "Leite", CORTE: "Corte" };
const ROTULO_PAPEL_REPRODUTIVO: Record<string, string> = { NENHUM: "Nenhum", RECEPTORA: "Receptora", DOADORA: "Doadora" };
const ROTULO_TIPO_PESAGEM: Record<string, string> = { NASCIMENTO: "Nascimento", ENTRADA: "Entrada", DESMAMA: "Desmama", ROTINA: "Rotina", SAIDA: "Saída" };
const ROTULO_ORIGEM_PESAGEM: Record<string, string> = { MANUAL: "Manual", BALANCA: "Balança" };
const ROTULO_TIPO_BAIXA: Record<string, string> = {
  VENDA: "Venda", ABATE: "Abate", MORTE: "Morte", DOACAO: "Doação", EXTRAVIO: "Extravio", CADASTRO_INDEVIDO: "Cadastro indevido",
};
const ROTULO_CLASSE_MOTIVO: Record<string, string> = {
  DESCARTE_VOLUNTARIO: "Descarte voluntário", DESCARTE_INVOLUNTARIO: "Descarte involuntário", MORTE: "Morte",
};
const ROTULO_CRITERIO_PARTOS: Record<string, string> = { QUALQUER: "Qualquer", SEM: "Sem parto", COM: "Com parto" };

/** Campos considerados por entidade — o resto (técnicos, relações aninhadas) fica de fora. */
const CAMPOS_POR_ENTIDADE: Record<string, Record<string, CampoConfig>> = {
  Animal: {
    brinco: { rotulo: "Brinco" },
    nome: { rotulo: "Nome" },
    brincoEletronico: { rotulo: "Brinco eletrônico" },
    sisbov: { rotulo: "SISBOV" },
    sexo: { rotulo: "Sexo", formatar: enumRotulo(ROTULO_SEXO) },
    dataNascimento: { rotulo: "Nascimento", formatar: data },
    nascimentoEstimado: { rotulo: "Nascimento estimado", formatar: booleano },
    origem: { rotulo: "Origem", formatar: enumRotulo(ROTULO_ORIGEM_ANIMAL) },
    dataEntrada: { rotulo: "Entrada", formatar: data },
    partosAntesDaEntrada: { rotulo: "Partos antes da entrada", formatar: numero },
    observacao: { rotulo: "Observação" },
  },
  Lote: {
    nome: { rotulo: "Nome" },
    ativo: { rotulo: "Ativo", formatar: booleano },
    observacao: { rotulo: "Observação" },
  },
  Raca: {
    nome: { rotulo: "Nome" },
    sigla: { rotulo: "Sigla" },
    base: { rotulo: "Base", formatar: booleano },
    ativo: { rotulo: "Ativa", formatar: booleano },
  },
  MotivoBaixa: {
    nome: { rotulo: "Nome" },
    classe: { rotulo: "Classe", formatar: enumRotulo(ROTULO_CLASSE_MOTIVO) },
    ativo: { rotulo: "Ativo", formatar: booleano },
  },
  CategoriaAnimal: {
    nome: { rotulo: "Nome" },
    sexo: { rotulo: "Sexo", formatar: enumRotulo(ROTULO_SEXO) },
    automatica: { rotulo: "Automática", formatar: booleano },
    idadeMinMeses: { rotulo: "Idade mínima (meses)", formatar: numero },
    idadeMaxMeses: { rotulo: "Idade máxima (meses)", formatar: numero },
    partos: { rotulo: "Partos", formatar: enumRotulo(ROTULO_CRITERIO_PARTOS) },
    ordem: { rotulo: "Ordem", formatar: numero },
    ativo: { rotulo: "Ativa", formatar: booleano },
  },
  GenitorExterno: {
    nome: { rotulo: "Nome" },
    sexo: { rotulo: "Sexo", formatar: enumRotulo(ROTULO_SEXO) },
    codigo: { rotulo: "Código" },
    fornecedor: { rotulo: "Fornecedor" },
    observacao: { rotulo: "Observação" },
    ativo: { rotulo: "Ativo", formatar: booleano },
  },
  Pesagem: {
    data: { rotulo: "Data", formatar: data },
    pesoKg: { rotulo: "Peso (kg)", formatar: numero },
    tipo: { rotulo: "Tipo", formatar: enumRotulo(ROTULO_TIPO_PESAGEM) },
    origem: { rotulo: "Origem", formatar: enumRotulo(ROTULO_ORIGEM_PESAGEM) },
    observacao: { rotulo: "Observação" },
  },
  BaixaAnimal: {
    data: { rotulo: "Data", formatar: data },
    tipo: { rotulo: "Tipo", formatar: enumRotulo(ROTULO_TIPO_BAIXA) },
    // só diz que o motivo mudou — resolver o nome exigiria consultar o catálogo, e este cálculo é puro
    motivoId: { rotulo: "Motivo" },
    observacao: { rotulo: "Observação" },
    estornadaEm: { rotulo: "Estornada em", formatar: dataHora },
    estornoMotivo: { rotulo: "Motivo do estorno" },
  },
  DestinoAnimal: {
    aptidao: { rotulo: "Aptidão", formatar: enumRotulo(ROTULO_APTIDAO) },
    papelReprodutivo: { rotulo: "Papel reprodutivo", formatar: enumRotulo(ROTULO_PAPEL_REPRODUTIVO) },
    desde: { rotulo: "Desde", formatar: data },
    ate: { rotulo: "Até", formatar: data },
  },
  LocalizacaoAnimal: {
    desde: { rotulo: "Desde", formatar: data },
    ate: { rotulo: "Até", formatar: data },
    loteId: { rotulo: "Lote" },
    propriedadeId: { rotulo: "Sítio" },
  },
  CategoriaManualAnimal: {
    categoriaId: { rotulo: "Categoria" },
    desde: { rotulo: "Desde", formatar: data },
    ate: { rotulo: "Até", formatar: data },
    motivo: { rotulo: "Motivo" },
    motivoEncerramento: { rotulo: "Motivo do encerramento" },
  },
};

function valorFormatado(config: CampoConfig, v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (config.formatar) return config.formatar(v);
  // sem formatador (ids, texto livre): sempre string — inclui números crus como `propriedadeId`
  return String(v);
}

/** Só objetos simples (a linha do banco gravada na auditoria); `null`/`undefined` = "não existia". */
function comoRegistro(v: unknown): Record<string, unknown> | null {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

/**
 * Diferenças antes/depois de uma entrada de auditoria, já com rótulo em PT-BR e formatadas.
 * Entidade sem mapa configurado (ex.: `Movimentacao`, `ComposicaoRacial`) devolve `[]` — o
 * resumo textual (`resumoAuditoria`) já cobre esses casos.
 */
export function diferencas(entidade: string, antes: unknown, depois: unknown, nomesRacas: Record<string, string> = {}): CampoAlteracao[] {
  const campos = CAMPOS_POR_ENTIDADE[entidade];
  if (!campos) return [];
  const registroAntes = comoRegistro(antes);
  const registroDepois = comoRegistro(depois);
  if (!registroAntes && !registroDepois && entidade !== "GenitorExterno") return [];

  const alteracoes: CampoAlteracao[] = [];
  for (const [campo, config] of Object.entries(campos)) {
    if (!registroAntes && !registroDepois) break;
    if (!registroAntes) {
      // cadastro: só os campos preenchidos em `depois` entram, com antes = null
      const valorDepois = valorFormatado(config, registroDepois![campo]);
      if (valorDepois == null) continue;
      alteracoes.push({ campo, rotulo: config.rotulo, antes: null, depois: valorDepois });
      continue;
    }
    if (!registroDepois) {
      // exclusão: só os campos preenchidos em `antes` entram, com depois = null
      const valorAntes = valorFormatado(config, registroAntes[campo]);
      if (valorAntes == null) continue;
      alteracoes.push({ campo, rotulo: config.rotulo, antes: valorAntes, depois: null });
      continue;
    }
    const valorAntes = valorFormatado(config, registroAntes[campo]);
    const valorDepois = valorFormatado(config, registroDepois[campo]);
    if (valorAntes !== valorDepois) {
      alteracoes.push({ campo, rotulo: config.rotulo, antes: valorAntes, depois: valorDepois });
    }
  }
  if (entidade === "GenitorExterno") {
    const composicaoAntes = composicaoGenitor(antes, nomesRacas);
    const composicaoDepois = composicaoGenitor(depois, nomesRacas);
    if (composicaoAntes.chave !== composicaoDepois.chave) {
      alteracoes.push({ campo: "composicao", rotulo: "Composição racial", antes: composicaoAntes.rotulo, depois: composicaoDepois.rotulo });
    }
  }
  return alteracoes;
}

function composicaoGenitor(valor: unknown, nomesRacas: Record<string, string>) {
  const itens = Array.isArray(valor) ? valor : comoRegistro(valor)?.composicao;
  if (!Array.isArray(itens)) return { chave: "", rotulo: null as string | null };
  const fracoes = itens.flatMap((item) => {
    const linha = comoRegistro(item);
    return typeof linha?.racaId === "string" && typeof linha.fracao64 === "number"
      ? [{ racaId: linha.racaId, fracao64: linha.fracao64 }] : [];
  }).sort((a, b) => a.racaId.localeCompare(b.racaId));
  return {
    chave: fracoes.map((f) => `${f.racaId}:${f.fracao64}`).join("|"),
    rotulo: fracoes.length ? fracoes.map((f) => `${nomesRacas[f.racaId] ?? f.racaId} ${f.fracao64}/64`).join(" · ") : null,
  };
}
