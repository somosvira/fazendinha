/** Nunca estenda uma retomada aos registros manuais criados depois da seed. */
export function idsDoManifesto(ids: Record<string, string>, prefixo: string) {
  return Object.entries(ids).filter(([chave]) => chave.startsWith(prefixo)).map(([, id]) => id);
}

export function exigirUnico<T>(registros: T[], contexto: string): T {
  if (registros.length !== 1) throw new Error(`${contexto}: registro ambíguo ou removido; nenhuma inclusão manual será escolhida.`);
  return registros[0]!;
}

export function exigirMesmaComposicao(atuais: string[], preparados: string[], contexto: string) {
  if (atuais.length !== preparados.length || atuais.some(id => !preparados.includes(id)))
    throw new Error(`${contexto}: composição alterada; não concluir automaticamente.`);
}

export function exigirAtendimentoIntocado(participantes: { status: string; versaoRascunho: number }[]) {
  if (participantes.some(p => p.status !== 'PENDENTE' || p.versaoRascunho !== 0))
    throw new Error('Atendimento alterado pela interface; não substituir por ausência/adiamento demonstrativo.');
}
