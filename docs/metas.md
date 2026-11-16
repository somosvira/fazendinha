# Metas da fazenda

## Escopo e navegação

Página independente `/metas`, com ícone de alvo na sidebar, fora da IA Terrano. Não depende de chave OpenAI nem de `ASSISTENTE_CONSULTA_ENABLED`. A seleção de fazenda usa o escopo compartilhado; criar ou medir exige uma fazenda concreta. Não há criação em escopo consolidado. Formulários, medição e histórico usam modal centralizado; rascunhos têm guarda de navegação/descarte.

A lista mostra até cem metas autorizadas, sem criar metas a partir de exemplos ou do quadro fotografado. O usuário escolhe título, indicador, mínimo/máximo/faixa ou marco, período diário/mensal/anual/ciclo, prazo e critérios. Mortalidade não assume o sinal ambíguo do quadro: o usuário define direção e período. Taxas ficam entre zero e cem; limites negativos só são admitidos no resultado financeiro. Marcos exigem prazo e podem conter até vinte etapas identificadas. Medições registram data, observação e valor, ou conclusão/etapas para marcos.

## Indicadores e progresso

Catálogo versionado: produção de leite, produção por vaca, vacas em lactação, CCS, CPP, taxa de prenhez, mortalidade, marco operacional e resultado financeiro. Fórmula, unidade e disponibilidade de fonte acompanham o indicador. Os gráficos usam somente medições existentes e exibem o alvo; ausência de medição não vira zero. A situação compara o valor ao limite/faixa, sem inventar percentual para indicadores em que menor é melhor. Marcos exibem etapas concluídas e pendentes, com contagem, sem percentual artificial. A conclusão com etapas precisa corresponder a todas as etapas concluídas.

A única apuração automática atual é produção geral diária, adaptador `LEITE_GERAL_DIARIO_V1`. Exige configuração GERAL e cobertura de todas as posições de ordenha por parcelas gerais confirmadas com entrada física. Soma todas as naturezas em Decimal, sem adicionar o controle individual ao geral. Usa a trava transacional da rotina leiteira; falta de cobertura recusa a medição, sem registrar zero. O evento conserva adaptador e URL exata de origem. Os demais indicadores, assim como volume em outros períodos, têm medição manual explicitamente identificada. Não há inferência de CCS/CPP, população exposta ou denominador reprodutivo sem dados conferidos.

## Autorização e persistência

Usuário real ativo é obrigatório. Indicadores de Pecuária exigem a área; o financeiro exige Financeiro, aba dashboard e `verValores`, `verSalarios` e `verInvestimento`, salvo dono. O catálogo e a lista não entregam títulos, valores ou histórico de domínios negados. Criar, editar e medir exigem também `lancar`. O servidor resolve o sítio e revalida esses gates em toda operação.

`EventoMetaAssistente` é um diário imutável de definições e medições, separado dos fatos operacionais. Cada evento conserva meta, revisão, usuário, sítio, domínio, operação UUID, hash do pedido, conteúdo e data. Alteração da meta não apaga medições nem reescreve o histórico. A apresentação histórica usa a definição vigente na época, inclusive nomes das etapas. Não há exclusão nesta versão.

A revisão-base implementa concorrência otimista; uma atualização atrasada recebe conflito, preservando o histórico. A operação UUID é globalmente única e idempotente: reenvio idêntico recupera o resultado; reutilização incompatível é recusada. Banco reforça sequência, escopo e proibição de update/delete por triggers. Sítio e domínio não mudam por edição da definição. A migration é `20261103180000_metas_assistente`; não exige seed nem substituição da base.

## API e implementação

- `GET /api/metas/catalogo`: indicadores permitidos e capacidade de edição.
- `GET /api/metas`: metas autorizadas, medições, situação, histórico e limite.
- `PUT /api/metas/:id`: definição estrita com `operacaoId`, `versaoBase` e `definicao`.
- `POST /api/metas/:id/medicoes`: medição estrita com operação, revisão, data, observação e valor ou conclusão/etapas.

Rotas Hono validam UUID/corpo com Zod e delegam aos serviços `services/assistente/metas`; o nome interno não cria dependência da IA. O cliente está em `client/src/assistente/Metas.tsx`, envolvido pela página independente `PaginaMetas`. Etapas são campos opcionais do JSON versionado, compatíveis com registros anteriores sem etapas.

A busca global inclui a página; metas individuais ainda não são indexadas, conforme [limitação documentada](busca-global.md). Metas não é emissão de relatório nem nova variável do builder: alvos/medições manuais não substituem fatos operacionais.

## Validação e limites

Testes cobrem comparação mínimo/máximo/faixa, taxas, etapas e coerência de conclusão, catálogo/gates, autoria, idempotência, concorrência, apuração com cobertura e proteção de rascunhos. A conferência local no PostgreSQL usa somente fixtures próprias, com rollback, incluindo a imutabilidade SQL. Testes com mocks não homologam a qualidade da captura operacional nem a acurácia de IA. Valores de referência de mockups e do quadro não foram gravados como metas reais.
