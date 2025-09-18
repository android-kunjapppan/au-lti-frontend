<template>
  <div>
    <button
      @click="openModal"
      class="btn btn-outline-primary filter-btn px-space-md py-space-xs fw-bold">
      <i-custom-filter-red class="filter-icon filter-icon-red" />
      <i-custom-filter-white class="filter-icon filter-icon-white" />
      Filters
      <span v-if="filtersCount > 0"> ({{ filtersCount }})</span>
    </button>
    <RdsModal v-bind="modalProps" :visible="showModal" @hidden="hideModal">
      <div class="p-space-xs">
        <!-- Loading indicator -->
        <div v-if="loadingData" class="text-center mb-space-md">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <div class="mt-space-xxs text-muted">Loading filters...</div>
        </div>

        <div class="mb-space-xs">
          <label class="form-label fw-semibold mb-space-xs">Date Range</label>
          <div
            class="d-flex justify-content-between align-items-center gap-space-xs">
            <DateInput
              ref="startDateInput"
              v-model="dateRange.start"
              :max-date="dateRange.end"
              placeholder="Start date"
              :show-format-hint="false"
              @validation-change="handleStartDateValidation" />
            <span class="mx-space-xxs text-muted">to</span>
            <DateInput
              ref="endDateInput"
              v-model="dateRange.end"
              :min-date="dateRange.start"
              placeholder="End date"
              :show-format-hint="false"
              @validation-change="handleEndDateValidation" />
          </div>
          <div v-if="dateRangeError" class="mt-space-xxs">
            <small class="text-danger">{{ dateRangeError }}</small>
          </div>
        </div>
        <div class="mb-space-xs">
          <label class="form-label fw-semibold">Assignment Type</label>
          <div class="d-flex gap-space-xs align-items-center">
            <div class="form-check">
              <input
                class="form-check-input"
                type="checkbox"
                id="practice-checkbox"
                v-model="assignmentTypeFilter.practice" />
              <label class="form-check-label" for="practice-checkbox">
                Practice Assignments
              </label>
            </div>
            <div class="form-check">
              <input
                class="form-check-input"
                type="checkbox"
                id="test-checkbox"
                v-model="assignmentTypeFilter.test" />
              <label class="form-check-label" for="test-checkbox">
                Showcase Assignments
              </label>
            </div>
          </div>
        </div>
        <div class="mb-space-xs">
          <div class="d-flex flex-column gap-space-md">
            <div v-if="isInstructor" class="flex-grow-1">
              <label class="form-label fw-semibold">Students</label>
              <MultiSelectFilter
                ref="studentFilter"
                :items="studentList"
                v-model="selectedStudentNames"
                placeholder="Search student's name" />
            </div>
            <div class="flex-grow-1">
              <label class="form-label fw-semibold">Assignments</label>
              <MultiSelectFilter
                ref="assignmentFilter"
                :items="assignmentList"
                v-model="selectedAssignmentIds"
                placeholder="Search assignment" />
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="d-flex justify-content-end gap-space-xs">
          <button
            class="btn btn-outline-dark-3 px-space-md py-space-xs"
            @click="clearFilters">
            Clear
          </button>
          <button
            class="btn btn-primary px-space-md py-space-xs"
            :class="{ 'btn-disabled': !canApplyFilters }"
            :disabled="!canApplyFilters"
            @click="applyFilters">
            Apply
          </button>
        </div>
      </template>
    </RdsModal>
  </div>
</template>

<script setup lang="ts">
import { RdsModal } from "@rds-vue-ui/rds-modal";
import { computed, reactive, ref, watch } from "vue";
import type {
  CanvasAssignment,
  CanvasUser,
  DashboardFilters,
} from "~/types/types";
import DateInput from "../DateInput.vue";
import MultiSelectFilter from "./MultiSelectFilter.vue";

// Default filters constant
const defaultFilters: DashboardFilters = {
  dateRange: { start: "", end: "" },
  selectedStudentNames: [],
  selectedAssignmentIds: [],
  assignmentTypeFilter: { practice: false, test: false },
};

const props = defineProps({
  students: {
    type: Array,
    default: () => [],
  },
  isInstructor: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["filter-change"]);

const showModal = ref(false);
const loadingData = ref(false);

// UI state - separate reactive refs for template bindings
const dateRange = reactive({
  start: "",
  end: "",
});
const selectedStudentNames = ref<string[]>([]);
const selectedAssignmentIds = ref<string[]>([]);
const assignmentTypeFilter = reactive({
  practice: false,
  test: false,
});

// Applied filters state - tracks what filters are actually applied
const appliedFilters = ref<DashboardFilters>({ ...defaultFilters });

const allStudentsData = ref<CanvasUser[]>([]); // full student list fetched from backend
const allAssignmentsData = ref<CanvasAssignment[]>([]); // full assignment list fetched from backend

// Refs for DateInput components to access their methods
const startDateInput = ref<InstanceType<typeof DateInput>>();
const endDateInput = ref<InstanceType<typeof DateInput>>();

// Refs for MultiSelectFilter components to access their methods
const studentFilter = ref<InstanceType<typeof MultiSelectFilter>>();
const assignmentFilter = ref<InstanceType<typeof MultiSelectFilter>>();

// Date validation state
const dateRangeError = ref<string | null>(null);
const startDateValid = ref(true);
const endDateValid = ref(true);

// Computed property to count active filters (only applied filters)
const filtersCount = computed(() => {
  let count = 0;

  // Count date range filters
  if (
    appliedFilters.value.dateRange.start ||
    appliedFilters.value.dateRange.end
  )
    count++;

  // Count assignment type filters
  if (
    appliedFilters.value.assignmentTypeFilter.practice ||
    appliedFilters.value.assignmentTypeFilter.test
  )
    count++;

  // Count student filters
  if (appliedFilters.value.selectedStudentNames.length > 0) count++;

  // Count assignment filters
  if (appliedFilters.value.selectedAssignmentIds.length > 0) count++;

  return count;
});

// Computed property to check if filters can be applied
const canApplyFilters = computed(() => {
  // Check if there are any validation errors
  if (dateRangeError.value) {
    return false;
  }

  // Check if individual date validations pass (only for non-empty dates)
  const hasStartDate = !!dateRange.start;
  const hasEndDate = !!dateRange.end;

  if (hasStartDate && !startDateValid.value) return false;
  if (hasEndDate && !endDateValid.value) return false;

  // Check if at least one filter is selected
  const hasDateFilter = hasStartDate || hasEndDate;
  const hasAssignmentTypeFilter =
    assignmentTypeFilter.practice || assignmentTypeFilter.test;
  const hasStudentFilter = selectedStudentNames.value.length > 0;
  const hasAssignmentFilter = selectedAssignmentIds.value.length > 0;

  return (
    hasDateFilter ||
    hasAssignmentTypeFilter ||
    hasStudentFilter ||
    hasAssignmentFilter
  );
});

const modalProps = {
  title: "Filters",
  titleVariant: "dark-3",
  headerText: "",
  size: "lg" as const,
  centered: true,
  bgVariant: "white",
  overlayColor: "var(--rds-dark-3, #191919)",
  overlayOpacity: 0.7,
  exteriorCloseBtn: false,
  useCustomClose: false,
  borderRadius: 1 as const,
  teleport: true,
  teleportLocation: "body",
  expandHeight: false,
  removePadding: false,
};

// computed for MultiSelectFilter input
const studentList = computed(() =>
  allStudentsData.value.map((student: CanvasUser) => ({
    id: student.User_UUID,
    title: student.Name,
    studentName: student.Name,
  }))
);

// computed for assignment list
const assignmentList = computed(() => {
  return allAssignmentsData.value.map((assignment: CanvasAssignment) => ({
    id: assignment.Assignment_UUID,
    title: assignment.Name,
    isTest: assignment.IsTest,
  }));
});

function getLtik() {
  const route = useRoute();
  const ltik = route.query.ltik;
  if (!ltik || typeof ltik !== "string") throw new Error("Missing LTI key");
  return ltik;
}

async function fetchStudentsAndAssignments() {
  const config = useRuntimeConfig();
  loadingData.value = true;
  try {
    const url = `${config.public.httpApiUrl}/lti/dashboard/metadata`;
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        Authorization: "Bearer " + getLtik(),
      },
    });
    if (!res.ok) {
      console.error("Fetch failed with status:", res.status);
      allStudentsData.value = [];
      allAssignmentsData.value = [];
      return;
    }
    const data = (await res.json()) as {
      isInstructor?: boolean;
      students?: CanvasUser[];
      assignments: CanvasAssignment[];
    };
    // Only populate students if provided (instructor only)
    allStudentsData.value = Array.isArray(data.students) ? data.students : [];
    allAssignmentsData.value = Array.isArray(data.assignments)
      ? data.assignments
      : [];
  } catch (err) {
    console.error("Fetch failed:", err);
    allStudentsData.value = [];
    allAssignmentsData.value = [];
  } finally {
    loadingData.value = false;
  }
}

function openModal() {
  showModal.value = true;
  fetchStudentsAndAssignments();
  initializeFilterState();
}

function initializeFilterState() {
  // Initialize UI state with applied filters
  dateRange.start = appliedFilters.value.dateRange.start;
  dateRange.end = appliedFilters.value.dateRange.end;
  selectedStudentNames.value = [...appliedFilters.value.selectedStudentNames];
  selectedAssignmentIds.value = [...appliedFilters.value.selectedAssignmentIds];
  assignmentTypeFilter.practice =
    appliedFilters.value.assignmentTypeFilter.practice;
  assignmentTypeFilter.test = appliedFilters.value.assignmentTypeFilter.test;
}

function hideModal() {
  showModal.value = false;
}

function clearFilters() {
  // Clear UI state
  dateRange.start = "";
  dateRange.end = "";
  selectedStudentNames.value = [];
  selectedAssignmentIds.value = [];
  assignmentTypeFilter.practice = false;
  assignmentTypeFilter.test = false;

  // Reset applied filters to default state
  appliedFilters.value = { ...defaultFilters };

  // Reset validation state
  dateRangeError.value = null;
  startDateValid.value = true;
  endDateValid.value = true;

  // Reset DateInput components validation state
  if (startDateInput.value) {
    startDateInput.value.reset();
  }
  if (endDateInput.value) {
    endDateInput.value.reset();
  }

  // Reset MultiSelectFilter components
  if (studentFilter.value) {
    studentFilter.value.clearAllSelected();
  }
  if (assignmentFilter.value) {
    assignmentFilter.value.clearAllSelected();
  }

  emit("filter-change", null);
  // showModal.value = false;
}

// Date validation handlers
function handleStartDateValidation(isValid: boolean, error: string | null) {
  startDateValid.value = isValid;
  updateDateRangeError();
}

function handleEndDateValidation(isValid: boolean, error: string | null) {
  endDateValid.value = isValid;
  updateDateRangeError();
}

function updateDateRangeError() {
  // Clear any existing error first
  dateRangeError.value = null;

  // Only validate date range if both dates exist and are individually valid
  const hasStartDate = !!dateRange.start;
  const hasEndDate = !!dateRange.end;

  if (
    hasStartDate &&
    hasEndDate &&
    startDateValid.value &&
    endDateValid.value
  ) {
    // Check if start date is after end date
    if (dateRange.start > dateRange.end) {
      dateRangeError.value = "Start date must be before or equal to end date";
    }
  }
}

// Watcher to scroll modal to top when it becomes visible
watch(showModal, (newValue) => {
  if (newValue) {
    // Use a longer delay to ensure modal is fully rendered
    setTimeout(() => {
      const modal = document.querySelector(".modal");
      if (modal) {
        modal.scrollTop = 0;
      }
    }, 100);
  }
});

// Watchers to handle date clearing and update validation state
watch(
  () => dateRange.start,
  (newValue) => {
    // If start date is cleared, reset its validation state
    if (!newValue) {
      startDateValid.value = true;
    }
    updateDateRangeError();
  }
);

watch(
  () => dateRange.end,
  (newValue) => {
    // If end date is cleared, reset its validation state
    if (!newValue) {
      endDateValid.value = true;
    }
    updateDateRangeError();
  }
);

function applyFilters() {
  // Validate dates before applying filters
  if (dateRangeError.value) {
    return; // Don't apply filters if there are validation errors
  }

  // Check individual date validations (only for non-empty dates)
  const hasStartDate = !!dateRange.start;
  const hasEndDate = !!dateRange.end;

  if (hasStartDate && !startDateValid.value) return;
  if (hasEndDate && !endDateValid.value) return;

  // Update applied filters state directly from UI state
  appliedFilters.value = {
    dateRange: { start: dateRange.start, end: dateRange.end },
    selectedStudentNames: [...selectedStudentNames.value],
    selectedAssignmentIds: [...selectedAssignmentIds.value],
    assignmentTypeFilter: {
      practice: assignmentTypeFilter.practice,
      test: assignmentTypeFilter.test,
    },
  };

  emit("filter-change", {
    dateRange: { ...appliedFilters.value.dateRange },
    selectedStudentNames: [...appliedFilters.value.selectedStudentNames],
    selectedAssignmentIds: [...appliedFilters.value.selectedAssignmentIds],
    assignmentTypeFilter: { ...appliedFilters.value.assignmentTypeFilter },
  });
  showModal.value = false;
}
</script>

<style scoped>
.filter-btn {
  position: relative;
}

.filter-icon {
  transition: opacity 0.2s ease;
}

.filter-icon-red {
  opacity: 1;
}

.filter-icon-white {
  opacity: 0;
  position: absolute;
  top: 50%;
  left: 2rem;
  transform: translateY(-50%);
}

.filter-btn:hover .filter-icon-red {
  opacity: 0;
}

.filter-btn:hover .filter-icon-white {
  opacity: 1;
}

.form-control {
  color: var(--rds-dark-1);
}

.modal-footer {
  position: absolute;
  bottom: 0;
}

.btn-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-disabled:hover {
  opacity: 0.6;
}

.info-icon {
  font-style: normal;
  margin-right: 0.25rem;
  opacity: 0.8;
}
</style>
