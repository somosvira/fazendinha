// Casca global do modo offline: faixa não bloqueante enquanto sem conexão e,
// enquanto a fila de escritas pendentes é reprocessada, overlay que bloqueia
// a tela inteira — evita qualquer ação nova (e qualquer leitura fora de
// ordem) até a sincronização terminar. Ver fila.ts.
import { useSyncExternalStore, type CSSProperties } from "react";
import { inscrever, filaTravada, obterFila, obterProgresso } from "./fila";
import { useOnlineStatus } from "./useOnlineStatus";

const faixa: CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 9000,
  padding: "6px 12px",
  textAlign: "center",
  background: "var(--ink)",
  color: "var(--bg-card)",
  fontFamily: "var(--sans)",
  fontSize: 13,
  pointerEvents: "none",
};

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

function FaixaOffline() {
  const online = useOnlineStatus();
  const pendentes = useSyncExternalStore(inscrever, obterFila, obterFila).length;
  if (online) return null;
  return (
    <div role="status" style={faixa}>
      Sem conexão — dados podem estar desatualizados
      {pendentes > 0 ? ` · ${pendentes} ${pendentes === 1 ? "alteração pendente" : "alterações pendentes"}` : ""}
    </div>
  );
}

export function ShellOffline() {
  return (
    <>
      <FaixaOffline />
      <OverlaySincronizando />
    </>
  );
}

function OverlaySincronizando() {
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
