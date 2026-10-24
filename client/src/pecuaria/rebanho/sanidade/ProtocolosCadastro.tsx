import { useConsultaCadastroProtocolos } from "../protocolos/useConsultaCadastroProtocolos";
import "../protocolos/protocolos.css";
import { urlCadastroProtocolo } from "../protocolos/rotas-cadastro";
import { CatalogoModelosProtocolos } from "../protocolos/CatalogoModelosProtocolos";
import { listarCadastrosProtocolos, type CadastroProtocoloMeta } from "../protocolos/cadastros-api";
import { useEffect, useRef, useState } from "react";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { reqSanidade } from "./api";
import { navegarPara } from "../../../router";
type Protocolo = CadastroProtocoloMeta;
export function ProtocolosCadastro({ podeLancar }: { podeLancar: boolean }) {
  const [protocolos, setProtocolos] = useState<Protocolo[]>([]);
  const { pagina: paginaProtocolos, setPagina: setPaginaProtocolos, busca, setBusca, situacao, setSituacao } = useConsultaCadastroProtocolos();
  const [totalProtocolos, setTotalProtocolos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const trava = useRef(false);
  const vivoRef = useRef(true);
  const geracao = useRef(0);
  useEffect(() => {
    vivoRef.current = true;
    return () => { vivoRef.current = false; };
  }, []);
  useEffect(() => {
    let vivo = true;
    const atual = ++geracao.current;
    setCarregando(true); setErroLista(null);
    listarCadastrosProtocolos("SANITARIO", paginaProtocolos, busca, situacao)
      .then((p) => { if (vivo && geracao.current === atual) { setProtocolos(p.itens); setTotalProtocolos(p.total); setPaginaProtocolos(p.pagina); } })
      .catch((e: unknown) => { if (vivo) setErroLista(e instanceof Error ? e.message : "Não conseguimos carregar os protocolos."); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [revisao, paginaProtocolos, busca, situacao]);
  async function enviar(path: string, body: object, method = "POST") {
    if (!podeLancar || trava.current) return;
    trava.current = true;
    setOcupado(true);
    setErro(null);
    setAviso(null);
    const atual = geracao.current;
    try {
      await reqSanidade(path, { method, body: JSON.stringify(body) });
      if (!vivoRef.current || geracao.current !== atual) return;
      setRevisao(v => v + 1);
      setAviso(path.endsWith("/publicacao") ? "Versão publicada." : path.endsWith("/inativacao") ? "Versão inativada." : "Protocolo salvo.");
    } catch (e) {
      if (vivoRef.current) setErro(e instanceof Error ? e.message : String(e));
    } finally {
      trava.current = false;
      if (vivoRef.current) setOcupado(false);
    }
  }
  function editar(p?: Protocolo, derivar = false) {
    if (!podeLancar || ocupado) return;
    navegarPara(urlCadastroProtocolo("SANITARIO", p?.id, !!p && !derivar && !p.publicadoEm && !p.utilizada));
  }
  return <section className="protocolos-pagina protocolos-superficie pec-protocolos-cadastro min-w-0 w-full">
    <ErrorBox erro={erro}/>
    {aviso && <p role="status" className="py-3 text-sm">{aviso}</p>}
    {ocupado && <p role="status" className="py-3 text-sm">Atualizando protocolo…</p>}
    <CatalogoModelosProtocolos tipo="SANITARIO" protocolos={protocolos} total={totalProtocolos} pagina={paginaProtocolos}
      carregando={carregando} erro={erroLista} ocupado={ocupado} podeLancar={podeLancar}
      busca={busca} situacao={situacao} onBusca={valor=>{setBusca(valor);setPaginaProtocolos(1);}}
      onSituacao={valor=>{setSituacao(valor);setPaginaProtocolos(1);}} onPagina={setPaginaProtocolos}
      onRecarregar={()=>setRevisao(v=>v+1)} onNovo={()=>editar()} onNovaVersao={p=>editar(p,true)} onConcluir={p=>editar(p)}
      onInativar={p=>void enviar(`/protocolos/${p.id}/inativacao`,{})}/>
  </section>;
}
