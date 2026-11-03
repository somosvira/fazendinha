#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { prepararManifesto, sha256 } from './modelo.mjs';
import { consultaSnapshot } from './consulta.mjs';

const ajuda = `Prévia Bezerreiro/localização — somente leitura, sem conexão ao banco ou execução de carga.

node server/scripts/bezerreiro-localizacao/previa.mjs \\
  --lotes=/caminho/privado/lotes.json --evidencias-dir=/caminho/privado/evidencias \\
  [--snapshot=/caminho/privado/snapshot.json] [--saida=/caminho/privado/manifesto.json]

--emitir-consulta  Emite uma SELECT para coleta autorizada somente leitura; não a executa.
--saida           Grava arquivo novo local; recusa sobrescrever evidência existente.
Sem --snapshot, emite apenas manifesto bloqueado exigindo revalidação atual.
Sem --saida, imprime no stdout. Não há opções de execução ou credenciais.
Os arquivos privados de entrada/saída não devem entrar no Git.
`;

export async function executar(args = process.argv.slice(2)) {
  const { values: opcoes } = parseArgs({ args, options: {
    lotes: { type: 'string' }, 'evidencias-dir': { type: 'string' }, snapshot: { type: 'string' },
    saida: { type: 'string' }, 'emitir-consulta': { type: 'boolean', default: false }, ajuda: { type: 'boolean', default: false },
  }, strict: true, allowPositionals: false });
  if (opcoes.ajuda) { process.stdout.write(ajuda); return; }
  if (!opcoes.lotes || !opcoes['evidencias-dir']) throw new Error('Informe --lotes e --evidencias-dir; veja --ajuda.');
  const ler = async caminho => {
    const texto = await readFile(resolve(caminho), 'utf8');
    return { conteudo: JSON.parse(texto), sha256: sha256(texto) };
  };
  const configuracao = await ler(opcoes.lotes);
  const dir = resolve(opcoes['evidencias-dir']);
  const anteriores = await ler(resolve(dir, 'animais-stg.json'));
  let saida;
  if (opcoes['emitir-consulta']) {
    if (opcoes.snapshot) throw new Error('--emitir-consulta não utiliza --snapshot.');
    saida = consultaSnapshot(configuracao.conteudo, anteriores.conteudo.map(a => a.id));
  } else {
    const analise = await ler(resolve(dir, 'analise-animais.json'));
    const relatorio = await readFile(resolve(dir, 'RELATORIO.md'), 'utf8');
    const snapshot = opcoes.snapshot ? await ler(opcoes.snapshot) : null;
    const ferramenta = {};
    for (const arquivo of ['previa.mjs', 'modelo.mjs', 'consulta.mjs'])
      ferramenta[arquivo] = sha256(await readFile(new URL(`./${arquivo}`, import.meta.url), 'utf8'));
    const manifesto = prepararManifesto({ configuracao: configuracao.conteudo, analise: analise.conteudo,
      animaisAnteriores: anteriores.conteudo, snapshot: snapshot?.conteudo,
      evidencias: { configuracaoLotes: configuracao.sha256, analiseAnimais: analise.sha256,
        animaisSTG: anteriores.sha256, relatorio: sha256(relatorio), snapshotArquivo: snapshot?.sha256 ?? null, ferramenta } });
    saida = JSON.stringify(manifesto, null, 2) + '\n';
  }
  if (opcoes.saida) await writeFile(resolve(opcoes.saida), saida, { encoding: 'utf8', flag: 'wx' });
  else process.stdout.write(saida);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  executar().catch(erro => { process.stderr.write(`Prévia recusada: ${erro.message}\n`); process.exitCode = 1; });
}
