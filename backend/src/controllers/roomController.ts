import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { calculateRoomStatus } from '../services/availabilityEngine';

// Overload getISTDateTime implementation if not exported from service
// We can define it here or in a separate file. Let's make sure it's available.
export function getCurrentISTTime() {
  const d = new Date();
  // IST is UTC + 5:30.
  // A clean way to calculate:
  const tzOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(d.getTime() + tzOffset);
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const date = String(istTime.getUTCDate()).padStart(2, '0');
  const hours = String(istTime.getUTCHours()).padStart(2, '0');
  const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');

  return {
    dateStr: `${year}-${month}-${date}`,
    timeStr: `${hours}:${minutes}`
  };
}

const prisma = new PrismaClient();

export async function getAllRooms(req: Request, res: Response) {
  const { date, time } = req.query;

  // Use provided date/time or default to current IST time
  const { dateStr, timeStr } = getCurrentISTTime();
  const targetDate = (date as string) || dateStr;
  const targetTime = (time as string) || timeStr;

  try {
    const rooms = await prisma.room.findMany();

    const roomStatusPromises = rooms.map(room =>
      calculateRoomStatus(room.id, room.name, room.category, targetDate, targetTime)
    );

    const roomStatuses = await Promise.all(roomStatusPromises);

    // Sorting logic:
    // 1. FREE rooms first, sorted by free duration (descending - longest free first)
    // 2. OCCUPIED rooms second, sorted by occupied until time (ascending - gets free soonest)
    const sortRooms = (list: typeof roomStatuses) => {
      return list.sort((a, b) => {
        if (a.status === 'FREE' && b.status === 'OCCUPIED') return -1;
        if (a.status === 'OCCUPIED' && b.status === 'FREE') return 1;

        if (a.status === 'FREE' && b.status === 'FREE') {
          // Longest free duration first
          return (b.freeDurationMinutes || 0) - (a.freeDurationMinutes || 0);
        }

        // Occupied: return the one that gets free earliest
        const aUntil = a.ongoingClass?.endTime || '24:00';
        const bUntil = b.ongoingClass?.endTime || '24:00';
        return aUntil.localeCompare(bUntil);
      });
    };

    const groupedRooms = {
      G_ROOMS: sortRooms(roomStatuses.filter(r => r.category === 'G_ROOMS')),
      B_ROOMS: sortRooms(roomStatuses.filter(r => r.category === 'B_ROOMS')),
      FIRST_FLOOR: sortRooms(roomStatuses.filter(r => r.category === 'FIRST_FLOOR'))
    };

    return res.json({
      targetDate,
      targetTime,
      groupedRooms
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return res.status(500).json({ error: 'Failed to fetch rooms and availability data' });
  }
}

export async function getRoomById(req: Request, res: Response) {
  const { id } = req.params;
  const { date, time } = req.query;

  const { dateStr, timeStr } = getCurrentISTTime();
  const targetDate = (date as string) || dateStr;
  const targetTime = (time as string) || timeStr;

  try {
    const room = await prisma.room.findUnique({
      where: { id: id.toUpperCase() }
    });

    if (!room) {
      return res.status(404).json({ error: `Room ${id} not found` });
    }

    const roomStatus = await calculateRoomStatus(
      room.id,
      room.name,
      room.category,
      targetDate,
      targetTime
    );

    // Fetch official schedules of the room to return complete database IDs
    // and metadata for CR Overrides verification
    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(targetDate));
    
    const schedules = await prisma.schedule.findMany({
      where: {
        roomName: room.id,
        day: dayName
      },
      include: {
        overrides: {
          where: {
            date: targetDate
          }
        }
      }
    });

    // Also find schedules moved INTO this room today
    const movedInSchedules = await prisma.override.findMany({
      where: {
        date: targetDate,
        type: 'MOVED',
        targetRoomId: room.id
      },
      include: {
        schedule: true
      }
    });

    return res.json({
      ...roomStatus,
      rawSchedules: schedules,
      movedInSchedules
    });
  } catch (error) {
    console.error(`Error fetching details for room ${id}:`, error);
    return res.status(500).json({ error: 'Failed to fetch room details' });
  }
}

export async function getFreeRoomsNow(req: Request, res: Response) {
  const { date, time } = req.query;

  const { dateStr, timeStr } = getCurrentISTTime();
  const targetDate = (date as string) || dateStr;
  const targetTime = (time as string) || timeStr;

  try {
    const rooms = await prisma.room.findMany();

    const roomStatusPromises = rooms.map(room =>
      calculateRoomStatus(room.id, room.name, room.category, targetDate, targetTime)
    );

    const roomStatuses = await Promise.all(roomStatusPromises);
    const freeRooms = roomStatuses
      .filter(r => r.status === 'FREE')
      .sort((a, b) => (b.freeDurationMinutes || 0) - (a.freeDurationMinutes || 0));

    return res.json({
      targetDate,
      targetTime,
      freeRooms
    });
  } catch (error) {
    console.error('Error calculating free rooms:', error);
    return res.status(500).json({ error: 'Failed to fetch free rooms' });
  }
}
