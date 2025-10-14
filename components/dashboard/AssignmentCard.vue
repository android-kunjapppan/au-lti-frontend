<template>
  <div class="card border-1 border-light-4">
    <div class="card-header bg-white border-bottom-0">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <h6 class="fw-bold title">
            {{ assignment.title }}
          </h6>
          <!-- Assignment Details -->
          <div class="d-flex align-items-center flex-wrap gap-space-md">
            <span
              class="py-space-xxxs px-space-xxs fw-bold rounded-1 text-light-1"
              :class="assignment.isTest ? 'bg-info' : 'green-badge'">
              {{ assignment.isTest ? "Showcase" : "Practice" }}
            </span>
            <span> {{ assignment.submissions?.length || 0 }} submissions </span>
            <span>
              {{ calculateTotalPracticeTime(assignment.submissions) }}
            </span>
            <span>
              {{ formatAssignmentDate(assignment) }}
            </span>
          </div>
        </div>

        <button
          class="btn btn-primary px-space-sm"
          @click="$emit('show-details', assignment)">
          Details
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getLatestSubmissionDate } from "~/utils/dateUtils";
import { calculateTotalPracticeTime } from "~/utils/timeUtils";

interface Props {
  assignment: ProcessedAssignment;
}
defineProps<Props>();

defineEmits<{
  "show-details": [Assignment];
}>();

function formatAssignmentDate(assignment: ProcessedAssignment) {
  return getLatestSubmissionDate(assignment.submissions, "time");
}
</script>

<style scoped>
.title {
  line-height: 56px;
}

.green-badge {
  background-color: var(--rds-green);
}
</style>
