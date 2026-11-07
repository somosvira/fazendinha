import { useEffect, useState } from "react";
import {
  Button,
  Empty,
  ErrorBox,
  Panel,
  Pill,
} from "../../../financeiro/financeiro-ui";
import { DialogFinanceiro } from "../../../financeiro/DialogFinanceiro";
import { DatePicker } from "../../../components/DatePicker";
import { getHojeISO, formatBRDateISO } from "../../../lib/hoje";
import { navegarPara } from "../../../router";
import { ListaRascunho } from "../protocolos/ListaRascunho";
import { Paginacao } from "../ui";
import type { CabecalhoProtocolo } from "../protocolos/api";
import { requisicaoAlertas, type ConsultaAlertas } from "../alertas/api";
import { CuidadosAlertas } from "../alertas/CuidadosAlertas";
import { CoberturaAlertas } from "../alertas/ResumoAlertas";
import { urlParticipantes } from "../alertas/consulta";
import { LinkReproducao } from "./ConsultaReproducaoUI";
import { horarioIatf } from "./CampoDataIatf";
import type { GrupoPlanner, PreviaPlanner } from "./planner-api";
import {
  consultarAgendaVisaoGeral,
  consultarEtapasDoDia,
  type EtapaDoDia,
  consultarAnimaisGrupoVisaoGeral,
  consultarExecucoesVisaoGeral,
  demandaDoGrupo,
  diaDoGrupo,
  organizarVisaoGeral,
  organizarHoje,
} from "./visao-geral-api";
import "./visao-geral-reprodutiva.css";

function somarDias(data: string, dias: number) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));
function caminhoExecucao(p: Pick<CabecalhoProtocolo, "id" | "modo">) {
  return `/pecuaria/reproducao/${p.modo === "INDIVIDUAL" ? "participacoes" : "programacoes"}/${encodeURIComponent(p.id)}`;
}
export function destinoGrupoVisaoGeral(grupo: GrupoPlanner): string | null {
  if (grupo.grupo.origem !== "PROTOCOLO" || !grupo.turma) return null;
  const programacao = grupo.contexto?.programacaoId;
  const id = typeof programacao === "string" ? programacao : grupo.turma.id;
  const parametros = new URLSearchParams({
    protocoloContexto: id,
    retorno: window.location.pathname + window.location.search,
  });
  if (grupo.etapa) parametros.set("etapaId", grupo.etapa.id);
  return `${caminhoExecucao({ id, modo: typeof programacao === "string" ? "COLETIVO" : "INDIVIDUAL" })}?${parametros}`;
}

export function VisaoGeralReprodutiva({
  propriedadeId,
}: {
  propriedadeId: number;
}) {
  const hoje = getHojeISO();
  const [inicio, setInicio] = useState(() => somarDias(hoje, 1));
  const [fim, setFim] = useState(() => somarDias(hoje, 7));
  const [agenda, setAgenda] = useState<GrupoPlanner[] | null>(null),
    [execucoes, setExecucoes] = useState<CabecalhoProtocolo[] | null>(null);
  const [etapasHoje, setEtapasHoje] = useState<EtapaDoDia[] | null>(null);
  const [erroHoje, setErroHoje] = useState<string | null>(null);
  const [alertas, setAlertas] = useState<ConsultaAlertas | null>(null);
  const [erroAgenda, setErroAgenda] = useState<string | null>(null),
    [erroExecucoes, setErroExecucoes] = useState<string | null>(null),
    [erroAlertas, setErroAlertas] = useState<string | null>(null);
  const [revisao, setRevisao] = useState(0),
    [paginaAlertas, setPaginaAlertas] = useState(1);
  const [grupoAberto, setGrupoAberto] = useState<GrupoPlanner | null>(null);
  useEffect(() => {
    let ativo = true;
    setAgenda(null);
    setEtapasHoje(null);
    setErroHoje(null);
    consultarEtapasDoDia(propriedadeId, hoje)
      .then((v) => {
        if (ativo) setEtapasHoje(v);
      })
      .catch((e) => {
        if (ativo) setErroHoje(mensagem(e));
      });
    setExecucoes(null);
    setErroAgenda(null);
    setErroExecucoes(null);
    consultarAgendaVisaoGeral(propriedadeId, hoje)
      .then((v) => {
        if (ativo) setAgenda(v);
      })
      .catch((e) => {
        if (ativo) setErroAgenda(mensagem(e));
      });
    consultarExecucoesVisaoGeral(propriedadeId)
      .then((v) => {
        if (ativo) setExecucoes(v);
      })
      .catch((e) => {
        if (ativo) setErroExecucoes(mensagem(e));
      });
    return () => {
      ativo = false;
    };
  }, [propriedadeId, hoje, revisao]);
  useEffect(() => {
    const controller = new AbortController();
    setAlertas(null);
    setErroAlertas(null);
    const q = new URLSearchParams({
      produtor: "reproducao",
      disposicao: "ATENCAO",
      pagina: String(paginaAlertas),
      tamanho: "10",
    });
    requisicaoAlertas<ConsultaAlertas>(
      `?${q}`,
      undefined,
      controller.signal,
      propriedadeId,
    )
      .then(setAlertas)
      .catch((e) => {
        if (!controller.signal.aborted) setErroAlertas(mensagem(e));
      });
    return () => controller.abort();
  }, [propriedadeId, paginaAlertas, revisao]);
  const periodoValido = !!inicio && !!fim && inicio > hoje && fim >= inicio;
  const organizados =
    agenda && execucoes
      ? organizarVisaoGeral(agenda, execucoes, hoje, inicio, fim)
      : null;
  if (organizados && etapasHoje) {
    const destacados = new Set(
      etapasHoje.map((e) => `${e.modo}:${e.contextoId}`),
    );
    organizados.emAndamento = organizados.emAndamento.filter(
      (p) => !destacados.has(`${p.modo}:${p.id}`),
    );
  }
  const hojeOrganizado = agenda && etapasHoje ? organizarHoje(etapasHoje, agenda, hoje) : null;
  const gruposHoje = hojeOrganizado?.grupos;
  const totalHoje =
    etapasHoje && gruposHoje ? hojeOrganizado!.etapas.length + gruposHoje.length : null;
  const gruposProximos =
    agenda && periodoValido
      ? agenda.filter((g) => {
          const dia = diaDoGrupo(g);
          return !!dia && dia > hoje && dia >= inicio && dia <= fim;
        })
      : null;
  const atualizar = () => setRevisao((v) => v + 1);
  const erro = (texto: string) => (
    <div className="grid gap-3">
      <ErrorBox erro={texto} />
      <Button secondary onClick={atualizar}>
        Consultar novamente
      </Button>
    </div>
  );
  const listaGrupos = (
    itens: GrupoPlanner[],
    rotulo: string,
    chave = rotulo,
  ) => (
    <ListaRascunho
      key={chave}
      itens={itens}
      rotulo={rotulo}
      renderizar={(g) => {
        const href = destinoGrupoVisaoGeral(g);
        return (
          <article key={JSON.stringify(g.grupo)} className="repro-visao-item">
            <div>
              <h3>{g.turma?.nome ?? g.nome}</h3>
              {g.turma && <p>{g.etapa?.nome ?? g.nome}</p>}
              <p className="text-sm text-ink-3">
                {g.previstaPara
                  ? horarioIatf(
                      g.previstaPara,
                      g.precisaoTemporal ?? "DIA",
                    ).replace(" · horário não informado", "")
                  : "Sem prazo definido"}{" "}
                · {g.totalAnimais} {g.totalAnimais === 1 ? "animal" : "animais"}
                {g.totalProcedimentos !== g.totalAnimais
                  ? ` · ${g.totalProcedimentos} procedimentos`
                  : ""}
              </p>
              {g.emVisitaAberta > 0 && (
                <p className="text-sm text-ink-3">
                  {g.emVisitaAberta} procedimentos já preparados em visita
                  aberta.
                </p>
              )}
            </div>
            {href ? (
              <LinkReproducao botao href={href} sitio={propriedadeId}>
                Abrir etapa
              </LinkReproducao>
            ) : (
              <Button secondary onClick={() => setGrupoAberto(g)}>
                Ver cuidados
              </Button>
            )}
          </article>
        );
      }}
    />
  );
  return (
    <div className="repro-visao-geral">
      <div className="repro-visao-acessos">
        <p>Cuidados previstos e protocolos do sítio selecionado.</p>
        <div>
          <LinkReproducao
            botao
            sitio={propriedadeId}
            href="/configuracoes/pecuaria/reproducao/protocolos"
          >
            Modelos
          </LinkReproducao>
          <LinkReproducao
            botao
            sitio={propriedadeId}
            href="/pecuaria/reproducao?rotina=programacoes"
          >
            Todos os protocolos
          </LinkReproducao>
          <LinkReproducao
            botao
            sitio={propriedadeId}
            href="/configuracoes/pecuaria/reproducao/politica"
          >
            Configurações
          </LinkReproducao>
        </div>
      </div>
      <div className="repro-visao-secoes">
        <Panel>
          <header className="repro-visao-cabecalho">
            <div>
              <h2>Hoje</h2>
              <p>{formatBRDateISO(hoje)}</p>
            </div>
            {totalHoje != null && (
              <Pill>
                {totalHoje} {totalHoje === 1 ? "cuidado" : "cuidados"}
              </Pill>
            )}
          </header>
          <div className="repro-visao-conteudo">
            {erroHoje || erroAgenda ? (
              erro(erroHoje ?? erroAgenda ?? "Não foi possível consultar Hoje")
            ) : !etapasHoje || !gruposHoje ? (
              <p role="status">Consultando cuidados de hoje…</p>
            ) : totalHoje ? (
              <>
                {!!etapasHoje.length && (
                  <ListaRascunho
                    itens={hojeOrganizado?.etapas ?? etapasHoje}
                    rotulo="etapas de hoje"
                    renderizar={(e) => (
                      <article
                        className="repro-visao-etapa"
                        key={`${e.modo}:${e.contextoId}:${e.etapaId}`}
                      >
                        <div>
                          <h3>{e.nome}</h3>
                          <p>{e.etapa}</p>
                          <p className="text-sm text-ink-3">
                            {e.totalAnimais}{" "}
                            {e.totalAnimais === 1 ? "animal" : "animais"}
                            {e.encerrados > 0
                              ? ` · ${e.encerrados} encerrados`
                              : ""}
                          </p>
                        </div>
                        <div>
                          <span>Atendidos</span>
                          <strong>{e.atendidos}</strong>
                        </div>
                        <div>
                          <span>Pendentes</span>
                          <strong>{e.pendentes}</strong>
                        </div>
                        <LinkReproducao
                          botao
                          sitio={propriedadeId}
                          href={`${caminhoExecucao({ id: e.contextoId, modo: e.modo })}?${new URLSearchParams({ etapaId: e.etapaId, retorno: window.location.pathname + window.location.search })}`}
                        >
                          Abrir etapa
                        </LinkReproducao>
                      </article>
                    )}
                  />
                )}
                {!!gruposHoje.length &&
                  listaGrupos(gruposHoje, "cuidados de hoje")}
              </>
            ) : (
              <Empty>Nenhum cuidado previsto para hoje.</Empty>
            )}
          </div>
        </Panel>
        <Panel>
          <header className="repro-visao-cabecalho">
            <div>
              <h2>Próximos</h2>
              <p>
                {formatBRDateISO(inicio)} a {formatBRDateISO(fim)}
              </p>
            </div>
            <Button
              secondary
              onClick={() => {
                setInicio(somarDias(hoje, 1));
                setFim(somarDias(hoje, 1));
              }}
            >
              Amanhã
            </Button>
          </header>
          <div className="repro-visao-conteudo">
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                De
                <DatePicker
                  aria-label="Início dos próximos cuidados"
                  min={somarDias(hoje, 1)}
                  value={inicio}
                  onChange={setInicio}
                />
              </label>
              <label>
                Até
                <DatePicker
                  aria-label="Fim dos próximos cuidados"
                  min={inicio || somarDias(hoje, 1)}
                  value={fim}
                  onChange={setFim}
                />
              </label>
            </div>
            {!periodoValido ? (
              <p role="status">
                Escolha um intervalo a partir de amanhã, com fim igual ou
                posterior ao início.
              </p>
            ) : erroAgenda ? (
              erro(erroAgenda)
            ) : !gruposProximos ? (
              <p role="status">Consultando próximos cuidados…</p>
            ) : gruposProximos.length ? (
              listaGrupos(
                gruposProximos,
                "próximos cuidados",
                `${inicio}:${fim}`,
              )
            ) : (
              <Empty>Nenhum cuidado previsto neste intervalo.</Empty>
            )}
          </div>
        </Panel>
        <Panel>
          <header className="repro-visao-cabecalho">
            <div>
              <h2>Em andamento</h2>
              <p>Demais protocolos abertos fora do recorte acima</p>
            </div>
          </header>
          <div className="repro-visao-conteudo">
            {erroExecucoes ? (
              erro(erroExecucoes)
            ) : erroAgenda ? (
              erro(
                "Não foi possível conferir as etapas dos protocolos. Atualize a agenda para organizar as execuções.",
              )
            ) : !organizados ? (
              <p role="status">Consultando execuções…</p>
            ) : !periodoValido ? (
              <p>
                Defina o intervalo dos próximos cuidados para organizar os
                protocolos.
              </p>
            ) : organizados.emAndamento.length ? (
              <ListaRascunho
                key={`${inicio}:${fim}`}
                itens={organizados.emAndamento}
                rotulo="protocolos em andamento"
                renderizar={(p) => (
                  <article
                    className="repro-visao-item"
                    key={`${p.modo}:${p.id}`}
                  >
                    <div>
                      <h3>{p.nome}</h3>
                      <p className="text-sm text-ink-3">
                        {p.protocolo.nome} · versão {p.protocolo.versao}
                      </p>
                      <p>
                        {p.participantesTotal == null
                          ? "Participantes a conferir"
                          : `${p.participantesTotal} ${p.participantesTotal === 1 ? "participante" : "participantes"}`}{" "}
                        · {p.contagens.pendentes} procedimentos pendentes
                      </p>
                    </div>
                    <LinkReproducao
                      botao
                      sitio={propriedadeId}
                      href={`${caminhoExecucao(p)}?retorno=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                    >
                      Abrir protocolo
                    </LinkReproducao>
                  </article>
                )}
              />
            ) : (
              <Empty>
                {execucoes?.length
                  ? "Os protocolos abertos estão no recorte de hoje e próximos cuidados."
                  : "Nenhum protocolo aberto neste sítio."}
              </Empty>
            )}
          </div>
        </Panel>
        <Panel>
          <header className="repro-visao-cabecalho">
            <div>
              <h2>Atenção</h2>
              <p>Necessidades reprodutivas da central de alertas</p>
            </div>
            <LinkReproducao
              botao
              sitio={propriedadeId}
              href={`/pecuaria/rebanho/alertas?produtor=reproducao&disposicao=ATENCAO&propriedadeId=${propriedadeId}`}
            >
              Ver todos
            </LinkReproducao>
          </header>
          <div className="repro-visao-conteudo">
            {erroAlertas ? (
              erro(erroAlertas)
            ) : !alertas ? (
              <p role="status">Consultando necessidades…</p>
            ) : (
              <>
                <CoberturaAlertas cobertura={alertas.cobertura} />
                {alertas.itens.length ? (
                  <>
                    <p>
                      {alertas.totaisFiltrados.cuidados} cuidados ·{" "}
                      {alertas.totaisFiltrados.animais} animais
                    </p>
                    <CuidadosAlertas
                      grupos={alertas.itens}
                      modo="visual"
                      onAbrir={(g) =>
                        navegarPara(
                          urlParticipantes(
                            g,
                            {
                              propriedadeId,
                              disposicao: "ATENCAO",
                              ...{ produtor: "reproducao" },
                            },
                            window.location.pathname + window.location.search,
                          ),
                        )
                      }
                    />
                    {alertas.total > 10 && (
                      <Paginacao
                        paginaAtual={alertas.pagina}
                        totalPaginas={Math.ceil(alertas.total / 10)}
                        totalItens={alertas.total}
                        itensPorPagina={10}
                        onPaginaChange={setPaginaAlertas}
                        rotulo="cuidados que demandam atenção"
                        idSelect="visao-geral-alertas"
                      />
                    )}
                  </>
                ) : alertas.cobertura.estado === "ATUALIZADA" ? (
                  <Empty>
                    Nenhuma atenção identificada pelas regras reprodutivas
                    avaliadas.
                  </Empty>
                ) : (
                  <p>
                    Não há cuidados conhecidos neste recorte. A cobertura ainda
                    não permite afirmar ausência de necessidades.
                  </p>
                )}
              </>
            )}
          </div>
        </Panel>
      </div>
      <div className="repro-visao-acessos">
        <p>As filas completas e o histórico continuam acessíveis.</p>
        <LinkReproducao
          botao
          sitio={propriedadeId}
          href="/pecuaria/reproducao?rotina=ciclos"
        >
          Animais e acompanhamentos
        </LinkReproducao>
        <LinkReproducao
          botao
          sitio={propriedadeId}
          href="/pecuaria/reproducao?rotina=agenda"
        >
          Agenda completa
        </LinkReproducao>
        <LinkReproducao
          botao
          sitio={propriedadeId}
          href="/pecuaria/reproducao?rotina=partos"
        >
          Partos e pós-parto
        </LinkReproducao>
      </div>
      {grupoAberto && (
        <AnimaisDoCuidado
          grupo={grupoAberto}
          propriedadeId={propriedadeId}
          data={hoje}
          onFechar={() => setGrupoAberto(null)}
        />
      )}
    </div>
  );
}

function AnimaisDoCuidado({
  grupo,
  propriedadeId,
  data,
  onFechar,
}: {
  grupo: GrupoPlanner;
  propriedadeId: number;
  data: string;
  onFechar: () => void;
}) {
  const [pagina, setPagina] = useState(1),
    [dados, setDados] = useState<PreviaPlanner | null>(null),
    [erro, setErro] = useState<string | null>(null),
    [revisao, setRevisao] = useState(0);
  useEffect(() => {
    let ativo = true;
    setDados(null);
    setErro(null);
    consultarAnimaisGrupoVisaoGeral(propriedadeId, data, grupo, pagina)
      .then((v) => {
        if (ativo) setDados(v);
      })
      .catch((e) => {
        if (ativo) setErro(mensagem(e));
      });
    return () => {
      ativo = false;
    };
  }, [grupo, propriedadeId, data, pagina, revisao]);
  return (
    <DialogFinanceiro
      titulo={grupo.nome}
      eyebrow=""
      onClose={onFechar}
      rodape={
        <Button secondary onClick={onFechar}>
          Fechar
        </Button>
      }
    >
      <div className="grid gap-4 p-5">
        {erro ? (
          <>
            <ErrorBox erro={erro} />
            <Button secondary onClick={() => setRevisao((v) => v + 1)}>
              Consultar cuidados novamente
            </Button>
          </>
        ) : !dados ? (
          <p role="status">Consultando animais deste cuidado…</p>
        ) : (
          <>
            <p>
              Consulta da agenda, sem incluir animais nem registrar atendimento.
            </p>
            {dados.animais.map((a) => {
              const demanda = demandaDoGrupo(grupo, a.animalId);
              const q = new URLSearchParams({
                sitio: String(propriedadeId),
                retorno: window.location.pathname + window.location.search,
              });
              if (demanda) q.set("demandaId", demanda);
              return (
                <article
                  key={`${a.animalId}:${a.tarefaId}`}
                  className="repro-visao-item"
                >
                  <div>
                    <h3>
                      {a.brinco ?? "Animal sem brinco"}
                      {a.nome ? ` · ${a.nome}` : ""}
                    </h3>
                    {a.motivos.map((m) => (
                      <p className="text-sm text-ink-3" key={m}>
                        {m}
                      </p>
                    ))}
                  </div>
                  <LinkReproducao
                    botao
                    sitio={propriedadeId}
                    href={`/pecuaria/rebanho/animais/${encodeURIComponent(a.animalId)}?${q}#reproducao`}
                  >
                    {demanda ? "Abrir cuidado" : "Abrir acompanhamento"}
                  </LinkReproducao>
                </article>
              );
            })}
            {!dados.animais.length && (
              <Empty>
                O grupo não contém animais neste momento. Atualize a visão
                geral.
              </Empty>
            )}
            {dados.total > 10 && (
              <Paginacao
                paginaAtual={dados.pagina}
                totalPaginas={Math.ceil(dados.total / 10)}
                totalItens={dados.total}
                itensPorPagina={10}
                onPaginaChange={setPagina}
                rotulo="animais do cuidado"
                idSelect="visao-geral-animais"
              />
            )}
          </>
        )}
      </div>
    </DialogFinanceiro>
  );
}
