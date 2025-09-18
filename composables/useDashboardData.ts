import { computed, ref, watch } from "vue";
import { getLatestSubmissionDate } from "~/utils/dateUtils";
import { calculateStudentTotalPracticeTime } from "~/utils/timeUtils";

interface DateFilter {
  start?: string;
  end?: string;
}

interface AssignmentTypeFilter {
  practice: boolean;
  test: boolean;
}

interface TranscriptItem {
  text: string;
  timestamp: number;
}

interface Submission {
  submissionId: string;
  duration: string;
  submittedAt: string;
  audioUrl: string;
  instructorFeedback?: string;
  aiFeedback?: string;
  transcript?: TranscriptItem[];
  pairsTotal?: number;
}

interface Assignment {
  id: string;
  title: string;
  isTest: boolean;
  allowed_attempts: number;
  submissions: Submission[];
}

interface Student {
  studentName: string;
  studentId: string;
  assignments: Assignment[];
}

interface ProcessedSubmission {
  id: string;
  duration: string;
  submittedAt: string;
  audioUrl: string;
  instructorFeedback?: string;
  aiFeedback?: string;
  transcript: TranscriptItem[];
  pairsTotal: number;
}

interface ProcessedAssignment {
  id: string;
  title: string;
  isTest: boolean;
  allowed_attempts: number;
  submissions: ProcessedSubmission[];
}

interface ProcessedStudent {
  name: string;
  id: string;
  assignments: ProcessedAssignment[];
  totalTimeFormatted: string;
  totalPracticeTimeFormatted: string;
  totalTestTimeFormatted: string;
  totalPracticeSubmissions: number;
  totalTestSubmissions: number;
  assignmentCount: number;
  sessionCount: number;
  lastSubmission: string;
}

type CursorType = string | Record<string, unknown> | null;

export function useDashboardData() {
  const students = ref<ProcessedStudent[]>([]);
  const filteredStudents = ref<ProcessedStudent[]>([]);
  const currentStudent = ref<ProcessedStudent | null>(null);
  const isInstructor = ref(false);
  const allStudents = ref<Student[]>([]);

  const pagination = ref({
    nextCursor: null as CursorType,
    previousCursors: [] as CursorType[],
    itemsPerPage: 10,
    totalItems: 0,
    totalPages: 1,
  });

  const openStudentAccordion = ref<number | null>(null);
  const currentPage = ref(1);
  const pageSize = ref(5);
  const searchQuery = ref("");
  const dateFilter = ref<DateFilter | null>(null);
  const sortColumn = ref<string | null>(null);
  const sortDirection = ref("asc");
  const selectedStudentNames = ref<string[]>([]);
  const selectedAssignmentIds = ref<string[]>([]);
  const assignmentTypeFilter = ref<AssignmentTypeFilter>({
    practice: false,
    test: false,
  });

  const config = useRuntimeConfig();

  function getLtik() {
    const route = useRoute();
    const ltik = route.query.ltik;
    if (!ltik || typeof ltik !== "string") throw new Error("Missing LTI key");
    return ltik;
  }

  async function searchConversations(
    searchQuery: string,
    cursor: CursorType = null,
    limit = pagination.value.itemsPerPage
  ) {
    try {
      const params = new URLSearchParams();
      params.append("limit", String(limit));

      // Only add query parameter if it's not empty
      if (searchQuery && searchQuery.trim()) {
        params.append("query", searchQuery);
      }

      if (cursor) {
        const cursorParam =
          typeof cursor === "string" ? cursor : JSON.stringify(cursor);
        // Do NOT pre-encode here; URLSearchParams encodes automatically
        params.append("cursor", cursorParam);
      }

      if (
        assignmentTypeFilter.value.practice &&
        !assignmentTypeFilter.value.test
      ) {
        params.append("isTest", "false");
      } else if (
        !assignmentTypeFilter.value.practice &&
        assignmentTypeFilter.value.test
      ) {
        params.append("isTest", "true");
      }

      if (dateFilter.value?.start) {
        params.append("startDate", dateFilter.value.start);
      }
      if (dateFilter.value?.end) {
        params.append("endDate", dateFilter.value.end);
      }

      // Add student and assignment filters
      if (selectedStudentNames.value && selectedStudentNames.value.length > 0) {
        params.append("studentIds", selectedStudentNames.value.join(","));
      }
      if (
        selectedAssignmentIds.value &&
        selectedAssignmentIds.value.length > 0
      ) {
        params.append("assignmentIds", selectedAssignmentIds.value.join(","));
      }

      const url = `${config.public.httpApiUrl}/lti/dashboard/search?${params.toString()}`;
      const res = await fetch(url, {
        credentials: "include",
        headers: {
          Authorization: "Bearer " + getLtik(),
        },
      });

      const result = await res.json();
      isInstructor.value = result.isInstructor;

      students.value = result.students.map((student: Student) => {
        const processedAssignments: ProcessedAssignment[] =
          student.assignments.map((assignment: Assignment) => ({
            id: assignment.id,
            title: assignment.title,
            isTest: assignment.isTest,
            allowed_attempts: assignment.allowed_attempts,
            submissions: assignment.submissions.map(
              (submission: Submission) => ({
                id: submission.submissionId,
                duration: submission.duration,
                submittedAt: submission.submittedAt,
                audioUrl: submission.audioUrl,
                instructorFeedback: submission.instructorFeedback,
                aiFeedback: submission.aiFeedback,
                transcript: submission.transcript || [],
                pairsTotal: submission.pairsTotal || 0,
              })
            ),
          }));

        const totalPracticeTimeFormatted = calculateStudentTotalPracticeTime(
          student.assignments.filter(
            (assignment: Assignment) => !assignment.isTest
          )
        );
        const totalTestTimeFormatted = calculateStudentTotalPracticeTime(
          student.assignments.filter(
            (assignment: Assignment) => assignment.isTest
          )
        );

        const totalPracticeSubmissions = student.assignments
          .filter((assignment: Assignment) => !assignment.isTest)
          .reduce(
            (total, assignment) => total + assignment.submissions.length,
            0
          );
        const totalTestSubmissions = student.assignments
          .filter((assignment: Assignment) => assignment.isTest)
          .reduce(
            (total, assignment) => total + assignment.submissions.length,
            0
          );

        const assignmentCount = student.assignments.length;
        const sessionCount = student.assignments.reduce(
          (total, assignment) => total + assignment.submissions.length,
          0
        );

        const lastSubmission = getLatestSubmissionDate(
          student.assignments.flatMap((assignment) => assignment.submissions),
          "time"
        );

        return {
          name: student.studentName,
          id: student.studentId,
          assignments: processedAssignments,
          totalTimeFormatted: totalPracticeTimeFormatted,
          totalPracticeTimeFormatted,
          totalTestTimeFormatted,
          totalPracticeSubmissions,
          totalTestSubmissions,
          assignmentCount,
          sessionCount,
          lastSubmission,
        };
      });

      // Update pagination
      const nextCursorRaw = result.pagination?.nextCursor;
      pagination.value.nextCursor = nextCursorRaw
        ? (() => {
            try {
              return JSON.parse(decodeURIComponent(nextCursorRaw));
            } catch {
              // Fallbacks: try raw JSON.parse, then raw string
              try {
                return JSON.parse(nextCursorRaw);
              } catch {
                return nextCursorRaw as unknown as CursorType;
              }
            }
          })()
        : null;

      // Maintain previous cursor stack similar to dashboardTest.vue
      let cursorObj: CursorType = cursor;
      if (typeof cursor === "string") {
        try {
          cursorObj = JSON.parse(cursor);
        } catch {
          cursorObj = cursor;
        }
      }
      if (
        cursorObj &&
        (pagination.value.previousCursors.length === 0 ||
          JSON.stringify(pagination.value.previousCursors.at(-1)) !==
            JSON.stringify(cursorObj))
      ) {
        pagination.value.previousCursors.push(cursorObj);
      }

      pagination.value.totalItems = result.pagination?.totalItems || 0;
      pagination.value.totalPages = Math.ceil(
        pagination.value.totalItems / pagination.value.itemsPerPage
      );
      return result;
    } catch (error) {
      console.error("Failed to search conversations:", error);
      throw error;
    }
  }

  async function fetchAllStudents() {
    try {
      const url = `${config.public.httpApiUrl}/lti/submitted/audio?all=true`;
      const res = await fetch(url, {
        credentials: "include",
        headers: {
          Authorization: "Bearer " + getLtik(),
        },
      });

      const data = await res.json();
      allStudents.value = data.students || [];
    } catch (err) {
      console.error("Failed to fetch all students:", err);
      allStudents.value = [];
    }
  }

  async function loadNextPage() {
    if (!pagination.value.nextCursor) return;

    // Always use search API (it handles empty queries)
    await searchConversations(
      searchQuery.value || "",
      pagination.value.nextCursor,
      pagination.value.itemsPerPage
    );
    currentPage.value++;
  }

  async function loadPreviousPage() {
    if (pagination.value.previousCursors.length < 2) return;
    pagination.value.previousCursors.pop();
    const previousCursor =
      pagination.value.previousCursors[
        pagination.value.previousCursors.length - 1
      ] || null;

    // Always use search API (it handles empty queries)
    await searchConversations(
      searchQuery.value || "",
      previousCursor,
      pagination.value.itemsPerPage
    );
    currentPage.value = Math.max(currentPage.value - 1, 1);
  }

  async function refreshAudioUrls() {
    try {
      const currentCursor =
        pagination.value.previousCursors.length > 0
          ? pagination.value.previousCursors[
              pagination.value.previousCursors.length - 1
            ]
          : null;

      // Always use search API (it handles empty queries)
      const params = new URLSearchParams();
      params.append("limit", String(pagination.value.itemsPerPage));

      // Add query parameter if it exists
      if (searchQuery.value && searchQuery.value.trim()) {
        params.append("query", searchQuery.value);
      }

      if (currentCursor) {
        const cursorParam =
          typeof currentCursor === "string"
            ? currentCursor
            : JSON.stringify(currentCursor);
        // Do NOT pre-encode here; URLSearchParams encodes automatically
        params.append("cursor", cursorParam);
      }

      // Add date filters if they exist
      if (dateFilter.value?.start) {
        params.append("startDate", dateFilter.value.start);
      }
      if (dateFilter.value?.end) {
        params.append("endDate", dateFilter.value.end);
      }

      // Add assignment type filters if they exist
      if (
        assignmentTypeFilter.value.practice &&
        !assignmentTypeFilter.value.test
      ) {
        params.append("isTest", "false");
      } else if (
        !assignmentTypeFilter.value.practice &&
        assignmentTypeFilter.value.test
      ) {
        params.append("isTest", "true");
      }

      // Add student and assignment filters
      if (selectedStudentNames.value && selectedStudentNames.value.length > 0) {
        params.append("studentIds", selectedStudentNames.value.join(","));
      }
      if (
        selectedAssignmentIds.value &&
        selectedAssignmentIds.value.length > 0
      ) {
        params.append("assignmentIds", selectedAssignmentIds.value.join(","));
      }

      const url = `${config.public.httpApiUrl}/lti/dashboard/search?${params.toString()}`;
      const res = await fetch(url, {
        credentials: "include",
        headers: {
          Authorization: "Bearer " + getLtik(),
        },
      });
      const result = await res.json();

      const audioUrlMap = new Map();

      result.students.forEach((student: Student) => {
        student.assignments.forEach((assignment: Assignment) => {
          assignment.submissions.forEach((submission: Submission) => {
            audioUrlMap.set(submission.submissionId, submission.audioUrl);
          });
        });
      });

      const updateAudioUrls = (studentList: ProcessedStudent[]) => {
        studentList.forEach((student) => {
          student.assignments.forEach((assignment: ProcessedAssignment) => {
            assignment.submissions.forEach(
              (submission: ProcessedSubmission) => {
                if (audioUrlMap.has(submission.id)) {
                  submission.audioUrl = audioUrlMap.get(submission.id);
                }
              }
            );
          });
        });
      };

      updateAudioUrls(students.value);
      updateAudioUrls(filteredStudents.value);
    } catch (err) {
      console.error("Failed to refresh audio URLs:", err);
    }
  }

  async function sendInstructorFeedback({
    submissionId,
    feedback,
  }: {
    submissionId: string;
    feedback: string;
  }) {
    try {
      const res = await fetch(
        `${config.public.httpApiUrl}/lti/submitted/audio/feedback/${submissionId}`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + getLtik(),
          },
          body: JSON.stringify({ instructorFeedback: feedback }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to send feedback");
      }

      const result = await res.json();
      return result;
    } catch (err) {
      console.error("Error sending feedback:", err);
      throw err;
    }
  }

  const paginatedStudents = computed(() => filteredStudents.value);

  // Watch for changes in students and automatically update filteredStudents
  watch(
    students,
    (newStudents) => {
      filteredStudents.value = [...newStudents];

      // Update currentStudent for non-instructor users when students change
      if (!isInstructor.value && newStudents.length > 0) {
        currentStudent.value = newStudents[0];
      }
      if (!isInstructor.value && newStudents.length == 0) {
        currentStudent.value = null;
      }
    },
    { immediate: true }
  );

  const pageStart = computed(() =>
    pagination.value.previousCursors.length > 1
      ? (pagination.value.previousCursors.length - 1) *
          pagination.value.itemsPerPage +
        1
      : 1
  );

  const pageEnd = computed(
    () => pageStart.value + filteredStudents.value.length - 1
  );

  function timeToSeconds(timeString: string): number {
    if (!timeString) return 0;
    const parts = timeString.split(":");
    if (parts.length === 2) {
      const minutes = parseInt(parts[0]) || 0;
      const seconds = parseInt(parts[1]) || 0;
      return minutes * 60 + seconds;
    } else if (parts.length === 3) {
      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      const seconds = parseInt(parts[2]) || 0;
      return hours * 3600 + minutes * 60 + seconds;
    }
    return 0;
  }

  function applySorting() {
    if (!sortColumn.value) {
      // Restore original order by copying from the source students array
      filteredStudents.value = [...students.value];
      return;
    }

    filteredStudents.value.sort((a: ProcessedStudent, b: ProcessedStudent) => {
      let valA: string | number | Date, valB: string | number | Date;

      switch (sortColumn.value) {
        case "lastSubmission":
          valA = new Date(a.lastSubmission === "N/A" ? 0 : a.lastSubmission);
          valB = new Date(b.lastSubmission === "N/A" ? 0 : b.lastSubmission);
          break;
        case "totalTime":
          valA = timeToSeconds(a.totalTimeFormatted);
          valB = timeToSeconds(b.totalTimeFormatted);
          break;
        case "totalPracticeTime":
          valA = timeToSeconds(a.totalPracticeTimeFormatted);
          valB = timeToSeconds(b.totalPracticeTimeFormatted);
          break;
        case "totalTestTime":
          valA = timeToSeconds(a.totalTestTimeFormatted);
          valB = timeToSeconds(b.totalTestTimeFormatted);
          break;
        case "totalPracticeSubmissions":
          valA = a.totalPracticeSubmissions;
          valB = b.totalPracticeSubmissions;
          break;
        case "totalTestSubmissions":
          valA = a.totalTestSubmissions;
          valB = b.totalTestSubmissions;
          break;
        case "assignmentCount":
          valA = a.assignmentCount;
          valB = b.assignmentCount;
          break;
        case "name":
          valA = a.name ? a.name.toString().toLowerCase() : "";
          valB = b.name ? b.name.toString().toLowerCase() : "";
          break;
        default:
          valA = a[sortColumn.value as keyof ProcessedStudent]
            ? a[sortColumn.value as keyof ProcessedStudent]
                ?.toString()
                .toLowerCase()
            : "";
          valB = b[sortColumn.value as keyof ProcessedStudent]
            ? b[sortColumn.value as keyof ProcessedStudent]
                ?.toString()
                .toLowerCase()
            : "";
          break;
      }

      if (valA < valB) return sortDirection.value === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection.value === "asc" ? 1 : -1;
      return 0;
    });
  }

  return {
    // State
    students,
    filteredStudents,
    currentStudent,
    isInstructor,
    allStudents,
    pagination,
    openStudentAccordion,
    currentPage,
    pageSize,
    searchQuery,
    dateFilter,
    sortColumn,
    sortDirection,
    selectedStudentNames,
    selectedAssignmentIds,
    assignmentTypeFilter,

    // Computed
    paginatedStudents,
    pageStart,
    pageEnd,

    // Methods
    searchConversations,
    fetchAllStudents,
    loadNextPage,
    loadPreviousPage,
    refreshAudioUrls,
    sendInstructorFeedback,
    applySorting,
    timeToSeconds,
  };
}
