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
    "simUsdMinor" INTEGER NOT NULL DEFAULT 5000,
    "simNgnMinor" INTEGER NOT NULL DEFAULT 1000000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("agentFrozen", "allowlistOnly", "autonomy", "bmoniUserId", "cngnAddress", "cngnWalletId", "createdAt", "dailyCapMinor", "email", "id", "name", "onboarded", "ownerKeyEnc", "passwordHash", "perPaymentCapMinor", "phone", "pinHash", "planEnabled", "safeWordHash", "usdbAddress", "usdbWalletId") SELECT "agentFrozen", "allowlistOnly", "autonomy", "bmoniUserId", "cngnAddress", "cngnWalletId", "createdAt", "dailyCapMinor", "email", "id", "name", "onboarded", "ownerKeyEnc", "passwordHash", "perPaymentCapMinor", "phone", "pinHash", "planEnabled", "safeWordHash", "usdbAddress", "usdbWalletId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
