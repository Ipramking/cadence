-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "bmoniUserId" TEXT,
    "ownerKeyEnc" TEXT,
    "cngnWalletId" TEXT,
    "usdbWalletId" TEXT,
    "cngnAddress" TEXT,
    "usdbAddress" TEXT,
    "autonomy" TEXT NOT NULL DEFAULT 'automatic',
    "pinHash" TEXT,
    "safeWordHash" TEXT,
    "planEnabled" BOOLEAN NOT NULL DEFAULT false,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "perPaymentCapMinor" INTEGER,
    "dailyCapMinor" INTEGER,
    "allowlistOnly" BOOLEAN NOT NULL DEFAULT false,
    "agentFrozen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("autonomy", "bmoniUserId", "cngnAddress", "cngnWalletId", "createdAt", "email", "id", "name", "onboarded", "ownerKeyEnc", "passwordHash", "phone", "pinHash", "planEnabled", "safeWordHash", "usdbAddress", "usdbWalletId") SELECT "autonomy", "bmoniUserId", "cngnAddress", "cngnWalletId", "createdAt", "email", "id", "name", "onboarded", "ownerKeyEnc", "passwordHash", "phone", "pinHash", "planEnabled", "safeWordHash", "usdbAddress", "usdbWalletId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
