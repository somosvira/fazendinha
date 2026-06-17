import { useEffect, useState } from "react";
import type { Animal } from "../types";
import { criarAnimal, editarAnimal, darBaixa, listarRacas, listarGrupos, type RacaDTO, type GrupoDTO } from "../api";
import { useEscClose } from "../../hooks/useEscClose";

type Modo = "novo" | "editar" | "baixa";

const CATEGORIAS: { v: string; label: string }[] = [
  { v: "BEZERRA", label: "Bezerra" },
  { v: "NOVILHA", label: "Novilha" },
  { v: "VACA", label: "Vaca" },
  { v: "BEZERRO", label: "Bezerro" },
  { v: "TOURO", label: "Touro" },
];

export function AnimalForm({ modo, animal, onFechar, onSalvo }: { modo: Modo; animal?: Animal; onFechar: () => void; onSalvo: () => void }) {
  useEscClose(onFechar);
  const [racas, setRacas] = useState<RacaDTO[]>([]);
  const [grupos, setGrupos] = useState<GrupoDTO[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [f, setF] = useState({
    numero: animal?.numero ?? "", nome: animal?.nome ?? "", sexo: animal?.sexo ?? "F",
    categoria: animal?.categoria ?? "NOVILHA", grauSangue: animal?.grauSangue ?? "",
    dataNascimento: animal?.dataNascimento ?? "", dataEntrada: animal?.dataEntrada ?? "",
    brincoEletronico: animal?.brincoEletronico ?? "", grupoId: animal?.grupoId ?? "", racaId: "",
    motivo: "",
  });
  useEffect(() => {
    listarRacas().then((rs) => {
      setRacas(rs);
      // edição: pré-seleciona a raça casando o nome (o DTO carrega o nome, não o id)
      if (animal?.raca) {
        const m = rs.find((r) => r.nome === animal.raca);
        if (m) setF((s) => ({ ...s, racaId: String(m.id) }));
      }
    });
    listarGrupos().then(setGrupos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      if (modo === "baixa" && animal) await darBaixa(animal.id, { motivo: f.motivo });
      else {
        const payload: any = { numero: f.numero, nome: f.nome || undefined, sexo: f.sexo, categoria: f.categoria, grauSangue: f.grauSangue || undefined, dataNascimento: f.dataNascimento || undefined, dataEntrada: f.dataEntrada, brincoEletronico: f.brincoEletronico || undefined, grupoId: f.grupoId ? Number(f.grupoId) : undefined, racaId: f.racaId ? Number(f.racaId) : undefined };
        if (modo === "novo") await criarAnimal(payload);
        else if (animal) await editarAnimal(animal.id, payload);
      }
      onSalvo();
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  }

  const titulo = modo === "novo" ? "Novo animal" : modo === "editar" ? `Editar ${animal?.nome ?? animal?.numero}` : `Dar baixa — ${animal?.nome ?? animal?.numero}`;
  return (
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer">
        <h3>{titulo}</h3>
        {modo === "baixa" ? (
          <label className="rb-fld">Motivo da baixa<input value={f.motivo} onChange={(e) => set("motivo", e.target.value)} placeholder="venda, morte, descarte…" /></label>
        ) : (
          <>
            <label className="rb-fld">Número*<input value={f.numero} onChange={(e) => set("numero", e.target.value)} /></label>
            <label className="rb-fld">Nome<input value={f.nome} onChange={(e) => set("nome", e.target.value)} /></label>
            <label className="rb-fld">Sexo<select value={f.sexo} onChange={(e) => set("sexo", e.target.value)}><option value="F">Fêmea</option><option value="M">Macho</option></select></label>
            <label className="rb-fld">Categoria<select value={f.categoria} onChange={(e) => set("categoria", e.target.value)}>{CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</select></label>
            <label className="rb-fld">Raça<select value={f.racaId} onChange={(e) => set("racaId", e.target.value)}><option value="">—</option>{racas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></label>
            <label className="rb-fld">Grau de sangue<input value={f.grauSangue} onChange={(e) => set("grauSangue", e.target.value)} placeholder="Girolando 5/8" /></label>
            <label className="rb-fld">Grupo<select value={f.grupoId} onChange={(e) => set("grupoId", e.target.value)}><option value="">—</option>{grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</select></label>
            <label className="rb-fld">Nascimento<input type="date" value={f.dataNascimento} onChange={(e) => set("dataNascimento", e.target.value)} /></label>
            <label className="rb-fld">Entrada*<input type="date" value={f.dataEntrada} onChange={(e) => set("dataEntrada", e.target.value)} /></label>
            <label className="rb-fld">Brinco eletrônico<input value={f.brincoEletronico} onChange={(e) => set("brincoEletronico", e.target.value)} /></label>
          </>
        )}
        {erro && <p className="rb-err">{erro}</p>}
        <div className="rb-drawer-actions">
          <button type="button" className="rb-btn" onClick={onFechar}>Cancelar</button>
          <button type="button" className="rb-btn pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </aside>
    </>
  );
}
