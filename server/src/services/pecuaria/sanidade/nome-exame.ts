import { TIPO_EXAME_ESCORE_CORPORAL } from "../reproducao/escore-corporal.calc.js";

/** Apresentação do tipo oficial sem alterar nomes ou snapshots persistidos. */
export function nomeExameApresentacao(id: string | null | undefined, nome: string) {
  return id === TIPO_EXAME_ESCORE_CORPORAL ? "Escore de condição corporal (ECC)" : nome;
}

/** Aplica os mesmos aliases ao filtrar os seletores no servidor. */
export function buscaNomeExameOficial(termo: string): boolean {
  const busca = termo.trim().toLocaleLowerCase("pt-BR");
  return !!busca && ["escore corporal", "escore de condição corporal (ecc)", "ecc"].some(nome => nome.includes(busca));
}
