import { listarSaldos, type SaldoDTO } from "../../../estoque/api";
import { listarDietas, type Dieta, type ResumoNutricional } from "./api";

/** Abaixo disso, o estoque de um ingrediente merece atenção. */
export const DIAS_ATENCAO = 7;

export type CoberturaIngrediente = {
  produtoId: string; nome: string; unidade: string; propriedadeId: number;
  /** Consumo diário deste lote e de todos os lotes do sítio com dieta que usa o produto. */
  consumoLoteDia: number; consumoSitioDia: number;
  /** Saldo disponível no sítio (descontado o consumo estimado ainda não baixado). */
  saldo: number;
  /** Dias que o saldo cobre o consumo do sítio; null quando não há consumo previsto. */
  dias: number | null;
};
export type CoberturaLote = { dias: number | null; limitante: CoberturaIngrediente | null; ingredientes: CoberturaIngrediente[] };

const disponivel = (s: SaldoDTO) => s.saldoProjetado ?? s.saldo;

/** Cobertura calculada com as dietas vigentes, o efetivo de hoje e o saldo de cada sítio. */
export function calcularCobertura(lotes: ResumoNutricional[], dietas: Dieta[], saldosPorSitio: Map<number, SaldoDTO[]>): Map<string, CoberturaLote> {
  const porDieta = new Map(dietas.map(d => [d.id, d]));
  const itensDoLote = (r: ResumoNutricional) => (r.vigente ? porDieta.get(r.vigente.dieta.id)?.itens ?? [] : []);
  const demanda = new Map<string, number>();
  for (const r of lotes) for (const i of itensDoLote(r)) {
    const chave = `${r.lote.propriedadeId}:${i.produtoId}`;
    demanda.set(chave, (demanda.get(chave) ?? 0) + Number(i.quantidadeCabecaDia) * r.lote.animaisAtivos);
  }
  const resultado = new Map<string, CoberturaLote>();
  for (const r of lotes) {
    const saldos = saldosPorSitio.get(r.lote.propriedadeId) ?? [];
    const ingredientes = itensDoLote(r).map((i): CoberturaIngrediente => {
      const consumoSitioDia = demanda.get(`${r.lote.propriedadeId}:${i.produtoId}`) ?? 0;
      const saldoProduto = saldos.find(s => s.produtoId === i.produtoId);
      const saldo = saldoProduto ? Math.max(0, disponivel(saldoProduto)) : 0;
      return {
        produtoId: i.produtoId, nome: i.produto?.nome ?? saldoProduto?.nome ?? "Produto", unidade: i.unidade, propriedadeId: r.lote.propriedadeId,
        consumoLoteDia: Number(i.quantidadeCabecaDia) * r.lote.animaisAtivos, consumoSitioDia, saldo,
        dias: consumoSitioDia > 0 ? Math.floor(saldo / consumoSitioDia) : null,
      };
    });
    const limitante = ingredientes.filter(i => i.dias !== null).sort((a, b) => a.dias! - b.dias!)[0] ?? null;
    resultado.set(r.lote.id, { dias: limitante?.dias ?? null, limitante, ingredientes });
  }
  return resultado;
}

export async function consultarCobertura(lotes: ResumoNutricional[]) {
  const comDieta = lotes.filter(r => r.vigente);
  if (!comDieta.length) return new Map<string, CoberturaLote>();
  const sitios = [...new Set(comDieta.map(r => r.lote.propriedadeId))];
  const [dietas, saldos] = await Promise.all([listarDietas(), Promise.all(sitios.map(id => listarSaldos({ propriedadeId: id })))]);
  return calcularCobertura(comDieta, dietas, new Map(sitios.map((id, i) => [id, saldos[i]])));
}

/** Ingredientes com pouco estoque, um por produto e sítio, com os lotes que dependem dele. */
export function ingredientesEmFalta(cobertura: Map<string, CoberturaLote>, lotes: ResumoNutricional[]) {
  const porProduto = new Map<string, CoberturaIngrediente & { lotes: string[] }>();
  for (const r of lotes) for (const i of cobertura.get(r.lote.id)?.ingredientes ?? []) {
    if (i.dias === null || i.dias >= DIAS_ATENCAO) continue;
    const chave = `${i.propriedadeId}:${i.produtoId}`;
    const atual = porProduto.get(chave) ?? { ...i, lotes: [] };
    atual.lotes.push(r.lote.nome);
    porProduto.set(chave, atual);
  }
  return [...porProduto.values()].sort((a, b) => a.dias! - b.dias!);
}

export const textoCobertura = (dias: number | null) => dias === null ? "Sem consumo previsto" : dias === 0 ? "Sem saldo" : `${dias.toLocaleString("pt-BR")} ${dias === 1 ? "dia" : "dias"}`;
export const hrefProdutoEstoque = (produtoId: string) => `/estoque/produtos/${produtoId}`;
