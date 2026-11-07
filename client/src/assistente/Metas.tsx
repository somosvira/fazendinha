import { navegarPara } from "../router";
import { executarComGuardaNavegacao } from "../navegacaoGuardada";
import { registrarGuardaNavegacao } from "../navegacaoGuardada";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { getHojeISO } from "../lib/hoje";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { SelectCampo } from "../financeiro/SelectCampo";
import { DatePicker } from "../components/DatePicker";
import {
  obterCatalogoMetas,
  obterMetas,
  apurarMetas,
  salvarMeta,
  registrarMedicao,
  type DefinicaoMeta,
  type Meta,
  type IndicadorMeta,
} from "./metas-api";
import { CartaoMeta, grupoMeta, leituraMeta } from "./CartaoMeta";
import { Skeleton } from "../components/ui/skeleton";
import "./metas.css";
import { usePropriedades } from "../api/propriedades";

type GrupoMeta = ReturnType<typeof grupoMeta>;
const FILTROS: [("todas" | GrupoMeta), string][] = [["todas", "Todas"], ["fora", "Fora do alvo"], ["ok", "No alvo"], ["marco", "Marcos"], ["neutro", "Sem medição"]];
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
  const { data: sitios } = usePropriedades({ incluirInativos: true });
  const [metas, setMetas] = useState<Meta[]>([]),
    [indicadores, setIndicadores] = useState<IndicadorMeta[]>([]),
    [podeEditar, setPodeEditar] = useState(false),
    [carregando, setCarregando] = useState(true),
    [erro, setErro] = useState(""),
    [modal, setModal] = useState<Modal | null>(null),
    [atualizacao, setAtualizacao] = useState(0),
    [filtro, setFiltro] = useState<"todas" | GrupoMeta>("todas");
  const visiveis = metas.flatMap((meta) => {
    const indicador = indicadores.find((i) => i.id === meta.definicao.indicadorId);
    return indicador ? [{ meta, indicador, grupo: grupoMeta(meta, leituraMeta(meta, indicador.unidade)) }] : [];
  });
  const contagem = visiveis.reduce((c, v) => ({ ...c, [v.grupo]: (c[v.grupo] ?? 0) + 1 }), {} as Partial<Record<GrupoMeta, number>>);
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
          // Apura os dias que já fecham; a lista aparece antes e é atualizada quando a apuração termina.
          if (lista.podeEditar && propriedadeId !== null && lista.metas.some((m) => m.definicao.fonte === "automatica"))
            apurarMetas().then((r) => { if (ativa) setMetas(r.metas); }).catch(() => {});
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
          <h1>Metas da fazenda</h1>
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
          Visão consolidada. Selecione um sítio para criar ou atualizar
          metas.
        </p>
      )}
      {carregando ? (
        <div role="status" aria-label="Carregando metas" className="metas-lista">{[0, 1].map((n) => <Skeleton key={n} className="h-72 w-full rounded-xl" />)}</div>
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
              ? "Nenhuma meta cadastrada"
              : "Nenhum indicador disponível neste acesso"}
          </h3>
          <p>
            {indicadores.length
              ? "Defina um alvo para um indicador da fazenda. A evolução aparece quando houver medições."
              : "As metas acompanham as permissões de cada área."}
          </p>
          {indicadores.length > 0 && podeEditar && propriedadeId !== null && (
            <Button variant="outline" onClick={() => setModal({ tipo: "definicao" })}>
              <Plus size={17} aria-hidden />
              Criar a primeira meta
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="metas-resumo" role="group" aria-label="Filtrar metas por situação">
            {FILTROS.filter(([valor]) => valor === "todas" || contagem[valor]).map(([valor, rotulo]) => <button type="button" key={valor} aria-pressed={filtro === valor} onClick={() => setFiltro(valor)}>
              {valor !== "todas" && <span className={`metas-ponto metas-ponto-${valor}`} aria-hidden />}{rotulo} <b>{valor === "todas" ? visiveis.length : contagem[valor]}</b>
            </button>)}
          </div>
          <div className="metas-lista">
            {visiveis.filter(({ grupo }) => filtro === "todas" || grupo === filtro).map(({ meta, indicador }) => <CartaoMeta key={meta.id} meta={meta} indicador={indicador}
              podeEditar={podeEditar && propriedadeId !== null} sitio={propriedadeId === null ? sitios.find((p) => p.id === meta.propriedadeId)?.nome ?? "Sítio sem acesso" : undefined}
              onRegistrar={() => setModal({ tipo: "medicao", meta })} onEditar={() => setModal({ tipo: "definicao", meta })} onHistorico={() => setModal({ tipo: "historico", meta })}
              onAbrir={(url) => { if (onAbrirFonte) onAbrirFonte(url, meta.propriedadeId); else void executarComGuardaNavegacao(() => navegarPara(url)); }} />)}
          </div>
        </>
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
    [data, setData] = useState(getHojeISO()),
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
  // Descartar alterações pergunta pelo diálogo do sistema, como nas demais telas.
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);
  const resolverDescarte = useRef<((descartar: boolean) => void) | null>(null);
  const perguntarDescarte = () => {
    setConfirmarDescarte(true);
    return new Promise<boolean>((resolve) => { resolverDescarte.current = resolve; });
  };
  const responderDescarte = (descartar: boolean) => {
    setConfirmarDescarte(false);
    resolverDescarte.current?.(descartar);
    resolverDescarte.current = null;
  };
  useEffect(() => () => { resolverDescarte.current?.(false); }, []);
  const sair = async () => {
    if (gravando || confirmarDescarte) return;
    if (sujo && !(await perguntarDescarte())) return;
    fechar();
  };
  useEffect(() => {
    if (!sujo && !gravando) return;
    return registrarGuardaNavegacao(
      async () => !gravando && (!sujo || (await perguntarDescarte())),
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
    <>
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) void sair();
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
          void sair();
        }}
        onPointerDownOutside={(e) => {
          e.preventDefault();
          void sair();
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
                    <SelectCampo
                      value={d.indicadorId}
                      disabled={!!modal.meta}
                      onValueChange={(valor) => {
                        const marco = valor === "marco_operacional";
                        alterar({
                          indicadorId: valor,
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
                    </SelectCampo>
                  </label>
                  {indicador?.formula && (
                    <details className="metas-formula">
                      <summary>Como o indicador é calculado</summary>
                      <p>
                        {indicador.formula} · Versão {indicador.versao}
                      </p>
                    </details>
                  )}
                  <div className="metas-dupla">
                    <label>
                      Alvo
                      <SelectCampo
                        value={d.tipo}
                        onValueChange={(valor) =>
                          alterar({
                            tipo: valor as DefinicaoMeta["tipo"],
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
                      </SelectCampo>
                    </label>
                    <label>
                      Período
                      <SelectCampo
                        value={d.periodo}
                        onValueChange={(valor) =>
                          alterar({
                            periodo: valor as DefinicaoMeta["periodo"],
                            fonte: "manual",
                          })
                        }
                      >
                        {Object.entries(periodo).map(([v, n]) => (
                          <option key={v} value={v}>
                            {n}
                          </option>
                        ))}
                      </SelectCampo>
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
                      <DatePicker
                        required={d.tipo === "marco"}
                        value={d.prazo ?? ""}
                        onChange={(valor) =>
                          alterar({ prazo: valor || null })
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
                    <SelectCampo
                      value={d.fonte}
                      onValueChange={(valor) =>
                        alterar({
                          fonte: valor as DefinicaoMeta["fonte"],
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
                    </SelectCampo>
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
                    <DatePicker
                      required
                      value={data}
                      onChange={(valor) => {
                        setData(valor);
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
    <ConfirmDialog open={confirmarDescarte} title="Descartar alterações?" message="As alterações desta meta ainda não foram salvas." confirmLabel="Descartar" cancelLabel="Continuar editando" cancelTone="safe" tone="danger" onConfirm={() => responderDescarte(true)} onCancel={() => responderDescarte(false)} />
    </>
  );
}
