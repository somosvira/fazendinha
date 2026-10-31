import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, List } from "lucide-react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import {
  diasDoCalendario,
  deslocarMes,
  nomeMes,
} from "../../../financeiro/lib/calendario";
import {
  PaginacaoLocal,
  usePaginacaoLocal,
} from "../../../components/PaginacaoLocal";
import { LinkInterno } from "../../../components/LinkInterno";
import { SecaoGeralAnimal } from "../components/SecaoGeralAnimal";
import type { PropsConsultaSanitaria } from "./HistoricoSanitario";
import type { TarefaRodada } from "./rodadas-api";
import {
  enderecoSanidadeFicha,
  useAgoraSanitario,
  useColecaoFichaSanitaria,
} from "./consultaFichaSanitaria";
import { rotuloTarefaSanitaria } from "./IndicadoresSanitarios";
import { dataSanitaria } from "./rotulos";
import "./ficha-sanitaria-consultas.css";

export function AgendaSanitaria({
  animalId,
  loteId,
  abrir,
  recarregarEm,
}: PropsConsultaSanitaria) {
  const agora = useAgoraSanitario();
  const hoje = agora.toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
  const [mes, setMes] = useState(() => hoje.slice(0, 7));
  const [modo, setModo] = useState<"calendario" | "lista">("calendario");
  const dias = diasDoCalendario(mes);
  const q = new URLSearchParams({
    ...(animalId ? { animalId } : {}),
    ...(loteId ? { loteId } : {}),
    de: dias[0].data,
    ate: dias[dias.length - 1].data,
    paginado: "true",
    ordenacaoTarefas: "data",
  });
  const { dados, erro, tentar } = useColecaoFichaSanitaria<TarefaRodada>(
    `/tarefas?${q}`,
    recarregarEm,
  );
  const itens = (dados ?? [])
    .filter((t) => t.previstaPara.startsWith(mes))
    .sort(
      (a, b) =>
        a.previstaPara.localeCompare(b.previstaPara) ||
        a.id.localeCompare(b.id),
    );
  const paginacao = usePaginacaoLocal(
    itens,
    `${animalId}|${loteId}|${mes}`,
    10,
  );
  const nome = (t: TarefaRodada) =>
    t.parametros.tipoAplicacaoNomeSnapshot ??
    t.parametros.tipoExameNomeSnapshot ??
    t.execucao.protocolo.nome;
  const situacao = (t: TarefaRodada) =>
    rotuloTarefaSanitaria(t.situacao, t.previstaPara, hoje);
  const abrirTarefa = (t: TarefaRodada) =>
    abrir?.("tarefa", t.id, t.execucao.propriedadeId, t);
  const tarefa = (t: TarefaRodada) =>
    abrir ? (
      <button
        className="ficha-sanitaria-tarefa"
        type="button"
        onClick={() => abrirTarefa(t)}
      >
        <strong>{nome(t)}</strong>
        <span>{situacao(t)}</span>
        <small>{t.execucao.protocolo.nome}</small>
      </button>
    ) : (
      <LinkInterno
        area="pecuaria"
        href={enderecoSanidadeFicha("agenda", animalId, loteId)}
      >
        {nome(t)} · {situacao(t)}
      </LinkInterno>
    );
  return (
    <SecaoGeralAnimal
      id="agenda-sanitaria"
      titulo="Agenda sanitária"
      icon={CalendarDays}
      acao={
        <LinkInterno
          area="pecuaria"
          aparencia="botao-primario"
          href={enderecoSanidadeFicha("agenda", animalId, loteId)}
        >
          Ver agenda
        </LinkInterno>
      }
    >
      <div className="ficha-sanitaria-toolbar">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Visualização da agenda sanitária"
        >
          <Button
            secondary={modo !== "calendario"}
            aria-pressed={modo === "calendario"}
            onClick={() => setModo("calendario")}
          >
            <CalendarDays size={16} aria-hidden />
            Calendário
          </Button>
          <Button
            secondary={modo !== "lista"}
            aria-pressed={modo === "lista"}
            onClick={() => setModo("lista")}
          >
            <List size={16} aria-hidden />
            Lista
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            secondary
            aria-label="Mês anterior"
            onClick={() => setMes((v) => deslocarMes(v, -1))}
          >
            <ChevronLeft size={16} aria-hidden />
          </Button>
          <Button
            secondary
            aria-label="Próximo mês"
            onClick={() => setMes((v) => deslocarMes(v, 1))}
          >
            <ChevronRight size={16} aria-hidden />
          </Button>
          <strong aria-live="polite" className="capitalize">
            {nomeMes(mes)}
          </strong>
          <Button secondary onClick={() => setMes(hoje.slice(0, 7))}>
            Hoje
          </Button>
        </div>
      </div>
      <ErrorBox erro={erro} />
      {erro ? (
        <Button secondary onClick={tentar}>
          Tentar novamente
        </Button>
      ) : !dados ? (
        <p role="status">Carregando agenda…</p>
      ) : (
        <>
          {!itens.length && (
            <div role="status" className="ficha-sanitaria-vazio">
              <CalendarDays size={28} aria-hidden />
              <strong>Nenhuma tarefa sanitária neste mês.</strong>
            </div>
          )}
          {modo === "lista" ? (
            <>
              <ul
                className="divide-y divide-border"
                aria-label="Tarefas sanitárias do mês"
              >
                {paginacao.itens.map((t) => (
                  <li key={t.id} className="ficha-sanitaria-tarefa-linha">
                    <time dateTime={t.previstaPara}>
                      {dataSanitaria(t.previstaPara)}
                    </time>
                    {tarefa(t)}
                  </li>
                ))}
              </ul>
              <PaginacaoLocal
                controles={paginacao.controles}
                substantivo="tarefas sanitárias"
                id="pagina-agenda-sanitaria"
              />
            </>
          ) : (
            <div
              className="ficha-sanitaria-calendario"
              role="region"
              aria-label="Dias do calendário sanitário"
              tabIndex={0}
            >
              <table>
                <caption className="sr-only">
                  Agenda sanitária — {nomeMes(mes)}
                </caption>
                <thead>
                  <tr>
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(
                      (d) => (
                        <th scope="col" key={d}>
                          {d}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: dias.length / 7 }, (_, semana) => (
                    <tr key={semana}>
                      {dias
                        .slice(semana * 7, semana * 7 + 7)
                        .map(({ data, dia }) => (
                          <td
                            key={data}
                            data-dia={data}
                            data-fora={!data.startsWith(mes) || undefined}
                          >
                            <time
                              dateTime={data}
                              aria-label={dataSanitaria(data)}
                              aria-current={data === hoje ? "date" : undefined}
                            >
                              {dia}
                            </time>
                            <ul
                              aria-label={`Tarefas de ${dataSanitaria(data)}`}
                            >
                              {dados
                                .filter(
                                  (t) => t.previstaPara.slice(0, 10) === data,
                                )
                                .map((t) => (
                                  <li key={t.id}>{tarefa(t)}</li>
                                ))}
                            </ul>
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </SecaoGeralAnimal>
  );
}
