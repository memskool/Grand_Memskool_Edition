import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

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

/** Generated Node Admin SDK operation action function for the 'CreateUser' Mutation. Allow users to execute without passing in DataConnect. */
export function createUser(dc: DataConnect, vars: CreateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserData>>;
/** Generated Node Admin SDK operation action function for the 'CreateUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function createUser(vars: CreateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateUser' Mutation. Allow users to execute without passing in DataConnect. */
export function updateUser(dc: DataConnect, vars?: UpdateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateUser(vars?: UpdateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteUser' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteUser(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteUserData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteUser(options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteUserData>>;

/** Generated Node Admin SDK operation action function for the 'GetCurrentUser' Query. Allow users to execute without passing in DataConnect. */
export function getCurrentUser(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCurrentUserData>>;
/** Generated Node Admin SDK operation action function for the 'GetCurrentUser' Query. Allow users to pass in custom DataConnect instances. */
export function getCurrentUser(options?: OperationOptions): Promise<ExecuteOperationResponse<GetCurrentUserData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllUsers' Query. Allow users to execute without passing in DataConnect. */
export function listAllUsers(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllUsersData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllUsers' Query. Allow users to pass in custom DataConnect instances. */
export function listAllUsers(options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllUsersData>>;

/** Generated Node Admin SDK operation action function for the 'CreateCourse' Mutation. Allow users to execute without passing in DataConnect. */
export function createCourse(dc: DataConnect, vars: CreateCourseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCourseData>>;
/** Generated Node Admin SDK operation action function for the 'CreateCourse' Mutation. Allow users to pass in custom DataConnect instances. */
export function createCourse(vars: CreateCourseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCourseData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateCourse' Mutation. Allow users to execute without passing in DataConnect. */
export function updateCourse(dc: DataConnect, vars: UpdateCourseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateCourseData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateCourse' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateCourse(vars: UpdateCourseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateCourseData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteCourse' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteCourse(dc: DataConnect, vars: DeleteCourseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteCourseData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteCourse' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteCourse(vars: DeleteCourseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteCourseData>>;

/** Generated Node Admin SDK operation action function for the 'GetCourse' Query. Allow users to execute without passing in DataConnect. */
export function getCourse(dc: DataConnect, vars: GetCourseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCourseData>>;
/** Generated Node Admin SDK operation action function for the 'GetCourse' Query. Allow users to pass in custom DataConnect instances. */
export function getCourse(vars: GetCourseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCourseData>>;

/** Generated Node Admin SDK operation action function for the 'ListCourses' Query. Allow users to execute without passing in DataConnect. */
export function listCourses(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCoursesData>>;
/** Generated Node Admin SDK operation action function for the 'ListCourses' Query. Allow users to pass in custom DataConnect instances. */
export function listCourses(options?: OperationOptions): Promise<ExecuteOperationResponse<ListCoursesData>>;

/** Generated Node Admin SDK operation action function for the 'CreateModule' Mutation. Allow users to execute without passing in DataConnect. */
export function createModule(dc: DataConnect, vars: CreateModuleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateModuleData>>;
/** Generated Node Admin SDK operation action function for the 'CreateModule' Mutation. Allow users to pass in custom DataConnect instances. */
export function createModule(vars: CreateModuleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateModuleData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateModule' Mutation. Allow users to execute without passing in DataConnect. */
export function updateModule(dc: DataConnect, vars: UpdateModuleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateModuleData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateModule' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateModule(vars: UpdateModuleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateModuleData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteModule' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteModule(dc: DataConnect, vars: DeleteModuleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteModuleData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteModule' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteModule(vars: DeleteModuleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteModuleData>>;

/** Generated Node Admin SDK operation action function for the 'GetModule' Query. Allow users to execute without passing in DataConnect. */
export function getModule(dc: DataConnect, vars: GetModuleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetModuleData>>;
/** Generated Node Admin SDK operation action function for the 'GetModule' Query. Allow users to pass in custom DataConnect instances. */
export function getModule(vars: GetModuleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetModuleData>>;

/** Generated Node Admin SDK operation action function for the 'ListModulesByCourse' Query. Allow users to execute without passing in DataConnect. */
export function listModulesByCourse(dc: DataConnect, vars: ListModulesByCourseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListModulesByCourseData>>;
/** Generated Node Admin SDK operation action function for the 'ListModulesByCourse' Query. Allow users to pass in custom DataConnect instances. */
export function listModulesByCourse(vars: ListModulesByCourseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListModulesByCourseData>>;

/** Generated Node Admin SDK operation action function for the 'EnrollInCourse' Mutation. Allow users to execute without passing in DataConnect. */
export function enrollInCourse(dc: DataConnect, vars: EnrollInCourseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<EnrollInCourseData>>;
/** Generated Node Admin SDK operation action function for the 'EnrollInCourse' Mutation. Allow users to pass in custom DataConnect instances. */
export function enrollInCourse(vars: EnrollInCourseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<EnrollInCourseData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateEnrollmentStatus' Mutation. Allow users to execute without passing in DataConnect. */
export function updateEnrollmentStatus(dc: DataConnect, vars: UpdateEnrollmentStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateEnrollmentStatusData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateEnrollmentStatus' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateEnrollmentStatus(vars: UpdateEnrollmentStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateEnrollmentStatusData>>;

/** Generated Node Admin SDK operation action function for the 'CancelEnrollment' Mutation. Allow users to execute without passing in DataConnect. */
export function cancelEnrollment(dc: DataConnect, vars: CancelEnrollmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CancelEnrollmentData>>;
/** Generated Node Admin SDK operation action function for the 'CancelEnrollment' Mutation. Allow users to pass in custom DataConnect instances. */
export function cancelEnrollment(vars: CancelEnrollmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CancelEnrollmentData>>;

/** Generated Node Admin SDK operation action function for the 'GetMyEnrollment' Query. Allow users to execute without passing in DataConnect. */
export function getMyEnrollment(dc: DataConnect, vars: GetMyEnrollmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyEnrollmentData>>;
/** Generated Node Admin SDK operation action function for the 'GetMyEnrollment' Query. Allow users to pass in custom DataConnect instances. */
export function getMyEnrollment(vars: GetMyEnrollmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyEnrollmentData>>;

/** Generated Node Admin SDK operation action function for the 'ListMyEnrollments' Query. Allow users to execute without passing in DataConnect. */
export function listMyEnrollments(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMyEnrollmentsData>>;
/** Generated Node Admin SDK operation action function for the 'ListMyEnrollments' Query. Allow users to pass in custom DataConnect instances. */
export function listMyEnrollments(options?: OperationOptions): Promise<ExecuteOperationResponse<ListMyEnrollmentsData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAssignment' Mutation. Allow users to execute without passing in DataConnect. */
export function createAssignment(dc: DataConnect, vars: CreateAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAssignmentData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAssignment' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAssignment(vars: CreateAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAssignmentData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateAssignment' Mutation. Allow users to execute without passing in DataConnect. */
export function updateAssignment(dc: DataConnect, vars: UpdateAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAssignmentData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateAssignment' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateAssignment(vars: UpdateAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAssignmentData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteAssignment' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteAssignment(dc: DataConnect, vars: DeleteAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteAssignmentData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteAssignment' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteAssignment(vars: DeleteAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteAssignmentData>>;

/** Generated Node Admin SDK operation action function for the 'GetAssignment' Query. Allow users to execute without passing in DataConnect. */
export function getAssignment(dc: DataConnect, vars: GetAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAssignmentData>>;
/** Generated Node Admin SDK operation action function for the 'GetAssignment' Query. Allow users to pass in custom DataConnect instances. */
export function getAssignment(vars: GetAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAssignmentData>>;

/** Generated Node Admin SDK operation action function for the 'ListAssignmentsByModule' Query. Allow users to execute without passing in DataConnect. */
export function listAssignmentsByModule(dc: DataConnect, vars: ListAssignmentsByModuleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAssignmentsByModuleData>>;
/** Generated Node Admin SDK operation action function for the 'ListAssignmentsByModule' Query. Allow users to pass in custom DataConnect instances. */
export function listAssignmentsByModule(vars: ListAssignmentsByModuleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAssignmentsByModuleData>>;

/** Generated Node Admin SDK operation action function for the 'SubmitAssignment' Mutation. Allow users to execute without passing in DataConnect. */
export function submitAssignment(dc: DataConnect, vars: SubmitAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SubmitAssignmentData>>;
/** Generated Node Admin SDK operation action function for the 'SubmitAssignment' Mutation. Allow users to pass in custom DataConnect instances. */
export function submitAssignment(vars: SubmitAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SubmitAssignmentData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateGrade' Mutation. Allow users to execute without passing in DataConnect. */
export function updateGrade(dc: DataConnect, vars: UpdateGradeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateGradeData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateGrade' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateGrade(vars: UpdateGradeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateGradeData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteSubmission' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteSubmission(dc: DataConnect, vars: DeleteSubmissionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteSubmissionData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteSubmission' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteSubmission(vars: DeleteSubmissionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteSubmissionData>>;

/** Generated Node Admin SDK operation action function for the 'GetSubmission' Query. Allow users to execute without passing in DataConnect. */
export function getSubmission(dc: DataConnect, vars: GetSubmissionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSubmissionData>>;
/** Generated Node Admin SDK operation action function for the 'GetSubmission' Query. Allow users to pass in custom DataConnect instances. */
export function getSubmission(vars: GetSubmissionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSubmissionData>>;

/** Generated Node Admin SDK operation action function for the 'ListMySubmissions' Query. Allow users to execute without passing in DataConnect. */
export function listMySubmissions(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMySubmissionsData>>;
/** Generated Node Admin SDK operation action function for the 'ListMySubmissions' Query. Allow users to pass in custom DataConnect instances. */
export function listMySubmissions(options?: OperationOptions): Promise<ExecuteOperationResponse<ListMySubmissionsData>>;

