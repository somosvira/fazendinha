/* Agregação PURA do dashboard do Milho (cultivo) — rollup dos read-models
 * ResumoSafraCultivo + Silo. Sem Prisma: recebe números já convertidos na borda
 * (o loader dashboard.ts faz Number() dos Decimals). Testável isoladamente.
 *
 * Espelha a forma do dashboard do Corte: devolve o triplo { k, dominios, alertas }
 * que o DashboardView do cliente consome. `tab` dos domínios/alertas usa o prefixo
 * mil-* (a sub-aba de destino no módulo). */

export interface ResumoCultivoAgg {
  areaHa: number;
  producaoGraoSc: number;
  producaoSilagemTon: number;
  custeioTotal: number;
  investimentoTotal: number;
  custoSaca: number | null;
}

export interface SafraCultivoAgg {
  fechada: boolean;
  resumo: ResumoCultivoAgg | null;
}

export interface SiloAgg {
  saldoAtual: number;
  capacidade: number | null;
  ativo: boolean;
}

export interface DashboardCultivoDTO {
  k: {
    safrasAtivas: number;
    safrasFechadas: number;
    areaHa: number;
    producaoGraoSc: number;
    producaoSilagemTon: number;
    custeioTotal: number;
    investimentoTotal: number;
    custoSacaMedio: number | null;
    silosAtivos: number;
    siloSaldoTotal: number;
    siloOcupacaoPct: number | null;
  };
  dominios: { tab: string; titulo: string; linhas: string[] }[];
  alertas: { label: string; n: number; tom?: "up" | "bad"; tab: string }[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const brInt = (n: number) => Math.round(n).toLocaleString("pt-BR");

export function agregarDashboardCultivo(safras: SafraCultivoAgg[], silos: SiloAgg[]): DashboardCultivoDTO {
  const ativas = safras.filter((s) => !s.fechada);
  const fechadas = safras.filter((s) => s.fechada);

  const sum = (sel: (r: ResumoCultivoAgg) => number) =>
    safras.reduce((a, s) => a + (s.resumo ? sel(s.resumo) : 0), 0);

  const areaHa = sum((r) => r.areaHa);
  const producaoGraoSc = sum((r) => r.producaoGraoSc);
  const producaoSilagemTon = sum((r) => r.producaoSilagemTon);
  const custeioTotal = sum((r) => r.custeioTotal);
  const investimentoTotal = sum((r) => r.investimentoTotal);
  const custoSacaMedio = producaoGraoSc > 0 ? custeioTotal / producaoGraoSc : null;

  const ativos = silos.filter((s) => s.ativo);
  const siloSaldoTotal = ativos.reduce((a, s) => a + s.saldoAtual, 0);
  const capacidadeTotal = ativos.reduce((a, s) => a + (s.capacidade ?? 0), 0);
  const siloOcupacaoPct = capacidadeTotal > 0 ? (siloSaldoTotal / capacidadeTotal) * 100 : null;

  // Alertas derivados
  const safrasSemProducao = ativas.filter(
    (s) => !s.resumo || s.resumo.producaoGraoSc + s.resumo.producaoSilagemTon === 0,
  ).length;
  const silosCheios = ativos.filter(
    (s) => s.capacidade != null && s.capacidade > 0 && s.saldoAtual / s.capacidade > 0.9,
  ).length;
  const comCusto = safras.map((s) => s.resumo?.custoSaca).filter((v): v is number => v != null);
  const custoSacaMedioSafras = comCusto.length ? comCusto.reduce((a, v) => a + v, 0) / comCusto.length : 0;
  const safrasCaras = comCusto.filter((v) => v > custoSacaMedioSafras).length;

  return {
    k: {
      safrasAtivas: ativas.length,
      safrasFechadas: fechadas.length,
      areaHa: round2(areaHa),
      producaoGraoSc: round1(producaoGraoSc),
      producaoSilagemTon: round1(producaoSilagemTon),
      custeioTotal: Math.round(custeioTotal),
      investimentoTotal: Math.round(investimentoTotal),
      custoSacaMedio: custoSacaMedio != null ? round2(custoSacaMedio) : null,
      silosAtivos: ativos.length,
      siloSaldoTotal: round1(siloSaldoTotal),
      siloOcupacaoPct: siloOcupacaoPct != null ? round1(siloOcupacaoPct) : null,
    },
    dominios: [
      {
        tab: "mil-safras",
        titulo: "Safras",
        linhas: [`${ativas.length} safras ativas · ${fechadas.length} fechadas`, `${round2(areaHa)} ha em cultivo`],
      },
      {
        tab: "mil-producao",
        titulo: "Produção",
        linhas: [`${round1(producaoGraoSc)} sc de grão`, `${round1(producaoSilagemTon)} t de silagem`],
      },
      {
        tab: "mil-silos",
        titulo: "Silos",
        linhas: [
          `${ativos.length} silos ativos · ${round1(siloSaldoTotal)} em estoque`,
          siloOcupacaoPct != null ? `Ocupação média ${round1(siloOcupacaoPct)}%` : "Sem capacidade cadastrada",
        ],
      },
      {
        tab: "mil-custo",
        titulo: "Custo de produção",
        linhas: [
          custoSacaMedio != null ? `Custo médio R$ ${round2(custoSacaMedio)}/sc` : "Sem produção de grão lançada",
          `Custeio total R$ ${brInt(custeioTotal)}`,
        ],
      },
    ],
    alertas: [
      { label: "Safras ativas sem produção", n: safrasSemProducao, tom: "up", tab: "mil-producao" },
      { label: "Silos acima de 90%", n: silosCheios, tom: "bad", tab: "mil-silos" },
      { label: "Safras com custo/saca acima da média", n: safrasCaras, tom: "up", tab: "mil-custo" },
    ],
  };
}
