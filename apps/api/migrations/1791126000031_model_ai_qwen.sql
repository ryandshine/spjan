-- Up Migration
-- Ganti model pembaca dokumen ke Qwen (Model Studio Singapura). Alamat dikosongkan agar memakai
-- bawaan env (QWEN_URL bila API key ada). Admin tetap bisa mengubahnya di Pengaturan > Model AI.
update model_ai set llm_url = null, model_teks = 'qwen-plus', model_gambar = 'qwen-vl-max', updated_at = now() where id = 1;

-- Down Migration
update model_ai set model_teks = 'gpt-oss:120b-cloud', model_gambar = 'gemma4:cloud', updated_at = now() where id = 1;
