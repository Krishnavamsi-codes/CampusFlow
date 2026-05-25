import { getBatchForCourse, parseScheduleEntry, parseTimetableBlock } from '../src/utils/timetableParser';

describe('Timetable Parser Tests', () => {
  describe('parseScheduleEntry', () => {
    test('Test Case 1: Standard classroom input', () => {
      const parsed = parseScheduleEntry('DSA1 G09', 'Monday', '08:45-09:45');
      expect(parsed).toEqual({
        batch: 'UG1',
        course: 'DSA',
        section: 1,
        room: 'G09',
        day: 'Monday',
        startTime: '08:45',
        endTime: '09:45',
      });
    });

    test('Test Case 2: Lab room input with space', () => {
      const parsed = parseScheduleEntry('CA4 Lab 103', 'Monday', '11:00-12:00');
      expect(parsed).toEqual({
        batch: 'UG1',
        course: 'CA',
        section: 4,
        room: 'LAB-103',
        day: 'Monday',
        startTime: '11:00',
        endTime: '12:00',
      });
    });

    test('Test Case 3: Another classroom input', () => {
      const parsed = parseScheduleEntry('WBD3 G04', 'Monday', '09:45-10:45');
      expect(parsed).toEqual({
        batch: 'UG3',
        course: 'WBD',
        section: 3,
        room: 'G04',
        day: 'Monday',
        startTime: '09:45',
        endTime: '10:45',
      });
    });

    test('Parser correctly maps course ownership batches', () => {
      expect(getBatchForCourse('DSA')).toBe('UG1');
      expect(getBatchForCourse('FFSD')).toBe('UG2');
      expect(getBatchForCourse('WBD')).toBe('UG3');
      expect(getBatchForCourse('SOC')).toBe('UG4');
    });
  });

  describe('Spring 2026 Timetable Entries Validation', () => {
    test('UG1 Monday: DSA1 G09, DSA4 G08, SS2 Lab 103', () => {
      const dsa1 = parseScheduleEntry('DSA1 G09', 'Monday', '08:45-09:45');
      const dsa4 = parseScheduleEntry('DSA4 G08', 'Monday', '08:45-09:45');
      const ss2 = parseScheduleEntry('SS2 Lab 103', 'Monday', '11:00-12:00');

      expect(dsa1).toMatchObject({ course: 'DSA', section: 1, room: 'G09', batch: 'UG1' });
      expect(dsa4).toMatchObject({ course: 'DSA', section: 4, room: 'G08', batch: 'UG1' });
      expect(ss2).toMatchObject({ course: 'SS', section: 2, room: 'LAB-103', batch: 'UG1' });
    });

    test('UG2 Monday: FFSD1 G06, TOC1 G05', () => {
      const ffsd1 = parseScheduleEntry('FFSD1 G06', 'Monday', '12:00-13:00');
      const toc1 = parseScheduleEntry('TOC1 G05', 'Monday', '11:00-12:00');

      expect(ffsd1).toMatchObject({ course: 'FFSD', section: 1, room: 'G06', batch: 'UG2' });
      expect(toc1).toMatchObject({ course: 'TOC', section: 1, room: 'G05', batch: 'UG2' });
    });

    test('UG3 Friday: WBD1 Lab 103, WBD2 Lab G05, WBD3 Lab G04', () => {
      const wbd1 = parseScheduleEntry('WBD1 Lab 103', 'Friday', '11:00-12:00');
      const wbd2 = parseScheduleEntry('WBD2 Lab G05', 'Friday', '09:45-10:45');
      const wbd3 = parseScheduleEntry('WBD3 Lab G04', 'Friday', '08:45-09:45');

      expect(wbd1).toMatchObject({ course: 'WBD', section: 1, room: 'LAB-103', batch: 'UG3' });
      expect(wbd2).toMatchObject({ course: 'WBD', section: 2, room: 'G05', batch: 'UG3' });
      expect(wbd3).toMatchObject({ course: 'WBD', section: 3, room: 'G04', batch: 'UG3' });
    });

    test('UG4 Thursday: AVLSI 111, SOC 112, CB B03, CDP B04', () => {
      const avlsi = parseScheduleEntry('AVLSI1 111', 'Thursday', '12:00-13:00');
      const soc = parseScheduleEntry('SOC1 112', 'Thursday', '14:00-15:00');
      const cb = parseScheduleEntry('CB1 B03', 'Thursday', '15:15-16:15');
      const cdp = parseScheduleEntry('CDP1 B04', 'Thursday', '12:00-13:00');

      expect(avlsi).toMatchObject({ course: 'AVLSI', section: 1, room: '111', batch: 'UG3' }); // AVLSI belongs to UG3 as per mappings
      expect(soc).toMatchObject({ course: 'SOC', section: 1, room: '112', batch: 'UG4' });
      expect(cb).toMatchObject({ course: 'CB', section: 1, room: 'B03', batch: 'UG4' });
      expect(cdp).toMatchObject({ course: 'CDP', section: 1, room: 'B04', batch: 'UG4' });
    });
  });
});
