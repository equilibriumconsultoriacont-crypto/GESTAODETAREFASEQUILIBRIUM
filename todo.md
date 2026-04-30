# Equilíbrio - Gestão de Tarefas Contábeis

## Schema e Banco de Dados
- [x] Tabela `clients` (id, name, cnpj, email, status, createdAt)
- [x] Tabela `recurring_tasks` (id, clientId, taskType, description, dayOfMonth, active)
- [x] Tabela `tasks` (id, clientId, recurringTaskId, title, competencia, dueDate, status, notes)
- [x] Tabela `task_files` (id, taskId, filename, fileKey, fileUrl, uploadedAt)
- [x] Tabela `email_logs` (id, taskId, clientId, sentAt, sentBy, recipientEmail, subject, status)
- [x] Migrations geradas e aplicadas

## Backend (tRPC Routers)
- [x] Router `clients`: list, create, update, deactivate
- [x] Router `tasks`: list, listByClient, create, updateStatus, generateRecurring
- [x] Router `recurringTasks`: list, create, update, toggle
- [x] Router `files`: upload (multipart), getUrl
- [x] Router `email`: sendGuia (com anexo PDF), getLogs
- [x] Lógica de geração automática de tarefas mensais recorrentes
- [x] Lógica de alerta: tarefas vencendo em 3 dias ou já vencidas

## Frontend
- [x] Identidade visual dark teal (CSS variables Equilíbrio)
- [x] AppLayout com sidebar responsiva
- [x] Página Dashboard: cards de resumo (pendentes, vencidas, concluídas), lista de tarefas próximas
- [x] Página Clientes: listagem, cadastro, edição, desativação
- [x] Página Tarefas: listagem com filtros, atualização de status
- [x] Página Detalhe da Tarefa: info, upload de PDF, envio de e-mail, histórico de envios
- [x] Página Tarefas Recorrentes: configuração por cliente
- [x] Badges de status coloridos (Pendente, Em Andamento, Concluída, Vencida)
- [x] Filtros por status, cliente e prazo
- [x] Página Detalhe do Cliente com histórico de tarefas e e-mails

## Upload e E-mail
- [x] Upload de PDF via base64 para S3
- [x] Envio de e-mail com nodemailer (SMTP Gmail) com PDF em anexo
- [x] Configuração de credenciais SMTP via secrets
- [x] Histórico de envios por tarefa

## Dados Iniciais (Seed)
- [x] Cliente Michele Maria Rebonatto de Oliveira Negócios Imobiliários (CNPJ 62.384.424/0001-54)
- [x] Tarefa recorrente: DAS Simples Nacional (vence dia 20)
- [x] Tarefa recorrente: Emissão de Nota de Serviço (vence dia 20)
- [x] Tarefa DAS competência 03/2026 vencimento 20/04/2026 (VENCIDA)
- [x] Tarefa DAS competência 04/2026 vencimento 20/05/2026 (PENDENTE)
- [x] Tarefa NFS competência 03/2026 vencimento 20/04/2026 (VENCIDA)
- [x] Tarefa NFS competência 04/2026 vencimento 20/05/2026 (PENDENTE)

## Testes
- [x] Teste: geração de tarefas recorrentes
- [x] Teste: lógica de status (vencida automática)
- [x] Teste: formato de competência e CNPJ
- [x] Teste: geração de assunto de e-mail
- [x] Teste: router de logout
