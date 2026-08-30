import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.client.js';

describe('TasteMood API Integration Tests', () => {
  it('GET /api/v1/health returns healthy status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('healthy');
  });

  it('GET /api/v1/unknown-route returns standard 404 error format', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('POST /api/v1/recommendations rejects invalid request body', async () => {
    const res = await request(app)
      .post('/api/v1/recommendations')
      .send({ maxPrice: -50 }); // Negative maxPrice should fail Zod validation

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/recommendations executes successfully with valid payload', async () => {
    // Mock candidate dish from database
    vi.spyOn(prisma.dish, 'findMany').mockResolvedValueOnce([
      {
        id: 'test-dish-1',
        menuId: 'menu-1',
        name: 'Spicy Koshary',
        slug: 'spicy-koshary',
        description: 'Authentic spiced Egyptian dish',
        price: 120,
        currency: 'EGP',
        imageUrl: null,
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        lastVerifiedAt: new Date(),
        source: 'MANUAL',
        createdAt: new Date(),
        updatedAt: new Date(),
        attributes: {
          id: 'attr-1',
          dishId: 'test-dish-1',
          tasteAttributes: ['SPICY', 'SAVORY'],
          textures: ['crunchy'],
          mealCharacteristics: ['FILLING', 'LUNCH', 'DINNER'],
          dietaryProperties: ['VEGETARIAN', 'HALAL'],
        },
        categories: [],
        tags: [{ tag: { id: 't1', name: 'comfort-food', slug: 'comfort-food', description: null } }],
        ingredients: [],
        _count: { interactions: 10 },
        menu: {
          restaurant: {
            id: 'rest-1',
            name: 'Koshary Abou Tarek',
            priceRange: 'BUDGET',
            status: 'ACTIVE',
            verificationStatus: 'VERIFIED',
            cuisines: [{ cuisine: { id: 'c1', name: 'Egyptian', slug: 'egyptian', description: null, createdAt: new Date() } }],
            branches: [
              {
                id: 'b1',
                name: 'Downtown',
                address: 'Downtown, Cairo',
                latitude: 30.05,
                longitude: 31.24,
                operatingHours: [],
                atmospheres: [],
              },
            ],
          },
        },
      },
    ] as any);

    const res = await request(app)
      .post('/api/v1/recommendations')
      .send({
        query: 'I want something spicy under 250 EGP',
        limit: 3,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.request).toBeDefined();
    expect(res.body.data.interpretation).toBeDefined();
    expect(res.body.data.recommendations).toBeInstanceOf(Array);
    expect(res.body.data.recommendations.length).toBe(1);
    expect(res.body.data.recommendations[0].dish.name).toBe('Spicy Koshary');
  });

  it('Protected endpoint rejects request without Authorization header', async () => {
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('Admin endpoint rejects non-admin users', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', 'Bearer mock-user-regular');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
