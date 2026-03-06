-- CreateIndex
CREATE INDEX "AppointmentHistory_tenantId_createdAt_id_idx" ON "AppointmentHistory"("tenantId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "AppointmentHistory_tenantId_action_createdAt_id_idx" ON "AppointmentHistory"("tenantId", "action", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "AppointmentHistory_tenantId_actorUserId_createdAt_id_idx" ON "AppointmentHistory"("tenantId", "actorUserId", "createdAt" DESC, "id" DESC);
