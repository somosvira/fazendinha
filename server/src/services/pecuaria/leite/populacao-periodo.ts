import type { Prisma } from "@prisma/client";
import { contextoAnimalLeite, lactacaoVigenteLeite } from "./populacao.calc.js";
import { resolverFinalidadeLeite } from "./finalidade.calc.js";
import { RebanhoError } from "../rebanho/regras.js";
export type EstadoPopulacaoLeite = "ELEGIVEIS" | "SEM_ANIMAIS_ELEGIVEIS" | "FINALIDADE_PENDENTE";
/** Confere calendário sem transformar falta de folha ou cadastro em zero medido. */
export async function consultarPopulacaoPeriodoLeiteTx(tx: Prisma.TransactionClient, propriedadeId: number, inicio: string, fim: string, animalId?: string) {
  const animais = await tx.animal.findMany({ where: { sexo: "F", ...(animalId ? { id: animalId } : {}),
    localizacoes: { some: { propriedadeId, desde: { lte: new Date(fim) }, OR: [{ ate: null }, { ate: { gte: new Date(inicio) } }] } } },
    include: { destinos: true, localizacoes: true, baixas: { where: { estornadaEm: null } } } });
  const lactacoes = await tx.lactacaoAnimal.findMany({ where: { animalId: { in: animais.map(a => a.id) } } });
  const porAnimal = new Map(animais.map(a => [a.id, lactacoes.filter(l => l.animalId === a.id)]));
  const dias = [];
  for (let t = Date.parse(inicio); t <= Date.parse(fim); t += 86400000) {
    const data = new Date(t), elegiveis: string[] = [], potenciais: string[] = [], pendentes: string[] = [];
    for (const animal of animais) {
      if (animal.dataEntrada > data || animal.dataNascimento > data || animal.baixas.some(b => b.data < data)) continue;
      if (!animal.localizacoes.some(l => l.propriedadeId === propriedadeId && l.desde <= data && (l.ate === null || l.ate > data || animal.baixas.some(b => b.data.getTime() === t && b.localizacaoFechadaId === l.id)))) continue;
      const finalidade = resolverFinalidadeLeite(animal.destinos, data, animal.baixas);
      if (!finalidade.elegivel) {
        if (["FINALIDADE_AUSENTE", "FINALIDADE_CONFLITANTE"].includes(finalidade.codigo)) pendentes.push(animal.id);
        continue;
      }
      const proprias = porAnimal.get(animal.id)!;
      if (!proprias.some(l => lactacaoVigenteLeite(l, data))) {
        // Uma lactação desconhecida pode ser conciliada por inclusão explícita.
        // Sem essa conferência não é possível provar um dia vazio.
        if (!proprias.some(l => l.encerradaEm !== null && l.encerradaEm <= data)) potenciais.push(animal.id);
        continue;
      }
      try { contextoAnimalLeite(animal, proprias, propriedadeId, data); elegiveis.push(animal.id); }
      catch (e) { if (!(e instanceof RebanhoError)) throw e; potenciais.push(animal.id); }
    }
    dias.push({ data: data.toISOString().slice(0, 10), estado: (pendentes.length ? "FINALIDADE_PENDENTE" : elegiveis.length || potenciais.length ? "ELEGIVEIS" : "SEM_ANIMAIS_ELEGIVEIS") as EstadoPopulacaoLeite, elegiveis, potenciais, pendentes });
  }
  return dias;
}
