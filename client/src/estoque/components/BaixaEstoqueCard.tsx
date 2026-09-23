import { useEffect, useMemo, useState } from "react";
import { listarSaldos, registrarMovimento, type SaldoDTO } from "../api";
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

function acharProduto(produtos: SaldoDTO[], digitado: string): SaldoDTO | null {
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
  // Só entram na lista os produtos com saldo positivo neste sítio: baixa de produto
  // que nunca teve estoque geraria saldo negativo (o servidor também recusa).
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
    listarSaldos()
      .then((ss) => {
        if (!vivo) return;
        const comSaldo = ss.filter((x) => x.saldo > 0);
        setSaldos(comSaldo);
        const match = acharProduto(comSaldo, produtoDigitado);
        if (match) setProdutoId(match.produtoId);
      })
      .catch((e) => vivo && setErro(e.message))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [produtoDigitado]);

  const saldoSel = useMemo(
    () => saldos.find((s) => s.produtoId === produtoId) ?? null,
    [saldos, produtoId],
  );

  const qtdNum = Number(quantidade);
  const acimaDoSaldo = !!saldoSel && qtdNum > saldoSel.saldo;
  // Sem produto com saldo escolhido (ou nenhum produto com saldo) não há o que baixar.
  const semSaldo = !carregando && !saldoSel && (saldos.length === 0 || (produtoDigitado.trim() !== "" && produtoId == null));

  const podeDarBaixa = !!saldoSel && qtdNum > 0 && !acimaDoSaldo && !salvando;

  async function darBaixa() {
    if (!saldoSel || !podeDarBaixa) return;
    setSalvando(true);
    setErro(null);
    try {
      // O estoque só aceita ajuste manual justificado; a baixa vira ajuste negativo.
      await registrarMovimento({
        produtoId: saldoSel.produtoId,
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
            {saldos.map((p) => (
              <option key={p.produtoId} value={p.produtoId}>
                {p.nome} ({p.categoria ? p.categoria.nome.toLowerCase() : "sem categoria"} · {rotuloUnidade(p.unidade)})
              </option>
            ))}
          </RebSelect>
        </RebField>

        {semSaldo && (
          <p role="alert" className="-mt-1.5 mb-3 text-[13px] text-prejuizo">
            Este produto não tem saldo em estoque nesta fazenda — registre uma compra ou um ajuste em Nova operação.
          </p>
        )}

        {saldoSel && (
          <div className="-mt-1.5 mb-3 flex min-h-[26px] items-center">
            {saldoSel.abaixoMinimo ? (
              <RebPill tone="warn">
                ⚠ Abaixo do mínimo — saldo {fmtQtd(saldoSel.saldo)} {rotuloUnidade(saldoSel.unidade)}
                {saldoSel.minimoEstoque != null ? ` · mín ${fmtQtd(saldoSel.minimoEstoque)}` : ""}
              </RebPill>
            ) : (
              <span className="font-sans text-[13.5px] italic text-ink-3">
                Saldo disponível: {fmtQtd(saldoSel.saldo)} {rotuloUnidade(saldoSel.unidade)}
              </span>
            )}
          </div>
        )}

        <RebField label={<>Quantidade{saldoSel ? ` (${rotuloUnidade(saldoSel.unidade)})` : ""}</>}>
          <input
            type="number"
            min={0}
            max={saldoSel?.saldo}
            step="0.001"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            disabled={!saldoSel}
          />
        </RebField>
        {acimaDoSaldo && saldoSel && (
          <p role="alert" className="-mt-1.5 mb-3 text-[13px] text-prejuizo">
            Quantidade acima do saldo disponível ({fmtQtd(saldoSel.saldo)} {rotuloUnidade(saldoSel.unidade)}).
          </p>
        )}

        <RebField label="Observação">
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </RebField>

        {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
        {sucesso && <p style={{ color: "var(--lucro)", fontSize: 13 }}>Baixa registrada.</p>}
      </>
    </RebModal>
  );
}
