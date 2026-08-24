/** Firestore document id for a parent–student link. Must match `firestore.rules` `isLinkedParent`. */
export function parentLinkId(parentId: string, studentId: string): string {
  return `${parentId}_${studentId}`;
}
