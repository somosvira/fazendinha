import { useEffect, useRef, useState } from "react";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import {
  obterConfiguracoesFinanceiras,
  type ConfiguracoesFinanceiras,
} from "../../../financeiro/novo-api";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import { dataValida, formatarLitros, hojeOperacional } from "./modelo";
import {
  montarConferencia,
  nomeComponente,
  nomeSituacaoEntrega,
  type PaginaComercial,
  type EntregaComercial,
  type DemonstrativoComercial,
  type ConferenciaDraft,
} from "./comercial-types";
import { CamposConferenciaEntrega } from "./ConferenciaComercialLeite";
import { NovaEntregaComercialLeite } from "./NovaEntregaComercialLeite";
import { NovoDemonstrativoLeite } from "./NovoDemonstrativoLeite";
import { ComprovantesEntregaLeite } from "./ComprovantesEntregaLeite";
import "./operacoes.css";
const dataPt = (valor: string) =>
  valor.slice(0, 10).split("-").reverse().join("/");
const moeda = (valor: string) =>
  Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function ComercialLeite({
  podeLancar,
  podeFinanceiro,
}: {
  podeLancar: boolean;
  podeFinanceiro: boolean;
}) {
  const sitio = getPropriedadeAtiva();
  const [de, setDe] = useState(() => `${hojeOperacional().slice(0, 7)}-01`),
    [ate, setAte] = useState(hojeOperacional),
    [pagina, setPagina] = useState(1),
    [paginaDoc, setPaginaDoc] = useState(1),
    [revisao, setRevisao] = useState(0),
    [resolvido, setResolvido] = useState<number | null>(sitio),
    [entregas, setEntregas] =
      useState<PaginaComercial<EntregaComercial> | null>(null),
    [docs, setDocs] = useState<PaginaComercial<DemonstrativoComercial> | null>(
      null,
    ),
    [config, setConfig] = useState<ConfiguracoesFinanceiras | null>(null),
    [erro, setErro] = useState(""),
    [erroDoc, setErroDoc] = useState(""),
    [erroConfig, setErroConfig] = useState(""),
    [carregando, setCarregando] = useState(false),
    [aviso, setAviso] = useState(""),
    [novaEntrega, setNovaEntrega] = useState(false),
    [novoDoc, setNovoDoc] = useState(false),
    [conferir, setConferir] = useState<EntregaComercial | null>(null),
    [anular, setAnular] = useState<DemonstrativoComercial | null>(null),
    [motivoAnulacao, setMotivoAnulacao] = useState(""),
    [anulando, setAnulando] = useState(false);
  const geracao = useRef(0),
    travaAnulacao = useRef(false);
  useEffect(() => {
    let atual = true;
    setConfig(null);
    setErroConfig("");
    if (podeFinanceiro)
      void obterConfiguracoesFinanceiras()
        .then((c) => {
          if (atual) setConfig(c);
        })
        .catch((e) => {
          if (atual)
            setErroConfig(
              e instanceof Error
                ? e.message
                : "Não foi possível consultar cadastros financeiros.",
            );
        });
    return () => {
      atual = false;
    };
  }, [podeFinanceiro, sitio, revisao]);
  useEffect(() => {
    const atual = ++geracao.current;
    setEntregas(null);
    setDocs(null);
    setErro("");
    setErroDoc("");
    if (!dataValida(de) || !dataValida(ate) || de > ate) {
      setErro("Informe um intervalo de datas válido.");
      setCarregando(false);
      return;
    }
    setCarregando(true);
    const consulta = new URLSearchParams({ de, ate, pagina: String(pagina) });
    const operacoes: Promise<unknown>[] = [
      consultarLeite<PaginaComercial<EntregaComercial>>(
        `/comercial/entregas?${consulta}`,
        sitio,
      )
        .then((r) => {
          if (atual === geracao.current) {
            setEntregas(r);
            setResolvido(r.propriedadeId);
          }
        })
        .catch((e) => {
          if (atual === geracao.current)
            setErro(
              e instanceof Error
                ? e.message
                : "Não foi possível consultar entregas.",
            );
        }),
    ];
    if (podeFinanceiro)
      operacoes.push(
        consultarLeite<PaginaComercial<DemonstrativoComercial>>(
          `/comercial/demonstrativos?${new URLSearchParams({ de, ate, pagina: String(paginaDoc) })}`,
          sitio,
        )
          .then((r) => {
            if (atual === geracao.current) setDocs(r);
          })
          .catch((e) => {
            if (atual === geracao.current)
              setErroDoc(
                e instanceof Error
                  ? e.message
                  : "Não foi possível consultar demonstrativos.",
              );
          }),
      );
    void Promise.allSettled(operacoes).then(() => {
      if (atual === geracao.current) setCarregando(false);
    });
    return () => {
      geracao.current++;
    };
  }, [sitio, de, ate, pagina, paginaDoc, revisao, podeFinanceiro]);
  useEffect(() => {
    setResolvido(sitio);
    setNovaEntrega(false);
    setNovoDoc(false);
    setConferir(null);
    setAnular(null);
    setAviso("");
  }, [sitio]);
  function atualizar() {
    setRevisao((r) => r + 1);
  }
  function alterarPeriodo(campo: "de" | "ate", valor: string) {
    if (campo === "de") setDe(valor);
    else setAte(valor);
    setPagina(1);
    setPaginaDoc(1);
    setNovaEntrega(false);
    setNovoDoc(false);
    setConferir(null);
    setAnular(null);
  }
  async function confirmarAnulacao() {
    if (!anular || travaAnulacao.current || !podeFinanceiro || !podeLancar)
      return;
    if (motivoAnulacao.trim().length < 5) {
      setErroDoc("Explique a anulação com ao menos 5 caracteres.");
      return;
    }
    const atual = geracao.current;
    travaAnulacao.current = true;
    setAnulando(true);
    try {
      await registrarLeite(
        `/comercial/demonstrativos/${anular.id}/anulacao`,
        anular.propriedadeId,
        { versaoEsperada: anular.versao, motivo: motivoAnulacao.trim() },
      );
      if (atual !== geracao.current) return;
      setAnular(null);
      setAviso(
        "Demonstrativo anulado. Alocações liberadas e histórico preservado; estoque e caixa não foram alterados.",
      );
      atualizar();
    } catch (e) {
      if (atual === geracao.current)
        setErroDoc(
          e instanceof Error
            ? e.message
            : "Não foi possível anular o demonstrativo.",
        );
    } finally {
      travaAnulacao.current = false;
      setAnulando(false);
    }
  }
  return (
    <section className="leite-operacoes" aria-label="Comercial do leite">
      <h2 className="leite-titulo-secao">Entregas e demonstrativos</h2>
      <p>
        Volume expedido, aceite do comprador, venda e recebimento são fatos
        separados. Vincule seus documentos sem duplicar litros ou dinheiro.
      </p>
      <div className="leite-form-inline">
        <label>
          Entregas desde
          <input
            type="date"
            value={de}
            disabled={anulando}
            onChange={(e) => alterarPeriodo("de", e.target.value)}
          />
        </label>
        <label>
          Entregas até
          <input
            type="date"
            min={de}
            value={ate}
            disabled={anulando}
            onChange={(e) => alterarPeriodo("ate", e.target.value)}
          />
        </label>
        <button
          className="leite-secondary"
          disabled={carregando || anulando}
          onClick={atualizar}
        >
          Atualizar comercial
        </button>
        {podeLancar && (
          <button
            disabled={resolvido === null || !entregas || carregando}
            onClick={() => {
              setNovaEntrega(true);
              setNovoDoc(false);
            }}
          >
            Registrar entrega
          </button>
        )}
        {podeFinanceiro && podeLancar && (
          <button
            disabled={!config || resolvido === null || !entregas || carregando}
            onClick={() => {
              setNovoDoc(true);
              setNovaEntrega(false);
            }}
          >
            Registrar demonstrativo
          </button>
        )}
      </div>
      {carregando && <p role="status">Consultando documentos comerciais…</p>}
      {erro && <p role="alert">{erro}</p>}
      {erroConfig && podeFinanceiro && <p role="alert">{erroConfig}</p>}
      {aviso && <p role="status">{aviso}</p>}
      {podeLancar && novaEntrega && resolvido !== null && (
        <NovaEntregaComercialLeite
          key={`${sitio}:${de}:${ate}`}
          sitio={resolvido}
          de={de}
          ate={ate}
          podeFinanceiro={podeFinanceiro}
          config={config}
          aoCancelar={() => setNovaEntrega(false)}
          aoSalvar={() => {
            setNovaEntrega(false);
            setAviso(
              "Entrega registrada. O vínculo físico e comercial foi preservado sem duplicar a retirada.",
            );
            atualizar();
          }}
        />
      )}
      {podeLancar &&
        podeFinanceiro &&
        novoDoc &&
        config &&
        resolvido !== null && (
          <NovoDemonstrativoLeite
            key={`${sitio}:${de}:${ate}`}
            sitio={resolvido}
            config={config}
            de={de}
            ate={ate}
            aoCancelar={() => setNovoDoc(false)}
            aoSalvar={() => {
              setNovoDoc(false);
              setAviso(
                "Demonstrativo registrado sobre as entregas e vendas existentes, sem nova saída ou recebimento.",
              );
              atualizar();
            }}
          />
        )}
      <h2>Entregas e conferências</h2>
      {entregas && (
        <>
          <div
            className="leite-tabela-scroll"
            tabIndex={0}
            role="region"
            aria-label="Entregas, com rolagem horizontal"
          >
            <table>
              <caption>Histórico de entregas do sítio</caption>
              <thead>
                <tr>
                  <th>Entrega</th>
                  <th>Volumes</th>
                  <th>Conferência</th>
                  <th>Detalhes e comprovantes</th>
                </tr>
              </thead>
              <tbody>
                {entregas.itens.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {e.referencia}
                      <small>
                        {dataPt(e.data)} ·{" "}
                        {e.parceiroNome ?? "Comprador não informado"} · venda #
                        {e.numeroOperacao}
                      </small>
                      {e.pontoColeta && <small>Ponto: {e.pontoColeta}</small>}
                      {e.horarioColeta && (
                        <small>Horário informado: {e.horarioColeta}</small>
                      )}
                    </td>
                    <td>
                      Expedido: {formatarLitros(Number(e.expedidoLitros))}
                      <br />
                      Aceito:{" "}
                      {e.volumeAceito === null
                        ? "Ainda não informado"
                        : formatarLitros(Number(e.volumeAceito))}
                      {e.volumeAceito !== null &&
                        Number(e.volumeAceito) !== Number(e.expedidoLitros) && (
                          <small>
                            Diferença informada:{" "}
                            {formatarLitros(
                              Number(e.expedidoLitros) - Number(e.volumeAceito),
                            )}
                          </small>
                        )}
                      <small>
                        Já alocado:{" "}
                        {formatarLitros(Number(e.quantidadeFaturada))}
                      </small>
                      {podeFinanceiro && e.valorFaturado !== null && (
                        <small>Valor alocado: {moeda(e.valorFaturado)}</small>
                      )}
                    </td>
                    <td>
                      {nomeSituacaoEntrega(e.situacao)}
                      <small>Versão {e.versao}</small>
                      <p>{e.motivo}</p>
                      {e.destinacaoInformada && (
                        <p>Destinação informada: {e.destinacaoInformada}</p>
                      )}
                      {podeLancar &&
                        (Number(e.quantidadeFaturada) > 0 ? (
                          <p>
                            Anule os demonstrativos ativos no Financeiro antes
                            de revisar o aceite ou a destinação.
                          </p>
                        ) : (
                          <button
                            className="leite-secondary"
                            onClick={() => setConferir(e)}
                          >
                            Conferir {e.referencia}
                          </button>
                        ))}
                    </td>
                    <td>
                      <details>
                        <summary>
                          Ver histórico e arquivos de {e.referencia}
                        </summary>
                        {e.historico.map((h) => (
                          <p key={h.versao}>
                            Versão {h.versao}: {nomeSituacaoEntrega(h.situacao)}{" "}
                            · aceite{" "}
                            {h.volumeAceito === null
                              ? "desconhecido"
                              : formatarLitros(Number(h.volumeAceito))}
                            . {h.motivo}
                            {h.destinacaoInformada
                              ? ` · ${h.destinacaoInformada}`
                              : ""}
                          </p>
                        ))}
                        <ComprovantesEntregaLeite
                          entrega={e}
                          sitio={e.propriedadeId}
                          podeLancar={podeLancar}
                          onMudou={() => {
                            setAviso("Comprovante anexado à entrega.");
                            atualizar();
                          }}
                        />
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!entregas.itens.length && (
            <p>Nenhuma entrega registrada no período.</p>
          )}
          <div className="leite-form-inline">
            <button
              className="leite-secondary"
              disabled={pagina <= 1 || carregando}
              onClick={() => setPagina((p) => p - 1)}
            >
              Entregas anteriores
            </button>
            <span>
              Página {pagina} · {entregas.total} entregas
            </span>
            <button
              className="leite-secondary"
              disabled={
                pagina * entregas.porPagina >= entregas.total || carregando
              }
              onClick={() => setPagina((p) => p + 1)}
            >
              Próximas entregas
            </button>
          </div>
        </>
      )}
      {podeLancar && conferir && (
        <ConferirEntrega
          key={`${conferir.id}:${conferir.versao}`}
          entrega={conferir}
          aoCancelar={() => setConferir(null)}
          aoSalvar={() => {
            setConferir(null);
            setAviso(
              "Nova conferência registrada. Nenhum retorno ao estoque ou efeito financeiro foi presumido.",
            );
            atualizar();
          }}
        />
      )}
      {podeFinanceiro && (
        <>
          <h2>Demonstrativos do comprador</h2>
          <p>
            Documentos de composição e alocação. Não representam outra venda ou
            confirmação de recebimento.
          </p>
          {erroDoc && <p role="alert">{erroDoc}</p>}
          {docs && (
            <>
              <div
                className="leite-tabela-scroll"
                tabIndex={0}
                role="region"
                aria-label="Demonstrativos, com rolagem horizontal"
              >
                <table>
                  <caption>Demonstrativos e anulações preservados</caption>
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Composição</th>
                      <th>Alocações e estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.itens.map((d) => (
                      <tr key={d.id}>
                        <td>
                          {d.referencia}
                          <small>
                            {config?.parceiros.find(
                              (p) => p.id === d.parceiroId,
                            )?.nome ?? "Comprador do documento"}{" "}
                            · {dataPt(d.inicio)} a {dataPt(d.fim)}
                          </small>
                          Volume: {formatarLitros(Number(d.volumeReconhecido))}
                          <br />
                          Preço-base: R${" "}
                          {Number(d.precoBase).toLocaleString("pt-BR", {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 4,
                          })}
                          /L
                          <br />
                          Comercial: {moeda(d.valorComercial)}
                          <small>
                            Pagamento informado:{" "}
                            {d.valorPagamentoInformado === null
                              ? "desconhecido"
                              : moeda(d.valorPagamentoInformado)}{" "}
                            · não confirma recebimento
                          </small>
                        </td>
                        <td>
                          {d.componentes.length
                            ? d.componentes.map((c, i) => (
                                <p key={i}>
                                  {nomeComponente(c.natureza)}:{" "}
                                  {moeda(String(c.valor))} · {c.referencia}
                                </p>
                              ))
                            : "Sem componentes adicionais informados"}
                        </td>
                        <td>
                          {d.status === "ANULADO" ? "Anulado" : "Válido"} ·
                          versão {d.versao}
                          {d.motivoAnulacao && (
                            <p>Motivo da anulação: {d.motivoAnulacao}</p>
                          )}
                          <details>
                            <summary>
                              Parcelas do demonstrativo {d.referencia}
                            </summary>
                            {d.alocacoes.map((a) => (
                              <p key={a.id}>
                                {entregas?.itens.find(
                                  (e) => e.id === a.entregaId,
                                )?.referencia ?? "Entrega vinculada"}{" "}
                                · {formatarLitros(Number(a.quantidade))} ·{" "}
                                {moeda(a.valor)} ·{" "}
                                {a.ativo ? "ativa" : "preservada no histórico"}
                                {a.motivoAceitePendente
                                  ? ` · Aceite pendente: ${a.motivoAceitePendente}`
                                  : ""}
                              </p>
                            ))}
                          </details>
                          {podeLancar && d.status === "VALIDO" && (
                            <button
                              className="leite-secondary"
                              disabled={anulando}
                              onClick={() => {
                                setAnular(d);
                                setMotivoAnulacao("");
                              }}
                            >
                              Anular {d.referencia}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!docs.itens.length && (
                <p>Nenhum demonstrativo registrado no período.</p>
              )}
              <div className="leite-form-inline">
                <button
                  className="leite-secondary"
                  disabled={paginaDoc <= 1 || carregando}
                  onClick={() => setPaginaDoc((p) => p - 1)}
                >
                  Demonstrativos anteriores
                </button>
                <span>
                  Página {paginaDoc} · {docs.total} demonstrativos
                </span>
                <button
                  className="leite-secondary"
                  disabled={
                    paginaDoc * docs.porPagina >= docs.total || carregando
                  }
                  onClick={() => setPaginaDoc((p) => p + 1)}
                >
                  Próximos demonstrativos
                </button>
              </div>
            </>
          )}
          {anular && podeLancar && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void confirmarAnulacao();
              }}
            >
              <fieldset disabled={anulando}>
                <legend>Anular demonstrativo {anular.referencia}</legend>
                <p>
                  A anulação libera suas alocações e preserva o histórico. Não
                  devolve leite ao estoque nem movimenta caixa.
                </p>
                <label>
                  Motivo da anulação
                  <textarea
                    required
                    minLength={5}
                    maxLength={1000}
                    value={motivoAnulacao}
                    onChange={(e) => setMotivoAnulacao(e.target.value)}
                  />
                </label>
                <div className="leite-form-inline">
                  <button
                    type="button"
                    className="leite-secondary"
                    onClick={() => setAnular(null)}
                  >
                    Cancelar anulação
                  </button>
                  <button>
                    {anulando
                      ? "Anulando…"
                      : "Confirmar anulação do demonstrativo"}
                  </button>
                </div>
              </fieldset>
            </form>
          )}
        </>
      )}
    </section>
  );
}
function ConferirEntrega({
  entrega,
  aoSalvar,
  aoCancelar,
}: {
  entrega: EntregaComercial;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [valor, setValor] = useState<ConferenciaDraft>({
    situacao: entrega.situacao,
    aceito: entrega.volumeAceito ?? "",
    motivo: "",
    destinacao: entrega.destinacaoInformada ?? "",
  });
  const [erro, setErro] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const vivo = useRef(true),
    trava = useRef(false);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);
  async function salvar() {
    if (trava.current) return;
    setErro("");
    try {
      const payload = {
        versaoEsperada: entrega.versao,
        ...montarConferencia(valor),
      };
      trava.current = true;
      setOcupado(true);
      await registrarLeite(
        `/comercial/entregas/${entrega.id}/conferencias`,
        entrega.propriedadeId,
        payload,
      );
      if (vivo.current) aoSalvar();
    } catch (e) {
      if (vivo.current)
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível registrar a conferência.",
        );
    } finally {
      trava.current = false;
      if (vivo.current) setOcupado(false);
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      <fieldset disabled={ocupado}>
        <legend>Conferir entrega {entrega.referencia}</legend>
        <p>
          Expedido: {formatarLitros(Number(entrega.expedidoLitros))}. Cada
          correção conserva as conferências anteriores.
        </p>
        <CamposConferenciaEntrega valor={valor} onChange={setValor} />
        {erro && <p role="alert">{erro}</p>}
        <div className="leite-form-inline">
          <button
            type="button"
            className="leite-secondary"
            onClick={aoCancelar}
          >
            Cancelar conferência
          </button>
          <button>
            {ocupado ? "Registrando…" : "Confirmar conferência da entrega"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
