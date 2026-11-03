import { accessSync, closeSync, constants, fsyncSync, lstatSync, mkdtempSync, openSync, realpathSync, renameSync, rmSync, statSync, writeFileSync, type Stats } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

function inspecionarDestino(origem: string | readonly string[], informado: string): { caminho: string; anterior: Stats | null } {
  const fontes = (typeof origem === "string" ? [origem] : origem).map(arquivo => { const caminho = realpathSync(arquivo); return { caminho, stat: statSync(caminho) }; });
  const solicitado = resolve(informado);
  const pasta = realpathSync(dirname(solicitado));
  if (!statSync(pasta).isDirectory()) throw new Error("A pasta do relatório precisa ser um diretório.");
  accessSync(pasta, constants.W_OK);
  let entrada: Stats | null;
  try { entrada = lstatSync(solicitado); } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code !== "ENOENT") throw erro;
    entrada = null;
  }
  // Resolve também links simbólicos existentes; um link quebrado nunca é tratado como destino novo.
  const caminho = entrada ? realpathSync(solicitado) : join(pasta, basename(solicitado));
  const anterior = entrada ? statSync(caminho) : null;
  if (fontes.some(fonte => caminho === fonte.caminho || anterior && anterior.dev === fonte.stat.dev && anterior.ino === fonte.stat.ino)) throw new Error("O relatório precisa de um caminho diferente dos arquivos de origem.");
  if (anterior && !anterior.isFile()) throw new Error("O relatório precisa apontar para um arquivo regular, não um diretório ou dispositivo.");
  if (anterior) {
    if (!(anterior.mode & 0o222)) throw new Error("O arquivo de relatório está sem permissão de escrita.");
    try { accessSync(caminho, constants.W_OK); } catch { throw new Error("O arquivo de relatório está sem permissão de escrita."); }
    accessSync(dirname(caminho), constants.W_OK);
  }
  return { caminho, anterior };
}

/** Reserva no mesmo filesystem antes de carregar banco; não trunca o artefato anterior. */
export function prepararArquivoRelatorio(origem: string | readonly string[], destino: string): { gravar: (conteudo: string) => void; cancelar: () => void; caminhoRecuperacao: string } {
  const inicial = inspecionarDestino(origem, destino);
  const pastaReserva = mkdtempSync(join(dirname(inicial.caminho), ".import-stg-recibo-"));
  const caminhoRecuperacao = join(pastaReserva, "recibo.json");
  let descritor: number;
  try { descritor = openSync(caminhoRecuperacao, "wx", 0o600); } catch (erro) { rmSync(pastaReserva, { recursive: true, force: true }); throw erro; }
  let fechado = false, finalizado = false, preservar = false;
  const fechar = () => { if (!fechado) { closeSync(descritor); fechado = true; } };
  return {
    caminhoRecuperacao,
    cancelar() {
      if (finalizado || preservar) return;
      fechar(); rmSync(pastaReserva, { recursive: true, force: true }); finalizado = true;
    },
    gravar(conteudo) {
      if (finalizado || preservar) throw new Error("A reserva deste relatório já foi encerrada.");
      let completo = false;
      try {
        writeFileSync(descritor, conteudo, "utf8"); fsyncSync(descritor); completo = true; fechar();
        const atual = inspecionarDestino(origem, destino);
        const a = inicial.anterior, b = atual.anterior;
        if (atual.caminho !== inicial.caminho || !!a !== !!b || a && b && (a.dev !== b.dev || a.ino !== b.ino || a.size !== b.size || a.mtimeMs !== b.mtimeMs)) throw new Error("O destino do relatório mudou enquanto a carga era processada.");
        renameSync(caminhoRecuperacao, inicial.caminho);
        finalizado = true;
      } catch (erro) {
        preservar = true; fechar();
        const detalhe = erro instanceof Error ? erro.message : String(erro);
        throw new Error(`${completo ? "Recibo completo preservado para recuperação" : "Falha na escrita; arquivo de recuperação pode estar incompleto"}: ${caminhoRecuperacao}. ${detalhe}`);
      }
      // Uma falha de limpeza após publicar não transforma o recibo salvo em perda de escrita.
      try { rmSync(pastaReserva, { recursive: true, force: true }); } catch { /* Diretório privado vazio pode ser removido posteriormente. */ }
    },
  };
}
