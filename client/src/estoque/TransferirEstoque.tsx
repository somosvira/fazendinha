import { SelectCampo } from "@/financeiro/SelectCampo";
import { ArrowRightLeft, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, ErrorBox, hoje } from "../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../financeiro/PainelCadastro";
import { DatePicker } from "../components/DatePicker";
import { listarPropriedades, type PropriedadeDTO } from "../api/propriedades";
import { getPropriedadeAtiva, comPropriedade } from "../propriedadeScope";
import { listarProdutos, type ProdutoDTO } from "./api";
import { rotuloUnidade } from "../lib/unidades";
import { SelecaoPartidas, conferirDistribuicaoPartidas, type DistribuicaoPartida } from "./SelecaoPartidas";
export function TransferirEstoque({ onFechar, onSalvo, perda = false }: { perda?: boolean; onFechar: () => void; onSalvo: () => void }) {
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [sitios, setSitios] = useState<PropriedadeDTO[]>([]);
  const [origemId, setOrigemId] = useState(getPropriedadeAtiva()?.toString() ?? "");
  const [destinoId, setDestinoId] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [data, setData] = useState(hoje());
  const [motivo, setMotivo] = useState("");
  const [erroMotivo, setErroMotivo] = useState<string>();
  const motivoRef = useRef<HTMLTextAreaElement>(null);
  const formularioRef = useRef<HTMLFormElement>(null);
  const [partidas, setPartidas] = useState<DistribuicaoPartida[]>([]);
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const enviando = useRef(false);
  const produto = produtos.find((p) => p.id === produtoId);
  useEffect(() => { let vivo = true; Promise.all([listarProdutos({ ativo: true }), listarPropriedades()]).then(([p, s]) => { if (vivo) { setProdutos(p); setSitios(s); } }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, []);
  useEffect(() => { if (erroMotivo && !ocupado) motivoRef.current?.focus(); }, [erroMotivo, ocupado]);
  async function confirmar() {
    if (enviando.current) return;
    const motivoNormalizado = motivo.trim();
    if (motivoNormalizado.length < 5 || motivoNormalizado.length > 200) {
      setErroMotivo(motivoNormalizado.length < 5 ? `Descreva o motivo${perda ? " da perda" : ""} com ao menos 5 caracteres` : `O motivo${perda ? " da perda" : ""} aceita até 200 caracteres`);
      motivoRef.current?.focus();
      return;
    }
    if (!formularioRef.current?.reportValidity()) return;
    enviando.current = true; setOcupado(true); setErro(null); setErroMotivo(undefined);
    try {
      if (produto?.rastrearPartidas) conferirDistribuicaoPartidas(partidas, Number(quantidade), true);
      const r = await fetch(perda ? "/api/estoque/perdas" : "/api/estoque/transferencias", { method: "POST", headers: comPropriedade({ "content-type": "application/json" }), body: JSON.stringify({ chave, produtoId, origemId: Number(origemId), ...(perda ? {} : { destinoId: Number(destinoId) }), quantidade, data, motivo: motivoNormalizado, ...(produto?.rastrearPartidas ? { partidas: partidas.map((p) => ({ partidaId: p.partidaId, quantidade: Number(p.quantidade), cienciaValidadeDesconhecida: p.cienciaValidadeDesconhecida })) } : {}) }) });
      const d = await r.json();
      if (!r.ok) {
        if (d.campo === "motivo") { setErroMotivo(d.error); motivoRef.current?.focus(); return; }
        throw new Error(d.error ?? (perda ? "Perda não confirmada" : "Transferência não confirmada"));
      }
      onSalvo();
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { enviando.current = false; setOcupado(false); }
  }
  return <PainelCadastro largura="sm:max-w-xl" icon={perda ? TriangleAlert : ArrowRightLeft} aberto titulo={perda ? "Registrar perda de estoque" : "Transferir estoque entre sítios"} onFechar={() => { if (!ocupado) onFechar(); }} bloqueado={ocupado} rodape={<Button type="submit" form="transferir-estoque" carregando={ocupado}>{perda ? "Confirmar perda" : "Confirmar transferência"}</Button>}>
    <form ref={formularioRef} id="transferir-estoque" className="grid gap-4" noValidate onChange={() => setChave(crypto.randomUUID())} onSubmit={(e) => { e.preventDefault(); void confirmar(); }}>
      <fieldset disabled={ocupado} className="contents">
      <ErrorBox erro={erro} />
      <p className="text-sm">{perda ? "Baixa somente a quantidade perdida, com justificativa e lotes selecionados. Não cria nova despesa." : "Conserva a quantidade, unidade, lotes e valor; não cria despesa financeira."} Para estornar, abra a operação pelo Histórico do estoque no sítio de origem.</p>
      <label>Data<DatePicker required value={data} onChange={(v) => { setData(v); setChave(crypto.randomUUID()); }} /></label>
      <label>Sítio de origem<SelectCampo required className={classeInput} value={origemId} onValueChange={(valorSelecionado) => { setOrigemId(valorSelecionado); if (destinoId === valorSelecionado) setDestinoId(""); setPartidas([]); }}><option value="">Selecione</option>{sitios.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</SelectCampo></label>
      {!perda && <label>Sítio de destino<SelectCampo required className={classeInput} value={destinoId} onValueChange={(valorSelecionado) => setDestinoId(valorSelecionado)}><option value="">Selecione</option>{sitios.filter((s) => s.id !== Number(origemId)).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</SelectCampo></label>}
      <label>Produto<SelectCampo required className={classeInput} value={produtoId} onValueChange={(valorSelecionado) => { setProdutoId(valorSelecionado); setPartidas([]); }}><option value="">Selecione</option>{produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</SelectCampo></label>
      <label>Quantidade ({produto ? rotuloUnidade(produto.unidade) : "unidade do Produto"})<input required type="number" min="0.001" step="0.001" className={classeInput} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} /></label>
      {produto?.rastrearPartidas && origemId && <SelecaoPartidas key={`${produto.id}:${origemId}`} produtoId={produto.id} propriedadeId={Number(origemId)} dataFato={data} quantidade={quantidade} unidade={rotuloUnidade(produto.unidade)} saida valor={partidas} onChange={(p) => { setPartidas(p); setChave(crypto.randomUUID()); }} />}
      <CampoFormulario id="motivo-estoque" rotulo={perda ? "Motivo da perda" : "Motivo"} erro={erroMotivo} obrigatorio>
        {(props) => <textarea {...props} ref={motivoRef} required maxLength={200} className={classeInput} value={motivo} onChange={(e) => { setMotivo(e.target.value); setErroMotivo(undefined); }} />}
      </CampoFormulario>
      </fieldset>
    </form>
  </PainelCadastro>;
}
