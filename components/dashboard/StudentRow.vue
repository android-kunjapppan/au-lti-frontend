<template>
  <template v-for="(student, index) in students" :key="student.id">
    <tr class="clickable-row" @click="$emit('toggle-accordion', index)">
      <td>
        <button class="btn btn-sm bg-transparent border-0">
          <i-custom-chevron-right
            class="w-4 h-4"
            :class="{
              rotated: openAccordionIndex === index,
            }" />
        </button>
      </td>
      <td>
        <span>{{ student.name }}</span>
      </td>
      <td>
        <div class="d-flex align-items-center">
          <span>
            {{ student.totalPracticeTimeFormatted }}
          </span>
        </div>
      </td>
      <td>
        <div class="d-flex align-items-center">
          <span>
            {{ student.totalTestTimeFormatted }}
          </span>
        </div>
      </td>
      <td>
        <div class="d-flex align-items-center">
          <span>
            {{ student.totalPracticeSubmissions }}
          </span>
        </div>
      </td>
      <td>
        <div class="d-flex align-items-center">
          <span>
            {{ student.totalTestSubmissions }}
          </span>
        </div>
      </td>
      <td>
        <div class="d-flex align-items-center">
          <span> {{ student.assignmentCount }} assignments </span>
        </div>
      </td>
      <td>
        <div class="d-flex align-items-center">
          <small class="fw-medium">{{
            formatDate(student.lastSubmission)
          }}</small>
        </div>
      </td>
    </tr>

    <!-- Student Assignments Accordion -->
    <tr v-if="openAccordionIndex === index">
      <td colspan="8">
        <div class="p-space-sm d-flex flex-column gap-space-xs">
          <h5 class="text-maroon fw-bold">
            Assignments for {{ student.name }}
          </h5>

          <!-- Assignments List -->
          <div class="d-flex flex-column gap-space-xs">
            <div
              v-for="assignment in student.assignments"
              :key="assignment.id"
              class="col-12">
              <AssignmentCard
                :assignment="assignment"
                @show-details="$emit('show-assignment-details', assignment)" />
            </div>
          </div>
        </div>
      </td>
    </tr>
  </template>
</template>

<script setup>
import AssignmentCard from "./AssignmentCard.vue";

defineProps({
  students: {
    type: Array,
    required: true,
  },
  openAccordionIndex: {
    type: Number,
    default: null,
  },
});

defineEmits(["toggle-accordion", "show-assignment-details"]);

function formatDate(dateString) {
  if (dateString === "N/A" || dateString === "No submissions")
    return dateString;
  // Since getLatestSubmissionDate already returns a formatted string, just return it as-is
  return dateString;
}
</script>

<style scoped>
.rotated {
  transform: rotate(90deg);
  transition: transform 0.2s ease-in-out;
}

.student-assignments-details {
  background-color: #f8f9fa;
}

.badge {
  font-size: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
}

.text-maroon {
  color: var(--rds-maroon);
}
</style>
