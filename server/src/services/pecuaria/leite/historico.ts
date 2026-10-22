import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { hojeFazendaDate, RebanhoError } from "../rebanho/regras.js";
import { diasCalendarioContexto } from "../reproducao/contexto-animal.calc.js";
import { carenciaAnimalTx } from "../sanidade/aplicacoes.js";
import { conferirSitioLeiteTx } from "./configuracoes.js";
import { evidenciaFinalidadeLeite } from "./finalidade.calc.js";
import { lactacaoVigenteLeite } from "./populacao.calc.js";
import { resumirProducao } from "./producao.calc.js";
import { consultarHistoricoProdutivoSchema, type ConsultaHistoricoProdutivo } from "./historico.schemas.js";
import type { ContextoCarenciaLeiteDTO, DiaHistoricoProdutivoDTO, HistoricoProdutivoLeiteDTO } from "./historico.contratos.js";
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const texto = (d: Date) => d.toISOString().slice(0, 10);
const incluirParticipante = {
  dia: { include: { sessoes: { orderBy: { ordem: "asc" } } } }, medicoes: true,
  lactacao: { select: { id: true, animalId: true, inicio: true, encerradaEm: true } },
} as const;
type Participante = Prisma.ParticipanteProducaoLeiteGetPayload<{ include: typeof incluirParticipante }>;
function diaDTO(p: Participante): DiaHistoricoProdutivoDTO {
  const medicoes = p.dia.sessoes.map(s => {
    const m = p.medicoes.find(m => m.sessaoId === s.id);
    return { id: m?.id ?? null, posicaoId: s.posicaoId, nomeOrdenha: s.nome,
      estado: (m?.estado ?? "PENDENTE") as "MEDIDO" | "NAO_ORDENHADO" | "PENDENTE", litros: m?.litros?.toNumber() ?? null, motivo: m?.motivo ?? null };
  });
  const l = p.lactacao;
  return { finalidade: evidenciaFinalidadeLeite(p, texto(p.dia.dataOperacional)), participanteId: p.id, dataOperacional: texto(p.dia.dataOperacional),
    lactacao: l ? { id: l.id, inicio: texto(l.inicio), encerradaEm: l.encerradaEm ? texto(l.encerradaEm) : null } : null,
    del: l && l.animalId === p.animalId && lactacaoVigenteLeite(l, p.dia.dataOperacional) ? diasCalendarioContexto(l.inicio, p.dia.dataOperacional) : null,
    convencaoDel: "D0", excluidoEm: p.excluidoEm?.toISOString() ?? null, motivoExclusao: p.motivoExclusao, medicoes, totais: resumirProducao(medicoes) };
}
export async function consultarHistoricoProdutivoTx(tx: Prisma.TransactionClient, propriedadeId: number, animalId: string, filtro: ConsultaHistoricoProdutivo): Promise<HistoricoProdutivoLeiteDTO> {
  filtro = consultarHistoricoProdutivoSchema.parse(filtro);
  const fim = filtro.fim ?? texto(hojeFazendaDate());
  const inicioPadrao = dia(fim); inicioPadrao.setUTCDate(inicioPadrao.getUTCDate() - 29);
  const inicio = filtro.inicio ?? texto(inicioPadrao);
  consultarHistoricoProdutivoSchema.parse({ ...filtro, inicio, fim });
  if (dia(fim) > hojeFazendaDate()) throw new RebanhoError("VALIDACAO", "O histórico deve terminar até hoje", "fim");
  await conferirSitioLeiteTx(tx, propriedadeId);
  const animal = await tx.animal.findFirst({ where: { id: animalId, localizacoes: { some: { propriedadeId } } }, select: { id: true, brinco: true, nome: true } });
  if (!animal) throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado neste sítio");
  // Uma vaca e no máximo 366 dias: a soma inclui todo o período antes da paginação.
  // Não criar folhas virtuais nem estimar litros para datas sem participação persistida.
  const participantes = await tx.participanteProducaoLeite.findMany({ where: { animalId, dia: { propriedadeId, dataOperacional: { gte: dia(inicio), lte: dia(fim) } } }, include: incluirParticipante, orderBy: [{ dia: { dataOperacional: "desc" } }, { id: "asc" }] });
  const dias = participantes.map(diaDTO), ativos = dias.filter(d => d.excluidoEm === null);
  const diasComRegistro = new Set(ativos.map(d => d.dataOperacional)).size;
  const diasCalendario = diasCalendarioContexto(dia(inicio), dia(fim)) + 1;
  const atual = await tx.localizacaoAnimal.findFirst({ where: { animalId }, orderBy: [{ desde: "desc" }, { criadoEm: "desc" }], select: { propriedadeId: true } });
  let carenciaLeite: ContextoCarenciaLeiteDTO = { dataReferencia: fim, disponibilidade: "FORA_DO_ESCOPO_ATUAL" };
  // Segue a autorização da consulta sanitária: doses acompanham o animal, leitura
  // integral somente pelo sítio atual. Histórico antigo não concede outro escopo.
  if (atual?.propriedadeId === propriedadeId) {
    const c = await carenciaAnimalTx(tx, animalId, fim);
    carenciaLeite = { dataReferencia: fim, disponibilidade: "DISPONIVEL", leite: c.leite.estado === "CONHECIDO" ? { ...c.leite, ate: c.leite.ate.toISOString() } : c.leite,
      revisaoLeitePendente: c.revisaoLeitePendente, revisaoAdministracaoPendente: c.revisaoAdministracaoPendente };
  }
  return { propriedadeId, animal, periodo: { inicio, fim }, itens: dias.slice((filtro.pagina - 1) * filtro.tamanho, filtro.pagina * filtro.tamanho),
    total: dias.length, pagina: filtro.pagina, tamanho: filtro.tamanho, totaisPeriodo: resumirProducao(ativos.flatMap(d => d.medicoes)),
    coberturaPeriodo: { diasCalendario, diasComRegistro, diasSemRegistro: Math.max(0, diasCalendario - diasComRegistro) }, carenciaLeite };
}
export async function consultarHistoricoProdutivo(propriedadeId: number, animalId: string, filtro: ConsultaHistoricoProdutivo) {
  return prisma.$transaction(tx => consultarHistoricoProdutivoTx(tx, propriedadeId, animalId, filtro), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
