CREATE TABLE IF NOT EXISTS "OAuthProvider" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name"         TEXT NOT NULL,
  "issuer"       TEXT NOT NULL,
  "clientId"     TEXT NOT NULL,
  "clientSecret" TEXT NOT NULL,
  "enabled"      BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthProvider_pkey" PRIMARY KEY ("id")
);
