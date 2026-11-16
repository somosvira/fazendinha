export function efeitosAplicacao(input: { reverter: boolean; destinoConsumo?: "DEVOLVER_ESTOQUE" | "MANTER_CONSUMO"; administracaoMantida?: boolean | null; possuiMovimentoEstoque: boolean }) {
  if (!input.reverter) return { efeitoMaterial: "Consumo registrado preservado.", efeitoAdministracao: "Administração registrada preservada.", efeitoCarencia: "A evidência desta aplicação continua no cálculo das carências.", efeitoCustos: "Custos atribuídos ao atendimento preservados." };
  const devolver = input.destinoConsumo === "DEVOLVER_ESTOQUE";
  const administrada = !devolver && input.administracaoMantida !== false;
  return {
    efeitoMaterial: devolver ? input.possuiMovimentoEstoque ? "Estorno do movimento elegível, com devolução ao estoque." : "Sem movimento de estoque vinculado: não será criada entrada de material." : "Material utilizado, perdido ou descartado: consumo mantido, sem devolução ao saldo.",
    efeitoAdministracao: devolver || input.administracaoMantida === false ? "Administração não mantida para este registro." : input.administracaoMantida === true ? "Administração real mantida apesar da anulação documental." : "Administração não esclarecida; não será presumida ausência.",
    efeitoCarencia: administrada ? "A evidência de administração permanece; carência desconhecida continua desconhecida." : "Esta aplicação deixa de compor a carência. Outros registros continuam valendo; isso não comprova liberação do animal.",
    efeitoCustos: devolver ? "Material devolvido deixa de compor o consumo deste atendimento. Histórico e Serviço contratado não são apagados." : "Consumo e custo do material mantidos; anulação não apaga a despesa ou o histórico.",
  };
}
