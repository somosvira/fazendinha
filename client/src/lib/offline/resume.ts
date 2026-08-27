// onlineManager detecta online/offline (evento nativo do browser), mas não
// retoma a fila sozinho — isso é responsabilidade de quem integra.
import { onlineManager } from "@tanstack/react-query";
import { garantirProcessamento } from "./fila";

// Setup padrão do onlineManager começa com "online" fixo (true) e só muda
// quando um evento novo dispara — se a página carrega (reload) já offline,
// nenhum evento novo acontece e ele fica preso achando que tá online.
// Troca o setup por um que também lê navigator.onLine no boot.
function setupOnlineManager(setOnline: (online: boolean) => void) {
  setOnline(navigator.onLine);
  const onOnline = () => setOnline(true);
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
