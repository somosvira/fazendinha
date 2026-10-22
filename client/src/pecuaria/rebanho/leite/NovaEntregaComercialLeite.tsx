import { useEffect, useRef, useState } from "react";
import type { ConfiguracoesFinanceiras } from "../../../financeiro/novo-api";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import { CamposConferenciaEntrega } from "./ConferenciaComercialLeite";
import {
  montarConferencia,
  novaConferencia,
  numeroComercial,
  type PaginaComercial,
  type VendaVinculavel,
} from "./comercial-types";
import { formatarLitros, hojeOperacional } from "./modelo";
export function NovaEntregaComercialLeite({
  sitio,
  de,
  ate,
  podeFinanceiro,
  config,
  aoSalvar,
  aoCancelar,
}: {
  sitio: number;
  de: string;
  ate: string;
  podeFinanceiro: boolean;
  config: ConfiguracoesFinanceiras | null;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [tipo, setTipo] = useState("VENDA_EXISTENTE");
  const [candidatos, setCandidatos] =
    useState<PaginaComercial<VendaVinculavel> | null>(null);
  const [pagina, setPagina] = useState(1);
  const [vendaId, setVendaId] = useState("");
  const [erroCandidatos, setErroCandidatos] = useState("");
  const [revisao, setRevisao] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [referencia, setReferencia] = useState("");
  const [ponto, setPonto] = useState("");
  const [horario, setHorario] = useState("");
  const [conferencia, setConferencia] = useState(novaConferencia);
  const [produto, setProduto] = useState("");
  const [data, setData] = useState(ate);
  const [litros, setLitros] = useState("");
  const [valor, setValor] = useState("");
  const [parceiro, setParceiro] = useState("");
  const [condicao, setCondicao] = useState("");
  const [conta, setConta] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [categoria, setCategoria] = useState("");
  const [centro, setCentro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const vivo = useRef(true);
  const trava = useRef(false);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);
  useEffect(() => {
    let atual = true;
    setCandidatos(null);
    setVendaId("");
    setErroCandidatos("");
    setCarregando(true);
    void consultarLeite<PaginaComercial<VendaVinculavel>>(
      `/comercial/vendas-vinculaveis?${new URLSearchParams({ de, ate, pagina: String(pagina) })}`,
      sitio,
    )
      .then((r) => {
        if (atual) setCandidatos(r);
      })
      .catch((e) => {
        if (atual)
          setErroCandidatos(
            e instanceof Error
              ? e.message
              : "Não foi possível consultar vendas vinculáveis.",
          );
      })
      .finally(() => {
        if (atual) setCarregando(false);
      });
    return () => {
      atual = false;
    };
  }, [sitio, de, ate, pagina, revisao]);
  const tipoEfetivo = podeFinanceiro ? tipo : "VENDA_EXISTENTE";
  const selecionada = candidatos?.itens.find((v) => v.operacaoId === vendaId);
  async function salvar() {
    if (trava.current) return;
    setErro("");
    let vinculo: Record<string, unknown>;
    try {
      if (referencia.trim().length < 5)
        throw new Error(
          "Informe uma referência da entrega com ao menos 5 caracteres.",
        );
      if (tipoEfetivo === "NOVA_VENDA") {
        if (!podeFinanceiro || !config)
          throw new Error(
            "A criação de venda exige acesso ao Financeiro e seus cadastros.",
          );
        if (
          !produto ||
          !parceiro ||
          !condicao ||
          (condicao === "A_VISTA" ? !conta : !vencimento)
        )
          throw new Error(
            "Complete produto, comprador e a condição financeira explícita.",
          );
        const quantidadeLitros = numeroComercial(litros, 3, true),
          valorTotal = numeroComercial(valor, 2, true);
        vinculo = {
          tipo: "NOVA_VENDA",
          venda: {
            produtoId: produto,
            quantidadeLitros,
            data,
            descricao: referencia.trim(),
            parceiroId: parceiro,
            valorTotal,
            ...(categoria ? { categoriaId: categoria } : {}),
            ...(centro ? { centroCustoId: centro } : {}),
            financeiro:
              condicao === "A_VISTA"
                ? { condicao: "A_VISTA", contaId: conta }
                : {
                    condicao: "A_PRAZO",
                    parcelas: [
                      { valor: valorTotal, dataVencimento: vencimento },
                    ],
                  },
          },
        };
      } else {
        if (!selecionada?.podeVincular)
          throw new Error("Selecione uma venda vinculável sem impedimentos.");
        vinculo = { tipo: "VENDA_EXISTENTE", operacaoId: vendaId };
      }
      const payload = {
        vinculo,
        referencia: referencia.trim(),
        pontoColeta: ponto.trim() || null,
        horarioColeta: horario || null,
        ...montarConferencia(conferencia),
      };
      trava.current = true;
      setOcupado(true);
      await registrarLeite("/comercial/entregas", sitio, payload);
      if (vivo.current) aoSalvar();
    } catch (e) {
      if (vivo.current)
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível registrar a entrega.",
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
        <legend>Registrar entrega</legend>
        <label>
          Vínculo da entrega
          <select value={tipoEfetivo} onChange={(e) => setTipo(e.target.value)}>
            <option value="VENDA_EXISTENTE">
              Vincular venda já registrada
            </option>
            {podeFinanceiro && (
              <option value="NOVA_VENDA">
                Criar venda com entrega
              </option>
            )}
          </select>
        </label>
        {tipoEfetivo === "VENDA_EXISTENTE" || !podeFinanceiro ? (
          <>
            <p>
              Vincular uma venda com retirada comprovada não dá outra baixa no
              estoque e não cria outro recebimento.
            </p>
            {carregando && <p role="status">Consultando vendas vinculáveis…</p>}
            {erroCandidatos && (
              <p role="alert">
                {erroCandidatos}
                <button
                  type="button"
                  className="leite-secondary"
                  onClick={() => setRevisao((r) => r + 1)}
                >
                  Consultar vendas novamente
                </button>
              </p>
            )}
            <label>
              Venda registrada
              <select
                required
                value={vendaId}
                onChange={(e) => setVendaId(e.target.value)}
              >
                <option value="">Selecione a venda</option>
                {candidatos?.itens.map((v) => (
                  <option
                    key={v.operacaoId}
                    value={v.operacaoId}
                    disabled={!v.podeVincular}
                  >
                    #{v.numero} · {v.parceiroNome ?? "Comprador não informado"}{" "}
                    ·{" "}
                    {v.quantidadeLitros === null
                      ? "Volume não comprovado"
                      : formatarLitros(Number(v.quantidadeLitros))}
                    {v.impedimento ? ` · ${v.impedimento}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <details>
              <summary>Impedimentos para vínculo</summary>
              {candidatos?.itens
                .filter((v) => v.impedimento)
                .map((v) => (
                  <p key={v.operacaoId}>
                    Venda #{v.numero}: {v.impedimento}
                  </p>
                ))}
              {candidatos && !candidatos.itens.length && (
                <p>
                  Nenhuma venda neste período. Consulte outra faixa de datas ou
                  registre uma nova venda, se autorizado.
                </p>
              )}
            </details>
            {candidatos && (
              <div className="leite-form-inline">
                <button
                  className="leite-secondary"
                  type="button"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => p - 1)}
                >
                  Vendas anteriores
                </button>
                <span>Página {pagina}</span>
                <button
                  className="leite-secondary"
                  type="button"
                  disabled={pagina * candidatos.porPagina >= candidatos.total}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Próximas vendas
                </button>
              </div>
            )}
            {selecionada && (
              <p>
                Expedido:{" "}
                {formatarLitros(
                  selecionada.quantidadeLitros === null
                    ? null
                    : Number(selecionada.quantidadeLitros),
                )}
                . O aceite do comprador será informado separadamente.
              </p>
            )}
          </>
        ) : (
          <>
            <p>
              O preço definitivo deve estar conhecido. Esta confirmação cria a
              venda pelo motor financeiro e registra uma única saída física,
              junto com a entrega.
            </p>
            {!config ? (
              <p>
                Cadastros financeiros indisponíveis. Atualize a seção antes de
                criar a venda.
              </p>
            ) : (
              <>
                <div className="leite-form-inline">
                  <label>
                    Produto de leite
                    <select
                      required
                      value={produto}
                      onChange={(e) => setProduto(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {(config.produtosCadastro ?? config.produtos)
                        .filter(
                          (p) =>
                            p.ativo !== false &&
                            p.unidade === "L" &&
                            !p.rastrearPartidas,
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Data da retirada
                    <input
                      type="date"
                      required
                      max={hojeOperacional()}
                      value={data}
                      onChange={(e) => setData(e.target.value)}
                    />
                  </label>
                  <label>
                    Volume expedido (L)
                    <input
                      inputMode="decimal"
                      required
                      value={litros}
                      onChange={(e) => setLitros(e.target.value)}
                    />
                  </label>
                  <label>
                    Valor total definitivo (R$)
                    <input
                      inputMode="decimal"
                      required
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
                    Condição financeira
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
                  {condicao === "A_PRAZO" && (
                    <label>
                      Vencimento da parcela
                      <input
                        type="date"
                        required
                        value={vencimento}
                        onChange={(e) => setVencimento(e.target.value)}
                      />
                    </label>
                  )}
                  {condicao === "A_VISTA" && (
                    <label>
                      Conta do recebimento
                      <select
                        required
                        value={conta}
                        onChange={(e) => setConta(e.target.value)}
                      >
                        <option value="">Selecione</option>
                        {config.contas
                          .filter((c) => c.ativo)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Categoria (opcional)
                    <select
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                    >
                      <option value="">Padrão do produto</option>
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
                    <select
                      value={centro}
                      onChange={(e) => setCentro(e.target.value)}
                    >
                      <option value="">Padrão do produto</option>
                      {config.centrosCusto
                        .filter((c) => c.ativo)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                {condicao === "A_VISTA" && (
                  <p>
                    Recebido agora registra dinheiro na conta escolhida. O
                    aceite do comprador permanece um fato separado.
                  </p>
                )}
              </>
            )}
          </>
        )}
        <div className="leite-form-inline">
          <label>
            Referência da entrega
            <input
              required
              minLength={5}
              maxLength={200}
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </label>
          <label>
            Ponto de coleta (opcional)
            <input
              maxLength={200}
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
        <CamposConferenciaEntrega
          valor={conferencia}
          onChange={setConferencia}
        />
        {erro && <p role="alert">{erro}</p>}
        <div className="leite-form-inline">
          <button
            type="button"
            className="leite-secondary"
            onClick={aoCancelar}
          >
            Cancelar entrega
          </button>
          <button
            disabled={ocupado || (tipoEfetivo === "NOVA_VENDA" && !config)}
          >
            {ocupado
              ? "Registrando…"
              : tipoEfetivo === "NOVA_VENDA"
                ? "Confirmar venda e entrega"
                : "Confirmar vínculo da entrega"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
