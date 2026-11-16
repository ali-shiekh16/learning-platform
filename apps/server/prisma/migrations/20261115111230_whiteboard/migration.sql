-- CreateTable
CREATE TABLE "whiteboards" (
    "meetingId" TEXT NOT NULL,
    "elements" JSONB NOT NULL DEFAULT '[]',
    "locked" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whiteboards_pkey" PRIMARY KEY ("meetingId")
);

-- AddForeignKey
ALTER TABLE "whiteboards" ADD CONSTRAINT "whiteboards_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
