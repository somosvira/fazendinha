// Índice dos domínios instrumentados. Domínio novo = 1 arquivo de registro +
// 1 linha aqui (plantio, corte, cultivo, estoque, equipe, caixinha entram assim).

import type { DominioDef } from "../tipos.js";
import { financeiro } from "./financeiro.js";
import { rebanho } from "./rebanho.js";

export const DOMINIOS: Record<string, DominioDef> = {
  financeiro,
  rebanho,
};

export function obterDominio(nome: string): DominioDef {
  const dom = DOMINIOS[nome];
  if (!dom)
    throw new Error(`Domínio '${nome}' não instrumentado. Disponíveis: ${Object.keys(DOMINIOS).join(", ")}.`);
  return dom;
}
