import type {
  CampoFormularioCampoDTO,
  ConfigFormularioCampo,
  FolhaCampoDTO,
  ResultadoRelatorioRebanhoDTO,
  SnapshotLinhaFolhaCampo,
} from "../api";
import { rotuloAnimal } from "./AnimalIdentity";

interface LinhaImpressao {
  snapshot: SnapshotLinhaFolhaCampo;
}

const ROTULOS_SISTEMA: Record<string, string> = {
  animal: "Animal",
  categoria: "Categoria",
  grupo_setor: "Grupo / setor",
  data: "Data",
  reprodutor: "Touro / sêmen",
  protocolo: "Protocolo",
  doadora: "Doadora",
  resultado: "Resultado",
  partoPrevisto: "Parto previsto",
  diasGestacao: "Dias de gestação",
  ultimaTentativa: "Última tentativa",
  previsaoSecagem: "Previsão de secagem",
  tipoParto: "Tipo",
  auxilio: "Auxílio",
  crias: "Crias",
  vivas: "Vivas",
  natimortas: "Natimortas",
  sexo: "Sexo",
  motivo: "Motivo",
  observacao: "Observação registrada",
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, texto?: string, className?: string): HTMLElementTagNameMap[K] {
  const elemento = document.createElement(tag);
  if (texto != null) elemento.textContent = texto;
  if (className) elemento.className = className;
  return elemento;
}

function valorSistema(snapshot: SnapshotLinhaFolhaCampo, chave: string): string {
  if (chave === "animal") return rotuloAnimal(snapshot.numero, snapshot.nome);
  if (chave === "categoria") return snapshot.categoria;
  if (chave === "grupo_setor") return [snapshot.grupo, snapshot.setor].filter(Boolean).join(" · ") || "—";
  if (chave === "data") return snapshot.data ?? "—";
  const valor = snapshot.valores[chave];
  return valor == null || valor === "" ? "—" : String(valor);
}

function conteudoCampo(campo: CampoFormularioCampoDTO): HTMLElement {
  const container = el("div", undefined, `formulario-campo-resposta formulario-campo-${campo.tipoUi}`);
  if (campo.tipoUi === "opcoes") {
    (campo.opcoes ?? []).forEach((opcao) => container.append(el("span", `☐ ${opcao.rotulo}`, "formulario-campo-opcao")));
  } else if (campo.tipoUi === "data") {
    container.textContent = "____/____/______";
  } else if (campo.tipoUi === "numero") {
    container.textContent = "________";
  } else {
    container.append(el("span", undefined, "formulario-campo-linha"));
  }
  return container;
}

function montarDocumento(
  nome: string,
  config: ConfigFormularioCampo,
  linhas: LinhaImpressao[],
  campos: CampoFormularioCampoDTO[],
): HTMLElement {
  const documento = el("div", undefined, "relatorio-export-pdf formulario-campo-pdf");
  const header = el("header", undefined, "relatorio-pdf-cabecalho");
  header.append(
    el("p", "Rebanho · Formulário de campo", "relatorio-pdf-eyebrow"),
    el("h1", nome),
    el("p", `${linhas.length} ${linhas.length === 1 ? "animal" : "animais"} · Preencha no campo e lance os resultados na plataforma.`, "relatorio-pdf-resumo"),
  );
  documento.append(header);

  const ativos = campos.filter((campo) => config.camposPapel.includes(campo.chave));
  const tabela = el("table", undefined, "relatorio-export-table formulario-campo-table");
  const thead = el("thead");
  const trh = el("tr");
  config.colunasSistema.forEach((chave) => trh.append(el("th", ROTULOS_SISTEMA[chave] ?? chave)));
  thead.append(trh);
  tabela.append(thead);

  const tbody = el("tbody");
  linhas.forEach(({ snapshot }) => {
    const tr = el("tr");
    config.colunasSistema.forEach((chave) => tr.append(el("td", valorSistema(snapshot, chave), chave === "animal" ? "relatorio-pdf-animal" : undefined)));
    tbody.append(tr);
    const trCampos = el("tr", undefined, "formulario-campo-linha-respostas");
    const tdCampos = el("td", undefined, "formulario-campo-preenchivel");
    tdCampos.colSpan = Math.max(1, config.colunasSistema.length);
    const grade = el("div", undefined, "formulario-campo-campos-grid");
    ativos.forEach((campo) => {
      const bloco = el("div", undefined, "formulario-campo-bloco");
      bloco.append(el("strong", campo.rotulo, "formulario-campo-rotulo"), conteudoCampo(campo));
      grade.append(bloco);
    });
    tdCampos.append(grade);
    trCampos.append(tdCampos);
    tbody.append(trCampos);
  });
  tabela.append(tbody);
  documento.append(tabela);
  return documento;
}

export function montarFormularioCampoParaPdf(folha: FolhaCampoDTO, campos: CampoFormularioCampoDTO[]): HTMLElement {
  return montarDocumento(folha.nome, folha.config, folha.linhas, campos);
}

export function montarPreviaFormularioCampo({
  nome,
  config,
  relatorio,
  campos,
}: {
  nome: string;
  config: ConfigFormularioCampo;
  relatorio: ResultadoRelatorioRebanhoDTO;
  campos: CampoFormularioCampoDTO[];
}): HTMLElement {
  const linhas = relatorio.linhas.slice(0, 4).map((linha) => ({
    snapshot: {
      numero: linha.numero,
      nome: linha.nome,
      categoria: linha.categoria,
      grupo: linha.grupo,
      setor: linha.setor,
      data: linha.data,
      valores: Object.fromEntries(relatorio.colunas.map((coluna, indice) => [coluna.chave, linha.celulas[indice] ?? null])),
    },
  }));
  return montarDocumento(nome, config, linhas, campos);
}

async function salvarPdf(documento: HTMLElement, filename: string) {
  const mod = await import("html2pdf.js");
  // A biblioteca não publica tipagem completa do builder encadeado.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html2pdf = (mod as any).default ?? (mod as any);
  await html2pdf().set({
    margin: [9, 8, 9, 8],
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#FFFFFF" },
    jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    pagebreak: { mode: ["css", "legacy"], avoid: ["tr"] },
  }).from(documento).save();
}

export async function exportarFormularioCampoPdf(folha: FolhaCampoDTO, campos: CampoFormularioCampoDTO[]) {
  const slug = folha.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  await salvarPdf(montarFormularioCampoParaPdf(folha, campos), `rebanho-formulario-${slug || folha.id}.pdf`);
}
