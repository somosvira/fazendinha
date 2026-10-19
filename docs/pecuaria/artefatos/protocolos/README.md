# Base documental de protocolos

[Entrada navegável](index.html) · [Plano de implementação](../../plano-protocolos-unificados.md) · [Contrato vigente](../../protocolos-exames.md)

Materiais de apoio incorporados ao repositório em 19/10/2026, a partir da explicação de domínio, da inspeção SQL local em somente leitura e do mockup revisado com o usuário. O plano consolidado é a fonte da proposta; os contratos operacionais continuam sendo a fonte do comportamento entregue.

| Material | Fonte e alcance |
|---|---|
| [Relações e diagramas interativos](relacoes.html) | Explicação de modelo, versões, participação, tarefas e fatos; exemplos fictícios, sem acesso à aplicação. |
| [Diagrama físico](db/index.html) | Seis tabelas centrais com todas as colunas e catálogo de 12 tabelas; fotografia do PostgreSQL local em 19/10/2026. |
| [Catálogo SQL](db/schema.json) | Apenas metadados: colunas, constraints, índices, triggers e suas funções. Nenhum registro de animal, usuário ou atendimento. |
| [Mockup aprovado](mockup/index.html#turma) | Referência visual do coletivo reprodutivo, com interações simuladas e paginação máxima de dez; variações individuais/sanitárias especificadas no plano. |
| [Gerador do diagrama](gerar-diagrama.py) | Constrói `db/index.html` a partir do catálogo versionado; não conecta ao banco. |

## Uso local

Os HTMLs e seus scripts funcionam como arquivos estáticos e não dependem de CDN, servidor da API ou credenciais. Para servir pelo navegador, a partir da raiz do repositório:

```sh
python3 -m http.server 41877 --bind 127.0.0.1
```

Abrir `/docs/pecuaria/artefatos/protocolos/index.html` no servidor local. Links para Markdown são documentos do repositório; o navegador pode oferecer o download conforme o visualizador. Os materiais continuam utilizáveis após encerrar o servidor, abrindo os HTMLs localmente.

## Manutenção e proveniência

- O diagrama físico usa nomes reais das colunas SQL. `@map` e listas de relações do Prisma não representam colunas adicionais.
- O snapshot veio de `pg_catalog` de `fazendinha_seedatev3`, com `default_transaction_read_only=on`. Ele não atesta migrations de outro ambiente nem substitui inspeção atual na implementação.
- O plano propõe eventos de pendência e origem do calendário. Essas extensões **não estão** no snapshot atual; não apresentá-las como tabelas/colunas já existentes.
- Ao mudar a estrutura, aplicar/revisar migrations pelo processo normal e obter um novo catálogo autorizado em somente leitura, com o mesmo formato de `schema.json`. Revisar metadados antes de versionar; não exportar dados operacionais ou segredos.
- Regenerar com `python3 docs/pecuaria/artefatos/protocolos/gerar-diagrama.py`. Atualizar posicionamento, setas, explicações e data da inspeção se o número de colunas, relações ou regras mudar. O gerador reproduz o documento, não verifica automaticamente a semântica do desenho.
- `db/index.html` incorpora o catálogo para funcionar offline; manter o JSON e o HTML sincronizados pelo gerador. Nomes antigos de índices podem permanecer após renomear tabelas e não provam duplicação de entidades.
- Na entrega da feature, atualizar `protocolos-exames.md`, os contratos afetados e estes materiais. Incorporar decisões vigentes e retirar o plano temporário concluído. Não derivar novos requisitos de exemplos ilustrativos.

## Validação desta publicação

HTML/JavaScript estático, links e reprodução do gerador são verificáveis sem escrever no banco. Interações dos diagramas, catálogo paginado e mockup foram inspecionadas no navegador. Isso não implementa a feature, não aprova roteiros manuais e não equivale a homologação de campo ou deploy.
