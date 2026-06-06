-- Criar tabela de configurações do sistema
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  config_key VARCHAR(255) NOT NULL,
  config_value TEXT NOT NULL,
  encrypted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, config_key)
);

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_system_config_user_id ON system_config(user_id);
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);

-- Habilitar RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver apenas suas próprias configurações
CREATE POLICY "Users can view own config"
  ON system_config
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: usuários podem inserir suas próprias configurações
CREATE POLICY "Users can insert own config"
  ON system_config
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: usuários podem atualizar suas próprias configurações
CREATE POLICY "Users can update own config"
  ON system_config
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: usuários podem deletar suas próprias configurações
CREATE POLICY "Users can delete own config"
  ON system_config
  FOR DELETE
  USING (auth.uid() = user_id);
