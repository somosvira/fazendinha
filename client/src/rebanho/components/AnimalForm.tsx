import { useEffect, useMemo, useState } from "react";
import { type Animal, type CategoriaAnimal, type EspecieAnimal, ESPECIE_POR_CATEGORIA } from "../types";
import { criarAnimal, editarAnimal, darBaixa, listarRacas, listarGrupos, type RacaDTO, type GrupoDTO } from "../api";
import { FRACOES, complementoLabel, montarGrauSangue, parseGrauSangue } from "../lib/sangue";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";

type Modo = "novo" | "editar" | "baixa";

const CATEGORIAS_POR_ESPECIE: Record<EspecieAnimal, { id: CategoriaAnimal; label: string }[]> = {
  BOVINO: [
    { id: "BEZERRA", label: "Bezerra" }, { id: "NOVILHA", label: "Novilha" }, { id: "VACA", label: "Vaca" },
    { id: "BEZERRO", label: "Bezerro" }, { id: "TOURO", label: "Touro" },
  ],
  CAPRINO: [
    { id: "CABRITA", label: "Cabrita" }, { id: "CABRA", label: "Cabra" },
    { id: "CABRITO", label: "Cabrito" }, { id: "BODE", label: "Bode" },
  ],
};

const LABEL_ESPECIE: Record<RacaDTO["especie"], string> = { BOVINO: "Bovinos", CAPRINO: "Caprinos" };

export function AnimalForm({ modo, animal, onFechar, onSalvo }: { modo: Modo; animal?: Animal; onFechar: () => void; onSalvo: () => void }) {
  const [racas, setRacas] = useState<RacaDTO[]>([]);
  const [grupos, setGrupos] = useState<GrupoDTO[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [f, setF] = useState({
    numero: animal?.numero ?? "", nome: animal?.nome ?? "", sexo: animal?.sexo ?? "F",
    categoria: animal?.categoria ?? "NOVILHA",
    dataNascimento: animal?.dataNascimento ?? "", dataEntrada: animal?.dataEntrada ?? "",
    brincoEletronico: animal?.brincoEletronico ?? "", grupoId: animal?.grupoId ?? "",
    racaId: "", fracaoSangue: "8/8", racaSecundariaId: "",
    motivo: "",
  });

  useEffect(() => {
    listarRacas().then((rs) => {
      setRacas(rs);
      if (animal?.raca) {
        const m = rs.find((r) => r.nome === animal.raca);
        const parsed = parseGrauSangue(animal.grauSangue, rs);
        setF((s) => ({ ...s, racaId: m ? String(m.id) : "", fracaoSangue: parsed.fracId, racaSecundariaId: parsed.racaSecundariaId }));
      }
    });
    listarGrupos().then(setGrupos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  // Espécie inferida pela categoria selecionada (Vaca → BOVINO, Cabra → CAPRINO).
  const especie = ESPECIE_POR_CATEGORIA[f.categoria as CategoriaAnimal];

  // Trocar de categoria pra outra espécie limpa raça/grau (não faz sentido manter Saanen numa vaca).
  function trocarCategoria(novaCat: string) {
    const novaEspecie = ESPECIE_POR_CATEGORIA[novaCat as CategoriaAnimal];
    setF((s) => novaEspecie !== especie
      ? { ...s, categoria: novaCat as CategoriaAnimal, racaId: "", racaSecundariaId: "", fracaoSangue: "8/8" }
      : { ...s, categoria: novaCat as CategoriaAnimal });
  }

  const racasDaEspecie = useMemo(() => racas.filter((r) => r.especie === especie), [racas, especie]);

  const racaPrimaria = racas.find((r) => String(r.id) === f.racaId);
  const racaSecundaria = racas.find((r) => String(r.id) === f.racaSecundariaId);
  const ehPuro = f.fracaoSangue === "8/8";
  const fracComp = complementoLabel(f.fracaoSangue);

  // Secundária: mesma espécie da primária, diferente dela.
  const opcoesSecundaria = racaPrimaria
    ? racas.filter((r) => r.especie === racaPrimaria.especie && r.id !== racaPrimaria.id)
    : [];

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      if (modo === "baixa" && animal) await darBaixa(animal.id, { motivo: f.motivo });
      else {
        const grauSangue = montarGrauSangue(f.fracaoSangue, racaPrimaria, racaSecundaria);
        const payload: any = {
          numero: f.numero, nome: f.nome || undefined, sexo: f.sexo, categoria: f.categoria,
          grauSangue: grauSangue ?? undefined,
          dataNascimento: f.dataNascimento || undefined, dataEntrada: f.dataEntrada,
          brincoEletronico: f.brincoEletronico || undefined,
          grupoId: f.grupoId ? Number(f.grupoId) : undefined,
          racaId: f.racaId ? Number(f.racaId) : undefined,
        };
        if (modo === "novo") await criarAnimal(payload);
        else if (animal) await editarAnimal(animal.id, payload);
      }
      onSalvo();
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  }

  const titulo = modo === "novo" ? "Novo animal" : modo === "editar" ? `Editar ${animal?.nome ?? animal?.numero}` : `Dar baixa — ${animal?.nome ?? animal?.numero}`;
  return (
    <RebModal
      title={titulo}
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
        </>
      }
    >
      <>
        {modo === "baixa" ? (
          <label className="rb-fld">Motivo da baixa<input value={f.motivo} onChange={(e) => set("motivo", e.target.value)} placeholder="venda, morte, descarte…" /></label>
        ) : (
          <>
            <label className="rb-fld">Número*<input value={f.numero} onChange={(e) => set("numero", e.target.value)} /></label>
            <label className="rb-fld">Nome<input value={f.nome} onChange={(e) => set("nome", e.target.value)} /></label>
            <label className="rb-fld">Sexo<select value={f.sexo} onChange={(e) => set("sexo", e.target.value)}><option value="F">Fêmea</option><option value="M">Macho</option></select></label>
            <label className="rb-fld">Categoria
              <select value={f.categoria} onChange={(e) => trocarCategoria(e.target.value)}>
                {(["BOVINO", "CAPRINO"] as const).map((esp) => (
                  <optgroup key={esp} label={LABEL_ESPECIE[esp]}>
                    {CATEGORIAS_POR_ESPECIE[esp].map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>

            <label className="rb-fld">Raça
              <select value={f.racaId} onChange={(e) => set("racaId", e.target.value)}>
                <option value="">—</option>
                {racasDaEspecie.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </label>

            {racaPrimaria && (
              <fieldset className="rb-fieldset">
                <legend>Grau de sangue</legend>
                <div className="rb-sangue-row">
                  <span className="rb-sangue-raca">{racaPrimaria.nome}</span>
                  <select className="rb-sangue-frac" value={f.fracaoSangue} onChange={(e) => set("fracaoSangue", e.target.value)} aria-label="Fração da raça principal">
                    {FRACOES.map((fr) => <option key={fr.id} value={fr.id}>{fr.label}</option>)}
                  </select>
                </div>
                {!ehPuro && (
                  <div className="rb-sangue-row">
                    <select className="rb-sangue-raca-sec" value={f.racaSecundariaId} onChange={(e) => set("racaSecundariaId", e.target.value)} aria-label="Raça secundária">
                      <option value="">— escolher raça —</option>
                      {opcoesSecundaria.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                    </select>
                    <span className="rb-sangue-frac-comp">{fracComp}</span>
                  </div>
                )}
              </fieldset>
            )}

            <label className="rb-fld">Grupo<select value={f.grupoId} onChange={(e) => set("grupoId", e.target.value)}><option value="">—</option>{grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</select></label>
            <label className="rb-fld">Nascimento<input type="date" value={f.dataNascimento} onChange={(e) => set("dataNascimento", e.target.value)} /></label>
            <label className="rb-fld">Entrada*<input type="date" value={f.dataEntrada} onChange={(e) => set("dataEntrada", e.target.value)} /></label>
            <label className="rb-fld">Brinco eletrônico<input value={f.brincoEletronico} onChange={(e) => set("brincoEletronico", e.target.value)} /></label>
          </>
        )}
        {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
      </>
    </RebModal>
  );
}
