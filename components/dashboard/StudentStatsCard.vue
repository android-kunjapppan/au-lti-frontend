<template>
  <div class="card border-0 shadow-sm">
    <div class="card-body text-center">
      <h6>{{ title }}</h6>
      <h4 :class="`text-${color} fw-bold`">
        {{ value }}
      </h4>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps({
  title: {
    type: String,
    required: true,
  },
  value: {
    type: [String, Number],
    required: true,
  },
  color: {
    type: String,
    default: "primary",
    validator: (value: string) =>
      ["primary", "success", "warning", "danger", "info", "secondary"].includes(
        value
      ),
  },
});
</script>
