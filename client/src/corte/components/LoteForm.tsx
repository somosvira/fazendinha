import { useState } from "react";
import type { Lote, CategoriaLote, FaseCiclo, RacaCorte } from "../types";
import { CATEGORIA_LABEL, FASE_LABEL } from "../types";
import { CATEGORIAS_ORDEM } from "../domains";
import { criarLote, editarLote, darBaixa, usePiquetes, type LoteInput } from "../api";
import { HOJE } from "../HOJE";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";
import { RebSelect } from "@/components/rb/RebSelect";
import { CampoData } from "@/components/CampoData";
import { SelectBusca } from "@/components/SelectBusca";

const FASES: FaseCiclo[] = ["CRIA", "RECRIA", "TERMINACAO", "REPRODUCAO"];

/* Explicações simples (vistas na lista aberta). Fonte: comentários de
 * CategoriaLote em ../types e o calendário sanitário (../lib/calendario). */
const CATEGORIA_DESCRICAO: Partial<Record<CategoriaLote, string>> = {
  VACA_MATRIZ: "Vacas em produção, que dão cria.",
  BEZERRO_MAMA: "Ainda mamando ao pé da vaca, até a desmama (cerca de 7 meses).",
  BEZERRA_MAMA: "Ainda mamando ao pé da vaca, até a desmama (cerca de 7 meses).",
  BEZERRO_DESMAMA: "Recém-desmamados, de 7 a 12 meses, no começo da recria.",
  BEZERRA_DESMAMA: "Recém-desmamadas, de 7 a 12 meses, no começo da recria.",
  GAROTE: "Machos castrados de 12 a 18 meses, em recria.",
  NOVILHA: "Fêmeas de 12 a 24 meses, candidatas a virar matriz.",
  NOVILHO: "Machos de 18 a 26 meses, em terminação.",
  BOI_GORDO: "Prontos para o abate (16 arrobas de carcaça ou mais).",
  VACA_DESCARTE: "Matrizes separadas para venda.",
};

const FASE_DESCRICAO: Record<FaseCiclo, string> = {
  CRIA: "Do nascimento até a desmama (cerca de 7 meses).",
  RECRIA: "Da desmama até o começo da engorda.",
  TERMINACAO: "Engorda final, até o peso de abate.",
  REPRODUCAO: "Matrizes e touros que produzem os bezerros.",
};

const RACAS: RacaCorte[] = [
  "Nelore", "Angus", "Brangus", "F1 Angus×Nelore", "F1 Hereford×Nelore",
  "Senepol", "Tabapuã", "Caracu", "Cruza Industrial",
];

/* Drawer de novo lote / edição / baixa — espelha o TalhaoForm do plantio.
 * CRÍTICO: campos opcionais vazios são OMITIDOS do payload (undefined), nunca
 * enviados como null/"" — o Zod do backend rejeita strings vazias em enums. */
export function LoteForm({ modo, lote, onFechar, onSalvo }: { modo: "novo" | "editar" | "baixa"; lote?: Lote; onFechar: () => void; onSalvo: () => void }) {
  const l = lote;
  const { data: piquetes } = usePiquetes();

  const [codigo, setCodigo] = useState(l?.codigo ?? "");
  const [nome, setNome] = useState(l?.nome ?? "");
  const [categoria, setCategoria] = useState<CategoriaLote>(l?.categoria ?? "GAROTE");
  const [fase, setFase] = useState<FaseCiclo>(l?.fase ?? "RECRIA");
  const [raca, setRaca] = useState<RacaCorte>(l?.raca ?? "Nelore");
  const [numCabecas, setNumCabecas] = useState<string>(String(l?.numCabecas ?? ""));
  const [numCabecasEntrada, setNumCabecasEntrada] = useState<string>(String(l?.numCabecasEntrada ?? ""));
  const [dataFormacao, setDataFormacao] = useState<string>(l?.dataFormacao ?? "");
  const [origem, setOrigem] = useState<string>(l?.origem ?? "");
  const [piqueteAtual, setPiqueteAtual] = useState<string>(l?.piqueteAtual ?? "");
  const [observacao, setObservacao] = useState<string>(l?.observacao ?? "");
  // Baixa
  const [estadoBaixa, setEstadoBaixa] = useState<"VENDIDO" | "EXTINTO">("VENDIDO");
  const [motivoBaixa, setMotivoBaixa] = useState<string>("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const titulo = modo === "novo" ? "Novo lote" : modo === "editar" ? `Editar ${l?.codigo}` : `Baixar ${l?.codigo}`;

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      if (modo === "baixa" && l) {
        // Omite motivo vazio (undefined), nunca envia "".
        await darBaixa(l.id, { estado: estadoBaixa, motivo: motivoBaixa || undefined });
      } else {
        const payload: LoteInput = {
          codigo,
          nome,
          categoria,
          fase,
          raca,
          numCabecas: Number(numCabecas),
          numCabecasEntrada: numCabecasEntrada ? Number(numCabecasEntrada) : Number(numCabecas),
          dataFormacao: dataFormacao || HOJE,
          // Opcionais: só entram no payload quando preenchidos (undefined caso contrário).
          origem: origem || undefined,
          piqueteAtual: piqueteAtual || undefined,
          observacao: observacao || undefined,
        };
        if (modo === "novo") await criarLote(payload);
        else if (l) await editarLote(l.id, payload);
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
        title={`Dar baixa em ${l?.codigo}`}
        onClose={onFechar}
        actions={
          <>
            <RebButton onClick={onFechar}>Cancelar</RebButton>
            <RebButton variant="danger" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Confirmar baixa"}</RebButton>
          </>
        }
      >
        <p className="text-sm text-ink-3">O lote sai do conjunto ativo. Mantém histórico para fins de fechamento da atividade.</p>
        <RebField label="Tipo de baixa">
          <RebSelect aria-label="Tipo de baixa" value={estadoBaixa} onChange={(v) => setEstadoBaixa(v as "VENDIDO" | "EXTINTO")}>
            <option value="VENDIDO" data-descricao="Use quando os animais do lote foram vendidos.">Vendido (abate / reprodução / descarte)</option>
            <option value="EXTINTO" data-descricao="Use quando o lote acabou sem venda: animais transferidos ou lote desfeito.">Extinto (transferência / dissolução do lote)</option>
          </RebSelect>
        </RebField>
        <RebField label="Motivo (opcional)">
          <input value={motivoBaixa} onChange={(e) => setMotivoBaixa(e.target.value)} placeholder="Ex.: Venda frigorífico Minerva" />
        </RebField>
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
          <RebButton variant="pri" disabled={salvando || !codigo || !nome || !numCabecas} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
        </>
      }
    >
      <div style={{ display: "flex", gap: 10 }}>
        <RebField label="Código*" style={{ flex: 1 }}>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex.: TER-03" />
        </RebField>
        <RebField label="Nome*" style={{ flex: 2 }}>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Terminação F1 · lote 3" />
        </RebField>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <RebField label="Categoria*" style={{ flex: 1 }}>
          <RebSelect aria-label="Categoria" value={categoria} onChange={(v) => setCategoria(v as CategoriaLote)}>
            {CATEGORIAS_ORDEM.map((c) => <option key={c} value={c} data-descricao={CATEGORIA_DESCRICAO[c]}>{CATEGORIA_LABEL[c]}</option>)}
          </RebSelect>
        </RebField>
        <RebField label="Fase*" style={{ flex: 1 }}>
          <RebSelect aria-label="Fase" value={fase} onChange={(v) => setFase(v as FaseCiclo)}>
            {FASES.map((f) => <option key={f} value={f} data-descricao={FASE_DESCRICAO[f]}>{FASE_LABEL[f]}</option>)}
          </RebSelect>
        </RebField>
      </div>

      <RebField label="Raça*">
        <RebSelect aria-label="Raça" value={raca} onChange={(v) => setRaca(v as RacaCorte)}>
          {RACAS.map((r) => <option key={r} value={r}>{r}</option>)}
        </RebSelect>
      </RebField>

      <div style={{ display: "flex", gap: 10 }}>
        <RebField label="Cabeças (hoje)*" style={{ flex: 1 }}>
          <input type="number" value={numCabecas} onChange={(e) => setNumCabecas(e.target.value)} />
        </RebField>
        <RebField label="Cabeças (entrada)" style={{ flex: 1 }}>
          <input type="number" value={numCabecasEntrada} onChange={(e) => setNumCabecasEntrada(e.target.value)} placeholder="= cabeças hoje" />
        </RebField>
        <RebField label="Data de formação*" style={{ flex: 1 }}>
          <CampoData variante="sublinhado" aria-label="Data de formação" value={dataFormacao} onChange={setDataFormacao} max={HOJE} />
        </RebField>
      </div>

      <RebField label="Origem">
        <input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Ex.: Nascimento próprio · Compra Boa Esperança" />
      </RebField>

      <RebField label="Piquete atual">
        <SelectBusca
          variante="sublinhado"
          aria-label="Piquete atual"
          value={piqueteAtual}
          onValueChange={setPiqueteAtual}
          opcaoVazia="—"
          placeholder="—"
          buscaPlaceholder="Buscar piquete…"
          options={piquetes.map((p) => ({ value: p.codigo, label: `${p.codigo} · ${p.nome}` }))}
        />
      </RebField>

      <RebField label="Observação">
        <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
      </RebField>
      {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
    </RebModal>
  );
}
