import { readFileSync } from "node:fs";
import type { CasoDouradoAcasalamento } from "./import-acasalamento.js";

const ENV_PATH = "ACASALAMENTO_CASOS_DOURADOS_PATH";
const DIRECOES = new Set(["maior_melhor", "menor_melhor"]);
const STATUS = new Set(["ok", "consanguineo", "restrito", "nao_verificavel"]);

function objeto(valor: unknown): valor is Record<string, unknown> {
  return valor != null && typeof valor === "object" && !Array.isArray(valor);
}

function inteiroPositivo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor > 0;
}

function numeroFinito(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor);
}

function texto(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0;
}

function genealogiaValida(valor: unknown): boolean {
  return objeto(valor)
    && Array.isArray(valor.ancestrais)
    && valor.ancestrais.every((ancestral) => objeto(ancestral)
      && texto(ancestral.chave)
      && numeroFinito(ancestral.grau)
      && ancestral.grau > 0)
    && typeof valor.profundidade === "number"
    && Number.isInteger(valor.profundidade)
    && valor.profundidade >= 0
    && typeof valor.paiConhecido === "boolean";
}

function casoValido(valor: unknown): valor is CasoDouradoAcasalamento {
  if (!objeto(valor)
    || !inteiroPositivo(valor.ideagriId)
    || !texto(valor.nome)
    || !genealogiaValida(valor.femea)
    || !Array.isArray(valor.candidatos)
    || !objeto(valor.config)
    || !Array.isArray(valor.rankingEsperado)
    || !objeto(valor.statusEsperado)) return false;

  if (!valor.candidatos.every((candidato) => objeto(candidato)
    && inteiroPositivo(candidato.id)
    && texto(candidato.nome)
    && genealogiaValida(candidato.genealogia)
    && Array.isArray(candidato.valores)
    && candidato.valores.every((item) => objeto(item)
      && inteiroPositivo(item.indicadorId)
      && numeroFinito(item.valor)))) return false;

  const config = valor.config;
  if (!Array.isArray(config.termos)
    || !config.termos.every((termo) => objeto(termo)
      && inteiroPositivo(termo.indicadorId)
      && numeroFinito(termo.peso)
      && termo.peso > 0
      && typeof termo.direcao === "string"
      && DIRECOES.has(termo.direcao)
      && (termo.minimo === null || numeroFinito(termo.minimo))
      && (termo.maximo === null || numeroFinito(termo.maximo))
      && !(numeroFinito(termo.minimo) && numeroFinito(termo.maximo) && termo.minimo > termo.maximo)
      && typeof termo.obrigatoria === "boolean")
    || !numeroFinito(config.consanguinidadeMax)
    || config.consanguinidadeMax < 0
    || config.consanguinidadeMax > 1
    || typeof config.exigePedigree !== "boolean") return false;

  return valor.rankingEsperado.every(inteiroPositivo)
    && Object.entries(valor.statusEsperado).every(([id, status]) =>
      inteiroPositivo(Number(id)) && typeof status === "string" && STATUS.has(status));
}

export function carregarCasosDouradosAcasalamento(
  casosSinteticos: CasoDouradoAcasalamento[],
  env: Record<string, string | undefined> = process.env,
): CasoDouradoAcasalamento[] {
  if (!(ENV_PATH in env)) return casosSinteticos;

  const caminho = env[ENV_PATH];
  if (caminho == null || caminho.trim() === "") {
    throw new Error(`${ENV_PATH} está vazio`);
  }

  let conteudo: string;
  try {
    conteudo = readFileSync(caminho, "utf8");
  } catch (erro) {
    throw new Error(`não foi possível ler ${ENV_PATH}: ${caminho}`, { cause: erro });
  }

  let json: unknown;
  try {
    json = JSON.parse(conteudo);
  } catch (erro) {
    throw new Error(`JSON inválido em ${ENV_PATH}: ${caminho}`, { cause: erro });
  }
  if (!objeto(json) || !("casosDouradosAcasalamento" in json)) {
    throw new Error("casosDouradosAcasalamento ausente no JSON real");
  }
  const casos = json.casosDouradosAcasalamento;
  if (!Array.isArray(casos) || casos.length === 0) {
    throw new Error("casosDouradosAcasalamento vazio ou inválido no JSON real");
  }
  const indiceInvalido = casos.findIndex((caso) => !casoValido(caso));
  if (indiceInvalido >= 0) {
    throw new Error(`caso dourado inválido no índice ${indiceInvalido}`);
  }
  return casos;
}
