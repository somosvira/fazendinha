// Índice dos domínios instrumentados. Domínio novo = 1 arquivo de registro +

import type { DominioDef } from "../tipos.js";
import { financeiro } from "./financeiro.js";

export const DOMINIOS: Record<string, DominioDef> = {
  financeiro,
};

export function obterDominio(nome: string): DominioDef {
  const dom = DOMINIOS[nome];
  if (!dom)
    throw new Error(`Domínio '${nome}' não instrumentado. Disponíveis: ${Object.keys(DOMINIOS).join(", ")}.`);
  return dom;
}
