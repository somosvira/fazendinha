import { useEffect, useState } from "react";
import { Button, ErrorBox, Panel } from "../../../financeiro/financeiro-ui";
import { DetalhesFechamento } from "./DetalhesFechamento";
import { obterFechamento, type Fechamento } from "./api";

export function ConsultaFechamento({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const [fechamento, setFechamento] = useState<Fechamento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    let vivo = true; setCarregando(true); setErro(null); setFechamento(null);
    obterFechamento(id).then((r) => { if (vivo) setFechamento(r); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }).finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [id, revisao]);
  return <Panel className="mt-5 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-serif text-xl">Detalhes do fechamento</h2><Button secondary onClick={onVoltar}>Voltar aos fechamentos</Button></div>
    <ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setRevisao((r) => r + 1)}>Tentar novamente</Button>}
    {carregando && <p className="mt-3">Carregando fechamento…</p>}{fechamento && <DetalhesFechamento fechamento={fechamento} />}
  </Panel>;
}
