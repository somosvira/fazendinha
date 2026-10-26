ALTER TABLE "public"."Usuario" ADD COLUMN "clerkUserId" TEXT;

CREATE UNIQUE INDEX "Usuario_clerkUserId_key" ON "public"."Usuario"("clerkUserId");
