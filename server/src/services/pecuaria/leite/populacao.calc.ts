import { exigirFinalidadeLeite, type FinalidadeContextoLeite, type BaixaFinalidadeContextoLeite } from "./finalidade.calc.js";
import { RebanhoError } from "../rebanho/regras.js";

export interface AnimalContextoLeite {
  id: string; sexo: string; brinco: string; nome: string | null;
  dataNascimento: Date; dataEntrada: Date;
  destinos: FinalidadeContextoLeite[];
  localizacoes: { id: string; propriedadeId: number; desde: Date; ate: Date | null }[];
  baixas: (BaixaFinalidadeContextoLeite & { localizacaoFechadaId: string | null })[];
}
export interface LactacaoContextoLeite {
  id: string; animalId: string; inicio: Date; encerradaEm: Date | null;
}
export function lactacaoVigenteLeite(lactacao: LactacaoContextoLeite, data: Date): boolean {
  return lactacao.inicio <= data && (lactacao.encerradaEm === null || lactacao.encerradaEm > data);
}
/** Ausência simples admite conciliação explícita; secagem comprovada exige corrigir a origem. */
export function contextoAnimalLeite(animal: AnimalContextoLeite, lactacoes: readonly LactacaoContextoLeite[], propriedadeId: number, data: Date) {
  if (animal.sexo !== "F") throw new RebanhoError("VALIDACAO", "A produção individual exige uma fêmea", "animalId");
  if (animal.dataNascimento > data || animal.dataEntrada > data)
    throw new RebanhoError("VALIDACAO", "A produção não pode anteceder o nascimento ou a entrada", "dataOperacional");
  const baixa = animal.baixas.find(b => b.data < data);
  if (baixa) throw new RebanhoError("CONFLITO", "A produção não pode ocorrer após a baixa do animal");
  const locais = animal.localizacoes.filter(l => l.desde <= data && (l.ate === null || l.ate > data ||
    animal.baixas.some(b => b.data.getTime() === data.getTime() && b.localizacaoFechadaId === l.id)));
  if (locais.length !== 1 || locais[0].propriedadeId !== propriedadeId)
    throw new RebanhoError("CONFLITO", "A localização histórica do animal não comprova este sítio na data", "animalId");
  const finalidade = exigirFinalidadeLeite(animal.destinos, data, animal.baixas);
  const proprias = lactacoes.filter(l => l.animalId === animal.id);
  const vigentes = proprias.filter(l => lactacaoVigenteLeite(l, data));
  if (vigentes.length > 1) throw new RebanhoError("CONFLITO", "Há lactações sobrepostas; concilie o histórico antes de medir");
  if (!vigentes.length && proprias.some(l => l.encerradaEm !== null && l.encerradaEm <= data))
    throw new RebanhoError("CONFLITO", "Há lactação explicitamente encerrada nesta data; concilie a lactação antes de medir");
  return { ...finalidade, animalId: animal.id, brinco: animal.brinco, nome: animal.nome, localizacaoId: locais[0].id,
    lactacaoId: vigentes[0]?.id ?? null, pendencias: vigentes.length ? [] : ["LACTACAO_NAO_INFORMADA"] };
}
