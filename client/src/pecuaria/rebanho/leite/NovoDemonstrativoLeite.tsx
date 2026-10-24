import { Button } from "@/components/ui/button";
import { Table, TableCaption, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { useEffect, useRef, useState } from "react";
import type { ConfiguracoesFinanceiras } from "../../../financeiro/novo-api";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import { formatarLitros, hojeOperacional } from "./modelo";
import {
  nomeComponente,
  numeroComercial,
  type EntregaComercial,
  type PaginaComercial,
  type ComponenteDemonstrativo,
} from "./comercial-types";
interface Alocacao {
  entrega: EntregaComercial;
  quantidade: string;
  valor: string;
  motivo: string;
}
export function NovoDemonstrativoLeite({
  sitio,
  config,
  de,
  ate,
  aoSalvar,
  aoCancelar,
}: {
  sitio: number;
  config: ConfiguracoesFinanceiras;
  de: string;
  ate: string;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [inicio, setInicio] = useState(de),
    [fim, setFim] = useState(ate),
    [parceiro, setParceiro] = useState(""),
    [referencia, setReferencia] = useState(""),
    [preco, setPreco] = useState(""),
    [volume, setVolume] = useState(""),
    [valor, setValor] = useState(""),
    [pagamento, setPagamento] = useState("");
  const [componentes, setComponentes] = useState<ComponenteDemonstrativo[]>([]),
    [alocacoes, setAlocacoes] = useState<Alocacao[]>([]),
    [entregas, setEntregas] =
      useState<PaginaComercial<EntregaComercial> | null>(null),
    [pagina, setPagina] = useState(1),
    [erroConsulta, setErroConsulta] = useState(""),
    [erro, setErro] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [revisao, setRevisao] = useState(0),
    [carregando, setCarregando] = useState(false);
  const vivo = useRef(true),
    trava = useRef(false);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);
  useEffect(() => {
    let atual = true;
    setEntregas(null);
    setErroConsulta("");
    if (!parceiro) return;
    setCarregando(true);
    void consultarLeite<PaginaComercial<EntregaComercial>>(
      `/comercial/entregas?${new URLSearchParams({ de: inicio, ate: fim, parceiroId: parceiro, pagina: String(pagina) })}`,
      sitio,
    )
      .then((r) => {
        if (atual) setEntregas(r);
      })
      .catch((e) => {
        if (atual)
          setErroConsulta(
            e instanceof Error
              ? e.message
              : "Não foi possível consultar entregas para alocação.",
          );
      })
      .finally(() => {
        if (atual) setCarregando(false);
      });
    return () => {
      atual = false;
    };
  }, [sitio, inicio, fim, parceiro, pagina, revisao]);
  function parcela(i: number, patch: Partial<Alocacao>) {
    setAlocacoes((atual) =>
      atual.map((a, j) => (i === j ? { ...a, ...patch } : a)),
    );
  }
  async function salvar() {
    if (trava.current) return;
    setErro("");
    try {
      if (!parceiro || referencia.trim().length < 5 || !alocacoes.length)
        throw new Error(
          "Informe comprador, referência e ao menos uma entrega.",
        );
      const volumeReconhecido = numeroComercial(volume, 3, true),
        valorComercial = numeroComercial(valor, 2, true),
        precoBase = numeroComercial(preco, 4),
        valorPagamentoInformado =
          pagamento.trim() === "" ? null : numeroComercial(pagamento, 2);
      const parcelas = alocacoes.map((a) => {
        if (
          a.entrega.parceiroId !== parceiro ||
          a.entrega.data < inicio ||
          a.entrega.data > fim
        )
          throw new Error(
            "Revise as entregas: comprador e datas devem corresponder ao demonstrativo.",
          );
        const quantidadeLitros = numeroComercial(a.quantidade, 3, true),
          valor = numeroComercial(a.valor, 2, true);
        const teto =
          a.entrega.quantidadeDisponivel ??
          a.entrega.limiteExpedidoPendenteLitros;
        if (
          teto === null ||
          quantidadeLitros > Number(teto) ||
          a.entrega.valorDisponivel === null ||
          valor > Number(a.entrega.valorDisponivel)
        )
          throw new Error(
            "Uma alocação excede o saldo disponível de volume ou valor da entrega.",
          );
        if (a.entrega.aceitePendente && a.motivo.trim().length < 5)
          throw new Error(
            "Justifique explicitamente cada alocação com aceite ainda pendente.",
          );
        return {
          entregaId: a.entrega.id,
          versaoEsperadaEntrega: a.entrega.versao,
          versaoVendaId: a.entrega.versaoVendaId,
          quantidadeLitros,
          valor,
          ...(a.entrega.aceitePendente
            ? { motivoAceitePendente: a.motivo.trim() }
            : {}),
        };
      });
      if (
        Math.round(
          parcelas.reduce((s, a) => s + a.quantidadeLitros, 0) * 1000,
        ) !== Math.round(volumeReconhecido * 1000) ||
        Math.round(parcelas.reduce((s, a) => s + a.valor, 0) * 100) !==
          Math.round(valorComercial * 100)
      )
        throw new Error(
          "A soma das alocações deve coincidir com o volume reconhecido e o valor comercial declarados.",
        );
      const composicao = componentes.map((c) => {
        if (c.referencia.trim().length < 5)
          throw new Error(
            "Descreva a referência de cada componente com ao menos 5 caracteres.",
          );
        return {
          natureza: c.natureza,
          valor: numeroComercial(c.valor, 2, true),
          referencia: c.referencia.trim(),
        };
      });
      trava.current = true;
      setOcupado(true);
      await registrarLeite("/comercial/demonstrativos", sitio, {
        parceiroId: parceiro,
        inicio,
        fim,
        referencia: referencia.trim(),
        precoBase,
        volumeReconhecido,
        valorComercial,
        valorPagamentoInformado,
        componentes: composicao,
        alocacoes: parcelas,
      });
      if (vivo.current) aoSalvar();
    } catch (e) {
      if (vivo.current)
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível registrar o demonstrativo.",
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
        <legend>Registrar demonstrativo do comprador</legend>
        <p>
          Este documento relaciona entregas e versões de vendas existentes. Não
          cria outra venda, baixa física ou recebimento.
        </p>
        <div className="leite-form-inline">
          <label>
            Comprador do demonstrativo
            <select
              required
              value={parceiro}
              onChange={(e) => {
                setParceiro(e.target.value);
                setPagina(1);
              }}
            >
              <option value="">Selecione</option>
              {config.parceiros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                  {!p.ativo ? " (inativo · histórico)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Início comercial
            <input
              type="date"
              required
              max={fim}
              value={inicio}
              onChange={(e) => {
                setInicio(e.target.value);
                setPagina(1);
              }}
            />
          </label>
          <label>
            Fim comercial
            <input
              type="date"
              required
              min={inicio}
              max={hojeOperacional()}
              value={fim}
              onChange={(e) => {
                setFim(e.target.value);
                setPagina(1);
              }}
            />
          </label>
          <label>
            Referência do demonstrativo
            <input
              required
              minLength={5}
              maxLength={200}
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </label>
          <label>
            Preço-base informado (R$/L)
            <input
              inputMode="decimal"
              required
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
            />
          </label>
          <label>
            Volume reconhecido (L)
            <input
              inputMode="decimal"
              required
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
            />
          </label>
          <label>
            Valor comercial informado (R$)
            <input
              inputMode="decimal"
              required
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </label>
          <label>
            Pagamento informado (R$) — opcional
            <input
              inputMode="decimal"
              value={pagamento}
              onChange={(e) => setPagamento(e.target.value)}
            />
          </label>
        </div>
        <small>
          Pagamento vazio permanece desconhecido. O valor informado neste
          documento não confirma recebimento em conta.
        </small>
        <h3>Composição informada</h3>
        <p>
          Bônus, desconto, retenção e adiantamento são registrados
          separadamente. A composição é manual e não gera pagamentos ou
          descontos automáticos no Financeiro.
        </p>
        {componentes.map((c, i) => (
          <div className="leite-form-inline" key={i}>
            <label>
              Natureza do componente {i + 1}
              <select
                value={c.natureza}
                onChange={(e) =>
                  setComponentes((atual) =>
                    atual.map((v, j) =>
                      j === i
                        ? {
                            ...v,
                            natureza: e.target
                              .value as ComponenteDemonstrativo["natureza"],
                          }
                        : v,
                    ),
                  )
                }
              >
                {["BONUS", "DESCONTO", "RETENCAO", "ADIANTAMENTO"].map((n) => (
                  <option key={n} value={n}>
                    {nomeComponente(n)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Valor do componente {i + 1} (R$)
              <input
                required
                inputMode="decimal"
                value={c.valor}
                onChange={(e) =>
                  setComponentes((atual) =>
                    atual.map((v, j) =>
                      j === i ? { ...v, valor: e.target.value } : v,
                    ),
                  )
                }
              />
            </label>
            <label>
              Referência do componente {i + 1}
              <input
                required
                minLength={5}
                maxLength={500}
                value={c.referencia}
                onChange={(e) =>
                  setComponentes((atual) =>
                    atual.map((v, j) =>
                      j === i ? { ...v, referencia: e.target.value } : v,
                    ),
                  )
                }
              />
            </label>
            <Button variant="outline"
              type="button"
              className="leite-secondary"
              onClick={() =>
                setComponentes((atual) => atual.filter((_, j) => j !== i))
              }
            >
              Remover componente {i + 1}
            </Button>
          </div>
        ))}
        <Button variant="outline"
          type="button"
          className="leite-secondary"
          disabled={componentes.length >= 100}
          onClick={() =>
            setComponentes((atual) => [
              ...atual,
              { natureza: "BONUS", valor: "", referencia: "" },
            ])
          }
        >
          Adicionar componente manual
        </Button>
        <h3>Selecionar entregas e alocar</h3>
        {!parceiro && (
          <p>Escolha o comprador para consultar entregas reais no período.</p>
        )}
        {carregando && <p role="status">Consultando saldos das entregas…</p>}
        {erroConsulta && (
          <p role="alert">
            {erroConsulta}
            <Button variant="outline"
              type="button"
              className="leite-secondary"
              onClick={() => setRevisao((r) => r + 1)}
            >
              Consultar entregas novamente
            </Button>
          </p>
        )}
        {entregas && (
          <>
            <div className="leite-tabela-scroll">
              <Table semContainer>
                <TableCaption>Entregas do comprador no período</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entrega</TableHead>
                    <TableHead>Volume para alocação</TableHead>
                    <TableHead>Valor disponível</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entregas.itens.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        {e.referencia}
                        <small>
                          {e.data.split("-").reverse().join("/")} · venda #
                          {e.numeroOperacao}
                        </small>
                      </TableCell>
                      <TableCell>
                        {e.aceitePendente ? (
                          <>
                            Aceite desconhecido
                            <small>
                              Teto expedido pendente:{" "}
                              {formatarLitros(
                                e.limiteExpedidoPendenteLitros === null
                                  ? null
                                  : Number(e.limiteExpedidoPendenteLitros),
                              )}
                            </small>
                          </>
                        ) : (
                          formatarLitros(
                            e.quantidadeDisponivel === null
                              ? null
                              : Number(e.quantidadeDisponivel),
                          )
                        )}
                      </TableCell>
                      <TableCell>
                        {e.valorDisponivel === null
                          ? "Não disponível"
                          : Number(e.valorDisponivel).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline"
                          type="button"
                          className="leite-secondary"
                          disabled={
                            alocacoes.some((a) => a.entrega.id === e.id) ||
                            alocacoes.length >= 200 ||
                            Number(
                              e.quantidadeDisponivel ??
                                e.limiteExpedidoPendenteLitros ??
                                0,
                            ) <= 0 ||
                            Number(e.valorDisponivel ?? 0) <= 0
                          }
                          onClick={() =>
                            setAlocacoes((atual) => [
                              ...atual,
                              {
                                entrega: e,
                                quantidade: "",
                                valor: "",
                                motivo: "",
                              },
                            ])
                          }
                        >
                          Alocar {e.referencia}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {!entregas.itens.length && (
              <p>Nenhuma entrega disponível no período para este comprador.</p>
            )}
            <div className="leite-form-inline">
              <Button variant="outline"
                type="button"
                className="leite-secondary"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => p - 1)}
              >
                Entregas anteriores para alocar
              </Button>
              <span>Página {pagina}</span>
              <Button variant="outline"
                type="button"
                className="leite-secondary"
                disabled={pagina * entregas.porPagina >= entregas.total}
                onClick={() => setPagina((p) => p + 1)}
              >
                Próximas entregas para alocar
              </Button>
            </div>
          </>
        )}
        {alocacoes.map((a, i) => (
          <fieldset key={a.entrega.id}>
            <legend>{a.entrega.referencia}</legend>
            <p>
              Venda #{a.entrega.numeroOperacao} · conferência versão{" "}
              {a.entrega.versao}.{" "}
              {a.entrega.aceitePendente
                ? "O aceite permanece desconhecido; o teto expedido não é aceite do comprador."
                : `Saldo de volume: ${formatarLitros(Number(a.entrega.quantidadeDisponivel))}.`}
            </p>
            <div className="leite-form-inline">
              <label>
                Litros alocados a {a.entrega.referencia}
                <input
                  required
                  inputMode="decimal"
                  value={a.quantidade}
                  onChange={(e) => parcela(i, { quantidade: e.target.value })}
                />
              </label>
              <label>
                Valor alocado a {a.entrega.referencia} (R$)
                <input
                  required
                  inputMode="decimal"
                  value={a.valor}
                  onChange={(e) => parcela(i, { valor: e.target.value })}
                />
              </label>
            </div>
            {a.entrega.aceitePendente && (
              <label>
                Justificativa do aceite pendente de {a.entrega.referencia}
                <textarea
                  required
                  minLength={5}
                  maxLength={1000}
                  value={a.motivo}
                  onChange={(e) => parcela(i, { motivo: e.target.value })}
                />
              </label>
            )}
            <Button variant="outline"
              type="button"
              className="leite-secondary"
              onClick={() =>
                setAlocacoes((atual) => atual.filter((_, j) => j !== i))
              }
            >
              Remover alocação de {a.entrega.referencia}
            </Button>
          </fieldset>
        ))}
        <p>
          As quantidades e valores de cada parcela são explícitos. A confirmação
          confere a soma e os saldos, sem repartir automaticamente.
        </p>
        {erro && <p role="alert">{erro}</p>}
        <div className="leite-form-inline">
          <Button variant="outline"
            type="button"
            className="leite-secondary"
            onClick={aoCancelar}
          >
            Cancelar demonstrativo
          </Button>
          <Button disabled={ocupado || !alocacoes.length}>
            {ocupado
              ? "Registrando…"
              : "Confirmar demonstrativo sem nova venda"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
