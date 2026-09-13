export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI';
export type SlotType = 'THEORY' | 'LAB';

export interface TimeBlock {
  code: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
}

// Times for the 12 daily slots
const TIMES = [
  { start: '08:00', end: '08:50' },
  { start: '08:55', end: '09:45' },
  { start: '09:50', end: '10:40' },
  { start: '10:45', end: '11:35' },
  { start: '11:40', end: '12:30' },
  { start: '12:35', end: '13:25' },
  // Lunch 13:25 - 14:00
  { start: '14:00', end: '14:50' },
  { start: '14:55', end: '15:45' },
  { start: '15:50', end: '16:40' },
  { start: '16:45', end: '17:35' },
  { start: '17:40', end: '18:30' },
  { start: '18:35', end: '19:25' },
];

const makeBlock = (code: string, day: DayOfWeek, periodIndex: number): TimeBlock => ({
  code,
  day,
  startTime: TIMES[periodIndex].start,
  endTime: TIMES[periodIndex].end,
});

// A comprehensive map of individual slots to their time blocks
export const BLOCKS: Record<string, TimeBlock[]> = {
  // Morning Theory
  'A1': [makeBlock('A1', 'MON', 0), makeBlock('A1', 'WED', 1)],
  'B1': [makeBlock('B1', 'TUE', 0), makeBlock('B1', 'THU', 1)],
  'C1': [makeBlock('C1', 'WED', 0), makeBlock('C1', 'FRI', 1)],
  'D1': [makeBlock('D1', 'MON', 2), makeBlock('D1', 'THU', 0)],
  'E1': [makeBlock('E1', 'TUE', 2), makeBlock('E1', 'FRI', 0)],
  'F1': [makeBlock('F1', 'MON', 1), makeBlock('F1', 'WED', 2)],
  'G1': [makeBlock('G1', 'TUE', 1), makeBlock('G1', 'THU', 2)],

  // Afternoon Theory
  'A2': [makeBlock('A2', 'MON', 6), makeBlock('A2', 'WED', 7)],
  'B2': [makeBlock('B2', 'TUE', 6), makeBlock('B2', 'THU', 7)],
  'C2': [makeBlock('C2', 'WED', 6), makeBlock('C2', 'FRI', 7)],
  'D2': [makeBlock('D2', 'MON', 8), makeBlock('D2', 'THU', 6)],
  'E2': [makeBlock('E2', 'TUE', 8), makeBlock('E2', 'FRI', 6)],
  'F2': [makeBlock('F2', 'MON', 7), makeBlock('F2', 'WED', 8)],
  'G2': [makeBlock('G2', 'TUE', 7), makeBlock('G2', 'THU', 8)],

  // Morning Tutorials
  'TA1': [makeBlock('TA1', 'FRI', 2)],
  'TB1': [makeBlock('TB1', 'MON', 3)],
  'TC1': [makeBlock('TC1', 'TUE', 3)],
  'TD1': [makeBlock('TD1', 'WED', 3)],
  'TE1': [makeBlock('TE1', 'THU', 3)],
  'TF1': [makeBlock('TF1', 'FRI', 3)],
  'TG1': [makeBlock('TG1', 'MON', 4)],
  
  'TAA1': [makeBlock('TAA1', 'TUE', 4)],
  'TBB1': [makeBlock('TBB1', 'WED', 4)],
  'TCC1': [makeBlock('TCC1', 'THU', 4)],
  'TDD1': [makeBlock('TDD1', 'FRI', 4)],

  // Afternoon Tutorials
  'TA2': [makeBlock('TA2', 'FRI', 8)],
  'TB2': [makeBlock('TB2', 'MON', 9)],
  'TC2': [makeBlock('TC2', 'TUE', 9)],
  'TD2': [makeBlock('TD2', 'WED', 9)],
  'TE2': [makeBlock('TE2', 'THU', 9)],
  'TF2': [makeBlock('TF2', 'FRI', 9)],
  'TG2': [makeBlock('TG2', 'MON', 10)],

  'TAA2': [makeBlock('TAA2', 'TUE', 10)],
  'TBB2': [makeBlock('TBB2', 'WED', 10)],
  'TCC2': [makeBlock('TCC2', 'THU', 10)],
  'TDD2': [makeBlock('TDD2', 'FRI', 10)],
};

// Auto-generate Labs (L1 to L60) based on the timetable logic
// Mon: L1-L6, L31-L36
// Tue: L7-L12, L37-L42
// Wed: L13-L18, L43-L48
// Thu: L19-L24, L49-L54
// Fri: L25-L30, L55-L60
const labDays: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
for (let i = 0; i < 5; i++) {
  const day = labDays[i];
  // Morning labs (periods 0-5)
  for (let j = 0; j < 6; j++) {
    const labNum = i * 6 + j + 1;
    BLOCKS[`L${labNum}`] = [makeBlock(`L${labNum}`, day, j)];
  }
  // Afternoon labs (periods 6-11)
  for (let j = 0; j < 6; j++) {
    const labNum = 30 + i * 6 + j + 1;
    BLOCKS[`L${labNum}`] = [makeBlock(`L${labNum}`, day, j + 6)];
  }
}

// Generate valid slot patterns
export const THEORY_PATTERNS: string[] = [];
['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(char => {
  [1, 2].forEach(shift => {
    const base = `${char}${shift}`;
    const tBase = `T${base}`;
    const ttBase = `T${char}${char}${shift}`;
    
    THEORY_PATTERNS.push(base); // e.g. A1
    
    if (BLOCKS[tBase]) {
      THEORY_PATTERNS.push(`${base}+${tBase}`); // e.g. A1+TA1
      if (BLOCKS[ttBase]) {
        THEORY_PATTERNS.push(`${base}+${tBase}+${ttBase}`); // e.g. A1+TA1+TAA1
      }
    }
  });
});

export const LAB_PATTERNS: string[] = [];
// Labs are taken in pairs (e.g. L1+L2, L3+L4)
for (let i = 1; i < 60; i += 2) {
  LAB_PATTERNS.push(`L${i}+L${i+1}`);
}

/**
 * Returns all time blocks associated with a given slot pattern.
 * E.g., "A1+TA1" -> [Mon 8:00 block, Wed 8:55 block, Fri 9:50 block]
 */
export function getBlocksForPattern(pattern: string): TimeBlock[] {
  const blocks: TimeBlock[] = [];
  const parts = pattern.split('+').map(s => s.trim().toUpperCase());
  
  for (const part of parts) {
    if (BLOCKS[part]) {
      blocks.push(...BLOCKS[part]);
    }
  }
  
  return blocks;
}
