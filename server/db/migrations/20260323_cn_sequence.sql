-- Add per-year credit note sequence counters to system_settings.
-- The void handler reads and increments these with FOR UPDATE inside the transaction.
INSERT INTO system_settings (setting_key, setting_value)
VALUES
  ('cn_sequence_2024', '0'),
  ('cn_sequence_2025', '0'),
  ('cn_sequence_2026', '0')
ON CONFLICT (setting_key) DO NOTHING;
