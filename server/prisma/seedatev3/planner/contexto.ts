import { readFile } from 'node:fs/promises';
import { Contexto, diretorio, hojeBrasil, schemaManifesto, type Manifesto } from '../contexto.js';

export async function abrirComplementoPlanner(
  base: Manifesto, verificar: boolean, haRegistros: () => Promise<boolean>,
  pasta = `${diretorio}/planner`,
) {
  let manifesto: Manifesto;
  try { manifesto = schemaManifesto.parse(JSON.parse(await readFile(`${pasta}/manifesto.json`, 'utf8'))); }
  catch (e) {
    if (!(e instanceof Error && 'code' in e && e.code === 'ENOENT')) throw e;
    if (verificar) throw new Error('Prepare o complemento do planner antes de verificar.');
    if (await haRegistros()) throw new Error('Há registros PLANNER sem manifesto. Recupere o manifesto; nenhuma carga será reiniciada.');
    manifesto = { ...base, dataBase: hojeBrasil(), ids: { ...base.ids }, etapas: [], acoes: [], criadoEm: new Date().toISOString() };
  }
  if (manifesto.identidade !== base.identidade) throw new Error('Complemento pertence a outra instância do banco.');
  const contexto = new Contexto(manifesto, verificar, undefined, pasta);
  if (!verificar) await contexto.salvar();
  return contexto;
}
