<template>
  <div
    v-if="streamingContent"
    class="w-100 avatar-response-wrapper p-space-md m-space-md d-flex justify-content-center align-items-center rounded-2">
    <div class="h-100 w-100 avatar-response d-flex">
      {{ streamingContent }}
    </div>
  </div>
</template>

<script setup lang="ts">
const chatbotStore = useChatbotStore();
const chatbotStoreRef = storeToRefs(chatbotStore);

const streamingContent = computed(() => {
  if (
    chatbotStoreRef.streamingResponse &&
    chatbotStoreRef.streamingResponse.value.length > 0
  ) {
    return chatbotStoreRef.streamingResponse.value;
  } else if (
    chatbotStoreRef.threadRef.value &&
    chatbotStoreRef.threadRef.value.messages.length > 0
  ) {
    const messageArrayLastIndex =
      chatbotStoreRef.threadRef.value.messages.length - 1;
    return chatbotStoreRef.threadRef.value.messages[messageArrayLastIndex]
      .content;
  } else {
    return "";
  }
});
</script>

<style scoped>
.avatar-response-wrapper {
  border-radius: 24px;
  background: linear-gradient(
    180deg,
    rgba(40, 90, 119, 0.5) -4.83%,
    rgba(15, 37, 50, 0.5) 100%
  );
}
.avatar-response {
  flex-direction: column-reverse;
  max-height: 8rem;
  font-size: 2rem;
  color: white;
  overflow: auto;
  scrollbar-color: var(--rds-primary) transparent;
  scroll-behavior: smooth;
}
</style>
