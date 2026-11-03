export type ContextoTentativaParticipacaoDTO = { iaPrevista: boolean | null; possuiTentativaVinculada: boolean };

/** A versão do modelo e os vínculos persistidos são dimensões independentes. */
export function ContextoTentativaParticipacao({ contexto }: { contexto?: ContextoTentativaParticipacaoDTO }) {
  if (!contexto) return null;
  return <div className="grid gap-1 text-sm text-ink-3">
    {contexto.iaPrevista === false && <p>IA não prevista neste modelo histórico</p>}
    <p>{contexto.possuiTentativaVinculada ? "Tentativa vinculada" : "Sem tentativa vinculada"}</p>
  </div>;
}
