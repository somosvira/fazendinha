import { useState } from "react";
import type { FuncionarioDTO } from "../types";
import { criarFuncionario, editarFuncionario, baixarFuncionario, type FuncionarioInput } from "../api";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";

/* Drawer de cadastro/edição/baixa de funcionário — espelha o TalhaoForm.
 * Opcionais vazios são enviados como `undefined` (o backend trata como ausência),
 * nunca `null`. Salário/carga/jornada são números. */
export function FuncionarioForm({
  modo,
  funcionario,
  onFechar,
  onSalvo,
}: {
  modo: "novo" | "editar" | "baixa";
  funcionario?: FuncionarioDTO;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const f = funcionario;
  const [nome, setNome] = useState(f?.nome ?? "");
  const [cargo, setCargo] = useState(f?.cargo ?? "");
  const [setor, setSetor] = useState(f?.setor ?? "");
  const [salarioMensal, setSalarioMensal] = useState<string>(f?.salarioMensal != null ? String(f.salarioMensal) : "");
  const [cargaMensalHoras, setCargaMensalHoras] = useState<string>(String(f?.cargaMensalHoras ?? 220));
  const [jornadaDiariaHoras, setJornadaDiariaHoras] = useState<string>(String(f?.jornadaDiariaHoras ?? 8));
  const [horaEntradaPadrao, setHoraEntradaPadrao] = useState<string>(f?.horaEntradaPadrao ?? "");
  const [horaSaidaPadrao, setHoraSaidaPadrao] = useState<string>(f?.horaSaidaPadrao ?? "");
  const [intervaloPadraoMin, setIntervaloPadraoMin] = useState<string>(f?.intervaloPadraoMin != null ? String(f.intervaloPadraoMin) : "");
  const [dataAdmissao, setDataAdmissao] = useState<string>(f?.dataAdmissao ?? "");
  const [cpf, setCpf] = useState(f?.cpf ?? "");
  const [chavePix, setChavePix] = useState(f?.chavePix ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const titulo = modo === "novo" ? "Novo funcionário" : modo === "editar" ? `Editar ${f?.nome}` : `Dar baixa em ${f?.nome}`;

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      if (modo === "baixa" && f) {
        await baixarFuncionario(f.id);
      } else {
        const payload: FuncionarioInput = {
          nome: nome.trim(),
          cargo: cargo.trim() || undefined,
          setor: setor.trim() || undefined,
          salarioMensal: Number(salarioMensal),
          cargaMensalHoras: Number(cargaMensalHoras),
          jornadaDiariaHoras: Number(jornadaDiariaHoras),
          horaEntradaPadrao: horaEntradaPadrao || undefined,
          horaSaidaPadrao: horaSaidaPadrao || undefined,
          intervaloPadraoMin: intervaloPadraoMin !== "" ? Number(intervaloPadraoMin) : undefined,
          dataAdmissao: dataAdmissao || undefined,
          cpf: cpf.trim() || undefined,
          chavePix: chavePix.trim() || undefined,
        };
        if (modo === "novo") await criarFuncionario(payload);
        else if (f) await editarFuncionario(f.id, payload);
      }
      onSalvo();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  if (modo === "baixa") {
    return (
      <RebModal
        title={`Dar baixa em ${f?.nome}`}
        onClose={onFechar}
        actions={
          <>
            <RebButton onClick={onFechar}>Cancelar</RebButton>
            <RebButton variant="danger" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Confirmar baixa"}</RebButton>
          </>
        }
      >
        <p className="text-sm text-ink-3">O funcionário sai do quadro ativo. Mantém histórico de ponto e folha.</p>
        {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
      </RebModal>
    );
  }

  return (
    <RebModal
      title={titulo}
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar}>Cancelar</RebButton>
          <RebButton
            variant="pri"
            disabled={salvando || !nome.trim() || !salarioMensal || !cargaMensalHoras || !jornadaDiariaHoras}
            onClick={salvar}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </RebButton>
        </>
      }
    >
      <div className="flex gap-2.5">
        <RebField label="Nome*" style={{ flex: 2 }}>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: José da Silva" />
        </RebField>
        <RebField label="Cargo" style={{ flex: 1 }}>
          <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex.: Tratorista" />
        </RebField>
      </div>

      <RebField label="Setor">
        {/* datalist: sugere setores comuns mas deixa digitar livre (varia por fazenda). */}
        <input
          list="setores-sugeridos"
          value={setor}
          onChange={(e) => setSetor(e.target.value)}
          placeholder="Ex.: Curral (opcional — vazio = Geral)"
        />
        <datalist id="setores-sugeridos">
          <option value="Curral" />
          <option value="Ordenha" />
          <option value="Bezerreiro" />
          <option value="Recria" />
          <option value="Café" />
          <option value="Milho" />
          <option value="Geral" />
        </datalist>
      </RebField>

      <RebField label="Salário mensal (R$)*">
        <input type="number" step="0.01" value={salarioMensal} onChange={(e) => setSalarioMensal(e.target.value)} placeholder="Ex.: 2200.00" />
      </RebField>

      <div className="flex gap-2.5">
        <RebField label="Carga mensal (h)*" style={{ flex: 1 }}>
          <input type="number" step="1" value={cargaMensalHoras} onChange={(e) => setCargaMensalHoras(e.target.value)} />
        </RebField>
        <RebField label="Jornada diária (h)*" style={{ flex: 1 }}>
          <input type="number" step="0.5" value={jornadaDiariaHoras} onChange={(e) => setJornadaDiariaHoras(e.target.value)} />
        </RebField>
        <RebField label="Admissão" style={{ flex: 1 }}>
          <input type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} />
        </RebField>
      </div>

      <div className="flex gap-2.5">
        <RebField label="Entrada padrão" style={{ flex: 1 }}>
          <input type="time" value={horaEntradaPadrao} onChange={(e) => setHoraEntradaPadrao(e.target.value)} />
        </RebField>
        <RebField label="Saída padrão" style={{ flex: 1 }}>
          <input type="time" value={horaSaidaPadrao} onChange={(e) => setHoraSaidaPadrao(e.target.value)} />
        </RebField>
        <RebField label="Intervalo padrão (min)" style={{ flex: 1 }}>
          <input type="number" step="5" min="0" value={intervaloPadraoMin} placeholder="60" onChange={(e) => setIntervaloPadraoMin(e.target.value)} />
        </RebField>
      </div>
      <p className="mt-0.5 text-xs text-ink-3">
        Opcional. Preenchido, agiliza a grade do mês: use "Preencher grade" no Ponto para lançar os dias úteis automaticamente.
      </p>

      <div className="flex gap-2.5">
        <RebField label="CPF" style={{ flex: 1 }}>
          <input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
        </RebField>
        <RebField label="Chave Pix" style={{ flex: 1 }}>
          <input value={chavePix} onChange={(e) => setChavePix(e.target.value)} placeholder="CPF, telefone, e-mail…" />
        </RebField>
      </div>
      {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
    </RebModal>
  );
}
