CREATE TABLE "ScheduledStudent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "studentId" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "department" TEXT,
  "scheduledBy" TEXT NOT NULL REFERENCES "User" ("id") ON DELETE RESTRICT,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "processedAt" TIMESTAMP(3),
  "outcome" TEXT
);
CREATE INDEX "ScheduledStudent_processedAt_scheduledAt_idx" ON "ScheduledStudent" ("processedAt", "scheduledAt");
