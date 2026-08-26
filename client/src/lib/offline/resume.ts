// onlineManager detecta online/offline (evento nativo do browser), mas não
// retoma a fila sozinho — isso é responsabilidade de quem integra.
import { onlineManager } from "@tanstack/react-query";
import { garantirProcessamento } from "./fila";

export function iniciarRetomadaAutomatica(): () => void {
  return onlineManager.subscribe((online) => {
    if (online) garantirProcessamento();
  });
}

export { onlineManager };
