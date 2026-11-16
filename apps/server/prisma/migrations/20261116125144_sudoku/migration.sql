-- CreateTable
CREATE TABLE "sudoku_games" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "puzzle" CHAR(81) NOT NULL,
    "solution" CHAR(81) NOT NULL,
    "board" CHAR(81) NOT NULL,
    "timeLimitS" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "mistakes" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "sudoku_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sudoku_moves" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sudoku_moves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sudoku_games_userId_endedAt_idx" ON "sudoku_games"("userId", "endedAt");

-- CreateIndex
CREATE INDEX "sudoku_moves_gameId_createdAt_idx" ON "sudoku_moves"("gameId", "createdAt");

-- AddForeignKey
ALTER TABLE "sudoku_games" ADD CONSTRAINT "sudoku_games_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sudoku_moves" ADD CONSTRAINT "sudoku_moves_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "sudoku_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- At most one game in progress per user (partial unique index, written by hand:
-- Prisma's schema language can't express it). Two simultaneous "start game" requests
-- cannot both succeed.
CREATE UNIQUE INDEX "sudoku_games_one_in_progress_per_user"
  ON "sudoku_games"("userId") WHERE "status" = 'IN_PROGRESS';
