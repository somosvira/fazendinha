import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { DatePicker } from "../../../components/DatePicker";
import { listarServicos, registrarAplicacaoServico, type ServicoSanitario } from "./api";

export function FormAplicacaoServico({ animalId, propriedadeId, onSalvo, onFechar }: {
  animalId: string; propriedadeId: number; onSalvo: () => void; onFechar: () => void;
}) {
  const [servicos, setServicos] = useState<ServicoSanitario[]>([]);
  const [servicoId, setServicoId] = useState("");
  const [data, setData] = useState(hoje());
  const [hora, setHora] = useState("");
  const [finalidade, setFinalidade] = useState<"TRATAMENTO" | "VACINA" | "VERMIFUGO">("VACINA");
  const [nome, setNome] = useState("");
  const [dose, setDose] = useState("");
  const [unidade, setUnidade] = useState("ML");
  const [leite, setLeite] = useState("");
  const [carne, setCarne] = useState("");
  const [partida, setPartida] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);

  useEffect(() => { listarServicos(propriedadeId).then(setServicos).catch((e) => setErro(e instanceof Error ? e.message : String(e))); }, [propriedadeId]);

  async function submeter(e: FormEvent) {
    e.preventDefault();
    if (emCurso.current) return;
    if (!servicoId || !data || !hora || !nome.trim() || !(Number(dose) > 0)) { setErro("Informe Serviço, data/hora, medicamento e dose."); return; }
    if (leite && (!Number.isInteger(Number(leite)) || Number(leite) < 0)) { setErro("A carência do leite deve ser em horas inteiras."); return; }
    if (carne && (!Number.isInteger(Number(carne)) || Number(carne) < 0)) { setErro("A carência da carne deve ser em horas inteiras."); return; }
    emCurso.current = true; setSalvando(true); setErro(null);
    try {
      await registrarAplicacaoServico({ animalId, propriedadeId, data, aplicadaEm: new Date(`${data}T${hora}:00-03:00`).toISOString(),
        finalidade, nomeProdutoAplicado: nome.trim(), dose, unidadeDose: unidade, operacaoServicoId: servicoId,
        carenciaLeiteHoras: leite === "" ? null : Number(leite), carenciaCarneHoras: carne === "" ? null : Number(carne),
        ...(partida.trim() ? { partidaCodigo: partida.trim() } : {}),
      });
      onSalvo();
    } catch (falha) { setErro(falha instanceof Error ? falha.message : String(falha)); }
    finally { emCurso.current = false; setSalvando(false); }
  }

  return <PainelCadastro aberto titulo="Registrar aplicação do Serviço" onFechar={() => { if (!salvando) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form="form-aplicacao-servico" disabled={salvando}>{salvando ? "Salvando…" : "Registrar aplicação"}</Button></>}>
    <form id="form-aplicacao-servico" onSubmit={submeter} className="grid gap-4">
      <ErrorBox erro={erro} />
      <p className="text-sm text-ink-2">A dose já está incluída no Serviço. Não haverá cadastro de Produto nem saída de estoque.</p>
      <CampoFormulario id="san-servico" rotulo="Serviço que custeou a aplicação" obrigatorio>{(p) => <select {...p} required value={servicoId} onChange={(e) => setServicoId(e.target.value)} className={classeInput}><option value="">Selecione um Serviço confirmado</option>{servicos.map((s) => <option key={s.id} value={s.id}>#{s.numero} · {s.descricao || s.parceiro?.nome || "Serviço"}</option>)}</select>}</CampoFormulario>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="san-data" rotulo="Data" obrigatorio>{(p) => <DatePicker {...p} required max={hoje()} value={data} onChange={setData} className="mt-1.5" />}</CampoFormulario>
        <CampoFormulario id="san-hora" rotulo="Hora" obrigatorio>{(p) => <input {...p} type="time" required value={hora} onChange={(e) => setHora(e.target.value)} className={classeInput} />}</CampoFormulario>
      </div>
      <CampoFormulario id="san-finalidade" rotulo="Tipo de aplicação" obrigatorio>{(p) => <select {...p} value={finalidade} onChange={(e) => setFinalidade(e.target.value as typeof finalidade)} className={classeInput}><option value="VACINA">Vacina</option><option value="VERMIFUGO">Vermífugo</option><option value="TRATAMENTO">Tratamento</option></select>}</CampoFormulario>
      <CampoFormulario id="san-nome" rotulo="Medicamento utilizado" obrigatorio>{(p) => <input {...p} required maxLength={180} value={nome} onChange={(e) => setNome(e.target.value)} className={classeInput} />}</CampoFormulario>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="san-dose" rotulo="Dose" obrigatorio>{(p) => <input {...p} required type="number" min="0.001" step="0.001" value={dose} onChange={(e) => setDose(e.target.value)} className={classeInput} />}</CampoFormulario>
        <CampoFormulario id="san-unidade" rotulo="Unidade" obrigatorio>{(p) => <select {...p} value={unidade} onChange={(e) => setUnidade(e.target.value)} className={classeInput}><option value="ML">mL</option><option value="L">L</option><option value="UN">unidade</option><option value="G">g</option><option value="KG">kg</option></select>}</CampoFormulario>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="san-leite" rotulo="Carência do leite (horas)">{(p) => <input {...p} type="number" min="0" step="1" value={leite} onChange={(e) => setLeite(e.target.value)} placeholder="Não informada" className={classeInput} />}</CampoFormulario>
        <CampoFormulario id="san-carne" rotulo="Carência da carne (horas)">{(p) => <input {...p} type="number" min="0" step="1" value={carne} onChange={(e) => setCarne(e.target.value)} placeholder="Não informada" className={classeInput} />}</CampoFormulario>
      </div>
      <CampoFormulario id="san-partida" rotulo="Código da partida do fabricante (se conhecido)">{(p) => <input {...p} maxLength={100} value={partida} onChange={(e) => setPartida(e.target.value)} className={classeInput} />}</CampoFormulario>
      <p className="text-xs text-ink-3">Campo de carência vazio significa desconhecido; zero significa que a carência foi confirmada como inexistente.</p>
    </form>
  </PainelCadastro>;
}
