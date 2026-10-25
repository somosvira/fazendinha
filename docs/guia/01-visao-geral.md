# O que o aplicativo organiza

O Fazendinha, apresentado na interface com a marca Terrano, conecta o que aconteceu na fazenda ao rebanho, aos materiais e ao dinheiro. O ponto de partida é um fato identificado: uma compra, uma aplicação, um parto, uma ordenha ou um pagamento. Os saldos e estados são consequências desses fatos e de suas datas.

Este guia descreve o código da V5 integrado à `main` em `b63931e4`. É uma explicação de produto apoiada em rotas, serviços, interface, schema, SQL e testes existentes. Não representa uma nova execução de todos os fluxos nem atesta o ambiente da fazenda. Exemplos numéricos são didáticos. As lacunas têm capítulo próprio; propostas não são funcionalidades disponíveis.

## Os dois grupos de leitura

| Grupo | Eixo | Pergunta que responde |
|---|---|---|
| Financeiro | Operações | O que compramos, vendemos, devemos, pagamos e recebemos? |
| Financeiro | Estoque | O que temos, onde está, de onde veio e em que foi usado? |
| Pecuária | Rebanho | Quem é cada animal, onde estava e qual é sua história? |
| Pecuária | Reprodução | Quais tentativas, avaliações, gestações, partos e acompanhamentos existem? |
| Pecuária | Produção | Quanto leite foi medido, confirmado, destinado, coletado e comercializado? |
| Pecuária | Sanidade | Quais ocorrências, exames, aplicações, tarefas e carências foram registrados? |
| Pecuária | Nutrição | Qual dieta foi planejada, qual consumo foi confirmado e como foi atribuído? |

Estoque aparece sob Financeiro neste guia para organizar a leitura, mas é uma base compartilhada. Reprodução, Sanidade e Nutrição usam os mesmos produtos e movimentos. Produção é acessada pelo item **Leite** do menu. Visitas e protocolos conectam diferentes eixos; Sítios e Contas/Acessos são serviços transversais.

## Do acontecimento ao indicador

1. Identifique o sítio, a data e o responsável pelo fato.
2. Registre o objeto correto: compra, pagamento, movimentação, tentativa, exame, ordenha ou consumo.
3. Confira a prévia quando o fluxo a oferece. Prévia e rascunho não confirmam efeitos.
4. Confirme. O servidor valida permissão, contexto temporal, versões, dependências e disponibilidade.
5. Consulte o resultado e seus vínculos. O mesmo fato pode aparecer na ficha, no protocolo e na visita sem existir três vezes.
6. Corrija pelo fluxo do domínio, com motivo. Anulação ou estorno preserva o original e trata os efeitos dependentes.

Uma compra de ração recebida a prazo aumenta o estoque e cria um compromisso. Seu pagamento afeta a conta. O consumo da ração afeta o estoque e compõe custo operacional atribuído. Somar compra, pagamento e consumo como três despesas contaria a mesma origem repetidamente.

## Como interpretar os dados

| Apresentação | Significado | Interpretação indevida |
|---|---|---|
| Zero informado | O valor foi medido ou declarado como zero | Ausência de registro |
| Pendente / desconhecido | Falta evidência para concluir | Zero, negativo ou saudável |
| Oculto por permissão | O usuário não pode consultar aquele valor | Dado inexistente |
| Não aplicável | A regra não se aplica àquele contexto | Falta de cadastro |
| Parcial | Só parte da população, período ou custo está comprovada | Total completo |
| Anulado / estornado | Existe histórico de regularização | Registro nunca existiu |
| Previsto | Existe planejamento | Atividade executada |

Cada consulta tem uma base temporal: data do fato, vencimento, pagamento, ordenha, coleta ou período comercial. Comparações precisam usar a mesma base. O consolidado respeita o escopo autorizado; escolher “Consolidado” não autoriza gravar fatos sem sítio.

## O que fica preservado

Identidade do animal, autoria, origem dos materiais, local na data do fato e versões usadas permitem reconstruir a operação. Cadastros atuais não podem reescrever automaticamente um protocolo executado, a genética de uma tentativa, um formato de laudo ou um relatório emitido.

Consultas vivas refletem fatos atualmente válidos, inclusive correções retroativas. Uma emissão preservada retrata as fontes e regras no momento em que foi gerada. Por isso duas emissões podem diferir legitimamente sem que a anterior seja apagada.

## Acesso e trabalho diário

A sessão identifica a pessoa. Área e ação autorizam consulta, lançamento, exportação e gestão de acessos. O servidor resolve o sítio e a visibilidade dos valores. Um funcionário pode registrar um fato operacional sem receber os documentos financeiros completos relacionados a ele. A política dos custos operacionais atribuídos da Pecuária é distinta do acesso a preço, receita e documentos do Financeiro.

O assistente de consulta existente oferece ajuda e consultas financeiras de leitura. Não altera os fatos e não é um assistente operacional completo dos sete eixos. O bot anterior, `/ia` e WhatsApp permanecem suspensos. Agricultura, Cultivo, Equipe/Ponto e laboratório/FIV não são módulos operacionais atuais.

## Fontes e uso deste guia

Os capítulos seguem conceito → rotina → interface → regras/efeitos → implementação. Os contratos detalhados continuam no [índice técnico](../README.md). O [system design](../system-design.md) explica as relações entre os domínios. O [modelo de estados](../pecuaria/estados-animal.md) define a leitura temporal do animal. Para estudar possíveis evoluções, consulte [lacunas](../lacunas.md).

O HTML é um documento local gerado destes capítulos, com navegação, busca, diagramas e exemplos. Não se conecta ao banco, não executa ações no aplicativo e não altera as marcações dos roteiros de homologação.
