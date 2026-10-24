import { Table, TableCaption, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { SecaoDetalhesLeite } from "./SecaoDetalhesLeite";
import { LaudosQualidade } from "./LaudosQualidade";
import { useEffect, useRef, useState } from "react";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import {
  obterConfiguracoesFinanceiras,
  type ConfiguracoesFinanceiras,
} from "../../../financeiro/novo-api";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import { hojeOperacional, formatarLitros } from "./modelo";
import { numeroComercial } from "./comercial-types";
import type {
  OperacaoComercialLeiteDTO,
  CadastrosOperacaoLeite,
} from "./comercial-operacoes-types";
import { ComprovantesRetiradaOperacaoLeite } from "./ComprovantesRetiradaOperacaoLeite";
import { FecharOperacaoComercialLeite } from "./FecharOperacaoComercialLeite";
import "./operacoes.css";
const dataPt = (v: string) => v.split("-").reverse().join("/");
const moeda = (v: string) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function OperacoesComerciaisLeite({
  podeLancar,
  podeFinanceiro,
}: {
  podeLancar: boolean;
  podeFinanceiro: boolean;
}) {
  const sitio = getPropriedadeAtiva(),
    [dados, setDados] = useState<{
      total: number;
      porPagina: number;
      propriedadeId: number;
      itens: OperacaoComercialLeiteDTO[];
    } | null>(null),
    [cadastros, setCadastros] = useState<CadastrosOperacaoLeite | null>(null),
    [config, setConfig] = useState<ConfiguracoesFinanceiras | null>(null);
  const [de, setDe] = useState(() => new URLSearchParams(location.search).get("operacoesDe") ?? `${hojeOperacional().slice(0, 7)}-01`),
    [ate, setAte] = useState(() => new URLSearchParams(location.search).get("operacoesAte") ?? hojeOperacional()),
    [pagina, setPagina] = useState(1),
    [revisao, setRevisao] = useState(0),
    [selecionada, setSelecionada] = useState<string | null>(() => new URLSearchParams(location.search).get("operacaoLeiteId")),
    [erro, setErro] = useState(""),
    [carregando, setCarregando] = useState(true),
    [aviso, setAviso] = useState("");
  const [nova, setNova] = useState(false),
    [comprador, setComprador] = useState(""),
    [inicio, setInicio] = useState(de),
    [fim, setFim] = useState(ate),
    [referencia, setReferencia] = useState(""),
    [acao, setAcao] = useState<"RETIRAR" | "FECHAR" | null>(null);
  const [produto, setProduto] = useState(""),
    [data, setData] = useState(hojeOperacional),
    [litros, setLitros] = useState(""),
    [refColeta, setRefColeta] = useState(""),
    [ponto, setPonto] = useState(""),
    [horario, setHorario] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const trava = useRef(false),
    geracao = useRef(0);
  useEffect(() => {
    const atual = ++geracao.current;
    setDados(null);
    setErro("");
    setCarregando(true);
    if (de > ate || !de || !ate) {
      setErro("Informe um período válido.");
      setCarregando(false);
      return;
    }
    void Promise.all([
      consultarLeite<typeof dados>(
        `/comercial/operacoes?${new URLSearchParams({ de, ate, pagina: String(pagina) })}`,
        sitio,
      ),
      consultarLeite<CadastrosOperacaoLeite>(
        "/comercial/operacoes/cadastros",
        sitio,
      ),
    ])
      .then(([r, c]) => {
        if (atual === geracao.current) {
          setDados(r);
          setCadastros(c);
        }
      })
      .catch((e) => {
        if (atual === geracao.current) setErro(e.message);
      })
      .finally(() => {
        if (atual === geracao.current) setCarregando(false);
      });
    return () => {
      geracao.current++;
    };
  }, [sitio, de, ate, pagina, revisao]);
  useEffect(() => {
    let atual = true;
    setConfig(null);
    if (podeFinanceiro)
      void obterConfiguracoesFinanceiras()
        .then((c) => {
          if (atual) setConfig(c);
        })
        .catch((e) => {
          if (atual) setErro(e.message);
        });
    return () => {
      atual = false;
    };
  }, [sitio, podeFinanceiro, revisao]);
  useEffect(() => {
    setSelecionada(new URLSearchParams(location.search).get("operacaoLeiteId"));
    setNova(false);
    setAcao(null);
    setAviso("");
  }, [sitio]);
  const [detalheExterno, setDetalheExterno] = useState<OperacaoComercialLeiteDTO | null>(null);
  useEffect(() => {
    let ativa = true;
    setDetalheExterno(null);
    if (!selecionada || !dados || dados.itens.some(o => o.id === selecionada)) return;
    void consultarLeite<OperacaoComercialLeiteDTO>(`/comercial/operacoes/${selecionada}`, sitio)
      .then(o => { if (ativa) setDetalheExterno(o); })
      .catch(e => { if (ativa) setErro(e instanceof Error ? e.message : "Não foi possível abrir a operação selecionada"); });
    return () => { ativa = false; };
  }, [selecionada, dados, sitio]);
  const o = dados?.itens.find((o) => o.id === selecionada) ?? detalheExterno,
    escopo = sitio ?? dados?.propriedadeId ?? null;
  function atualizar() {
    setRevisao((r) => r + 1);
    setAcao(null);
    setNova(false);
  }
  async function enviar(
    caminho: string,
    payload: Record<string, unknown>,
    mensagem: string,
  ) {
    if (trava.current || !podeLancar) return;
    const atual = geracao.current;
    trava.current = true;
    setOcupado(true);
    setErro("");
    try {
      const r = await registrarLeite<{ id: string }>(caminho, escopo, payload);
      if (atual === geracao.current) {
        setSelecionada(r.id);
        setAviso(mensagem);
        atualizar();
      }
    } catch (e) {
      if (atual === geracao.current)
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível salvar. Tente novamente.",
        );
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  return (
    <section
      className="leite-operacoes"
      aria-label="Operações comerciais de leite"
    >
      <h2 className="leite-titulo-secao">Operações de leite</h2>
      <p>
        Reúna as coletas de um comprador no período. Registre a retirada com
        preço pendente e confira o acordo antes de fechar a venda.
      </p>
      <div className="leite-form-inline">
        <label>
          Período inicial
          <input
            type="date"
            value={de}
            onChange={(e) => {
              setDe(e.target.value);
              setPagina(1);
              setAcao(null);
            }}
          />
        </label>
        <label>
          Período final
          <input
            type="date"
            value={ate}
            onChange={(e) => {
              setAte(e.target.value);
              setPagina(1);
              setAcao(null);
            }}
          />
        </label>
        <Button variant="outline" type="button"
          className="leite-secondary"
          onClick={() => setRevisao((r) => r + 1)}>
          Atualizar operações
        </Button>
        {podeLancar && (
          <Button type="button"
            onClick={() => {
              setNova(true);
              setAcao(null);
            }}>
            Abrir operação
          </Button>
        )}
      </div>
      {carregando && <p role="status">Consultando operações…</p>}
      {erro && <p role="alert">{erro}</p>}
      {aviso && <p role="status">{aviso}</p>}
      {nova && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enviar(
              "/comercial/operacoes",
              { parceiroId: comprador, inicio, fim, referencia },
              "Operação aberta. O preço permanece pendente até o fechamento.",
            );
          }}
        >
          <fieldset disabled={ocupado}>
            <legend>Abrir operação de leite</legend>
            <div className="leite-form-inline">
              <label>
                Comprador
                <select
                  required
                  value={comprador}
                  onChange={(e) => setComprador(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {cadastros?.parceiros.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Início
                <input
                  required
                  type="date"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                />
              </label>
              <label>
                Fim
                <input
                  required
                  type="date"
                  value={fim}
                  min={inicio}
                  onChange={(e) => setFim(e.target.value)}
                />
              </label>
              <label>
                Referência
                <input
                  required
                  minLength={5}
                  maxLength={500}
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                />
              </label>
            </div>
            <div className="leite-form-inline">
              <Button disabled={ocupado}>Confirmar abertura</Button>
              <Button variant="outline" className="leite-secondary"
                type="button"
                onClick={() => setNova(false)}>
                Cancelar abertura
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      {dados && !dados.itens.length && (
        <p>
          Nenhuma operação neste período. Abra uma operação para registrar as
          coletas com preço pendente.
        </p>
      )}
      <div
        className="leite-tabela-scroll"
        role="region"
        tabIndex={0}
        aria-label="Operações de leite por comprador e período"
      >
        <Table semContainer>
          <TableCaption>Compradores e períodos</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Operação</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Retirado</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dados?.itens.map((l) => (
              <TableRow key={l.id}>
                <TableCell>
                  {l.referencia}
                  <small>
                    {l.parceiroNome} · {l.id}
                  </small>
                </TableCell>
                <TableCell>
                  {dataPt(l.inicio)} a {dataPt(l.fim)}
                </TableCell>
                <TableCell>{formatarLitros(Number(l.retiradoLitros))}</TableCell>
                <TableCell>
                  {l.status === "ABERTA"
                    ? "Aberta · preço pendente"
                    : "Fechada"}
                  {l.fechamento?.valorTotal && (
                    <small>{moeda(l.fechamento.valorTotal)}</small>
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="outline" className="leite-secondary"
                    type="button"
                    onClick={() => {
                      setSelecionada(l.id);
                      setAcao(null);
                    }}>
                    Ver {l.referencia}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {dados && (
        <div className="leite-form-inline">
          <Button variant="outline" type="button"
            className="leite-secondary"
            disabled={pagina === 1}
            onClick={() => {
              setPagina((p) => p - 1);
              setSelecionada(null);
            }}>
            Anteriores
          </Button>
          <span>Página {pagina}</span>
          <Button variant="outline" type="button"
            className="leite-secondary"
            disabled={pagina * dados.porPagina >= dados.total}
            onClick={() => {
              setPagina((p) => p + 1);
              setSelecionada(null);
            }}>
            Próximas
          </Button>
        </div>
      )}
      {o && (
        <section aria-label={`Detalhe ${o.referencia}`}>
          <h2>{o.referencia}</h2>
          <p>
            {o.parceiroNome} · {dataPt(o.inicio)} a {dataPt(o.fim)} ·{" "}
            {formatarLitros(Number(o.retiradoLitros))} retirados.
          </p>
          <p>
            Identidade da operação de leite: {o.id}. Versão {o.versao}.
          </p>
          {podeLancar && (
            <div className="leite-form-inline">
              {o.status === "ABERTA" && (
                <Button type="button" onClick={() => setAcao("RETIRAR")}>
                  Registrar retirada
                </Button>
              )}
              {podeFinanceiro && o.retiradas.length > 0 && (
                <Button variant="outline" type="button"
                  className="leite-secondary"
                  onClick={() => setAcao("FECHAR")}>
                  {o.fechamento ? "Corrigir fechamento" : "Conferir fechamento"}
                </Button>
              )}
            </div>
          )}
          {acao === "RETIRAR" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  void enviar(
                    `/comercial/operacoes/${o.id}/retiradas`,
                    {
                      versaoEsperada: o.versao,
                      produtoId: produto,
                      data,
                      quantidadeLitros: numeroComercial(litros, 3, true),
                      referencia: refColeta,
                      pontoColeta: ponto || null,
                      horarioColeta: horario || null,
                    },
                    "Retirada registrada. O estoque foi reduzido uma vez; o preço continua pendente.",
                  );
                } catch (e) {
                  setErro((e as Error).message);
                }
              }}
            >
              <fieldset disabled={ocupado}>
                <legend>Registrar retirada física</legend>
                <div className="leite-form-inline">
                  <label>
                    Produto de leite
                    <select
                      required
                      value={produto}
                      onChange={(e) => setProduto(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {cadastros?.produtos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Data real da retirada
                    <input
                      required
                      type="date"
                      min={o.inicio}
                      max={
                        o.fim < hojeOperacional() ? o.fim : hojeOperacional()
                      }
                      value={data}
                      onChange={(e) => setData(e.target.value)}
                    />
                  </label>
                  <label>
                    Litros retirados
                    <input
                      required
                      inputMode="decimal"
                      value={litros}
                      onChange={(e) => setLitros(e.target.value)}
                    />
                  </label>
                  <label>
                    Referência da coleta
                    <input
                      required
                      minLength={5}
                      maxLength={500}
                      value={refColeta}
                      onChange={(e) => setRefColeta(e.target.value)}
                    />
                  </label>
                  <label>
                    Ponto de coleta (opcional)
                    <input
                      value={ponto}
                      onChange={(e) => setPonto(e.target.value)}
                    />
                  </label>
                  <label>
                    Horário informado (opcional)
                    <input
                      type="time"
                      value={horario}
                      onChange={(e) => setHorario(e.target.value)}
                    />
                  </label>
                </div>
                <div className="leite-form-inline">
                  <Button disabled={ocupado}>Confirmar retirada</Button>
                  <Button variant="outline" className="leite-secondary"
                    type="button"
                    onClick={() => setAcao(null)}>
                    Cancelar retirada
                  </Button>
                </div>
              </fieldset>
            </form>
          )}
          {acao === "FECHAR" && podeFinanceiro && config && (
            <FecharOperacaoComercialLeite
              key={`${o.id}:${o.versao}`}
              operacao={o}
              config={config}
              aoCancelar={() => setAcao(null)}
              aoSalvar={() => {
                setAviso(
                  "Fechamento registrado. Consulte a operação financeira para receber ou estornar pagamentos.",
                );
                atualizar();
              }}
            />
          )}
          {acao === "FECHAR" && !config && (
            <p role="status">
              Os cadastros financeiros precisam estar disponíveis para conferir
              o fechamento.
            </p>
          )}
          {o.fechamento && (
            <div>
              <h3>Fechamento vigente</h3>
              <p>
                {formatarLitros(Number(o.fechamento.volumeReconhecido))}{" "}
                reconhecidos
                {o.fechamento.precoUnitario !== null
                  ? ` a ${moeda(o.fechamento.precoUnitario)}/L · total ${moeda(o.fechamento.valorTotal!)}`
                  : " · valores ocultos"}
                .
              </p>
              {podeFinanceiro && (
                <Button variant="outline" asChild><a href={`/financeiro/operacoes/${o.fechamento.operacaoId}`}>
                  Abrir operação financeira #{o.fechamento.numeroOperacao}
                </a></Button>
              )}
              <p>
                Fechamento {o.fechamento.id} · versão {o.fechamento.versao}.
              </p>
            </div>
          )}
          <h3>Coletas da operação</h3>
          {o.retiradas.map((r) => (
            <SecaoDetalhesLeite key={r.id} titulo={<>
                {dataPt(r.data)} · {formatarLitros(Number(r.quantidadeLitros))}{" "}
                · {r.referencia}
              </>}>

              <p>
                {r.pontoColeta ?? "Ponto não informado"} ·{" "}
                {r.horarioColeta ?? "Horário não informado"}
              </p>
              <ComprovantesRetiradaOperacaoLeite
                entrega={{ ...r, propriedadeId: o.propriedadeId }}
                sitio={o.propriedadeId}
                podeLancar={podeLancar}
                onMudou={atualizar}
              />
            </SecaoDetalhesLeite>
          ))}
          {o.historicoFechamentos.length > 0 && (
            <SecaoDetalhesLeite  titulo={<>Versões do fechamento</>}>

              {o.historicoFechamentos.map((f) => (
                <section key={f.id}>
                  <h3>
                    Versão {f.versao} ·{" "}
                    {f.status === "CANCELADA" ? "Substituída" : "Vigente"}
                  </h3>
                  <p>
                    {dataPt(f.data)} ·{" "}
                    {formatarLitros(Number(f.volumeReconhecido))}
                    {f.valorTotal
                      ? ` · ${moeda(f.valorTotal)}`
                      : " · valores ocultos"}
                  </p>
                  {!!f.amostras?.length && <div><h4>Qualidade preservada nesta versão</h4>{f.amostras.map(a => <SecaoDetalhesLeite key={a.amostraId} titulo={<>{a.snapshot.data} · {a.snapshot.formatoSnapshot.nome} · amostra versão {a.versaoAmostra}</>}><p>{a.snapshot.sujeito.tipo === "COLETIVO" ? a.snapshot.sujeito.origem : a.snapshot.animal?.brinco}</p>{a.snapshot.resultados.map(r => <p key={r.campo}>{a.snapshot.formatoSnapshot.campos.find(c => c.codigo === r.campo)?.rotulo ?? r.campo}: {typeof r.valor === "boolean" ? r.valor ? "Sim" : "Não" : r.valor} {a.snapshot.formatoSnapshot.campos.find(c => c.codigo === r.campo)?.unidade ?? ""}</p>)}<LaudosQualidade amostra={a.snapshot} sitio={o.propriedadeId} podeLancar={false} /></SecaoDetalhesLeite>)}</div>}
                  {f.motivo && <p>{f.motivo}</p>}
                  {f.motivoAjuste && (
                    <p>
                      Ajuste: {moeda(f.ajuste!)} · {f.motivoAjuste}
                    </p>
                  )}
                  <ul>
                    {f.detalhes.map((d) => (
                      <li key={d.retiradaId}>
                        Coleta{" "}
                        {
                          o.retiradas.find((r) => r.id === d.retiradaId)
                            ?.referencia
                        }
                        : {formatarLitros(Number(d.quantidadeReconhecida))}{" "}
                        reconhecidos
                        {d.motivoDiferenca ? ` · ${d.motivoDiferenca}` : ""}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </SecaoDetalhesLeite>
          )}
        </section>
      )}
    </section>
  );
}
