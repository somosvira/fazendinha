/** Mensagens de recuperação para respostas sem uma explicação de domínio. */
export function mensagemErroHttp(status: number) {
  if (status === 401) return "Sua sessão expirou. Entre novamente para continuar.";
  if (status === 403) return "Seu perfil não tem permissão para esta ação. Solicite acesso ao administrador.";
  if (status === 404) return "O registro não foi encontrado ou não está disponível neste sítio.";
  if (status === 409) return "Os dados mudaram durante esta ação. Atualize a consulta e tente novamente.";
  if (status === 429) return "Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.";
  return status >= 500 ? "Não foi possível concluir a solicitação. Tente novamente; se o problema continuar, contate o administrador." : "Não foi possível concluir a solicitação. Confira os dados e tente novamente.";
}
