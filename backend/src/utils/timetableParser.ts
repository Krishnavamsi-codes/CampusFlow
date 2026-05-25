// Mappings of UG Courses to their corresponding batch based on requirements
const ugCourses: Record<string, string[]> = {
  UG1: ['PS', 'DSA', 'SS', 'CA', 'BEC', 'OPC', 'EDL', 'AIV'],
  UG2: ['CCN', 'FFSD', 'AI', 'TOC', 'AC', 'EMTL', 'FCOMM', 'AIKR', 'DL', 'IDA', 'ACS', 'LR'],
  UG3: [
    'WBD', 'DC', 'RES-AI', 'GTA', 'MS', 'DM', 'CGC', 'LPT', 'PGM', 'MOT', 'FDA',
    'IDHV', 'ADA', 'RL', 'DSY', 'IS', 'BCI', 'GEOTA', 'MML', 'SPEECH', 'IOT',
    'IAS', 'MSA', 'ONE', 'HDL', 'PE', 'AVLSI'
  ],
  UG4: ['SOC', 'CB', 'CDP', 'UBC', 'DIP', 'WN']
};

/**
 * Derives the batch (UG1, UG2, etc.) based on the course code prefix.
 */
export function getBatchForCourse(course: string): string {
  const normalizedCourse = course.toUpperCase().trim();
  for (const [batch, courses] of Object.entries(ugCourses)) {
    if (courses.includes(normalizedCourse)) {
      return batch;
    }
  }
  // Default fallback if not found
  return 'UG1';
}

export interface ParsedSchedule {
  batch: string;
  course: string;
  section: number;
  room: string;
  day: string;
  startTime: string;
  endTime: string;
}

/**
 * Parses a timetable schedule line string.
 * Example of entry: "DSA1 G09" or "CA4 Lab 103"
 */
export function parseScheduleEntry(
  entry: string,
  day: string,
  timeRange: string
): ParsedSchedule | null {
  const line = entry.trim();
  if (!line) return null;

  // Regex to match e.g. "DSA1 G09" or "CA4 Lab 103"
  // Group 1: Course (letters + dash)
  // Group 2: Section (digits)
  // Group 3: Room info (rest of string)
  const match = line.match(/^([A-Za-z\-]+)(\d+)\s+(.+)$/);
  if (!match) return null;

  const course = match[1].toUpperCase();
  const section = parseInt(match[2], 10);
  const roomRaw = match[3].trim();

  // Normalize room name (e.g. "Lab 103" -> "LAB-103", "Lab G05" -> "G05")
  let room = roomRaw;
  if (/^Lab\s+\d+$/i.test(room)) {
    room = `LAB-${room.split(/\s+/)[1]}`;
  } else if (/^Lab\s+/i.test(room)) {
    room = room.replace(/^Lab\s+/i, '').trim();
  } else if (/^LAB\-G\d+$/i.test(room)) {
    room = room.replace(/^LAB\-/i, '').trim().toUpperCase();
  } else if (/^LAB\-B\d+$/i.test(room)) {
    room = room.replace(/^LAB\-/i, '').trim().toUpperCase();
  } else if (/^LAB\-103$/i.test(room)) {
    room = 'LAB-103';
  } else if (/^103$/i.test(room)) {
    room = 'LAB-103';
  }

  const [startTime, endTime] = timeRange.split('-').map(t => t.trim());
  const batch = getBatchForCourse(course);

  return {
    batch,
    course,
    section,
    room,
    day,
    startTime,
    endTime
  };
}

/**
 * Parses a complete timetable text block.
 */
export function parseTimetableBlock(text: string): ParsedSchedule[] {
  const lines = text.split('\n');
  const results: ParsedSchedule[] = [];
  let currentDay = '';

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Check if line specifies a day (e.g., "Monday:")
    if (line.endsWith(':')) {
      currentDay = line.slice(0, -1).trim();
      continue;
    }

    if (!currentDay) continue;

    // Parse slots, e.g. "08:45-09:45 | DSA1 G09 | PS5 G08 | FFSD2 G05"
    const parts = line.split('|').map(p => p.trim());
    if (parts.length < 2) continue;

    const timeRange = parts[0]; // e.g. "08:45-09:45"
    for (let i = 1; i < parts.length; i++) {
      const entry = parts[i];
      const parsed = parseScheduleEntry(entry, currentDay, timeRange);
      if (parsed) {
        results.push(parsed);
      }
    }
  }

  return results;
}
