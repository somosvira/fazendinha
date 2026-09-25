// Configurações > Sítios — cadastro das propriedades (sítios) da fazenda.
// Mora nas configurações gerais porque é estrutura da fazenda, compartilhada por
// todos os módulos, e raramente muda. Mesmo padrão visual dos cadastros do
// Financeiro/Rebanho: tabela + AcoesLinha + ConfirmDialog para desativar +
// PainelCadastro (FormSitio) para criar e editar. Nada é apagado: desativar
// esconde o sítio do seletor e de novos cadastros.

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Loader } from "@/components/Loading";
import { editarPropriedade, usePropriedades, type PropriedadeDTO } from "../../api/propriedades";
import { AcoesLinha, Button, type ColunaTabela, ErrorBox, PageHeader, PaginaFinanceira, Panel, Pill, TabelaFinanceira } from "../../financeiro/financeiro-ui";
import { FormSitio } from "./FormSitio";

type Painel = { modo: "novo" } | { modo: "editar"; id: number } | null;

const colunas = (editar: (s: PropriedadeDTO) => void, alternar: (s: PropriedadeDTO) => void): ColunaTabela<PropriedadeDTO>[] => [
  { chave: "sitio", titulo: "Sítio", larguraMinima: 200, principal: true, celula: (s) => <strong className="break-words">{s.nome}</strong> },
  { chave: "apelido", titulo: "Apelido", larguraMinima: 140, celula: (s) => <span className="break-words">{s.apelido || "—"}</span> },
  { chave: "local", titulo: "Cidade", larguraMinima: 160, celula: (s) => <span className="break-words">{[s.cidade, s.uf].filter(Boolean).join(" — ") || "—"}</span> },
  { chave: "principal", titulo: "Principal", alinhamento: "centro", larguraMinima: 100, celula: (s) => s.principal ? <Pill tone="blue">Principal</Pill> : "—" },
  { chave: "situacao", titulo: "Situação", alinhamento: "direita", larguraMinima: 100, celula: (s) => <Pill tone={s.ativo ? "green" : "neutral"}>{s.ativo ? "Ativo" : "Inativo"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 110, acoes: true, celula: (s) => <AcoesLinha nome={s.nome} ativo={s.ativo} onEditar={() => editar(s)} onAlternar={() => alternar(s)} /> },
];

export function Sitios() {
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const sitios = usePropriedades({ incluirInativos: mostrarInativos });
  const [painel, setPainel] = useState<Painel>(null);
  const [confirmando, setConfirmando] = useState<PropriedadeDTO | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const emCurso = useRef(false);

  // criar/editar avisam usePropriedades, que recarrega esta lista e o seletor da sidebar
  const executar = async (acao: () => Promise<unknown>) => {
    if (emCurso.current) return;
    emCurso.current = true; setProcessando(true); setErro(null);
    try { await acao(); }
    catch (e) { setConfirmando(null); setErro(e instanceof Error ? e.message : String(e)); }
    finally { emCurso.current = false; setProcessando(false); }
  };

  const abrirNovo = () => { if (!emCurso.current) setPainel({ modo: "novo" }); };
  const editar = (s: PropriedadeDTO) => { if (!emCurso.current) setPainel({ modo: "editar", id: s.id }); };
  const alternar = (s: PropriedadeDTO) => {
    if (emCurso.current) return;
    if (s.ativo) { setConfirmando(s); return; }
    void executar(() => editarPropriedade(s.id, { nome: s.nome, ativo: true }));
  };
  const confirmarDesativacao = () => {
    if (!confirmando) return;
    void executar(async () => { await editarPropriedade(confirmando.id, { nome: confirmando.nome, ativo: false }); setConfirmando(null); });
  };
  const aoSalvar = () => setPainel(null);

  const selecionado = painel?.modo === "editar" ? sitios.data.find((s) => s.id === painel.id) ?? null : null;
  /* key força remount do formulário a cada abertura, zerando o estado local */
  const chavePainel = painel ? (painel.modo === "editar" ? `editar-${painel.id}` : "novo") : "fechado";
  const carregando = sitios.loading && sitios.data.length === 0;

  return <PaginaFinanceira>
    <PageHeader eyebrow="Configurações" titulo="Sítios" descricao="As propriedades da fazenda. Cada animal, lote e lançamento pertence a um sítio."
      acao={<Button onClick={abrirNovo}><Plus size={16} /> Novo sítio</Button>} />
    <ErrorBox erro={erro} />

    <fieldset disabled={processando} aria-busy={processando} className="min-w-0">
      {carregando
        ? <div className="mt-5"><Loader label="Carregando sítios" /></div>
        : <Panel className="mt-5 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />Mostrar inativos</label>
          </div>
          <TabelaFinanceira rotulo="Sítios" itens={sitios.data} colunas={colunas(editar, alternar)} chaveDe={(s) => s.id} onAbrir={editar} classeLinha={(s) => !s.ativo ? "opacity-55" : ""} />
        </Panel>}
    </fieldset>

    {painel && <FormSitio key={chavePainel} sitio={selecionado} onSalvo={aoSalvar} onFechar={() => setPainel(null)} />}

    <ConfirmDialog
      open={confirmando !== null}
      title={confirmando ? `Desativar ${confirmando.nome}?` : ""}
      message="O sítio deixa de aparecer no seletor e em novos cadastros. Lotes, animais e outros registros já vinculados continuam intactos."
      confirmLabel="Desativar"
      cancelLabel="Manter ativo"
      tone="danger"
      processando={processando}
      onConfirm={confirmarDesativacao}
      onCancel={() => setConfirmando(null)}
    />
  </PaginaFinanceira>;
}
