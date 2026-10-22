import { SelecaoQualidadeFechamento } from "./SelecaoQualidadeFechamento";
import { useRef, useState } from "react";
import type { ConfiguracoesFinanceiras } from "../../../financeiro/novo-api";
import type { OperacaoComercialLeiteDTO } from "./comercial-operacoes-types";
import { registrarLeite } from "./operacoes-api";
import { numeroComercial } from "./comercial-types";
import { formatarLitros, hojeOperacional } from "./modelo";
export function FecharOperacaoComercialLeite({
  operacao: o,
  config,
  aoSalvar,
  aoCancelar,
}: {
  operacao: OperacaoComercialLeiteDTO;
  config: ConfiguracoesFinanceiras;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [data, setData] = useState(o.fechamento?.data ?? hojeOperacional()),
    [preco, setPreco] = useState(o.fechamento?.precoUnitario ?? ""),
    [ajuste, setAjuste] = useState(o.fechamento?.ajuste ?? "0"),
    [motivoAjuste, setMotivoAjuste] = useState(""),
    [motivo, setMotivo] = useState(""),
    [centro, setCentro] = useState(""),
    [categoria, setCategoria] = useState(""),
    [condicao, setCondicao] = useState(""),
    [conta, setConta] = useState(""),
    [vencimento, setVencimento] = useState(""),
    [erro, setErro] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const [amostras, setAmostras] = useState(() => (o.fechamento?.amostras ?? []).map(a => ({ amostraId: a.amostraId, versaoEsperada: a.versaoAmostra })));
  const [parcelas, setParcelas] = useState(() =>
      o.retiradas.map((r) => ({
        retiradaId: r.id,
        quantidadeReconhecida:
          o.fechamento?.detalhes.find((d) => d.retiradaId === r.id)
            ?.quantidadeReconhecida ?? r.quantidadeLitros,
        motivoDiferenca: "",
      })),
    ),
    trava = useRef(false),
    previaTentativa = useRef<{ payload: string; valorTotal: string } | null>(
      null,
    );
  async function salvar() {
    if (trava.current) return;
    setErro("");
    try {
      const p = numeroComercial(preco, 4, true),
        texto = ajuste.trim().replace(",", ".");
      if (!/^-?\d+(\.\d{1,2})?$/.test(texto))
        throw new Error("Informe ajuste em reais com até duas casas decimais.");
      const a = Number(texto);
      const retiradas = parcelas.map((r) => ({
        retiradaId: r.retiradaId,
        quantidadeReconhecida: numeroComercial(
          r.quantidadeReconhecida,
          3,
          false,
        ),
        motivoDiferenca: r.motivoDiferenca.trim() || null,
      }));
      for (const r of retiradas) {
        if (
          r.quantidadeReconhecida !==
            Number(
              o.retiradas.find((x) => x.id === r.retiradaId)!.quantidadeLitros,
            ) &&
          !r.motivoDiferenca
        )
          throw new Error("Justifique a diferença em cada retirada.");
      }
      if (
        !centro ||
        !condicao ||
        (condicao === "A_PRAZO" ? !vencimento : !conta)
      )
        throw new Error(
          "Complete centro, condição financeira e um acordo com valor positivo.",
        );
      if (a !== 0 && motivoAjuste.trim().length < 5)
        throw new Error("Justifique o ajuste monetário separado do volume.");
      trava.current = true;
      setOcupado(true);
      const entradaPrevia = {
          versaoEsperada: o.versao,
          precoUnitario: p,
          ajuste: a,
          retiradas,
        },
        identidadePrevia = JSON.stringify(entradaPrevia);
      // Resposta perdida do fechamento não deve exigir nova prévia com versão antiga.
      if (previaTentativa.current?.payload !== identidadePrevia) {
        const previa = await registrarLeite<{ valorTotal: string }>(
          `/comercial/operacoes/${o.id}/previa-fechamento`,
          o.propriedadeId,
          entradaPrevia,
          false,
        );
        previaTentativa.current = {
          payload: identidadePrevia,
          valorTotal: previa.valorTotal,
        };
      }
      const previa = previaTentativa.current!;
      await registrarLeite(
        `/comercial/operacoes/${o.id}/fechamentos`,
        o.propriedadeId,
        {
          versaoEsperada: o.versao,
          data,
          precoUnitario: p,
          ajuste: a,
          motivoAjuste: motivoAjuste.trim() || null,
          motivo,
          centroCustoId: centro,
          ...(categoria ? { categoriaId: categoria } : {}),
          retiradas,
          amostras,
          financeiro:
            condicao === "A_PRAZO"
              ? {
                  condicao: "A_PRAZO",
                  parcelas: [
                    {
                      valor: Number(previa.valorTotal),
                      dataVencimento: vencimento,
                    },
                  ],
                }
              : { condicao: "A_VISTA", contaId: conta },
        },
      );
      aoSalvar();
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível fechar. Confira e tente novamente.",
      );
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  return (
    <>
    <SelecaoQualidadeFechamento sitio={o.propriedadeId} inicio={o.inicio} fim={o.fim} selecionadas={amostras} onChange={setAmostras} ocupado={ocupado} />
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      <fieldset disabled={ocupado}>
        <legend>
          {o.fechamento ? "Corrigir fechamento" : "Conferir fechamento"}
        </legend>
        <p>
          Confira todas as coletas e o preço combinado. O fechamento gera uma
          venda financeira sem retirar leite novamente. Recebimentos posteriores
          ou parciais são registrados no Financeiro.
        </p>
        {o.fechamento && (
          <p>
            Para corrigir, estorne antes os recebimentos ativos no Financeiro. A
            versão anterior e as coletas ficam preservadas.
          </p>
        )}
        <div
          className="leite-tabela-scroll"
          role="region"
          tabIndex={0}
          aria-label="Reconhecimento por retirada do fechamento"
        >
          <table>
            <caption>Reconhecimento por retirada</caption>
            <thead>
              <tr>
                <th>Coleta</th>
                <th>Retirado</th>
                <th>Reconhecido (L)</th>
                <th>Justificativa de diferença</th>
              </tr>
            </thead>
            <tbody>
              {o.retiradas.map((r, i) => (
                <tr key={r.id}>
                  <td>
                    {r.data} · {r.referencia}
                  </td>
                  <td>{formatarLitros(Number(r.quantidadeLitros))}</td>
                  <td>
                    <label>
                      Litros reconhecidos em {r.referencia}
                      <input
                        required
                        inputMode="decimal"
                        value={parcelas[i].quantidadeReconhecida}
                        onChange={(e) =>
                          setParcelas((v) =>
                            v.map((x, j) =>
                              j === i
                                ? {
                                    ...x,
                                    quantidadeReconhecida: e.target.value,
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                  </td>
                  <td>
                    <label>
                      Diferença em {r.referencia}
                      <input
                        minLength={5}
                        maxLength={500}
                        value={parcelas[i].motivoDiferenca}
                        onChange={(e) =>
                          setParcelas((v) =>
                            v.map((x, j) =>
                              j === i
                                ? { ...x, motivoDiferenca: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="leite-form-inline">
          <label>
            Data do fechamento
            <input
              required
              type="date"
              min={o.fim}
              max={hojeOperacional()}
              value={data}
              disabled={!!o.fechamento}
              onChange={(e) => setData(e.target.value)}
            />
          </label>
          <label>
            Preço negociado por litro (R$)
            <input
              required
              inputMode="decimal"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
            />
          </label>
          <label>
            Ajuste monetário (R$)
            <input
              required
              inputMode="decimal"
              value={ajuste}
              onChange={(e) => setAjuste(e.target.value)}
            />
          </label>
          <label>
            Motivo do ajuste (quando houver)
            <input
              minLength={5}
              maxLength={500}
              value={motivoAjuste}
              onChange={(e) => setMotivoAjuste(e.target.value)}
            />
          </label>
          <label>
            Motivo e referência do acordo
            <input
              required
              minLength={5}
              maxLength={500}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          <label>
            Centro de custo da receita
            <select
              required
              value={centro}
              onChange={(e) => setCentro(e.target.value)}
            >
              <option value="">Selecione</option>
              {config.centrosCusto
                .filter((c) => c.ativo)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Categoria (opcional)
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              <option value="">Sem categoria</option>
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
              Vencimento
              <input
                required
                type="date"
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
        </div>
        {erro && <p role="alert">{erro}</p>}
        <div className="leite-form-inline">
          <button disabled={ocupado}>
            {ocupado ? "Registrando fechamento…" : "Confirmar fechamento"}
          </button>{" "}
          <button
            type="button"
            className="leite-secondary"
            onClick={aoCancelar}
          >
            Cancelar fechamento
          </button>
        </div>
      </fieldset>
    </form>
    </>
  );
}
