# Primeiro lote de relatórios complementares — proposta

Mockup navegável em `/mockups/relatorios-rapidos/index.html`. Dados explicitamente ilustrativos; não consulta nem modifica a base. A apresentação mantém a direção dos relatórios atuais e usa as primitivas shadcn existentes.

Quatro relatórios apoiados no DTO `SnapshotIndicadoresReprodutivos.acompanhamento` já retornado pelo serviço autorizado: intervalo entre partos, seguimento/perdas gestacionais, espera até o primeiro serviço e tentativas por concepção. Não duplicar cálculos ou inferir relações por proximidade de datas. Cada fonte conserva sua própria população e critério temporal. Falta de comprovação não vira zero.

Implementação proposta: acesso direto aos modelos e quatro adapters no builder; campos opcionais de origem, evidências, pendências e referências permanecem selecionáveis. Preservar estado de metodologia não calculada/indisponível em respostas antigas. CSV, cartões/tabela e seleção de sítio reutilizam o fluxo atual. Não requer migration, importação IDEAGRI ou regra clínica nova.

Revisão impeccable e frontend-design: lista compacta dos relatórios, resultado como foco, tipografia e paleta do módulo, ajudas por campo, um único conjunto de dados para cartões e tabela. Regras disponíveis via interrogação; sem textos técnicos soltos, taxas inventadas ou métricas de benchmark.

Pendente: aprovação do mockup antes de alterar a interface operacional, conforme AGENTS.md.
