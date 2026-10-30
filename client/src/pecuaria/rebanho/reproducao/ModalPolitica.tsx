import { useEffect, useRef, useState, type ComponentProps } from "react";
import { PainelCadastro } from "../../../financeiro/PainelCadastro";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { registrarGuardaNavegacao } from "../../../navegacaoGuardada";

/** A nova versão permanece protegida também ao trocar o sítio ou a rota. */
export function ModalPolitica(props: ComponentProps<typeof PainelCadastro>) {
  const [alterado, setAlterado] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const estado = useRef({ alterado: false, bloqueado: false });
  estado.current = { alterado: alterado || Boolean(props.alteracoesExternas), bloqueado: Boolean(props.bloqueado) };
  const resolver = useRef<((permitir: boolean) => void) | null>(null);

  useEffect(() => {
    if (!props.aberto) return;
    const cancelarGuarda = registrarGuardaNavegacao(async () => {
      if (estado.current.bloqueado) return false;
      if (!estado.current.alterado) return true;
      setConfirmarSaida(true);
      return new Promise<boolean>(resolve => { resolver.current = resolve; });
    });
    const antesDeSair = (evento: BeforeUnloadEvent) => {
      if (!estado.current.alterado && !estado.current.bloqueado) return;
      evento.preventDefault();
      evento.returnValue = "";
    };
    window.addEventListener("beforeunload", antesDeSair);
    return () => { cancelarGuarda(); window.removeEventListener("beforeunload", antesDeSair); resolver.current?.(false); };
  }, [props.aberto]);

  function responder(permitir: boolean) {
    if (estado.current.bloqueado) return;
    setConfirmarSaida(false);
    const concluir = resolver.current;
    resolver.current = null;
    concluir?.(permitir);
  }

  return <>
    <PainelCadastro {...props} alteracoesExternas={estado.current.alterado}>
      <div onChangeCapture={() => setAlterado(true)}>{props.children}</div>
    </PainelCadastro>
    <ConfirmDialog open={confirmarSaida} title="Descartar alterações?" message="Os dados preenchidos não serão salvos." confirmLabel="Descartar alterações" cancelLabel="Continuar editando" tone="danger" processando={props.bloqueado} onConfirm={() => responder(true)} onCancel={() => responder(false)}/>
  </>;
}
