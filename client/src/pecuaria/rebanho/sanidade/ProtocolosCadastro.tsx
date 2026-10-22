import "../protocolos/protocolos.css";
import { SeletorCatalogoProtocolo } from "../protocolos/SeletorCatalogoProtocolo";
import { CamposReferenciasCusto, type ReferenciasCustoCadastro } from "../protocolos/CamposReferenciasCusto";
import { CamposMomentoAcao, type MomentoCadastro, type SubtipoAplicacaoCadastro } from "../protocolos/CamposMomentoAcao";
import { AcoesCadastroPersistidas, EditorAcoesCadastro } from "../protocolos/AcoesCadastro";
import { listarCadastrosProtocolos, obterCadastroProtocolo, type CadastroProtocoloMeta } from "../protocolos/cadastros-api";
import { Paginacao } from "../ui";
import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Copy, Send, PowerOff } from "lucide-react";
import { Button, ErrorBox, Pill } from "../../../financeiro/financeiro-ui";
import {
  classeInput,
  PainelCadastro,
} from "../../../financeiro/PainelCadastro";
import { reqSanidade } from "./api";
import { navegarPara } from "../../../router";
type Etapa = {
  referenciasCusto?: ReferenciasCustoCadastro;
  ordem?: number;
  momento?: MomentoCadastro | null;
  subtipo?: SubtipoAplicacaoCadastro;
  diaRelativo: number;
  tipo: "APLICACAO" | "EXAME" | "MANEJO" | "RETIRADA";
  produtoId: string;
  tipoExameId: string;
  tipoAplicacaoId: string;
  dose: string;
  unidade: string;
};
type Protocolo = CadastroProtocoloMeta;
type EtapaPersistida = Omit<Etapa, "produtoId" | "tipoExameId" | "tipoAplicacaoId" | "dose" | "unidade"> & {
  produtoId: string | null; tipoExameId: string | null; tipoAplicacaoId: string | null;
  dose: string | null; unidade: string | null; tipoAplicacaoNomeSnapshot: string | null;
  configuracao?: { subtipo?: SubtipoAplicacaoCadastro; referenciasCusto?:ReferenciasCustoCadastro } | null;
};
function etapaEditavel(e: EtapaPersistida): Etapa {
  return { ...e, referenciasCusto:e.configuracao?.referenciasCusto, momento: e.momento ? { nome: e.momento.nome, ordem: e.momento.ordem } : undefined,
    subtipo: e.tipo === "APLICACAO" ? e.configuracao?.subtipo : undefined,
    produtoId: e.produtoId ?? "", tipoExameId: e.tipoExameId ?? "", tipoAplicacaoId: e.tipoAplicacaoId ?? "", dose: e.dose ?? "", unidade: e.unidade ?? "ML" };
}
const nova = (momento: MomentoCadastro = { nome: "D0", ordem: 1 }): Etapa => ({
  momento: { ...momento },
  diaRelativo: 0,
  tipo: "APLICACAO",
  produtoId: "",
  tipoExameId: "",
  tipoAplicacaoId: "",
  dose: "",
  unidade: "ML",
});
export function ProtocolosCadastro({ podeLancar }: { podeLancar: boolean }) {
  const [protocolos, setProtocolos] = useState<Protocolo[]>([]);
  const [paginaProtocolos, setPaginaProtocolos] = useState(1);
  const [totalProtocolos, setTotalProtocolos] = useState(0);
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("TODAS");
  const [origemCadastro, setOrigemCadastro] = useState<Protocolo | null>(null);
  const [acoesCompletas, setAcoesCompletas] = useState(true);
  const [id, setId] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [etapas, setEtapas] = useState<Etapa[]>([nova()]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Protocolo | null>(null);
  const trava = useRef(false);
  const aberturaCadastro = useRef(0);
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
      setDetalhe(null);
      setAberto(false);
      setAviso(path.endsWith("/publicacao") ? "Versão publicada." : path.endsWith("/inativacao") ? "Versão inativada." : "Rascunho salvo.");
    } catch (e) {
      if (vivoRef.current) setErro(e instanceof Error ? e.message : String(e));
    } finally {
      trava.current = false;
      if (vivoRef.current) setOcupado(false);
    }
  }
  async function editar(p?: Protocolo) {
    if (!podeLancar || trava.current || aberto) return;
    setErro(null);
    const pedido = ++aberturaCadastro.current;
    const listaAtual = geracao.current;
    try {
      const meta = p ? await obterCadastroProtocolo(p.id) : null;
      if (!vivoRef.current || aberturaCadastro.current !== pedido || geracao.current !== listaAtual) return;
      setId(meta?.publicadoEm || meta?.utilizada ? null : (meta?.id ?? null));
      setNome(meta?.nome ?? ""); setDescricao(meta?.descricao ?? "");
      setOrigemCadastro(meta); setAcoesCompletas(!meta);
      setEtapas(meta ? [] : [nova()]); setAberto(true);
    } catch (e) { if (vivoRef.current && aberturaCadastro.current === pedido) setErro(e instanceof Error ? e.message : String(e)); }
  }
  const mudar = (i: number, patch: Partial<Etapa>) =>
    setEtapas((es) => es.map((e, j) => (i === j ? { ...e, ...patch } : e)));
  return (
    <section className="protocolos-pagina protocolos-superficie pec-protocolos-cadastro min-w-0 w-full">
      <ErrorBox erro={erro} />
      <ErrorBox erro={erroLista} />
      {aviso && <p role="status" className="py-3 text-sm">{aviso}</p>}
      {ocupado && <p role="status" className="py-3 text-sm">Atualizando protocolo…</p>}
      {erroLista && <Button secondary disabled={ocupado} onClick={() => setRevisao((v) => v + 1)}>Tentar novamente</Button>}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="h2">Protocolos sanitários</h2>
        {podeLancar && <Button disabled={ocupado || carregando} onClick={() => editar()}>Novo protocolo</Button>}
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2"><label>Buscar protocolos<input type="search" disabled={aberto} className={classeInput} value={busca} onChange={e => { setBusca(e.target.value); setPaginaProtocolos(1); }} /></label><label>Situação<select disabled={aberto} className={classeInput} value={situacao} onChange={e => { setSituacao(e.target.value); setPaginaProtocolos(1); }}><option value="TODAS">Todas</option><option value="RASCUNHO">Rascunhos ativos</option><option value="PUBLICADA">Publicadas ativas</option><option value="INATIVA">Inativas</option></select></label></div>
      {carregando ? <p role="status" className="py-4">Carregando protocolos…</p> : <div className="overflow-x-auto rounded border border-border"><table aria-label="Protocolos sanitários" className="w-full text-left text-sm">
        <thead className="bg-surface-2"><tr><th className="p-4">Nome</th><th className="p-4">Tipo</th><th className="p-4">Versão</th><th className="p-4">Situação</th><th className="p-4">Etapas</th><th className="p-4">Ações</th></tr></thead>
        <tbody className="divide-y divide-border">{protocolos.map((p) => <Fragment key={p.id}>
          <tr><td className="p-4"><button type="button" aria-expanded={detalhe?.id === p.id} aria-controls={`protocolo-${p.id}`} aria-label={`Ver etapas de ${p.nome} v${p.versao}`} onClick={() => setDetalhe(detalhe?.id === p.id ? null : p)} className="flex items-center gap-3 text-left">{detalhe?.id === p.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}<span>{p.nome}</span></button></td>
            <td className="p-4">Protocolo sanitário</td>
            <td className="whitespace-nowrap p-4">v{p.versao} · <Pill tone={p.publicadoEm ? "blue" : "amber"}>{p.publicadoEm ? "Publicado" : "Rascunho"}</Pill></td>
            <td className="p-4"><Pill tone={p.ativo ? "green" : "neutral"}>{p.ativo ? "Ativo" : "Inativo"}</Pill></td><td className="p-4">{p.totalEtapas}</td><td className="p-4"><div className="flex justify-end gap-1">            {podeLancar && <>
              <button type="button" disabled={ocupado} aria-label={`${p.publicadoEm ? "Nova versão de" : "Editar rascunho de"} ${p.nome} v${p.versao}`} onClick={() => editar(p)} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 disabled:opacity-45">{p.publicadoEm ? <Copy size={16} /> : <Pencil size={16} />}{p.publicadoEm ? "Nova versão" : "Editar"}</button>
              {!p.publicadoEm && <button type="button" disabled={ocupado} aria-label={`Publicar ${p.nome} v${p.versao}`} onClick={() => void enviar(`/protocolos/${p.id}/publicacao`, {})} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 disabled:opacity-45"><Send size={16} />Publicar</button>}
              {p.ativo && <button type="button" disabled={ocupado} aria-label={`Inativar ${p.nome} v${p.versao}`} onClick={() => void enviar(`/protocolos/${p.id}/inativacao`, {})} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 disabled:opacity-45"><PowerOff size={16} />Inativar</button>}
            </>}</div></td>
          </tr>
          {detalhe?.id === p.id && <tr><td colSpan={6} id={`protocolo-${p.id}`} className="bg-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4"><div><h3 className="h2">{p.nome} · v{p.versao}</h3><Pill tone={p.publicadoEm ? "green" : "amber"}>{p.publicadoEm ? "Versão publicada" : "Rascunho"}</Pill></div><div className="flex flex-wrap items-center gap-4">{podeLancar && <Button secondary disabled={ocupado} onClick={() => editar(p)}>{p.publicadoEm ? "Criar nova versão" : "Editar rascunho"}</Button>}<a href="/pecuaria/sanidade" className="text-mast underline" onClick={(e) => { if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); navegarPara("/pecuaria/sanidade"); } }}>Abrir agenda sanitária</a></div></div>
            {p.descricao && <p className="mb-4 text-sm">{p.descricao}</p>}
            <AcoesCadastroPersistidas<EtapaPersistida> key={p.id} origem={p} renderizar={(e, i) => <p key={i} className="border-b border-border py-3 text-sm"><span className="sr-only">Etapa {i + 1} · Dia {e.diaRelativo}</span><strong>{e.momento?.nome ?? "Etapa legada sem momento"}</strong> · D{e.diaRelativo} · <span>{e.configuracao?.subtipo === "INSERCAO_DISPOSITIVO" ? "Inserção de dispositivo" : e.tipoAplicacaoNomeSnapshot ?? (e.tipo === "EXAME" ? "Exame" : "Aplicação")} · {e.produtoId || e.tipoExameId ? <SeletorCatalogoProtocolo somenteLeitura origem="SANITARIO" opcao={e.produtoId ? "PRODUTO" : "TIPO_EXAME"} rotulo="Referência da ação" valor={e.produtoId ?? e.tipoExameId ?? ""} onChange={()=>{}}/> : "Sem referência de produto ou exame"}</span> {e.dose} {e.unidade}</p>} />
          </td></tr>}
        </Fragment>)}</tbody>
      </table></div>}
      {totalProtocolos > 10 && <Paginacao paginaAtual={paginaProtocolos} totalPaginas={Math.ceil(totalProtocolos / 10)} totalItens={totalProtocolos} itensPorPagina={10} onPaginaChange={p => { if (!aberto) setPaginaProtocolos(p); }} rotulo="protocolos sanitários" idSelect="pagina-cadastro-protocolos" />}
      {!carregando && !erroLista && !protocolos.length && (
        <p className="mt-3 text-sm">
          Nenhum protocolo. Planejar etapas não baixa medicamentos do estoque.
        </p>
      )}
      {aberto && podeLancar && (
        <PainelCadastro
          aberto
          titulo={
            id ? "Editar protocolo em rascunho" : "Nova versão de protocolo"
          }
          onFechar={() => {
            if (!ocupado) { aberturaCadastro.current++; setAberto(false); }
          }}
          rodape={
            <Button type="submit" form="form-protocolo" disabled={ocupado || !acoesCompletas || etapas.length > 100}>
              {ocupado ? "Salvando…" : "Salvar rascunho"}
            </Button>
          }
        >
          <form
            id="form-protocolo"
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!acoesCompletas || etapas.length > 100) return;
              void enviar(
                `/protocolos${id ? `/${id}` : ""}`,
                {
                  nome,
                  descricao: descricao || null,
                  etapas: etapas.map((et) => ({
                    diaRelativo: et.diaRelativo,
                    tipo: et.tipo,
                    referenciasCusto: et.referenciasCusto,
                    ...(et.momento ? { momento: { nome: et.momento.nome.trim(), ordem: et.momento.ordem } } : {}),
                    ...(et.tipo === "APLICACAO"
                      ? {
                          subtipo: et.subtipo ?? "APLICACAO",
                          produtoId: et.produtoId,
                          tipoAplicacaoId: et.tipoAplicacaoId,
                          dose: Number(et.dose),
                          unidade: et.unidade,
                        }
                      : et.tipo === "EXAME" ? { tipoExameId: et.tipoExameId } : {}),
                  })),
                },
                id ? "PATCH" : "POST",
              );
            }}
          >
            <ErrorBox erro={erro} />
            <label>
              Nome
              <input
                required
                minLength={2}
                maxLength={160}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={classeInput}
              />
            </label>
            <label>
              Descrição (opcional)
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className={classeInput} />
            </label>
            {<EditorAcoesCadastro<Etapa> origem={origemCadastro} itens={etapas} onChange={setEtapas} converter={e => ({ ...etapaEditavel(e as EtapaPersistida), ...(e.momento ? { momento: etapas.find(atual => atual.momento?.ordem === e.momento?.ordem)?.momento ?? e.momento } : {}) })} onCompletoChange={setAcoesCompletas} renderizar={(et, i) => (
              <fieldset
                key={i}
                className="grid gap-3 rounded-lg border border-border p-3"
              >
                <legend>Ação {i + 1} · {et.momento?.nome ?? "Etapa legada sem momento"}</legend>
                <CamposMomentoAcao momento={et.momento} momentos={etapas.flatMap(e => e.momento ? [e.momento] : [])}
                  onChange={momento => mudar(i, { momento })}
                  onRenomear={nome => setEtapas(es => es.map(e => e.momento && e.momento.ordem === et.momento?.ordem ? { ...e, momento: { ...e.momento, nome } } : e))}
                  aplicacao={et.tipo === "APLICACAO"} subtipo={et.subtipo} onSubtipoChange={subtipo => mudar(i, { subtipo })} />
                <CamposReferenciasCusto valor={et.referenciasCusto} material={et.tipo === "APLICACAO"} onChange={referenciasCusto => mudar(i, {referenciasCusto})} />
                <label>
                  Dia relativo ao início
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={et.diaRelativo}
                    onChange={(e) =>
                      mudar(i, { diaRelativo: Number(e.target.value) })
                    }
                    className={classeInput}
                  />
                </label>
                <label>
                  Ação
                  <select
                    value={et.tipo}
                    onChange={(e) =>
                      mudar(i, { tipo: e.target.value as Etapa["tipo"], referenciasCusto:et.referenciasCusto ? {servico:et.referenciasCusto.servico} : undefined })
                    }
                    className={classeInput}
                  >
                    <option value="APLICACAO">Aplicação</option>
                    <option value="EXAME">Exame</option><option value="MANEJO">Manejo protocolar</option><option value="RETIRADA">Retirada de dispositivo</option>
                  </select>
                </label>
                {et.tipo === "APLICACAO" ? (
                  <>
                    <SeletorCatalogoProtocolo origem="SANITARIO" opcao="TIPO_APLICACAO" rotulo="Tipo de aplicação" valor={et.tipoAplicacaoId} onChange={tipoAplicacaoId => mudar(i, { tipoAplicacaoId })}/>
                    <SeletorCatalogoProtocolo origem="SANITARIO" opcao="PRODUTO" rotulo="Produto" valor={et.produtoId} onChange={(produtoId, produto) => mudar(i, { produtoId, unidade: produto?.unidade ?? et.unidade })}/>
                    <label>
                      Quantidade prevista ({et.unidade})
                      <input
                        required
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={et.dose}
                        onChange={(e) => mudar(i, { dose: e.target.value })}
                        className={classeInput}
                      />
                    </label>
                  </>
                ) : et.tipo === "EXAME" ? (
                  <SeletorCatalogoProtocolo origem="SANITARIO" opcao="TIPO_EXAME" rotulo="Tipo de exame" valor={et.tipoExameId} onChange={tipoExameId => mudar(i, { tipoExameId })}/>

                ) : <p className="text-sm">{et.tipo === "RETIRADA" ? "A retirada exige a aplicação de inserção válida do mesmo animal. Não devolve estoque." : "Manejo sem aplicação de produto; cada animal recebe seu próprio fato."}</p>}
                <Button
                  secondary
                  disabled={!acoesCompletas || etapas.length === 1}
                  onClick={() =>
                    setEtapas((es) => es.filter((_, j) => i !== j))
                  }
                >
                  Remover ação
                </Button>
              </fieldset>
            )} />}
            <Button
              secondary
              disabled={!acoesCompletas || etapas.length >= 100}
              onClick={() => setEtapas((es) => [...es, nova(es.at(-1)?.momento ?? { nome: `Momento ${es.length + 1}`, ordem: Math.max(0, ...es.map(e => e.momento?.ordem ?? 0)) + 1 })])}
            >
              Adicionar ação
            </Button>
          </form>
        </PainelCadastro>
      )}
    </section>
  );
}
