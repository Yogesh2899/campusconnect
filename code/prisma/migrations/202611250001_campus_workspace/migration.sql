BEGIN;
CREATE TYPE "MeetingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROPOSED', 'DECLINED', 'CANCELLED', 'COMPLETED');

CREATE TABLE "CampusSlot" (
  "id" TEXT PRIMARY KEY,
  "teacherId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "closed" BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "CampusSlot_time_check" CHECK ("endAt" > "startAt")
);
CREATE UNIQUE INDEX "CampusSlot_teacherId_startAt_key" ON "CampusSlot"("teacherId", "startAt");
CREATE INDEX "CampusSlot_startAt_idx" ON "CampusSlot"("startAt");

CREATE TABLE "CampusMeeting" (
  "id" TEXT PRIMARY KEY,
  "slotId" TEXT NOT NULL REFERENCES "CampusSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "studentId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "subject" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "location" TEXT,
  "status" "MeetingStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CampusMeeting_slotId_status_idx" ON "CampusMeeting"("slotId", "status");
CREATE INDEX "CampusMeeting_studentId_status_idx" ON "CampusMeeting"("studentId", "status");
CREATE UNIQUE INDEX "CampusMeeting_active_slot" ON "CampusMeeting"("slotId")
  WHERE "status" IN ('PENDING', 'CONFIRMED', 'PROPOSED', 'COMPLETED');

CREATE TABLE "CampusNotice" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "message" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CampusNotice_userId_createdAt_idx" ON "CampusNotice"("userId", "createdAt");

CREATE TABLE "SavedFaculty" (
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "facultyEmail" TEXT NOT NULL REFERENCES "DcseFaculty"("email") ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("userId", "facultyEmail")
);

CREATE TABLE "CampusAnnouncement" (
  "id" TEXT PRIMARY KEY,
  "authorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "departmentId" TEXT NOT NULL REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CampusAnnouncement_departmentId_createdAt_idx" ON "CampusAnnouncement"("departmentId", "createdAt");
COMMIT;
