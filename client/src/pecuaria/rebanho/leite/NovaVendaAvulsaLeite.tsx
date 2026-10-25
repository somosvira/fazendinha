import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import type { ConfiguracoesFinanceiras } from "../../../financeiro/novo-api";
import { consultarLeite, registrarLeite, type EstoqueLeiteDTO } from "./operacoes-api";
import { numeroComercial } from "./comercial-types";
import { lerValorCorrecao } from "./vendas-types";
import { hojeOperacional, formatarLitros } from "./modelo";
export function NovaVendaAvulsaLeite({ sitio, config, produtos, onSalvar, onCancelar }: { sitio: number | null; config: ConfiguracoesFinanceiras; produtos: { id: string; nome: string }[]; onSalvar: () => void; onCancelar: () => void }) {
  const [produto, setProduto] = useState(""), [parceiro, setParceiro] = useState(""), [data, setData] = useState(hojeOperacional), [litros, setLitros] = useState(""), [valor, setValor] = useState(""), [condicao, setCondicao] = useState("A_PRAZO"), [conta, setConta] = useState(""), [vencimento, setVencimento] = useState(hojeOperacional);
  const [saldo, setSaldo] = useState<EstoqueLeiteDTO | null>(null), [erro, setErro] = useState(""), [salvando, setSalvando] = useState(false);
  const trava = useRef(false), vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  useEffect(() => {
    let ativa = true; setSaldo(null); setErro("");
    if (produto) void consultarLeite<EstoqueLeiteDTO>(`/estoque?produtoId=${encodeURIComponent(produto)}`, sitio).then(r => { if (ativa) setSaldo(r); }).catch(e => { if (ativa) setErro(e instanceof Error ? e.message : "Não foi possível consultar o saldo."); });
    return () => { ativa = false; };
  }, [produto, sitio]);
  async function salvar() {
    if (trava.current || !saldo?.comercial.confiavel) return;
    setErro("");
    let quantidadeLitros: number, valorTotal: number;
    try { quantidadeLitros = numeroComercial(litros, 3, true); valorTotal = lerValorCorrecao(valor); } catch (e) { setErro(e instanceof Error ? e.message : "Confira litros e valor."); return; }
    if (saldo.comercial.quantidadeLitros === null || quantidadeLitros > Number(saldo.comercial.quantidadeLitros)) { setErro("Os litros informados ultrapassam o saldo comercial disponível."); return; }
    trava.current = true; setSalvando(true);
    try {
      await registrarLeite("/estoque/vendas", sitio, { produtoId: produto, data, quantidadeLitros, descricao: "Retirada de leite", parceiroId: parceiro, valorTotal, financeiro: condicao === "A_VISTA" ? { condicao, contaId: conta } : { condicao, parcelas: [{ valor: valorTotal, dataVencimento: vencimento }] } });
      if (vivo.current) onSalvar();
    } catch (e) { if (vivo.current) setErro(e instanceof Error ? e.message : "Não foi possível registrar a venda. Os campos foram preservados."); }
    finally { trava.current = false; if (vivo.current) setSalvando(false); }
  }
  return <form onSubmit={e => { e.preventDefault(); void salvar(); }}><fieldset disabled={salvando}>
    <legend>Registrar retirada e venda avulsa</legend>
    <p>O preço deve estar acordado. Confirmar registra uma saída física e a venda no Financeiro.</p>
    <div className="leite-form-inline">
      <label>Produto de leite<SelectCampo required value={produto} onValueChange={setProduto}><option value="">Selecione</option>{produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</SelectCampo></label>
      <label>Comprador<SelectCampo required value={parceiro} onValueChange={setParceiro}><option value="">Selecione</option>{config.parceiros.filter(p => p.ativo).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</SelectCampo></label>
      <label>Data da retirada<input required type="date" max={hojeOperacional()} value={data} onChange={e => setData(e.target.value)} /></label>
      <label>Litros retirados<input required inputMode="decimal" value={litros} onChange={e => setLitros(e.target.value)} /></label>
      <label>Valor total acordado (R$)<input required inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} /></label>
      <label>Recebimento<SelectCampo value={condicao} onValueChange={setCondicao}><option value="A_PRAZO">A receber</option><option value="A_VISTA">Recebido agora</option></SelectCampo></label>
      {condicao === "A_PRAZO" ? <label>Vencimento<input required type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} /></label> : <label>Conta de recebimento<SelectCampo required value={conta} onValueChange={setConta}><option value="">Selecione</option>{config.contas.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelectCampo></label>}
    </div>
    {produto && !saldo && !erro && <p role="status">Consultando saldo comercial…</p>}
    {saldo && <p>{saldo.comercial.confiavel ? `Disponível para venda: ${formatarLitros(saldo.comercial.quantidadeLitros === null ? null : Number(saldo.comercial.quantidadeLitros))}.` : saldo.comercial.motivoNaoAferivel ?? "Saldo comercial não aferível. Confira as origens no Estoque."}</p>}
    {condicao === "A_VISTA" && <p>Recebido agora também registra o recebimento na conta escolhida.</p>}
    {erro && <p role="alert">{erro}</p>}
    <div className="leite-comercial-acoes"><Button variant="outline" type="button" onClick={onCancelar}>Cancelar</Button><Button disabled={salvando || !saldo?.comercial.confiavel || !produto || !parceiro}>{salvando ? "Registrando…" : "Confirmar retirada e venda"}</Button></div>
  </fieldset></form>;
}
