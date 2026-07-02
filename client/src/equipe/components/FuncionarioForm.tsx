import { useState } from "react";
import type { FuncionarioDTO } from "../types";
import { criarFuncionario, editarFuncionario, baixarFuncionario, type FuncionarioInput } from "../api";

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
  const [salarioMensal, setSalarioMensal] = useState<string>(f?.salarioMensal != null ? String(f.salarioMensal) : "");
  const [cargaMensalHoras, setCargaMensalHoras] = useState<string>(String(f?.cargaMensalHoras ?? 220));
  const [jornadaDiariaHoras, setJornadaDiariaHoras] = useState<string>(String(f?.jornadaDiariaHoras ?? 8));
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
          salarioMensal: Number(salarioMensal),
          cargaMensalHoras: Number(cargaMensalHoras),
          jornadaDiariaHoras: Number(jornadaDiariaHoras),
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
      <>
        <div className="rb-drawer-bg" onClick={onFechar} />
        <aside className="rb-drawer" role="dialog">
          <div className="rb-drawer-head">
            <h3>Dar baixa em {f?.nome}</h3>
            <button className="rb-drawer-x" onClick={onFechar} aria-label="Fechar">×</button>
          </div>
          <div className="rb-drawer-body">
            <p className="rb-sub">O funcionário sai do quadro ativo. Mantém histórico de ponto e folha.</p>
            {erro && <p style={{ color: "var(--neg)", fontSize: 13 }}>{erro}</p>}
          </div>
          <div className="rb-drawer-actions">
            <button className="rb-btn" onClick={onFechar}>Cancelar</button>
            <button className="rb-btn rb-btn-danger" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Confirmar baixa"}</button>
          </div>
        </aside>
      </>
    );
  }

  return (
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer" role="dialog">
        <div className="rb-drawer-head">
          <h3>{titulo}</h3>
          <button className="rb-drawer-x" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="rb-drawer-body">
          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 2 }}>
              <label>Nome*</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: José da Silva" />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Cargo</label>
              <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex.: Tratorista" />
            </div>
          </div>

          <div className="rb-fld">
            <label>Salário mensal (R$)*</label>
            <input type="number" step="0.01" value={salarioMensal} onChange={(e) => setSalarioMensal(e.target.value)} placeholder="Ex.: 2200.00" />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Carga mensal (h)*</label>
              <input type="number" step="1" value={cargaMensalHoras} onChange={(e) => setCargaMensalHoras(e.target.value)} />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Jornada diária (h)*</label>
              <input type="number" step="0.5" value={jornadaDiariaHoras} onChange={(e) => setJornadaDiariaHoras(e.target.value)} />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Admissão</label>
              <input type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>CPF</label>
              <input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Chave Pix</label>
              <input value={chavePix} onChange={(e) => setChavePix(e.target.value)} placeholder="CPF, telefone, e-mail…" />
            </div>
          </div>
          {erro && <p style={{ color: "var(--neg)", fontSize: 13 }}>{erro}</p>}
        </div>

        <div className="rb-drawer-actions">
          <button className="rb-btn" onClick={onFechar}>Cancelar</button>
          <button
            className="rb-btn pri"
            disabled={salvando || !nome.trim() || !salarioMensal || !cargaMensalHoras || !jornadaDiariaHoras}
            onClick={salvar}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </aside>
    </>
  );
}
