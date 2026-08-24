import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise, DataConnectSettings } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;
export const dataConnectSettings: DataConnectSettings;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface Assignment_Key {
  id: UUIDString;
  __typename?: 'Assignment_Key';
}

export interface CancelEnrollmentData {
  enrollment_delete?: Enrollment_Key | null;
}

export interface CancelEnrollmentVariables {
  id: UUIDString;
}

export interface Course_Key {
  id: UUIDString;
  __typename?: 'Course_Key';
}

export interface CreateAssignmentData {
  assignment_insert: Assignment_Key;
}

export interface CreateAssignmentVariables {
  moduleId: UUIDString;
  title: string;
  dueDate: TimestampString;
}

export interface CreateCourseData {
  course_insert: Course_Key;
}

export interface CreateCourseVariables {
  title: string;
  description: string;
}

export interface CreateModuleData {
  module_insert: Module_Key;
}

export interface CreateModuleVariables {
  courseId: UUIDString;
  title: string;
  contentUrl: string;
  orderIndex: number;
}

export interface CreateUserData {
  user_insert: User_Key;
}

export interface CreateUserVariables {
  name: string;
  email: string;
}

export interface DeleteAssignmentData {
  assignment_delete?: Assignment_Key | null;
}

export interface DeleteAssignmentVariables {
  id: UUIDString;
}

export interface DeleteCourseData {
  course_delete?: Course_Key | null;
}

export interface DeleteCourseVariables {
  id: UUIDString;
}

export interface DeleteModuleData {
  module_delete?: Module_Key | null;
}

export interface DeleteModuleVariables {
  id: UUIDString;
}

export interface DeleteSubmissionData {
  submission_delete?: Submission_Key | null;
}

export interface DeleteSubmissionVariables {
  id: UUIDString;
}

export interface DeleteUserData {
  user_delete?: User_Key | null;
}

export interface EnrollInCourseData {
  enrollment_insert: Enrollment_Key;
}

export interface EnrollInCourseVariables {
  courseId: UUIDString;
}

export interface Enrollment_Key {
  id: UUIDString;
  __typename?: 'Enrollment_Key';
}

export interface GetAssignmentData {
  assignment?: {
    title: string;
    dueDate: TimestampString;
    maxPoints?: number | null;
  };
}

export interface GetAssignmentVariables {
  id: UUIDString;
}

export interface GetCourseData {
  course?: {
    title: string;
    description: string;
    instructor: {
      name: string;
    };
  };
}

export interface GetCourseVariables {
  id: UUIDString;
}

export interface GetCurrentUserData {
  user?: {
    name: string;
    email: string;
    role: string;
    profilePictureUrl?: string | null;
  };
}

export interface GetModuleData {
  module?: {
    title: string;
    contentUrl: string;
    durationMinutes?: number | null;
  };
}

export interface GetModuleVariables {
  id: UUIDString;
}

export interface GetMyEnrollmentData {
  enrollment?: {
    course: {
      title: string;
    };
    enrollmentDate: DateString;
    status?: string | null;
  };
}

export interface GetMyEnrollmentVariables {
  id: UUIDString;
}

export interface GetSubmissionData {
  submission?: {
    submissionUrl: string;
    grade?: number | null;
    instructorFeedback?: string | null;
  };
}

export interface GetSubmissionVariables {
  id: UUIDString;
}

export interface ListAllUsersData {
  users: ({
    name: string;
    email: string;
    role: string;
  })[];
}

export interface ListAssignmentsByModuleData {
  assignments: ({
    title: string;
    dueDate: TimestampString;
  })[];
}

export interface ListAssignmentsByModuleVariables {
  moduleId: UUIDString;
}

export interface ListCoursesData {
  courses: ({
    title: string;
    description: string;
  })[];
}

export interface ListModulesByCourseData {
  modules: ({
    title: string;
    orderIndex: number;
  })[];
}

export interface ListModulesByCourseVariables {
  courseId: UUIDString;
}

export interface ListMyEnrollmentsData {
  enrollments: ({
    course: {
      title: string;
    };
    enrollmentDate: DateString;
  })[];
}

export interface ListMySubmissionsData {
  submissions: ({
    assignment: {
      title: string;
    };
    grade?: number | null;
  })[];
}

export interface Module_Key {
  id: UUIDString;
  __typename?: 'Module_Key';
}

export interface Submission_Key {
  id: UUIDString;
  __typename?: 'Submission_Key';
}

export interface SubmitAssignmentData {
  submission_insert: Submission_Key;
}

export interface SubmitAssignmentVariables {
  assignmentId: UUIDString;
  url: string;
}

export interface UpdateAssignmentData {
  assignment_update?: Assignment_Key | null;
}

export interface UpdateAssignmentVariables {
  id: UUIDString;
  maxPoints?: number | null;
}

export interface UpdateCourseData {
  course_update?: Course_Key | null;
}

export interface UpdateCourseVariables {
  id: UUIDString;
  title?: string | null;
}

export interface UpdateEnrollmentStatusData {
  enrollment_update?: Enrollment_Key | null;
}

export interface UpdateEnrollmentStatusVariables {
  id: UUIDString;
  status?: string | null;
}

export interface UpdateGradeData {
  submission_update?: Submission_Key | null;
}

export interface UpdateGradeVariables {
  id: UUIDString;
  grade?: number | null;
}

export interface UpdateModuleData {
  module_update?: Module_Key | null;
}

export interface UpdateModuleVariables {
  id: UUIDString;
  title?: string | null;
}

export interface UpdateUserData {
  user_update?: User_Key | null;
}

export interface UpdateUserVariables {
  name?: string | null;
  profilePictureUrl?: string | null;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface CreateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  operationName: string;
}
export const createUserRef: CreateUserRef;

export function createUser(vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;
export function createUser(dc: DataConnect, vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface UpdateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
  operationName: string;
}
export const updateUserRef: UpdateUserRef;

export function updateUser(vars?: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;
export function updateUser(dc: DataConnect, vars?: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;

interface DeleteUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<DeleteUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): MutationRef<DeleteUserData, undefined>;
  operationName: string;
}
export const deleteUserRef: DeleteUserRef;

export function deleteUser(): MutationPromise<DeleteUserData, undefined>;
export function deleteUser(dc: DataConnect): MutationPromise<DeleteUserData, undefined>;

interface GetCurrentUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetCurrentUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetCurrentUserData, undefined>;
  operationName: string;
}
export const getCurrentUserRef: GetCurrentUserRef;

export function getCurrentUser(options?: ExecuteQueryOptions): QueryPromise<GetCurrentUserData, undefined>;
export function getCurrentUser(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetCurrentUserData, undefined>;

interface ListAllUsersRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListAllUsersData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListAllUsersData, undefined>;
  operationName: string;
}
export const listAllUsersRef: ListAllUsersRef;

export function listAllUsers(options?: ExecuteQueryOptions): QueryPromise<ListAllUsersData, undefined>;
export function listAllUsers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListAllUsersData, undefined>;

interface CreateCourseRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateCourseVariables): MutationRef<CreateCourseData, CreateCourseVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateCourseVariables): MutationRef<CreateCourseData, CreateCourseVariables>;
  operationName: string;
}
export const createCourseRef: CreateCourseRef;

export function createCourse(vars: CreateCourseVariables): MutationPromise<CreateCourseData, CreateCourseVariables>;
export function createCourse(dc: DataConnect, vars: CreateCourseVariables): MutationPromise<CreateCourseData, CreateCourseVariables>;

interface UpdateCourseRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateCourseVariables): MutationRef<UpdateCourseData, UpdateCourseVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateCourseVariables): MutationRef<UpdateCourseData, UpdateCourseVariables>;
  operationName: string;
}
export const updateCourseRef: UpdateCourseRef;

export function updateCourse(vars: UpdateCourseVariables): MutationPromise<UpdateCourseData, UpdateCourseVariables>;
export function updateCourse(dc: DataConnect, vars: UpdateCourseVariables): MutationPromise<UpdateCourseData, UpdateCourseVariables>;

interface DeleteCourseRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteCourseVariables): MutationRef<DeleteCourseData, DeleteCourseVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteCourseVariables): MutationRef<DeleteCourseData, DeleteCourseVariables>;
  operationName: string;
}
export const deleteCourseRef: DeleteCourseRef;

export function deleteCourse(vars: DeleteCourseVariables): MutationPromise<DeleteCourseData, DeleteCourseVariables>;
export function deleteCourse(dc: DataConnect, vars: DeleteCourseVariables): MutationPromise<DeleteCourseData, DeleteCourseVariables>;

interface GetCourseRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetCourseVariables): QueryRef<GetCourseData, GetCourseVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetCourseVariables): QueryRef<GetCourseData, GetCourseVariables>;
  operationName: string;
}
export const getCourseRef: GetCourseRef;

export function getCourse(vars: GetCourseVariables, options?: ExecuteQueryOptions): QueryPromise<GetCourseData, GetCourseVariables>;
export function getCourse(dc: DataConnect, vars: GetCourseVariables, options?: ExecuteQueryOptions): QueryPromise<GetCourseData, GetCourseVariables>;

interface ListCoursesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListCoursesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListCoursesData, undefined>;
  operationName: string;
}
export const listCoursesRef: ListCoursesRef;

export function listCourses(options?: ExecuteQueryOptions): QueryPromise<ListCoursesData, undefined>;
export function listCourses(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListCoursesData, undefined>;

interface CreateModuleRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateModuleVariables): MutationRef<CreateModuleData, CreateModuleVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateModuleVariables): MutationRef<CreateModuleData, CreateModuleVariables>;
  operationName: string;
}
export const createModuleRef: CreateModuleRef;

export function createModule(vars: CreateModuleVariables): MutationPromise<CreateModuleData, CreateModuleVariables>;
export function createModule(dc: DataConnect, vars: CreateModuleVariables): MutationPromise<CreateModuleData, CreateModuleVariables>;

interface UpdateModuleRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateModuleVariables): MutationRef<UpdateModuleData, UpdateModuleVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateModuleVariables): MutationRef<UpdateModuleData, UpdateModuleVariables>;
  operationName: string;
}
export const updateModuleRef: UpdateModuleRef;

export function updateModule(vars: UpdateModuleVariables): MutationPromise<UpdateModuleData, UpdateModuleVariables>;
export function updateModule(dc: DataConnect, vars: UpdateModuleVariables): MutationPromise<UpdateModuleData, UpdateModuleVariables>;

interface DeleteModuleRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteModuleVariables): MutationRef<DeleteModuleData, DeleteModuleVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteModuleVariables): MutationRef<DeleteModuleData, DeleteModuleVariables>;
  operationName: string;
}
export const deleteModuleRef: DeleteModuleRef;

export function deleteModule(vars: DeleteModuleVariables): MutationPromise<DeleteModuleData, DeleteModuleVariables>;
export function deleteModule(dc: DataConnect, vars: DeleteModuleVariables): MutationPromise<DeleteModuleData, DeleteModuleVariables>;

interface GetModuleRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetModuleVariables): QueryRef<GetModuleData, GetModuleVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetModuleVariables): QueryRef<GetModuleData, GetModuleVariables>;
  operationName: string;
}
export const getModuleRef: GetModuleRef;

export function getModule(vars: GetModuleVariables, options?: ExecuteQueryOptions): QueryPromise<GetModuleData, GetModuleVariables>;
export function getModule(dc: DataConnect, vars: GetModuleVariables, options?: ExecuteQueryOptions): QueryPromise<GetModuleData, GetModuleVariables>;

interface ListModulesByCourseRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListModulesByCourseVariables): QueryRef<ListModulesByCourseData, ListModulesByCourseVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListModulesByCourseVariables): QueryRef<ListModulesByCourseData, ListModulesByCourseVariables>;
  operationName: string;
}
export const listModulesByCourseRef: ListModulesByCourseRef;

export function listModulesByCourse(vars: ListModulesByCourseVariables, options?: ExecuteQueryOptions): QueryPromise<ListModulesByCourseData, ListModulesByCourseVariables>;
export function listModulesByCourse(dc: DataConnect, vars: ListModulesByCourseVariables, options?: ExecuteQueryOptions): QueryPromise<ListModulesByCourseData, ListModulesByCourseVariables>;

interface EnrollInCourseRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: EnrollInCourseVariables): MutationRef<EnrollInCourseData, EnrollInCourseVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: EnrollInCourseVariables): MutationRef<EnrollInCourseData, EnrollInCourseVariables>;
  operationName: string;
}
export const enrollInCourseRef: EnrollInCourseRef;

export function enrollInCourse(vars: EnrollInCourseVariables): MutationPromise<EnrollInCourseData, EnrollInCourseVariables>;
export function enrollInCourse(dc: DataConnect, vars: EnrollInCourseVariables): MutationPromise<EnrollInCourseData, EnrollInCourseVariables>;

interface UpdateEnrollmentStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateEnrollmentStatusVariables): MutationRef<UpdateEnrollmentStatusData, UpdateEnrollmentStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateEnrollmentStatusVariables): MutationRef<UpdateEnrollmentStatusData, UpdateEnrollmentStatusVariables>;
  operationName: string;
}
export const updateEnrollmentStatusRef: UpdateEnrollmentStatusRef;

export function updateEnrollmentStatus(vars: UpdateEnrollmentStatusVariables): MutationPromise<UpdateEnrollmentStatusData, UpdateEnrollmentStatusVariables>;
export function updateEnrollmentStatus(dc: DataConnect, vars: UpdateEnrollmentStatusVariables): MutationPromise<UpdateEnrollmentStatusData, UpdateEnrollmentStatusVariables>;

interface CancelEnrollmentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CancelEnrollmentVariables): MutationRef<CancelEnrollmentData, CancelEnrollmentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CancelEnrollmentVariables): MutationRef<CancelEnrollmentData, CancelEnrollmentVariables>;
  operationName: string;
}
export const cancelEnrollmentRef: CancelEnrollmentRef;

export function cancelEnrollment(vars: CancelEnrollmentVariables): MutationPromise<CancelEnrollmentData, CancelEnrollmentVariables>;
export function cancelEnrollment(dc: DataConnect, vars: CancelEnrollmentVariables): MutationPromise<CancelEnrollmentData, CancelEnrollmentVariables>;

interface GetMyEnrollmentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMyEnrollmentVariables): QueryRef<GetMyEnrollmentData, GetMyEnrollmentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetMyEnrollmentVariables): QueryRef<GetMyEnrollmentData, GetMyEnrollmentVariables>;
  operationName: string;
}
export const getMyEnrollmentRef: GetMyEnrollmentRef;

export function getMyEnrollment(vars: GetMyEnrollmentVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyEnrollmentData, GetMyEnrollmentVariables>;
export function getMyEnrollment(dc: DataConnect, vars: GetMyEnrollmentVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyEnrollmentData, GetMyEnrollmentVariables>;

interface ListMyEnrollmentsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyEnrollmentsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListMyEnrollmentsData, undefined>;
  operationName: string;
}
export const listMyEnrollmentsRef: ListMyEnrollmentsRef;

export function listMyEnrollments(options?: ExecuteQueryOptions): QueryPromise<ListMyEnrollmentsData, undefined>;
export function listMyEnrollments(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyEnrollmentsData, undefined>;

interface CreateAssignmentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAssignmentVariables): MutationRef<CreateAssignmentData, CreateAssignmentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAssignmentVariables): MutationRef<CreateAssignmentData, CreateAssignmentVariables>;
  operationName: string;
}
export const createAssignmentRef: CreateAssignmentRef;

export function createAssignment(vars: CreateAssignmentVariables): MutationPromise<CreateAssignmentData, CreateAssignmentVariables>;
export function createAssignment(dc: DataConnect, vars: CreateAssignmentVariables): MutationPromise<CreateAssignmentData, CreateAssignmentVariables>;

interface UpdateAssignmentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAssignmentVariables): MutationRef<UpdateAssignmentData, UpdateAssignmentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateAssignmentVariables): MutationRef<UpdateAssignmentData, UpdateAssignmentVariables>;
  operationName: string;
}
export const updateAssignmentRef: UpdateAssignmentRef;

export function updateAssignment(vars: UpdateAssignmentVariables): MutationPromise<UpdateAssignmentData, UpdateAssignmentVariables>;
export function updateAssignment(dc: DataConnect, vars: UpdateAssignmentVariables): MutationPromise<UpdateAssignmentData, UpdateAssignmentVariables>;

interface DeleteAssignmentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteAssignmentVariables): MutationRef<DeleteAssignmentData, DeleteAssignmentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteAssignmentVariables): MutationRef<DeleteAssignmentData, DeleteAssignmentVariables>;
  operationName: string;
}
export const deleteAssignmentRef: DeleteAssignmentRef;

export function deleteAssignment(vars: DeleteAssignmentVariables): MutationPromise<DeleteAssignmentData, DeleteAssignmentVariables>;
export function deleteAssignment(dc: DataConnect, vars: DeleteAssignmentVariables): MutationPromise<DeleteAssignmentData, DeleteAssignmentVariables>;

interface GetAssignmentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetAssignmentVariables): QueryRef<GetAssignmentData, GetAssignmentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetAssignmentVariables): QueryRef<GetAssignmentData, GetAssignmentVariables>;
  operationName: string;
}
export const getAssignmentRef: GetAssignmentRef;

export function getAssignment(vars: GetAssignmentVariables, options?: ExecuteQueryOptions): QueryPromise<GetAssignmentData, GetAssignmentVariables>;
export function getAssignment(dc: DataConnect, vars: GetAssignmentVariables, options?: ExecuteQueryOptions): QueryPromise<GetAssignmentData, GetAssignmentVariables>;

interface ListAssignmentsByModuleRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListAssignmentsByModuleVariables): QueryRef<ListAssignmentsByModuleData, ListAssignmentsByModuleVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListAssignmentsByModuleVariables): QueryRef<ListAssignmentsByModuleData, ListAssignmentsByModuleVariables>;
  operationName: string;
}
export const listAssignmentsByModuleRef: ListAssignmentsByModuleRef;

export function listAssignmentsByModule(vars: ListAssignmentsByModuleVariables, options?: ExecuteQueryOptions): QueryPromise<ListAssignmentsByModuleData, ListAssignmentsByModuleVariables>;
export function listAssignmentsByModule(dc: DataConnect, vars: ListAssignmentsByModuleVariables, options?: ExecuteQueryOptions): QueryPromise<ListAssignmentsByModuleData, ListAssignmentsByModuleVariables>;

interface SubmitAssignmentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SubmitAssignmentVariables): MutationRef<SubmitAssignmentData, SubmitAssignmentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SubmitAssignmentVariables): MutationRef<SubmitAssignmentData, SubmitAssignmentVariables>;
  operationName: string;
}
export const submitAssignmentRef: SubmitAssignmentRef;

export function submitAssignment(vars: SubmitAssignmentVariables): MutationPromise<SubmitAssignmentData, SubmitAssignmentVariables>;
export function submitAssignment(dc: DataConnect, vars: SubmitAssignmentVariables): MutationPromise<SubmitAssignmentData, SubmitAssignmentVariables>;

interface UpdateGradeRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateGradeVariables): MutationRef<UpdateGradeData, UpdateGradeVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateGradeVariables): MutationRef<UpdateGradeData, UpdateGradeVariables>;
  operationName: string;
}
export const updateGradeRef: UpdateGradeRef;

export function updateGrade(vars: UpdateGradeVariables): MutationPromise<UpdateGradeData, UpdateGradeVariables>;
export function updateGrade(dc: DataConnect, vars: UpdateGradeVariables): MutationPromise<UpdateGradeData, UpdateGradeVariables>;

interface DeleteSubmissionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteSubmissionVariables): MutationRef<DeleteSubmissionData, DeleteSubmissionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteSubmissionVariables): MutationRef<DeleteSubmissionData, DeleteSubmissionVariables>;
  operationName: string;
}
export const deleteSubmissionRef: DeleteSubmissionRef;

export function deleteSubmission(vars: DeleteSubmissionVariables): MutationPromise<DeleteSubmissionData, DeleteSubmissionVariables>;
export function deleteSubmission(dc: DataConnect, vars: DeleteSubmissionVariables): MutationPromise<DeleteSubmissionData, DeleteSubmissionVariables>;

interface GetSubmissionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSubmissionVariables): QueryRef<GetSubmissionData, GetSubmissionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetSubmissionVariables): QueryRef<GetSubmissionData, GetSubmissionVariables>;
  operationName: string;
}
export const getSubmissionRef: GetSubmissionRef;

export function getSubmission(vars: GetSubmissionVariables, options?: ExecuteQueryOptions): QueryPromise<GetSubmissionData, GetSubmissionVariables>;
export function getSubmission(dc: DataConnect, vars: GetSubmissionVariables, options?: ExecuteQueryOptions): QueryPromise<GetSubmissionData, GetSubmissionVariables>;

interface ListMySubmissionsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMySubmissionsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListMySubmissionsData, undefined>;
  operationName: string;
}
export const listMySubmissionsRef: ListMySubmissionsRef;

export function listMySubmissions(options?: ExecuteQueryOptions): QueryPromise<ListMySubmissionsData, undefined>;
export function listMySubmissions(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMySubmissionsData, undefined>;

