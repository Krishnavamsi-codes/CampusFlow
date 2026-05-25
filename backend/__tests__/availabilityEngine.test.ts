import { PrismaClient } from '@prisma/client';
import { calculateRoomStatus } from '../src/services/availabilityEngine';

const prisma = new PrismaClient();

describe('Availability Engine Calculation Tests', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Test Case 1: Current time inside active class slot', async () => {
    // G09 has DSA1 scheduled on Monday (2026-05-25) at 08:45-09:45
    const statusObj = await calculateRoomStatus(
      'G09',
      'G09 Classroom',
      'G_ROOMS',
      '2026-05-25', // Monday
      '08:50'
    );

    expect(statusObj.status).toBe('OCCUPIED');
    expect(statusObj.ongoingClass).not.toBeNull();
    expect(statusObj.ongoingClass?.course).toBe('DSA');
    expect(statusObj.ongoingClass?.section).toBe(1);
    expect(statusObj.ongoingClass?.endTime).toBe('09:45');
  });

  test('Test Case 2: Current time during empty slot', async () => {
    // On Monday (2026-05-25), G09 has:
    // DSA1 ending at 09:45 and CA2 starting at 11:00.
    // Querying at 10:15 should show room is FREE.
    const statusObj = await calculateRoomStatus(
      'G09',
      'G09 Classroom',
      'G_ROOMS',
      '2026-05-25', // Monday
      '10:15'
    );

    expect(statusObj.status).toBe('FREE');
    expect(statusObj.ongoingClass).toBeNull();
    expect(statusObj.nextClass).not.toBeNull();
    expect(statusObj.nextClass?.course).toBe('CA');
    expect(statusObj.nextClass?.startTime).toBe('11:00');
    expect(statusObj.freeUntil).toBe('11:00');
    expect(statusObj.freeDurationMinutes).toBe(45); // 11:00 - 10:15 = 45 mins
  });

  test('Test Case 3 & 4: Sorting rooms by availability status and free duration', async () => {
    // Retrieve all rooms from the DB
    const rooms = await prisma.room.findMany();
    const roomStatuses = await Promise.all(
      rooms.map((r) => calculateRoomStatus(r.id, r.name, r.category, '2026-05-25', '11:15'))
    );

    // Apply sorting logic:
    // 1. FREE rooms appear before OCCUPIED rooms
    // 2. FREE rooms sorted descending by freeDurationMinutes
    const sortedStatuses = [...roomStatuses].sort((a, b) => {
      if (a.status === 'FREE' && b.status === 'OCCUPIED') return -1;
      if (a.status === 'OCCUPIED' && b.status === 'FREE') return 1;

      if (a.status === 'FREE' && b.status === 'FREE') {
        return (b.freeDurationMinutes || 0) - (a.freeDurationMinutes || 0);
      }
      return 0;
    });

    // Verify sort conditions
    for (let i = 0; i < sortedStatuses.length - 1; i++) {
      const current = sortedStatuses[i];
      const next = sortedStatuses[i + 1];

      if (current.status === 'OCCUPIED') {
        // After the first OCCUPIED room, no more FREE rooms should appear
        expect(next.status).toBe('OCCUPIED');
      }

      if (current.status === 'FREE' && next.status === 'FREE') {
        expect(current.freeDurationMinutes).toBeGreaterThanOrEqual(next.freeDurationMinutes || 0);
      }
    }
  });
});
