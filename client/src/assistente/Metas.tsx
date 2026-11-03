import { navegarPara } from "../router";
import { executarComGuardaNavegacao } from "../navegacaoGuardada";
import { registrarGuardaNavegacao } from "../navegacaoGuardada";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { Target, Plus, Pencil, History, CalendarCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import {
  obterCatalogoMetas,
  obterMetas,
  salvarMeta,
  registrarMedicao,
  type DefinicaoMeta,
  type Meta,
  type IndicadorMeta,
} from "./metas-api";
import "./metas.css";
const novaDefinicao: DefinicaoMeta = {
  titulo: "",
  indicadorId: "",
  indicadorVersao: 1,
  tipo: "minimo",
  minimo: null,
  maximo: null,
  periodo: "diario",
  prazo: null,
  fonte: "manual",
  observacao: "",
};
const numero = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const dataBR = (d: string) => d.split("-").reverse().join("/");
const periodo = {
  diario: "Diário",
  mensal: "Mensal",
  anual: "Anual",
  ciclo: "Ciclo",
};
const situacao: Record<string, string> = {
  sem_medicao: "Sem medição",
  no_alvo: "No alvo",
  fora_do_alvo: "Fora do alvo",
  concluido: "Concluído",
  em_aberto: "Em aberto",
};
export function alvoMeta(d: DefinicaoMeta, unidade: string) {
  return d.tipo === "marco"
    ? `Prazo ${d.prazo ? dataBR(d.prazo) : "não informado"}`
    : d.tipo === "faixa"
      ? `${numero(d.minimo!)} a ${numero(d.maximo!)} ${unidade}`
      : `${d.tipo === "minimo" ? "Mínimo" : "Máximo"} ${numero((d.tipo === "minimo" ? d.minimo : d.maximo)!)} ${unidade}`;
}
function linhasHistorico(
  h: Meta["historico"][number],
  meta: Meta,
  indicadores: IndicadorMeta[],
) {
  const c = h.conteudo as Record<string, unknown>;
  const definicao = (
    h.tipo === "definicao"
      ? c
      : (meta.historico
          .filter((e) => e.tipo === "definicao" && e.revisao < h.revisao)
          .at(-1)?.conteudo ?? meta.definicao)
  ) as DefinicaoMeta;
  const titulos: Record<string, string> = {
    titulo: "Nome",
    indicadorId: "Indicador",
    tipo: "Alvo",
    minimo: "Mínimo",
    maximo: "Máximo",
    periodo: "Período",
    prazo: "Prazo",
    fonte: "Fonte",
    observacao: "Observação",
    data: "Data de referência",
    valor: "Valor medido",
    concluido: "Conclusão",
    etapas: "Etapas",
    etapasConcluidas: "Etapas concluídas",
  };
  const nomes: Record<string, string> = {
    minimo: "Mínimo",
    maximo: "Máximo",
    faixa: "Faixa",
    marco: "Marco com prazo",
    manual: "Medição manual",
    automatica: "Apuração automática",
    ...periodo,
  };
  return Object.entries(c)
    .filter(([k]) => titulos[k])
    .map(([k, v]) => {
      let texto: string;
      if (v === null || v === undefined) texto = "Não informado";
      else if (k === "etapas")
        texto =
          (v as { titulo: string }[]).map((e) => e.titulo).join("; ") ||
          "Nenhuma etapa";
      else if (k === "etapasConcluidas")
        texto =
          (v as string[])
            .map(
              (id) =>
                definicao.etapas?.find((e) => e.id === id)?.titulo ??
                "Etapa da definição anterior",
            )
            .join("; ") || "Nenhuma etapa concluída";
      else if (k === "concluido") texto = v ? "Concluído" : "Em aberto";
      else if (k === "indicadorId")
        texto =
          indicadores.find((i) => i.id === v)?.nome ?? "Indicador da meta";
      else if (k === "data" || k === "prazo") texto = dataBR(String(v));
      else if (typeof v === "number") texto = numero(v);
      else texto = nomes[String(v)] ?? String(v);
      return { rotulo: titulos[k], texto };
    });
}
type Modal =
  | { tipo: "definicao"; meta?: Meta }
  | { tipo: "medicao" | "historico"; meta: Meta };
export default function Metas({
  propriedadeId,
  revisao = 0,
  onAbrirFonte,
}: {
  propriedadeId: number | null;
  revisao?: number;
  onAbrirFonte?: (url: string, propriedadeId: number) => void;
}) {
  const [metas, setMetas] = useState<Meta[]>([]),
    [indicadores, setIndicadores] = useState<IndicadorMeta[]>([]),
    [podeEditar, setPodeEditar] = useState(false),
    [carregando, setCarregando] = useState(true),
    [erro, setErro] = useState(""),
    [modal, setModal] = useState<Modal | null>(null),
    [atualizacao, setAtualizacao] = useState(0);
  useEffect(() => {
    let ativa = true;
    setCarregando(true);
    setMetas([]);
    setIndicadores([]);
    setPodeEditar(false);
    setErro("");
    setModal(null);
    Promise.all([obterMetas(), obterCatalogoMetas()])
      .then(([lista, cat]) => {
        if (ativa) {
          setMetas(lista.metas);
          setIndicadores(cat.indicadores);
          setPodeEditar(lista.podeEditar && cat.podeEditar);
        }
      })
      .catch((e) => {
        if (ativa) setErro(e.message);
      })
      .finally(() => {
        if (ativa) setCarregando(false);
      });
    return () => {
      ativa = false;
    };
  }, [propriedadeId, revisao, atualizacao]);
  const voltar = () => {
    setModal(null);
    setAtualizacao((v) => v + 1);
  };
  return (
    <section className="terrano-metas" aria-label="Metas da fazenda">
      <div className="metas-abertura">
        <div>
          <h1>
            <Target size={25} aria-hidden />
            Metas da fazenda
          </h1>
          <p>Acompanhe a evolução dos registros em relação ao alvo.</p>
        </div>
        {podeEditar && (
          <Button
            onClick={() => setModal({ tipo: "definicao" })}
            disabled={propriedadeId === null || carregando}
          >
            <Plus size={17} />
            Nova meta
          </Button>
        )}
      </div>
      {propriedadeId === null && (
        <p className="metas-contexto">
          Visão consolidada. Selecione uma fazenda para criar ou atualizar
          metas.
        </p>
      )}
      {carregando ? (
        <p role="status">Carregando metas…</p>
      ) : erro ? (
        <div role="alert">
          <p>{erro}</p>
          <Button
            variant="outline"
            onClick={() => setAtualizacao((v) => v + 1)}
          >
            Tentar novamente
          </Button>
        </div>
      ) : metas.length === 0 ? (
        <div className="metas-vazio">
          <h3>
            {indicadores.length
              ? "O próximo alvo começa aqui"
              : "Nenhum indicador disponível neste acesso"}
          </h3>
          <p>
            {indicadores.length
              ? "Crie uma meta e registre uma medição ou apure a produção geral diária. A evolução aparece quando houver dados."
              : "As metas acompanham as permissões de cada área."}
          </p>
        </div>
      ) : (
        <div className="metas-lista">
          {metas.map((meta) => {
            const i = indicadores.find(
              (i) => i.id === meta.definicao.indicadorId,
            );
            if (!i) return null;
            const d = meta.definicao,
              ultima = meta.medicoes.at(-1);
            return (
              <article className="metas-meta" key={meta.id}>
                <div className="metas-identidade">
                  <div>
                    <h3>{d.titulo}</h3>
                    <p>
                      {i.nome} · {periodo[d.periodo]} ·{" "}
                      {d.fonte === "manual"
                        ? "Medição manual"
                        : "Apuração automática"}
                    </p>
                    {propriedadeId === null && (
                      <p>Fazenda #{meta.propriedadeId}</p>
                    )}
                  </div>
                  <span className={`metas-situacao metas-${meta.situacao}`}>
                    {situacao[meta.situacao] ?? meta.situacao}
                  </span>
                </div>
                <div className="metas-corpo">
                  <div className="metas-alvo">
                    <p className="metas-alvo-legenda">Alvo definido</p>
                    <strong>{alvoMeta(d, i.unidade)}</strong>
                    <p>
                      {ultima
                        ? `${d.tipo === "marco" ? (ultima.concluido ? "Conclusão registrada" : "Ainda em aberto") : `Última medição: ${numero(ultima.valor!)} ${i.unidade}`} · ${dataBR(ultima.data)}`
                        : "Nenhuma medição registrada."}
                    </p>
                    <p>{d.observacao}</p>
                    {ultima?.proveniencia?.url && (
                      <a
                        href={ultima.proveniencia.url}
                        onClick={(evento) => {
                          evento.preventDefault();
                          const url = ultima.proveniencia!.url;
                          if (onAbrirFonte)
                            onAbrirFonte(url, meta.propriedadeId);
                          else
                            void executarComGuardaNavegacao(() =>
                              navegarPara(url),
                            );
                        }}
                      >
                        Conferir ordenhas da medição
                      </a>
                    )}
                    <div className="metas-acoes">
                      {podeEditar && propriedadeId !== null && (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => setModal({ tipo: "medicao", meta })}
                          >
                            <CalendarCheck size={16} />
                            {d.fonte === "automatica"
                              ? "Apurar dia"
                              : "Registrar medição"}
                          </Button>
                          <Button
                            variant="ghost"
                            aria-label={`Editar ${d.titulo}`}
                            onClick={() =>
                              setModal({ tipo: "definicao", meta })
                            }
                          >
                            <Pencil size={16} />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        onClick={() => setModal({ tipo: "historico", meta })}
                      >
                        <History size={16} />
                        Histórico
                      </Button>
                    </div>
                  </div>
                  <div
                    className="metas-grafico"
                    role={d.tipo==="marco"?"group":"img"}
                    aria-label={`Evolução de ${d.titulo}. ${meta.medicoes.length} medições. ${alvoMeta(d, i.unidade)}`}
                  >
                    {d.tipo === "marco" ? (
                      <div className="metas-sem-dados">
                        <CalendarCheck size={26} />
                        {d.etapas?.length ? (
                          <>
                            <p>
                              {ultima?.etapasConcluidas?.length ?? 0} de{" "}
                              {d.etapas.length} etapas concluídas
                            </p>
                            <ul className="metas-etapas">
                              {d.etapas.map((etapa) => (
                                <li key={etapa.id}>
                                  <span>{etapa.titulo}</span>
                                  <strong>
                                    {ultima?.etapasConcluidas?.includes(
                                      etapa.id,
                                    )
                                      ? "Concluída"
                                      : "Pendente"}
                                  </strong>
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : (
                          <p>
                            {ultima?.concluido
                              ? "Marco concluído"
                              : "A conclusão será registrada como um fato, sem percentual estimado."}
                          </p>
                        )}
                      </div>
                    ) : meta.medicoes.length === 0 ? (
                      <div className="metas-sem-dados">
                        <p>Sem evolução disponível</p>
                        <span>O gráfico começa na primeira medição.</span>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart
                          data={meta.medicoes}
                          margin={{ top: 18, right: 24, bottom: 5, left: 6 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="data"
                            tickFormatter={dataBR}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis
                            domain={["auto", "auto"]}
                            tick={{ fontSize: 12 }}
                            width={65}
                          />
                          <Tooltip
                            labelFormatter={(v) => dataBR(String(v))}
                            formatter={(v) => [
                              `${numero(Number(v))} ${i.unidade}`,
                              "Medição",
                            ]}
                          />
                          {d.tipo === "faixa" && (
                            <ReferenceArea
                              y1={d.minimo!}
                              y2={d.maximo!}
                              fill="var(--primary)"
                              fillOpacity={0.08}
                              ifOverflow="extendDomain"
                            />
                          )}
                          {d.minimo !== null && (
                            <ReferenceLine
                              y={d.minimo}
                              stroke="var(--primary)"
                              strokeDasharray="5 4"
                              ifOverflow="extendDomain"
                              label={{
                                value: "Mínimo",
                                fontSize: 12,
                                position: "insideTopRight",
                              }}
                            />
                          )}
                          {d.maximo !== null && (
                            <ReferenceLine
                              y={d.maximo}
                              stroke="var(--primary)"
                              strokeDasharray="5 4"
                              ifOverflow="extendDomain"
                              label={{
                                value: "Máximo",
                                fontSize: 12,
                                position: "insideTopRight",
                              }}
                            />
                          )}
                          <Line
                            type="linear"
                            dataKey="valor"
                            stroke="var(--primary)"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {!carregando && metas.length >= 100 && (
        <p className="metas-contexto">
          Exibindo as 100 metas atualizadas mais recentemente neste acesso.
        </p>
      )}
      {modal && (
        <ModalMeta
          key={`${modal.tipo}-${modal.meta?.id ?? "nova"}`}
          modal={modal}
          indicadores={indicadores}
          fechar={() => setModal(null)}
          salvo={voltar}
        />
      )}
    </section>
  );
}
function ModalMeta({
  modal,
  indicadores,
  fechar,
  salvo,
}: {
  modal: Modal;
  indicadores: IndicadorMeta[];
  fechar: () => void;
  salvo: () => void;
}) {
  const [d, setD] = useState<DefinicaoMeta>(
      modal.meta?.definicao ?? {
        ...novaDefinicao,
        indicadorId: indicadores[0]?.id ?? "",
        tipo: indicadores[0]?.id === "marco_operacional" ? "marco" : "minimo",
      },
    ),
    [etapasTexto, setEtapasTexto] = useState(
      modal.meta?.definicao.etapas?.map((e) => e.titulo).join("\n") ?? "",
    ),
    [etapasConcluidas, setEtapasConcluidas] = useState<string[]>(
      modal.meta?.medicoes.at(-1)?.etapasConcluidas ?? [],
    ),
    [data, setData] = useState(new Date().toLocaleDateString("en-CA")),
    [valor, setValor] = useState(""),
    [concluido, setConcluido] = useState(false),
    [observacao, setObservacao] = useState(""),
    [sujo, setSujo] = useState(false),
    [gravando, setGravando] = useState(false),
    [erro, setErro] = useState("");
  const pedido = useRef<{
    id: string;
    operacao: string;
    assinatura: string;
  } | null>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const indicador = indicadores.find((i) => i.id === d.indicadorId),
    alterar = (p: Partial<DefinicaoMeta>) => {
      setD((v) => ({ ...v, ...p }));
      setSujo(true);
      pedido.current = null;
    };
  const sair = () => {
    if (gravando) return;
    if (sujo && !window.confirm("Descartar as alterações desta meta?")) return;
    fechar();
  };
  useEffect(() => {
    if (!sujo && !gravando) return;
    return registrarGuardaNavegacao(
      async () =>
        !gravando &&
        (!sujo || window.confirm("Descartar as alterações desta meta?")),
    );
  }, [sujo, gravando]);
  useEffect(() => {
    const antes = (e: BeforeUnloadEvent) => {
      if (sujo) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", antes);
    return () => window.removeEventListener("beforeunload", antes);
  }, [sujo]);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    if (modal.tipo === "definicao" && (d.etapas?.length ?? 0) > 20) {
      setErro("Use até 20 etapas para este marco.");
      return;
    }
    if (
      modal.tipo === "definicao" &&
      d.etapas?.some((etapa) => etapa.titulo.length > 160)
    ) {
      setErro("Cada etapa pode ter até 160 caracteres.");
      return;
    }
    setGravando(true);
    const assinatura = JSON.stringify([
      d,
      data,
      valor,
      concluido,
      observacao,
      etapasConcluidas,
    ]);
    if (!pedido.current || pedido.current.assinatura !== assinatura)
      pedido.current = {
        id: modal.meta?.id ?? crypto.randomUUID(),
        operacao: crypto.randomUUID(),
        assinatura,
      };
    try {
      if (modal.tipo === "definicao")
        await salvarMeta(
          pedido.current.id,
          pedido.current.operacao,
          modal.meta?.revisao ?? 0,
          d,
        );
      else if (modal.tipo === "medicao")
        await registrarMedicao(modal.meta, pedido.current.operacao, {
          data,
          valor:
            d.tipo === "marco" || d.fonte === "automatica"
              ? null
              : Number(valor),
          concluido:
            d.tipo === "marco"
              ? d.etapas?.length
                ? etapasConcluidas.length === d.etapas.length
                : concluido
              : null,
          ...(d.etapas?.length ? { etapasConcluidas } : {}),
          observacao:
            d.fonte === "automatica"
              ? "Apuração automática solicitada."
              : observacao,
        });
      setSujo(false);
      salvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setGravando(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) sair();
      }}
    >
      <DialogContent
        className="metas-dialogo"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          tituloRef.current?.focus();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          sair();
        }}
        onPointerDownOutside={(e) => {
          e.preventDefault();
          sair();
        }}
      >
        <DialogTitle ref={tituloRef} tabIndex={-1}>
          {modal.tipo === "historico"
            ? "Histórico da meta"
            : modal.tipo === "medicao"
              ? d.fonte === "automatica"
                ? "Apurar produção diária"
                : "Registrar medição"
              : modal.meta
                ? "Editar meta"
                : "Nova meta"}
        </DialogTitle>
        <DialogDescription>
          {modal.tipo === "historico"
            ? "Definições e medições preservadas com autoria."
            : modal.tipo === "definicao"
              ? "Defina o indicador, o alvo e a forma de acompanhamento."
              : "A medição fica no histórico. Correções são novos registros."}
        </DialogDescription>
        {modal.tipo === "historico" ? (
          <div className="metas-historico">
            {[...modal.meta.historico].reverse().map((h) => (
              <div key={h.revisao}>
                <strong>
                  {h.tipo === "definicao" ? "Definição" : "Medição"} · revisão{" "}
                  {h.revisao}
                </strong>
                <p>
                  {new Date(h.criadoEm).toLocaleString("pt-BR")} · Usuário #
                  {h.usuarioId}
                </p>
                <dl>
                  {linhasHistorico(h, modal.meta, indicadores).map(
                    ({ rotulo, texto }) => (
                      <div key={rotulo}>
                        <dt>{rotulo}</dt>
                        <dd>{texto}</dd>
                      </div>
                    ),
                  )}
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={enviar}>
            <fieldset disabled={gravando} className="metas-campos">
              {modal.tipo === "definicao" ? (
                <>
                  <label>
                    Nome da meta
                    <input
                      required
                      minLength={2}
                      maxLength={160}
                      value={d.titulo}
                      onChange={(e) => alterar({ titulo: e.target.value })}
                    />
                  </label>
                  <label>
                    Indicador
                    <select
                      value={d.indicadorId}
                      disabled={!!modal.meta}
                      onChange={(e) => {
                        const marco = e.target.value === "marco_operacional";
                        alterar({
                          indicadorId: e.target.value,
                          tipo: marco ? "marco" : "minimo",
                          minimo: null,
                          maximo: null,
                          fonte: "manual",
                          etapas: undefined,
                        });
                        setEtapasTexto("");
                      }}
                    >
                      {indicadores.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nome} · {i.unidade}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="metas-formula">
                    {indicador?.formula} · Versão {indicador?.versao}
                  </p>
                  <div className="metas-dupla">
                    <label>
                      Alvo
                      <select
                        value={d.tipo}
                        onChange={(e) =>
                          alterar({
                            tipo: e.target.value as DefinicaoMeta["tipo"],
                            minimo: null,
                            maximo: null,
                          })
                        }
                      >
                        {d.indicadorId === "marco_operacional" ? (
                          <option value="marco">Marco com prazo</option>
                        ) : (
                          <>
                            <option value="minimo">Mínimo</option>
                            <option value="maximo">Máximo</option>
                            <option value="faixa">Faixa</option>
                          </>
                        )}
                      </select>
                    </label>
                    <label>
                      Período
                      <select
                        value={d.periodo}
                        onChange={(e) =>
                          alterar({
                            periodo: e.target.value as DefinicaoMeta["periodo"],
                            fonte: "manual",
                          })
                        }
                      >
                        {Object.entries(periodo).map(([v, n]) => (
                          <option key={v} value={v}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="metas-dupla">
                    {["minimo", "faixa"].includes(d.tipo) && (
                      <label>
                        Mínimo ({indicador?.unidade})
                        <input
                          type="number"
                          min={
                            d.indicadorId === "resultado_financeiro"
                              ? undefined
                              : 0
                          }
                          step="any"
                          required
                          value={d.minimo ?? ""}
                          onChange={(e) =>
                            alterar({
                              minimo:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    )}
                    {["maximo", "faixa"].includes(d.tipo) && (
                      <label>
                        Máximo ({indicador?.unidade})
                        <input
                          type="number"
                          min={
                            d.indicadorId === "resultado_financeiro"
                              ? undefined
                              : 0
                          }
                          step="any"
                          required
                          value={d.maximo ?? ""}
                          onChange={(e) =>
                            alterar({
                              maximo:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    )}
                    <label>
                      Prazo {d.tipo === "marco" ? "" : "(opcional)"}
                      <input
                        type="date"
                        required={d.tipo === "marco"}
                        value={d.prazo ?? ""}
                        onChange={(e) =>
                          alterar({ prazo: e.target.value || null })
                        }
                      />
                    </label>
                  </div>
                  {d.tipo === "marco" && (
                    <label>
                      Etapas, uma por linha
                      <textarea
                        value={etapasTexto}
                        maxLength={3300}
                        onChange={(e) => {
                          setEtapasTexto(e.target.value);
                          alterar({
                            etapas: e.target.value
                              .split("\n")
                              .map((t) => t.trim())
                              .filter(Boolean)
                              .map((titulo, indice) => ({
                                id:
                                  d.etapas?.[indice]?.id ?? crypto.randomUUID(),
                                titulo,
                              })),
                          });
                        }}
                        placeholder="Adquirir equipamento\nConcluir instalação\nTestar a ordenha"
                      />
                      <span className="metas-formula">
                        Até 20 etapas. A conclusão é registrada por etapa, sem
                        percentual estimado.
                      </span>
                    </label>
                  )}
                  <label>
                    Fonte
                    <select
                      value={d.fonte}
                      onChange={(e) =>
                        alterar({
                          fonte: e.target.value as DefinicaoMeta["fonte"],
                        })
                      }
                    >
                      <option value="manual">Medição manual</option>
                      {d.indicadorId === "leite_volume" &&
                        d.periodo === "diario" && (
                          <option value="automatica">
                            Produção geral diária confirmada
                          </option>
                        )}
                    </select>
                  </label>
                  <p className="metas-formula">{indicador?.motivoManual}</p>
                  <label>
                    Contexto e critérios
                    <textarea
                      maxLength={2000}
                      value={d.observacao}
                      onChange={(e) => alterar({ observacao: e.target.value })}
                      placeholder="População, origem da amostra ou critério do ciclo"
                    />
                  </label>
                  {modal.meta && (
                    <p>
                      Ao alterar a definição, começa uma nova série. As medições
                      anteriores continuam no histórico.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p>
                    <strong>{d.titulo}</strong> ·{" "}
                    {alvoMeta(d, indicador?.unidade ?? "")}
                  </p>
                  <label>
                    Data de referência
                    <input
                      type="date"
                      required
                      value={data}
                      onChange={(e) => {
                        setData(e.target.value);
                        setSujo(true);
                      }}
                    />
                  </label>
                  {d.tipo === "marco" ? (
                    d.etapas?.length ? (
                      <div className="metas-etapas-medicao">
                        <p>Etapas concluídas</p>
                        {d.etapas.map((etapa) => (
                          <label className="metas-checkbox" key={etapa.id}>
                            <input
                              type="checkbox"
                              checked={etapasConcluidas.includes(etapa.id)}
                              onChange={(e) => {
                                setEtapasConcluidas((ids) =>
                                  e.target.checked
                                    ? [...ids, etapa.id]
                                    : ids.filter((id) => id !== etapa.id),
                                );
                                setSujo(true);
                              }}
                            />
                            {etapa.titulo}
                          </label>
                        ))}
                        <p>
                          {etapasConcluidas.length} de {d.etapas.length} etapas
                          concluídas
                        </p>
                      </div>
                    ) : (
                      <label className="metas-checkbox">
                        <input
                          type="checkbox"
                          checked={concluido}
                          onChange={(e) => {
                            setConcluido(e.target.checked);
                            setSujo(true);
                          }}
                        />
                        Marco concluído
                      </label>
                    )
                  ) : d.fonte === "manual" ? (
                    <label>
                      Valor ({indicador?.unidade})
                      <input
                        type="number"
                        min={
                          d.indicadorId === "resultado_financeiro"
                            ? undefined
                            : 0
                        }
                        step="any"
                        required
                        value={valor}
                        onChange={(e) => {
                          setValor(e.target.value);
                          setSujo(true);
                        }}
                      />
                    </label>
                  ) : (
                    <p>
                      A apuração usa apenas parcelas gerais confirmadas e exige
                      todas as posições do dia. Não soma o controle individual.
                    </p>
                  )}
                  {d.fonte === "manual" && (
                    <label>
                      Fonte e observação
                      <textarea
                        required
                        minLength={3}
                        maxLength={2000}
                        value={observacao}
                        onChange={(e) => {
                          setObservacao(e.target.value);
                          setSujo(true);
                        }}
                        placeholder="Informe de onde veio o valor e o recorte medido"
                      />
                    </label>
                  )}
                </>
              )}
            </fieldset>
            {erro && (
              <p role="alert" className="metas-erro">
                {erro}
              </p>
            )}
            <div className="metas-rodape">
              <Button
                variant="outline"
                type="button"
                disabled={gravando}
                onClick={sair}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={gravando}>
                {gravando
                  ? "Salvando…"
                  : modal.tipo === "definicao"
                    ? "Salvar meta"
                    : d.fonte === "automatica"
                      ? "Apurar e registrar"
                      : "Registrar medição"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
