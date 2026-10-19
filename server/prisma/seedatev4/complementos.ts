import { prisma } from '../../src/db.js';
import { criarParto } from '../../src/services/pecuaria/reproducao/registros.js';
import { partoSchema } from '../../src/services/pecuaria/reproducao/schemas.js';
import type { Contexto } from '../seedatev3/contexto.js';
import { AVISO } from './catalogo.js';
import { animal, id, key, ref, sitio, uid } from './base.js';
import { rebanho } from './rebanho.js';
import { gestacao } from './reproducao.js';

/** Dois partos factuais: saldo anterior sem data não pode fabricar IEP. */
export async function complementos(c: Contexto) {
  await rebanho(c, [65]);
  await c.registro(ref('parto:65:anterior'), i => prisma.partoAnimal.findFirst({ where: i ? { id: i } : { animalId: animal(c, 65), data: new Date(c.dias(-430)) } }), () => criarParto(partoSchema.parse({
    chave: key('parto:65:anterior'), animalId: animal(c, 65), propriedadeId: sitio(c), data: c.dias(-430), desfecho: 'NASCIMENTO', iniciarLactacao: false,
    observacao: 'Parto histórico demonstrativo com natimorto, sem gestação de origem comprovada.', retencaoPlacenta: null,
    crias: [{ viva: false, sexo: 'M', aptidao: 'LEITE', pesoKg: 32 }],
  }), uid(c)));
  await gestacao(c, 65, -300);
  await c.registro(ref('parto:65:atual'), i => prisma.partoAnimal.findFirst({ where: i ? { id: i } : { animalId: animal(c, 65), data: new Date(c.dias(-20)) } }), () => criarParto(partoSchema.parse({
    chave: key('parto:65:atual'), animalId: animal(c, 65), propriedadeId: sitio(c), data: c.dias(-20), gestacaoId: id(c, 'gestacao:65'), desfecho: 'NASCIMENTO', iniciarLactacao: true,
    observacao: AVISO, retencaoPlacenta: false, crias: [{ viva: true, sexo: 'F', aptidao: 'LEITE', brinco: 'V4-CR-65-1', loteId: id(c, 'lote:Cria'), pesoKg: 35 }],
  }), uid(c)));
}
