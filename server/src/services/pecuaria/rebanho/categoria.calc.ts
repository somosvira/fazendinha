// Categoria do animal: calculada na leitura pelas regras da fazenda (CategoriaAnimal), nunca
// gravada em Animal. Uma troca manual aberta (CategoriaManualAnimal) vale sobre o cálculo.
//
// ─── NOTA: DIMENSÕES FUTURAS ────────────────────────────────────────────────────────────────
// O IDEAGRI classifica o animal em VÁRIAS dimensões ao mesmo tempo (procedure SP_CATEGORIA,
// retornos em paralelo), e só a primeira é gravada no animal (ANIMAL.CDCATEGORIA):
//   - básica      (CBASICA)      Em crescimento, Novilha, Vaca, Reprodutor, Boi carreiro, Rufião
//   - produtiva   (CPRODUTIVA)   Mamando, Desmamado(a) [SP_CATEGORIABEZERRO, pela desmama],
//                                Seca, Em lactação     [SP_CATEGORIAPRODUTIVA, pela lactação aberta]
//   - reprodutiva (CREPRODUTIVA) Inseminada/Coberta, Implantada, Gestante, Vazia [SP_REGISTROREPRODUTIVO]
//   - situação da vazia (SREPRODUTIVA) Liberada, Em atraso, Em PEV [SP_SITUACAOREPRODUTIVA]
//   - associação  (CASSOCIACAO)  Doadora, Receptora, Descarte [ANIMALPERIODO] — aqui é o DestinoAnimal
//   - protocolada (CPROTOCOLADA) em protocolo de IATF
//   - lote        (LOTE)         faixa por dias após a desmama, configurável (CATEGORIALOTE)
// Hoje o Terrano tem SÓ a dimensão básica, de propósito: as outras dependem de fatos que ainda
// não existem (desmama, lactação, eventos reprodutivos), e uma segunda dimensão só por idade
// seria redundante com esta. Quando Reprodução e Leite chegarem, cada eixo deve entrar como
// DIMENSÃO SEPARADA — calculada pelos próprios fatos, com seu tipo e seu filtro — e não como
// mais regras desta categoria. (Ex.: uma vaca é "Vaca" + "Em lactação" + "Gestante" + "Receptora".)
// ────────────────────────────────────────────────────────────────────────────────────────────

export type Sexo = "F" | "M";
export type CriterioPartos = "QUALQUER" | "SEM" | "COM";

export interface RegraCategoria {
  id: string;
  nome: string;
  sexo: Sexo;
  /** false = só atribuída manualmente (sem regra) */
  automatica: boolean;
  ativo: boolean;
  ordem: number;
  idadeMinMeses: number | null;
  /** exclusivo: idade < idadeMaxMeses */
  idadeMaxMeses: number | null;
  partos: CriterioPartos;
}

export interface CategoriaRef {
  id: string;
  nome: string;
}

export type OrigemCategoria = "AUTOMATICA" | "MANUAL" | "SEM_CATEGORIA";

export interface AvaliacaoCategoria {
  /** a categoria que vale (manual, se houver; senão a calculada) */
  categoria: CategoriaRef | null;
  origem: OrigemCategoria;
  /** o que as regras dariam (útil quando a manual diverge) */
  calculada: CategoriaRef | null;
}

export interface AnimalParaCategoria {
  sexo: Sexo;
  dataNascimento: Date | string;
  /** hoje: partosAntesDaEntrada; depois, partos registrados */
  partos: number;
}

/** Diferença de calendário em meses completos (não é (hoje-nasc)/30). */
export function idadeEmMeses(nasc: Date | string, hoje: Date | string): number {
  const n = typeof nasc === "string" ? new Date(nasc) : nasc;
  const h = typeof hoje === "string" ? new Date(hoje) : hoje;

  let meses = (h.getUTCFullYear() - n.getUTCFullYear()) * 12 + (h.getUTCMonth() - n.getUTCMonth());
  // se o dia do mês em `hoje` ainda não alcançou o dia do nascimento, o mês corrente não completou
  if (h.getUTCDate() < n.getUTCDate()) meses -= 1;
  return Math.max(0, meses);
}

/** Regras que concorrem no cálculo automático de um sexo, na ordem de avaliação. */
export function regrasAutomaticas(regras: RegraCategoria[], sexo: Sexo): RegraCategoria[] {
  return regras
    .filter((r) => r.ativo && r.automatica && r.sexo === sexo)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
}

export function regraCasa(regra: RegraCategoria, animal: AnimalParaCategoria, hoje: Date | string): boolean {
  if (regra.sexo !== animal.sexo) return false;
  if (regra.partos === "SEM" && animal.partos > 0) return false;
  if (regra.partos === "COM" && animal.partos < 1) return false;
  const meses = idadeEmMeses(animal.dataNascimento, hoje);
  if (regra.idadeMinMeses != null && meses < regra.idadeMinMeses) return false;
  if (regra.idadeMaxMeses != null && meses >= regra.idadeMaxMeses) return false;
  return true;
}

/** Primeira regra automática ativa do sexo que casa (em `ordem`), ou null. */
export function calcularCategoriaAutomatica(animal: AnimalParaCategoria, regras: RegraCategoria[], hoje: Date | string): CategoriaRef | null {
  const regra = regrasAutomaticas(regras, animal.sexo).find((r) => regraCasa(r, animal, hoje));
  return regra ? { id: regra.id, nome: regra.nome } : null;
}

export function avaliarCategoria(animal: AnimalParaCategoria, regras: RegraCategoria[], manual: CategoriaRef | null, hoje: Date | string): AvaliacaoCategoria {
  const calculada = calcularCategoriaAutomatica(animal, regras, hoje);
  if (manual) return { categoria: manual, origem: "MANUAL", calculada };
  return { categoria: calculada, origem: calculada ? "AUTOMATICA" : "SEM_CATEGORIA", calculada };
}

// ---------- validação de uma regra ----------

export interface ErroRegra {
  campo: string;
  mensagem: string;
}

export function validarRegra(regra: Pick<RegraCategoria, "nome" | "automatica" | "idadeMinMeses" | "idadeMaxMeses">): ErroRegra[] {
  const erros: ErroRegra[] = [];
  if (!regra.nome.trim()) erros.push({ campo: "nome", mensagem: "Informe o nome da categoria" });
  if (!regra.automatica) return erros;
  if (regra.idadeMinMeses != null && regra.idadeMinMeses < 0) erros.push({ campo: "idadeMinMeses", mensagem: "Idade mínima não pode ser negativa" });
  if (regra.idadeMaxMeses != null && regra.idadeMaxMeses <= 0) erros.push({ campo: "idadeMaxMeses", mensagem: "Idade máxima deve ser maior que zero" });
  if (regra.idadeMinMeses != null && regra.idadeMaxMeses != null && regra.idadeMinMeses >= regra.idadeMaxMeses) {
    erros.push({ campo: "idadeMaxMeses", mensagem: "A idade máxima deve ser maior que a mínima" });
  }
  return erros;
}

/** Texto curto da regra, ex.: "12 meses ou mais · sem parto", "menos de 12 meses", "manual". */
export function descreverRegra(regra: Pick<RegraCategoria, "automatica" | "idadeMinMeses" | "idadeMaxMeses" | "partos">): string {
  if (!regra.automatica) return "só manual";
  const partes: string[] = [];
  const { idadeMinMeses: min, idadeMaxMeses: max } = regra;
  if (min != null && max != null) partes.push(`${min} a ${max - 1} meses`);
  else if (min != null) partes.push(`${min} meses ou mais`);
  else if (max != null) partes.push(`menos de ${max} meses`);
  if (regra.partos === "SEM") partes.push("sem parto");
  if (regra.partos === "COM") partes.push("com parto");
  return partes.length ? partes.join(" · ") : "qualquer idade";
}

// ---------- categoria como filtro de banco (listagem paginada no Postgres) ----------

const DIA_MS = 86_400_000;

/**
 * Nascimento mais recente com idade ≥ `meses` em `hoje` (UTC, meia-noite). Idade é monótona no
 * nascimento, então parte da data "mesmo dia, `meses` antes" e ajusta usando a própria
 * `idadeEmMeses` — bordas de fim de mês e 29/02 ficam idênticas às do cálculo.
 */
export function nascimentoLimiteParaIdade(hoje: Date | string, meses: number): Date {
  const h = typeof hoje === "string" ? new Date(hoje) : hoje;
  let candidato = Date.UTC(h.getUTCFullYear(), h.getUTCMonth() - meses, h.getUTCDate()) + 4 * DIA_MS;
  while (idadeEmMeses(new Date(candidato), h) < meses) candidato -= DIA_MS;
  return new Date(candidato);
}

/** Condição de uma regra em termos de colunas do Animal. */
export interface CondicaoRegra {
  sexo: Sexo;
  /** true: sem partos; false: ao menos um parto; ausente: indiferente */
  semPartos?: boolean;
  /** nascimento ≤ esta data (idade mínima) */
  nascidoAte?: Date;
  /** nascimento > esta data (idade máxima, exclusiva) */
  nascidoApos?: Date;
}

export function condicaoDaRegra(regra: RegraCategoria, hoje: Date | string): CondicaoRegra {
  return {
    sexo: regra.sexo,
    ...(regra.partos === "SEM" ? { semPartos: true } : regra.partos === "COM" ? { semPartos: false } : {}),
    ...(regra.idadeMinMeses != null ? { nascidoAte: nascimentoLimiteParaIdade(hoje, regra.idadeMinMeses) } : {}),
    ...(regra.idadeMaxMeses != null ? { nascidoApos: nascimentoLimiteParaIdade(hoje, regra.idadeMaxMeses) } : {}),
  };
}

/** Condição sem nenhum critério além do sexo: casa com todo animal daquele sexo. */
export function condicaoTotal(c: CondicaoRegra): boolean {
  return c.semPartos === undefined && !c.nascidoAte && !c.nascidoApos;
}

/**
 * Filtro equivalente a "a categoria que vale é X":
 *   manual aberta = X, OU (sem manual aberta E a regra de X casa E nenhuma regra anterior do sexo casa).
 * `automatica` é null quando X não é calculável (inativa, só manual) ou quando uma regra anterior
 * sem critério já captura todo o sexo.
 */
export interface FiltroCategoria {
  categoriaId: string;
  automatica: { incluir: CondicaoRegra; excluir: CondicaoRegra[] } | null;
}

export function filtroCategoria(categoriaId: string, regras: RegraCategoria[], hoje: Date | string): FiltroCategoria {
  const alvo = regras.find((r) => r.id === categoriaId);
  if (!alvo || !alvo.ativo || !alvo.automatica) return { categoriaId, automatica: null };
  const ordenadas = regrasAutomaticas(regras, alvo.sexo);
  const anteriores = ordenadas.slice(0, ordenadas.findIndex((r) => r.id === alvo.id)).map((r) => condicaoDaRegra(r, hoje));
  if (anteriores.some(condicaoTotal)) return { categoriaId, automatica: null };
  return { categoriaId, automatica: { incluir: condicaoDaRegra(alvo, hoje), excluir: anteriores } };
}
