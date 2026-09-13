export interface User {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN' | 'TEACHER';
  isActive: boolean;
}

export interface Student {
  id: number;
  registrationNumber: string;
  name: string;
  email?: string;
  isActive: boolean;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  section: string;
  isActive: boolean;
}

export interface Slot {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface Enrollment {
  id: number;
  courseId: number;
  studentId: number;
  serialNumber: number;
  student?: Student;
}
