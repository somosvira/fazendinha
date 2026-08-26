import { useEffect, useState } from "react";
import { onlineManager } from "./resume";

/** Espelha `onlineManager.isOnline()` em estado React — usado pra UI de
 * "sem conexão" / "pendente de sincronizar". */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  return online;
}
