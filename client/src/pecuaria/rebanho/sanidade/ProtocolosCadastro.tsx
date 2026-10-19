import { SelectCampo } from "@/financeiro/SelectCampo";
import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Copy, Send, PowerOff, ClipboardList } from "lucide-react";
import { Button, ErrorBox, Pill } from "../../../financeiro/financeiro-ui";
import {
  classeInput,
  PainelCadastro,
} from "../../../financeiro/PainelCadastro";
import { listarProdutos, type ProdutoDTO } from "../../../estoque/api";
import { listarTiposAplicacao, reqSanidade, type TipoAplicacao } from "./api";
import { navegarPara } from "../../../router";
import type { TipoExame } from "./CadastrosSanitarios";
import { BuscaLista } from "../../../components/BuscaLista";
import { PaginacaoLocal, usePaginacaoLocal } from "@/components/PaginacaoLocal";
type Etapa = {
  diaRelativo: number;
  tipo: "APLICACAO" | "EXAME";
  produtoId: string;
  tipoExameId: string;
  tipoAplicacaoId: string;
  dose: string;
  unidade: string;
};
type Protocolo = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  versao: number;
  publicadoEm: string | null;
  etapas: Array<
    Omit<
      Etapa,
      "produtoId" | "tipoExameId" | "tipoAplicacaoId" | "dose" | "unidade"
    > & {
      produtoId: string | null;
      tipoExameId: string | null;
      tipoAplicacaoId: string | null;
      dose: string | null;
      unidade: string | null;
      tipoAplicacaoNomeSnapshot: string | null;
    }
  >;
};
const nova = (): Etapa => ({
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
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [tipos, setTipos] = useState<TipoAplicacao[]>([]);
  const [exames, setExames] = useState<TipoExame[]>([]);
  const [id, setId] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [etapas, setEtapas] = useState<Etapa[]>([nova()]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [erroCatalogos, setErroCatalogos] = useState<string | null>(null);
  const [catalogosProntos, setCatalogosProntos] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Protocolo | null>(null);
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
    reqSanidade<Protocolo[]>("/protocolos?incluirInativos=true")
      .then((p) => { if (vivo && geracao.current === atual) setProtocolos(p); })
      .catch((e: unknown) => { if (vivo) setErroLista(e instanceof Error ? e.message : "Não conseguimos carregar os protocolos."); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [revisao]);
  useEffect(() => {
    let vivo = true;
    setCatalogosProntos(false); setErroCatalogos(null);
    Promise.all([
      listarProdutos({ ativo: true }),
      listarTiposAplicacao(),
      reqSanidade<TipoExame[]>("/tipos-exame?incluirInativos=true"),
    ])
      .then(([ps, ts, es]) => {
        if (vivo) {
          setProdutos(ps);
          setTipos(ts.filter((t) => t.ativo));
          setExames(es);
          setCatalogosProntos(true);
        }
      })
      .catch((e: unknown) => {
        if (vivo) setErroCatalogos(e instanceof Error ? e.message : String(e));
      });
    return () => {
      vivo = false;
    };
  }, [revisao]);
  async function enviar(path: string, body: object, method = "POST") {
    if (!podeLancar || trava.current) return;
    trava.current = true;
    setOcupado(true);
    setErro(null);
    setAviso(null);
    const atual = geracao.current;
    try {
      const atualizado = await reqSanidade<Protocolo>(path, { method, body: JSON.stringify(body) });
      if (!vivoRef.current || geracao.current !== atual) return;
      setProtocolos((lista) => lista.some((p) => p.id === atualizado.id)
        ? lista.map((p) => p.id === atualizado.id ? { ...p, ...atualizado, etapas: atualizado.etapas ?? p.etapas } : p)
        : [...lista, atualizado]);
      setAberto(false);
      setAviso(path.endsWith("/publicacao") ? "Versão publicada." : path.endsWith("/inativacao") ? "Versão inativada." : "Rascunho salvo.");
    } catch (e) {
      if (vivoRef.current) setErro(e instanceof Error ? e.message : String(e));
    } finally {
      trava.current = false;
      if (vivoRef.current) setOcupado(false);
    }
  }
  function editar(p?: Protocolo) {
    if (!podeLancar || trava.current || !catalogosProntos) return;
    setErro(null);
    setId(p?.publicadoEm ? null : (p?.id ?? null));
    setNome(p?.nome ?? "");
    setDescricao(p?.descricao ?? "");
    setEtapas(
      p
        ? p.etapas.map((e) => ({
            ...e,
            produtoId: e.produtoId ?? "",
            tipoExameId: e.tipoExameId ?? "",
            tipoAplicacaoId: e.tipoAplicacaoId ?? "",
            dose: e.dose ?? "",
            unidade: e.unidade ?? "ML",
          }))
        : [nova()],
    );
    setAberto(true);
  }
  const mudar = (i: number, patch: Partial<Etapa>) =>
    setEtapas((es) => es.map((e, j) => (i === j ? { ...e, ...patch } : e)));
  const visiveis = protocolos.filter(p => p.nome.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  const paginacao = usePaginacaoLocal(visiveis, busca);
  return (
    <section className="pec-protocolos-cadastro">
      <ErrorBox erro={erro} />
      <ErrorBox erro={erroLista} />
      <ErrorBox erro={erroCatalogos} />
      {aviso && <p role="status" className="py-3 text-sm">{aviso}</p>}
      {ocupado && <p role="status" className="py-3 text-sm">Atualizando protocolo…</p>}
      {(erroLista || erroCatalogos) && <Button secondary disabled={ocupado} onClick={() => setRevisao((v) => v + 1)}>Tentar novamente</Button>}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="h2">Protocolos sanitários</h2>
      {!carregando && !erroLista && <p className="mt-2 text-xs text-ink-3" aria-label="Resumo dos protocolos">{protocolos.length} versões cadastradas · {protocolos.filter(p => p.ativo && p.publicadoEm).length} publicadas e ativas · {protocolos.filter(p => !p.publicadoEm).length} rascunhos</p>}
      </div>
        {podeLancar && <Button disabled={ocupado || !catalogosProntos || carregando} onClick={() => editar()}>Novo protocolo</Button>}
      </div>
      <div className="pec-protocolos-busca"><BuscaLista rotulo="Buscar protocolo" placeholder="Buscar protocolo pelo nome" valor={busca} onChange={setBusca} /></div>
      <p className="mb-4 text-sm text-ink-3">Abra o nome para revisar as etapas. Versões publicadas não são editadas: crie uma nova versão para alterar o planejamento. Planejar etapas não movimenta o estoque.</p>
      {carregando ? <p role="status" className="py-4">Carregando protocolos…</p> : <div className="overflow-x-auto rounded border border-border"><table aria-label="Protocolos sanitários" className="w-full text-left text-sm">
        <thead className="bg-surface-2"><tr><th className="p-4">Nome</th><th className="p-4">Tipo</th><th className="p-4">Versão</th><th className="p-4">Situação</th><th className="p-4">Etapas</th><th className="p-4">Ações</th></tr></thead>
        <tbody className="divide-y divide-border">{paginacao.itens.map((p) => <Fragment key={p.id}>
          <tr><td className="p-4"><button type="button" aria-expanded={detalhe?.id === p.id} aria-controls={`protocolo-${p.id}`} aria-label={`Ver etapas de ${p.nome} v${p.versao}`} onClick={() => setDetalhe(detalhe?.id === p.id ? null : p)} className="flex items-center gap-3 text-left">{detalhe?.id === p.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}<span>{p.nome}</span></button></td>
            <td className="p-4">{p.etapas.every((e) => e.tipo === "EXAME") ? "Protocolo de exames" : "Protocolo sanitário"}</td>
            <td className="whitespace-nowrap p-4">v{p.versao} · <Pill tone={p.publicadoEm ? "blue" : "amber"}>{p.publicadoEm ? "Publicado" : "Rascunho"}</Pill></td>
            <td className="p-4"><Pill tone={p.ativo ? "green" : "neutral"}>{p.ativo ? "Ativo" : "Inativo"}</Pill></td><td className="p-4">{p.etapas.length}</td><td className="p-4"><div className="flex justify-end gap-1">            {podeLancar && <>
              <button type="button" disabled={ocupado || !catalogosProntos} aria-label={`${p.publicadoEm ? "Nova versão de" : "Editar rascunho de"} ${p.nome} v${p.versao}`} onClick={() => editar(p)} className="inline-flex items-center gap-2 rounded-lg p-2 text-ink-2 hover:bg-surface-2 disabled:opacity-45">{p.publicadoEm ? <Copy size={16} /> : <Pencil size={16} />}{p.publicadoEm ? "Nova versão" : "Editar"}</button>
              {!p.publicadoEm && <button type="button" disabled={ocupado} aria-label={`Publicar ${p.nome} v${p.versao}`} onClick={() => void enviar(`/protocolos/${p.id}/publicacao`, {})} className="inline-flex items-center gap-2 rounded-lg p-2 text-ink-2 hover:bg-surface-2 disabled:opacity-45"><Send size={16} />Publicar</button>}
              {p.ativo && <button type="button" disabled={ocupado} aria-label={`Inativar ${p.nome} v${p.versao}`} onClick={() => void enviar(`/protocolos/${p.id}/inativacao`, {})} className="inline-flex items-center gap-2 rounded-lg p-2 text-ink-2 hover:bg-surface-2 disabled:opacity-45"><PowerOff size={16} />Inativar</button>}
            </>}</div></td>
          </tr>
          {detalhe?.id === p.id && <tr><td colSpan={6} id={`protocolo-${p.id}`} className="bg-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4"><div><h3 className="h2">{p.nome} · v{p.versao}</h3><Pill tone={p.publicadoEm ? "green" : "amber"}>{p.publicadoEm ? "Versão publicada" : "Rascunho"}</Pill></div><div className="flex flex-wrap items-center gap-4">{podeLancar && <Button secondary disabled={ocupado || !catalogosProntos} onClick={() => editar(p)}>{p.publicadoEm ? "Criar nova versão" : "Editar rascunho"}</Button>}<a href="/pecuaria/sanidade" className="text-mast underline" onClick={(e) => { if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); navegarPara("/pecuaria/sanidade"); } }}>Abrir agenda sanitária</a></div></div>
            {p.descricao && <p className="mb-4 text-sm">{p.descricao}</p>}
            <ol className="pec-protocolo-linha-tempo" aria-label="Sequência planejada">
              {p.etapas.map((e, i) => <li key={i}>
                <span>D{e.diaRelativo}</span>
                <strong>Etapa {i + 1}</strong>
                <small>{e.tipoAplicacaoNomeSnapshot ?? (e.tipo === "EXAME" ? "Exame" : "Aplicação")}</small>
              </li>)}
            </ol>
            <table aria-label={`Etapas de ${p.nome}`} className="w-full border border-border text-sm"><thead><tr><th className="p-3">Etapa</th><th className="p-3">Tipo e produto ou exame</th><th className="p-3">Dia relativo</th></tr></thead><tbody className="divide-y divide-border">{p.etapas.map((e, i) => <tr key={i}><td className="p-3"><span className="sr-only">Etapa {i + 1} · Dia {e.diaRelativo}</span>{i + 1}</td><td className="p-3">{e.tipoAplicacaoNomeSnapshot ?? (e.tipo === "EXAME" ? "Exame" : "Aplicação")} · {produtos.find((pr) => pr.id === e.produtoId)?.nome ?? exames.find((t) => t.id === e.tipoExameId)?.nome ?? (e.produtoId ? "Produto do histórico" : "Exame do histórico")} {e.dose} {e.unidade}</td><td className="p-3">D{e.diaRelativo}</td></tr>)}</tbody></table>
          </td></tr>}
        </Fragment>)}</tbody>
      </table></div>}
      {!carregando && !erroLista && <PaginacaoLocal controles={paginacao.controles} substantivo="protocolos" id="pagina-protocolos" />}
      {!carregando && !erroLista && protocolos.length > 0 && !visiveis.length && <p className="p-4 text-sm text-ink-3">Nenhum protocolo corresponde à busca.</p>}
      {!carregando && !erroLista && !protocolos.length && (
        <p className="mt-3 text-sm">
          Nenhum protocolo. Planejar etapas não baixa medicamentos do estoque.
        </p>
      )}
      {aberto && podeLancar && (
        <PainelCadastro
          aberto
          icon={ClipboardList}
          titulo={
            id ? "Editar protocolo em rascunho" : "Nova versão de protocolo"
          }
          onFechar={() => {
            if (!ocupado) setAberto(false);
          }}
          rodape={
            <Button type="submit" form="form-protocolo" disabled={ocupado}>
              {ocupado ? "Salvando…" : "Salvar rascunho"}
            </Button>
          }
        >
          <form
            data-pec-formulario
            id="form-protocolo"
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar(
                `/protocolos${id ? `/${id}` : ""}`,
                {
                  nome,
                  descricao: descricao || null,
                  etapas: etapas.map((et) => ({
                    diaRelativo: et.diaRelativo,
                    tipo: et.tipo,
                    ...(et.tipo === "APLICACAO"
                      ? {
                          produtoId: et.produtoId,
                          tipoAplicacaoId: et.tipoAplicacaoId,
                          dose: Number(et.dose),
                          unidade: et.unidade,
                        }
                      : { tipoExameId: et.tipoExameId }),
                  })),
                },
                id ? "PATCH" : "POST",
              );
            }}
          >
            <ErrorBox erro={erro} />
            <p className="text-sm text-ink-3">Revise a sequência antes de salvar. O dia 0 é o início do protocolo; as etapas seguintes usam dias relativos a esse início. Salvar cria apenas um rascunho, sem publicar ou executar etapas.</p>
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
            {etapas.map((et, i) => (
              <fieldset
                key={i}
                className="grid gap-3 rounded-lg border border-border p-3"
              >
                <legend>Etapa {i + 1}</legend>
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
                  <SelectCampo
                    value={et.tipo}
                    onValueChange={(valorSelecionado) =>
                      mudar(i, { tipo: valorSelecionado as Etapa["tipo"] })}
                    className={classeInput}
                  >
                    <option value="APLICACAO">Aplicação</option>
                    <option value="EXAME">Exame</option>
                  </SelectCampo>
                </label>
                {et.tipo === "APLICACAO" ? (
                  <>
                    <label>
                      Tipo de aplicação
                      <SelectCampo
                        required
                        value={et.tipoAplicacaoId}
                        onValueChange={(valorSelecionado) =>
                          mudar(i, { tipoAplicacaoId: valorSelecionado })}
                        className={classeInput}
                      >
                        <option value="">Selecione</option>
                        {tipos.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nome}
                          </option>
                        ))}
                      </SelectCampo>
                    </label>
                    <label>
                      Produto
                      <SelectCampo
                        required
                        value={et.produtoId}
                        onValueChange={(valorSelecionado) =>
                          mudar(i, {
                            produtoId: valorSelecionado,
                            unidade:
                              produtos.find((p) => p.id === valorSelecionado)
                                ?.unidade ?? "ML",
                          })}
                        className={classeInput}
                      >
                        <option value="">Selecione</option>
                        {produtos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                          </option>
                        ))}
                      </SelectCampo>
                    </label>
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
                ) : (
                  <label>
                    Tipo de exame
                    <SelectCampo
                      required
                      value={et.tipoExameId}
                      onValueChange={(valorSelecionado) =>
                        mudar(i, { tipoExameId: valorSelecionado })}
                      className={classeInput}
                    >
                      <option value="">Selecione</option>
                      {exames.filter((t) => t.ativo).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome}
                        </option>
                      ))}
                    </SelectCampo>
                  </label>
                )}
                <Button
                  secondary
                  disabled={etapas.length === 1}
                  onClick={() =>
                    setEtapas((es) => es.filter((_, j) => i !== j))
                  }
                >
                  Remover etapa
                </Button>
              </fieldset>
            ))}
            <section aria-label="Revisão das etapas" className="border-t border-border pt-4">
              <h3 className="font-semibold">Revisão das etapas</h3>
              <ol className="mt-2 space-y-2 text-sm">
                {etapas.map((et, i) => <li key={i}>Etapa {i + 1} · Dia {et.diaRelativo} · {et.tipo === "EXAME"
                  ? `Exame: ${exames.find(e => e.id === et.tipoExameId)?.nome ?? "selecione o tipo"}`
                  : `Aplicação: ${produtos.find(p => p.id === et.produtoId)?.nome ?? "selecione o produto"} · ${et.dose || "quantidade pendente"} ${et.unidade}`}</li>)}
              </ol>
            </section>
            <Button
              secondary
              onClick={() => setEtapas((es) => [...es, nova()])}
            >
              Adicionar etapa
            </Button>
          </form>
        </PainelCadastro>
      )}
    </section>
  );
}
