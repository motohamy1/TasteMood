import { PrismaClient } from '@prisma/client';
import { GOVERNORATES, GOVERNORATE_CITIES } from '../src/importer/geography.js';
import { CUISINES } from '../src/importer/taxonomy.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding TasteMood database with demo Egyptian culinary data...');

  // 1. Clean existing records in correct foreign key order
  await prisma.dishPriceHistory.deleteMany();
  await prisma.dishTag.deleteMany();
  await prisma.dishIngredient.deleteMany();
  await prisma.dishCategoryAssignment.deleteMany();
  await prisma.dishAttribute.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.menu.deleteMany();
  await prisma.branchAtmosphere.deleteMany();
  await prisma.branchOperatingHour.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.city.deleteMany();
  await prisma.governorate.deleteMany();
  await prisma.restaurantCuisine.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.cuisine.deleteMany();
  await prisma.dishCategory.deleteMany();
  await prisma.foodTag.deleteMany();
  await prisma.atmosphereTag.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.userInteraction.deleteMany();
  await prisma.userPreferenceProfile.deleteMany();
  await prisma.user.deleteMany();

  // 2. Seed Governorates & Cities
  for (const gov of GOVERNORATES) {
    await prisma.governorate.create({ data: gov });
  }
  for (const [govSlug, cities] of Object.entries(GOVERNORATE_CITIES)) {
    const governorate = await prisma.governorate.findUnique({ where: { slug: govSlug } });
    if (!governorate) continue;
    for (const city of cities) {
      await prisma.city.create({ data: { ...city, governorateId: governorate.id } });
    }
  }
  console.log(`Seeded ${GOVERNORATES.length} governorates with ${Object.values(GOVERNORATE_CITIES).flat().length} cities.`);

  // 3. Seed Cuisines (curated taxonomy shared with the importer)
  const cuisines: Record<string, any> = {};
  for (const c of CUISINES) {
    cuisines[c.slug] = await prisma.cuisine.create({ data: c });
  }

  // 3. Seed Dish Categories
  const categoriesData = [
    { name: 'Main Courses', slug: 'main-courses' },
    { name: 'Grills & Barbecue', slug: 'grills' },
    { name: 'Sandwiches & Burgers', slug: 'burgers-sandwiches' },
    { name: 'Pasta & Pizza', slug: 'pasta-pizza' },
    { name: 'Appetizers & Mezze', slug: 'appetizers' },
    { name: 'Desserts', slug: 'desserts' },
    { name: 'Specialty Coffee & Beverages', slug: 'beverages' },
    { name: 'Healthy Bowls & Salads', slug: 'salads-bowls' },
  ];

  const categories: Record<string, any> = {};
  for (const cat of categoriesData) {
    categories[cat.slug] = await prisma.dishCategory.create({ data: cat });
  }

  // 4. Seed Atmosphere Tags
  const atmosphereData = [
    { name: 'Quiet & Calm', slug: 'quiet' },
    { name: 'Casual Dining', slug: 'casual' },
    { name: 'Study & Work Friendly', slug: 'study-friendly' },
    { name: 'Romantic & Date Night', slug: 'romantic' },
    { name: 'Outdoor Seating', slug: 'outdoor-seating' },
    { name: 'Family Friendly', slug: 'family-friendly' },
    { name: 'Vibrant & Lively', slug: 'vibrant' },
  ];

  const atmospheres: Record<string, any> = {};
  for (const a of atmosphereData) {
    atmospheres[a.slug] = await prisma.atmosphereTag.create({ data: a });
  }

  // 5. Seed Food Tags
  const foodTagsData = [
    { name: 'Comfort Food', slug: 'comfort-food' },
    { name: 'Budget Friendly', slug: 'budget-friendly' },
    { name: 'Late Night', slug: 'late-night' },
    { name: 'Quick Bite', slug: 'quick-bite' },
    { name: 'Indulgent', slug: 'indulgent' },
    { name: 'Healthy', slug: 'healthy' },
    { name: 'Date Night', slug: 'date-night' },
    { name: 'Specialty Coffee', slug: 'specialty-coffee' },
    { name: 'Street Food', slug: 'street-food' },
  ];

  const tags: Record<string, any> = {};
  for (const t of foodTagsData) {
    tags[t.slug] = await prisma.foodTag.create({ data: t });
  }

  // 6. Seed Ingredients
  const ingredientsData = [
    { name: 'Chicken Breast', slug: 'chicken-breast' },
    { name: 'Minced Beef', slug: 'minced-beef' },
    { name: 'Rice', slug: 'rice' },
    { name: 'Lentils', slug: 'lentils' },
    { name: 'Garlic', slug: 'garlic' },
    { name: 'Onions', slug: 'onions' },
    { name: 'Tomato Sauce', slug: 'tomato-sauce' },
    { name: 'Truffle Oil', slug: 'truffle-oil' },
    { name: 'Mozzarella', slug: 'mozzarella' },
    { name: 'Parmesan', slug: 'parmesan' },
    { name: 'Cheddar Cheese', slug: 'cheddar' },
    { name: 'Tahini', slug: 'tahini' },
    { name: 'Chili Flakes', slug: 'chili-flakes' },
    { name: 'Espresso Beans', slug: 'espresso' },
    { name: 'Dark Chocolate', slug: 'dark-chocolate' },
    { name: 'Mushrooms', slug: 'mushrooms' },
  ];

  const ingredients: Record<string, any> = {};
  for (const i of ingredientsData) {
    ingredients[i.slug] = await prisma.ingredient.create({ data: i });
  }

  // 7. Seed Demo Users
  const adminUser = await prisma.user.create({
    data: {
      authUserId: 'mock-admin-01',
      email: 'admin@tastemood.app',
      displayName: 'System Admin',
      role: 'ADMIN',
      preferenceProfile: {
        create: {
          preferredCuisines: ['Egyptian', 'Italian'],
          spicePreference: 3,
        },
      },
    },
  });

  const demoUser = await prisma.user.create({
    data: {
      authUserId: 'mock-user-01',
      email: 'ahmed@tastemood.app',
      displayName: 'Ahmed E.',
      role: 'USER',
      preferenceProfile: {
        create: {
          preferredCuisines: ['Egyptian', 'American'],
          dislikedCuisines: ['Seafood'],
          dietaryRestrictions: ['HALAL'],
          spicePreference: 4,
          preferredMealTypes: ['DINNER', 'FILLING'],
          atmospherePreferences: ['casual', 'outdoor-seating'],
        },
      },
    },
  });

  console.log(`Created admin user (${adminUser.displayName}) and demo user (${demoUser.displayName})`);

  // Helper for operating hours (7 days open 10am to 1am)
  const defaultHours = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    dayOfWeek: day,
    openTime: '10:00',
    closeTime: '01:00',
    isClosed: false,
    isSplitShift: false,
  }));

  // 8. Seed Realistic Demo Restaurants & Branches
  // -------------------------------------------------------------
  // Restaurant 1: Abou El Sid (Egyptian Heritage Dining)
  // -------------------------------------------------------------
  const abouElSid = await prisma.restaurant.create({
    data: {
      name: 'Abou El Sid',
      slug: 'abou-el-sid',
      description: 'Authentic rich Egyptian heritage dining with classic flavors in an oriental ambiance.',
      priceRange: 'MODERATE',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: new Date(),
      cuisines: {
        create: [{ cuisineId: cuisines['egyptian'].id }],
      },
      branches: {
        create: [
          {
            name: 'Zamalek Branch',
            address: '157 26th of July St, Zamalek, Cairo',
            latitude: 30.0609,
            longitude: 31.2197,
            phone: '+20227359640',
            status: 'ACTIVE',
            verificationStatus: 'VERIFIED',
            operatingHours: { create: defaultHours },
            atmospheres: {
              create: [
                { atmosphereTagId: atmospheres['romantic'].id },
                { atmosphereTagId: atmospheres['casual'].id },
              ],
            },
          },
          {
            name: 'New Cairo 5th Settlement',
            address: 'Downtown Mall, Road 90, New Cairo',
            latitude: 30.0185,
            longitude: 31.4289,
            phone: '+20122212345',
            status: 'ACTIVE',
            verificationStatus: 'VERIFIED',
            operatingHours: { create: defaultHours },
            atmospheres: {
              create: [
                { atmosphereTagId: atmospheres['outdoor-seating'].id },
                { atmosphereTagId: atmospheres['family-friendly'].id },
              ],
            },
          },
        ],
      },
    },
  });

  const abouElSidMenu = await prisma.menu.create({
    data: {
      restaurantId: abouElSid.id,
      name: 'Main Heritage Menu',
      description: 'Signature Egyptian dishes',
    },
  });

  // Dishes for Abou El Sid
  await prisma.dish.create({
    data: {
      menuId: abouElSidMenu.id,
      name: 'Koshary Abou El Sid Special',
      slug: 'koshary-abou-el-sid-special',
      description: 'Layered spiced lentils, rice, pasta topped with crispy caramelized onions and fiery dakka sauce.',
      price: 135,
      currency: 'EGP',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      categories: { create: [{ categoryId: categories['main-courses'].id }] },
      tags: {
        create: [
          { tagId: tags['comfort-food'].id },
          { tagId: tags['budget-friendly'].id },
        ],
      },
      ingredients: {
        create: [
          { ingredientId: ingredients['rice'].id },
          { ingredientId: ingredients['lentils'].id },
          { ingredientId: ingredients['onions'].id },
          { ingredientId: ingredients['tomato-sauce'].id },
          { ingredientId: ingredients['chili-flakes'].id },
        ],
      },
      attributes: {
        create: {
          tasteAttributes: ['SPICY', 'SAVORY', 'RICH'],
          textures: ['crunchy', 'soft'],
          mealCharacteristics: ['FILLING', 'LUNCH', 'DINNER'],
          dietaryProperties: ['VEGETARIAN', 'VEGAN', 'HALAL'],
        },
      },
      priceHistory: { create: { price: 135, currency: 'EGP' } },
    },
  });

  await prisma.dish.create({
    data: {
      menuId: abouElSidMenu.id,
      name: 'Stuffed Pigeon (Hamam Mahshi)',
      slug: 'stuffed-pigeon-hamam-mahshi',
      description: 'Tender pigeon stuffed with aromatic seasoned cracked wheat (freekeh), roasted to golden perfection.',
      price: 240,
      currency: 'EGP',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      categories: { create: [{ categoryId: categories['grills'].id }] },
      tags: {
        create: [
          { tagId: tags['comfort-food'].id },
          { tagId: tags['indulgent'].id },
        ],
      },
      ingredients: {
        create: [
          { ingredientId: ingredients['onions'].id },
          { ingredientId: ingredients['garlic'].id },
        ],
      },
      attributes: {
        create: {
          tasteAttributes: ['SAVORY', 'RICH'],
          textures: ['crispy', 'tender'],
          mealCharacteristics: ['FILLING', 'DINNER'],
          dietaryProperties: ['HALAL'],
        },
      },
      priceHistory: { create: { price: 240, currency: 'EGP' } },
    },
  });

  await prisma.dish.create({
    data: {
      menuId: abouElSidMenu.id,
      name: 'Molokhia with Roasted Half Chicken',
      slug: 'molokhia-roasted-chicken',
      description: 'Rich velvety green jute leaf stew scented with sizzling garlic and coriander takleya, served with Egyptian rice.',
      price: 195,
      currency: 'EGP',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      categories: { create: [{ categoryId: categories['main-courses'].id }] },
      tags: {
        create: [{ tagId: tags['comfort-food'].id }],
      },
      ingredients: {
        create: [
          { ingredientId: ingredients['chicken-breast'].id },
          { ingredientId: ingredients['garlic'].id },
          { ingredientId: ingredients['rice'].id },
        ],
      },
      attributes: {
        create: {
          tasteAttributes: ['SAVORY', 'RICH'],
          textures: ['smooth', 'tender'],
          mealCharacteristics: ['FILLING', 'DINNER', 'LUNCH'],
          dietaryProperties: ['HALAL', 'GLUTEN_FREE'],
        },
      },
      priceHistory: { create: { price: 195, currency: 'EGP' } },
    },
  });

  // -------------------------------------------------------------
  // Restaurant 2: Butcher's Burger (Gourmet Burgers)
  // -------------------------------------------------------------
  const butchersBurger = await prisma.restaurant.create({
    data: {
      name: "Butcher's Burger",
      slug: 'butchers-burger',
      description: 'Juicy smashed and prime beef burgers crafted with premium sauces in a casual energetic setting.',
      priceRange: 'MODERATE',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      cuisines: {
        create: [{ cuisineId: cuisines['american'].id }],
      },
      branches: {
        create: [
          {
            name: 'Maadi Branch',
            address: 'Degla, Street 218, Maadi, Cairo',
            latitude: 29.9602,
            longitude: 31.2825,
            phone: '+20100998877',
            status: 'ACTIVE',
            verificationStatus: 'VERIFIED',
            operatingHours: { create: defaultHours },
            atmospheres: {
              create: [
                { atmosphereTagId: atmospheres['casual'].id },
                { atmosphereTagId: atmospheres['outdoor-seating'].id },
              ],
            },
          },
          {
            name: 'Heliopolis Branch',
            address: 'Orouba St, Heliopolis, Cairo',
            latitude: 30.0911,
            longitude: 31.3344,
            phone: '+20100998878',
            status: 'ACTIVE',
            verificationStatus: 'VERIFIED',
            operatingHours: { create: defaultHours },
            atmospheres: {
              create: [
                { atmosphereTagId: atmospheres['casual'].id },
                { atmosphereTagId: atmospheres['vibrant'].id },
              ],
            },
          },
        ],
      },
    },
  });

  const burgerMenu = await prisma.menu.create({
    data: {
      restaurantId: butchersBurger.id,
      name: 'Burger & Sides Menu',
    },
  });

  await prisma.dish.create({
    data: {
      menuId: burgerMenu.id,
      name: 'Spicy Volcano Double Smash Burger',
      slug: 'spicy-volcano-double-smash-burger',
      description: 'Double beef smash patties, molten aged cheddar, pickled jalapeños, and fiery ghost pepper aioli.',
      price: 210,
      currency: 'EGP',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      categories: { create: [{ categoryId: categories['burgers-sandwiches'].id }] },
      tags: {
        create: [
          { tagId: tags['late-night'].id },
          { tagId: tags['indulgent'].id },
        ],
      },
      ingredients: {
        create: [
          { ingredientId: ingredients['minced-beef'].id },
          { ingredientId: ingredients['cheddar'].id },
          { ingredientId: ingredients['chili-flakes'].id },
        ],
      },
      attributes: {
        create: {
          tasteAttributes: ['SPICY', 'SAVORY', 'RICH', 'CREAMY'],
          textures: ['crispy', 'juicy'],
          mealCharacteristics: ['HEAVY', 'FILLING', 'DINNER'],
          dietaryProperties: ['HALAL'],
        },
      },
      priceHistory: { create: { price: 210, currency: 'EGP' } },
    },
  });

  await prisma.dish.create({
    data: {
      menuId: burgerMenu.id,
      name: 'Truffle Mushroom Swiss Burger',
      slug: 'truffle-mushroom-swiss-burger',
      description: 'Flame-grilled prime beef patty topped with sautéed wild mushrooms, melted Swiss cheese, and black truffle mayo.',
      price: 235,
      currency: 'EGP',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      categories: { create: [{ categoryId: categories['burgers-sandwiches'].id }] },
      tags: {
        create: [
          { tagId: tags['date-night'].id },
          { tagId: tags['indulgent'].id },
        ],
      },
      ingredients: {
        create: [
          { ingredientId: ingredients['minced-beef'].id },
          { ingredientId: ingredients['mushrooms'].id },
          { ingredientId: ingredients['truffle-oil'].id },
        ],
      },
      attributes: {
        create: {
          tasteAttributes: ['SAVORY', 'RICH', 'CREAMY'],
          textures: ['soft', 'juicy'],
          mealCharacteristics: ['FILLING', 'DINNER'],
          dietaryProperties: ['HALAL'],
        },
      },
      priceHistory: { create: { price: 235, currency: 'EGP' } },
    },
  });

  // -------------------------------------------------------------
  // Restaurant 3: Il Mulino Bakery & Trattoria (Italian & Café)
  // -------------------------------------------------------------
  const ilMulino = await prisma.restaurant.create({
    data: {
      name: 'Il Mulino Bakery & Trattoria',
      slug: 'il-mulino',
      description: 'Artisanal Italian sourdough pizza, fresh pasta, and serene specialty coffee café.',
      priceRange: 'MODERATE',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      cuisines: {
        create: [
          { cuisineId: cuisines['italian'].id },
          { cuisineId: cuisines['cafe-bakery'].id },
        ],
      },
      branches: {
        create: [
          {
            name: 'Maadi Quiet Patio',
            address: 'Road 9, Maadi, Cairo',
            latitude: 29.9595,
            longitude: 31.2612,
            phone: '+20223594020',
            status: 'ACTIVE',
            verificationStatus: 'VERIFIED',
            operatingHours: {
              create: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
                dayOfWeek: day,
                openTime: '08:00',
                closeTime: '23:30',
                isClosed: false,
                isSplitShift: false,
              })),
            },
            atmospheres: {
              create: [
                { atmosphereTagId: atmospheres['quiet'].id },
                { atmosphereTagId: atmospheres['study-friendly'].id },
                { atmosphereTagId: atmospheres['outdoor-seating'].id },
              ],
            },
          },
        ],
      },
    },
  });

  const ilMulinoMenu = await prisma.menu.create({
    data: {
      restaurantId: ilMulino.id,
      name: 'Trattoria & Café Menu',
    },
  });

  await prisma.dish.create({
    data: {
      menuId: ilMulinoMenu.id,
      name: 'Truffle & Wild Mushroom Fettuccine',
      slug: 'truffle-mushroom-fettuccine',
      description: 'Fresh handmade pasta ribbons tossed in a velvety black truffle cream sauce with aged Parmigiano Reggiano.',
      price: 220,
      currency: 'EGP',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      categories: { create: [{ categoryId: categories['pasta-pizza'].id }] },
      tags: {
        create: [
          { tagId: tags['comfort-food'].id },
          { tagId: tags['date-night'].id },
        ],
      },
      ingredients: {
        create: [
          { ingredientId: ingredients['mushrooms'].id },
          { ingredientId: ingredients['parmesan'].id },
          { ingredientId: ingredients['truffle-oil'].id },
        ],
      },
      attributes: {
        create: {
          tasteAttributes: ['SAVORY', 'CREAMY', 'RICH'],
          textures: ['creamy', 'soft'],
          mealCharacteristics: ['FILLING', 'DINNER', 'LUNCH'],
          dietaryProperties: ['VEGETARIAN', 'HALAL'],
        },
      },
      priceHistory: { create: { price: 220, currency: 'EGP' } },
    },
  });

  await prisma.dish.create({
    data: {
      menuId: ilMulinoMenu.id,
      name: 'Iced Spanish Latte & Tiramisu Cup',
      slug: 'spanish-latte-tiramisu',
      description: 'Double shot specialty espresso with condensed milk served alongside traditional mascarpone cocoa tiramisu.',
      price: 145,
      currency: 'EGP',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      categories: {
        create: [
          { categoryId: categories['beverages'].id },
          { categoryId: categories['desserts'].id },
        ],
      },
      tags: {
        create: [
          { tagId: tags['specialty-coffee'].id },
          { tagId: tags['quick-bite'].id },
        ],
      },
      ingredients: {
        create: [
          { ingredientId: ingredients['espresso'].id },
          { ingredientId: ingredients['dark-chocolate'].id },
        ],
      },
      attributes: {
        create: {
          tasteAttributes: ['SWEET', 'CREAMY', 'REFRESHING'],
          textures: ['smooth', 'soft'],
          mealCharacteristics: ['DESSERT', 'BEVERAGE', 'SNACK', 'LIGHT'],
          dietaryProperties: ['VEGETARIAN', 'HALAL'],
        },
      },
      priceHistory: { create: { price: 145, currency: 'EGP' } },
    },
  });

  console.log('Seed completed successfully with 3 brands, 5 branches, and rich categorized dishes!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
