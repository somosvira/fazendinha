// Cadastro de genitor externo (v2 · Genética) — nome, sexo, código, fornecedor,
// observação e composição racial (reusa CampoComposicao de ../ui.tsx). Composição
// é gravada junto no cadastro (POST) ou via PUT dedicado (edição), igual ao padrão
// de FormComposicao para o animal.

import { FormEvent, useEffect, useRef, useState } from "react";
import { criarGenitor, editarGenitor, substituirComposicaoGenitor, RebanhoApiError } from "../api";
import { listarFornecedores, type Parceiro } from "../../../estoque/api";
import type { CatalogoRaca, ComposicaoItemInput, GenitorDTO, Sexo } from "../types";
import { composicaoValida } from "../lib/composicao";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { CampoComposicao } from "../ui";

type Erros = Record<string, string>;

export function FormGenitor({ genitor, racas, onSalvo, onFechar }: {
  genitor: GenitorDTO | null;
  racas: CatalogoRaca[];
  onSalvo: () => Promise<void> | void;
  onFechar: () => void;
}) {
  const [sexo, setSexo] = useState<Sexo>(genitor?.sexo ?? "F");
  const [nome, setNome] = useState(genitor?.nome ?? "");
  const [codigo, setCodigo] = useState(genitor?.codigo ?? "");
  const [fornecedorId, setFornecedorId] = useState(genitor?.fornecedorId ?? (genitor?.fornecedor ? "legado" : ""));
  const [fornecedores, setFornecedores] = useState<Parceiro[]>([]);
  const [carregandoFornecedores, setCarregandoFornecedores] = useState(true);
  const [erroFornecedores, setErroFornecedores] = useState<string | null>(null);
  const [observacao, setObservacao] = useState(genitor?.observacao ?? "");
  const [composicao, setComposicao] = useState<ComposicaoItemInput[]>(
    (genitor?.composicao ?? []).map((c) => ({ racaId: c.racaId, fracao64: c.fracao64 })),
  );
  // raças já presentes no genitor continuam selecionáveis mesmo se foram desativadas no cadastro
  const opcoesRacas: CatalogoRaca[] = [
    ...racas,
    ...(genitor?.composicao ?? [])
      .filter((c) => !racas.some((r) => r.id === c.racaId))
      .map((c) => ({ id: c.racaId, nome: `${c.nome} (inativa)`, sigla: c.sigla, base: true })),
  ];
  const [erros, setErros] = useState<Erros>({});
  const [erroComposicao, setErroComposicao] = useState<string | undefined>();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);

  useEffect(() => {
    let ativo = true;
    listarFornecedores().then((lista) => { if (ativo) setFornecedores(lista); })
      .catch((erro) => { if (ativo) setErroFornecedores(erro instanceof Error ? erro.message : String(erro)); })
      .finally(() => { if (ativo) setCarregandoFornecedores(false); });
    return () => { ativo = false; };
  }, []);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (emCurso.current) return;
    const novosErros: Erros = {};
    if (nome.trim().length < 1) novosErros.nome = "Informe o nome";
    let erroComp: string | undefined;
    if (composicao.some((item) => !item.racaId)) erroComp = "Selecione a raça em todas as linhas de composição";
    else if (!composicaoValida(composicao)) erroComp = "Confira as frações: cada raça só pode aparecer uma vez e a soma não pode passar de 64.";
    setErros(novosErros); setErroComposicao(erroComp); setErroGeral(null);
    if (Object.keys(novosErros).length || erroComp) return;
    emCurso.current = true; setSalvando(true);
    try {
      const itens = composicao.filter((item) => item.racaId);
      if (!genitor) {
        await criarGenitor({ sexo, nome: nome.trim(), codigo: codigo.trim() || null, fornecedorId: fornecedorId || null, observacao: observacao.trim() || null, composicao: itens });
      } else {
        await editarGenitor(genitor.id, { sexo, nome: nome.trim(), codigo: codigo.trim() || null, ...(fornecedorId === "legado" ? {} : { fornecedorId: fornecedorId || null }), observacao: observacao.trim() || null });
        await substituirComposicaoGenitor(genitor.id, { itens });
      }
      await onSalvo();
    } catch (erro) {
      if (erro instanceof RebanhoApiError && erro.campo) setErros({ [erro.campo]: erro.message });
      else setErroGeral(erro instanceof Error ? erro.message : String(erro));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const formId = "form-genitor";
  return <PainelCadastro aberto titulo={genitor ? `Editar ${genitor.nome}` : "Novo genitor externo"} onFechar={() => { if (!salvando) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando || carregandoFornecedores || !!erroFornecedores}>{salvando ? "Salvando…" : genitor ? "Salvar genitor" : "Criar genitor"}</Button></>}>
    <form id={formId} onSubmit={submeter} className="grid gap-4" noValidate>
      <ErrorBox erro={erroGeral} />
      {erroFornecedores && <ErrorBox erro={`Não foi possível carregar fornecedores: ${erroFornecedores}`} />}
      <div className="grid gap-4 md:grid-cols-2">
        <CampoFormulario id="genitor-nome" rotulo="Nome" obrigatorio erro={erros.nome}>{(p) => <input {...p} required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} className={classeInput} />}</CampoFormulario>
        <CampoFormulario id="genitor-sexo" rotulo="Sexo" obrigatorio erro={erros.sexo} ajuda={genitor && genitor.filhos > 0 ? "Não pode ser alterado — este genitor já tem filhos registrados." : undefined}>{(p) => <select {...p} disabled={!!(genitor && genitor.filhos > 0)} value={sexo} onChange={(e) => setSexo(e.target.value as Sexo)} className={classeInput}><option value="F">Fêmea</option><option value="M">Macho</option></select>}</CampoFormulario>
        <CampoFormulario id="genitor-codigo" rotulo="Código">{(p) => <input {...p} maxLength={60} value={codigo} onChange={(e) => setCodigo(e.target.value)} className={classeInput} />}</CampoFormulario>
        <CampoFormulario id="genitor-fornecedor" rotulo="Fornecedor" erro={erros.fornecedorId} ajuda={carregandoFornecedores ? "Carregando fornecedores…" : undefined}>{(p) => <select {...p} value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} disabled={carregandoFornecedores || !!erroFornecedores} className={classeInput}><option value="">Nenhum fornecedor</option>{fornecedorId === "legado" && <option value="legado">{genitor?.fornecedor} (sem vínculo cadastrado)</option>}{fornecedores.filter((f) => f.ativo || f.id === fornecedorId).map((f) => <option key={f.id} value={f.id}>{f.nome}{f.ativo ? "" : " (inativo)"}</option>)}</select>}</CampoFormulario>
      </div>
      <CampoFormulario id="genitor-observacao" rotulo="Observação">{(p) => <textarea {...p} maxLength={500} value={observacao} onChange={(e) => setObservacao(e.target.value)} className={classeInput} />}</CampoFormulario>
      <div>
        <span className="mb-2 block text-sm font-medium">Composição racial</span>
        <CampoComposicao racas={opcoesRacas} itens={composicao} onChange={setComposicao} erro={erroComposicao} />
      </div>
    </form>
  </PainelCadastro>;
}
