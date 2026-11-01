import { Prisma } from "@prisma/client";
import { aplicarParcelaPreparo, componentesDaFonte, consolidarCustos, type FonteCusto, type ComponenteCusto, type ParcelaPreparo } from "./custos.calc.js";

type Vinculo = ParcelaPreparo & { tentativaId: string; aplicacaoId: string | null; exameId: string | null; participacaoId: string | null };
type Recorte = { inicio?: string; fim?: string; finalidade?: string };
/** Só valores da tentativa ou preparos explicitamente atribuídos. Não divide o total do animal. */
export function mediaCustosTentativas(fontes: FonteCusto[], vinculos: Vinculo[], filtro: Recorte, verValores: boolean) {
  const naData = (data: string) => (!filtro.inicio || data >= filtro.inicio) && (!filtro.fim || data <= filtro.fim);
  const naFinalidade = (finalidade: string | null) => !filtro.finalidade || (filtro.finalidade === "SEM_CLASSIFICACAO" ? finalidade == null : finalidade === filtro.finalidade);
  const tentativas = fontes.filter(f => f.tipo === "TENTATIVA" && f.estadoFato === "VALIDO" && naData(f.data) && naFinalidade(f.classificacao?.finalidade ?? null));
  const partes: ComponenteCusto[] = [];
  for (const t of tentativas) {
    partes.push(...componentesDaFonte(t));
    for (const v of vinculos.filter(v => v.tentativaId === t.id)) {
      const fonte = fontes.find(f => f.tipo === "APLICACAO" && f.id === v.aplicacaoId || f.tipo === "EXAME" && f.id === v.exameId || f.tipo === "PARTICIPACAO" && f.id === v.participacaoId);
      if (fonte) partes.push(...aplicarParcelaPreparo(componentesDaFonte(fonte), v));
    }
  }
  const agregadas = new Map<string, ComponenteCusto>();
  for (const c of partes.filter(c => naData(c.data) && naFinalidade(c.finalidade))) {
    const anterior = agregadas.get(c.chave);
    agregadas.set(c.chave, anterior && c.valor != null && anterior.valor != null ? { ...c, valor: anterior.valor.plus(c.valor) } : c);
  }
  const consolidado = consolidarCustos([...agregadas.values()], verValores);
  const semAtribuicao = fontes.some(f => ["APLICACAO","EXAME","PARTICIPACAO"].includes(f.tipo) && naData(f.data) && naFinalidade(f.classificacao?.finalidade ?? null) && !vinculos.some(v => (v.aplicacaoId ?? v.exameId ?? v.participacaoId) === f.id));
  const cobertura = semAtribuicao && consolidado.cobertura === "COMPLETO" ? "PARCIAL" : consolidado.cobertura;
  return { tentativas: tentativas.length, cobertura, situacao: verValores ? cobertura : "OCULTO",
    totalConhecido: consolidado.totalConhecido,
    mediaConhecida: tentativas.length && consolidado.totalConhecido != null ? new Prisma.Decimal(consolidado.totalConhecido).div(tentativas.length).toFixed(2) : null,
    referencia: "TENTATIVAS_VALIDAS_E_CUSTOS_ATRIBUIDOS_NO_RECORTE" as const };
}
