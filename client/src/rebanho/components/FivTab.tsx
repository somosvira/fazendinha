import { useEffect, useState } from "react";
import {
  aplicarPool, criarColeta, criarGrupoPool, listarAnimais, listarColetas, listarGruposPool,
  type ColetaDTO, type GrupoPoolDTO, type OocitoInput,
} from "../api";
import { Loader } from "../../components/Loading";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";
import { RebMain, RebBox, RebAnm, RebEmpty, RebPill } from "@/components/rb/RebPrimitives";
import { RebTable } from "@/components/rb/RebTable";
import { RebHeader } from "./RebHeader";

type Opcao = { id: number; rotulo: string };
const rotuloAnimal = (numero: string, nome: string | null) => (nome ? `${nome} · #${numero}` : `#${numero}`);
const HOJE = () => new Date().toISOString().slice(0, 10);

export function FivTab() {
  const [aba, setAba] = useState<"coletas" | "pool">("coletas");
  return (
    <RebMain>
      <RebHeader eyebrow="Reprodução · FIV / TE" title="Fertilização in vitro e transferência de embrião" />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <RebButton variant={aba === "coletas" ? "pri" : "default"} onClick={() => setAba("coletas")}>Coletas</RebButton>
        <RebButton variant={aba === "pool" ? "pri" : "default"} onClick={() => setAba("pool")}>Pool de doadoras</RebButton>
      </div>
      {aba === "coletas" ? <ColetasSecao /> : <PoolSecao />}
    </RebMain>
  );
}

function ColetasSecao() {
  const [coletas, setColetas] = useState<ColetaDTO[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const recarregar = () => { setErro(null); listarColetas().then(setColetas).catch((e) => setErro(String(e.message ?? e))); };
  useEffect(recarregar, []);

  return (
    <>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="m-0 font-serif text-lg font-medium">Coletas</h3>
        <RebButton variant="pri" onClick={() => setNovo(true)}>+ Nova coleta</RebButton>
      </div>
      {erro ? <p role="alert" className="mt-[7px] text-sm text-prejuizo">Erro: {erro}</p>
        : coletas == null ? <Loader />
        : coletas.length === 0 ? <RebEmpty>Nenhuma coleta registrada. Crie a primeira para acompanhar oócitos e embriões.</RebEmpty>
        : (
          <RebTable>
            <thead><tr><th>Doadora</th><th>Data</th><th>Método</th><th>Situação</th></tr></thead>
            <tbody>{coletas.map((c) => {
              const doadora = (c as { doadora?: { numero?: string; nome?: string | null } }).doadora;
              return (
                <tr key={c.id}>
                  <td><RebAnm>{doadora?.nome ?? doadora?.numero ?? c.doadoraId}</RebAnm></td>
                  <td>{String(c.data).slice(0, 10)}</td>
                  <td>{c.metodo}</td>
                  <td><RebPill tone={c.status === "CANCELADA" ? "bad" : "ok"}>{String(c.status)}</RebPill></td>
                </tr>
              );
            })}</tbody>
          </RebTable>
        )}
      {novo && <NovaColetaForm onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); recarregar(); }} />}
    </>
  );
}

function NovaColetaForm({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: () => void }) {
  const [doadoras, setDoadoras] = useState<Opcao[]>([]);
  const [doadoraId, setDoadoraId] = useState("");
  const [data, setData] = useState(HOJE());
  const [metodo, setMetodo] = useState<"FIV" | "TE_CONVENCIONAL">("FIV");
  const [tecnico, setTecnico] = useState("");
  const [oocitos, setOocitos] = useState<OocitoInput[]>([]);
  const [qualidade, setQualidade] = useState("A");
  const [viavel, setViavel] = useState(true);
  const [quantidade, setQuantidade] = useState("1");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => { listarAnimais({ status: "ATIVO" }).then((a) => setDoadoras(a.map((x) => ({ id: Number(x.id), rotulo: rotuloAnimal(x.numero, x.nome) })))).catch(() => {}); }, []);

  const addOocito = () => {
    const q = Number(quantidade);
    if (!qualidade.trim() || !Number.isInteger(q) || q <= 0) { setErro("informe qualidade e quantidade positiva"); return; }
    setErro(null);
    setOocitos((prev) => [...prev, { qualidade: qualidade.trim().toUpperCase(), viavel, quantidade: q }]);
  };
  const salvar = async () => {
    if (!doadoraId) { setErro("selecione a doadora"); return; }
    try { await criarColeta({ doadoraId: Number(doadoraId), data, metodo, tecnico: tecnico || undefined, oocitos }); onSalvo(); }
    catch (e) { setErro(String((e as Error).message ?? e)); }
  };

  return (
    <RebBox>
      <h4>Nova coleta</h4>
      {erro && <p role="alert" className="text-sm text-prejuizo">{erro}</p>}
      <RebField label="Doadora">
        <select className="rb-field-select" value={doadoraId} onChange={(e) => setDoadoraId(e.target.value)}>
          <option value="">— selecionar —</option>
          {doadoras.map((d) => <option key={d.id} value={d.id}>{d.rotulo}</option>)}
        </select>
      </RebField>
      <RebField label="Data"><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></RebField>
      <RebField label="Método">
        <select className="rb-field-select" value={metodo} onChange={(e) => setMetodo(e.target.value as "FIV" | "TE_CONVENCIONAL")}>
          <option value="FIV">FIV</option><option value="TE_CONVENCIONAL">TE convencional</option>
        </select>
      </RebField>
      <RebField label="Técnico (opcional)"><input value={tecnico} onChange={(e) => setTecnico(e.target.value)} /></RebField>

      <h4 style={{ marginTop: 12 }}>Oócitos por qualidade</h4>
      {oocitos.length > 0 && (
        <ul className="text-sm" style={{ marginBottom: 8 }}>
          {oocitos.map((o, i) => <li key={`${o.qualidade}-${o.viavel}-${i}`}>{o.quantidade}× grau {o.qualidade} · {o.viavel ? "viável" : "inviável"}</li>)}
        </ul>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
        <RebField label="Qualidade"><input value={qualidade} onChange={(e) => setQualidade(e.target.value)} style={{ width: 80 }} /></RebField>
        <RebField label="Viável">
          <select className="rb-field-select" value={viavel ? "1" : "0"} onChange={(e) => setViavel(e.target.value === "1")}><option value="1">Sim</option><option value="0">Não</option></select>
        </RebField>
        <RebField label="Quantidade"><input type="number" min={1} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} style={{ width: 90 }} /></RebField>
        <RebButton onClick={addOocito}>Adicionar</RebButton>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <RebButton variant="pri" onClick={salvar}>Salvar coleta</RebButton>
        <RebButton onClick={onFechar}>Cancelar</RebButton>
      </div>
    </RebBox>
  );
}

function PoolSecao() {
  const [grupos, setGrupos] = useState<GrupoPoolDTO[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [doadoras, setDoadoras] = useState<Opcao[]>([]);
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);

  const recarregar = () => { setErro(null); listarGruposPool().then(setGrupos).catch((e) => setErro(String(e.message ?? e))); };
  useEffect(recarregar, []);
  useEffect(() => { listarAnimais({ status: "ATIVO" }).then((a) => setDoadoras(a.map((x) => ({ id: Number(x.id), rotulo: rotuloAnimal(x.numero, x.nome) })))).catch(() => {}); }, []);

  const criar = async () => {
    if (!nome.trim() || selecionadas.length === 0) { setErro("informe nome e ao menos uma doadora"); return; }
    try { await criarGrupoPool({ nome: nome.trim(), doadoraIds: selecionadas }); setNome(""); setSelecionadas([]); recarregar(); }
    catch (e) { setErro(String((e as Error).message ?? e)); }
  };
  const aplicar = async (id: number) => {
    try { const r = await aplicarPool(id, { data: HOJE() }); setAviso(`${r.coletasCriadas} coleta(s) em rascunho criadas.`); recarregar(); }
    catch (e) { setErro(String((e as Error).message ?? e)); }
  };

  return (
    <>
      <RebBox>
        <h4>Novo grupo de doadoras</h4>
        {erro && <p role="alert" className="text-sm text-prejuizo">{erro}</p>}
        <RebField label="Nome"><input value={nome} onChange={(e) => setNome(e.target.value)} /></RebField>
        <RebField label="Doadoras">
          <select multiple className="rb-field-select" value={selecionadas.map(String)} onChange={(e) => setSelecionadas(Array.from(e.target.selectedOptions, (o) => Number(o.value)))} style={{ minHeight: 120 }}>
            {doadoras.map((d) => <option key={d.id} value={d.id}>{d.rotulo}</option>)}
          </select>
        </RebField>
        <RebButton variant="pri" onClick={criar}>Criar grupo</RebButton>
      </RebBox>

      {aviso && <p role="status" className="text-sm" style={{ color: "var(--leite)" }}>{aviso}</p>}
      {grupos == null ? <Loader />
        : grupos.length === 0 ? <RebEmpty>Nenhum grupo de doadoras. Crie um grupo e aplique para gerar coletas em lote.</RebEmpty>
        : (
          <RebTable>
            <thead><tr><th>Grupo</th><th>Doadoras</th><th>Situação</th><th></th></tr></thead>
            <tbody>{grupos.map((g) => {
              const itens = (g as { itens?: unknown[] }).itens;
              return (
                <tr key={g.id}>
                  <td><RebAnm>{g.nome}</RebAnm></td>
                  <td>{Array.isArray(itens) ? itens.length : 0}</td>
                  <td><RebPill tone={g.ativo ? "ok" : "bad"}>{g.ativo ? "Ativo" : "Inativo"}</RebPill></td>
                  <td style={{ textAlign: "right" }}><RebButton onClick={() => aplicar(g.id)}>Aplicar pool</RebButton></td>
                </tr>
              );
            })}</tbody>
          </RebTable>
        )}
    </>
  );
}
