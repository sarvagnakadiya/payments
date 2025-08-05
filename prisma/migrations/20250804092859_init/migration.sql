-- CreateEnum
CREATE TYPE "public"."UsernameSource" AS ENUM ('FARCASTER', 'GASYARD');

-- CreateEnum
CREATE TYPE "public"."RequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."Chain" AS ENUM ('ETHEREUM', 'BASE', 'BNB', 'ARBITRUM', 'HYPERLIQUID', 'MOVEMENT', 'SOLANA', 'SEI', 'POLYGON');

-- CreateEnum
CREATE TYPE "public"."Token" AS ENUM ('ETH', 'USDC', 'BSC_USD', 'USDT', 'BNB', 'MOVE', 'POL', 'SEI');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "fid" TEXT,
    "username" TEXT NOT NULL,
    "usernameSource" "public"."UsernameSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preferredChain" "public"."Chain" NOT NULL,
    "preferredToken" "public"."Token" NOT NULL,
    "preferredAddress" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FundRequest" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "overrideChain" "public"."Chain",
    "overrideToken" "public"."Token",
    "overrideAddress" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "status" "public"."RequestStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "FundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_fid_key" ON "public"."User"("fid");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");

-- CreateIndex
CREATE INDEX "FundRequest_senderId_idx" ON "public"."FundRequest"("senderId");

-- CreateIndex
CREATE INDEX "FundRequest_receiverId_idx" ON "public"."FundRequest"("receiverId");

-- AddForeignKey
ALTER TABLE "public"."FundRequest" ADD CONSTRAINT "FundRequest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FundRequest" ADD CONSTRAINT "FundRequest_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
