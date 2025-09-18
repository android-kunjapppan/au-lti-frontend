<template>
  <div class="p-space-sm">
    <div class="d-flex justify-content-between align-items-center mb-space-sm">
      <h5 class="mb-0 text-primary fw-bold">My Assignments</h5>
      <FilterButton
        :students="students"
        :is-instructor="isInstructor"
        @filter-change="$emit('filter-change', $event)" />
    </div>

    <!-- Assignments List -->
    <div class="row">
      <div
        v-for="assignment in currentStudent?.assignments"
        :key="assignment.id"
        class="col-12 mb-space-xs">
        <AssignmentCard
          :assignment="assignment"
          @show-details="$emit('show-assignment-details', $event)" />
      </div>
    </div>

    <!-- No Assignments Message -->
    <div
      v-if="
        !currentStudent?.assignments || currentStudent.assignments.length === 0
      "
      class="text-center py-space-lg">
      <div>
        <h6>No assignments available</h6>
        <p>Check back later for new assignments.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import AssignmentCard from "./AssignmentCard.vue";
import FilterButton from "./FilterButton.vue";

defineProps({
  currentStudent: {
    type: Object,
    default: null,
  },
  students: {
    type: Array,
    required: true,
  },
  isInstructor: {
    type: Boolean,
    required: true,
  },
});

defineEmits(["filter-change", "show-assignment-details"]);
</script>
