-- MIGRAÇÃO: Atualização da tabela membros para novos campos e renomeação

-- Adiciona as novas colunas
ALTER TABLE membros ADD COLUMN codigo_dabb VARCHAR(50);
ALTER TABLE membros ADD COLUMN cpf2 VARCHAR(20);
ALTER TABLE membros ADD COLUMN data_filiacao DATE;

-- Copia os dados antigos de data_associacao para data_filiacao (se necessário)
UPDATE membros SET data_filiacao = data_associacao WHERE data_associacao IS NOT NULL;

-- Remover a coluna antiga
ALTER TABLE membros DROP COLUMN data_associacao;
