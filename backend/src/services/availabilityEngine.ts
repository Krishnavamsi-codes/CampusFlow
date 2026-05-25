import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ActiveEvent {
  id: string;
  course: string;
  section: number;
  batch: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  startMinutes: number;
  endMinutes: number;
  isMovedIn: boolean;
  originalRoomId?: string;
  type?: string;
}

export interface RoomStatus {
  roomId: string;
  roomName: string;
  category: string;
  status: 'FREE' | 'OCCUPIED';
  ongoingClass: {
    course: string;
    section: number;
    batch: string;
    endTime: string;
    isMovedIn: boolean;
  } | null;
  nextClass: {
    course: string;
    section: number;
    batch: string;
    startTime: string;
    isMovedIn: boolean;
  } | null;
  freeUntil: string | null; // e.g. "11:00" or "End of Day"
  freeDurationMinutes: number | null; // minutes it will remain free
  timeline: TimelineSlot[];
}

export interface TimelineSlot {
  startTime: string;
  endTime: string;
  status: 'FREE' | 'OCCUPIED';
  label: string; // Course details or "FREE"
  isMovedIn: boolean;
  isCancelled: boolean;
  batch?: string;
  section?: number;
}

// Convert HH:mm to minutes from midnight
export function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// Convert minutes from midnight back to HH:mm
export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function getDayName(dateStr: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const [yr, mo, dy] = dateStr.split('-').map(Number);
  const date = new Date(yr, mo - 1, dy);
  return days[date.getDay()];
}

/**
 * Calculates effective events for a specific room on a given date.
 */
export async function getActiveEventsForRoom(
  roomId: string,
  dateStr: string
): Promise<ActiveEvent[]> {
  const dayName = getDayName(dateStr);

  // 1. Get official schedules for this room on this day
  const schedules = await prisma.schedule.findMany({
    where: {
      roomName: roomId,
      day: dayName
    }
  });

  // 2. Get overrides on schedules originally in this room for today
  const originalOverrides = await prisma.override.findMany({
    where: {
      date: dateStr,
      schedule: {
        roomName: roomId
      }
    },
    include: { schedule: true }
  });

  // 3. Get overrides moved INTO this room for today
  const movedInOverrides = await prisma.override.findMany({
    where: {
      date: dateStr,
      type: 'MOVED',
      targetRoomId: roomId
    },
    include: { schedule: true }
  });

  const activeEvents: ActiveEvent[] = [];

  // Add official schedules that are not cancelled or moved out
  for (const s of schedules) {
    const override = originalOverrides.find(o => o.scheduleId === s.id);
    if (!override) {
      // Normal schedule, no override
      activeEvents.push({
        id: s.id,
        course: s.course,
        section: s.section,
        batch: s.batch,
        startTime: s.startTime,
        endTime: s.endTime,
        startMinutes: parseTimeToMinutes(s.startTime),
        endMinutes: parseTimeToMinutes(s.endTime),
        isMovedIn: false
      });
    }
  }

  // Add schedules moved into this room
  for (const o of movedInOverrides) {
    activeEvents.push({
      id: o.schedule.id,
      course: o.schedule.course,
      section: o.schedule.section,
      batch: o.schedule.batch,
      startTime: o.schedule.startTime,
      endTime: o.schedule.endTime,
      startMinutes: parseTimeToMinutes(o.schedule.startTime),
      endMinutes: parseTimeToMinutes(o.schedule.endTime),
      isMovedIn: true,
      originalRoomId: o.originalRoomId
    });
  }

  // Sort events by starting time
  return activeEvents.sort((a, b) => a.startMinutes - b.startMinutes);
}

/**
 * Calculates current availability metrics and daily timeline for a room.
 */
export async function calculateRoomStatus(
  roomId: string,
  roomName: string,
  category: string,
  dateStr: string,
  timeStr: string
): Promise<RoomStatus> {
  const activeEvents = await getActiveEventsForRoom(roomId, dateStr);
  const targetMinutes = parseTimeToMinutes(timeStr);

  let ongoingEvent: ActiveEvent | null = null;
  let nextEvent: ActiveEvent | null = null;

  for (const event of activeEvents) {
    if (event.startMinutes <= targetMinutes && targetMinutes < event.endMinutes) {
      ongoingEvent = event;
    } else if (event.startMinutes > targetMinutes && !nextEvent) {
      nextEvent = event;
    }
  }

  // If ongoing class ends, we want to find the class after it as the next class
  if (ongoingEvent && !nextEvent) {
    nextEvent = activeEvents.find(e => e.startMinutes >= ongoingEvent!.endMinutes) || null;
  }

  const status = ongoingEvent ? 'OCCUPIED' : 'FREE';

  let ongoingClass = null;
  if (ongoingEvent) {
    ongoingClass = {
      course: ongoingEvent.course,
      section: ongoingEvent.section,
      batch: ongoingEvent.batch,
      endTime: ongoingEvent.endTime,
      isMovedIn: ongoingEvent.isMovedIn
    };
  }

  let nextClass = null;
  if (nextEvent) {
    nextClass = {
      course: nextEvent.course,
      section: nextEvent.section,
      batch: nextEvent.batch,
      startTime: nextEvent.startTime,
      isMovedIn: nextEvent.isMovedIn
    };
  }

  let freeUntil = null;
  let freeDurationMinutes = null;

  if (status === 'FREE') {
    if (nextEvent) {
      freeUntil = nextEvent.startTime;
      freeDurationMinutes = nextEvent.startMinutes - targetMinutes;
    } else {
      freeUntil = 'End of Day';
      // Assume end of day is 21:00 (1260 mins)
      const eod = 21 * 60;
      freeDurationMinutes = Math.max(0, eod - targetMinutes);
    }
  }

  // Generate Daily Timeline Slots
  const timeline: TimelineSlot[] = [];
  
  // We define the operating campus day from 08:30 to 18:00
  let currentTime = 8 * 60 + 30; // 08:30
  const endOfDayTime = 18 * 60; // 18:00

  // Combine and process events to form a contiguous timeline
  for (const event of activeEvents) {
    if (event.startMinutes > currentTime) {
      // There is a free gap before this event
      timeline.push({
        startTime: minutesToTimeString(currentTime),
        endTime: minutesToTimeString(event.startMinutes),
        status: 'FREE',
        label: 'FREE',
        isMovedIn: false,
        isCancelled: false
      });
    }

    // Add the event slot itself
    timeline.push({
      startTime: event.startTime,
      endTime: event.endTime,
      status: 'OCCUPIED',
      label: `${event.course}${event.section}`,
      isMovedIn: event.isMovedIn,
      isCancelled: false,
      batch: event.batch,
      section: event.section
    });

    currentTime = event.endMinutes;
  }

  if (currentTime < endOfDayTime) {
    // Add final free slot to end of day
    timeline.push({
      startTime: minutesToTimeString(currentTime),
      endTime: minutesToTimeString(endOfDayTime),
      status: 'FREE',
      label: 'FREE',
      isMovedIn: false,
      isCancelled: false
    });
  }

  return {
    roomId,
    roomName,
    category,
    status,
    ongoingClass,
    nextClass,
    freeUntil,
    freeDurationMinutes,
    timeline
  };
}
