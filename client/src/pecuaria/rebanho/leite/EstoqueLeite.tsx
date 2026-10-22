import { useEffect, useRef, useState } from "react";
import { listarProdutos, type ProdutoDTO } from "../../../estoque/api";
import {
  obterConfiguracoesFinanceiras,
  type ConfiguracoesFinanceiras,
} from "../../../financeiro/novo-api";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { obterFolha } from "./api";
import { ConferenciaSaldoLeite } from "./ConferenciaSaldoLeite";
import { ConfirmacaoGruposLeite } from "./ConfirmacaoGruposLeite";
import { HistoricoVendasLeite } from "./HistoricoVendasLeite";
import type { FolhaLeite } from "./types";
import { hojeOperacional, formatarLitros } from "./modelo";
import {
  consultarLeite,
  registrarLeite,
  type EstoqueLeiteDTO,
} from "./operacoes-api";

export function EstoqueLeite({
  podeLancar,
  podeFinanceiro,
}: {
  podeLancar: boolean;
  podeFinanceiro: boolean;
}) {
  const sitio = getPropriedadeAtiva();
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]),
    [produto, setProduto] = useState("");
  const [data, setData] = useState(hojeOperacional),
    [folha, setFolha] = useState<FolhaLeite | null>(null);
  const [estoque, setEstoque] = useState<EstoqueLeiteDTO | null>(null),
    [config, setConfig] = useState<ConfiguracoesFinanceiras | null>(null);
  const [erro, setErro] = useState(""),
    [aviso, setAviso] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [revisao, setRevisao] = useState(0);
  const [entrada, setEntrada] = useState(""),
    [valor, setValor] = useState(""),
    [referencia, setReferencia] = useState(""),
    [evidencia, setEvidencia] = useState(""),
    [motivo, setMotivo] = useState("");
  const [parceiro, setParceiro] = useState(""),
    [litros, setLitros] = useState(""),
    [preco, setPreco] = useState(""),
    [vencimento, setVencimento] = useState(hojeOperacional),
    [condicao, setCondicao] = useState("A_PRAZO"),
    [conta, setConta] = useState("");
  const [operacaoOrigem, setOperacaoOrigem] = useState<{
    id: string;
    acao: "classificar" | "anular";
  } | null>(null);
  const [natureza, setNatureza] = useState("COMERCIAL"),
    [motivoOperacao, setMotivoOperacao] = useState("");
  const geracao = useRef(0);
  useEffect(() => {
    let vivo = true;
    listarProdutos({ ativo: true })
      .then((p) => {
        if (vivo)
          setProdutos(
            p.filter((x) => x.unidade === "L" && !x.rastrearPartidas),
          );
      })
      .catch((e) => {
        if (vivo) setErro(String(e.message));
      });
    if (podeFinanceiro)
      obterConfiguracoesFinanceiras()
        .then((c) => {
          if (vivo) setConfig(c);
        })
        .catch((e) => {
          if (vivo) setErro(String(e.message));
        });
    return () => {
      vivo = false;
    };
  }, [podeFinanceiro]);
  useEffect(() => {
    const atual = ++geracao.current;
    setEstoque(null);
    setFolha(null);
    setErro("");
    setEntrada("");
    setOperacaoOrigem(null);
    if (!produto) return;
    Promise.all([
      consultarLeite<EstoqueLeiteDTO>(
        `/estoque?produtoId=${encodeURIComponent(produto)}`,
        sitio,
      ),
      obterFolha(data, sitio),
    ])
      .then(([e, f]) => {
        if (atual === geracao.current) {
          setEstoque(e);
          setFolha(f);
        }
      })
      .catch((e) => {
        if (atual === geracao.current) setErro(e.message);
      });
    return () => {
      geracao.current++;
    };
  }, [produto, data, sitio, revisao]);
  async function executar(
    caminho: string,
    dados: Record<string, unknown>,
    sucesso: string,
    chave = true,
  ) {
    if (ocupado || !podeLancar) return;
    const contexto = geracao.current;
    setOcupado(true);
    setErro("");
    setAviso("");
    try {
      await registrarLeite(
        caminho,
        folha?.propriedadeId ?? sitio,
        dados,
        chave,
      );
      if (contexto !== geracao.current) return;
      setAviso(sucesso);
      setRevisao((r) => r + 1);
    } catch (e) {
      if (contexto === geracao.current)
        setErro(e instanceof Error ? e.message : "Não foi possível registrar");
    } finally {
      setOcupado(false);
    }
  }
  const origem = estoque?.origens.find((o) => o.entradaId === entrada);
  const alvo = estoque?.origens.find((o) => o.entradaId === operacaoOrigem?.id);
  return (
    <section className="leite-operacoes">
      <h2 className="leite-titulo-secao">Da ordenha ao estoque</h2>
      <p>
        Salvar a folha registra as medições. A confirmação de cada grupo dá
        entrada apenas nas medições selecionadas, uma única vez, com custo a
        apurar.
      </p>
      <div className="leite-form-inline">
        <label>
          Produto de leite
          <select
            value={produto}
            disabled={ocupado}
            onChange={(e) => {
              setProduto(e.target.value);
              setAviso("");
            }}
          >
            <option value="">Selecione o produto</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dia da produção / retirada
          <input
            type="date"
            value={data}
            disabled={ocupado}
            onChange={(e) => {
              setData(e.target.value);
              setAviso("");
            }}
          />
        </label>
      </div>
      {!produtos.length && (
        <p>
          Cadastre no Estoque um produto de leite em litros, sem rastreio por
          partida, antes da confirmação.
        </p>
      )}
      {erro && <p role="alert">{erro}</p>}
      {aviso && <p role="status">{aviso}</p>}
      {estoque && (
        <>
          <dl className="leite-indicadores">
            <div>
              <dt>Saldo físico disponível</dt>
              <dd>
                {estoque.confiavel && estoque.quantidadeLitros !== null
                  ? formatarLitros(Number(estoque.quantidadeLitros))
                  : "Não aferível"}
              </dd>
            </div>
            <div>
              <dt>Saldo comercial declarado</dt>
              <dd>
                {estoque.comercial.confiavel &&
                estoque.comercial.quantidadeLitros !== null
                  ? formatarLitros(Number(estoque.comercial.quantidadeLitros))
                  : "Não aferível"}
              </dd>
            </div>
            <div>
              <dt>Valor do saldo</dt>
              <dd>
                {estoque.estadoValor === "OCULTO"
                  ? "Sem acesso a valores"
                  : estoque.estadoValor === "PENDENTE"
                    ? "A apurar"
                    : Number(estoque.valorTotal).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
              </dd>
            </div>
          </dl>
          {!estoque.confiavel && (
            <p role="status">{estoque.motivoNaoAferivel}</p>
          )}
          <h2>Confirmar grupos da produção do dia</h2>
          <button
            type="button"
            className="leite-secondary"
            disabled={ocupado}
            onClick={() => setRevisao((r) => r + 1)}
          >
            Atualizar conferência das medições
          </button>
          {!folha?.id ? (
            <p>
              A folha desse dia ainda não foi salva. Registre as medições em
              Ordenhas.
            </p>
          ) : (
            <>
              <ConfirmacaoGruposLeite
                folha={folha}
                produtoId={produto}
                produtos={produtos}
                podeLancar={podeLancar}
                ocupado={ocupado}
                executar={executar}
              />
            </>
          )}
          <h2>Origens, natureza e apuração</h2>
          <p>
            O custo pode ser documentado depois da retirada. Apurar não altera
            os litros e não cria outra despesa.
          </p>
          {!estoque.origens.length ? (
            <p>Nenhuma produção confirmada para este produto neste sítio.</p>
          ) : (
            <div className="leite-tabela-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Data de origem</th>
                    <th>Saldo da origem</th>
                    <th>Natureza declarada</th>
                    <th>Valor do saldo</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {estoque.origens.map((o) => (
                    <tr key={o.entradaId}>
                      <td>
                        {o.data.slice(0, 10).split("-").reverse().join("/")} ·{" "}
                        {o.nomeOrdenha}
                      </td>
                      <td>{formatarLitros(Number(o.quantidadeLitros))}</td>
                      <td>
                        {(
                          {
                            NAO_INFORMADA: "A declarar",
                            COMERCIAL: "Comercial",
                            COLOSTRO: "Colostro",
                            NAO_COMERCIAL: "Não comercial",
                          } as Record<string, string>
                        )[o.natureza] ?? "A declarar"}
                      </td>
                      <td>
                        {o.estadoValor === "OCULTO"
                          ? "Restrito"
                          : o.valorTotal === null
                            ? "A apurar"
                            : Number(o.valorTotal).toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                      </td>
                      <td>
                        {podeLancar && (
                          <div className="leite-form-inline">
                            {!["COLOSTRO", "NAO_COMERCIAL"].includes(
                              o.natureza,
                            ) && (
                              <button
                                className="leite-secondary"
                                disabled={ocupado}
                                onClick={() => {
                                  setOperacaoOrigem({
                                    id: o.entradaId,
                                    acao: "classificar",
                                  });
                                  setMotivoOperacao("");
                                }}
                              >
                                Declarar natureza
                              </button>
                            )}
                            <button
                              className="leite-secondary"
                              disabled={ocupado}
                              onClick={() => {
                                setOperacaoOrigem({
                                  id: o.entradaId,
                                  acao: "anular",
                                });
                                setMotivoOperacao("");
                              }}
                            >
                              Regularizar entrada
                            </button>
                          </div>
                        )}
                        {podeFinanceiro && podeLancar && (
                          <button
                            className="leite-secondary"
                            disabled={ocupado}
                            onClick={() => {
                              setEntrada(o.entradaId);
                              setValor("");
                              setMotivo("");
                            }}
                          >
                            {o.versaoApuracao
                              ? "Corrigir apuração"
                              : "Apurar custo"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {alvo && operacaoOrigem && podeLancar && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const classificar = operacaoOrigem.acao === "classificar";
                void executar(
                  classificar
                    ? "/estoque/classificacoes"
                    : "/estoque/anulacoes",
                  {
                    entradaId: alvo.entradaId,
                    motivo: motivoOperacao,
                    ...(classificar
                      ? { natureza, versaoEsperada: alvo.versaoClassificacao }
                      : {}),
                  },
                  classificar
                    ? "Natureza da entrada declarada."
                    : "Entrada anulada; confira a ordenha antes de confirmar novamente.",
                  classificar,
                );
              }}
            >
              <fieldset disabled={ocupado}>
                <legend>
                  {operacaoOrigem.acao === "classificar"
                    ? "Declarar natureza do grupo de origem"
                    : "Regularizar entrada da ordenha"}
                </legend>
                <p>
                  {alvo.data.slice(0, 10)} · {alvo.nomeOrdenha}
                </p>
                {operacaoOrigem.acao === "classificar" ? (
                  <>
                    <p>
                      Esta declaração afeta apenas este grupo de origem, sem
                      alterar os outros animais ou grupos da ordenha. A
                      declaração comercial é uma informação de vocês; não
                      certifica aptidão sanitária. Uma restrição não poderá ser
                      desfeita por esta tela.
                    </p>
                    <label>
                      Natureza
                      <select
                        value={natureza}
                        onChange={(e) => setNatureza(e.target.value)}
                      >
                        <option value="COMERCIAL">Comercial</option>
                        <option value="COLOSTRO">Colostro</option>
                        <option value="NAO_COMERCIAL">Não comercial</option>
                      </select>
                    </label>
                  </>
                ) : (
                  <p>
                    A anulação preserva o histórico e só é permitida sem litros
                    consumidos ou vendidos. Depois de regularizar todos os
                    grupos que bloqueiam uma alteração, a folha poderá ser
                    corrigida e as medições reconfirmadas, respeitando a
                    cronologia do estoque.
                  </p>
                )}
                <label>
                  Justificativa
                  <textarea
                    required
                    minLength={5}
                    maxLength={500}
                    value={motivoOperacao}
                    onChange={(e) => setMotivoOperacao(e.target.value)}
                  />
                </label>
                <div className="leite-form-inline">
                  <button>
                    Confirmar{" "}
                    {operacaoOrigem.acao === "classificar"
                      ? "declaração"
                      : "anulação"}
                  </button>
                  <button
                    className="leite-secondary"
                    type="button"
                    onClick={() => setOperacaoOrigem(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </fieldset>
            </form>
          )}
          {origem && podeFinanceiro && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void executar(
                  "/estoque/apuracoes",
                  {
                    entradaId: entrada,
                    versaoEsperada: origem.versaoApuracao,
                    valorTotal: Number(valor),
                    referencia,
                    evidencia,
                    motivo,
                  },
                  "Custo documentado e apropriado às saídas e ao saldo.",
                );
              }}
            >
              <fieldset disabled={ocupado || !podeLancar}>
                <legend>Valor total da produção de origem</legend>
                <p>
                  Informe o custo de toda a entrada, inclusive os litros que já
                  saíram.
                </p>
                <div className="leite-form-inline">
                  <label>
                    Valor total (R$)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                    />
                  </label>
                  <label>
                    Referência do fechamento
                    <input
                      required
                      minLength={2}
                      maxLength={200}
                      value={referencia}
                      onChange={(e) => setReferencia(e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Evidência do custo
                  <textarea
                    required
                    minLength={5}
                    maxLength={2000}
                    value={evidencia}
                    onChange={(e) => setEvidencia(e.target.value)}
                  />
                </label>
                <label>
                  Justificativa
                  <textarea
                    required
                    minLength={5}
                    maxLength={500}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                </label>
                <button>Confirmar apuração</button>
              </fieldset>
            </form>
          )}
          {podeFinanceiro && (
            <details>
              <summary>Registrar retirada e venda</summary>
              {!estoque.comercial.confiavel && (
                <p role="status">{estoque.comercial.motivoNaoAferivel}</p>
              )}
              <p>
                O preço definitivo já deve estar acordado. Esta confirmação
                baixa o volume e registra a venda no Financeiro. Confira os
                dados. Correções comerciais preservam a saída física e exigem
                conciliação explícita quando já houve recebimento.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void executar(
                    "/estoque/vendas",
                    {
                      produtoId: produto,
                      quantidadeLitros: Number(litros),
                      data,
                      descricao: "Retirada de leite",
                      parceiroId: parceiro,
                      valorTotal: Number(preco),
                      financeiro:
                        condicao === "A_VISTA"
                          ? { condicao, contaId: conta }
                          : {
                              condicao,
                              parcelas: [
                                {
                                  valor: Number(preco),
                                  dataVencimento: vencimento,
                                },
                              ],
                            },
                    },
                    "Retirada e venda registradas. Acompanhe o recebimento no Financeiro.",
                  );
                }}
              >
                <fieldset disabled={ocupado || !podeLancar}>
                  <legend>Dados da retirada</legend>
                  <div className="leite-form-inline">
                    <label>
                      Comprador
                      <select
                        required
                        value={parceiro}
                        onChange={(e) => setParceiro(e.target.value)}
                      >
                        <option value="">Selecione</option>
                        {config?.parceiros
                          .filter((p) => p.ativo)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nome}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Litros retirados
                      <input
                        type="number"
                        required
                        min="0.001"
                        max={estoque.comercial.quantidadeLitros ?? undefined}
                        step="0.001"
                        value={litros}
                        onChange={(e) => setLitros(e.target.value)}
                      />
                    </label>
                    <label>
                      Valor total acordado (R$)
                      <input
                        type="number"
                        required
                        min="0.01"
                        step="0.01"
                        value={preco}
                        onChange={(e) => setPreco(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="leite-form-inline">
                    <label>
                      Recebimento
                      <select
                        value={condicao}
                        onChange={(e) => setCondicao(e.target.value)}
                      >
                        <option value="A_PRAZO">A receber</option>
                        <option value="A_VISTA">Recebido agora</option>
                      </select>
                    </label>
                    {condicao === "A_PRAZO" ? (
                      <label>
                        Vencimento
                        <input
                          type="date"
                          required
                          value={vencimento}
                          onChange={(e) => setVencimento(e.target.value)}
                        />
                      </label>
                    ) : (
                      <label>
                        Conta de recebimento
                        <select
                          value={conta}
                          required
                          onChange={(e) => setConta(e.target.value)}
                        >
                          <option value="">Selecione</option>
                          {config?.contas
                            .filter((c) => c.ativo)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nome}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                    <button disabled={!config || !estoque.comercial.confiavel}>
                      Confirmar retirada e venda
                    </button>
                  </div>
                </fieldset>
              </form>
            </details>
          )}
        </>
      )}
      {produto && estoque && <ConferenciaSaldoLeite key={`${produto}:${data}:${sitio}`} produtoId={produto} data={data} propriedadeId={folha?.propriedadeId ?? sitio} podeLancar={podeLancar} />}
      {podeFinanceiro && (
        <HistoricoVendasLeite
          produtoId={produto}
          data={data}
          propriedadeId={folha?.propriedadeId ?? sitio}
          config={config}
          podeLancar={podeLancar}
          revisao={revisao}
          onMudou={() => setRevisao((r) => r + 1)}
        />
      )}
    </section>
  );
}
