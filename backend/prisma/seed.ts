import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { parseTimetableBlock } from '../src/utils/timetableParser';

const prisma = new PrismaClient();

const roomsData = [
  // G Rooms
  { id: 'G04', name: 'G04 Classroom', category: 'G_ROOMS' },
  { id: 'G05', name: 'G05 Classroom', category: 'G_ROOMS' },
  { id: 'G06', name: 'G06 Classroom', category: 'G_ROOMS' },
  { id: 'G07', name: 'G07 Classroom', category: 'G_ROOMS' },
  { id: 'G08', name: 'G08 Classroom', category: 'G_ROOMS' },
  { id: 'G09', name: 'G09 Classroom', category: 'G_ROOMS' },

  // B Rooms
  { id: 'B03', name: 'B03 Classroom', category: 'B_ROOMS' },
  { id: 'B04', name: 'B04 Classroom', category: 'B_ROOMS' },
  { id: 'B05', name: 'B05 Classroom', category: 'B_ROOMS' },
  { id: 'B06', name: 'B06 Classroom', category: 'B_ROOMS' },

  // First Floor
  { id: '101', name: 'Room 101', category: 'FIRST_FLOOR' },
  { id: '102', name: 'Room 102', category: 'FIRST_FLOOR' },
  { id: 'LAB-103', name: 'Room 103 (Lab)', category: 'FIRST_FLOOR' },
  { id: '104', name: 'Room 104', category: 'FIRST_FLOOR' },
  { id: '105', name: 'Room 105', category: 'FIRST_FLOOR' },
  { id: '106', name: 'Room 106', category: 'FIRST_FLOOR' },
  { id: '108', name: 'Room 108', category: 'FIRST_FLOOR' },
  { id: '109', name: 'Room 109', category: 'FIRST_FLOOR' },
  { id: '110', name: 'Room 110', category: 'FIRST_FLOOR' },
  { id: '111', name: 'Room 111', category: 'FIRST_FLOOR' },
  { id: '112', name: 'Room 112', category: 'FIRST_FLOOR' },
  { id: '114', name: 'Room 114', category: 'FIRST_FLOOR' }
];

const rawTimetableText = `
Monday:
08:45-09:45 | DSA1 G09 | DSA4 G08 | SS2 LAB-103 | OPC3 G07 | FFSD1 G06 | TOC1 G05 | ACS4 G06 | DSY 110 | GTA 109 | MS 110 | IS1 111
09:45-10:45 | SS2 LAB-103 | PS3 G08 | CCN1 G06 | CCN3 G07 | PGM 108 | LPT1 109 | MSA 109 | DSY 108 | CB B03 | CDP B04
11:00-12:00 | CA2 G09 | PS1 G07 | SS3 LAB-103 | CA2 LAB-103 | CCN4 G05 | FFSD2 G06 | DL LAB-104 | ADA 110 | GTA 109 | MS 110 | IS1 111
12:00-13:00 | PS2 G09 | CA1 G08 | BEC G07 | AC LAB-102 | AC LAB-114 | FFSD2 G06 | EMTL B03 | DL LAB-104 | BCI 105 | WBD1 G04 | ONE 109 | WBD2 G05 | UBC 105
14:15-15:15 | SS1 G08 | DSA2 LAB-103 | SS4 G09 | AIKR G05 | FCOMM LAB-114 | FCOMM LAB-102 | TOC2 G06 | AI1 G04 | PGM 108 | LPT1 109 | MOT 110 | AVLSI 111 | LPT2 112 | AVLSI 104 | SOC 105 | DIP 112
15:15-16:15 | DSA2 LAB-103 | OPC4 G08 | FCOMM LAB-114 | FCOMM LAB-102 | ACS1 G06 | AI3 G07 | CCN2 G05 | DM 110 | IS2 108 | HDL 109
16:30-17:30 | CA4 G08 | PS5 G09 | CA3 G07 | IDA 112 | TOC3 G05 | ADA 110 | RL 111

Tuesday:
08:45-09:45 | CA4 LAB-103 | BEC LAB-114 | BEC LAB-102 | TOC1 G05 | DL 112 | AC G05 | RES-AI 108 | MSA 109
09:45-10:45 | BEC LAB-114 | BEC LAB-102 | CA4 LAB-103 | FFSD1 LAB-103 | ACS2 G09 | CCN4 G04 | AIKR 104 | IS2 108 | WBD3 G04
11:00-12:00 | CA2 G08 | DSA1 G09 | DSA3 G08 | AC LAB-102 | AC LAB-114 | TOC2 G07 | TOC3 G05 | DM 108 | GTA 109 | MML 109 | IS1 111
12:00-13:00 | CA2 LAB-103 | SS1 G09 | SS3 G07 | AIKR 104 | HDL 109 | RES-AI 108 | CGC 110 | DC 111 | CB B03 | CDP B04
14:15-15:15 | PS2 G09 | DSA3 LAB-103 | OPC1 G08 | IDA 112 | EMTL G06 | TOC1 G07 | AI2 B03 | DL 112 | DL 110 | WBD1 G04 | PE 109 | WBD2 G05 | WN 104
15:15-16:15 | DSA2 G08 | DSA3 LAB-103 | PS1 G09 | CCN2 G06 | AC G05 | CCN3 G04 | AI1 G07 | BCI 105 | GEOTA 108 | MML 109 | SPEECH 110 | IAS 111 | IOT 112
16:30-17:30 | SS2 G09 | SS4 G08 | CA1 G07 | FFSD2 G05 | FCOMM G06 | AI3 G04 | FDA 108 | LPT2 111 | MSA 109

Wednesday:
08:45-09:45 | DSA1 LAB-103 | PS2 G09 | PS5 G08 | CA3 G07 | TOC1 G05 | TOC3 G06 | ACS4 B03 | IDA 112 | FDA 110 | CGC 109 | DC 111 | AVLSI 108
09:45-10:45 | DSA4 G09 | SS2 G08 | DSA1 LAB-103 | EMTL G06 | TOC2 G05 | AIKR 104 | IS2 108 | WBD3 G04 | ONE 109
11:00-12:00 | CA1 LAB-103 | CA1 G07 | DSA4 LAB-103 | DL LAB-106 | FFSD3 G06 | BCI 105 | GEOTA 108 | GTA 109 | MS 110 | SPEECH 110 | IAS 111 | IOT 112
12:00-13:00 | PS4 G09 | PS3 G08 | DL LAB-106 | AI1 G05 | AI3 G06 | PGM 108 | LPT1 109 | MOT 110
14:15-15:15 | CA3 LAB-103 | OPC4 G08 | SS1 G09 | FFSD3 LAB-G05 | AI2 G06 | DL 112 | RL 111 | IDHV 110
15:15-16:15 | SS1 LAB-103 | OPC4 G08 | DSA2 G08 | FFSD3 LAB-G05 | DL 110 | WBD1 G04 | AVLSI 111 | WBD2 G07
16:30-17:30 | Faculty Meeting

Thursday:
08:45-09:45 | PS4 G09 | PS2 G08 | CA3 G07 | FFSD1 LAB-103 | LR4 G05 | FFSD3 G06 | FDA 110 | AVLSI 108 | SOC 112 | CB B03 | CDP B04
09:45-10:45 | DSA4 G09 | DSA1 G08 | SS3 G07 | OPC2 G06 | LR4 G05 | IDA LAB-104 | IS2 108 | PE 109 | WBD3 G04
11:00-12:00 | CA2 G09 | CA4 G08 | PS1 G07 | ACS3 G05 | FCOMM G06 | AIKR 104 | AI2 G05 | DM 108 | GTA 109 | ONE 109 | DSY 110
12:00-13:00 | PS3 G09 | PS4 G08 | SS4 G05 | AI2 G06 | AI3 G07 | AI1 G04 | TOC3 G05 | IDHV 110 | UBC 105 | DIP 112
14:15-15:15 | BEC G09 | SS4 LAB-103 | TOC2 G06 | CCN4 G06 | ACS3 G07 | LR3 G07 | RES-AI 108 | CGC 109 | DC 111 | WN 104
15:15-16:15 | SS1 LAB-103 | DSA3 G08 | PS5 G09 | EMTL G06 | LR3 G07 | FFSD2 LAB-G05 | FDA 110
16:30-17:30 | AIV2 G08 | ADA 110

Friday:
08:45-09:45 | SS3 G09 | SS2 G08 | PS5 G07 | FFSD3 G06 | DL 112 | WBD1 LAB-103 | WBD2 LAB-G05 | WBD3 LAB-G04
09:45-10:45 | DSA4 G09 | CA4 G08 | ACS1 B03 | FFSD3 G06 | WBD1 LAB-103 | WBD2 LAB-G05 | WBD3 LAB-G04
11:00-12:00 | DSA1 G09 | CA2 G09 | PS4 G08 | AC G06 | AIKR 104 | AI2 G05 | DSY 110 | ONE 109 | UBC 105 | DIP 112
12:00-13:00 | OPC3 G09 | OPC2 B03 | BEC G08 | TOC1 G06 | TOC2 G04 | TOC3 G05 | FCOMM G07
14:15-15:15 | DSA3 G09 | DSA2 G08 | SS4 LAB-103 | FFSD1 G06 | AI1 G04 | CCN4 G06 | ACS3 G07 | IDHV 110 | RL 111
15:15-16:15 | OPC1 G09 | CCN2 G08 | CCN4 G06 | CCN1 G05 | CCN3 G07 | WBD3 G04 | PE 110
16:30-17:30 | AIV1 G09 | CCN3 G06 | LR2 G05 | FFSD2 LAB-G05
`;
async function main() {
  console.log('Clearing database tables...');
  await prisma.override.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.cRUser.deleteMany();
  await prisma.room.deleteMany();

  console.log('Seeding rooms...');
  for (const room of roomsData) {
    await prisma.room.create({ data: room });
  }
  console.log(`Seeded ${roomsData.length} rooms successfully.`);

  console.log('Parsing and seeding timetable...');
  const schedules = parseTimetableBlock(rawTimetableText);
  let seededSchedulesCount = 0;

  for (const schedule of schedules) {
    // Verify room exists in our rooms table
    const roomExists = await prisma.room.findUnique({
      where: { id: schedule.room }
    });

    if (!roomExists) {
      console.warn(`Room ${schedule.room} not found in database. Skipping schedule: ${schedule.course}${schedule.section}`);
      continue;
    }

    await prisma.schedule.create({
      data: {
        batch: schedule.batch,
        course: schedule.course,
        section: schedule.section,
        roomName: schedule.room,
        day: schedule.day,
        startTime: schedule.startTime,
        endTime: schedule.endTime
      }
    });
    seededSchedulesCount++;
  }
  console.log(`Seeded ${seededSchedulesCount} schedule entries successfully.`);

  console.log('Seeding CR Users...');
  const passwordHash = await bcrypt.hash('password123', 10);

  const crUsers = [
    { username: 'cr_ug1_1', name: 'UG1 Section 1 CR', batch: 'UG1', section: 1 },
    { username: 'cr_ug1_2', name: 'UG1 Section 2 CR', batch: 'UG1', section: 2 },
    { username: 'cr_ug1_5', name: 'UG1 Section 5 CR', batch: 'UG1', section: 5 },
    { username: 'cr_ug2_1', name: 'UG2 Section 1 CR', batch: 'UG2', section: 1 },
    { username: 'cr_ug2_2', name: 'UG2 Section 2 CR', batch: 'UG2', section: 2 },
    { username: 'cr_ug3_1', name: 'UG3 Section 1 CR', batch: 'UG3', section: 1 },
    { username: 'cr_ug3_2', name: 'UG3 Section 2 CR', batch: 'UG3', section: 2 },
    { username: 'cr_ug3_3', name: 'UG3 Section 3 CR', batch: 'UG3', section: 3 },
    { username: 'cr_ug4_1', name: 'UG4 Section 1 CR', batch: 'UG4', section: 1 }
  ];

  for (const user of crUsers) {
    await prisma.cRUser.create({
      data: {
        username: user.username,
        name: user.name,
        passwordHash,
        batch: user.batch,
        section: user.section
      }
    });
  }
  console.log(`Seeded ${crUsers.length} CR accounts successfully.`);
  console.log('Seeding finished!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
