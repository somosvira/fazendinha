// Motor puro da ponte compra→lançamento financeiro (Prisma-free, testado por
// TDD). Vem de @rionovo/shared — mesma regra usada pela previsão offline do
// recibo no client (preverLancamentoDaEntrada assume mês aberto).
export {
  resolverLancamentoDaEntrada,
  type ResolverIn, type ResolverOut,
} from "@rionovo/shared";
