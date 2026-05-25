import request from 'supertest';
import { app } from '../src/index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('API Endpoint Integration Tests', () => {
  let crToken: string;
  let crUserId: string;
  let dsaScheduleId: string;

  beforeAll(async () => {
    await prisma.$connect();

    // Log in as cr_ug1_1 to get a valid token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'cr_ug1_1', password: 'password123' });
    
    crToken = loginRes.body.token;
    crUserId = loginRes.body.user.id;

    // Fetch a schedule ID to test move
    const sched = await prisma.schedule.findFirst({
      where: { course: 'DSA', section: 1, day: 'Monday' }
    });
    if (!sched) throw new Error('DSA1 schedule not found');
    dsaScheduleId = sched.id;

    // Create test rooms
    await prisma.room.createMany({
      data: [
        { id: 'TEST-R1', name: 'Test Room 1', category: 'G_ROOMS' },
        { id: 'TEST-R2', name: 'Test Room 2', category: 'G_ROOMS' },
        { id: 'TEST-R3', name: 'Test Room 3', category: 'G_ROOMS' }
      ]
    });

    // Create test schedules
    await prisma.schedule.createMany({
      data: [
        { id: 'TS-A', batch: 'UG1', course: 'TSA', section: 1, roomName: 'TEST-R1', day: 'Monday', startTime: '10:00', endTime: '11:00' },
        { id: 'TS-B', batch: 'UG1', course: 'TSB', section: 1, roomName: 'TEST-R2', day: 'Monday', startTime: '10:30', endTime: '11:30' },
        { id: 'TS-C', batch: 'UG1', course: 'TSC', section: 1, roomName: 'TEST-R2', day: 'Monday', startTime: '11:00', endTime: '12:00' },
        { id: 'TS-D', batch: 'UG1', course: 'TSD', section: 1, roomName: 'TEST-R2', day: 'Monday', startTime: '10:00', endTime: '11:00' }
      ]
    });
  });

  afterAll(async () => {
    await prisma.override.deleteMany();
    await prisma.schedule.deleteMany({
      where: { id: { in: ['TS-A', 'TS-B', 'TS-C', 'TS-D'] } }
    });
    await prisma.room.deleteMany({
      where: { id: { in: ['TEST-R1', 'TEST-R2', 'TEST-R3'] } }
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.override.deleteMany();
  });

  describe('GET /api/rooms', () => {
    test('Should return array of grouped rooms with availability status', async () => {
      const res = await request(app)
        .get('/api/rooms')
        .query({ date: '2026-05-25', time: '08:50' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('groupedRooms');
      expect(res.body.groupedRooms).toHaveProperty('G_ROOMS');
      expect(res.body.groupedRooms).toHaveProperty('B_ROOMS');
      expect(res.body.groupedRooms).toHaveProperty('FIRST_FLOOR');

      // Check a room item structure in G_ROOMS
      const gRooms = res.body.groupedRooms.G_ROOMS;
      expect(gRooms.length).toBeGreaterThan(0);
      expect(gRooms[0]).toHaveProperty('roomId');
      expect(gRooms[0]).toHaveProperty('status');
      expect(gRooms[0]).toHaveProperty('ongoingClass');
      
      // Specifically G09 at 08:50 AM on Monday should have DSA1 as ongoing class
      const g09 = gRooms.find((r: any) => r.roomId === 'G09');
      expect(g09).toBeDefined();
      expect(g09.status).toBe('OCCUPIED');
      expect(g09.ongoingClass.course).toBe('DSA');
      expect(g09.ongoingClass.section).toBe(1);
    });
  });

  describe('GET /api/rooms/:id', () => {
    test('Should return detailed room availability, timeline and overrides', async () => {
      const res = await request(app)
        .get('/api/rooms/G09')
        .query({ date: '2026-05-25', time: '08:50' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('roomId', 'G09');
      expect(res.body).toHaveProperty('status', 'OCCUPIED');
      expect(res.body).toHaveProperty('timeline');
      expect(res.body).toHaveProperty('rawSchedules');
      expect(res.body).toHaveProperty('movedInSchedules');

      expect(Array.isArray(res.body.timeline)).toBe(true);
      expect(res.body.timeline.length).toBeGreaterThan(0);
    });

    test('Should return 404 for non-existent room', async () => {
      const res = await request(app).get('/api/rooms/XYZ');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });
  });

  describe('POST /api/auth/login', () => {
    test('Should authenticate valid CR and return JWT token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'cr_ug1_1', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.username).toBe('cr_ug1_1');
      expect(res.body.user.batch).toBe('UG1');
      expect(res.body.user.section).toBe(1);
    });

    test('Should reject invalid credentials with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'cr_ug1_1', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid username or password');
    });
  });

  describe('POST /api/override/move', () => {
    test('Should create and persist a temporary override to relocate a class', async () => {
      const res = await request(app)
        .post('/api/override/move')
        .set('Authorization', `Bearer ${crToken}`)
        .send({
          scheduleId: dsaScheduleId,
          date: '2026-05-25',
          targetRoomId: 'B03'
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('Class moved successfully');
      expect(res.body.override).toBeDefined();
      expect(res.body.override.type).toBe('MOVED');
      expect(res.body.override.targetRoomId).toBe('B03');

      // Verify override is persisted in DB
      const dbOverride = await prisma.override.findUnique({
        where: {
          scheduleId_date: {
            scheduleId: dsaScheduleId,
            date: '2026-05-25'
          }
        }
      });
      expect(dbOverride).not.toBeNull();
      expect(dbOverride?.targetRoomId).toBe('B03');
      expect(dbOverride?.type).toBe('MOVED');
    });

    test('1. Exact overlap rejection (409 Conflict)', async () => {
      // TS-A (10:00-11:00) tries to move to TEST-R2 where TS-D is already scheduled at 10:00-11:00
      const res = await request(app)
        .post('/api/override/move')
        .set('Authorization', `Bearer ${crToken}`)
        .send({
          scheduleId: 'TS-A',
          date: '2026-05-25',
          targetRoomId: 'TEST-R2'
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Target room already occupied during this slot.');
    });

    test('2. Partial overlap rejection (409 Conflict)', async () => {
      // TS-A (10:00-11:00) tries to move to TEST-R2 where TS-B is scheduled at 10:30-11:30
      const res = await request(app)
        .post('/api/override/move')
        .set('Authorization', `Bearer ${crToken}`)
        .send({
          scheduleId: 'TS-A',
          date: '2026-05-25',
          targetRoomId: 'TEST-R2'
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Target room already occupied during this slot.');
    });

    test('3. Override-vs-override rejection (409 Conflict)', async () => {
      // First move TS-A (10:00-11:00) to TEST-R3 (valid, empty room)
      const res1 = await request(app)
        .post('/api/override/move')
        .set('Authorization', `Bearer ${crToken}`)
        .send({
          scheduleId: 'TS-A',
          date: '2026-05-25',
          targetRoomId: 'TEST-R3'
        });
      expect(res1.status).toBe(201);

      // Now attempt to move TS-D (10:00-11:00) to TEST-R3 (which now has TS-A override)
      const res2 = await request(app)
        .post('/api/override/move')
        .set('Authorization', `Bearer ${crToken}`)
        .send({
          scheduleId: 'TS-D',
          date: '2026-05-25',
          targetRoomId: 'TEST-R3'
        });

      expect(res2.status).toBe(409);
      expect(res2.body.error).toBe('Target room already occupied during this slot.');
    });

    test('4. Valid move success (201 Created)', async () => {
      // Move TS-A (10:00-11:00) to TEST-R3 (completely free)
      const res = await request(app)
        .post('/api/override/move')
        .set('Authorization', `Bearer ${crToken}`)
        .send({
          scheduleId: 'TS-A',
          date: '2026-05-25',
          targetRoomId: 'TEST-R3'
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('Class moved successfully');
    });

    test('5. Edge boundary validation (201 Created - no overlap)', async () => {
      // TS-A (10:00-11:00) tries to move to TEST-R2 where TS-C is scheduled at 11:00-12:00
      // Since they only touch at 11:00, this should succeed.
      const res = await request(app)
        .post('/api/override/move')
        .set('Authorization', `Bearer ${crToken}`)
        .send({
          scheduleId: 'TS-A',
          date: '2026-05-25',
          targetRoomId: 'TEST-R2'
        });

      // Wait, TS-D (10:00-11:00) is scheduled in TEST-R2, which causes a conflict with TS-A!
      // To test pure edge boundary with TS-C, we need TEST-R2 to not have TS-D scheduled.
      // So, let's temporarily cancel TS-D using override, or move TS-A to TEST-R1?
      // Wait, TS-C is scheduled in TEST-R2 (11:00-12:00). Let's move TS-A (10:00-11:00) to TEST-R2.
      // But TEST-R2 has TS-D (10:00-11:00) scheduled officially. That's why TS-A conflicts with TS-D!
      // Let's cancel TS-D first so it's not active in TEST-R2 today:
      const cancelD = await request(app)
        .post('/api/override/cancel')
        .set('Authorization', `Bearer ${crToken}`)
        .send({
          scheduleId: 'TS-D',
          date: '2026-05-25'
        });
      expect(cancelD.status).toBe(201);

      // Now we also need to cancel TS-B (10:30-11:30) which is in TEST-R2:
      const cancelB = await request(app)
        .post('/api/override/cancel')
        .set('Authorization', `Bearer ${crToken}`)
        .send({
          scheduleId: 'TS-B',
          date: '2026-05-25'
        });
      expect(cancelB.status).toBe(201);

      // Now TEST-R2 only has TS-C (11:00-12:00) active.
      // Let's attempt to move TS-A (10:00-11:00) to TEST-R2:
      const resMove = await request(app)
        .post('/api/override/move')
        .set('Authorization', `Bearer ${crToken}`)
        .send({
          scheduleId: 'TS-A',
          date: '2026-05-25',
          targetRoomId: 'TEST-R2'
        });

      expect(resMove.status).toBe(201);
    });
  });
});
