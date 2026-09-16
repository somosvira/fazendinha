// Valores inertes para testes unitários. O schema continua exigindo as
// configurações de R2 em todos os ambientes reais; nenhum teste usa estas
// credenciais para falar com o bucket.
process.env.R2_ACCOUNT_ID ??= "test-account";
process.env.R2_ACCESS_KEY_ID ??= "test-access-key";
process.env.R2_SECRET_ACCESS_KEY ??= "test-secret-access-key";
process.env.R2_BUCKET_NOTAS ??= "test-bucket";
process.env.STORAGE_NAMESPACE ??= "test";
