// Resolução pura (Prisma-free, testada por TDD) da ponte compra→lançamento financeiro.
// Decide SE uma ENTRADA de estoque deve gerar um Lancamento e COM QUAL categoria/centro de custo.
// Precedência: input do formulário > default do produto > nenhum (não gera).
// Nunca bloqueia o movimento — só diz "deveCriar" e o motivo de não criar.

export interface ResolverIn {
  tipo: "ENTRADA" | "SAIDA" | "AJUSTE";
  gerarLancamento?: boolean;
  inputCategoriaId?: number;
  inputCentroCustoId?: number;
  produtoCategoriaId: number | null;
  produtoCentroCustoId: number | null;
  mesFechado: boolean;
}

export interface ResolverOut {
  deveCriar: boolean;
  categoriaId?: number;
  centroCustoId?: number;
  motivo?: string;
}

export function resolverLancamentoDaEntrada(i: ResolverIn): ResolverOut {
  // Só compras (ENTRADA) geram lançamento; e só quando o usuário não desligou a opção.
  if (i.tipo !== "ENTRADA" || i.gerarLancamento === false) return { deveCriar: false };

  const categoriaId = i.inputCategoriaId ?? i.produtoCategoriaId ?? undefined;
  const centroCustoId = i.inputCentroCustoId ?? i.produtoCentroCustoId ?? undefined;

  // Lancamento exige AMBOS (NOT NULL no schema). Falta qualquer um → não cria.
  if (categoriaId == null || centroCustoId == null)
    return { deveCriar: false, motivo: "produto sem categoria/centro de custo" };

  // Mês contábil fechado → não cria (regra de FechamentoMensal).
  if (i.mesFechado) return { deveCriar: false, motivo: "mês fechado" };

  return { deveCriar: true, categoriaId, centroCustoId };
}
