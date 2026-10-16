import { z } from "zod";
import { confirmarFato } from "../idempotencia.js";
import { auditar, hojeFazendaDate } from "../rebanho/regras.js";
import { conferirIntervaloLactacaoTx, conferirMatrizTx, dia, erro } from "./registros.js";
import { data, motivo, sitio, uuid } from "./schemas.js";

export const lactacaoHistoricaSchema = z.object({
  chave: uuid,
  animalId: uuid,
  propriedadeId: sitio,
  inicio: data,
  encerradaEm: data.nullish(),
  partoId: uuid.nullish(),
  motivo,
}).strict();

/** Complementa somente o intervalo conhecido; não fabrica parto nem produção. */
export function registrarLactacaoHistorica(
  input: z.infer<typeof lactacaoHistoricaSchema>, usuarioId: number | null,
) {
  return confirmarFato(input, usuarioId, "LACTACAO_HISTORICA", async (tx) => {
    const inicio = dia(input.inicio);
    const fim = input.encerradaEm ? dia(input.encerradaEm) : null;
    const hoje = hojeFazendaDate();
    if (inicio > hoje || (fim && (fim < inicio || fim > hoje)))
      erro("Informe um intervalo conhecido até a data atual", "inicio");
    await conferirMatrizTx(tx, input.animalId, input.propriedadeId, inicio);
    const destino = await tx.destinoAnimal.findFirst({ where: {
      animalId: input.animalId, desde: { lte: inicio },
      OR: [{ ate: null }, { ate: { gt: inicio } }],
    } });
    if (destino?.aptidao !== "LEITE")
      erro("Lactação exige aptidão leiteira na data do início", "inicio");
    if (input.partoId) {
      const parto = await tx.partoAnimal.findFirst({ where: {
        id: input.partoId, animalId: input.animalId, status: "VALIDO", data: { lte: inicio },
      } });
      if (!parto) erro("Vincule um parto válido da matriz anterior ao início", "partoId");
    }
    await conferirIntervaloLactacaoTx(tx, input.animalId, inicio, fim);
    const registro = await tx.lactacaoAnimal.create({ data: {
      animalId: input.animalId, propriedadeId: input.propriedadeId,
      inicio, encerradaEm: fim, partoId: input.partoId,
      motivoEncerramento: fim ? input.motivo : null,
      origem: "HISTORICO_INFORMADO", criadoPorId: usuarioId,
    } });
    await auditar(tx, { entidade: "LactacaoAnimal", entidadeId: registro.id,
      animalId: input.animalId, propriedadeId: input.propriedadeId,
      acao: "HISTORICO_INFORMADO", usuarioId, depois: { ...registro, motivo: input.motivo } });
    return registro;
  }, (tx, id) => tx.lactacaoAnimal.findUniqueOrThrow({ where: { id } }));
}
