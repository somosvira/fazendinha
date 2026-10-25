import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { RebanhoError } from "../rebanho/regras.js";
import { contextoAnimalLeite, lactacaoVigenteLeite } from "./populacao.calc.js";
import { conferirAnimaisOrigemGeralTx } from "./producao.js";
import { conferirCarenciaProducaoTx } from "./carencia-producao.js";
import { criterioColostroSchema, type CriterioColostro } from "./schemas.js";
import type { ParcelaOrdenhaInput } from "./tanques.schemas.js";

/** Janela civil [parto, parto + dias). D0 sempre pertence à janela. */
export function partoCompativelColostro(data: Date, parto: Date, criterio: CriterioColostro | null) {
  const dias = (data.getTime() - parto.getTime()) / 86_400_000;
  return criterio != null && dias >= 0 && (criterio.tipo === "PRIMEIRA_ORDENHA" || dias < criterio.dias);
}
export function lerCriterioColostro(valor: unknown): CriterioColostro | null {
  return valor == null ? null : criterioColostroSchema.parse(valor);
}
const dataTexto = (data: Date) => data.toISOString().slice(0, 10);
async function partosDasOrigensTx(tx: Prisma.TransactionClient, animalIds: string[], data: Date, propriedadeId: number) {
  const lactacoes = await tx.lactacaoAnimal.findMany({ where: { animalId: { in: animalIds } } });
  const vigentes = lactacoes.filter(l => lactacaoVigenteLeite(l, data));
  const partos = await tx.partoAnimal.findMany({ where: {
    id: { in: vigentes.flatMap(l => l.partoId ? [l.partoId] : []) }, status: "VALIDO", propriedadeId, data: { lte: data },
  } });
  return partos.filter(p => vigentes.filter(l => l.animalId === p.animalId).length === 1 &&
    vigentes.some(l => l.animalId === p.animalId && l.partoId === p.id && l.inicio.getTime() === p.data.getTime()));
}
async function primeirasDeclaradasTx(tx: Prisma.TransactionClient, animalIds: string[], propriaMedicaoId?: string) {
  if (!animalIds.length) return [];
  const anteriores = await tx.medicaoGeralLeite.findMany({ where: {
    natureza: "COLOSTRO", primeiraOrdenhaColostro: true,
    ...(propriaMedicaoId ? { NOT: { id: propriaMedicaoId } } : {}),
    OR: animalIds.map(animalId => ({ animaisOrigem: { array_contains: [animalId] } })),
  }, select: { id: true, criterioColostroSnapshot: true } });
  return anteriores.flatMap(m => {
    const snapshot = z.object({ partos: z.array(z.object({ id: z.string(), animalId: z.string() })) }).safeParse(m.criterioColostroSnapshot);
    return snapshot.success ? snapshot.data.partos : [];
  });
}
export async function consultarContextoParcelasTx(tx: Prisma.TransactionClient, propriedadeId: number, data: Date,
  configuracao: { criterioColostro?: unknown; ordenhas: { posicaoId: string; horario?: string | null }[] }) {
  const animais = await tx.animal.findMany({ where: { sexo: "F", localizacoes: { some: {
    propriedadeId, desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }],
  } } }, include: { destinos: true, localizacoes: { orderBy: [{ desde: "desc" }, { criadoEm: "desc" }] }, baixas: { where: { estornadaEm: null } } }, orderBy: [{ brinco: "asc" }, { id: "asc" }] });
  const lactacoes = await tx.lactacaoAnimal.findMany({ where: { animalId: { in: animais.map(a => a.id) } } });
  const elegiveis = animais.flatMap(a => {
    try { contextoAnimalLeite(a, lactacoes, propriedadeId, data); return [a]; }
    catch (e) { if (!(e instanceof RebanhoError)) throw e; return []; }
  });
  const criterio = lerCriterioColostro(configuracao.criterioColostro);
  const partos = await partosDasOrigensTx(tx, elegiveis.map(a => a.id), data, propriedadeId);
  const declaradas = criterio?.tipo === "PRIMEIRA_ORDENHA" ? await primeirasDeclaradasTx(tx, elegiveis.map(a => a.id)) : [];
  const origensColostro = partos.filter(p => partoCompativelColostro(data, p.data, criterio) && !declaradas.some(d => d.id === p.id && d.animalId === p.animalId)).map(p => {
    const animal = elegiveis.find(a => a.id === p.animalId)!;
    return { animalId: animal.id, brinco: animal.brinco, nome: animal.nome, del: (data.getTime() - p.data.getTime()) / 86_400_000, partoId: p.id };
  });
  const carencias = [];
  for (const o of configuracao.ordenhas) {
    const carencia = await conferirCarenciaProducaoTx(tx, { data, horario: o.horario, animalIds: elegiveis.map(a => a.id) });
    carencias.push({ posicaoId: o.posicaoId, horario: o.horario ?? null, animais: carencia.animais.map(a => {
      const animal = elegiveis.find(e => e.id === a.animalId)!;
      // Doses acompanham o animal. O histórico produtivo não concede leitura
      // sanitária integral fora do sítio atual, mas mantém a restrição comercial.
      return { animalId: a.animalId, estado: a.estado,
        evidencias: animal.localizacoes[0]?.propriedadeId === propriedadeId ? a.evidencias : [],
        brinco: animal.brinco, nome: animal.nome };
    }) });
  }
  return { criterioColostro: criterio, partos: partos.map(p => ({ id: p.id, versao: p.versao, animalId: p.animalId, data: dataTexto(p.data) })), origensColostro, carencias };
}

/** Conferência comum à gravação e à confirmação. Uma declaração não cria fatos clínicos. */
export async function conferirContextoParcelaTx(tx: Prisma.TransactionClient, propriedadeId: number, data: Date,
  horario: string | null, configuracao: { id: string; criterioColostro?: unknown },
  parcela: Pick<ParcelaOrdenhaInput, "natureza" | "animaisOrigem" | "declaracaoDireta" | "primeiraOrdenhaColostro">, propriaMedicaoId?: string) {
  const origens = await conferirAnimaisOrigemGeralTx(tx, propriedadeId, data, parcela.animaisOrigem);
  const carencia = await conferirCarenciaProducaoTx(tx, { data, horario, animalIds: parcela.animaisOrigem });
  const criterio = lerCriterioColostro(configuracao.criterioColostro);
  const partos = parcela.natureza === "COLOSTRO"
    ? await partosDasOrigensTx(tx, parcela.animaisOrigem, data, propriedadeId) : [];
  const direta = Boolean(parcela.declaracaoDireta);
  if (parcela.natureza === "COMERCIAL" && direta)
    throw new RebanhoError("VALIDACAO", "Declaração direta não libera leite comercial");
  if (parcela.natureza === "NAO_COMERCIAL" && !direta && (!parcela.animaisOrigem.length ||
      !carencia.animais.some(a => a.estado !== "SEM_RESTRICAO_REGISTRADA")))
    throw new RebanhoError("VALIDACAO", "Sem carência registrada neste contexto, informe a justificativa do registro direto", "declaracaoDireta");
  if (parcela.natureza === "COLOSTRO" && !direta) {
    if (!parcela.animaisOrigem.length || parcela.animaisOrigem.some(id => !partos.some(p => p.animalId === id && partoCompativelColostro(data, p.data, criterio))))
      throw new RebanhoError("VALIDACAO", "O colostro exige parto e lactação compatíveis com a regra vigente ou justificativa de registro direto", "declaracaoDireta");
    if (criterio?.tipo === "PRIMEIRA_ORDENHA" && parcela.primeiraOrdenhaColostro !== true)
      throw new RebanhoError("VALIDACAO", "Declare explicitamente que esta é a primeira ordenha dos animais de origem", "primeiraOrdenhaColostro");
  }
  if (parcela.natureza === "COLOSTRO" && parcela.primeiraOrdenhaColostro === true && partos.length) {
    const declaradas = await primeirasDeclaradasTx(tx, parcela.animaisOrigem, propriaMedicaoId);
    if (partos.some(p => declaradas.some(d => d.id === p.id && d.animalId === p.animalId)))
      throw new RebanhoError("CONFLITO", "A primeira ordenha deste parto já foi declarada em outra parcela; confira o histórico", "primeiraOrdenhaColostro");
  }
  const snapshot = { configuracaoId: configuracao.id, criterio, partos: partos.map(p => ({ id: p.id, versao: p.versao, animalId: p.animalId, data: dataTexto(p.data) })),
    primeiraOrdenhaColostro: parcela.primeiraOrdenhaColostro ?? null };
  return { origens, carencia, snapshot };
}

/** O mesmo equipamento/recipiente não prova segregação entre naturezas na mesma ordenha. */
export function conferirSegregacaoParcelas(parcelas: readonly { natureza: string; tanqueId?: string | null; recipiente?: string | null }[]) {
  const naturezas = new Map<string, string>();
  for (const p of parcelas) {
    const identidade = p.tanqueId ? `tanque:${p.tanqueId}` : `recipiente:${p.recipiente?.trim().toLocaleLowerCase("pt-BR")}`;
    const anterior = naturezas.get(identidade);
    if (anterior)
      throw new RebanhoError("VALIDACAO", "Cada parcela exige um tanque ou recipiente físico distinto na ordenha; não divida leite misturado por rateio", "parcelas");
    naturezas.set(identidade, p.natureza);
  }
}
