-- CreateIndex
CREATE INDEX "Donation_createdById_idx" ON "Donation"("createdById");

-- CreateIndex
CREATE INDEX "Donation_status_idx" ON "Donation"("status");

-- CreateIndex
CREATE INDEX "Donation_createdAt_idx" ON "Donation"("createdAt");

-- CreateIndex
CREATE INDEX "Donation_eventId_status_idx" ON "Donation"("eventId", "status");

-- CreateIndex
CREATE INDEX "Event_date_idx" ON "Event"("date");

-- CreateIndex
CREATE INDEX "Event_type_idx" ON "Event"("type");

-- CreateIndex
CREATE INDEX "SMSTemplate_createdById_idx" ON "SMSTemplate"("createdById");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");
