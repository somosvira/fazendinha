import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),pasta=resolve(root,'output/qa-pr322');
const ler=async nome=>JSON.parse(await readFile(resolve(pasta,nome),'utf8'));
const rel=await ler('resultados.json'),ui=await ler('navegador-retomada.json'),vitest=await ler('final-client.json'),f=await ler('fixtures.json');
const resultados=new Map(rel.resultados.map(r=>[r.id,r]));
function registrar(r){const anterior=resultados.get(r.id);resultados.set(r.id,{...r,...(anterior?{evidenciaAnterior:anterior}:{})});}
for(const r of ui){if(r.status!=='passed')throw Error('Browser pendente: '+r.id);registrar(r);}
const casos=[
 ['FU-VAL-19',['estoque/ValorizacaoProduto.test.tsx'],'ProdutoA/sítio2 com resposta adiada; montagemB/sítio3 conserva grupoB depois de liberarA. Não chama abertura.'],
 ['FU-CUS-16',['pecuaria/rebanho/custos/CustosDiretos.componentizacao.test.tsx','pecuaria/rebanho/custos/CustosDiretos.test.tsx'],'Refresh do recorte preserva classificação, parcela10,25, motivo e chave; perfil sem acesso monetário não ganha editor.'],
 ['FU-CUS-17',['pecuaria/rebanho/custos/CustosDiretos.componentizacao.test.tsx','pecuaria/rebanho/custos/CustosDiretos.test.tsx'],'Respostas antigas de GET, preparatórios e gravação pendente ignoradas após trocar alvo/sítio; novo editor não herda erro, bloqueio ou motivo.'],
 ['FU-ACO-22',['pecuaria/rebanho/reproducao/ConfiguracaoAcompanhamento.test.tsx','pecuaria/rebanho/reproducao/AcompanhamentoUI.independente.test.tsx'],'Retry de política conserva chave/payload; mudança de parâmetros gera chave nova. Leituras e escritas atrasadas do sítio anterior não contaminam o novo.'],
 ['FU-BIB-03',['pecuaria/rebanho/reproducao/Iatf.escopo.test.tsx'],'Montagem completa Iatf com propriedadeId7/ativo99 envia cópia ao sítio7. Contraprovas corrigiram custos, execução e regularização no escopo explícito, inclusive ativoConsolidado.'],
 ['FU-BIB-08',['pecuaria/rebanho/reproducao/AcompanhamentoUI.independente.test.tsx'],'Complementa perfil consulta já exercitado no navegador: cópia pendente não aplica sucesso/erro nem mantém bloqueio no outro sítio; sem lançar não há cópia/editor.'],
 ['FU-UX-05',['pecuaria/rebanho/custos/CustosDiretos.componentizacao.test.tsx'],'Mesmo alvo conserva rascunho durante refresh e ao retirar/reconceder lançar; outro alvo reinicia. Gravação antiga não apaga novo motivo nem injeta erro.'],
];
for(const [id,arquivos,detalhe] of casos){let testes=0;for(const arquivo of arquivos){const v=vitest.testResults.find(r=>r.name.endsWith('/src/'+arquivo));if(!v||!v.assertionResults.length||v.assertionResults.some(a=>a.status!=='passed'))throw Error('Contraprova não aprovada: '+arquivo);testes+=v.assertionResults.length;}
 registrar({id,status:'passed',modo:'Componentes React · API simulada (Vitest)',detalhe:detalhe+' Arquivos: '+arquivos.join(', ')+'. '+testes+' testes aprovados nesses arquivos; chamadas de domínio reais permanecem nas demais evidências.',data:new Date(vitest.startTime).toISOString()});
}
registrar({id:'FU-UX-08',status:'blocked',modo:'Aceite humano obrigatório',detalhe:'Aprovação clínica/operacional e vocabulário dependem do responsável da fazenda. A automação não pode representá-lo nem marcar aceite manual.',data:new Date().toISOString()});
const legado=resultados.get('FU-PER-08');resultados.set(legado.id,{...legado,detalhe:'Banco atual: zero abortos com observação null/vazia. Os 11 testes do serviço de correção de legado passaram, incluindo repetição do tipo e correção independente sem inventar observação. ContraprovaSQL permanece bloqueada por ausência do legado; nenhuma trigger/constraint foi desativada.'});
rel.resultados=[...resultados.values()];
const contagem=Object.fromEntries(['passed','partial','failed','blocked'].map(s=>[s,rel.resultados.filter(r=>r.status===s).length]));
if(rel.resultados.length!==164||contagem.passed!==161||contagem.partial||contagem.failed||contagem.blocked!==3)throw Error('Cobertura ainda incompleta: '+JSON.stringify(contagem));
rel.data=new Date().toISOString();rel.ferramenta='Playwright MCP + HTTP/PostgreSQL reais + Vitest React identificado por caso';
rel.ambiente='Local: UI localhost:41875; API localhost:41873; Node 22.22.2; base 18fa8349 com correções locais posteriores';
rel.banco='fazendinha_seedatev3 · PostgreSQL 15.12 Homebrew nativo:5432 · mesmo banco existente, sem outro banco/backup/reset/seed';
rel.fixtures={original:f.execucao,retomada:f.retoma.execucao,sitios:[f.sitioA,f.sitioB,f.retoma.sitio,f.retoma.destino].map(s=>({id:s.id,nome:s.nome})),dataBase:f.dataBase,registroIds:'output/qa-pr322/fixtures.json',visitaVolume:f.retoma.dados.visitaVolume.id,atividadeVolume:f.retoma.dados.atividadeVolume.id,observacao:'Sítio 39 com outubro/2026 fechado; caixa e consumos QA próprios preservados.'};
rel.correcoes=[
 'IATF respeita propriedadeId explícito nos custos da programação/participação e nos headers/corpos de execução e regularização. Contraprovas reproduziram ativo diferente e Consolidado antes da correção.',
 'Biblioteca e políticas distinguem carregamento, consulta vazia e erro; falha de demandas não mostra simultaneamente nenhuma demanda registrada. Validado por React e navegador com GET lento/503.',
 'Roteiro COM-10 corrigido para o contrato implementado: pagamento parcial90 de300 conserva dívida210 e custo do estoque. Não existe campo de abatimento nessa API.',
];
rel.pendencias=[
 'Fechamento:161 aprovados, 0 parciais, 0 falhas, 3 bloqueados; todos os 164 têm registro. Dos 70 antes sem execução, 69 receberam validação técnica e 1 exige aceite humano. As 23 coberturas parciais foram complementadas.',
 'FU-IND-20: arquivos/R2 continuam pendentes por decisão do usuário. Snapshot local de impressão não comprova armazenamento ou reimpressão de arquivo no R2.',
 'FU-PER-08: sem aborto legado null/vazio neste banco. Serviço coberto por 11 testes; não fabricar legado desativando trigger/constraint.',
 'FU-UX-08: aceite explícito do responsável da fazenda permanece humano. Nenhuma aprovação manual foi criada pela automação.',
 'Dados originais identificados no manifesto conservaram contagens/hashes; saldo e UUIDs das fixtures ficam no registro local. Sem novo banco, clone, backup, reset ou recarga.',
 'Validação local em 18fa8349 + correções no diretório de trabalho. Não representa CI remota ou código já publicado no PR.',
 'Cliente: passagem completa 1299/1300, com 1 timeout de 5 s em FormOperacao sob concorrência; reteste isolado registrado separadamente. Servidor: 1597 aprovados / 256 ignorados; integrações exclusivas de CI não foram habilitadas. Typechecks e build cliente aprovados.',
];
try{const reteste=await ler('reteste-form-pendentes.json');if(reteste.numPassedTests!==5||reteste.numFailedTests)throw Error('Reteste dos 5 casos ainda não aprovado');rel.pendencias[6]='Validação geral: cliente completo: 1299 aprovados e 1 timeout de 5 s. Reteste do arquivo FormOperacao: 78 aprovados e 5 falhas no limite curto (incluindo efeito em teste subsequente); esses 5 passaram com as mesmas asserções e limite de 30 s somente na chamada CLI. Limites do repositório preservados. Servidor: 1597 aprovados / 256 ignorados, sem habilitar integrações exclusivas de CI. Typechecks e build cliente aprovados.';rel.verificacao={cliente:{total:vitest.numTotalTests,aprovados:vitest.numPassedTests,falhas:vitest.numFailedTests,retomadaCasos:reteste.numPassedTests,limiteRetomadaMs:30000},servidor:{aprovados:1597,ignorados:256},typecheckCliente:'passed',typecheckServidor:'passed',buildCliente:'passed',htmlOffline:'passed'};}catch(e){if(e.code!=='ENOENT')throw e;}
for(const [titulo,path] of [['Retomada · visita individual e rascunho','output/qa-pr322/visita-retomada.png'],['Retomada · revisão comercial sem confirmação','output/qa-pr322/revisao-comercial-retomada.png'],['Retomada · lista em390px','output/qa-pr322/retomada-mobile.png']])if(!(rel.capturas??=[]).some(c=>c.path===path))rel.capturas.push({titulo,path});
await writeFile(resolve(pasta,'resultados.json'),JSON.stringify(rel,null,2)+'\n');console.log(JSON.stringify(contagem));
