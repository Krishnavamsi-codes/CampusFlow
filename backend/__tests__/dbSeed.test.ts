import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Database Seed Verification Tests', () => {
  beforeAll(async () => {
    // Connect to test database URL env
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Verify all room groups are correctly seeded', async () => {
    const rooms = await prisma.room.findMany();
    const roomIds = rooms.map((r) => r.id);

    // G Rooms list
    const expectedGRooms = ['G04', 'G05', 'G06', 'G07', 'G08', 'G09'];
    expectedGRooms.forEach((r) => {
      expect(roomIds).toContain(r);
    });

    // B Rooms list
    const expectedBRooms = ['B03', 'B04', 'B05', 'B06'];
    expectedBRooms.forEach((r) => {
      expect(roomIds).toContain(r);
    });

    // First Floor list
    const expectedFirstFloor = [
      '101', '102', 'LAB-103', '104', '105', '106', '108', '109', '110', '111', '112', '114'
    ];
    expectedFirstFloor.forEach((r) => {
      expect(roomIds).toContain(r);
    });
  });

  test('Verify schedule entries exist in database', async () => {
    const scheduleCount = await prisma.schedule.count();
    expect(scheduleCount).toBeGreaterThan(0);

    // Verify a sample schedule mapping
    const sample = await prisma.schedule.findFirst({
      where: { course: 'DSA', section: 1 }
    });
    expect(sample).not.toBeNull();
    expect(sample?.roomName).toBe('G09');
  });

  test('Verify CR users exist in database', async () => {
    const crCount = await prisma.cRUser.count();
    expect(crCount).toBe(9); // we seed 9 CR accounts

    const cr1 = await prisma.cRUser.findUnique({
      where: { username: 'cr_ug1_1' }
    });
    expect(cr1).not.toBeNull();
    expect(cr1?.batch).toBe('UG1');
    expect(cr1?.section).toBe(1);
  });

  test('Verify overrides table initializes empty', async () => {
    const overrideCount = await prisma.override.count();
    expect(overrideCount).toBe(0);
  });
});
