-- =====================================================
-- AUDITORIA: Normalização + Índices de Performance
-- Executar no banco Railway via TablePlus
-- =====================================================

-- 1. Normalizar emails existentes
UPDATE users SET email = LOWER(TRIM(email));
UPDATE clients SET email = LOWER(TRIM(email));

-- 2. Garantir passwordHash com tamanho correto
ALTER TABLE `users` MODIFY COLUMN `passwordHash` varchar(255);

-- 3. Índices de performance críticos
CREATE INDEX IF NOT EXISTS idx_tasks_clientId ON tasks(clientId);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_competencia ON tasks(competencia);
CREATE INDEX IF NOT EXISTS idx_tasks_dueDate ON tasks(dueDate);
CREATE INDEX IF NOT EXISTS idx_email_logs_clientId ON email_logs(clientId);
CREATE INDEX IF NOT EXISTS idx_email_logs_taskId ON email_logs(taskId);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_clientId ON recurring_tasks(clientId);
CREATE INDEX IF NOT EXISTS idx_client_task_templates_clientId ON client_task_templates(clientId);
CREATE INDEX IF NOT EXISTS idx_task_files_taskId ON task_files(taskId);

-- 4. Completar colunas faltantes (Railway não tem IF NOT EXISTS no ALTER)
-- Rodar individualmente se der erro de coluna já existente:
-- ALTER TABLE tasks ADD COLUMN completedAt timestamp DEFAULT NULL;
-- ALTER TABLE task_files ADD COLUMN uploadedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP;
