-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'RESTAURANT_OWNER');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "PriceRange" AS ENUM ('BUDGET', 'MODERATE', 'EXPENSIVE', 'LUXURY');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('VIEW_RESTAURANT', 'VIEW_DISH', 'CLICK_RECOMMENDATION', 'LIKE', 'DISLIKE', 'NOT_INTERESTED', 'TOO_EXPENSIVE', 'TOO_FAR', 'WRONG_TASTE', 'SAVED', 'SHARED');

-- CreateEnum
CREATE TYPE "TasteAttribute" AS ENUM ('SPICY', 'SWEET', 'SAVORY', 'SOUR', 'BITTER', 'CREAMY', 'RICH', 'REFRESHING');

-- CreateEnum
CREATE TYPE "MealCharacteristic" AS ENUM ('LIGHT', 'HEAVY', 'FILLING', 'SNACK', 'BREAKFAST', 'LUNCH', 'DINNER', 'DESSERT', 'BEVERAGE');

-- CreateEnum
CREATE TYPE "DietaryProperty" AS ENUM ('VEGETARIAN', 'VEGAN', 'HALAL', 'GLUTEN_FREE', 'DAIRY_FREE', 'NUT_FREE', 'LOW_CARB');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preference_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredCuisines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dislikedCuisines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredPriceRange" "PriceRange",
    "dietaryRestrictions" "DietaryProperty"[] DEFAULT ARRAY[]::"DietaryProperty"[],
    "spicePreference" INTEGER NOT NULL DEFAULT 2,
    "preferredMealTypes" "MealCharacteristic"[] DEFAULT ARRAY[]::"MealCharacteristic"[],
    "atmospherePreferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inferredPreferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preference_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_interactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT,
    "branchId" TEXT,
    "dishId" TEXT,
    "interactionType" "InteractionType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "priceRange" "PriceRange" NOT NULL DEFAULT 'MODERATE',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "lastVerifiedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "logoUrl" TEXT,
    "coverImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuisines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuisines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_cuisines" (
    "restaurantId" TEXT NOT NULL,
    "cuisineId" TEXT NOT NULL,

    CONSTRAINT "restaurant_cuisines_pkey" PRIMARY KEY ("restaurantId","cuisineId")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "phone" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_operating_hours" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "isSplitShift" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "branch_operating_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atmosphere_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "atmosphere_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_atmospheres" (
    "branchId" TEXT NOT NULL,
    "atmosphereTagId" TEXT NOT NULL,

    CONSTRAINT "branch_atmospheres_pkey" PRIMARY KEY ("branchId","atmosphereTagId")
);

-- CreateTable
CREATE TABLE "menus" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dishes" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "imageUrl" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "lastVerifiedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "dish_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_category_assignments" (
    "dishId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "dish_category_assignments_pkey" PRIMARY KEY ("dishId","categoryId")
);

-- CreateTable
CREATE TABLE "dish_attributes" (
    "id" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "tasteAttributes" "TasteAttribute"[] DEFAULT ARRAY[]::"TasteAttribute"[],
    "textures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mealCharacteristics" "MealCharacteristic"[] DEFAULT ARRAY[]::"MealCharacteristic"[],
    "dietaryProperties" "DietaryProperty"[] DEFAULT ARRAY[]::"DietaryProperty"[],

    CONSTRAINT "dish_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_ingredients" (
    "dishId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "isAllergen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "dish_ingredients_pkey" PRIMARY KEY ("dishId","ingredientId")
);

-- CreateTable
CREATE TABLE "food_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "food_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_tags" (
    "dishId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "dish_tags_pkey" PRIMARY KEY ("dishId","tagId")
);

-- CreateTable
CREATE TABLE "dish_price_history" (
    "id" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "dish_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_authUserId_key" ON "users"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "user_preference_profiles_userId_key" ON "user_preference_profiles"("userId");

-- CreateIndex
CREATE INDEX "user_interactions_userId_interactionType_idx" ON "user_interactions"("userId", "interactionType");

-- CreateIndex
CREATE INDEX "user_interactions_restaurantId_idx" ON "user_interactions"("restaurantId");

-- CreateIndex
CREATE INDEX "user_interactions_dishId_idx" ON "user_interactions"("dishId");

-- CreateIndex
CREATE UNIQUE INDEX "restaurants_slug_key" ON "restaurants"("slug");

-- CreateIndex
CREATE INDEX "restaurants_status_verificationStatus_idx" ON "restaurants"("status", "verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "cuisines_name_key" ON "cuisines"("name");

-- CreateIndex
CREATE UNIQUE INDEX "cuisines_slug_key" ON "cuisines"("slug");

-- CreateIndex
CREATE INDEX "branches_restaurantId_idx" ON "branches"("restaurantId");

-- CreateIndex
CREATE INDEX "branches_latitude_longitude_idx" ON "branches"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "branch_operating_hours_branchId_dayOfWeek_idx" ON "branch_operating_hours"("branchId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "atmosphere_tags_name_key" ON "atmosphere_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "atmosphere_tags_slug_key" ON "atmosphere_tags"("slug");

-- CreateIndex
CREATE INDEX "menus_restaurantId_idx" ON "menus"("restaurantId");

-- CreateIndex
CREATE INDEX "menus_branchId_idx" ON "menus"("branchId");

-- CreateIndex
CREATE INDEX "dishes_menuId_idx" ON "dishes"("menuId");

-- CreateIndex
CREATE INDEX "dishes_status_price_idx" ON "dishes"("status", "price");

-- CreateIndex
CREATE UNIQUE INDEX "dish_categories_name_key" ON "dish_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "dish_categories_slug_key" ON "dish_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "dish_attributes_dishId_key" ON "dish_attributes"("dishId");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_name_key" ON "ingredients"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_slug_key" ON "ingredients"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "food_tags_name_key" ON "food_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "food_tags_slug_key" ON "food_tags"("slug");

-- CreateIndex
CREATE INDEX "dish_price_history_dishId_effectiveFrom_idx" ON "dish_price_history"("dishId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "user_preference_profiles" ADD CONSTRAINT "user_preference_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "dishes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_cuisines" ADD CONSTRAINT "restaurant_cuisines_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_cuisines" ADD CONSTRAINT "restaurant_cuisines_cuisineId_fkey" FOREIGN KEY ("cuisineId") REFERENCES "cuisines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_operating_hours" ADD CONSTRAINT "branch_operating_hours_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_atmospheres" ADD CONSTRAINT "branch_atmospheres_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_atmospheres" ADD CONSTRAINT "branch_atmospheres_atmosphereTagId_fkey" FOREIGN KEY ("atmosphereTagId") REFERENCES "atmosphere_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_category_assignments" ADD CONSTRAINT "dish_category_assignments_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_category_assignments" ADD CONSTRAINT "dish_category_assignments_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "dish_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_attributes" ADD CONSTRAINT "dish_attributes_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_tags" ADD CONSTRAINT "dish_tags_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_tags" ADD CONSTRAINT "dish_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "food_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_price_history" ADD CONSTRAINT "dish_price_history_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

