import { useEffect, useState, type ReactNode } from "react";
import {
  Button,
  Empty,
  ErrorBox,
  TabelaFinanceira,
  type ColunaTabela,
} from "../../../financeiro/financeiro-ui";
import { DialogFinanceiro } from "../../../financeiro/DialogFinanceiro";
import { BarraConsulta } from "../../../financeiro/BarraConsulta";
import { PeriodoFinanceiroControl } from "../../../financeiro/PeriodoFinanceiroControl";
import { SecaoFicha } from "../components/SecaoRecolhivel";
import { getHojeISO, formatBRDateISO } from "../../../lib/hoje";
import { navegarPara } from "../../../router";
import { Paginacao } from "../ui";
import type { CabecalhoProtocolo } from "../protocolos/api";
import {
  requisicaoAlertas,
  type ConsultaAlertas,
  type GrupoAlerta,
} from "../alertas/api";
import { CoberturaAlertas } from "../alertas/ResumoAlertas";
import { rotuloSituacao, urlParticipantes } from "../alertas/consulta";
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
  const [busca, setBusca] = useState("");
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
  const hojeOrganizado =
    agenda && etapasHoje ? organizarHoje(etapasHoje, agenda, hoje) : null;
  const gruposHoje = hojeOrganizado?.grupos;
  const totalHoje =
    etapasHoje && gruposHoje
      ? hojeOrganizado!.etapas.length + gruposHoje.length
      : null;
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
  type LinhaCuidado = {
    id: string;
    data: string;
    nome: string;
    etapa: string;
    animais: number;
    atendidos: number | null;
    pendentes: number | null;
    detalhe?: string;
    acao: ReactNode;
  };
  const acaoGrupo = (g: GrupoPlanner) => {
    const href = destinoGrupoVisaoGeral(g);
    return href ? (
      <LinkReproducao botao href={href} sitio={propriedadeId}>
        Abrir etapa
      </LinkReproducao>
    ) : (
      <Button secondary onClick={() => setGrupoAberto(g)}>
        Ver cuidados
      </Button>
    );
  };
  const linhaGrupo = (g: GrupoPlanner): LinhaCuidado => ({
    id: JSON.stringify(g.grupo),
    data: g.previstaPara
      ? horarioIatf(g.previstaPara, g.precisaoTemporal ?? "DIA").replace(
          " · horário não informado",
          "",
        )
      : "Sem prazo definido",
    nome: g.turma?.nome ?? g.nome,
    etapa: g.turma ? (g.etapa?.nome ?? g.nome) : g.nome,
    animais: g.totalAnimais,
    atendidos: null,
    pendentes: null,
    detalhe: [
      g.totalProcedimentos !== g.totalAnimais
        ? `${g.totalProcedimentos} procedimentos`
        : "",
      g.emVisitaAberta > 0
        ? `${g.emVisitaAberta} procedimentos já preparados em visita aberta.`
        : "",
    ]
      .filter(Boolean)
      .join(" · "),
    acao: acaoGrupo(g),
  });
  const colunasCuidados: ColunaTabela<LinhaCuidado>[] = [
    {
      chave: "data",
      titulo: "Data prevista",
      larguraMinima: 140,
      celula: (r) => r.data,
    },
    {
      chave: "nome",
      titulo: "Protocolo / cuidado",
      principal: true,
      larguraMinima: 280,
      larguraFlexivel: true,
      celula: (r) => <strong>{r.nome}</strong>,
    },
    {
      chave: "etapa",
      titulo: "Etapa / procedimento",
      larguraMinima: 220,
      celula: (r) => (
        <>
          {r.etapa}
          {r.detalhe && (
            <small className="repro-visao-detalhe">{r.detalhe}</small>
          )}
        </>
      ),
    },
    {
      chave: "animais",
      titulo: "Animais",
      alinhamento: "direita",
      larguraMinima: 90,
      celula: (r) => r.animais,
    },
    {
      chave: "atendidos",
      titulo: "Atendidos",
      alinhamento: "direita",
      larguraMinima: 100,
      celula: (r) => r.atendidos ?? "—",
    },
    {
      chave: "pendentes",
      titulo: "Pendentes",
      alinhamento: "direita",
      larguraMinima: 100,
      celula: (r) => r.pendentes ?? "—",
    },
    {
      chave: "acao",
      titulo: "Ações",
      acoes: true,
      larguraMinima: 140,
      celula: (r) => r.acao,
    },
  ];
  const linhasHoje: LinhaCuidado[] = [
    ...(hojeOrganizado?.etapas ?? []).map((e) => ({
      id: `${e.modo}:${e.contextoId}:${e.etapaId}`,
      data: formatBRDateISO(hoje),
      nome: e.nome,
      etapa: e.etapa,
      animais: e.totalAnimais,
      atendidos: e.atendidos,
      pendentes: e.pendentes,
      detalhe: e.encerrados > 0 ? `${e.encerrados} encerrados` : undefined,
      acao: (
        <LinkReproducao
          botao
          sitio={propriedadeId}
          href={`${caminhoExecucao({ id: e.contextoId, modo: e.modo })}?${new URLSearchParams({ etapaId: e.etapaId, retorno: window.location.pathname + window.location.search })}`}
        >
          Abrir etapa
        </LinkReproducao>
      ),
    })),
    ...(gruposHoje ?? []).map(linhaGrupo),
  ];
  const proximosFiltrados = gruposProximos?.filter((g) =>
    `${g.turma?.nome ?? ""} ${g.nome} ${g.etapa?.nome ?? ""}`
      .toLocaleLowerCase("pt-BR")
      .includes(busca.trim().toLocaleLowerCase("pt-BR")),
  );
  const colunasExecucoes: ColunaTabela<CabecalhoProtocolo>[] = [
    {
      chave: "nome",
      titulo: "Protocolo",
      principal: true,
      larguraMinima: 300,
      larguraFlexivel: true,
      celula: (p) => <strong>{p.nome}</strong>,
    },
    {
      chave: "modelo",
      titulo: "Modelo",
      larguraMinima: 280,
      celula: (p) => (
        <>
          {p.protocolo.nome}
          <small className="repro-visao-detalhe">
            Versão {p.protocolo.versao}
          </small>
        </>
      ),
    },
    {
      chave: "participantes",
      titulo: "Participantes",
      larguraMinima: 120,
      alinhamento: "direita",
      celula: (p) => p.participantesTotal ?? "A conferir",
    },
    {
      chave: "pendentes",
      titulo: "Procedimentos pendentes",
      larguraMinima: 150,
      alinhamento: "direita",
      celula: (p) => p.contagens.pendentes,
    },
    {
      chave: "acoes",
      titulo: "Ações",
      acoes: true,
      larguraMinima: 150,
      celula: (p) => (
        <LinkReproducao
          botao
          sitio={propriedadeId}
          href={`${caminhoExecucao(p)}?retorno=${encodeURIComponent(window.location.pathname + window.location.search)}`}
        >
          Abrir protocolo
        </LinkReproducao>
      ),
    },
  ];
  const abrirAlerta = (g: GrupoAlerta) =>
    navegarPara(
      urlParticipantes(
        g,
        { propriedadeId, disposicao: "ATENCAO", produtor: "reproducao" },
        window.location.pathname + window.location.search,
      ),
    );
  const colunasAlertas: ColunaTabela<GrupoAlerta>[] = [
    {
      chave: "cuidado",
      titulo: "Cuidado",
      principal: true,
      larguraMinima: 280,
      larguraFlexivel: true,
      celula: (g) => (
        <>
          <strong>{g.titulo}</strong>
          <small className="repro-visao-detalhe">{g.motivo}</small>
        </>
      ),
    },
    {
      chave: "situacao",
      titulo: "Situação",
      larguraMinima: 240,
      celula: (g) => {
        const extras = Object.entries(g.situacoes).filter(
          ([estado]) => !["ATRASADO", "PENDENTE"].includes(estado),
        );
        return extras.length
          ? extras
              .map(
                ([estado, n]) =>
                  `${n} ${rotuloSituacao(estado).toLocaleLowerCase("pt-BR")}`,
              )
              .join(" · ")
          : "Sem atendimento registrado";
      },
    },
    {
      chave: "animais",
      titulo: "Animais",
      larguraMinima: 90,
      alinhamento: "direita",
      celula: (g) => g.animais,
    },
    {
      chave: "atrasados",
      titulo: "Atrasados",
      larguraMinima: 100,
      alinhamento: "direita",
      celula: (g) => g.situacoes.ATRASADO ?? 0,
    },
    {
      chave: "pendentes",
      titulo: "Pendentes",
      larguraMinima: 100,
      alinhamento: "direita",
      celula: (g) => g.situacoes.PENDENTE ?? 0,
    },
    {
      chave: "acoes",
      titulo: "Ações",
      larguraMinima: 140,
      acoes: true,
      celula: (g) => (
        <Button secondary onClick={() => abrirAlerta(g)}>
          Ver animais
        </Button>
      ),
    },
  ];
  return (
    <div className="repro-visao-geral">
      <div className="repro-visao-secoes">
        <SecaoFicha
          className="repro-visao-painel"
          titulo="Hoje"
          acoes={
            <span className="repro-visao-resumo">
              {formatBRDateISO(hoje)}
              {totalHoje != null &&
                ` · ${totalHoje} ${totalHoje === 1 ? "cuidado" : "cuidados"}`}
            </span>
          }
        >
          {erroHoje || erroAgenda ? (
            erro(erroHoje ?? erroAgenda ?? "Não foi possível consultar Hoje")
          ) : !etapasHoje || !gruposHoje ? (
            <p role="status">Consultando cuidados de hoje…</p>
          ) : totalHoje ? (
            <TabelaFinanceira
              visualizacao="tabela"
              colunas={colunasCuidados}
              itens={linhasHoje}
              chaveDe={(r) => r.id}
              rotulo="Cuidados de hoje"
            />
          ) : (
            <Empty>Nenhum cuidado previsto para hoje.</Empty>
          )}
        </SecaoFicha>
        <SecaoFicha className="repro-visao-painel" titulo="Próximos">
          <BarraConsulta
            resumo={
              proximosFiltrados
                ? `${proximosFiltrados.length} cuidados`
                : undefined
            }
          >
            <input
              className="repro-visao-busca"
              aria-label="Buscar próximos cuidados"
              placeholder="Buscar protocolo ou cuidado"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <PeriodoFinanceiroControl
              inicio={inicio}
              fim={fim}
              onChange={(p) => {
                setInicio(p.inicio);
                setFim(p.fim);
              }}
              label="Período dos próximos cuidados"
              showIcon
            />
          </BarraConsulta>
          {!periodoValido ? (
            <p role="status">
              Escolha um intervalo a partir de amanhã, com fim igual ou
              posterior ao início.
            </p>
          ) : erroAgenda ? (
            erro(erroAgenda)
          ) : !proximosFiltrados ? (
            <p role="status">Consultando próximos cuidados…</p>
          ) : proximosFiltrados.length ? (
            <TabelaFinanceira
              visualizacao="tabela"
              colunas={colunasCuidados.filter(
                (c) => !["atendidos", "pendentes"].includes(c.chave),
              )}
              itens={proximosFiltrados.map(linhaGrupo)}
              chaveDe={(r) => r.id}
              rotulo="Próximos cuidados"
            />
          ) : (
            <Empty>
              {busca.trim()
                ? "Nenhum cuidado encontrado para esta busca no intervalo."
                : "Nenhum cuidado previsto neste intervalo."}
            </Empty>
          )}
        </SecaoFicha>
        <SecaoFicha
          className="repro-visao-painel"
          titulo="Em andamento"
          acoes={
            organizados && (
              <span className="repro-visao-resumo">
                {organizados.emAndamento.length} protocolos
              </span>
            )
          }
        >
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
            <TabelaFinanceira
              visualizacao="tabela"
              colunas={colunasExecucoes}
              itens={organizados.emAndamento}
              chaveDe={(p) => `${p.modo}:${p.id}`}
              rotulo="Protocolos em andamento"
            />
          ) : (
            <Empty>
              {execucoes?.length
                ? "Os protocolos abertos estão no recorte de hoje e próximos cuidados."
                : "Nenhum protocolo aberto neste sítio."}
            </Empty>
          )}
        </SecaoFicha>
        <SecaoFicha
          className="repro-visao-painel"
          titulo="Atenção"
          acoes={
            <LinkReproducao
              botao
              sitio={propriedadeId}
              href={`/pecuaria/rebanho/alertas?produtor=reproducao&disposicao=ATENCAO&propriedadeId=${propriedadeId}`}
            >
              Ver todos
            </LinkReproducao>
          }
        >
          {erroAlertas ? (
            erro(erroAlertas)
          ) : !alertas ? (
            <p role="status">Consultando necessidades…</p>
          ) : (
            <>
              <CoberturaAlertas cobertura={alertas.cobertura} />
              {alertas.itens.length ? (
                <>
                  <p className="repro-visao-resumo">
                    {alertas.totaisFiltrados.cuidados} cuidados ·{" "}
                    {alertas.totaisFiltrados.animais} animais
                  </p>
                  <TabelaFinanceira
                    visualizacao="tabela"
                    colunas={colunasAlertas}
                    itens={alertas.itens}
                    chaveDe={(g) => g.chave}
                    rotulo="Cuidados em atenção"
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
        </SecaoFicha>
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
