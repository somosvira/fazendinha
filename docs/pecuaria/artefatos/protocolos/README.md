# Base documental de protocolos

[Entrada navegável](index.html) · [Registro da entrega](../../plano-protocolos-unificados.md) · [Contrato vigente](../../protocolos-exames.md)

Materiais de apoio do núcleo comum de protocolos. A implementação local está em validação; o contrato operacional registra o comportamento implementado e seus limites. O registro da entrega local aponta este contrato e mantém separadas as evidências e validações pendentes.

| Material | Fonte e alcance |
|---|---|
| [Relações e diagramas interativos](relacoes.html) | Explicação de modelo, versões, participação, tarefas e fatos; exemplos fictícios, sem acesso à aplicação. |
| [Diagrama físico](db/index.html) | Sete tabelas centrais com todas as colunas e catálogo de 13 tabelas; fotografia de metadados do PostgreSQL local em 19/10/2026. |
| [Catálogo SQL](db/schema.json) | Apenas metadados: colunas, constraints, índices, triggers e suas funções. Nenhum registro de animal, usuário ou atendimento. |
| [Mockup aprovado](mockup/index.html#turma) | Referência conceitual simulada do coletivo reprodutivo. Não comprova a aparência das telas implementadas; inspeção visual das quatro combinações segue pendente. |
| [Gerador do diagrama](gerar-diagrama.py) | Constrói `db/index.html` a partir do catálogo versionado; não conecta ao banco. |

## Uso local

Os HTMLs e seus scripts funcionam como arquivos estáticos e não dependem de CDN, servidor da API ou credenciais. Para servir pelo navegador, a partir da raiz do repositório:

```sh
python3 -m http.server 41877 --bind 127.0.0.1
```

Abrir `/docs/pecuaria/artefatos/protocolos/index.html` no servidor local. Links para Markdown são documentos do repositório; o navegador pode oferecer o download conforme o visualizador. Os materiais continuam utilizáveis após encerrar o servidor, abrindo os HTMLs localmente.

## Manutenção e proveniência

- O diagrama físico usa nomes reais das colunas SQL. `@map` e listas de relações do Prisma não representam colunas adicionais.
- O snapshot de 19/10/2026 veio somente de `pg_catalog` de `fazendinha_seedatev3`, com `default_transaction_read_only=on`; nenhum registro operacional foi consultado. Ele não atesta migrations de outro ambiente nem substitui inspeção atual na implementação.
- O catálogo contém `EventoTarefaProtocolo` e `ParticipacaoProtocolo.origemCalendario`, incluídos pela migration `20261019190000_eventos_tarefas_protocolos`. Eventos registram não atendimento, adiamento e retificação; a origem classifica a regra de calendário sem recalcular previsões históricas.
- Ao mudar a estrutura, aplicar/revisar migrations pelo processo normal e obter um novo catálogo autorizado em somente leitura, com o mesmo formato de `schema.json`. Revisar metadados antes de versionar; não exportar dados operacionais ou segredos.
- Regenerar com `python3 docs/pecuaria/artefatos/protocolos/gerar-diagrama.py`. Atualizar posicionamento, setas, explicações e data da inspeção se o número de colunas, relações ou regras mudar. O gerador reproduz o documento, não verifica automaticamente a semântica do desenho.
- `db/index.html` incorpora o catálogo para funcionar offline; manter o JSON e o HTML sincronizados pelo gerador. Nomes antigos de índices podem permanecer após renomear tabelas e não provam duplicação de entidades.
- Na entrega de mudanças, atualizar `protocolos-exames.md`, os contratos afetados e estes materiais. Incorporar decisões vigentes ao contrato; manter o registro local de entrega factual, sem reintroduzir o plano temporário ou derivar requisitos de exemplos ilustrativos.

## Validação desta publicação

A reprodução do gerador, `node --check` nos scripts inline e os links locais foram verificados sem escrever no banco. A implementação local permanece em validação; a inspeção visual final das telas e a homologação manual/de campo não estão concluídas. O mockup é demonstrativo e não equivale à interface final, ao deploy ou à homologação.
