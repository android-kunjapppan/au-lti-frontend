<template>
  <div class="evaluation-container">
    <LoadingSpinner v-if="isLoading" />

    <!-- Header Section -->
    <header class="evaluation-header">
      <div class="header-left">
        <button class="nav-button" @click="goBack">
          <i-fa6-solid:arrow-left class="nav-icon" />
        </button>
        <button class="nav-button" @click="goHome">
          <i-fa6-solid:house class="nav-icon" />
        </button>
      </div>

      <div class="header-center">
        <h1 class="evaluation-title">{{ evaluationData.title }}</h1>
      </div>

      <div class="header-right">
        <div class="logo-container">
          <div class="air-university-logo">
            <div class="logo-circle">
              <div class="logo-eagle">🦅</div>
            </div>
            <div class="logo-text">
              <div class="logo-title">AIR UNIVERSITY</div>
              <div class="logo-subtitle">AIR FORCE</div>
            </div>
          </div>
          <div class="asu-logo">
            <div class="asu-text">ASU</div>
            <div class="asu-subtitle">Arizona State University</div>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="evaluation-main">
      <div class="background-image">
        <div class="blur-overlay"></div>
      </div>

      <div class="content-wrapper">
        <!-- Chat Box (Left Panel) -->
        <div class="chat-panel" :class="{ 'chat-open': isChatOpen }">
          <div class="chat-header">
            <h3 class="chat-title">Training Session</h3>
            <button class="chat-close" @click="closeChat">
              <i-fa6-solid:xmark class="close-icon" />
            </button>
          </div>

          <div class="chat-messages" ref="chatMessages">
            <div class="message system-message">
              <div class="message-content">
                <p>
                  Welcome to your training session. Please explain duty and
                  accountability to a junior officer.
                </p>
              </div>
            </div>

            <div
              v-for="message in chatMessages"
              :key="message.id"
              class="message"
              :class="message.type">
              <div class="message-content">
                <p>{{ message.text }}</p>
                <span class="message-time">{{ message.timestamp }}</span>
              </div>
            </div>
          </div>

          <div class="chat-input-container">
            <div class="chat-input-wrapper">
              <input
                v-model="chatInput"
                @keyup.enter="sendMessage"
                placeholder="Type your response here..."
                class="chat-input"
                :disabled="isRecording" />
              <button
                class="chat-send-btn"
                @click="sendMessage"
                :disabled="!chatInput.trim() || isRecording">
                <i-fa6-solid:paper-plane class="send-icon" />
              </button>
            </div>
          </div>
        </div>

        <!-- Central Character -->
        <div
          class="character-container"
          :class="{ 'character-shifted': isChatOpen }">
          <div class="character-frame">
            <div class="character-image">
              <img src="/avatar.png" alt="Avatar" />
            </div>
          </div>
        </div>

        <!-- Next Button - Manual positioning based on chat state -->
        <button
          class="next-button-manual"
          :class="{
            'next-button-center': isChatOpen,
            'next-button-left': !isChatOpen,
          }"
          @click="nextStep">
          <i-fa6-solid:chevron-right class="next-icon" />
        </button>
      </div>
    </main>

    <!-- Control Section -->
    <footer class="evaluation-footer">
      <div class="instructions">
        <p class="instruction-text">
          Hold spacebar to speak or click the microphone. Speech will be
          automatically corrected for accuracy.
        </p>
        <p class="instruction-text">
          Click 'Evaluate' to get performance feedback.
        </p>
      </div>

      <div class="control-buttons">
        <button class="control-btn keyboard-btn" @click="toggleTextInput">
          <i-fa6-solid:keyboard class="btn-icon" />
        </button>

        <button
          class="control-btn microphone-btn"
          :class="{ recording: isRecording }"
          @click="toggleRecording"
          @mousedown="startRecording"
          @mouseup="stopRecording"
          @mouseleave="stopRecording">
          <i-fa6-solid:microphone class="btn-icon" />
        </button>

        <button class="control-btn evaluate-btn" @click="evaluatePerformance">
          Evaluate
        </button>
      </div>

      <!-- Text Input Area - Appears directly below control buttons -->
      <div
        class="text-input-section"
        :class="{ 'text-input-visible': isTextInputOpen }">
        <div class="text-input-container">
          <textarea
            v-model="textResponse"
            @keydown.enter.exact="sendTextResponse"
            @keydown.shift.enter="addNewLine"
            placeholder="Type your response here..."
            class="text-input-field"
            rows="4"></textarea>

          <div class="text-input-controls">
            <div class="text-input-instructions">
              <p>Press Enter to send, Shift+Enter for new line</p>
            </div>

            <div class="text-input-buttons">
              <button
                class="text-input-send-btn"
                @click="sendTextResponse"
                :disabled="!textResponse.trim()">
                <i-fa6-solid:paper-plane class="send-icon" />
              </button>
              <button class="text-input-clear-btn" @click="clearTextResponse">
                <i-fa6-solid:xmark class="clear-icon" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="footer-text">
        Private & Confidential | ASU EdPlus Artificial Intelligence Product
        Dept.
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "@/stores/appStore";
import { useAvatarStore } from "@/stores/useAvatarStore";
import LoadingSpinner from "~/components/LoadingSpinner.vue";

// Completely open access - no authentication required
// This ensures no middleware interferes with the evaluation page
definePageMeta({
  // No middleware specified - completely open access
});

// Store references
const appStore = useAppStore();
const avatarStore = useAvatarStore();

// Loading states
const isLoading = ref(false);
const isRecording = ref(false);
const isChatOpen = ref(false);
const isTextInputOpen = ref(false);

// Chat functionality
const chatInput = ref("");
const chatMessages = ref<
  Array<{
    id: number;
    text: string;
    type: string;
    timestamp: string;
  }>
>([]);
const chatMessagesRef = ref<HTMLElement | null>(null);

// Text input functionality
const textResponse = ref("");

// Evaluation data - military-themed content
const evaluationData = ref({
  title: "Explain Duty and Accountability to a Junior Officer",
});

// Navigation handlers
const goBack = () => {
  window.history.back();
};

const goHome = () => {
  navigateTo("/");
};

const nextStep = () => {
  console.log("Next step clicked - opening chat");
  isChatOpen.value = !isChatOpen.value;
};

// Recording functionality
const toggleRecording = () => {
  isRecording.value = !isRecording.value;
  console.log("Recording toggled:", isRecording.value);
};

const startRecording = () => {
  isRecording.value = true;
  console.log("Recording started");
};

const stopRecording = () => {
  isRecording.value = false;
  console.log("Recording stopped");
};

// Control button handlers
const toggleTextInput = () => {
  isTextInputOpen.value = !isTextInputOpen.value;
  console.log("Text input toggled:", isTextInputOpen.value);
};

const evaluatePerformance = () => {
  console.log("Evaluate performance clicked");
  // Implement evaluation logic
};

// Chat functionality
const closeChat = () => {
  isChatOpen.value = false;
};

const sendMessage = () => {
  if (!chatInput.value.trim() || isRecording.value) return;

  const message = {
    id: Date.now(),
    text: chatInput.value,
    type: "user-message",
    timestamp: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  chatMessages.value.push(message);
  chatInput.value = "";

  // Auto-scroll to bottom
  nextTick(() => {
    if (chatMessagesRef.value) {
      chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight;
    }
  });

  // Simulate AI response after a delay
  setTimeout(() => {
    const aiResponse = {
      id: Date.now() + 1,
      text: "Thank you for your response. Please continue with your explanation of duty and accountability.",
      type: "ai-message",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    chatMessages.value.push(aiResponse);

    nextTick(() => {
      if (chatMessagesRef.value) {
        chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight;
      }
    });
  }, 1500);
};

// Text input functionality
const closeTextInput = () => {
  isTextInputOpen.value = false;
};

const sendTextResponse = () => {
  if (!textResponse.value.trim()) return;

  const message = {
    id: Date.now(),
    text: textResponse.value,
    type: "user-message",
    timestamp: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  chatMessages.value.push(message);
  textResponse.value = "";
  isTextInputOpen.value = false;

  // Auto-scroll to bottom
  nextTick(() => {
    if (chatMessagesRef.value) {
      chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight;
    }
  });

  // Simulate AI response after a delay
  setTimeout(() => {
    const aiResponse = {
      id: Date.now() + 1,
      text: "Thank you for your written response. Please continue with your explanation of duty and accountability.",
      type: "ai-message",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    chatMessages.value.push(aiResponse);

    nextTick(() => {
      if (chatMessagesRef.value) {
        chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight;
      }
    });
  }, 1500);
};

const addNewLine = () => {
  textResponse.value += "\n";
};

const clearTextResponse = () => {
  textResponse.value = "";
};

// Keyboard event handling for spacebar
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.code === "Space" && !isRecording.value) {
    event.preventDefault();
    startRecording();
  }
};

const handleKeyUp = (event: KeyboardEvent) => {
  if (event.code === "Space" && isRecording.value) {
    event.preventDefault();
    stopRecording();
  }
};

// Load avatar and initialize on mount
onMounted(async () => {
  try {
    isLoading.value = true;
    await avatarStore.loadModel();

    // Try to fetch user info, but don't fail if not available (open access)
    try {
      await appStore.fetchUserInfo();
    } catch (userInfoError) {
      console.log("User info not available (open access mode):", userInfoError);
      // Continue without user info - this is expected for open access
    }

    // Add keyboard event listeners
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
  } catch (error) {
    console.error("Error initializing evaluation page:", error);
    appStore.addAlert("Error loading evaluation page");
  } finally {
    isLoading.value = false;
  }
});

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener("keydown", handleKeyDown);
  document.removeEventListener("keyup", handleKeyUp);
});
</script>

<style scoped>
.evaluation-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a2332 0%, #2d3748 100%);
  color: #ffffff;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  position: relative;
  overflow: hidden;
}

.evaluation-header {
  background: linear-gradient(135deg, #2d3748 0%, #1a2332 100%);
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #4a5568;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.header-left {
  display: flex;
  gap: 1rem;
}

.nav-button {
  background: #4a5568;
  border: none;
  color: #ffffff;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-button:hover {
  background: #718096;
  transform: scale(1.05);
}

.nav-icon {
  font-size: 1.2rem;
}

.header-center {
  flex: 1;
  text-align: center;
}

.evaluation-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: #ffffff;
}

.header-right {
  display: flex;
  align-items: center;
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.air-university-logo {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo-circle {
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, #eab308 0%, #ffed4e 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
}

.logo-eagle {
  font-size: 1.5rem;
}

.logo-text {
  display: flex;
  flex-direction: column;
}

.logo-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #eab308;
  letter-spacing: 1px;
}

.logo-subtitle {
  font-size: 0.7rem;
  color: #a0aec0;
  letter-spacing: 0.5px;
}

.asu-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.asu-text {
  font-size: 1.2rem;
  font-weight: 700;
  color: #eab308;
  letter-spacing: 2px;
}

.asu-subtitle {
  font-size: 0.6rem;
  color: #a0aec0;
  letter-spacing: 1px;
}

.evaluation-main {
  position: relative;
  height: calc(100vh - 200px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.background-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: url("/images/military-background.jpg") center/cover;
  z-index: 1;
}

.blur-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(26, 35, 50, 0.7);
  backdrop-filter: blur(2px);
}

.content-wrapper {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

/* Chat Panel Styles - Width-based approach */
.chat-panel {
  width: 0;
  height: 100%;
  background: linear-gradient(135deg, #1a2332 0%, #2d3748 100%);
  border-right: 2px solid #4a5568;
  transition: width 0.3s ease-in-out;
  z-index: 10;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-panel.chat-open {
  width: 50%;
}

.chat-header {
  padding: 1rem;
  background: linear-gradient(135deg, #2d3748 0%, #1a2332 100%);
  border-bottom: 1px solid #4a5568;
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 60px;
}

.chat-title {
  color: #ffffff;
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
}

.chat-close {
  background: #4a5568;
  border: none;
  color: #ffffff;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s ease;
}

.chat-close:hover {
  background: #718096;
}

.close-icon {
  font-size: 0.9rem;
}

.chat-messages {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message {
  display: flex;
  flex-direction: column;
}

.message-content {
  background: #2d3748;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  max-width: 85%;
  position: relative;
}

.system-message .message-content {
  background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
  color: #e2e8f0;
  max-width: 100%;
  text-align: center;
  font-style: italic;
}

.user-message {
  align-self: flex-end;
}

.user-message .message-content {
  background: linear-gradient(135deg, #3182ce 0%, #2b6cb0 100%);
  color: #ffffff;
}

.ai-message {
  align-self: flex-start;
}

.ai-message .message-content {
  background: linear-gradient(135deg, #38a169 0%, #2f855a 100%);
  color: #ffffff;
}

.message-time {
  font-size: 0.75rem;
  color: #a0aec0;
  margin-top: 0.25rem;
  display: block;
}

.chat-input-container {
  padding: 1rem;
  background: #1a2332;
  border-top: 1px solid #4a5568;
}

.chat-input-wrapper {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.chat-input {
  flex: 1;
  padding: 0.75rem 1rem;
  background: #2d3748;
  border: 1px solid #4a5568;
  border-radius: 8px;
  color: #ffffff;
  font-size: 0.9rem;
  transition: border-color 0.2s ease;
}

.chat-input:focus {
  outline: none;
  border-color: #3182ce;
}

.chat-input::placeholder {
  color: #a0aec0;
}

.chat-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chat-send-btn {
  background: linear-gradient(135deg, #3182ce 0%, #2b6cb0 100%);
  border: none;
  color: #ffffff;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chat-send-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #2b6cb0 0%, #2c5282 100%);
  transform: translateY(-1px);
}

.chat-send-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.send-icon {
  font-size: 0.9rem;
}

/* Character container - takes full space when chat is closed */
.character-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.character-container.character-shifted {
  flex: 0 0 50%;
}

.character-frame {
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: linear-gradient(135deg, #eab308 0%, #ffed4e 100%);
  padding: 8px;
  box-shadow: 0 8px 30px rgba(255, 215, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.character-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.character-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Next Button - Manual positioning */
.next-button-manual {
  position: absolute;
  width: 48px;
  height: 48px;
  background: #eab308;
  border: none;
  border-radius: 50%;
  color: #333;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  z-index: 10;
}

/* Left position when chat is closed */
.next-button-left {
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

/* Center position when chat is open */
.next-button-center {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.next-button-manual:hover {
  transform: translateY(-50%) scale(1.1);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
}

.next-button-center:hover {
  transform: translate(-50%, -50%) scale(1.1);
}

.next-button-manual .next-icon {
  font-size: 16px;
}

/* Rotate arrow when chat is open to show close action */
.next-button-center .next-icon {
  transform: rotate(180deg);
}

.evaluation-footer {
  background: linear-gradient(135deg, #1a2332 0%, #2d3748 100%);
  padding: 1.5rem 2rem;
  border-top: 2px solid #4a5568;
  text-align: center;
}

.instructions {
  margin-bottom: 1.5rem;
}

.instruction-text {
  color: #e2e8f0;
  font-size: 0.9rem;
  margin: 0.5rem 0;
  line-height: 1.4;
}

.control-buttons {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 2rem;
  margin-bottom: 1rem;
}

.control-btn {
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}

.keyboard-btn {
  width: 60px;
  height: 60px;
  background: #4a5568;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.keyboard-btn:hover {
  background: #777;
  transform: scale(1.05);
}

.microphone-btn {
  width: 80px;
  height: 80px;
  background: #eab308;
  border-radius: 50%;
  color: #333;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.microphone-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
}

.microphone-btn.recording {
  background: #ff4444;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

.evaluate-btn {
  background: #4a90e2;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  min-width: 120px;
}

.evaluate-btn:hover {
  background: #357abd;
  transform: scale(1.05);
}

.btn-icon {
  font-size: 24px;
}

.footer-text {
  text-align: center;
  color: white;
  font-size: 12px;
  opacity: 0.7;
  margin-top: 10px;
}

/* Mobile responsive for chat */
@media (max-width: 768px) {
  .chat-panel.chat-open {
    width: 100%;
  }

  .character-container.character-shifted {
    flex: 0 0 100%;
  }

  .next-button-left {
    left: 20px;
  }

  .next-button-center {
    left: 50%;
    top: 50%;
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  .evaluation-header {
    padding: 10px 15px;
    flex-direction: column;
    gap: 10px;
  }

  .header-center {
    order: -1;
  }

  .evaluation-title {
    font-size: 1.2rem;
  }

  .logo-container {
    flex-direction: column;
    gap: 10px;
  }

  .character-frame {
    width: 200px;
    height: 200px;
  }

  .control-buttons {
    gap: 20px;
  }

  .control-btn {
    padding: 10px;
  }

  .evaluate-btn {
    padding: 10px 20px;
    font-size: 14px;
  }
}

/* Text Input Section Styles */
.text-input-section {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
  margin-top: 1rem;
}

.text-input-section.text-input-visible {
  max-height: 300px;
}

.text-input-container {
  width: 100%;
}

.text-input-field {
  width: 100%;
  padding: 1rem;
  background: #2d3748;
  border: 2px solid #eab308;
  border-radius: 8px;
  color: #ffffff;
  font-size: 1rem;
  font-family: inherit;
  resize: vertical;
  min-height: 100px;
  transition: border-color 0.2s ease;
}

.text-input-field:focus {
  outline: none;
  border-color: #3182ce;
}

.text-input-field::placeholder {
  color: #a0aec0;
}

.text-input-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
}

.text-input-instructions p {
  color: #a0aec0;
  font-size: 0.85rem;
  margin: 0;
}

.text-input-buttons {
  display: flex;
  gap: 0.5rem;
}

.text-input-send-btn {
  background: linear-gradient(135deg, #3182ce 0%, #2b6cb0 100%);
  border: none;
  color: #ffffff;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.text-input-send-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #2b6cb0 0%, #2c5282 100%);
  transform: translateY(-1px);
}

.text-input-send-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.text-input-clear-btn {
  background: #4a5568;
  border: none;
  color: #ffffff;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.text-input-clear-btn:hover {
  background: #718096;
  transform: translateY(-1px);
}

.send-icon,
.clear-icon {
  font-size: 0.9rem;
}
</style>
