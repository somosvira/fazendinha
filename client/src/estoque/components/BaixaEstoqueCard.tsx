import { useEffect, useMemo, useState } from "react";
import { listarSaldos, registrarMovimento, listarProdutos, type SaldoDTO, type ProdutoDTO } from "../api";
import { rotuloUnidade } from "../../lib/unidades";
import type { Animal } from "../../rebanho/types";
import { AnimalIdentity, mencaoAnimal } from "../../rebanho/components/AnimalIdentity";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";
import { RebSelect } from "@/components/rb/RebSelect";
import { RebPill } from "@/components/rb/RebPrimitives";

interface Props {
  animalId: string;
  animal?: Pick<Animal, "numero" | "nome">;
  produtoDigitado: string;
  dose?: string;
  loteProduto?: string;
  data: string;
  tipo: "APLICACAO" | "VACINA";
  onFechar: () => void;
  onBaixaFeita: () => void;
}

const rotuloTipo = (t: Props["tipo"]) => (t === "VACINA" ? "Vacina" : "Aplicação");

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function acharProduto(produtos: ProdutoDTO[], digitado: string): ProdutoDTO | null {
  const n = norm(digitado);
  if (!n) return null;
  return (
    produtos.find((p) => norm(p.nome) === n) ??
    (n.length >= 3 ? produtos.find((p) => norm(p.nome).includes(n)) ?? null : null)
  );
}

function fmtQtd(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, "");
}

function fmtDataBR(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export function BaixaEstoqueCard({
  animalId,
  animal,
  produtoDigitado,
  dose,
  loteProduto,
  data,
  tipo,
  onFechar,
  onBaixaFeita,
}: Props) {
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [saldos, setSaldos] = useState<SaldoDTO[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [produtoId, setProdutoId] = useState<number | null>(null);
  const [quantidade, setQuantidade] = useState<string>("1");
  const [observacao, setObservacao] = useState<string>(() => {
    const partes = [
      `${rotuloTipo(tipo)}${animal ? ` em ${mencaoAnimal(animal.numero, animal.nome)}` : ""}`,
      dose ? `dose: ${dose}` : null,
      loteProduto ? `lote ${loteProduto}` : null,
    ].filter(Boolean);
    return partes.join(" · ");
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([listarProdutos({ ativo: true }), listarSaldos()])
      .then(([ps, ss]) => {
        if (!vivo) return;
        setProdutos(ps);
        setSaldos(ss);
        const match = acharProduto(ps, produtoDigitado);
        if (match) setProdutoId(match.id);
      })
      .catch((e) => vivo && setErro(e.message))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [produtoDigitado]);

  const produtoSel = useMemo(
    () => produtos.find((p) => p.id === produtoId) ?? null,
    [produtos, produtoId],
  );
  const saldoSel = useMemo(
    () => saldos.find((s) => s.produtoId === produtoId) ?? null,
    [saldos, produtoId],
  );

  const podeDarBaixa =
    !!produtoSel && Number(quantidade) > 0 && !salvando;

  async function darBaixa() {
    if (!produtoSel) return;
    setSalvando(true);
    setErro(null);
    try {
      // O estoque só aceita ajuste manual justificado; a baixa vira ajuste negativo.
      await registrarMovimento({
        produtoId: produtoSel.id,
        tipo: "AJUSTE",
        data,
        quantidade: -Number(quantidade),
        observacao: `Baixa manual${observacao ? `: ${observacao}` : ""}`,
      });
      setSucesso(true);
      setTimeout(() => {
        onBaixaFeita();
        onFechar();
      }, 700);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <RebModal
      title={`Atividade registrada · ${rotuloTipo(tipo)}`}
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar} disabled={salvando}>
            Fechar sem baixar
          </RebButton>
          <RebButton variant="pri" onClick={darBaixa} disabled={!podeDarBaixa}>
            {salvando ? "Baixando…" : "Dar baixa no estoque"}
          </RebButton>
        </>
      }
    >
      <>
        <dl className="mb-4 grid grid-cols-1 gap-1.5 rounded-[10px] border border-[color:var(--rule-soft)] bg-card px-3.5 py-3 font-sans text-sm [&>div]:grid [&>div]:grid-cols-[88px_1fr] [&>div]:items-baseline [&>div]:gap-3 [&_dt]:m-0 [&_dt]:font-serif [&_dt]:italic [&_dt]:text-ink-3 [&_dd]:m-0 [&_dd]:text-foreground">
          <div><dt>Data</dt><dd>{fmtDataBR(data)}</dd></div>
          {animal && <div><dt>Animal</dt><dd><AnimalIdentity numero={animal.numero} nome={animal.nome} /></dd></div>}
          <div><dt>Produto</dt><dd>{produtoDigitado || "—"}</dd></div>
          {dose && <div><dt>Dose</dt><dd>{dose}</dd></div>}
          {loteProduto && <div><dt>Lote</dt><dd>{loteProduto}</dd></div>}
        </dl>

        <RebField label="Produto do estoque a abater">
          <RebSelect
            value={produtoId ?? ""}
            onChange={(v) => setProdutoId(v ? Number(v) : null)}
            disabled={carregando}
          >
            <option value="">{carregando ? "Carregando…" : "— selecionar —"}</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({p.categoriaNome ? p.categoriaNome.toLowerCase() : "sem categoria"} · {rotuloUnidade(p.unidade)})
              </option>
            ))}
          </RebSelect>
        </RebField>

        {produtoSel && (
          <div className="-mt-1.5 mb-3 flex min-h-[26px] items-center">
            {!saldoSel || saldoSel.saldo <= 0 ? (
              <RebPill tone="bad">
                Sem estoque{saldoSel ? ` (saldo: ${fmtQtd(saldoSel.saldo)} ${rotuloUnidade(produtoSel.unidade)})` : ""}
              </RebPill>
            ) : saldoSel.abaixoMinimo ? (
              <RebPill tone="warn">
                ⚠ Abaixo do mínimo — saldo {fmtQtd(saldoSel.saldo)} {rotuloUnidade(produtoSel.unidade)}
                {saldoSel.minimoEstoque != null ? ` · mín ${fmtQtd(saldoSel.minimoEstoque)}` : ""}
              </RebPill>
            ) : (
              <span className="font-sans text-[13.5px] italic text-ink-3">
                Saldo atual: {fmtQtd(saldoSel.saldo)} {rotuloUnidade(produtoSel.unidade)}
              </span>
            )}
          </div>
        )}

        <RebField label={<>Quantidade{produtoSel ? ` (${rotuloUnidade(produtoSel.unidade)})` : ""}</>}>
          <input
            type="number"
            min={0}
            step="0.001"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            disabled={!produtoSel}
          />
        </RebField>

        <RebField label="Observação">
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </RebField>

        {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
        {sucesso && <p style={{ color: "var(--lucro)", fontSize: 13 }}>Baixa registrada.</p>}
      </>
    </RebModal>
  );
}
