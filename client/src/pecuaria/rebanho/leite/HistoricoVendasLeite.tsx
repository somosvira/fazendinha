import { Button } from "@/components/ui/button";
import { Table, TableCaption, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { useEffect, useRef, useState } from "react";
import type { ConfiguracoesFinanceiras } from "../../../financeiro/novo-api";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import { formatarLitros } from "./modelo";
import {
  lerValorCorrecao,
  nomeEstadoVenda,
  type VendaLeiteHistorico,
  type VendasLeiteHistorico,
} from "./vendas-types";
import "./operacoes.css";
interface Props {
  produtoId: string;
  data: string;
  propriedadeId: number | null;
  config: ConfiguracoesFinanceiras | null;
  podeLancar: boolean;
  revisao: number;
  onMudou: () => void;
}
const dinheiro = (valor: string) =>
  Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const corrigivel = (v: VendaLeiteHistorico) =>
  v.podeCorrigir &&
  Number(v.valorRecebidoConfirmado) === 0 &&
  !["RECEBIDA", "PARCIAL", "SUBSTITUIDA"].includes(v.estadoFinanceiro);
const dataPt = (data: string) => data.split("-").reverse().join("/");
export function HistoricoVendasLeite({
  produtoId,
  data,
  propriedadeId,
  config,
  podeLancar,
  revisao,
  onMudou,
}: Props) {
  const [pagina, setPagina] = useState(1);
  const [historico, setHistorico] = useState<VendasLeiteHistorico | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [atualizacao, setAtualizacao] = useState(0);
  const [selecionada, setSelecionada] = useState<VendaLeiteHistorico | null>(
    null,
  );
  const [aviso, setAviso] = useState("");
  const geracao = useRef(0);
  const identidade = `${propriedadeId}:${produtoId}:${data}`;
  const ultimaIdentidade = useRef(identidade);
  useEffect(() => {
    if (ultimaIdentidade.current !== identidade) {
      ultimaIdentidade.current = identidade;
      setPagina(1);
      setSelecionada(null);
      setAviso("");
    }
  }, [identidade]);
  useEffect(() => {
    const atual = ++geracao.current;
    setHistorico(null);
    setErro("");
    setCarregando(true);
    void consultarLeite<VendasLeiteHistorico>(
      `/estoque/vendas?${new URLSearchParams({ ...(produtoId ? { produtoId } : {}), de: `${data.slice(0, 7)}-01`, ate: data, pagina: String(pagina) })}`,
      propriedadeId,
    )
      .then((r) => {
        if (atual !== geracao.current) return;
        setHistorico(r);
        setSelecionada((v) =>
          v
            ? (r.itens.find(
                (i) => i.operacaoId === v.operacaoId && corrigivel(i),
              ) ?? null)
            : null,
        );
      })
      .catch((e) => {
        if (atual === geracao.current)
          setErro(
            e instanceof Error
              ? e.message
              : "Não foi possível consultar as vendas.",
          );
      })
      .finally(() => {
        if (atual === geracao.current) setCarregando(false);
      });
    return () => {
      geracao.current++;
    };
  }, [produtoId, data, propriedadeId, pagina, revisao, atualizacao]);
  return (
    <section
      className="leite-operacoes"
      aria-label="Histórico comercial do leite"
    >
      <h2>
        {produtoId ? "Vendas e versões comerciais" : "Vendas de leite do sítio"}
      </h2>
      {!produtoId && (
        <p>
          Todos os produtos de leite do sítio, inclusive produtos inativos ou
          arquivados.
        </p>
      )}
      <p>
        Período de {dataPt(`${data.slice(0, 7)}-01`)} a {dataPt(data)}. A
        correção preserva os litros e a saída física original.
      </p>
      <Button variant="outline"
        type="button"
        className="leite-secondary"
        disabled={carregando}
        onClick={() => setAtualizacao((r) => r + 1)}
      >
        Atualizar vendas
      </Button>
      {carregando && <p role="status">Consultando vendas e versões…</p>}
      {erro && <p role="alert">{erro}</p>}
      {aviso && <p role="status">{aviso}</p>}
      {historico && (
        <>
          <div className="leite-tabela-scroll">
            <Table semContainer>
              <TableCaption>
                Histórico comercial · versões vigentes e substituídas
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Venda</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Volume e valor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Correção</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.itens.map((v) => (
                  <TableRow key={v.operacaoId}>
                    <TableCell>
                      #{v.numero}
                      <small>
                        {dataPt(v.data)} · versão {v.versaoComercial}
                      </small>
                    </TableCell>
                    <TableCell>{v.parceiroNome ?? "Comprador não informado"}</TableCell>
                    <TableCell>
                      {formatarLitros(Number(v.quantidadeLitros))}
                      <br />
                      {dinheiro(v.valorTotal)}
                    </TableCell>
                    <TableCell>
                      {nomeEstadoVenda(v.estadoFinanceiro)}
                      <small>
                        Recebido confirmado:{" "}
                        {dinheiro(v.valorRecebidoConfirmado)}
                      </small>
                    </TableCell>
                    <TableCell>
                      {v.motivoCorrecao && (
                        <p>Motivo registrado: {v.motivoCorrecao}</p>
                      )}
                      {v.motivoBloqueio && <p>{v.motivoBloqueio}</p>}
                      {(v.estadoFinanceiro === "RECEBIDA" ||
                        v.estadoFinanceiro === "PARCIAL") &&
                        !v.podeCorrigir && (
                          <small>
                            A regularização dos recebimentos deve ser feita
                            explicitamente no Financeiro. Esta tela não devolve
                            dinheiro nem litros automaticamente.
                          </small>
                        )}
                      {podeLancar && corrigivel(v) && (
                        <Button variant="outline"
                          type="button"
                          className="leite-secondary"
                          disabled={!config || carregando}
                          onClick={() => {
                            setSelecionada(v);
                            setAviso("");
                          }}
                        >
                          Corrigir venda #{v.numero}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!historico.itens.length && (
            <p>Nenhuma venda registrada para o filtro no período.</p>
          )}
          <div className="leite-form-inline">
            <Button variant="outline"
              type="button"
              className="leite-secondary"
              disabled={pagina <= 1 || carregando}
              onClick={() => {
                setSelecionada(null);
                setPagina((p) => p - 1);
              }}
            >
              Vendas anteriores
            </Button>
            <span>
              Página {pagina} · {historico.total} versões
            </span>
            <Button variant="outline"
              type="button"
              className="leite-secondary"
              disabled={
                pagina * historico.porPagina >= historico.total || carregando
              }
              onClick={() => {
                setSelecionada(null);
                setPagina((p) => p + 1);
              }}
            >
              Próxima página de vendas
            </Button>
          </div>
        </>
      )}
      {podeLancar && !config && (
        <p>
          Os cadastros financeiros precisam estar disponíveis para corrigir uma
          venda.
        </p>
      )}
      {podeLancar && config && selecionada && !carregando && (
        <FormularioCorrecao
          key={`${identidade}:${selecionada.operacaoId}:${selecionada.versaoComercial}`}
          venda={selecionada}
          propriedadeId={propriedadeId}
          config={config}
          aoCancelar={() => setSelecionada(null)}
          aoSalvar={() => {
            setSelecionada(null);
            setAviso(
              "Correção comercial confirmada. Os litros e a saída física única foram preservados.",
            );
            setAtualizacao((r) => r + 1);
            onMudou();
          }}
        />
      )}
    </section>
  );
}
function FormularioCorrecao({
  venda,
  propriedadeId,
  config,
  aoCancelar,
  aoSalvar,
}: {
  venda: VendaLeiteHistorico;
  propriedadeId: number | null;
  config: ConfiguracoesFinanceiras;
  aoCancelar: () => void;
  aoSalvar: () => void;
}) {
  const [valor, setValor] = useState(venda.valorTotal);
  const [parceiro, setParceiro] = useState(venda.parceiroId ?? "");
  const [condicao, setCondicao] = useState("");
  const [conta, setConta] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [categoria, setCategoria] = useState("");
  const [centro, setCentro] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);
  async function salvar() {
    if (salvando || !corrigivel(venda)) return;
    setErro("");
    let valorTotal: number;
    try {
      valorTotal = lerValorCorrecao(valor);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Valor inválido");
      return;
    }
    if (
      !parceiro ||
      motivo.trim().length < 5 ||
      !condicao ||
      (condicao === "A_VISTA" ? !conta : !vencimento)
    ) {
      setErro(
        "Informe comprador, motivo e a nova condição financeira completa.",
      );
      return;
    }
    setSalvando(true);
    try {
      await registrarLeite("/estoque/vendas/correcoes", propriedadeId, {
        operacaoId: venda.operacaoId,
        versaoEsperada: venda.versaoComercial,
        parceiroId: parceiro,
        valorTotal,
        motivo: motivo.trim(),
        ...(categoria ? { categoriaId: categoria } : {}),
        ...(centro ? { centroCustoId: centro } : {}),
        financeiro:
          condicao === "A_VISTA"
            ? { condicao: "A_VISTA", contaId: conta }
            : {
                condicao: "A_PRAZO",
                parcelas: [{ valor: valorTotal, dataVencimento: vencimento }],
              },
      });
      if (vivo.current) aoSalvar();
    } catch (e) {
      if (vivo.current)
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível corrigir. Os campos foram preservados.",
        );
    } finally {
      if (vivo.current) setSalvando(false);
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      <fieldset disabled={salvando}>
        <legend>Corrigir comercialmente a venda #{venda.numero}</legend>
        <p>
          Origem preservada: {formatarLitros(Number(venda.quantidadeLitros))} em{" "}
          {dataPt(venda.data)}. Esta confirmação altera a versão comercial e
          mantém uma única saída física.
        </p>
        <div className="leite-form-inline">
          <label>
            Novo valor total (R$)
            <input
              required
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </label>
          <label>
            Comprador
            <select
              required
              value={parceiro}
              onChange={(e) => setParceiro(e.target.value)}
            >
              <option value="">Selecione</option>
              {venda.parceiroId &&
                !config.parceiros.some(
                  (p) => p.ativo && p.id === venda.parceiroId,
                ) && (
                  <option value={venda.parceiroId}>
                    {venda.parceiroNome ?? "Comprador atual"} (cadastro
                    anterior)
                  </option>
                )}
              {config.parceiros
                .filter((p) => p.ativo)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Nova condição financeira
            <select
              required
              value={condicao}
              onChange={(e) => setCondicao(e.target.value)}
            >
              <option value="">Escolha explicitamente</option>
              <option value="A_PRAZO">A receber</option>
              <option value="A_VISTA">Recebido agora</option>
            </select>
          </label>
          {condicao === "A_VISTA" && (
            <label>
              Conta de recebimento
              <select
                required
                value={conta}
                onChange={(e) => setConta(e.target.value)}
              >
                <option value="">Selecione uma conta ativa</option>
                {config.contas
                  .filter((c) => c.ativo)
                  .map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.nome}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {condicao === "A_PRAZO" && (
            <label>
              Vencimento da nova parcela
              <input
                type="date"
                required
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
              />
            </label>
          )}
        </div>
        {condicao === "A_VISTA" && (
          <p>
            Recebido agora registra o recebimento do novo valor na conta
            escolhida. Os litros do estoque permanecem iguais.
          </p>
        )}
        <div className="leite-form-inline">
          <label>
            Categoria (opcional)
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              <option value="">Manter categoria anterior</option>
              {config.categorias
                .filter((c) => c.ativo)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Centro de custo (opcional)
            <select value={centro} onChange={(e) => setCentro(e.target.value)}>
              <option value="">Manter centro anterior</option>
              {config.centrosCusto
                .filter((c) => c.ativo)
                .map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.nome}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <label>
          Motivo da correção comercial
          <textarea
            required
            minLength={5}
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </label>
        {erro && <p role="alert">{erro}</p>}
        <div className="leite-form-inline">
          <Button variant="outline"
            className="leite-secondary"
            type="button"
            onClick={aoCancelar}
          >
            Cancelar correção
          </Button>
          <Button>
            {salvando ? "Corrigindo…" : "Confirmar correção comercial"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
