BEGIN;
-- AlterEnum
ALTER TYPE "MeetingStatus" ADD VALUE 'NO_SHOW';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CampusMeeting" ADD COLUMN     "feedback" TEXT,
ADD COLUMN     "feedbackAt" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "proposalBy" "Role",
ADD COLUMN     "proposedLocation" TEXT,
ADD COLUMN     "proposedSlotId" TEXT,
ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "returnStatus" "MeetingStatus";

-- AlterTable
ALTER TABLE "CampusAnnouncement" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CampusBlock" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "CampusBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampusMessage" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampusMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampusBlock_teacherId_startAt_idx" ON "CampusBlock"("teacherId", "startAt");

-- CreateIndex
CREATE INDEX "CampusMessage_meetingId_createdAt_idx" ON "CampusMessage"("meetingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampusMeeting_proposedSlotId_key" ON "CampusMeeting"("proposedSlotId");

-- AddForeignKey
ALTER TABLE "CampusMeeting" ADD CONSTRAINT "CampusMeeting_proposedSlotId_fkey" FOREIGN KEY ("proposedSlotId") REFERENCES "CampusSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusBlock" ADD CONSTRAINT "CampusBlock_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusMessage" ADD CONSTRAINT "CampusMessage_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "CampusMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusMessage" ADD CONSTRAINT "CampusMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CampusBlock" ADD CONSTRAINT "CampusBlock_valid_time" CHECK ("endAt" > "startAt");
ALTER TABLE "CampusMeeting" ADD CONSTRAINT "CampusMeeting_valid_rating" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "CampusMeeting" ADD CONSTRAINT "CampusMeeting_distinct_proposal" CHECK ("proposedSlotId" <> "slotId");
COMMIT;

