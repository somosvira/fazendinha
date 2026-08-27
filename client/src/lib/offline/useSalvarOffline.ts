// Ação de "salvar" de um modal de escrita offline-aware (useOfflineMutation).
// Online, espera a confirmação real do servidor antes de fechar — erro
// aparece dentro do próprio modal, sem perder o que já foi digitado. Offline,
// fecha na hora (não dá pra esperar por tempo indeterminado) — erro tardio
// (só chega bem depois, quando a fila sincronizar) vira toast, já que o
// modal não existe mais quando ele chega.
import { useState } from "react";
import { useOnlineStatus } from "./useOnlineStatus";

type Mutate<TInput> = (
  input: TInput,
  opts?: { onSuccess?: (item: any) => void; onError?: (err: unknown) => void },
) => void;

interface Callbacks {
  onSalvo: () => void;
  onErroInline: (mensagem: string) => void;
  onErroTardio: (mensagem: string) => void;
}

function mensagemDeErro(e: unknown): string {
  return (e as any)?.message ?? "Erro ao salvar.";
}

export function useSalvarOffline() {
  const online = useOnlineStatus();
  const [salvando, setSalvando] = useState(false);

  function salvar<TInput>(mutate: Mutate<TInput>, input: TInput, cb: Callbacks) {
    if (!online) {
      mutate(input, { onError: (e) => cb.onErroTardio(mensagemDeErro(e)) });
      cb.onSalvo();
      return;
    }
    setSalvando(true);
    mutate(input, {
      onSuccess: () => { setSalvando(false); cb.onSalvo(); },
      onError: (e) => { setSalvando(false); cb.onErroInline(mensagemDeErro(e)); },
    });
  }

  return { salvando, salvar };
}
