import { DatePicker } from "../../../components/DatePicker";
import { PainelCadastro } from "../../../financeiro/PainelCadastro";
import { useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { getHojeISO } from "../../../lib/hoje";
import { registrarToqueAptidao } from "./elegibilidade-api";
export function ToqueAptidaoFormulario({ animalId, propriedadeId, onMudou, emModal = false, aberto = false, onFechar }: { animalId: string; propriedadeId: number; onMudou: () => void; emModal?: boolean; aberto?: boolean; onFechar?: () => void }) {
  const [data, setData] = useState(getHojeISO);
  const [resultado, setResultado] = useState<"" | "APTO" | "NAO_APTO" | "INCONCLUSIVO">("");
  const [retorno, setRetorno] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const chave = useRef<{ assinatura: string; chave: string } | null>(null);
  const formulario = <form className="mt-4 space-y-3" onSubmit={async e => {
      e.preventDefault(); if (!resultado || ocupado) return;
      setOcupado(true); setErro(""); setMensagem("");
      const input = { animalId, propriedadeId, data, resultado, retornoEm: retorno || null, responsavel, observacao: observacao || null };
      const assinatura = JSON.stringify(input);
      if (chave.current?.assinatura !== assinatura) chave.current = { assinatura, chave: crypto.randomUUID() };
      try { await registrarToqueAptidao({ ...input, chave: chave.current.chave }); setMensagem("Exame registrado. Liberação depende de decisão individual explícita."); onMudou(); }
      catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível registrar o exame."); }
      finally { setOcupado(false); }
    }}>
      <div className="grid gap-4 sm:grid-cols-2"><label>Data do exame<DatePicker required max={getHojeISO()} value={data} onChange={(valor) => setData(valor)} /></label>
        <label>Resultado do toque<SelectCampo value={resultado} onValueChange={v => setResultado(v as typeof resultado)} required><option value="">Selecionar resultado</option><option value="APTO">Apta</option><option value="NAO_APTO">Não apta</option><option value="INCONCLUSIVO">Inconclusivo</option></SelectCampo></label>
        <label>Retorno informado<DatePicker min={data} value={retorno} onChange={(valor) => setRetorno(valor)} /></label>
        <label>Responsável pelo toque<Input required minLength={2} maxLength={160} value={responsavel} onChange={e => setResponsavel(e.target.value)}/></label></div>
      <label className="block">Observações do toque<textarea className="mt-1 min-h-24 w-full rounded border bg-background p-3" maxLength={4000} value={observacao} onChange={e => setObservacao(e.target.value)}/></label>
      <p className="text-sm text-muted-foreground">Inconclusivo não equivale a negativo. Toque de aptidão e DG são exames distintos. O retorno conserva a identidade da necessidade.</p>
      {erro && <p role="alert">{erro}</p>}{mensagem && <p role="status">{mensagem}</p>}
      <Button type="submit" disabled={ocupado || !resultado}>{ocupado ? "Registrando…" : "Registrar exame de aptidão"}</Button>
    </form>;
  return emModal ? <PainelCadastro rodape={null} aberto={aberto} titulo="Registrar toque de aptidão" onFechar={() => onFechar?.()} bloqueado={ocupado}>{formulario}</PainelCadastro> : <details className="border-t pt-4"><summary className="cursor-pointer font-semibold">Registrar toque de aptidão</summary>{formulario}</details>;
}
