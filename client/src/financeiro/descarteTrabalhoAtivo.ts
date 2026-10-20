import { useEffect, useRef } from "react";
import { getToken } from "../lib/auth";
import { getPropriedadeAtiva } from "../propriedadeScope";

export type TipoTrabalhoAtivo = "operacao" | "relatorio";
type Registro = { descartar: () => Promise<void>; contexto: string };
const editores = new Map<TipoTrabalhoAtivo, Registro>();
const contextoAtual = () => `${getToken() ?? ""}|${getPropriedadeAtiva() ?? ""}`;

/** O editor suspende seu autosave e participa do descarte iniciado na sidebar. */
export function useDescarteTrabalhoAtivo(tipo: TipoTrabalhoAtivo, descartar: () => Promise<void>, habilitado = true) {
  const atual = useRef(descartar);
  atual.current = descartar;
  useEffect(() => {
    if (!habilitado) return;
    const registro = { descartar: () => atual.current(), contexto: contextoAtual() };
    editores.set(tipo, registro);
    return () => { if (editores.get(tipo) === registro) editores.delete(tipo); };
  }, [tipo, habilitado]);
}

/** Sem editor montado, o descarte também espera a fila de salvamentos do domínio. */
export async function descartarTrabalhoAtivo(tipo: TipoTrabalhoAtivo, semEditor: (validarContexto: () => void) => Promise<void>) {
  const contexto = contextoAtual();
  const validarContexto = () => {
    if (contexto !== contextoAtual()) throw new Error("O sítio ou a sessão mudou. Reabra o trabalho no contexto original.");
  };
  const editor = editores.get(tipo);
  validarContexto();
  if (editor) {
    if (editor.contexto !== contexto) throw new Error("Reabra o trabalho no sítio e na sessão originais antes de excluir.");
    await editor.descartar();
  } else await semEditor(validarContexto);
}
