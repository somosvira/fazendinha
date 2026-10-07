import { useEffect, useRef, useState } from "react";
import { Eye, Pencil, Copy, Send, PowerOff } from "lucide-react";
import { Button, ErrorBox, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import {
  classeInput,
  PainelCadastro,
} from "../../../financeiro/PainelCadastro";
import { listarProdutos, type ProdutoDTO } from "../../../estoque/api";
import { listarTiposAplicacao, reqSanidade, type TipoAplicacao } from "./api";
import type { TipoExame } from "./CadastrosSanitarios";
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
  return (
    <section className="rounded-xl border border-border p-4">
      <ErrorBox erro={erro} />
      <ErrorBox erro={erroLista} />
      <ErrorBox erro={erroCatalogos} />
      {aviso && <p role="status" className="py-3 text-sm">{aviso}</p>}
      {ocupado && <p role="status" className="py-3 text-sm">Atualizando protocolo…</p>}
      {(erroLista || erroCatalogos) && <Button secondary disabled={ocupado} onClick={() => setRevisao((v) => v + 1)}>Tentar novamente</Button>}
      <h2 className="font-semibold">Protocolos sanitários</h2>
      {podeLancar && (
        <Button className="mt-3" disabled={ocupado || !catalogosProntos || carregando} onClick={() => editar()}>
          Novo protocolo
        </Button>
      )}
      {carregando ? <p role="status" className="py-4">Carregando protocolos…</p> : <TabelaFinanceira
        rotulo="Protocolos sanitários" itens={protocolos} chaveDe={(p) => p.id}
        colunas={[
          { chave: "nome", titulo: "Nome", principal: true, celula: (p) => p.nome },
          { chave: "versao", titulo: "Versão", celula: (p) => `v${p.versao}` },
          { chave: "publicacao", titulo: "Publicação", celula: (p) => <Pill tone={p.publicadoEm ? "blue" : "amber"}>{p.publicadoEm ? "Publicado" : "Rascunho"}</Pill> },
          { chave: "situacao", titulo: "Situação", celula: (p) => <Pill tone={p.ativo ? "green" : "neutral"}>{p.ativo ? "Ativo" : "Inativo"}</Pill> },
          { chave: "etapas", titulo: "Etapas", celula: (p) => p.etapas.length },
          { chave: "acoes", titulo: "Ações", acoes: true, celula: (p) => <div className="flex justify-end gap-1">
            <button type="button" aria-label={`Ver etapas de ${p.nome} v${p.versao}`} onClick={() => setDetalhe(p)} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2"><Eye size={16} /></button>
            {podeLancar && <>
              <button type="button" disabled={ocupado || !catalogosProntos} aria-label={`${p.publicadoEm ? "Nova versão de" : "Editar rascunho de"} ${p.nome} v${p.versao}`} onClick={() => editar(p)} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 disabled:opacity-45">{p.publicadoEm ? <Copy size={16} /> : <Pencil size={16} />}</button>
              {!p.publicadoEm && <button type="button" disabled={ocupado} aria-label={`Publicar ${p.nome} v${p.versao}`} onClick={() => void enviar(`/protocolos/${p.id}/publicacao`, {})} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 disabled:opacity-45"><Send size={16} /></button>}
              {p.ativo && <button type="button" disabled={ocupado} aria-label={`Inativar ${p.nome} v${p.versao}`} onClick={() => void enviar(`/protocolos/${p.id}/inativacao`, {})} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 disabled:opacity-45"><PowerOff size={16} /></button>}
            </>}
          </div> },
        ]} />}
      {!carregando && !erroLista && !protocolos.length && (
        <p className="mt-3 text-sm">
          Nenhum protocolo. Planejar etapas não baixa medicamentos do estoque.
        </p>
      )}
      {detalhe && <PainelCadastro aberto titulo={`${detalhe.nome} · v${detalhe.versao}`} onFechar={() => setDetalhe(null)} rodape={<Button secondary onClick={() => setDetalhe(null)}>Fechar</Button>}>
        {detalhe.descricao && <p className="text-sm">{detalhe.descricao}</p>}
        <ol className="grid gap-3">
          {detalhe.etapas.map((e, i) => <li key={i} className="rounded-lg border border-border p-3">
            <p className="font-semibold">Etapa {i + 1} · Dia {e.diaRelativo}</p>
            <p className="text-sm">{e.tipoAplicacaoNomeSnapshot ?? (e.tipo === "EXAME" ? "Exame" : "Aplicação")} · {produtos.find((pr) => pr.id === e.produtoId)?.nome ?? exames.find((t) => t.id === e.tipoExameId)?.nome ?? (e.produtoId ? "Produto do histórico" : "Exame do histórico")} {e.dose} {e.unidade}</p>
          </li>)}
        </ol>
      </PainelCadastro>}
      {aberto && podeLancar && (
        <PainelCadastro
          aberto
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
                  <select
                    value={et.tipo}
                    onChange={(e) =>
                      mudar(i, { tipo: e.target.value as Etapa["tipo"] })
                    }
                    className={classeInput}
                  >
                    <option value="APLICACAO">Aplicação</option>
                    <option value="EXAME">Exame</option>
                  </select>
                </label>
                {et.tipo === "APLICACAO" ? (
                  <>
                    <label>
                      Tipo de aplicação
                      <select
                        required
                        value={et.tipoAplicacaoId}
                        onChange={(e) =>
                          mudar(i, { tipoAplicacaoId: e.target.value })
                        }
                        className={classeInput}
                      >
                        <option value="">Selecione</option>
                        {tipos.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Produto
                      <select
                        required
                        value={et.produtoId}
                        onChange={(e) =>
                          mudar(i, {
                            produtoId: e.target.value,
                            unidade:
                              produtos.find((p) => p.id === e.target.value)
                                ?.unidade ?? "ML",
                          })
                        }
                        className={classeInput}
                      >
                        <option value="">Selecione</option>
                        {produtos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                          </option>
                        ))}
                      </select>
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
                    <select
                      required
                      value={et.tipoExameId}
                      onChange={(e) =>
                        mudar(i, { tipoExameId: e.target.value })
                      }
                      className={classeInput}
                    >
                      <option value="">Selecione</option>
                      {exames.filter((t) => t.ativo).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome}
                        </option>
                      ))}
                    </select>
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
