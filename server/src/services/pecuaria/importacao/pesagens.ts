import { Prisma } from "@prisma/client";
import { z } from "zod";
import { registrarPesagemTx } from "../rebanho/animais.js";
import { validarDataPesagem } from "../rebanho/datas.calc.js";
import { RebanhoError, traduzirConflitoUnico, travarAnimais } from "../rebanho/regras.js";
import { dataNaoFutura, pesagemSchema } from "../rebanho/schemas.js";

type Tx = Prisma.TransactionClient;
const contextoHistoricoAnimalSchema = z.object({
  animalId: z.string().uuid(),
  data: dataNaoFutura,
  contexto: z.enum(["INTERNO", "EXTERNO"]),
  propriedadeId: z.number().int().positive().max(2_147_483_647).nullable(),
  evidencia: z.string().trim().min(5).max(1000),
});
export type ContextoHistoricoAnimalInput = z.infer<typeof contextoHistoricoAnimalSchema>;

export const pesagemHistoricaSchema = pesagemSchema.innerType().extend({
  ...contextoHistoricoAnimalSchema.shape,
  origem: z.enum(["MANUAL", "BALANCA"]),
  precisao: z.enum(["MEDIDO", "ESTIMADO", "INFORMADO", "NAO_INFORMADO"]),
  bancoOrigem: z.string().trim().min(1).max(120),
  chaveOrigem: z.string().trim().min(1).max(200),
  observacao: z.string().trim().max(500).nullable().optional().default(null),
}).strict().refine(dados => dados.origem !== "BALANCA" || !["ESTIMADO", "INFORMADO"].includes(dados.precisao), {
  path: ["precisao"], message: "Estimativa ou peso informado não é aferição por balança",
});
export type PesagemHistoricaInput = z.input<typeof pesagemHistoricaSchema>;
export type DadosPesagemHistorica = z.output<typeof pesagemHistoricaSchema>;
export interface PreviaPesagemHistorica {
  acao: "CRIAR" | "REUTILIZAR";
  dados: DadosPesagemHistorica;
  referencia: string;
  pesagemId: string | null;
}

async function exigirAutorTx(tx: Tx, usuarioId: number) {
  if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0 || !await tx.usuario.findUnique({ where: { id: usuarioId }, select: { id: true } }))
    throw new RebanhoError("VALIDACAO", "Importação histórica exige usuário real identificado.", "usuarioId");
}

/** Valida o contexto na data, sem atribuir a localização de hoje nem alterar a
 * entrada. Chamadores de escrita devem obter a trava do animal antes da leitura. */
export async function validarContextoHistoricoAnimalTx(tx: Tx, input: ContextoHistoricoAnimalInput) {
  const dados = contextoHistoricoAnimalSchema.strict().parse(input);
  if (dados.contexto === "EXTERNO" && dados.propriedadeId !== null)
    throw new RebanhoError("VALIDACAO", "Fato externo não pode receber sítio interno.", "propriedadeId");
  if (dados.contexto === "INTERNO" && dados.propriedadeId === null)
    throw new RebanhoError("VALIDACAO", "Informe o sítio comprovado na data do fato.", "propriedadeId");
  const animal = await tx.animal.findUnique({ where: { id: dados.animalId } });
  if (!animal) throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado");
  const baixa = await tx.baixaAnimal.findFirst({ where: { animalId: dados.animalId, estornadaEm: null } });
  const erroData = validarDataPesagem({ dataNascimento: animal.dataNascimento, dataBaixa: baixa?.data ?? null, dataPesagem: dados.data })[0];
  if (erroData) throw new RebanhoError("VALIDACAO", erroData.mensagem.replace("Data da pesagem", "Data do fato"), erroData.campo);
  const data = new Date(dados.data);
  if (dados.contexto === "INTERNO" && data < animal.dataEntrada)
    throw new RebanhoError("VALIDACAO", "Fato interno não pode anteceder a entrada do animal.", "data");
  const locais = await tx.localizacaoAnimal.findMany({
    where: {
      animalId: dados.animalId, desde: { lte: data },
      OR: [
        { ate: null }, { ate: { gt: data } },
        ...(baixa && baixa.data.getTime() === data.getTime() && baixa.localizacaoFechadaId ? [{ id: baixa.localizacaoFechadaId }] : []),
      ],
    },
    select: { id: true, propriedadeId: true },
  });
  if (dados.contexto === "EXTERNO" && locais.length)
    throw new RebanhoError("VALIDACAO", "O fato externo contradiz localização interna registrada na data.", "contexto");
  if (dados.contexto === "INTERNO" && (locais.length !== 1 || locais[0].propriedadeId !== dados.propriedadeId))
    throw new RebanhoError("VALIDACAO", "A localização na data não comprova um único sítio compatível; reconcilie o histórico.", "propriedadeId");
  return { animalId: dados.animalId, data: dados.data, contexto: dados.contexto, propriedadeId: dados.propriedadeId };
}

const snapshotSchema = z.object({ dados: pesagemHistoricaSchema, usuarioId: z.number().int().positive(), registradaEm: z.string().datetime() });

/** Prévia não grava, não trava e não abre transação. O executor repete esta
 * conferência sob a trava antes de chamar o núcleo único de pesagem. */
export async function prepararPesagemHistoricaTx(tx: Tx, input: PesagemHistoricaInput, usuarioId: number): Promise<PreviaPesagemHistorica> {
  const dados = pesagemHistoricaSchema.parse(input);
  await exigirAutorTx(tx, usuarioId);
  const referencia = JSON.stringify([dados.bancoOrigem, dados.chaveOrigem]);
  const existente = await tx.pesagem.findUnique({ where: { referenciaHistorica: referencia } });
  if (existente) {
    const snapshot = snapshotSchema.safeParse(existente.provenienciaHistoricaSnapshot);
    if (!snapshot.success || existente.animalId !== dados.animalId || existente.criadoPorId !== usuarioId || snapshot.data.usuarioId !== usuarioId || JSON.stringify(snapshot.data.dados) !== JSON.stringify(dados))
      throw new RebanhoError("CONFLITO", "Origem da pesagem já registrada com dados ou autoria diferentes; reconcilie o registro existente.", "chaveOrigem");
    return { acao: "REUTILIZAR", dados, referencia, pesagemId: existente.id };
  }
  await validarContextoHistoricoAnimalTx(tx, { animalId: dados.animalId, data: dados.data, contexto: dados.contexto, propriedadeId: dados.propriedadeId, evidencia: dados.evidencia });
  return { acao: "CRIAR", dados, referencia, pesagemId: null };
}

/** A transação pertence ao importador chamador. Não cria outro motor de escrita,
 * não muda a entrada e não corrige fatos existentes silenciosamente. */
export async function registrarPesagemHistoricaTx(tx: Tx, input: PesagemHistoricaInput, usuarioId: number): Promise<{ id: string }> {
  const dados = pesagemHistoricaSchema.parse(input);
  await travarAnimais(tx, [dados.animalId]);
  const previa = await prepararPesagemHistoricaTx(tx, dados, usuarioId);
  if (previa.acao === "REUTILIZAR" && previa.pesagemId) return { id: previa.pesagemId };
  const snapshot = JSON.parse(JSON.stringify({ dados: previa.dados, usuarioId, registradaEm: new Date().toISOString() })) as Prisma.InputJsonValue;
  try {
    const criada = await registrarPesagemTx(tx, {
      animalId: dados.animalId, data: dados.data, pesoKg: dados.pesoKg, tipo: dados.tipo,
      origem: dados.origem, precisao: dados.precisao, observacao: dados.observacao,
    }, usuarioId, { referencia: previa.referencia, contexto: dados.contexto, propriedadeId: dados.propriedadeId, snapshot });
    return { id: criada.id };
  } catch (erro) {
    traduzirConflitoUnico(erro, { referenciaHistorica: "Origem da pesagem já registrada por outra operação; reconcilie o registro existente." });
  }
}
