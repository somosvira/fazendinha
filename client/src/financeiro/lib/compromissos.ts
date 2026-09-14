type DadosTituloCompromisso = {
  numeroParcela: number;
  totalParcelas: number;
  operacao: { descricao: string | null; tipo: string };
};

export function tituloCompromisso(compromisso: DadosTituloCompromisso) {
  const tituloBase = compromisso.operacao.descricao?.trim()
    || compromisso.operacao.tipo.replaceAll("_", " ").toLocaleLowerCase("pt-BR");
  return compromisso.totalParcelas > 1
    ? `(${compromisso.numeroParcela}/${compromisso.totalParcelas}) ${tituloBase}`
    : tituloBase;
}
