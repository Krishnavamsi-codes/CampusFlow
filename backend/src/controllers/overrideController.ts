import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';

const prisma = new PrismaClient();

let isLocked = false;
const queue: (() => void)[] = [];

async function acquireLock(): Promise<void> {
  if (!isLocked) {
    isLocked = true;
    return;
  }
  return new Promise<void>((resolve) => {
    queue.push(resolve);
  });
}

function releaseLock(): void {
  if (queue.length > 0) {
    const next = queue.shift();
    if (next) next();
  } else {
    isLocked = false;
  }
}

/**
 * Temporarily cancels a class for a specific date.
 */
export async function cancelClass(req: AuthenticatedRequest, res: Response) {
  const { scheduleId, date } = req.body;
  const user = req.user;

  if (!scheduleId || !date) {
    return res.status(400).json({ error: 'scheduleId and date (YYYY-MM-DD) are required' });
  }

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized CR action' });
  }

  await acquireLock();
  try {
    // 1. Fetch schedule
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId }
    });

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // 2. Validate CR ownership
    // Rules: CR.batch === schedule.batch AND CR.section === schedule.section
    if (user.batch !== schedule.batch || user.section !== schedule.section) {
      return res.status(403).json({
        error: `CR authorization failed. You can only modify classes for ${user.batch} Section ${user.section}. This class is for ${schedule.batch} Section ${schedule.section}.`
      });
    }

    // 3. Check if override already exists for this date
    const existingOverride = await prisma.override.findUnique({
      where: {
        scheduleId_date: {
          scheduleId,
          date
        }
      }
    });

    if (existingOverride) {
      // Update it to cancelled
      const updatedOverride = await prisma.override.update({
        where: { id: existingOverride.id },
        data: {
          type: 'CANCELLED',
          targetRoomId: null,
          crUserId: user.id
        }
      });
      return res.json({
        message: 'Class cancelled successfully (updated existing override)',
        override: updatedOverride
      });
    }

    // 4. Create new override
    const newOverride = await prisma.override.create({
      data: {
        type: 'CANCELLED',
        date,
        scheduleId,
        originalRoomId: schedule.roomName,
        crUserId: user.id
      }
    });

    return res.status(201).json({
      message: 'Class cancelled successfully',
      override: newOverride
    });
  } catch (error) {
    console.error('Error cancelling class:', error);
    return res.status(500).json({ error: 'Failed to cancel class' });
  } finally {
    releaseLock();
  }
}

/**
 * Temporarily moves a class to another room for a specific date.
 */
export async function moveClass(req: AuthenticatedRequest, res: Response) {
  const { scheduleId, date, targetRoomId } = req.body;
  const user = req.user;

  if (!scheduleId || !date || !targetRoomId) {
    return res.status(400).json({
      error: 'scheduleId, date (YYYY-MM-DD), and targetRoomId are required'
    });
  }

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized CR action' });
  }

  await acquireLock();
  try {
    // 1. Fetch schedule
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId }
    });

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // 2. Validate CR ownership
    if (user.batch !== schedule.batch || user.section !== schedule.section) {
      return res.status(403).json({
        error: `CR authorization failed. You can only modify classes for ${user.batch} Section ${user.section}. This class is for ${schedule.batch} Section ${schedule.section}.`
      });
    }

    // 3. Verify target room exists
    const targetRoom = await prisma.room.findUnique({
      where: { id: targetRoomId.toUpperCase() }
    });

    if (!targetRoom) {
      return res.status(404).json({ error: `Target room ${targetRoomId} does not exist` });
    }

    // 4. Check if target room is same as original room
    if (schedule.roomName === targetRoom.id) {
      return res.status(400).json({ error: 'Target room is the same as the current scheduled room' });
    }

    // 4.5. Check for schedule conflicts in the target room at the same time interval
    const [yr, mo, dy] = date.split('-').map(Number);
    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(yr, mo - 1, dy));

    // Find all schedules originally in the target room on this day of the week
    const targetRoomSchedules = await prisma.schedule.findMany({
      where: {
        roomName: targetRoom.id,
        day: dayName,
        id: { not: scheduleId }
      },
      include: {
        overrides: {
          where: { date }
        }
      }
    });

    // A schedule is active in the target room if it has no CANCELLED or MOVED override on this date
    const activeTargetRoomSchedules = targetRoomSchedules.filter(s => {
      const todayOverride = s.overrides[0];
      if (todayOverride && (todayOverride.type === 'CANCELLED' || todayOverride.type === 'MOVED')) {
        return false;
      }
      return true;
    });

    // Find all MOVED overrides pointing to the target room today, excluding this schedule itself
    const activeTargetRoomMovedOverrides = await prisma.override.findMany({
      where: {
        date,
        type: 'MOVED',
        targetRoomId: targetRoom.id,
        scheduleId: { not: scheduleId }
      },
      include: {
        schedule: true
      }
    });

    // Construct list of occupied time slots in target room today
    const activeIntervals: { startTime: string; endTime: string }[] = [];

    activeTargetRoomSchedules.forEach(s => {
      activeIntervals.push({ startTime: s.startTime, endTime: s.endTime });
    });

    activeTargetRoomMovedOverrides.forEach(o => {
      if (o.schedule) {
        activeIntervals.push({ startTime: o.schedule.startTime, endTime: o.schedule.endTime });
      }
    });

    // Check for overlap using rule: newStart < existingEnd && newEnd > existingStart
    const newStart = schedule.startTime;
    const newEnd = schedule.endTime;

    const hasConflict = activeIntervals.some(interval => {
      return newStart < interval.endTime && newEnd > interval.startTime;
    });

    if (hasConflict) {
      return res.status(409).json({ error: 'Target room already occupied during this slot.' });
    }

    // 5. Check if override already exists for this date
    const existingOverride = await prisma.override.findUnique({
      where: {
        scheduleId_date: {
          scheduleId,
          date
        }
      }
    });

    if (existingOverride) {
      // Update it to moved
      const updatedOverride = await prisma.override.update({
        where: { id: existingOverride.id },
        data: {
          type: 'MOVED',
          targetRoomId: targetRoom.id,
          crUserId: user.id
        }
      });
      return res.json({
        message: 'Class moved successfully (updated existing override)',
        override: updatedOverride
      });
    }

    // 6. Create new override
    const newOverride = await prisma.override.create({
      data: {
        type: 'MOVED',
        date,
        scheduleId,
        originalRoomId: schedule.roomName,
        targetRoomId: targetRoom.id,
        crUserId: user.id
      }
    });

    return res.status(201).json({
      message: `Class moved successfully to ${targetRoom.name}`,
      override: newOverride
    });
  } catch (error) {
    console.error('Error moving class:', error);
    return res.status(500).json({ error: 'Failed to move class' });
  } finally {
    releaseLock();
  }
}

/**
 * Fetches all schedules and active overrides owned by the logged-in CR.
 */
export async function getCRSchedules(req: AuthenticatedRequest, res: Response) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized CR action' });
  }

  try {
    const schedules = await prisma.schedule.findMany({
      where: {
        batch: user.batch,
        section: user.section
      },
      include: {
        overrides: true
      }
    });

    return res.json({
      schedules
    });
  } catch (error) {
    console.error('Error fetching CR schedules:', error);
    return res.status(500).json({ error: 'Failed to fetch schedules' });
  }
}

/**
 * Deletes/resets an override.
 */
export async function deleteOverride(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized CR action' });
  }

  await acquireLock();
  try {
    const override = await prisma.override.findUnique({
      where: { id },
      include: { schedule: true }
    });

    if (!override) {
      return res.status(404).json({ error: 'Override not found' });
    }

    // Verify ownership
    if (override.schedule.batch !== user.batch || override.schedule.section !== user.section) {
      return res.status(403).json({ error: 'Unauthorized to delete this override' });
    }

    await prisma.override.delete({
      where: { id }
    });

    return res.json({ message: 'Override removed successfully, timetable restored.' });
  } catch (error) {
    console.error('Error deleting override:', error);
    return res.status(500).json({ error: 'Failed to delete override' });
  } finally {
    releaseLock();
  }
}

