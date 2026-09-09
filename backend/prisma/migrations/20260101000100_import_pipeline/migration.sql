-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "nameEn" TEXT,
ADD COLUMN     "photoAttribution" TEXT;

-- AlterTable
ALTER TABLE "cuisines" ADD COLUMN     "nameAr" TEXT;

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "cityId" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "governorateId" TEXT,
ADD COLUMN     "nameEn" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "dishes" ADD COLUMN     "descriptionEn" TEXT,
ADD COLUMN     "nameEn" TEXT;

-- CreateTable
CREATE TABLE "governorates" (
    "id" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "governorates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "governorateId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "governorates_nameEn_key" ON "governorates"("nameEn");

-- CreateIndex
CREATE UNIQUE INDEX "governorates_nameAr_key" ON "governorates"("nameAr");

-- CreateIndex
CREATE UNIQUE INDEX "governorates_slug_key" ON "governorates"("slug");

-- CreateIndex
CREATE INDEX "cities_nameEn_idx" ON "cities"("nameEn");

-- CreateIndex
CREATE UNIQUE INDEX "cities_governorateId_slug_key" ON "cities"("governorateId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "branches_externalId_key" ON "branches"("externalId");

-- CreateIndex
CREATE INDEX "branches_cityId_idx" ON "branches"("cityId");

-- CreateIndex
CREATE INDEX "branches_governorateId_idx" ON "branches"("governorateId");

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_governorateId_fkey" FOREIGN KEY ("governorateId") REFERENCES "governorates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_governorateId_fkey" FOREIGN KEY ("governorateId") REFERENCES "governorates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

