import Papa from 'papaparse';

export interface AttendanceExportRecord {
  serialNumber: number | null;
  status: string;
  method: string | null;
  markedAt: string | null;
  student: {
    registrationNumber: string;
    name: string;
  } | null;
}

export function exportToCsv(
  records: AttendanceExportRecord[],
  sessionDate: string,
  courseCode: string,
) {
  const sorted = [...records].sort((a, b) => (a.serialNumber ?? 0) - (b.serialNumber ?? 0));

  const data = sorted.map((r) => ({
    'Reg No': r.student?.registrationNumber ?? 'N/A',
    'Serial Number': r.serialNumber != null ? `#${r.serialNumber}` : 'N/A',
    'Name': r.student?.name ?? 'Unknown',
    'Status': r.status,
    'Method': r.method ?? 'N/A',
    'Time': r.markedAt ? new Date(r.markedAt).toLocaleTimeString() : 'N/A',
  }));

  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `Attendance_${courseCode}_${sessionDate}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
