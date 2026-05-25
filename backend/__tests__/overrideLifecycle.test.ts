import { PrismaClient } from '@prisma/client';
import { calculateRoomStatus } from '../src/services/availabilityEngine';

const prisma = new PrismaClient();

describe('Override Lifecycle Logic Tests', () => {
  let crUserId: string;
  let dsaScheduleId: string;

  beforeAll(async () => {
    await prisma.$connect();

    // Fetch the seeded UG1 Section 1 CR User
    const cr = await prisma.cRUser.findUnique({
      where: { username: 'cr_ug1_1' }
    });
    if (!cr) throw new Error('Seeded cr_ug1_1 not found');
    crUserId = cr.id;

    // Fetch the DSA1 schedule
    const sched = await prisma.schedule.findFirst({
      where: { course: 'DSA', section: 1, day: 'Monday' }
    });
    if (!sched) throw new Error('Seeded DSA1 schedule not found');
    dsaScheduleId = sched.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clear any overrides before each test
    await prisma.override.deleteMany();
  });

  afterEach(async () => {
    await prisma.override.deleteMany();
  });

  test('Test Case 1: Cancel DSA1 today and verify room G09 is FREE during that slot', async () => {
    // 1. Create a CANCELLED override for Monday (2026-05-25)
    await prisma.override.create({
      data: {
        type: 'CANCELLED',
        date: '2026-05-25',
        scheduleId: dsaScheduleId,
        originalRoomId: 'G09',
        crUserId: crUserId
      }
    });

    // 2. Query status for G09 at 08:50 AM (originally occupied by DSA1)
    const statusObj = await calculateRoomStatus(
      'G09',
      'G09 Classroom',
      'G_ROOMS',
      '2026-05-25',
      '08:50'
    );

    // 3. G09 should now be FREE because the class is cancelled
    expect(statusObj.status).toBe('FREE');
    expect(statusObj.ongoingClass).toBeNull();
  });

  test('Test Case 2: Redirect/Move DSA1 from G09 to B03 and verify timelines and statuses', async () => {
    // 1. Create a MOVED override to B03 for Monday (2026-05-25)
    await prisma.override.create({
      data: {
        type: 'MOVED',
        date: '2026-05-25',
        scheduleId: dsaScheduleId,
        originalRoomId: 'G09',
        targetRoomId: 'B03',
        crUserId: crUserId
      }
    });

    // 2. Query original room G09 at 08:50 AM
    const origStatus = await calculateRoomStatus(
      'G09',
      'G09 Classroom',
      'G_ROOMS',
      '2026-05-25',
      '08:50'
    );
    expect(origStatus.status).toBe('FREE'); // should be freed

    // 3. Query target room B03 at 08:50 AM
    const targetStatus = await calculateRoomStatus(
      'B03',
      'B03 Classroom',
      'B_ROOMS',
      '2026-05-25',
      '08:50'
    );

    // B03 should be occupied by DSA1 temporarily
    expect(targetStatus.status).toBe('OCCUPIED');
    expect(targetStatus.ongoingClass).not.toBeNull();
    expect(targetStatus.ongoingClass?.course).toBe('DSA');
    expect(targetStatus.ongoingClass?.section).toBe(1);
    expect(targetStatus.ongoingClass?.isMovedIn).toBe(true);

    // B03 timeline should display the class with isMovedIn true
    const activeSlot = targetStatus.timeline.find((slot) => slot.startTime === '08:45');
    expect(activeSlot).toBeDefined();
    expect(activeSlot?.status).toBe('OCCUPIED');
    expect(activeSlot?.label).toBe('DSA1');
    expect(activeSlot?.isMovedIn).toBe(true);
  });

  test('Test Case 3: Delete override and verify original schedules are restored', async () => {
    // 1. Create a CANCELLED override
    const override = await prisma.override.create({
      data: {
        type: 'CANCELLED',
        date: '2026-05-25',
        scheduleId: dsaScheduleId,
        originalRoomId: 'G09',
        crUserId: crUserId
      }
    });

    // Verify it is cancelled
    let statusObj = await calculateRoomStatus('G09', 'G09 Classroom', 'G_ROOMS', '2026-05-25', '08:50');
    expect(statusObj.status).toBe('FREE');

    // 2. Delete the override
    await prisma.override.delete({
      where: { id: override.id }
    });

    // 3. Verify original schedule is restored
    statusObj = await calculateRoomStatus('G09', 'G09 Classroom', 'G_ROOMS', '2026-05-25', '08:50');
    expect(statusObj.status).toBe('OCCUPIED');
    expect(statusObj.ongoingClass?.course).toBe('DSA');
  });
});
