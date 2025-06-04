-- DropForeignKey
ALTER TABLE "Donation" DROP CONSTRAINT "Donation_eventId_fkey";

-- DropForeignKey
ALTER TABLE "SMSTemplate" DROP CONSTRAINT "SMSTemplate_eventId_fkey";

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SMSTemplate" ADD CONSTRAINT "SMSTemplate_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
