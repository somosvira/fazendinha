import { Prisma } from "@prisma/client";
import { calcularAtribuicao } from "../pecuaria/nutricao/atribuicao.calc.js";
import { repartirValor } from "../estoque/valorizacao.calc.js";
import { DIA_MS, textoDia } from "./presenca.calc.js";

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
export type PresencaDia = { animalId: string; propriedadeId: number; data: string; vaca: boolean | null };
type Intervalo = { desde: Date; ate: Date; vaca: boolean | null };
export type FechamentoAnalise = { id: string; propriedadeId: number; centroCustoId: string; centroCustoNome: string; inicio: Date; fim: Date; animalDias: number;
  participacoes: { id: string; animalId: string; dias: number; intervalos: Intervalo[]; finalidade: string | null }[];
  itens: { id: string; produtoId: string; unidade: string; quantidadeConfirmada: string; custoConhecido: string | null; movimentoEstoqueId: string | null }[] };
/** Chave numérica de animal × sítio × dia: com milhões de animal-dias, montar e comparar textos dominava o tempo. */
function criarChave() {
  const pares = new Map<string, number>(), dias = new Map<string, number>();
  const indice = <K>(m: Map<K, number>, k: K) => { let i = m.get(k); if (i === undefined) { i = m.size; m.set(k, i); } return i; };
  // Base por animal × sítio, calculada uma vez por participação; o dia soma o índice da data.
  // Chaves pequenas (inteiros de 31 bits) mantêm Map e Set no caminho rápido do motor.
  const base = (animalId: string, propriedadeId: number) => indice(pares, `${propriedadeId}:${animalId}`) * 2048;
  const dia = (data: string) => indice(dias, data);
  return { base, dia, chave: (animalId: string, propriedadeId: number, data: string) => base(animalId, propriedadeId) + dia(data) };
}
/** Somas exatas em unidades inteiras (centavos, milésimos): mesmo resultado do Decimal para valores com casas fixas. */
const inteiro = (valor: string, casas: number) => { const [i, d = ""] = valor.split("."); const n = Number(i.replace("-", "") + (d + "0".repeat(casas)).slice(0, casas)); return valor.startsWith("-") ? -n : n; };
const decimalTexto = (n: number, casas: number) => { const sinal = n < 0 ? "-" : "", a = String(Math.abs(n)).padStart(casas + 1, "0"); return `${sinal}${a.slice(0, -casas)}.${a.slice(-casas)}`; };
export function diasIntervalos(intervalos: Intervalo[]) {
  const dias: { data: string; vaca: boolean | null }[] = [];
  for (const s of intervalos) for (let t = +s.desde; t < +s.ate; t += DIA_MS) dias.push({ data: textoDia(new Date(t)), vaca: s.vaca });
  // Datas AAAA-MM-DD: a comparação simples ordena igual e é bem mais rápida que localeCompare.
  return dias.sort((a,b) => a.data < b.data ? -1 : a.data > b.data ? 1 : 0);
}

/** Primeiro atribui os centavos originais ao animal/dia; só depois recorta a consulta. */
export function calcularNutricao(presencas: PresencaDia[], fechamentos: FechamentoAnalise[], inicio: string, fim: string) {
  const diasConsulta = (+new Date(fim)-+new Date(inicio))/DIA_MS+1;
  const { base, dia, chave } = criarChave();
  // A população aponta para as presenças originais; a condição de vaca registrada no fechamento fica à parte.
  const populacao = new Map<number, PresencaDia>(), vacaRegistrada = new Map<number, boolean | null>();
  for (const p of presencas) if (p.data >= inicio && p.data <= fim) populacao.set(chave(p.animalId, p.propriedadeId, p.data), p);
  const alimentados = new Set<number>();
  const lacunas: { fechamentoId: string; motivo: string }[] = [];
  const fontes: { fechamentoId: string; participacaoId: string; itemId: string; animalId: string; propriedadeId: number; centroCustoId: string; centroCustoNome: string; finalidade: string | null; unidade: string; quantidade: string; custoConhecido: string | null; custoVacas: string | null; movimentoEstoqueId: string | null; prova: string }[] = [];
  for (const f of fechamentos) {
    const atribuicao = calcularAtribuicao(f.participacoes, f.animalDias, f.itens, { resumida: true });
    const porAnimal = new Map(atribuicao.participacoes.map(a => [a.animalId, a]));
    const inicioF = textoDia(f.inicio), fimF = textoDia(f.fim);
    for (const p of f.participacoes) {
      const dias = diasIntervalos(p.intervalos);
      if (dias.length !== p.dias || new Set(dias.map(d => d.data)).size !== p.dias || dias.some(d => d.data < inicioF || d.data > fimF)) {
        lacunas.push({ fechamentoId: f.id, motivo: `Participação ${p.id}: intervalos não conciliam os ${p.dias} dias registrados` });
        continue;
      }
      const noPeriodo = dias.flatMap((d,i) => d.data >= inicio && d.data <= fim ? [i] : []);
      if (!noPeriodo.length) continue;
      const baseAnimal = base(p.animalId, f.propriedadeId);
      for (const i of noPeriodo) {
        const k = baseAnimal + dia(dias[i].data);
        if (!populacao.has(k)) lacunas.push({ fechamentoId: f.id, motivo: `Presença registrada de ${p.animalId} diverge da história no dia ${dias[i].data}` });
        else vacaRegistrada.set(k, dias[i].vaca);
        if (alimentados.has(k)) lacunas.push({ fechamentoId: f.id, motivo: `Alimentação sobreposta em ${dias[i].data} para ${p.animalId}` });
        alimentados.add(k);
      }
      const animal = porAnimal.get(p.animalId)!;
      // Fechamento inteiro dentro do período e mesma condição em todos os dias: o total já rateado é a soma
      // exata das parcelas diárias, sem precisar dividir por dia e somar de volta.
      const inteiro = noPeriodo.length === dias.length, vacas = noPeriodo.filter(i => dias[i].vaca === true).length;
      for (const item of f.itens) {
        const parcela = animal.itens.find(i => i.produtoId === item.produtoId)!;
        let quantidade: string, custoConhecido: string | null, custoVacas: string | null;
        if (inteiro && (vacas === 0 || vacas === dias.length)) {
          // O rateio já devolve texto com 3 e 2 casas.
          quantidade = parcela.quantidadeAtribuida;
          custoConhecido = parcela.custoConhecido;
          custoVacas = custoConhecido != null && vacas ? custoConhecido : null;
        } else {
          const valores = parcela.custoConhecido == null ? null : repartirValor(parcela.custoConhecido, dias.map(() => 1));
          const quantidades = repartirValor(D(parcela.quantidadeAtribuida).mul(10), dias.map(() => 1)).map(q => q.div(10));
          quantidade = noPeriodo.reduce((s,i) => s.plus(quantidades[i]),D(0)).toFixed(3);
          custoConhecido = valores ? noPeriodo.reduce((s,i) => s.plus(valores[i]),D(0)).toFixed(2) : null;
          custoVacas = valores && vacas ? noPeriodo.filter(i => dias[i].vaca === true).reduce((s,i) => s.plus(valores[i]),D(0)).toFixed(2) : null;
        }
        fontes.push({ fechamentoId: f.id, participacaoId: p.id, itemId: item.id, animalId: p.animalId, propriedadeId: f.propriedadeId,
          centroCustoId: f.centroCustoId, centroCustoNome: f.centroCustoNome, finalidade: p.finalidade, unidade: item.unidade,
          quantidade, custoConhecido, custoVacas,
          movimentoEstoqueId: item.movimentoEstoqueId, prova: "HISTORICO_EXISTENTE_CONCILIADO" });
      }
    }
  }
  const animalDias = populacao.size;
  let vacaDias = 0, classificados = 0, diasAlimentados = 0;
  for (const [k, p] of populacao) {
    const vaca = vacaRegistrada.has(k) ? vacaRegistrada.get(k) : p.vaca;
    if (vaca === true) vacaDias++;
    if (vaca != null) classificados++;
    if (alimentados.has(k)) diasAlimentados++;
  }
  const custosPendentes = fontes.filter(f => f.custoConhecido == null).length;
  let centavos = 0, centavosVacas = 0;
  for (const f of fontes) { if (f.custoConhecido != null) centavos += inteiro(f.custoConhecido, 2); if (f.custoVacas != null) centavosVacas += inteiro(f.custoVacas, 2); }
  const custo = D(decimalTexto(centavos, 2)), custoVacas = D(decimalTexto(centavosVacas, 2));
  const parcial = diasAlimentados !== animalDias || custosPendentes > 0 || lacunas.length > 0 || !animalDias;
  const temConhecido = fontes.some(f => f.custoConhecido != null);
  const medias = (valor: Prisma.Decimal, ad: number, incompleto: boolean, conhecido: boolean) => ({ animalDias: ad, populacaoMedia: D(ad).div(diasConsulta).toFixed(4), custoConhecido: conhecido ? valor.toFixed(2) : null,
    porDia: ad && conhecido ? valor.div(ad).toFixed(4) : null, porPeriodo: ad && conhecido ? valor.mul(diasConsulta).div(ad).toFixed(2) : null, parcial: incompleto });
  const porUnidade = new Map<string,{ unidade: string; quantidadeConhecida: number; quantidadePendente: number }>();
  for (const f of fontes) { const u=porUnidade.get(f.unidade) ?? { unidade:f.unidade,quantidadeConhecida:0,quantidadePendente:0 }; const campo=f.custoConhecido==null?"quantidadePendente":"quantidadeConhecida";u[campo]+=inteiro(f.quantidade,3);porUnidade.set(f.unidade,u); }
  return { rebanho: medias(custo,animalDias,parcial,temConhecido), vacas: medias(custoVacas,vacaDias,parcial || classificados !== animalDias,fontes.some(f => f.custoVacas != null)),
    cobertura: { animalDias, diasAlimentados, diasClassificados: classificados, itensComCusto: fontes.length-custosPendentes, itensPendentes: custosPendentes,
      quantidades: [...porUnidade.values()].map(u => ({ unidade:u.unidade,quantidadeConhecida:decimalTexto(u.quantidadeConhecida,3),quantidadePendente:decimalTexto(u.quantidadePendente,3) })) },
    fontes, lacunas, metodologia: "Rateio por presença: centavos por animal e depois por dia, em ordem cronológica; não mede ingestão individual. Média no período = custo conhecido ÷ população média. Vacas: fêmeas com paridade comprovada, secas e lactantes." };
}
