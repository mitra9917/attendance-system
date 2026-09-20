import { db } from '../prisma/db.js';
import { emailForSerial } from '../data/classEmails.js';

const FEMALE_FIRST_NAMES = new Set([
  'sanjana',
  'mannat',
  'shrishti',
  'parleen',
  'nihara',
  'kagitha',
  'sree',
  'shruti',
  'krishni',
  'tiyasha',
  'pari',
  'jeel',
  'mariam',
]);

export interface RosterRow {
  studentId: number;
  serialNumber: number | null;
  status: string;
  name: string;
  registrationNumber: string;
  email: string | null;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0]?.toLowerCase() || '';
}

function isFemaleName(name: string): boolean {
  const parts = name.trim().split(/\s+/).map((p) => p.toLowerCase());
  return parts.some((p) => FEMALE_FIRST_NAMES.has(p));
}

function genderCounts(rows: RosterRow[]): { boys: number; girls: number } {
  let girls = 0;
  for (const row of rows) {
    if (isFemaleName(row.name)) girls += 1;
  }
  return { boys: rows.length - girls, girls };
}

export function resolveStudentEmail(serialNumber: number | null, stored?: string | null): string | null {
  const fromDb = stored?.trim() || null;
  if (fromDb) return fromDb;
  return emailForSerial(serialNumber);
}

export async function loadSessionRoster(sessionId: number): Promise<{
  session: { id: number; courseId: number; slotCode: string; date: string; teacherId: number };
  course: { id: number; code: string; name: string; slotPattern: string };
  teacherName: string;
  rows: RosterRow[];
} | null> {
  const session = await db.orm.public.AttendanceSession.where({ id: sessionId }).first();
  if (!session) return null;

  const course = await db.orm.public.Course.first({ id: session.courseId });
  if (!course) return null;

  const teacher = await db.orm.public.User.first({ id: session.teacherId });
  const enrollments = await db.orm.public.Enrollment.where({ courseId: session.courseId }).all();
  const records = await db.orm.public.AttendanceRecord.where({ sessionId }).all();
  const recordByStudent = new Map(records.map((r) => [r.studentId, r]));

  const rows: RosterRow[] = [];
  for (const enrollment of enrollments) {
    const student = await db.orm.public.Student.first({ id: enrollment.studentId });
    if (!student) continue;
    const record = recordByStudent.get(enrollment.studentId);
    rows.push({
      studentId: student.id,
      serialNumber: enrollment.serialNumber,
      status: record?.status ?? 'NOT_MARKED',
      name: student.name,
      registrationNumber: student.registrationNumber,
      email: resolveStudentEmail(enrollment.serialNumber, student.email),
    });
  }

  rows.sort((a, b) => (a.serialNumber ?? 999) - (b.serialNumber ?? 999));

  return {
    session,
    course,
    teacherName: teacher?.name || 'Dr. M. Raja',
    rows,
  };
}

export async function persistMissingEmails(rows: RosterRow[]): Promise<number> {
  let updated = 0;
  for (const row of rows) {
    const mapped = emailForSerial(row.serialNumber);
    if (!mapped) continue;
    const student = await db.orm.public.Student.first({ id: row.studentId });
    if (!student) continue;
    if (student.email?.trim()) continue;
    await db.orm.public.Student.where({ id: row.studentId }).update({ email: mapped });
    updated += 1;
  }
  return updated;
}

export function buildAbsenteeEmail(input: {
  courseCode: string;
  courseName: string;
  slotPattern: string;
  teacherName: string;
  rows: RosterRow[];
}): { subject: string; body: string; absentees: RosterRow[]; presentees: RosterRow[]; recipients: string[] } {
  const absentees = input.rows
    .filter((r) => r.status === 'ABSENT')
    .sort((a, b) => (a.serialNumber ?? 999) - (b.serialNumber ?? 999));
  const presentees = input.rows.filter((r) => r.status === 'PRESENT');
  const absentGender = genderCounts(absentees);
  const presentGender = genderCounts(presentees);

  const subject = `${input.slotPattern} ${input.courseCode} ${input.courseName}: Absentees List:`;

  const listLines = absentees.map((r) => {
    const serial = r.serialNumber ?? '-';
    return `${serial} ${r.registrationNumber} ${r.name}`;
  });

  const body = [
    `${subject}`,
    '',
    ...listLines,
    '',
    `Absentees Count: ${absentees.length} (Boys: ${absentGender.boys}, Girls: ${absentGender.girls})`,
    `Presentees Count: ${presentees.length} (Boys: ${presentGender.boys}, Girls: ${presentGender.girls})`,
    '',
    'Thanks & Regards,',
    '',
    input.teacherName,
  ].join('\n');

  const recipients = [...new Set(input.rows.map((r) => r.email).filter((e): e is string => Boolean(e)))];

  return { subject, body, absentees, presentees, recipients };
}
