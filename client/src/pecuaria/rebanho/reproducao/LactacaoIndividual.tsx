import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "../../../components/ui/button";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { obterReproducao, type PainelReprodutivo } from "./api";
import { AcoesReprodutivas } from "./AcoesReprodutivas";
import "./reproducao-individual.css";

export type LactacaoIndividualProps = {
  animalId: string; propriedadeId?: number | null; podeLancar: boolean;
  recarregarToken?: number; onMudou?: () => void;
  compor?: (conteudo: ReactNode, acoes: ReactNode) => ReactNode;
};

/** A leitura e os formulários seguem o mesmo núcleo da lactação reprodutiva. */
export function LactacaoIndividual(props: LactacaoIndividualProps) {
  return <ConteudoLactacao key={`${props.animalId}:${props.propriedadeId ?? "consolidado"}`} {...props}/>;
}
function ConteudoLactacao({ animalId, propriedadeId, podeLancar, recarregarToken = 0, onMudou, compor }: LactacaoIndividualProps) {
  const [painel, setPainel] = useState<PainelReprodutivo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const geracao = useRef(0);
  const carregar = useCallback(async () => {
    const pedido = ++geracao.current;
    setErro(null); setCarregando(true);
    try { const dados = await obterReproducao(animalId, propriedadeId ?? undefined); if (pedido === geracao.current) setPainel(dados); }
    catch (e) { if (pedido === geracao.current) setErro(e instanceof Error ? e.message : String(e)); }
    finally { if (pedido === geracao.current) setCarregando(false); }
  }, [animalId, propriedadeId]);
  useEffect(() => { void carregar(); return () => { geracao.current++; }; }, [carregar, recarregarToken]);
  const aviso = <><ErrorBox erro={erro}/>{erro && <Button variant="outline" onClick={() => void carregar()}>Tentar carregar lactação novamente</Button>}{carregando && <p role="status">Carregando lactação…</p>}</>;
  return painel ? <AcoesReprodutivas modo="lactacao" painel={painel} animalId={animalId} propriedadeId={propriedadeId ?? undefined} podeLancar={podeLancar} comporLactacao={compor ? (conteudo, acoes) => compor(<>{aviso}{conteudo}</>, acoes) : undefined} onMudou={async () => { await carregar(); onMudou?.(); }}/>
    : compor ? compor(aviso, null) : <div className="repro-individual lactacao-individual">{aviso}</div>;
}
