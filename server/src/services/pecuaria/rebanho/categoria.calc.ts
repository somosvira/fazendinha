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

// ---------- validação da troca manual de categoria (R4) ----------

export interface UltimaCategoriaManual {
  /** início da última troca manual já registrada (aberta ou fechada) */
  desde: Date | string;
  /** null = ainda aberta */
  ate: Date | string | null;
}

/**
 * A nova troca manual não pode começar antes da entrada do animal nem sobrepor uma troca já
 * registrada: se a última estiver aberta, a nova data não pode ficar antes do início dela (é
 * outra troca a partir de hoje, não uma correção retroativa); se estiver fechada, não pode
 * ficar antes do fim dela (senão haveria dois períodos manuais se sobrepondo).
 */
export function validarDataCategoriaManual(input: {
  dataEntrada: Date | string;
  ultima: UltimaCategoriaManual | null;
  data: Date | string;
}): string | null {
  const t = (v: Date | string) => (typeof v === "string" ? new Date(v) : v).getTime();
  if (t(input.data) < t(input.dataEntrada)) return "A data não pode ser anterior à entrada do animal";
  if (input.ultima) {
    const aberta = input.ultima.ate == null;
    const limite = aberta ? input.ultima.desde : input.ultima.ate!;
    if (t(input.data) < t(limite)) {
      return aberta ? "A data não pode ser anterior à troca manual atual" : "A data não pode ser anterior ao fim da última categoria manual";
    }
  }
  return null;
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

/** Critério de partos efetivo: para macho não se aplica (sempre "qualquer"). */
function partosEfetivo(regra: Pick<RegraCategoria, "sexo" | "partos">): CriterioPartos {
  return regra.sexo === "M" ? "QUALQUER" : regra.partos;
}

/**
 * Duas regras se sobrepõem quando algum animal casaria com as duas: ambas ativas e automáticas,
 * mesmo sexo, critérios de parto compatíveis ("qualquer" cruza com tudo; "sem" × "com" não) e
 * faixas de idade [mín, máx) com interseção. A fazenda quer cada animal em exatamente uma
 * categoria — com sobreposição, a ordem decidiria em silêncio e a outra regra "não funcionaria".
 */
export function regrasSeSobrepoem(a: RegraCategoria, b: RegraCategoria): boolean {
  if (a.id === b.id || !a.ativo || !b.ativo || !a.automatica || !b.automatica || a.sexo !== b.sexo) return false;
  const pa = partosEfetivo(a);
  const pb = partosEfetivo(b);
  if (pa !== "QUALQUER" && pb !== "QUALQUER" && pa !== pb) return false;
  const inicio = Math.max(a.idadeMinMeses ?? 0, b.idadeMinMeses ?? 0);
  const fim = Math.min(a.idadeMaxMeses ?? Number.POSITIVE_INFINITY, b.idadeMaxMeses ?? Number.POSITIVE_INFINITY);
  return inicio < fim;
}

/** Primeira regra de `outras` que se sobrepõe a `regra` (na ordem de avaliação), ou null. */
export function sobreposicaoDe(regra: RegraCategoria, outras: RegraCategoria[]): RegraCategoria | null {
  return [...outras].sort((x, y) => x.ordem - y.ordem || x.nome.localeCompare(y.nome)).find((o) => regrasSeSobrepoem(regra, o)) ?? null;
}

/** Todos os pares sobrepostos de uma lista de regras (cada par uma vez). */
export function paresSobrepostos(regras: RegraCategoria[]): Array<[RegraCategoria, RegraCategoria]> {
  const pares: Array<[RegraCategoria, RegraCategoria]> = [];
  for (let i = 0; i < regras.length; i++) {
    for (let j = i + 1; j < regras.length; j++) if (regrasSeSobrepoem(regras[i], regras[j])) pares.push([regras[i], regras[j]]);
  }
  return pares;
}

/** Mensagem PT-BR para a UI, dizendo com qual regra a faixa se cruza. */
export function mensagemSobreposicao(regra: Pick<RegraCategoria, "nome" | "sexo" | "automatica" | "idadeMinMeses" | "idadeMaxMeses" | "partos">, outra: Pick<RegraCategoria, "nome" | "sexo" | "automatica" | "idadeMinMeses" | "idadeMaxMeses" | "partos">): string {
  const sexo = regra.sexo === "F" ? "fêmeas" : "machos";
  return `A faixa de "${regra.nome}" (${descreverRegra({ ...regra, partos: partosEfetivo(regra) })}) se sobrepõe à de "${outra.nome}" (${descreverRegra({ ...outra, partos: partosEfetivo(outra) })}) para ${sexo}. `
    + "Ajuste as idades ou o critério de parto para que cada animal caia em uma só categoria.";
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

/**
 * Filtro "sem categoria" (listagem): o animal não tem manual aberta e NENHUMA regra automática
 * ativa casa com ele. `avaliarCategoria` pega a primeira regra que casa (em `ordem`), mas a ordem
 * só decide QUAL categoria vale — "casa alguma" é a mesma união em qualquer ordem. Por isso aqui
 * entram as condições de todas as regras automáticas ativas (dos dois sexos; `sexo` já faz parte
 * de cada condição, então uma regra sem critério exclui o sexo inteiro).
 */
export function condicoesSemCategoria(regras: RegraCategoria[], hoje: Date | string): CondicaoRegra[] {
  return (["F", "M"] as const).flatMap((sexo) => regrasAutomaticas(regras, sexo).map((r) => condicaoDaRegra(r, hoje)));
}

/**
 * Faixa de idade em meses completos (`idadeEmMeses`), ambos os extremos inclusivos, como faixa de
 * nascimento em `hoje`: idade ≥ min ⇔ nascimento ≤ limite(min); idade ≤ max ⇔ idade < max + 1 ⇔
 * nascimento > limite(max + 1). `min` 0 não restringe nada (a idade nunca é negativa — um
 * nascimento "no futuro" teria idade 0 no cálculo e também passa).
 */
export function faixaNascimentoParaIdade(
  hoje: Date | string,
  idadeMinMeses: number | null | undefined,
  idadeMaxMeses: number | null | undefined,
): { nascidoAte?: Date; nascidoApos?: Date } {
  return {
    ...(idadeMinMeses != null && idadeMinMeses > 0 ? { nascidoAte: nascimentoLimiteParaIdade(hoje, idadeMinMeses) } : {}),
    ...(idadeMaxMeses != null ? { nascidoApos: nascimentoLimiteParaIdade(hoje, idadeMaxMeses + 1) } : {}),
  };
}

/** A idade está na faixa [min, max] (meses completos, extremos inclusivos)? Espelho em memória de `faixaNascimentoParaIdade`. */
export function idadeNaFaixa(idadeMeses: number, idadeMinMeses: number | null | undefined, idadeMaxMeses: number | null | undefined): boolean {
  return (idadeMinMeses == null || idadeMeses >= idadeMinMeses) && (idadeMaxMeses == null || idadeMeses <= idadeMaxMeses);
}
