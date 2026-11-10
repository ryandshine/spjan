-- Up Migration
-- qwen-vl-max (alias latest) tidak jelas mendukung json_object; qwen3-vl-plus tercantum dan bawaannya tanpa mode berpikir.
-- Hanya mengganti bila admin belum mengubahnya.
update model_ai set model_gambar = 'qwen3-vl-plus', updated_at = now() where id = 1 and model_gambar = 'qwen-vl-max';

-- Down Migration
update model_ai set model_gambar = 'qwen-vl-max', updated_at = now() where id = 1 and model_gambar = 'qwen3-vl-plus';
