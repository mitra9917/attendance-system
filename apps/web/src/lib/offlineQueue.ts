import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

interface PendingMark {
  id?: number; // auto-increment IDB key
  sessionId: number;
  studentId: number;
  status: 'PRESENT' | 'ABSENT' | 'NOT_MARKED';
  method: 'MANUAL' | 'FACE';
  confidence: number | null;
  markedAt: string;
}

interface AttendanceDB extends DBSchema {
  pendingMarks: {
    key: number;
    value: PendingMark;
  };
}

let dbPromise: Promise<IDBPDatabase<AttendanceDB>> | null = null;

export async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<AttendanceDB>('attendance-db', 1, {
      upgrade(db) {
        db.createObjectStore('pendingMarks', { keyPath: 'id', autoIncrement: true });
      },
    });
  }
  return dbPromise;
}

export async function queueMark(mark: PendingMark) {
  const db = await getDB();
  await db.add('pendingMarks', mark);
}

export async function getPendingMarks(): Promise<PendingMark[]> {
  const db = await getDB();
  return db.getAll('pendingMarks');
}

export async function deleteMark(id: number) {
  const db = await getDB();
  await db.delete('pendingMarks', id);
}

export async function clearQueue() {
  const db = await getDB();
  await db.clear('pendingMarks');
}
