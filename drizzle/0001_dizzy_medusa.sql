CREATE TABLE `employee_contacts` (
	`person_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`updated_at` text NOT NULL
);

INSERT INTO `employee_contacts` (`person_id`, `email`, `updated_at`) VALUES
	('ana', 'ac242883@alunos.unisanta.br', CURRENT_TIMESTAMP),
	('bruno', 'ac242883@alunos.unisanta.br', CURRENT_TIMESTAMP),
	('carla', 'ac242883@alunos.unisanta.br', CURRENT_TIMESTAMP),
	('diego', 'ac242883@alunos.unisanta.br', CURRENT_TIMESTAMP),
	('elisa', 'ac242883@alunos.unisanta.br', CURRENT_TIMESTAMP),
	('fernanda', 'ac242883@alunos.unisanta.br', CURRENT_TIMESTAMP),
	('gustavo', 'ac242883@alunos.unisanta.br', CURRENT_TIMESTAMP);
