import { useState } from "react";
import { RebModal } from "../../../components/rb/RebModal";
import { RebField } from "../../../components/rb/RebField";
import { RebButton } from "../../../components/rb/RebButton";
import { RebSelect } from "../../../components/rb/RebSelect";
import { PRESETS_FRACAO, composicaoValida, somaFracoes } from "../lib/composicao";
import type { CadastrarAnimalInput, Catalogos, ComposicaoItemInput } from "../types";

export function FormCadastroAnimal({
  catalogos,
  onClose,
  onSalvar,
  salvando,
}: {
  catalogos: Catalogos;
  onClose: () => void;
  onSalvar: (input: CadastrarAnimalInput) => void;
  salvando: boolean;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [brinco, setBrinco] = useState("");
  const [nome, setNome] = useState("");
  const [sexo, setSexo] = useState<"F" | "M">("F");
  const [dataNascimento, setDataNascimento] = useState(hoje);
  const [origem, setOrigem] = useState<"NASCIDO" | "COMPRADO">("NASCIDO");
  const [dataEntrada, setDataEntrada] = useState(hoje);
  const [propriedadeId, setPropriedadeId] = useState<string>(String(catalogos.propriedades[0]?.id ?? ""));
  const [loteId, setLoteId] = useState<string>("");
  const [aptidao, setAptidao] = useState<"LEITE" | "CORTE">("LEITE");
  const [papelReprodutivo, setPapelReprodutivo] = useState<"NENHUM" | "RECEPTORA" | "DOADORA">("NENHUM");
  const [pesoEntradaKg, setPesoEntradaKg] = useState("");
  const [observacao, setObservacao] = useState("");
  const [composicao, setComposicao] = useState<ComposicaoItemInput[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  function adicionarComposicao() {
    setComposicao((c) => [...c, { racaId: catalogos.racas[0]?.id ?? "", fracao64: 32 }]);
  }
  function atualizarComposicao(indice: number, patch: Partial<ComposicaoItemInput>) {
    setComposicao((c) => c.map((item, i) => (i === indice ? { ...item, ...patch } : item)));
  }
  function removerComposicao(indice: number) {
    setComposicao((c) => c.filter((_, i) => i !== indice));
  }

  function validar(): string | null {
    if (!brinco.trim()) return "Informe o brinco.";
    if (!dataNascimento) return "Informe a data de nascimento.";
    if (!dataEntrada) return "Informe a data de entrada.";
    if (dataEntrada < dataNascimento) return "A data de entrada não pode ser anterior ao nascimento.";
    if (!propriedadeId) return "Selecione o sítio.";
    if (!composicaoValida(composicao)) return "A soma das frações da composição racial não pode passar de 64 avos, nem repetir raça.";
    return null;
  }

  function submeter() {
    const mensagem = validar();
    if (mensagem) {
      setErro(mensagem);
      return;
    }
    setErro(null);
    onSalvar({
      brinco: brinco.trim(),
      nome: nome.trim() || null,
      sexo,
      dataNascimento,
      origem,
      dataEntrada,
      propriedadeId: Number(propriedadeId),
      loteId: loteId || null,
      aptidao,
      papelReprodutivo,
      composicao,
      pesoEntradaKg: pesoEntradaKg ? Number(pesoEntradaKg) : null,
      observacao: observacao.trim() || null,
    });
  }

  return (
    <RebModal
      title="Cadastrar animal"
      onClose={onClose}
      actions={
        <>
          <RebButton onClick={onClose} disabled={salvando}>Cancelar</RebButton>
          <RebButton variant="pri" onClick={submeter} disabled={salvando}>{salvando ? "Salvando…" : "Cadastrar"}</RebButton>
        </>
      }
    >
      {erro && <p className="mb-3 text-sm font-medium text-prejuizo">{erro}</p>}
      <div className="grid grid-cols-2 gap-3">
        <RebField label="Brinco *">
          <input value={brinco} onChange={(e) => setBrinco(e.target.value)} placeholder="Ex.: 1234" />
        </RebField>
        <RebField label="Nome">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Opcional" />
        </RebField>
        <RebField label="Sexo">
          <RebSelect value={sexo} onChange={(v) => setSexo(v as "F" | "M")}>
            <option value="F">Fêmea</option>
            <option value="M">Macho</option>
          </RebSelect>
        </RebField>
        <RebField label="Origem">
          <RebSelect value={origem} onChange={(v) => setOrigem(v as "NASCIDO" | "COMPRADO")}>
            <option value="NASCIDO">Nascido na fazenda</option>
            <option value="COMPRADO">Comprado</option>
          </RebSelect>
        </RebField>
        <RebField label="Data de nascimento *">
          <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
        </RebField>
        <RebField label="Data de entrada *">
          <input type="date" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} />
        </RebField>
        <RebField label="Sítio *">
          <RebSelect value={propriedadeId} onChange={setPropriedadeId}>
            {catalogos.propriedades.map((p) => (
              <option key={p.id} value={String(p.id)}>{p.apelido ?? p.nome}</option>
            ))}
          </RebSelect>
        </RebField>
        <RebField label="Lote">
          <RebSelect value={loteId} onChange={setLoteId} placeholder="Sem lote">
            <option value="">Sem lote</option>
          </RebSelect>
        </RebField>
        <RebField label="Aptidão">
          <RebSelect value={aptidao} onChange={(v) => setAptidao(v as "LEITE" | "CORTE")}>
            <option value="LEITE">Leite</option>
            <option value="CORTE">Corte</option>
          </RebSelect>
        </RebField>
        <RebField label="Papel reprodutivo">
          <RebSelect value={papelReprodutivo} onChange={(v) => setPapelReprodutivo(v as "NENHUM" | "RECEPTORA" | "DOADORA")}>
            <option value="NENHUM">Nenhum</option>
            <option value="RECEPTORA">Receptora</option>
            <option value="DOADORA">Doadora</option>
          </RebSelect>
        </RebField>
        <RebField label="Peso de entrada (kg)">
          <input type="number" step="0.01" value={pesoEntradaKg} onChange={(e) => setPesoEntradaKg(e.target.value)} placeholder="Opcional" />
        </RebField>
      </div>

      <RebField label="Observação">
        <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
      </RebField>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-serif text-sm font-medium italic text-ink-3">Composição racial (em 64 avos, soma ≤ 64)</span>
          <RebButton onClick={adicionarComposicao}>Adicionar raça</RebButton>
        </div>
        {composicao.map((item, indice) => (
          <div key={indice} className="mb-2 flex items-end gap-2">
            <RebSelect value={item.racaId} onChange={(v) => atualizarComposicao(indice, { racaId: v })}>
              {catalogos.racas.map((r) => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </RebSelect>
            <RebSelect
              value={String(item.fracao64)}
              onChange={(v) => atualizarComposicao(indice, { fracao64: Number(v) })}
            >
              {PRESETS_FRACAO.map((p) => (
                <option key={p.fracao64} value={String(p.fracao64)}>{p.label}</option>
              ))}
              <option value={String(item.fracao64)}>Personalizada ({item.fracao64}/64)</option>
            </RebSelect>
            <RebButton variant="danger" onClick={() => removerComposicao(indice)}>Remover</RebButton>
          </div>
        ))}
        {composicao.length > 0 && (
          <p className="text-sm text-ink-2">Soma atual: {somaFracoes(composicao)}/64</p>
        )}
      </div>
    </RebModal>
  );
}
