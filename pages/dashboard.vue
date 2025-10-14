<template>
  <!-- Loading Spinner -->
  <LoadingSpinner v-if="isLoading"> Loading Dashboard... </LoadingSpinner>
  <!-- Dashboard Content -->
  <div
    v-else
    class="container-fluid pt-space-xl px-space-md d-flex flex-column gap-space-md">
    <!-- Dashboard Header -->
    <div class="d-flex flex-column gap-space-xxs">
      <span class="language-buddy-text text-dark-3 mb-space-xxxs"
        >Language Buddy™</span
      >
      <h1 class="h1-small">
        {{ isInstructor ? "Instructor Dashboard" : "Student Dashboard" }}
      </h1>
    </div>

    <!-- Instructor View -->
    <div v-if="isInstructor" class="d-flex flex-column gap-space-md">
      <!-- Search and Filter Row -->
      <div class="d-flex justify-content-between align-items-center">
        <SearchComponent
          v-model="searchQuery"
          @search="handleSearch"
          placeholder="Search by assignment title or student name"
          :debounce-ms="500"
          size="large" />
        <FilterButton
          :students="students"
          :is-instructor="isInstructor"
          @filter-change="handleFilterChange" />
      </div>

      <!-- Students Table -->
      <StudentsTable
        :students="paginatedStudents"
        :sort-column="sortColumn"
        :sort-direction="sortDirection"
        :open-student-accordion="openStudentAccordion"
        @sort="handleSort"
        @toggle-accordion="toggleStudentAccordion"
        @show-assignment-details="showAssignmentDetails" />

      <!-- Pagination -->
      <div
        class="d-flex justify-content-between align-items-center pt-space-xxs pb-space-xxs border-top">
        <div class="small">
          Showing {{ pageStart }} to {{ pageEnd }} of
          {{ pagination.totalItems }} students
        </div>
        <PaginationComponent
          :has-previous="
            pagination.previousCursors && pagination.previousCursors.length > 1
          "
          :has-next="pageEnd < pagination.totalItems"
          @previous="loadPreviousPage"
          @next="loadNextPage" />
      </div>
    </div>

    <!-- Student View -->
    <div v-else>
      <!-- Student Overview Section -->
      <StudentOverview :current-student="currentStudent" />

      <!-- Student Assignments Section -->
      <StudentAssignmentsSection
        :current-student="currentStudent"
        :students="students"
        :is-instructor="isInstructor"
        @filter-change="handleFilterChange"
        @show-assignment-details="showAssignmentDetails" />
    </div>

    <!-- Assignment Details Modal -->
    <AssignmentDetailsModal
      :visible="showModal"
      :assignment="selectedAssignment"
      :is-instructor="isInstructor"
      @close="closeModal"
      @send-feedback="handleModalFeedback" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import AssignmentDetailsModal, {
  type SendFeedbackPayload,
} from "~/components/dashboard/AssignmentDetailsModal.vue";
import FilterButton from "~/components/dashboard/FilterButton.vue";
import PaginationComponent from "~/components/dashboard/PaginationComponent.vue";
import SearchComponent from "~/components/dashboard/SearchComponent.vue";
import type { SortEventPayload } from "~/components/dashboard/SortableTableHeader.vue";
import StudentAssignmentsSection from "~/components/dashboard/StudentAssignmentsSection.vue";
import StudentOverview from "~/components/dashboard/StudentOverview.vue";
import StudentsTable from "~/components/dashboard/StudentsTable.vue";
import LoadingSpinner from "~/components/LoadingSpinner.vue";
import {
  useDashboardData,
  type Assignment,
  type ProcessedAssignment,
} from "~/composables/useDashboardData";
import type { DashboardFilters } from "~/types/types";

definePageMeta({
  middleware: "dashboard-auth",
});

// Use the dashboard data composable
const {
  students,
  currentStudent,
  isInstructor,
  pagination,
  openStudentAccordion,
  currentPage,
  searchQuery,
  dateFilter,
  sortColumn,
  sortDirection,
  selectedStudentNames,
  selectedAssignmentIds,
  assignmentTypeFilter,
  paginatedStudents,
  pageStart,
  pageEnd,
  searchConversations,
  loadNextPage,
  loadPreviousPage,
  refreshAudioUrls,
  sendInstructorFeedback,
  applySorting,
} = useDashboardData();

// Modal state
const showModal = ref(false);
const isLoading = ref(false);
const selectedAssignment = ref<ProcessedAssignment | null>(null);

// Event handlers
async function handleSearch(query: string) {
  try {
    // Close any open accordion when search changes
    openStudentAccordion.value = null;

    searchQuery.value = query;

    if (!query) {
      selectedStudentNames.value = [];
      selectedAssignmentIds.value = [];
      pagination.value.nextCursor = null;
      pagination.value.previousCursors = [null];
      currentPage.value = 1;
      await searchConversations("", null, pagination.value.itemsPerPage);
    } else {
      pagination.value.nextCursor = null;
      pagination.value.previousCursors = [null];
      currentPage.value = 1;
      await searchConversations(query, null, pagination.value.itemsPerPage);
    }

    applySorting();
  } catch (error) {
    console.error("Search failed:", error);
    // Fallback to search with empty query if search fails
    try {
      await searchConversations("", null, pagination.value.itemsPerPage);
    } catch (fallbackError) {
      console.error("Fallback search also failed:", fallbackError);
    }
  }
}

async function handleFilterChange(filters: DashboardFilters | null) {
  try {
    // Close any open accordion when filters change
    openStudentAccordion.value = null;

    dateFilter.value = filters?.dateRange || null;
    selectedStudentNames.value = filters?.selectedStudentNames || [];
    selectedAssignmentIds.value = filters?.selectedAssignmentIds || [];
    assignmentTypeFilter.value = filters?.assignmentTypeFilter || {
      practice: false,
      test: false,
    };

    currentPage.value = 1;
    pagination.value.previousCursors = [null];

    await searchConversations(
      searchQuery.value || "",
      null,
      pagination.value.itemsPerPage
    );
    applySorting();
  } catch (error) {
    console.error("Filter change failed:", error);
    // Fallback to search with empty query if filter change fails
    try {
      await searchConversations("", null, pagination.value.itemsPerPage);
    } catch (fallbackError) {
      console.error("Fallback search also failed:", fallbackError);
    }
  }
}

function handleSort(sortData: SortEventPayload) {
  const { column, direction } = sortData;

  // Close any open accordion when sorting changes
  openStudentAccordion.value = null;

  if (column === null && direction === null) {
    // Return to unsorted state
    sortColumn.value = null;
    sortDirection.value = "asc";
  } else {
    // Set the new sort column and direction
    sortColumn.value = column;
    sortDirection.value = direction;
  }

  applySorting();
}

function toggleStudentAccordion(index: number) {
  if (openStudentAccordion.value === index) {
    openStudentAccordion.value = null;
  } else {
    openStudentAccordion.value = index;
  }
}

function showAssignmentDetails(assignment: Assignment) {
  selectedAssignment.value = assignment;
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  selectedAssignment.value = null;
}

async function handleModalFeedback({
  assignmentId,
  submissionId,
  feedback,
}: SendFeedbackPayload) {
  try {
    await sendInstructorFeedback({ submissionId, feedback });

    if (selectedAssignment.value?.submissions) {
      const submission = selectedAssignment.value.submissions.find(
        (s) =>
          s.submissionId === submissionId || s.submissionId === submissionId
      );
      if (submission) {
        submission.instructorFeedback = feedback;
      }
    }

    for (const student of students.value || []) {
      const assignment = student.assignments?.find(
        (a) => a.id === assignmentId
      );
      const submission = assignment?.submissions?.find(
        (s) =>
          s.submissionId === submissionId || s.submissionId === submissionId
      );
      if (submission) {
        submission.instructorFeedback = feedback;
        break;
      }
    }
  } catch (error) {
    console.error("Failed to send feedback:", error);
  }
}

// Initialize on mount
onMounted(() => {
  pagination.value.previousCursors = [null];
  isLoading.value = true;
  searchConversations("", null, pagination.value.itemsPerPage).finally(() => {
    isLoading.value = false;
  });

  // Set up audio URL refresh interval
  setInterval(
    () => {
      refreshAudioUrls();
    },
    45 * 60 * 1000
  );
});
</script>

<style scoped>
.container-fluid {
  font-family: "Arial", sans-serif;
  background: var(--rds-dashboard-bg);
  min-height: 100vh;
}

.language-buddy-text {
  font-size: 20px;
  font-weight: 700;
  line-height: 20.381px;
}

.card {
  border: 1px solid #e9ecef;
  transition: all 0.2s ease;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.badge {
  font-size: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
}
</style>
