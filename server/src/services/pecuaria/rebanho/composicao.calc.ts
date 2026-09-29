// Composição racial em 64 avos: parse de textos do IDEAGRI, normalização, validação e herança.

export interface FracaoRaca {
  sigla: string;
  fracao64: number;
}

/** Junta a herança fixa à parcela que ainda não se conhece, sem duplicar a raça. */
export function juntarComposicao(herdada: FracaoRaca[], informada: FracaoRaca[]): FracaoRaca[] {
  return normalizarComposicao([...herdada, ...informada]);
}

/** A entrada completa nunca pode reduzir a parcela conhecida pelo pedigree. */
export function composicaoRespeitaHerdanca(itens: FracaoRaca[], herdada: FracaoRaca[]): boolean {
  const porRaca = new Map(itens.map((item) => [item.sigla, item.fracao64]));
  return herdada.every((item) => (porRaca.get(item.sigla) ?? 0) >= item.fracao64);
}

export interface ErroValidacao {
  campo: string;
  mensagem: string;
}

const MAPA_NOME_SIGLA: Record<string, string> = {
  NELORE: "NE",
  "HOLANDÊS": "HO",
  HOLANDES: "HO",
  "GIR LEITEIRO": "GO",
  GIROLANDO: "GL",
};

function resolverSigla(texto: string): string {
  const chave = texto.trim().toUpperCase();
  return MAPA_NOME_SIGLA[chave] ?? chave;
}

/**
 * Parseia textos como "3/4 HO, GO" ou "Nelore" em frações de 64 avos.
 * O componente sem fração explícita (no máximo um, e deve ser o último) leva o restante até 64.
 */
export function parseGrauSangue(texto: string): FracaoRaca[] {
  const partes = texto
    .split(",")
    .map((parte) => parte.trim())
    .filter(Boolean);
  if (partes.length === 0) return [];

  const resultado: FracaoRaca[] = [];
  const indicesSemFracao: number[] = [];
  let usados = 0;

  partes.forEach((parte, indice) => {
    const match = parte.match(/^(\d+)\s*\/\s*(\d+)\s+(.+)$/);
    if (match) {
      const [, numerador, denominador, nomeOuSigla] = match;
      const fracao64 = Math.round((Number(numerador) / Number(denominador)) * 64);
      resultado.push({ sigla: resolverSigla(nomeOuSigla), fracao64 });
      usados += fracao64;
    } else {
      resultado.push({ sigla: resolverSigla(parte), fracao64: 0 });
      indicesSemFracao.push(indice);
    }
  });

  if (indicesSemFracao.length > 0) {
    // o restante vai para o último componente sem fração declarada
    const ultimo = indicesSemFracao[indicesSemFracao.length - 1];
    resultado[ultimo].fracao64 = Math.max(0, 64 - usados);
  }

  return resultado;
}

/** Soma siglas repetidas, reduz o maior se a soma passar de 64, remove zeros e ordena desc. */
export function normalizarComposicao(itens: FracaoRaca[]): FracaoRaca[] {
  const mapa = new Map<string, number>();
  for (const item of itens) {
    mapa.set(item.sigla, (mapa.get(item.sigla) ?? 0) + item.fracao64);
  }

  let lista = Array.from(mapa, ([sigla, fracao64]) => ({ sigla, fracao64 }));
  const soma = lista.reduce((total, item) => total + item.fracao64, 0);

  if (soma > 64 && lista.length > 0) {
    lista = [...lista].sort((a, b) => b.fracao64 - a.fracao64);
    lista[0] = { ...lista[0], fracao64: lista[0].fracao64 - (soma - 64) };
  }

  return lista.filter((item) => item.fracao64 > 0).sort((a, b) => b.fracao64 - a.fracao64);
}

export function validarComposicao(itens: FracaoRaca[]): ErroValidacao[] {
  const erros: ErroValidacao[] = [];

  const siglasVistas = new Set<string>();
  for (const item of itens) {
    if (item.fracao64 < 1 || item.fracao64 > 64) {
      erros.push({ campo: "fracao64", mensagem: `Fração de ${item.sigla} deve estar entre 1 e 64` });
    }
    if (siglasVistas.has(item.sigla)) {
      erros.push({ campo: "racaId", mensagem: `Raça ${item.sigla} informada mais de uma vez` });
    }
    siglasVistas.add(item.sigla);
  }

  const soma = itens.reduce((total, item) => total + item.fracao64, 0);
  if (soma > 64) {
    erros.push({ campo: "fracao64", mensagem: "Soma das frações não pode passar de 64" });
  }

  return erros;
}

/**
 * Composição do filho = média (mãe, pai) por sigla, em 64 avos.
 * Arredondamento por "maiores restos": soma-se as partes inteiras e distribui-se a diferença
 * até o total-alvo (arredondado da soma das médias) para as siglas com maior resto fracionário,
 * preservando a soma total do filho. Ausência de raça = "desconhecida" (contribui 0).
 */
export function calcularComposicaoFilho(mae: FracaoRaca[], pai: FracaoRaca[]): FracaoRaca[] {
  const mapaMae = new Map(mae.map((item) => [item.sigla, item.fracao64]));
  const mapaPai = new Map(pai.map((item) => [item.sigla, item.fracao64]));
  const siglas = new Set([...mapaMae.keys(), ...mapaPai.keys()]);

  const somaMae = mae.reduce((total, item) => total + item.fracao64, 0);
  const somaPai = pai.reduce((total, item) => total + item.fracao64, 0);
  const totalAlvo = Math.round((somaMae + somaPai) / 2);

  const brutos = Array.from(siglas, (sigla) => {
    const valor = ((mapaMae.get(sigla) ?? 0) + (mapaPai.get(sigla) ?? 0)) / 2;
    return { sigla, base: Math.floor(valor), resto: valor - Math.floor(valor) };
  });

  const somaBase = brutos.reduce((total, item) => total + item.base, 0);
  let falta = totalAlvo - somaBase;

  const porResto = [...brutos].sort((a, b) => b.resto - a.resto);
  const resultado = new Map(brutos.map((item) => [item.sigla, item.base]));
  for (let i = 0; i < porResto.length && falta > 0; i += 1) {
    resultado.set(porResto[i].sigla, (resultado.get(porResto[i].sigla) ?? 0) + 1);
    falta -= 1;
  }

  return normalizarComposicao(Array.from(resultado, ([sigla, fracao64]) => ({ sigla, fracao64 })));
}

function fracaoReduzida(fracao64: number): string {
  if (fracao64 <= 0) return "0";
  const mdc = (a: number, b: number): number => (b === 0 ? a : mdc(b, a % b));
  const divisor = mdc(fracao64, 64);
  return `${fracao64 / divisor}/${64 / divisor}`;
}

export function rotuloComposicao(itens: FracaoRaca[]): string {
  if (!itens || itens.length === 0) return "Desconhecida";
  const ordenado = [...itens].sort((a, b) => b.fracao64 - a.fracao64);
  return ordenado.map((item) => `${fracaoReduzida(item.fracao64)} ${item.sigla}`).join(", ");
}
