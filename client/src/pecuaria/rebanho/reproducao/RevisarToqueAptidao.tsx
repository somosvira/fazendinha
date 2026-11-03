import { useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { corrigirToqueAptidao } from "./elegibilidade-api";
export function RevisarToqueAptidao({ exameId, propriedadeId, onMudou }: { exameId: string; propriedadeId: number; onMudou: () => void }) {
  const [acao, setAcao] = useState("CORRIGIR");
  const [resultado, setResultado] = useState<"APTO" | "NAO_APTO" | "INCONCLUSIVO">("INCONCLUSIVO");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const chave = useRef<{ assinatura: string; chave: string } | null>(null);
  return <details className="border-t pt-3"><summary className="cursor-pointer font-medium">Revisar exame de aptidão</summary><form className="mt-3 space-y-3" onSubmit={async e => {
    e.preventDefault(); if (ocupado) return; setOcupado(true); setErro("");
    const input = { propriedadeId, motivo, ...(acao === "ANULAR" ? { anular: true } : { resultado }) };
    const assinatura = JSON.stringify(input);
    if (chave.current?.assinatura !== assinatura) chave.current = { assinatura, chave: crypto.randomUUID() };
    try { await corrigirToqueAptidao(exameId, { ...input, chave: chave.current.chave }); onMudou(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível revisar o exame."); }
    finally { setOcupado(false); }
  }}>
    <p className="text-sm text-muted-foreground">A revisão conserva o exame e a decisão anteriores. A liberação precisa ser conferida novamente.</p>
    <label>Revisão do toque<SelectCampo value={acao} onValueChange={setAcao}><option value="CORRIGIR">Corrigir resultado</option><option value="ANULAR">Anular exame</option></SelectCampo></label>
    {acao === "CORRIGIR" && <label>Resultado corrigido<SelectCampo value={resultado} onValueChange={v => setResultado(v as typeof resultado)}><option value="APTO">Apta</option><option value="NAO_APTO">Não apta</option><option value="INCONCLUSIVO">Inconclusivo</option></SelectCampo></label>}
    <label>Motivo da revisão<Input required minLength={5} maxLength={1000} value={motivo} onChange={e => setMotivo(e.target.value)}/></label>
    {erro && <p role="alert">{erro}</p>}<Button type="submit" disabled={ocupado}>{ocupado ? "Registrando…" : "Confirmar revisão do exame"}</Button>
  </form></details>;
}
