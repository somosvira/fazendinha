import { LotesSemDieta } from "./LotesSemDieta";
import { useEffect, useRef, useState } from "react";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import { listarLotes } from "../api";
import type { Lote } from "../types";
import {
  listarPropriedades,
  type PropriedadeDTO,
} from "../../../api/propriedades";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { navegarPara } from "../../../router";
import { LinkNutricional, rotaNutricao } from "./componentes";
import {
  SelecaoPartidas,
  type DistribuicaoPartida,
} from "../../../estoque/SelecaoPartidas";
import * as api from "./mensal-api";
import "./mensal.css";
import { ConfiguracaoNutricao, modelosNutricionais as modelos } from "./ConfiguracaoNutricao";
const quantidade = (v: string) =>
  Number(v).toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
const data = (v: string) => v.slice(0, 10).split("-").reverse().join("/");
export function GestaoMensal({
  podeLancar,
  vista,
}: {
  podeLancar: boolean;
  vista: "mensal" | "configuracao" | "alertas";
}) {
  const escopo = getPropriedadeAtiva();
  const [status, setStatus] = useState<{
      habilitada: boolean;
      automacao: boolean;
    } | null>(null),
    [lotes, setLotes] = useState<Lote[]>([]),
    [sitios, setSitios] = useState<PropriedadeDTO[]>([]),
    [configs, setConfigs] = useState<api.ConfiguracaoMensal[]>([]),
    [lista, setLista] = useState<api.MesNutricional[]>([]),
    [total, setTotal] = useState(0),
    [pagina, setPagina] = useState(1),
    [erro, setErro] = useState<string | null>(null),
    [ocupado, setOcupado] = useState(false),
    [carregando, setCarregando] = useState(true),
    [recarregar, setRecarregar] = useState(0),
    [mensagem, setMensagem] = useState("");
  const [lote, setLote] = useState("");
  const enviando = useRef(false);
  const url = new URLSearchParams(window.location.search),
    id = url.get("mesId"),
    filtroLote = url.get("loteId") ?? undefined;
  const [mes, setMes] = useState<api.MesNutricional | null>(null);
  useEffect(() => {
    setLote("");
    setPagina(1);
  }, [escopo]);
  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro(null);
    setMes(null);
    setLista([]);
    (async () => {
      const s = await api.statusMensal();
      if (!vivo) return;
      setStatus(s);
      if (!s.habilitada) return;
      const [ls, ss, cs, ms] = await Promise.all([
        listarLotes({ incluirInativos: true }),
        listarPropriedades(),
        api.configuracoesMensais(),
        api.mesesNutricionais(pagina, filtroLote, vista === "alertas"),
      ]);
      if (!vivo) return;
      setLotes(ls);
      setSitios(ss);
      setConfigs(cs);
      setLista(ms.itens);
      setTotal(ms.total);
      if (id) {
        const m = await api.mesNutricional(id);
        if (vivo) setMes(m);
      }
    })()
      .catch((e) => {
        if (vivo) setErro(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [escopo, recarregar, pagina, id, vista, filtroLote]);
  async function executar(acao: () => Promise<unknown>) {
    if (enviando.current) return;
    enviando.current = true;
    setOcupado(true);
    setErro(null);
    setMensagem("");
    try {
      await acao();
      setMensagem("Operação concluída.");
      setRecarregar((v) => v + 1);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }
  const abrir = (m: api.MesNutricional) =>
    navegarPara(`/pecuaria/nutricao?aba=fechamentos&mesId=${m.id}`);
  return (
    <div className="nutricao-mensal">
      {vista === "alertas" && <LotesSemDieta podeLancar={podeLancar} />}
      <ErrorBox erro={erro} />
      {erro && (
        <Button secondary onClick={() => setRecarregar((v) => v + 1)}>
          Tentar novamente
        </Button>
      )}
      <p role="status">{mensagem}</p>
      {carregando ? (
        <p role="status">Carregando nutrição mensal…</p>
      ) : status && !status.habilitada ? (
        <section>
          <h2>Nutrição mensal ainda não habilitada</h2>
          <p>
            O fluxo anterior permanece disponível. A ativação depende da
            preparação do ambiente.
          </p>
        </section>
      ) : (
        <>
          {status && !status.automacao && (
            <p className="mensal-aviso">
              O processamento automático está desligado neste ambiente. As
              configurações não iniciam baixas sozinhas.
            </p>
          )}
          {vista === "configuracao" ? (
            <ConfiguracaoNutricao key={escopo ?? "consolidado"} podeLancar={podeLancar} escopo={escopo} sitios={sitios} lotes={lotes} configs={configs} onSalvo={() => { setMensagem("Configuração salva."); setRecarregar(v => v + 1); }} />
          ) : mes ? (
            <RevisaoMensal
              key={`${mes.id}:${mes.revisao}`}
              mes={mes}
              podeLancar={podeLancar}
              ocupado={ocupado}
              executar={executar}
            />
          ) : (
            <section>
              <h2>
                {vista === "alertas"
                  ? "O que precisa de atenção"
                  : "Fechamentos mensais"}
                {filtroLote && <> · {lotes.find((l) => l.id === filtroLote)?.nome ?? "lote selecionado"}</>}
              </h2>
              {filtroLote && <p><LinkNutricional href={rotaNutricao({ aba: "fechamentos" })}>Ver fechamentos de todos os lotes</LinkNutricional></p>}
              {!lista.length && (
                <p>
                  Nenhum mês processado neste contexto. Configure a nutrição e
                  processe os dias encerrados.
                </p>
              )}
              {lista
                .filter((m) => vista !== "alertas" || !m.revisadoEm)
                .map((m) => (
                  <article className="mensal-linha" key={m.id}>
                    <div>
                      <h3>
                        {m.loteNome} · {m.competencia}
                      </h3>
                      <p>
                        {modelos[m.modelo].nome} ·{" "}
                        {m.situacao
                          .replaceAll("_", " ")
                          .toLocaleLowerCase("pt-BR")}
                      </p>
                      <p className="mensal-ajuda">
                        Conferência em {data(m.prazo)} ·{" "}
                        {m.dias.filter((d) => d.pendencia).length} dias com
                        pendências
                      </p>
                    </div>
                    <Button secondary onClick={() => abrir(m)}>
                      Revisar mês
                    </Button>
                  </article>
                ))}
              <div className="mensal-acoes">
                <Button
                  secondary
                  disabled={pagina === 1}
                  onClick={() => setPagina((p) => p - 1)}
                >
                  Anterior
                </Button>
                <span>
                  Página {pagina} · {total} meses
                </span>
                <Button
                  secondary
                  disabled={pagina * 10 >= total}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </section>
          )}
          {podeLancar && vista !== "configuracao" && (
            <section>
              <h3>Processar dias encerrados</h3>
              <p className="mensal-ajuda">
                Recupera dias não processados e tenta novamente as baixas
                pendentes, sem repetir as já efetivadas.
              </p>
              <div className="mensal-campos">
                <label>
                  Lote
                  <select
                    value={lote}
                    onChange={(e) => setLote(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {lotes.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nome} · {l.propriedade.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  disabled={!lote || ocupado}
                  onClick={() => {
                    const l = lotes.find((l) => l.id === lote);
                    if (l)
                      void executar(() =>
                        api.reprocessarMensal(l.propriedade.id, l.id),
                      );
                  }}
                >
                  Processar pendências
                </Button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
function RevisaoMensal({
  mes,
  podeLancar,
  ocupado,
  executar,
}: {
  mes: api.MesNutricional;
  podeLancar: boolean;
  ocupado: boolean;
  executar: (f: () => Promise<unknown>) => Promise<void>;
}) {
  const [quantidades, setQuantidades] = useState(
      Object.fromEntries(
        mes.itens.map((i) => [
          i.produtoId,
          mes.modelo === "PROVISORIO" &&
          mes.dias.some((d) => d.situacao !== "EFETIVADO")
            ? i.prevista
            : i.confirmada,
        ]),
      ),
    ),
    [motivo, setMotivo] = useState(""),
    [selecionados, setSelecionados] = useState<string[]>([]),
    [chave, setChave] = useState(() => crypto.randomUUID());
  const [diarias, setDiarias] = useState<Record<string, string>>({}),
    [partidas, setPartidas] = useState<Record<string, DistribuicaoPartida[]>>(
      {},
    );
  function mudar() {
    setChave(crypto.randomUUID());
  }
  const diferenca = mes.itens.some(
    (i) =>
      Number(quantidades[i.produtoId]) !==
      Number(
        mes.modelo === "PROVISORIO" &&
          mes.dias.some((d) => d.situacao !== "EFETIVADO")
          ? i.prevista
          : i.confirmada,
      ),
  );
  const fechado = !!mes.revisadoEm;
  const dtoPartidas = (id: string) =>
    (partidas[id] ?? []).map((p) => ({
      partidaId: p.partidaId,
      quantidade: p.quantidade,
      cienciaValidadeDesconhecida: p.cienciaValidadeDesconhecida,
    }));
  return (
    <section>
      <Button
        secondary
        onClick={() => navegarPara("/pecuaria/nutricao?aba=fechamentos")}
      >
        Voltar aos meses
      </Button>
      <h2>
        {mes.competencia} · {mes.loteNome}
      </h2>
      <p>
        {modelos[mes.modelo].nome} · conferir em {data(mes.prazo)}
      </p>
      <p className="mensal-aviso">
        Um fechamento por mês. Quantidades calculadas pela dieta não são
        medições de ingestão individual.
      </p>
      <fieldset disabled={!podeLancar || ocupado || fechado}>
        <div className="mensal-tabela">
          <table>
            <thead>
              <tr>
                <th>Ingrediente</th>
                <th>Previsto</th>
                <th>Já baixado</th>
                <th>Total revisado</th>
                <th>Efeito</th>
                {mes.verValores && <th>Custo registrado</th>}
              </tr>
            </thead>
            <tbody>
              {mes.itens.map((i) => {
                const delta =
                  Number(quantidades[i.produtoId]) - Number(i.confirmada);
                return (
                  <tr key={i.produtoId}>
                    <th scope="row">
                      {i.nome} · {i.unidade}
                    </th>
                    <td>{quantidade(i.prevista)}</td>
                    <td>{quantidade(i.confirmada)}</td>
                    <td>
                      <input
                        aria-label={`Total revisado de ${i.nome}`}
                        type="number"
                        min="0"
                        step="0.001"
                        required
                        value={quantidades[i.produtoId]}
                        onChange={(e) => {
                          setQuantidades((q) => ({
                            ...q,
                            [i.produtoId]: e.target.value,
                          }));
                          mudar();
                        }}
                      />
                    </td>
                    <td>
                      {delta === 0
                        ? "Sem ajuste"
                        : `${delta > 0 ? "Saída" : "Recompor"} ${quantidade(String(Math.abs(delta)))} ${i.unidade}`}
                    </td>
                    {mes.verValores && (
                      <td>
                        {i.custo === null
                          ? "Não apurado"
                          : Number(i.custo).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {mes.itens
          .filter(
            (i) =>
              i.rastrearPartidas &&
              Number(quantidades[i.produtoId]) > Number(i.confirmada),
          )
          .map((i) => (
            <details key={i.produtoId}>
              <summary>Selecionar lotes físicos de {i.nome}</summary>
              <SelecaoPartidas
                compacto
                produtoId={i.produtoId}
                propriedadeId={mes.propriedadeId}
                dataFato={mes.inicio}
                quantidade={String(
                  Number(quantidades[i.produtoId]) - Number(i.confirmada),
                )}
                unidade={i.unidade}
                saida
                valor={partidas[i.produtoId] ?? []}
                onChange={(p) => {
                  setPartidas((x) => ({ ...x, [i.produtoId]: p }));
                  mudar();
                }}
              />
            </details>
          ))}
        <label>
          Justificativa das diferenças ou da reconciliação
          <textarea
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              mudar();
            }}
            maxLength={500}
          />
        </label>
        <p className="mensal-ajuda">
          Os ajustes conservam o mês de consumo e movimentam o estoque na data
          da confirmação. Perda física deve ser registrada como perda.
        </p>
      </fieldset>
      {!fechado && podeLancar && (
        <Button
          disabled={
            ocupado ||
            (diferenca && motivo.trim().length < 5) ||
            mes.itens.some(
              (i) => !/^\d{1,9}(\.\d{1,3})?$/.test(quantidades[i.produtoId]),
            )
          }
          onClick={() =>
            void executar(() =>
              api.confirmarMensal(mes.id, {
                propriedadeId: mes.propriedadeId,
                chave,
                revisao: mes.revisao,
                motivo,
                itens: mes.itens.map((i) => ({
                  produtoId: i.produtoId,
                  quantidade: quantidades[i.produtoId],
                  ...(partidas[i.produtoId]?.length
                    ? { partidas: dtoPartidas(i.produtoId) }
                    : {}),
                })),
              }),
            )
          }
        >
          Confirmar fechamento mensal
        </Button>
      )}
      {!fechado && podeLancar && (
        <Button
          secondary
          disabled={ocupado || motivo.trim().length < 5}
          onClick={() =>
            void executar(() =>
              api.reconciliarMensal(mes.id, {
                propriedadeId: mes.propriedadeId,
                chave,
                revisao: mes.revisao,
                motivo,
              }),
            )
          }
        >
          Atualizar base histórica com justificativa
        </Button>
      )}
      {fechado && (
        <>
          <p role="status">Mês revisado em {data(mes.revisadoEm!)}.</p>
          {podeLancar && (
            <div>
              <label>
                Motivo da reabertura
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </label>
              <Button
                secondary
                disabled={ocupado || motivo.trim().length < 5}
                onClick={() =>
                  void executar(() =>
                    api.reabrirMensal(mes.id, mes.propriedadeId, motivo),
                  )
                }
              >
                Reabrir para correção
              </Button>
            </div>
          )}
        </>
      )}
      <details>
        <summary>Consumos diários e pendências ({mes.dias.length})</summary>
        {mes.dias.map((d) => (
          <div key={d.id} className="mensal-dia">
            <strong>
              {data(d.data)} · {d.animais} animais
            </strong>
            <p>
              {d.dieta ?? "Sem dieta"} · {d.situacao.toLocaleLowerCase("pt-BR")}
            </p>
            {d.pendencia && (
              <p role="alert" className="mensal-aviso">
                {d.pendencia}
              </p>
            )}
            {mes.modelo !== "PROVISORIO" && podeLancar && !fechado && (
              <>
                <label>
                  <input
                    disabled={ocupado}
                    type="checkbox"
                    checked={selecionados.includes(d.id)}
                    onChange={(e) => {
                      setSelecionados((xs) =>
                        e.target.checked
                          ? [...xs, d.id]
                          : xs.filter((x) => x !== d.id),
                      );
                      mudar();
                    }}
                  />{" "}
                  Conferir este dia
                </label>
                {selecionados.includes(d.id) &&
                  d.itens.map((i) => (
                    <div key={i.id}>
                      <label>
                        {i.nome} ({i.unidade})
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={
                            diarias[i.id] ??
                            (d.situacao === "EFETIVADO"
                              ? i.confirmada
                              : i.prevista)
                          }
                          onChange={(e) => {
                            setDiarias((x) => ({
                              ...x,
                              [i.id]: e.target.value,
                            }));
                            mudar();
                          }}
                        />
                      </label>
                      {i.rastrearPartidas &&
                        Number(diarias[i.id] ?? i.prevista) >
                          Number(i.confirmada) && (
                          <details>
                            <summary>
                              Selecionar lotes físicos da saída complementar
                            </summary>
                            <SelecaoPartidas
                              compacto
                              produtoId={i.produtoId}
                              propriedadeId={mes.propriedadeId}
                              dataFato={d.data}
                              quantidade={String(
                                Number(diarias[i.id] ?? i.prevista) -
                                  Number(i.confirmada),
                              )}
                              unidade={i.unidade}
                              saida
                              valor={partidas[i.id] ?? []}
                              onChange={(p) => {
                                setPartidas((x) => ({ ...x, [i.id]: p }));
                                mudar();
                              }}
                            />
                          </details>
                        )}
                    </div>
                  ))}
              </>
            )}
          </div>
        ))}
      </details>
      {mes.modelo !== "PROVISORIO" && podeLancar && !fechado && (
        <Button
          disabled={ocupado || !selecionados.length}
          onClick={() =>
            void executar(() =>
              api.confirmarDiasMensais(mes.id, {
                propriedadeId: mes.propriedadeId,
                chave,
                revisao: mes.revisao,
                motivo,
                dias: mes.dias
                  .filter((d) => selecionados.includes(d.id))
                  .map((d) => ({
                    id: d.id,
                    itens: d.itens.map((i) => ({
                      produtoId: i.produtoId,
                      quantidade:
                        diarias[i.id] ??
                        (d.situacao === "EFETIVADO"
                          ? i.confirmada
                          : i.prevista),
                      ...(partidas[i.id]?.length
                        ? { partidas: dtoPartidas(i.id) }
                        : {}),
                    })),
                  })),
              }),
            )
          }
        >
          Confirmar dias selecionados
        </Button>
      )}
    </section>
  );
}
