CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`cnpj` varchar(18) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(20),
	`notes` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `clients_cnpj_unique` UNIQUE(`cnpj`)
);
--> statement-breakpoint
CREATE TABLE `email_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`clientId` int NOT NULL,
	`taskFileId` int,
	`recipientEmail` varchar(320) NOT NULL,
	`subject` varchar(500) NOT NULL,
	`body` text,
	`status` enum('ENVIADO','FALHOU') NOT NULL DEFAULT 'ENVIADO',
	`errorMessage` text,
	`sentBy` int,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recurring_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`taskType` enum('DAS','NFS','DCTF','SPED','OUTROS') NOT NULL,
	`dueDayOfMonth` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recurring_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`clientId` int NOT NULL,
	`filename` varchar(255) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(1024) NOT NULL,
	`mimeType` varchar(100),
	`fileSize` bigint,
	`uploadedBy` int,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`recurringTaskId` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`taskType` enum('DAS','NFS','DCTF','SPED','OUTROS') NOT NULL,
	`competencia` varchar(7) NOT NULL,
	`dueDate` timestamp NOT NULL,
	`status` enum('PENDENTE','EM_ANDAMENTO','CONCLUIDA','VENCIDA') NOT NULL DEFAULT 'PENDENTE',
	`notes` text,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
