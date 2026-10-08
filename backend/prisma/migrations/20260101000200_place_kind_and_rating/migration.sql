-- AlterTable
-- Place identity and provenance for the Google Maps (Playwright) scrape.
--
-- `placeKind` is what makes a Place displayable as a coffee shop / bakery /
-- restaurant rather than a generic row; without it the app cannot group the
-- catalogue the way the product needs.
--
-- `rating` and `reviewsCount` are OPTIONAL source provenance. Nothing in the
-- app may require them: a place with no rating must still be discoverable and
-- displayable, because CONTEXT.md makes coordinates the primary basis for
-- discovery and ratings are not part of that.
ALTER TABLE "branches" ADD COLUMN     "placeKind" TEXT,
ADD COLUMN     "rating" DECIMAL(2,1),
ADD COLUMN     "reviewsCount" INTEGER,
ADD COLUMN     "googleMapsUrl" TEXT,
ADD COLUMN     "sourceAcquiredAt" TIMESTAMP(3);

-- CreateIndex
-- Supports the location-first browse: filter by kind within a city/markaz.
CREATE INDEX "branches_placeKind_idx" ON "branches"("placeKind");