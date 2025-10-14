<template>
  <div class="table-responsive">
    <table class="table table-hover align-middle bg-white rounded-lg border">
      <thead class="table-dark">
        <tr>
          <th scope="col" style="width: 50px"></th>
          <SortableTableHeader
            column="name"
            label="Student Name"
            :sort-column="sortColumn"
            :sort-direction="sortDirection"
            @sort="handleSort" />
          <SortableTableHeader
            column="totalTime"
            label="Total Practice Time"
            :sort-column="sortColumn"
            :sort-direction="sortDirection"
            @sort="handleSort" />
          <SortableTableHeader
            column="totalTestTime"
            label="Total Showcase Time"
            :sort-column="sortColumn"
            :sort-direction="sortDirection"
            @sort="handleSort" />
          <SortableTableHeader
            column="totalPracticeSubmissions"
            label="Total Practice Submissions"
            :sort-column="sortColumn"
            :sort-direction="sortDirection"
            @sort="handleSort" />
          <SortableTableHeader
            column="totalTestSubmissions"
            label="Total Showcase Submissions"
            :sort-column="sortColumn"
            :sort-direction="sortDirection"
            @sort="handleSort" />
          <SortableTableHeader
            column="assignmentCount"
            label="Total Assignments"
            :sort-column="sortColumn"
            :sort-direction="sortDirection"
            @sort="handleSort" />
          <SortableTableHeader
            column="lastSubmission"
            label="Last Submission"
            :sort-column="sortColumn"
            :sort-direction="sortDirection"
            @sort="handleSort" />
        </tr>
      </thead>
      <tbody
        v-if="students.length > 0"
        class="bg-light-1 border-1 border-light-4">
        <StudentRow
          :students="students"
          :open-accordion-index="openStudentAccordion"
          @toggle-accordion="$emit('toggle-accordion', $event)"
          @show-assignment-details="$emit('show-assignment-details', $event)" />
      </tbody>
      <!-- No Students Message -->
      <tbody v-else>
        <tr>
          <td colspan="8" class="text-center py-space-lg">
            <h6>No students found</h6>
            <p>No students have submitted assignments yet.</p>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import SortableTableHeader, {
  type SortDirection,
  type SortEventPayload,
} from "./SortableTableHeader.vue";
import StudentRow from "./StudentRow.vue";

interface Props {
  students: ProcessedStudent[];
  sortColumn?: string | null;
  sortDirection?: SortDirection | null;
  openStudentAccordion?: number | null;
}

const props = withDefaults(defineProps<Props>(), {
  sortColumn: null,
  sortDirection: "asc",
  openStudentAccordion: null,
});

const emit = defineEmits<{
  sort: [payload: SortEventPayload];
  "toggle-accordion": [index: number];
  "show-assignment-details": [assignment: ProcessedAssignment];
}>();

const handleSort = (event: SortEventPayload) => {
  emit("sort", event);
};
</script>

<style scoped>
.table {
  border-collapse: separate;
  border-spacing: 0;
  overflow: hidden;
  border-radius: 0.5rem;
}

table > :not(caption) > * > * {
  box-shadow: none !important;
}
</style>
