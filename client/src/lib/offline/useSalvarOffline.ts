// Ação de "salvar" de um modal de escrita offline-aware (useOfflineMutation).
// Online, espera a confirmação real do servidor antes de fechar — erro
// aparece dentro do próprio modal, sem perder o que já foi digitado. Offline,
// fecha na hora (não dá pra esperar por tempo indeterminado) — erro tardio
// (só chega bem depois, quando a fila sincronizar) vira toast, já que o
// modal não existe mais quando ele chega.
import { useState } from "react";
import { useOnlineStatus } from "./useOnlineStatus";

type Mutate<TInput, TItem> = (
  input: TInput,
  opts?: { onSuccess?: (item: TItem) => void; onError?: (err: unknown) => void },
) => void;

interface Callbacks<TItem> {
  // Recebe a resposta real do servidor quando online; offline não há como
  // esperar por ela (o modal já fechou), então chega undefined — quem
  // precisa distinguir os dois casos (ex.: recibo com previsão) usa isso.
  onSalvo: (item?: TItem) => void;
  onErroInline: (mensagem: string) => void;
  onErroTardio: (mensagem: string) => void;
}

function mensagemDeErro(e: unknown): string {
  return (e as any)?.message ?? "Erro ao salvar.";
}

export function useSalvarOffline<TItem = unknown>() {
  const online = useOnlineStatus();
  const [salvando, setSalvando] = useState(false);

  function salvar<TInput>(mutate: Mutate<TInput, TItem>, input: TInput, cb: Callbacks<TItem>) {
    if (!online) {
      mutate(input, { onError: (e) => cb.onErroTardio(mensagemDeErro(e)) });
      cb.onSalvo();
      return;
    }
    setSalvando(true);
    mutate(input, {
      onSuccess: (item) => { setSalvando(false); cb.onSalvo(item); },
      onError: (e) => { setSalvando(false); cb.onErroInline(mensagemDeErro(e)); },
    });
  }

  return { salvando, salvar };
}
