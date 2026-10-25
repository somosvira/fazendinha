import { Button } from "@/components/ui/button";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { useEffect, useRef, useState } from "react";
import { CabecalhoTabela, TabelaFinanceira, Paginacao } from "../../../financeiro/financeiro-ui";
import type { ConfiguracoesFinanceiras } from "../../../financeiro/novo-api";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import { formatarLitros } from "./modelo";
import { DialogComercialLeite } from "./ComercialConsultaLeite";
import { lerValorCorrecao, nomeEstadoVenda, type VendaLeiteHistorico, type VendasLeiteHistorico } from "./vendas-types";
import "./operacoes.css";
interface Props {
  produtoId: string; data: string; de?: string; operacaoInicial?: string;
  propriedadeId: number | null; config: ConfiguracoesFinanceiras | null;
  podeLancar: boolean; revisao: number; onMudou: () => void;
}
const dinheiro = (valor: string) => Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const corrigivel = (v: VendaLeiteHistorico) => v.podeCorrigir && Number(v.valorRecebidoConfirmado) === 0 && !["RECEBIDA", "PARCIAL", "SUBSTITUIDA"].includes(v.estadoFinanceiro);
const dataPt = (data: string) => data.split("-").reverse().join("/");
export function HistoricoVendasLeite({ produtoId, data, de, operacaoInicial, propriedadeId, config, podeLancar, revisao, onMudou }: Props) {
  const [pagina, setPagina] = useState(1), [historico, setHistorico] = useState<VendasLeiteHistorico | null>(null), [erro, setErro] = useState(""), [atualizacao, setAtualizacao] = useState(0), [aviso, setAviso] = useState("");
  const [selecionada, setSelecionada] = useState<VendaLeiteHistorico | null>(null), [corrigir, setCorrigir] = useState(false);
  const inicio = de ?? `${data.slice(0, 7)}-01`;
  useEffect(() => { setPagina(1); setSelecionada(null); setCorrigir(false); setAviso(""); }, [produtoId, data, inicio, propriedadeId]);
  useEffect(() => {
    let ativa = true; setHistorico(null); setErro("");
    void consultarLeite<VendasLeiteHistorico>(`/estoque/vendas?${new URLSearchParams({ ...(produtoId ? { produtoId } : {}), de: inicio, ate: data, pagina: String(pagina) })}`, propriedadeId)
      .then(r => { if (ativa) { setHistorico(r); setSelecionada(v => v ? r.itens.find(i => i.operacaoId === v.operacaoId) ?? null : null); } })
      .catch(e => { if (ativa) setErro(e instanceof Error ? e.message : "Não foi possível consultar as vendas."); });
    return () => { ativa = false; };
  }, [produtoId, inicio, data, propriedadeId, pagina, revisao, atualizacao]);
  const linhas = historico?.itens ?? [];
  return <section className="leite-operacoes leite-comercial-consulta" aria-label="Histórico comercial do leite">
    <CabecalhoTabela titulo={produtoId ? "Vendas e versões comerciais" : "Vendas de leite do sítio"} descricao={`Versões de ${dataPt(inicio)} a ${dataPt(data)}.`} />
    {operacaoInicial && <p>Venda selecionada: {linhas.find(v => v.operacaoId === operacaoInicial)?.numero ? `#${linhas.find(v => v.operacaoId === operacaoInicial)!.numero}` : "consulte as versões abaixo"}. As versões anteriores permanecem neste histórico.</p>}
    {erro ? <p role="alert">{erro}<Button variant="outline" onClick={() => setAtualizacao(r => r + 1)}>Tentar novamente</Button></p> : !historico ? <p role="status">Consultando vendas e versões…</p> : <>
      <TabelaFinanceira rotulo="Histórico comercial · versões vigentes e substituídas" itens={linhas} chaveDe={v => v.operacaoId} colunas={[
        { chave: "venda", titulo: "Venda", principal: true, celula: v => <strong>#{v.numero} · versão {v.versaoComercial}</strong> },
        { chave: "data", titulo: "Data", celula: v => dataPt(v.data) },
        { chave: "comprador", titulo: "Comprador", celula: v => v.parceiroNome ?? "Comprador não informado" },
        { chave: "volume", titulo: "Retirado", alinhamento: "direita", celula: v => formatarLitros(Number(v.quantidadeLitros)) },
        { chave: "estado", titulo: "Situação", celula: v => nomeEstadoVenda(v.estadoFinanceiro) },
        { chave: "acoes", titulo: "Ações", acoes: true, celula: v => <><Button variant="outline" onClick={() => { setSelecionada(v); setCorrigir(false); }}>Ver venda #{v.numero}</Button>{podeLancar && corrigivel(v) && <Button variant="outline" disabled={!config} onClick={() => { setSelecionada(v); setCorrigir(true); }}>Corrigir venda #{v.numero}</Button>}</> },
      ]} />
      {!linhas.length && <p>Nenhuma venda registrada para o filtro no período.</p>}
      <Paginacao pagina={pagina} totalPaginas={Math.max(1,Math.ceil(historico.total / historico.porPagina))} total={historico.total} porPagina={historico.porPagina} rotulo="Paginação de versões comerciais" substantivo="versões" idSelect="pagina-versoes-leite" onPagina={setPagina} />
    </>}
    {aviso && <p role="status">{aviso}</p>}
    <DialogComercialLeite titulo={corrigir ? `Corrigir venda #${selecionada?.numero}` : `Venda #${selecionada?.numero}`} aberto={!!selecionada} onFechar={() => setSelecionada(null)}>
      {selecionada && <>{corrigir && podeLancar && config && corrigivel(selecionada) ? <FormularioCorrecao key={`${selecionada.operacaoId}:${selecionada.versaoComercial}`} venda={selecionada} propriedadeId={propriedadeId} config={config} aoCancelar={() => setSelecionada(null)} aoSalvar={() => { setSelecionada(null); setAviso("Correção comercial confirmada. Os litros e a saída física única foram preservados."); setAtualizacao(r => r + 1); onMudou(); }} /> : <>
        <dl className="leite-comercial-fatos"><div><dt>Valor total</dt><dd>{dinheiro(selecionada.valorTotal)}</dd></div><div><dt>Recebido confirmado</dt><dd>{dinheiro(selecionada.valorRecebidoConfirmado)}</dd></div><div><dt>Saída física preservada</dt><dd>{formatarLitros(Number(selecionada.quantidadeLitros))}</dd></div><div><dt>Estado financeiro</dt><dd>{nomeEstadoVenda(selecionada.estadoFinanceiro)}</dd></div></dl>
        {selecionada.motivoCorrecao && <p>Motivo registrado: {selecionada.motivoCorrecao}</p>}{selecionada.motivoBloqueio && <p>{selecionada.motivoBloqueio}</p>}
        {["RECEBIDA","PARCIAL"].includes(selecionada.estadoFinanceiro) && !selecionada.podeCorrigir && <p>A regularização dos recebimentos deve ser feita explicitamente no Financeiro. Esta tela não devolve dinheiro nem litros automaticamente.</p>}
        <Button variant="outline" asChild><a href={`/financeiro/operacoes/${selecionada.operacaoId}`}>Abrir operação financeira #{selecionada.numero}</a></Button>
      </>}</>}
    </DialogComercialLeite>
  </section>;
}
export function FormularioCorrecao({
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
            <SelectCampo disabled={salvando}
              required
              value={parceiro}
              onValueChange={setParceiro}
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
            </SelectCampo>
          </label>
          <label>
            Nova condição financeira
            <SelectCampo disabled={salvando}
              required
              value={condicao}
              onValueChange={setCondicao}
            >
              <option value="">Escolha explicitamente</option>
              <option value="A_PRAZO">A receber</option>
              <option value="A_VISTA">Recebido agora</option>
            </SelectCampo>
          </label>
          {condicao === "A_VISTA" && (
            <label>
              Conta de recebimento
              <SelectCampo disabled={salvando}
                required
                value={conta}
                onValueChange={setConta}
              >
                <option value="">Selecione uma conta ativa</option>
                {config.contas
                  .filter((c) => c.ativo)
                  .map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.nome}
                    </option>
                  ))}
              </SelectCampo>
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
            <SelectCampo disabled={salvando}
              value={categoria}
              onValueChange={setCategoria}
            >
              <option value="">Manter categoria anterior</option>
              {config.categorias
                .filter((c) => c.ativo)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
            </SelectCampo>
          </label>
          <label>
            Centro de custo (opcional)
            <SelectCampo disabled={salvando} value={centro} onValueChange={setCentro}>
              <option value="">Manter centro anterior</option>
              {config.centrosCusto
                .filter((c) => c.ativo)
                .map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.nome}
                  </option>
                ))}
            </SelectCampo>
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
