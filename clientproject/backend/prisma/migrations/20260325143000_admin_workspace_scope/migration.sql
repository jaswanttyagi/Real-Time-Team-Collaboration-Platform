ALTER TABLE "User" ADD COLUMN "workspaceAdminId" TEXT;

UPDATE "User" AS member
SET "workspaceAdminId" = COALESCE(
  (
    SELECT client."createdById"
    FROM "Project" AS project
    JOIN "Client" AS client ON client."id" = project."clientId"
    WHERE project."createdById" = member."id"
    ORDER BY project."createdAt" ASC
    LIMIT 1
  ),
  (
    SELECT client."createdById"
    FROM "Project" AS project
    JOIN "Client" AS client ON client."id" = project."clientId"
    WHERE project."assignedDeveloperId" = member."id"
    ORDER BY project."createdAt" ASC
    LIMIT 1
  ),
  (
    SELECT admin."id"
    FROM "User" AS admin
    WHERE admin."role" = 'ADMIN'
    ORDER BY admin."createdAt" ASC
    LIMIT 1
  )
)
WHERE member."role" <> 'ADMIN';

ALTER TABLE "User"
ADD CONSTRAINT "User_workspaceAdminId_fkey"
FOREIGN KEY ("workspaceAdminId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "User_workspaceAdminId_idx" ON "User"("workspaceAdminId");
