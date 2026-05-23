-- ============================================================
-- Migration: Adicionar todas as colunas que faltam no banco
-- Todas as operações usam IF NOT EXISTS / MODIFY segura
-- ============================================================

-- 1. clients: adicionar cpf e documentType
ALTER TABLE `clients` 
  ADD COLUMN IF NOT EXISTS `cpf` varchar(14),
  ADD COLUMN IF NOT EXISTS `documentType` enum('CNPJ','CPF') NOT NULL DEFAULT 'CNPJ';

-- 2. tasks: adicionar colunas que o código espera mas o DB não tem
ALTER TABLE `tasks`
  ADD COLUMN IF NOT EXISTS `priority` enum('BAIXA','NORMAL','ALTA','URGENTE') NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS `department` enum('FISCAL','CONTABIL','DP','SOCIETARIO','FINANCEIRO','GERAL') NOT NULL DEFAULT 'GERAL',
  ADD COLUMN IF NOT EXISTS `assignedTo` int,
  ADD COLUMN IF NOT EXISTS `internalDeadline` timestamp NULL,
  ADD COLUMN IF NOT EXISTS `waitingSince` timestamp NULL,
  ADD COLUMN IF NOT EXISTS `startedAt` timestamp NULL;

-- 3. tasks: expandir enum status (o original só tinha 4 valores)
ALTER TABLE `tasks` 
  MODIFY COLUMN `status` enum('PENDENTE','EM_ANDAMENTO','AGUARDANDO_CLIENTE','EM_REVISAO','CONCLUIDA','CANCELADA','VENCIDA') NOT NULL DEFAULT 'PENDENTE';

-- 4. recurring_tasks: adicionar taskTemplateId
ALTER TABLE `recurring_tasks`
  ADD COLUMN IF NOT EXISTS `taskTemplateId` int;

-- 5. Criar tabela task_templates se não existir
CREATE TABLE IF NOT EXISTS `task_templates` (
  `id` int AUTO_INCREMENT NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `taskType` enum('DAS','NFS','DCTF','SPED','OUTROS') NOT NULL,
  `dueDayOfMonth` int NOT NULL,
  `ocrKeywords` text,
  `department` enum('FISCAL','CONTABIL','DP','SOCIETARIO','FINANCEIRO','GERAL') NOT NULL DEFAULT 'GERAL',
  `active` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `task_templates_id` PRIMARY KEY(`id`)
);

-- 6. Criar tabela task_catalogs se não existir
CREATE TABLE IF NOT EXISTS `task_catalogs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `active` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `task_catalogs_id` PRIMARY KEY(`id`)
);

-- 7. Criar tabela catalog_templates se não existir
CREATE TABLE IF NOT EXISTS `catalog_templates` (
  `id` int AUTO_INCREMENT NOT NULL,
  `catalogId` int NOT NULL,
  `taskTemplateId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `catalog_templates_id` PRIMARY KEY(`id`)
);

-- 8. Criar tabela client_task_templates se não existir
CREATE TABLE IF NOT EXISTS `client_task_templates` (
  `id` int AUTO_INCREMENT NOT NULL,
  `clientId` int NOT NULL,
  `taskTemplateId` int NOT NULL,
  `catalogId` int,
  `active` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `client_task_templates_id` PRIMARY KEY(`id`)
);

-- 9. Criar tabela activity_logs se não existir
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `entityType` varchar(50) NOT NULL,
  `entityId` int NOT NULL,
  `action` varchar(100) NOT NULL,
  `before` text,
  `after` text,
  `userId` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);

-- 10. Criar tabela password_reset_tokens (alternativa ao uso do openId)
-- (não obrigatório agora, o sistema usa openId como workaround)

-- 11. users: adicionar clientId e role
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `clientId` int,
  MODIFY COLUMN `role` enum('user','admin','client') NOT NULL DEFAULT 'user';

-- 12. CRÍTICO: fileUrl era varchar(1024) - insuficiente para data URLs base64
-- Um PDF de 1MB em base64 = ~1.4MB de texto, muito acima de 1024 chars
ALTER TABLE `task_files`
  MODIFY COLUMN `fileUrl` mediumtext NOT NULL;
