import { RebanhoError } from "../rebanho/regras.js";
import { contextoAnimalLeite, lactacaoVigenteLeite, type AnimalContextoLeite, type LactacaoContextoLeite } from "./populacao.calc.js";

/** Sugestão para aferições novas. Nunca modifica as origens de uma aferição salva. */
export function preSelecionarOrigensGerais(
  animais: readonly AnimalContextoLeite[],
  lactacoes: readonly LactacaoContextoLeite[],
  propriedadeId: number,
  data: Date,
) {
  const porAnimal = new Map<string, LactacaoContextoLeite[]>();
  for (const lactacao of lactacoes) {
    const proprias = porAnimal.get(lactacao.animalId) ?? [];
    proprias.push(lactacao);
    porAnimal.set(lactacao.animalId, proprias);
  }
  return animais.flatMap(animal => {
    const proprias = porAnimal.get(animal.id) ?? [];
    const vigentes = proprias.filter(l => lactacaoVigenteLeite(l, data));
    if (vigentes.length !== 1) return [];
    const del = Math.floor((data.getTime() - vigentes[0].inicio.getTime()) / 86400000);
    if (del <= 0) return [];
    try {
      // Mesmas evidências de finalidade, sexo, entrada, baixa e sítio da produção.
      contextoAnimalLeite(animal, proprias, propriedadeId, data);
      return [{ animalId: animal.id, brinco: animal.brinco, nome: animal.nome, del }];
    } catch (erro) {
      if (!(erro instanceof RebanhoError)) throw erro;
      return [];
    }
  });
}
