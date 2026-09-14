import Papa from 'papaparse';

export function exportToCsv(
  records: any[],
  sessionDate: string,
  courseCode: string
) {
  const data = records.map(r => ({
    'Reg No': r.student?.registrationNumber ?? 'N/A',
    'Name': r.student?.name ?? 'Unknown',
    'Status': r.status,
    'Method': r.method || 'N/A',
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
