import request from 'supertest';
import { app } from '../src/index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Authorization Integration Tests', () => {
  let tokenCR1: string;
  let dsa1ScheduleId: string;
  let dsa2ScheduleId: string;
  let ffsd1ScheduleId: string;

  beforeAll(async () => {
    await prisma.$connect();

    // Log in as cr_ug1_1 to get a valid token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'cr_ug1_1', password: 'password123' });
    
    expect(loginRes.status).toBe(200);
    tokenCR1 = loginRes.body.token;
    expect(tokenCR1).toBeDefined();

    // Fetch schedules needed for testing authorization rules
    // DSA1 is batch UG1, section 1
    const dsa1 = await prisma.schedule.findFirst({
      where: { course: 'DSA', section: 1 }
    });
    if (!dsa1) throw new Error('DSA1 schedule not found in database');
    dsa1ScheduleId = dsa1.id;

    // DSA2 is batch UG1, section 2
    const dsa2 = await prisma.schedule.findFirst({
      where: { course: 'DSA', section: 2 }
    });
    if (!dsa2) throw new Error('DSA2 schedule not found in database');
    dsa2ScheduleId = dsa2.id;

    // FFSD1 is batch UG2, section 1
    const ffsd1 = await prisma.schedule.findFirst({
      where: { course: 'FFSD', section: 1 }
    });
    if (!ffsd1) throw new Error('FFSD1 schedule not found in database');
    ffsd1ScheduleId = ffsd1.id;
  });

  afterAll(async () => {
    // Clear any overrides created during testing to keep tests clean
    await prisma.override.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.override.deleteMany();
  });

  test('Test Case 1: cr_ug1_1 tries modifying DSA1 (Success)', async () => {
    // cr_ug1_1 belongs to UG1 Section 1, and DSA1 is UG1 Section 1.
    const res = await request(app)
      .post('/api/override/cancel')
      .set('Authorization', `Bearer ${tokenCR1}`)
      .send({
        scheduleId: dsa1ScheduleId,
        date: '2026-05-25'
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toContain('Class cancelled successfully');

    // Double check override was inserted in database
    const dbOverride = await prisma.override.findFirst({
      where: { scheduleId: dsa1ScheduleId, date: '2026-05-25' }
    });
    expect(dbOverride).not.toBeNull();
    expect(dbOverride?.type).toBe('CANCELLED');
  });

  test('Test Case 2: cr_ug1_1 tries modifying DSA2 (403 Forbidden)', async () => {
    // cr_ug1_1 belongs to Section 1, DSA2 is Section 2. Mismatch!
    const res = await request(app)
      .post('/api/override/cancel')
      .set('Authorization', `Bearer ${tokenCR1}`)
      .send({
        scheduleId: dsa2ScheduleId,
        date: '2026-05-25'
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('CR authorization failed');
  });

  test('Test Case 3: cr_ug1_1 tries modifying FFSD1 (403 Forbidden)', async () => {
    // cr_ug1_1 belongs to UG1, FFSD1 is UG2. Mismatch!
    const res = await request(app)
      .post('/api/override/cancel')
      .set('Authorization', `Bearer ${tokenCR1}`)
      .send({
        scheduleId: ffsd1ScheduleId,
        date: '2026-05-25'
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('CR authorization failed');
  });

  test('Test Case 4: JWT missing (401 Unauthorized)', async () => {
    const res = await request(app)
      .post('/api/override/cancel')
      .send({
        scheduleId: dsa1ScheduleId,
        date: '2026-05-25'
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Access token missing or invalid');
  });
});
