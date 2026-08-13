process.env.DATABASE_URL ??=
  'postgresql://morshid:morshid_local_password@localhost:5432/morshid'
process.env.REDIS_URL ??= 'redis://localhost:6379'
process.env.PDF_STORAGE_PATH ??= '../storage/pdfs'
process.env.AUTH_ACCESS_TOKEN_SECRET ??=
  'test-access-token-secret-with-at-least-32-characters'
process.env.AUTH_REFRESH_TOKEN_HASH_SECRET ??=
  'test-refresh-token-hash-secret-with-at-least-32-characters'
process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS ??= '900'
process.env.AUTH_REFRESH_TOKEN_TTL_DAYS ??= '7'
