import { Prisma, type UnidadeMedida } from "@prisma/client";
import { saldosBasesTx } from "../../estoque/valorizacao.js";
import { converterQuantidade, UNIDADES } from "../../estoque/unidades.js";
import { referenciasCustoSchema } from "./referencias-planejadas.js";

type Parcela = { quantidade: Prisma.Decimal.Value | null; custoUnitario: Prisma.Decimal.Value | null };
export function estimarPlanosProtocolos(planos: Parcela[], servicosSemReferencia = 0) {
  let conhecido = new Prisma.Decimal(0); let conhecidos = 0; let desconhecidos = servicosSemReferencia;
  for (const p of planos) {
    if (p.quantidade == null || p.custoUnitario == null) { desconhecidos++; continue; }
    conhecido = conhecido.plus(new Prisma.Decimal(p.quantidade).mul(p.custoUnitario)); conhecidos++;
  }
  const situacao = !conhecidos ? "NAO_APURADO" : desconhecidos ? "PARCIAL" : "COMPLETO";
  return { situacao, total: situacao === "COMPLETO" ? conhecido.toFixed(2) : null, totalConhecido: conhecidos ? conhecido.toFixed(2) : null,
    componentesConhecidos: conhecidos, componentesPendentes: desconhecidos,
    referencia: "Referências explícitas do planejamento ou saldo valorizado consultado; estimativa sem reserva ou baixa de estoque",
    limitacoes: ["Serviços sem referência planejada permanecem não apurados; não inclui despesas gerais"] };
}
const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const numero = (v: unknown): Prisma.Decimal.Value | null => typeof v === "string" || typeof v === "number" ? v : Prisma.Decimal.isDecimal(v) ? v : null;
const texto = (v: unknown) => typeof v === "string" ? v : null;
export type ReferenciaEstimativa = { descricao:string;animal:{id:string;brinco:string;nome:string|null}|null;tarefaId: string; participacaoId: string; natureza: "MATERIAL" | "SERVICO"; origem: string; data: string | null; unidade: string; valorUnitario: string | null; quantidade: string | null; valor: string | null };
/** Apenas lê bases documentadas; snapshots precedem o cadastro atual. */
export async function estimarProtocoloTx(tx: Prisma.TransactionClient, propriedadeId: number, where: Prisma.ParticipacaoProtocoloWhereInput, tarefasNoEscopo: Prisma.TarefaProtocoloWhereInput = {}, paginaReferencias = 1) {
  const tarefas = await tx.tarefaProtocolo.findMany({ where: { execucao: where, AND: [tarefasNoEscopo] }, select: { id: true, nomeSnapshot:true, execucaoId: true, execucao:{select:{animal:{select:{id:true,brinco:true,nome:true}}}}, parametros: true, etapa: { select: { tipo: true, nome:true, produtoId: true, dose: true, unidade: true, material: { select: { produtoId: true, produto: { select: { unidade: true } } } } } } }, orderBy: [{ execucaoId: "asc" }, { id: "asc" }] });
  const consultadaEm = new Date();
  const referencias: ReferenciaEstimativa[] = []; const planos: Parcela[] = [];
  const saldos = new Map<string, { unidade: UnidadeMedida; custo: Prisma.Decimal | null }>();
  for (const t of tarefas) {
    const p = objeto(t.parametros), etapa = objeto(p.etapa), config = objeto(p.configuracao);
    const aplicacao = objeto(etapa.planoAplicacao), tentativa = objeto(etapa.planoTentativa), congeladas = objeto(p.referencias);
    const ref = referenciasCustoSchema.safeParse(etapa.referenciasCusto ?? config.referenciasCusto);
    const refs = ref.success ? ref.data : undefined;
    if (["APLICACAO", "TENTATIVA"].includes(t.etapa.tipo) && tentativa.tipo !== "COBERTURA") {
      const genetica = objeto(congeladas.material);
      const produtoId = texto(aplicacao.produtoId) ?? texto(p.produtoId) ?? texto(genetica.produtoId) ?? t.etapa.material?.produtoId ?? t.etapa.produtoId;
      const quantidade = numero(aplicacao.dose) ?? numero(p.dose) ?? numero(tentativa.quantidade) ?? t.etapa.dose;
      const unidade = texto(aplicacao.unidadeDose) ?? texto(p.unidade) ?? texto(genetica.unidade) ?? t.etapa.material?.produto.unidade ?? t.etapa.unidade;
      let custo: Prisma.Decimal | null = null, unidadeRef = refs?.material?.unidade ?? unidade, origem = refs?.material?.origem ?? "Referência material não informada", data: string | null = refs?.material?.data ?? null;
      if (refs?.material) custo = new Prisma.Decimal(refs.material.valorUnitario);
      else if (produtoId) {
        if (!saldos.has(produtoId)) {
          const produto = await tx.produto.findUnique({ where: { id: produtoId }, select: { unidade: true } });
          if (produto) {
            const bases = (await saldosBasesTx(tx, produtoId, propriedadeId, consultadaEm)).filter(b => b.quantidade.gt(0));
            const q = bases.reduce((s, b) => s.plus(b.quantidade), new Prisma.Decimal(0));
            const v = bases.reduce((s, b) => s.plus(b.valor), new Prisma.Decimal(0));
            saldos.set(produtoId, { unidade: produto.unidade, custo: q.gt(0) ? v.div(q) : null });
          }
        }
        const saldo = saldos.get(produtoId); custo = saldo?.custo ?? null; unidadeRef = saldo?.unidade ?? unidade;
        if(saldo){origem="Saldo valorizado atual do sítio";data=consultadaEm.toISOString();}
      }
      let q: Prisma.Decimal | null = null;
      if (quantidade != null && unidade && unidadeRef && unidade in UNIDADES && unidadeRef in UNIDADES) {
        try { q = converterQuantidade(new Prisma.Decimal(quantidade), unidade as UnidadeMedida, unidadeRef as UnidadeMedida); } catch { q = null; }
      }
      planos.push({ quantidade: q, custoUnitario: custo });
      referencias.push({descricao:t.nomeSnapshot??t.etapa.nome??t.etapa.tipo,animal:t.execucao?.animal??null,tarefaId: t.id, participacaoId: t.execucaoId, natureza: "MATERIAL", origem, data, unidade: unidadeRef ?? "Não informada", valorUnitario: custo?.toString() ?? null, quantidade: q?.toString() ?? null, valor: q != null && custo != null ? q.mul(custo).toFixed(2) : null });
    }
    const servico = refs?.servico;
    planos.push({ quantidade: 1, custoUnitario: servico?.valorUnitario ?? null });
    referencias.push({descricao:t.nomeSnapshot??t.etapa.nome??t.etapa.tipo,animal:t.execucao?.animal??null,tarefaId: t.id, participacaoId: t.execucaoId, natureza: "SERVICO", origem: servico?.origem ?? "Referência de serviço não informada", data: servico?.data ?? null, unidade: "POR_ATENDIMENTO", valorUnitario: servico?.valorUnitario ?? null, quantidade: "1", valor: servico ? new Prisma.Decimal(servico.valorUnitario).toFixed(2) : null });
  }
  const pagina = Math.min(paginaReferencias, Math.max(1, Math.ceil(referencias.length / 10)));
  return { ...estimarPlanosProtocolos(planos), escopo: { participacoes: new Set(tarefas.map(t => t.execucaoId)).size, acoes: tarefas.length, animais: await tx.participacaoProtocolo.findMany({ where, select: { animalId: true }, distinct: ["animalId"] }).then(r => r.length) },
    referencias: { itens: referencias.slice((pagina - 1) * 10, pagina * 10), total: referencias.length, pagina, porPagina: 10 } };
}
