-- Migration: add task_templates and client_task_templates tables
-- Run this against your production database

CREATE TABLE IF NOT EXISTS `task_templates` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `title` varchar(255) NOT NULL,
  `description` text,
  `taskType` enum('DAS','NFS','DCTF','SPED','OUTROS') NOT NULL,
  `dueDayOfMonth` int NOT NULL,
  `ocrKeywords` text,
  `active` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `client_task_templates` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `clientId` int NOT NULL,
  `taskTemplateId` int NOT NULL,
  `active` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE `recurring_tasks`
  ADD COLUMN IF NOT EXISTS `taskTemplateId` int DEFAULT NULL;

-- Migration 2: add CPF and documentType to clients table
ALTER TABLE `clients`
  ADD COLUMN IF NOT EXISTS `cpf` varchar(14) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `documentType` enum('CNPJ','CPF') NOT NULL DEFAULT 'CNPJ';
