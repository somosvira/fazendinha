// onlineManager detecta online/offline (evento nativo do browser), mas não
// retoma a fila sozinho — isso é responsabilidade de quem integra.
import { onlineManager } from "@tanstack/react-query";
import { garantirProcessamento } from "./fila";

const SONDA_TIMEOUT_MS = 4000;

// navigator.onLine só garante "existe uma interface de rede" — mente dizendo
// online sem internet de verdade (rede sem uplink, portal cativo) e, mais
// grave, num reload que acontece já offline sem visita anterior (achado
// testando de verdade — o navegador não corrige o valor nesse caso). Sonda
// o próprio backend pra confirmar.
async function sondarConexaoReal(): Promise<boolean> {
  try {
    const controlador = new AbortController();
    const timeout = setTimeout(() => controlador.abort(), SONDA_TIMEOUT_MS);
    const resposta = await fetch("/api/health", { signal: controlador.signal, cache: "no-store" });
    clearTimeout(timeout);
    return resposta.ok;
  } catch {
    return false;
  }
}

// Setup padrão do onlineManager começa com "online" fixo (true) e só muda
// quando um evento novo dispara. Semeia com navigator.onLine (rápido, mas
// pode estar errado) e corrige com a sonda real assim que ela responder —
// tanto no boot quanto toda vez que o evento "online" disparar (esse também
// só garante interface de rede, não internet de verdade).
function setupOnlineManager(setOnline: (online: boolean) => void) {
  setOnline(navigator.onLine);
  sondarConexaoReal().then(setOnline);
  const onOnline = () => { sondarConexaoReal().then(setOnline); };
  const onOffline = () => setOnline(false);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
}

export function iniciarRetomadaAutomatica(): () => void {
  onlineManager.setEventListener(setupOnlineManager);
  return onlineManager.subscribe((online) => {
    if (online) garantirProcessamento();
  });
}

export { onlineManager };
