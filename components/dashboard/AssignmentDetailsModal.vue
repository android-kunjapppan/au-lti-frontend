<template>
  <RdsModal v-bind="modalProps" :visible="visible" @hidden="closeModal">
    <template #header>
      <div class="d-flex justify-content-between align-items-center w-100">
        <slot name="header">
          <h5 class="ps-space-xxs">{{ assignmentTitle }}</h5>
        </slot>
        <button
          @click="closeModal"
          class="btn-close-custom p-space-xxs"
          type="button"
          aria-label="Close">
          <img
            src="/assets/custom/close.svg"
            alt="Close"
            width="16"
            height="16" />
        </button>
      </div>
    </template>

    <div class="px-space-sm" v-if="assignment">
      <div class="mb-space-sm border-bottom border-2 pb-space-sm">
        <div class="d-flex mt-space-xxs justify-content-between flex-column">
          <div class="mb-space-xxs d-flex align-items-center">
            <span class="text-dark-3 fs-medium assignment-heading"
              >Type of Submission:</span
            >
            <span
              :class="[
                'py-space-xxxs',
                'px-space-xxs',
                'text-light-1',
                'fs-small',
                'rounded-1',
                assignment?.isTest ? 'bg-info is-test-tag' : 'is-practice-tag',
              ]">
              {{ assignment?.isTest ? "Showcase" : "Practice" }}
            </span>
          </div>
          <div class="mb-space-xxs d-flex align-items-center">
            <span class="text-dark-3 fs-medium assignment-heading"
              >Total Submissions:</span
            >
            <span class="text-dark-3 fs-medium">{{
              sortedSubmissions.length
            }}</span>
          </div>
          <div class="mb-space-xxs d-flex align-items-center">
            <span class="text-dark-3 fs-medium assignment-heading">{{
              assignment?.isTest
                ? "Total Showcase Time:"
                : "Total Practice Time:"
            }}</span>
            <span class="text-dark-3 fs-medium">{{
              calculatePracticeTime()
            }}</span>
          </div>
          <div class="mb-space-xxs d-flex align-items-center">
            <span class="text-dark-3 fs-medium assignment-heading"
              >Total Pairs:</span
            >
            <span class="text-dark-3 fs-medium">{{
              calculateTotalPairs()
            }}</span>
          </div>
          <div class="d-flex align-items-center">
            <span class="text-dark-3 fs-medium assignment-heading"
              >Allowed Attempts:</span
            >
            <span class="text-dark-3 fs-medium">
              {{
                assignment?.allowed_attempts === -1
                  ? "Unlimited"
                  : assignment?.allowed_attempts
              }}
            </span>
          </div>
        </div>
      </div>

      <div class="bg-light-1 rounded-1 p-space-xs">
        <div
          class="mb-space-xs d-flex align-items-center gap-space-xs"
          v-if="sortedSubmissions.length > 0">
          <label class="text-dark-3 fs-medium type-heading"
            >Select Submission:</label
          >
          <div class="flex-grow-1 me-space-sm">
            <DropdownComponent
              :options="submissionOptions"
              :placeholder="'Choose a submission'"
              :height="'200px'"
              :preselect="true"
              :clearable="false"
              v-model="selectedSubmission"
              @change="handleSubmissionChange" />
          </div>
        </div>

        <div v-if="sortedSubmissions.length > 0 && selectedSubmission">
          <div :key="selectedSubmission.value">
            <div class="mb-space-xxs d-flex align-items-center">
              <span class="text-dark-3 fs-medium assignment-heading">{{
                assignment?.isTest ? "Showcase Time:" : "Practice Time:"
              }}</span>
              <span class="text-dark-3 fs-medium">
                {{ currentSubmission?.duration }}
              </span>
            </div>
            <div class="mb-space-xs d-flex align-items-center">
              <span class="text-dark-3 fs-medium assignment-heading"
                >Pairs:</span
              >
              <span class="text-dark-3 fs-medium">
                {{ currentSubmission?.pairsTotal || 0 }}
              </span>
            </div>

            <div class="row">
              <div class="col-lg-6 mb-space-xs">
                <div
                  class="p-space-xs border bg-white audio-submission-container">
                  <h6
                    class="mb-space-xxs text-dark-3 fw-semibold border-bottom border-2 pb-space-xxs">
                    Audio Submission
                  </h6>
                  <audio
                    controls
                    class="w-100 mb-space-xxs"
                    :src="currentSubmission?.audioUrl">
                    Your browser does not support the audio element.
                  </audio>
                  <div class="text-end">
                    <a
                      :href="currentSubmission?.audioUrl"
                      download
                      class="btn btn-outline-primary btn-sm">
                      Download Audio
                    </a>
                  </div>
                </div>
              </div>

              <div class="col-lg-6 mb-space-xs">
                <div
                  class="p-space-xs border bg-white instructor-feedback-container">
                  <h6
                    class="mb-space-xxs text-dark-3 fw-semibold border-bottom border-2 pb-space-xxs">
                    Instructor Feedback
                  </h6>

                  <div v-if="isInstructor">
                    <div
                      v-if="
                        getFeedbackState(selectedSubmissionIndex).isEditing
                      ">
                      <textarea
                        v-model="feedbackTexts[selectedSubmissionIndex]"
                        class="form-control form-control-sm mb-space-xxs feedback-textarea"
                        rows="3"
                        placeholder="Type your feedback here..."></textarea>

                      <div class="text-end mt-space-xxs">
                        <button
                          @click="sendFeedback(selectedSubmissionIndex)"
                          class="btn btn-outline-primary btn-sm me-space-xxs">
                          {{ getFeedbackButtonText(selectedSubmissionIndex) }}
                        </button>
                        <button
                          @click="cancelEdit(selectedSubmissionIndex)"
                          class="btn btn-outline-dark-3 btn-sm">
                          Cancel
                        </button>
                      </div>
                    </div>

                    <div v-else>
                      <div
                        v-if="
                          getFeedbackState(selectedSubmissionIndex).isSubmitted
                        ">
                        <p
                          class="fst-italic fs-small text-overflow mb-space-xxs">
                          {{ feedbackTexts[selectedSubmissionIndex] }}
                        </p>
                        <div class="text-end">
                          <button
                            @click="editFeedback(selectedSubmissionIndex)"
                            class="btn btn-outline-primary btn-sm">
                            Edit Feedback
                          </button>
                        </div>
                      </div>

                      <div v-else>
                        <textarea
                          v-model="feedbackTexts[selectedSubmissionIndex]"
                          class="form-control form-control-sm mb-space-xxs feedback-textarea"
                          rows="3"
                          placeholder="Type your feedback here..."></textarea>

                        <div class="text-end">
                          <button
                            @click="sendFeedback(selectedSubmissionIndex)"
                            class="btn btn-outline-primary btn-sm">
                            {{ getFeedbackButtonText(selectedSubmissionIndex) }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-else>
                    <div class="p-space-xxs">
                      <p
                        v-if="currentSubmission?.instructorFeedback"
                        class="fst-italic text-muted text-overflow">
                        {{ currentSubmission.instructorFeedback }}
                      </p>
                      <p v-else class="fst-italic text-muted">
                        No feedback provided yet.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="col-lg-6 pb-space-xxs">
                <div class="p-space-xs border bg-white fixed-height-container">
                  <h6
                    class="mb-space-xxs text-dark-3 fw-semibold border-bottom border-2 pb-space-xxs">
                    Full Transcript
                  </h6>
                  <div class="scrollable-content">
                    <div
                      v-for="entry in currentSubmission?.transcript"
                      :key="entry.messageId"
                      class="d-flex align-items-start mb-2 small">
                      <span
                        class="fw-semibold"
                        :class="
                          entry.type === 'user' ? 'text-info' : 'text-success'
                        ">
                        {{ entry.type === "user" ? "User:" : "Bot:" }}&nbsp;
                      </span>
                      <span
                        class="text-dark-3 fst-italic"
                        style="white-space: pre-wrap">
                        {{ entry.text }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="col-lg-6 pb-space-xxs">
                <div class="p-space-xs border bg-white fixed-height-container">
                  <h6
                    class="mb-space-xxs text-dark-3 fw-semibold border-bottom border-2 pb-space-xxs">
                    AI Generated Feedback
                  </h6>
                  <div class="scrollable-content">
                    <div v-if="parsedAIFeedback">
                      <div class="mb-space-xs">
                        <h6 class="fw-semibold text-success mb-space-xxs">
                          What Went Well
                        </h6>
                        <ul class="ps-3">
                          <li
                            v-for="(item, idx) in parsedAIFeedback.whatWentWell"
                            :key="'www-' + idx"
                            class="small mb-space-xxs text-dark-3 fst-italic">
                            {{ item }}
                          </li>
                        </ul>
                      </div>
                      <div>
                        <h6 class="fw-semibold text-info mb-space-xxs">
                          Suggestions for Improvement
                        </h6>
                        <ul class="ps-space-sm">
                          <li
                            v-for="(
                              item, idx
                            ) in parsedAIFeedback.suggestionsForImprovement"
                            :key="'sfi-' + idx"
                            class="small mb-space-xxs text-dark-3 fst-italic">
                            {{ item }}
                          </li>
                        </ul>
                      </div>
                    </div>
                    <p v-else class="text-muted small fst-italic">
                      No AI feedback available.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="d-flex justify-content-end pt-space-xs">
        <button @click="closeModal" class="btn btn-dark-3">Close</button>
      </div>
    </template>
  </RdsModal>
</template>

<script setup lang="ts">
import { RdsModal } from "@rds-vue-ui/rds-modal";
import { computed, ref, watch } from "vue";
import type { LessonFeedback } from "~/types/types";
import { formatDateTime } from "~/utils/dateUtils";
import { calculateTotalPracticeTime } from "~/utils/timeUtils";
import DropdownComponent, {
  type DropdownOption,
} from "./DropdownComponent.vue";

export interface SendFeedbackPayload {
  assignmentId: string;
  submissionId: string;
  feedback: string;
}

interface SelectedSubmission {
  text: string;
  value: string;
}

interface FeedbackState {
  isSubmitted: boolean;
  isEditing: boolean;
}

interface FeedbackStates {
  [key: string]: FeedbackState;
}

interface Props {
  visible: boolean;
  assignment: Assignment | null;
  isInstructor: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  isInstructor: true,
});

const emit = defineEmits<{
  close: [];
  "send-feedback": [feedback: SendFeedbackPayload];
}>();

const feedbackTexts = ref<string[]>([]);
const feedbackStates = ref<FeedbackStates>({});
const selectedSubmissionIndex = ref<number>(0);
const selectedSubmission = ref<SelectedSubmission | null>(null);
const assignmentTitle = ref("Assignment Details");

const modalProps = ref<
  Omit<InstanceType<typeof RdsModal>["$props"], "visible">
>({
  title: undefined,
  titleVariant: "dark-3",
  size: "lg",
  centered: true,
  bgVariant: "white",
  overlayColor: "#191919",
  overlayOpacity: 0.7,
  exteriorCloseBtn: false,
  useCustomClose: true,
  borderRadius: 0,
  teleport: true,
  teleportLocation: "body",
  expandHeight: false,
  removePadding: false,
});

const sortedSubmissions = computed(() => {
  if (!props.assignment?.submissions) return [];
  return [...props.assignment.submissions].sort(
    (a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt)
  );
});

const submissionOptions = computed(() => {
  return sortedSubmissions.value.map((submission, index) => ({
    text: `Submission ${index + 1} (${formatDate(submission.submittedAt, "time")})`,
    value: index.toString(),
  }));
});

const currentSubmission = computed(() => {
  return sortedSubmissions.value[selectedSubmissionIndex.value] || null;
});

watch(
  () => props.assignment,
  (newAssignment) => {
    if (newAssignment) {
      selectedSubmissionIndex.value = 0;
      // Set the first submission option when assignment changes
      if (submissionOptions.value.length > 0) {
        selectedSubmission.value = submissionOptions.value[0];
      }
      updateFeedbackTexts();
      updateFeedbackStates();
      assignmentTitle.value = newAssignment.title || "Assignment Details";
    }
  },
  { immediate: true }
);

const parsedAIFeedback = computed(() => {
  const current =
    sortedSubmissions.value[selectedSubmissionIndex.value]?.aiFeedback;
  console.log("current", current);
  if (!current) return null;
  try {
    if (Array.isArray(current)) {
      const currentValue: LessonFeedback = JSON.parse(current[0]);
      return currentValue;
    } else {
      const currentValue: LessonFeedback = JSON.parse(current);
      return currentValue;
    }
  } catch (err) {
    console.error("Failed to parse AI feedback:", err);
    return null;
  }
});

function updateFeedbackTexts() {
  feedbackTexts.value = sortedSubmissions.value.map(
    (s) => s.instructorFeedback || ""
  );
}

function updateFeedbackStates() {
  const states: FeedbackStates = {};
  sortedSubmissions.value.forEach((submission, index) => {
    states[index] = {
      isSubmitted: Boolean(submission.instructorFeedback?.trim()),
      isEditing: false,
    };
  });
  feedbackStates.value = states;
}

function getFeedbackState(index: number) {
  return (
    feedbackStates.value[index] || { isSubmitted: false, isEditing: false }
  );
}

function closeModal() {
  emit("close");
}

function handleSubmissionChange(value: DropdownOption | null) {
  if (value && value.value) {
    selectedSubmissionIndex.value = parseInt(value.value);
  }
}
function sendFeedback(index: number) {
  const submission = sortedSubmissions.value[index];
  if (submission && feedbackTexts.value[index]?.trim() && props.assignment) {
    emit("send-feedback", {
      assignmentId: props.assignment.id,
      submissionId: submission.submissionId,
      feedback: feedbackTexts.value[index].trim(),
    });
    feedbackStates.value[index] = {
      isSubmitted: true,
      isEditing: false,
    };
  }
}

function editFeedback(index: number) {
  feedbackStates.value[index] = {
    ...feedbackStates.value[index],
    isEditing: true,
  };
}

function cancelEdit(index: number) {
  feedbackTexts.value[index] =
    sortedSubmissions.value[index].instructorFeedback || "";
  feedbackStates.value[index] = {
    ...feedbackStates.value[index],
    isEditing: false,
  };
}

function getFeedbackButtonText(index: number) {
  return getFeedbackState(index).isSubmitted
    ? "Send Updated Feedback"
    : "Send Feedback";
}

function formatDate(dateString: string, value: DateFormat) {
  return formatDateTime(dateString, value);
}

function calculatePracticeTime() {
  return calculateTotalPracticeTime(sortedSubmissions.value);
}

function calculateTotalPairs() {
  if (!props.assignment?.submissions) {
    return 0;
  }
  return props.assignment.submissions.reduce((total, submission) => {
    return total + (submission.pairsTotal || 0);
  }, 0);
}
</script>

<style scoped>
.assignment-heading {
  font-weight: 700;
  line-height: 24px;
  min-width: 180px;
}

.type-heading {
  font-weight: 700;
  line-height: 24px;
  min-width: 165px;
}

.assignment-badge {
  font-weight: 700;
  line-height: 24px;
}

.is-test-tag {
  gap: 10px;
  font-weight: 700;
}

.is-practice-tag {
  background-color: var(--rds-green);
  gap: 10px;
  font-weight: 700;
}

.audio-submission-container,
.instructor-feedback-container {
  height: 180px;
  display: flex;
  flex-direction: column;
}

.audio-submission-container .text-end,
.instructor-feedback-container .text-end {
  margin-top: auto;
}

.text-overflow {
  overflow: auto;
  height: 70px;
  word-break: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

.fixed-height-container {
  height: 284px;
  overflow-y: auto;
}

.btn-close-custom {
  background: none;
  border: none;
  cursor: pointer;
}

.feedback-textarea {
  height: 72px !important;
  resize: none;
  overflow-y: auto;
}
</style>
