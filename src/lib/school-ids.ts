export function schoolCodeKey(code: string): string {
  return code.trim().toUpperCase();
}

export function rosterLookupId(schoolId: string, studentCode: string): string {
  return `${schoolId}_${schoolCodeKey(studentCode)}`;
}
