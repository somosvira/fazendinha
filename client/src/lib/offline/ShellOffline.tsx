// Bloqueia a tela inteira enquanto a fila de escritas pendentes está sendo
// reprocessada — evita qualquer ação nova (e qualquer leitura fora de
// ordem) até a sincronização terminar. Ver fila.ts.
import { useSyncExternalStore, type CSSProperties } from "react";
import { inscrever, filaTravada, obterProgresso } from "./fila";

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background: "rgba(20, 25, 26, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const caixa: CSSProperties = {
  background: "var(--bg-card)",
  color: "var(--ink)",
  padding: "16px 28px",
  borderRadius: 10,
  border: "1px solid var(--rule)",
  fontFamily: "var(--sans)",
  fontSize: 14,
};

export function ShellOffline() {
  const travada = useSyncExternalStore(inscrever, filaTravada, filaTravada);
  const progresso = useSyncExternalStore(inscrever, obterProgresso, obterProgresso);
  if (!travada) return null;
  return (
    <div style={overlay}>
      <div style={caixa}>
        Sincronizando alterações pendentes{progresso ? ` (${progresso.atual} de ${progresso.total})` : "…"}
      </div>
    </div>
  );
}
