<template>
  <div class="row mt-space-sm">
    <div class="col-md-4 mb-space-xs">
      <StudentStatsCard
        title="Practice Time"
        :value="currentStudent?.totalPracticeTimeFormatted || '00:00'"
        color="success" />
    </div>
    <div class="col-md-4 mb-space-xs">
      <StudentStatsCard
        title="Showcase Time"
        :value="currentStudent?.totalTestTimeFormatted || '00:00'"
        color="warning" />
    </div>
    <div class="col-md-4 mb-space-xs">
      <StudentStatsCard
        title="Practice Submissions"
        :value="currentStudent?.totalPracticeSubmissions || 0"
        color="primary" />
    </div>
    <div class="col-md-4 mb-space-xs">
      <StudentStatsCard
        title="Showcase Submissions"
        :value="currentStudent?.totalTestSubmissions || 0"
        color="danger" />
    </div>
    <div class="col-md-4 mb-space-xs">
      <StudentStatsCard
        title="Total Assignments"
        :value="currentStudent?.assignmentCount || 0"
        color="info" />
    </div>
    <div class="col-md-4 mb-space-xs">
      <StudentStatsCard
        title="Last Submission"
        :value="
          currentStudent ? formatDate(currentStudent?.lastSubmission) : 'N/A'
        "
        color="secondary" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDateTime } from "~/utils/dateUtils";
import StudentStatsCard from "./StudentStatsCard.vue";

interface Props {
  currentStudent?: ProcessedStudent | null;
}

const props = withDefaults(defineProps<Props>(), {
  currentStudent: null,
});

function formatDate(dateString: string) {
  if (dateString === "N/A") return "N/A";
  const date = new Date(dateString);
  return formatDateTime(date);
}
</script>
