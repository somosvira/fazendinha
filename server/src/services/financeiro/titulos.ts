export type DadosTituloCompromisso = {
  numeroParcela: number | null;
  totalParcelas: number | null;
  operacao: { descricao: string | null; tipo: string };
};

export function tituloCompromisso(compromisso: DadosTituloCompromisso) {
  const tituloBase = compromisso.operacao.descricao?.trim()
    || compromisso.operacao.tipo.replaceAll("_", " ").toLocaleLowerCase("pt-BR");
  const numeroParcela = compromisso.numeroParcela ?? 1;
  const totalParcelas = compromisso.totalParcelas ?? 1;
  return totalParcelas > 1
    ? `(${numeroParcela}/${totalParcelas}) ${tituloBase}`
    : tituloBase;
}
