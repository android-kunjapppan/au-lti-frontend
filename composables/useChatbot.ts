import { useChatbotStore } from "@/stores/useChatbotStore";
import { promiseTimeout } from "@vueuse/core";
import { storeToRefs } from "pinia";
import type { Thread } from "~/types/types";
import { AnimationStates, testResponseData } from "~/utils/constants";

interface UseChatbotOptions {
  threadOverflowElem?: HTMLDivElement | Ref<HTMLDivElement | undefined>;
  userInputRef?: HTMLTextAreaElement | Ref<HTMLTextAreaElement | undefined>;
}

/**
 * @description Handles all chatbot logic besides getting the current thread
 * Todos:
 * - Migrate some of this over to the chatbot store
 * - fix the issue where the event stream closing prevents the last audio and message from being added.
 */
export function useChatbot(options: UseChatbotOptions) {
  const userInputRef = toRef(options.userInputRef);
  const runtimeConfig = useRuntimeConfig();
  const eventSource = ref<EventSource | null>(null);
  const eventSourcePromise = ref<Promise<void>>();
  const eventSourceResolve = ref<
    null | ((value: void | PromiseLike<void>) => void)
  >(null);
  const userPrompt = ref("");

  const chatbotStore = useChatbotStore();
  const chatbotStoreRef = storeToRefs(chatbotStore);

  const {
    isStreaming,
    threadRef,
    streamingResponse,
    toolCallStatus,
    chatHistory,
    lastMessageSent,
    eventResponseQueue,
  } = storeToRefs(chatbotStore);
  const avatarStore = useAvatarStore();

  const sampleQuestions = [
    "What is going on in my current tab?",
    "Excel homework help",
    "Tell me about yourself",
  ];

  const prettyFunctionNameMappings = {
    get_field_guide_info: "Digging through the Field Guide...",
    get_knowledge_base_info: "Searching my Knowledge Base...",
    get_subtitles: "Processing subtitles...",
    get_video_frames: "Analyzing current tab...",
    animate_model: "Executing animation...",
    get_excel_info: "Searching my Excel knowledge...",
  };

  const useSampleQuestion = async (question: string) => {
    userPrompt.value = question;
    await handleUserPromptSubmission();
  };

  /**
   * @description Scrolls you down to the bottom of the message feed, ability to override smooth/ delay to make jump instant
   */
  const scrollToResponsesBottom = async (instant?: boolean) => {
    if (instant == false) await promiseTimeout(50);
    // if (options.threadOverflowElem && threadOverflowRef.value) {
    //   threadOverflowRef.value.scroll({
    //     top: threadOverflowRef.value.scrollHeight,
    //     behavior: instant ? "instant" : "smooth",
    //   });
    // }
  };

  /**
   * @description Event handler for when the user submits their question
   */
  const handleUserPromptSubmission = async () => {
    if (!isStreaming.value) {
      chatbotStore.reset();
      await processPrompt();
    } else {
      await cancelCurrentStream();
    }
  };

  /**
   * @description Closes out the current event source
   */
  const cancelCurrentStream = async () => {
    if (eventSourceResolve && eventSource.value) {
      eventSource.value.close();
      if (eventSourceResolve.value) eventSourceResolve.value();
    }
  };

  watch(isStreaming, (newValue, oldValue) => {
    if (
      newValue == false &&
      oldValue == true &&
      eventSourceResolve.value !== null
    ) {
      cancelCurrentStream();
    }
  });

  watch(
    [eventResponseQueue, isStreaming],
    async () => {
      if (
        eventResponseQueue.value.length !== 0 &&
        isStreaming.value === true &&
        chatbotStoreRef.isActive.value === false
      ) {
        chatbotStore.start();
      } else if (
        eventResponseQueue.value.length !== 0 &&
        threadRef.value.messages.length > 0
      ) {
        chatbotStore.reset();
      } else if (threadRef.value.messages.length === 0) {
        chatbotStore.stop();
      }
    },
    { deep: true }
  );

  /** Handles text messages and the end of stream message */
  const handleMessageEvent = async (event: MessageEvent) => {
    if (event.data === "[DONE]") {
      lastMessageSent.value = true;
    } else {
      console.log(
        "adding text: ",
        JSON.parse(event.data).replace(/<br\/>/g, ``)
      );
      chatbotStore.enqueueText({
        text: JSON.parse(event.data).replace(/<br\/>/g, ``),
      });
      await scrollToResponsesBottom();
    }
  };

  /** @description handles incoming audio events */
  const handleAudioSSEEvent = async (event: MessageEvent) => {
    const audioData = event.data satisfies string;
    chatbotStore.enqueueAudio({ audio: JSON.parse(audioData) });
  };

  /** Tests a tool call message for animating the model */
  const runMockToolCall = () => {
    const event: MessageEvent = new MessageEvent("tool_call", {
      data: JSON.stringify({
        id: "call_tY78oXRXZinAnkMHQwPtvRND",
        type: "function",
        function: {
          name: "animate_model",
          arguments: JSON.stringify({
            animation: "C_QR",
            emote: "None",
            anger: 0,
            happiness: 0,
            sadness: 0,
          }),
        },
      }),
    });
    handleToolCallSSEEvent(event);
  };

  const runMockResponse = async () => {
    promptSetup();
    for (const element of testResponseData) {
      await promiseTimeout(200);
      if (element.type === "message") {
        handleMessageEvent(
          new MessageEvent("message", {
            data:
              element.message === "[DONE]"
                ? "[DONE]"
                : JSON.stringify(element.message),
          })
        );
      } else if (element.type === "function") {
        handleToolCallSSEEvent(
          new MessageEvent("tool_call", {
            data: JSON.stringify(element),
          })
        );
      } else if (element.type === "Buffer") {
        handleAudioSSEEvent(
          new MessageEvent("audio", {
            data: JSON.stringify(element),
          })
        );
      }
    }
    await runEventStreamCleanup();
  };

  /** Handles any tool calls, mostly animation or KB search for this chatbot */
  const handleToolCallSSEEvent = async (event: MessageEvent) => {
    const data = JSON.parse(event.data);
    const toolName = data["function"][
      "name"
    ] as keyof typeof prettyFunctionNameMappings;
    const args = JSON.parse(data["function"]["arguments"]);
    toolCallStatus.value.push(
      `${prettyFunctionNameMappings[toolName] ?? toolName}`
    );

    /** FIX */
    if (toolName === "animate_model") {
      const animation = args["animation"] ?? AnimationStates.IDLE;
      // const emote = args["emote"] ?? "None";

      // const expressionKeys = ["anger", "happiness", "sadness"];
      // const expressions = expressionKeys.map(
      //   (key) => (args[key] ?? 0) / 100
      // )

      avatarStore.playAnimation(animation);
      toolCallStatus.value.pop();
    }
  };
  /**
   *
   * @description Creates a new event source promise that listens for messages from the API and resolves them
   */
  const createEventSourcePromise = (resource_id: string) => {
    return new Promise<void>((resolve, reject) => {
      // Resolves the previous event source just to be safe
      eventSourceResolve.value = resolve;

      // Open an EventSource for streaming using the resource ID
      eventSource.value = new EventSource(
        `${runtimeConfig.public.apiUrl}/chat/completions/stream/${TEMP_USER_NAME}/${resource_id}`
      );
      lastMessageSent.value = false;
      eventSource.value.addEventListener("message", handleMessageEvent);
      eventSource.value.addEventListener("audio", handleAudioSSEEvent);
      eventSource.value.addEventListener("tool_call", handleToolCallSSEEvent);
      eventSource.value.onerror = (error) => {
        console.error("EventSource errored with", error);
        eventSource.value?.close();
        resolve();
      };
    });
  };

  const runEventStreamCleanup = async () => {
    eventSource.value = null;
    isStreaming.value = false;
    eventSourceResolve.value = null;
    await scrollToResponsesBottom();
    focusUserPrompt();
  };

  const promptSetup = async () => {
    try {
      // lock in streaming thread guid
      isStreaming.value = true;

      // Get prompt and clear it
      const prompt = userPrompt.value;
      userPrompt.value = "";
      console.log("Prompt cleared: ", userPrompt.value);

      // Push new messages to thread
      if (!threadRef.value)
        threadRef.value = { name: "New thread", messages: [] };

      const currentThreadMessages: Thread = threadRef.value;
      currentThreadMessages.messages.push({ role: "user", content: prompt });
      currentThreadMessages.messages.push({ role: "assistant", content: "" });
      threadRef.value = currentThreadMessages;

      // collate messages
      const messages = threadRef.value
        ? [
            // Spread all but the last two messages that we just added
            ...chatHistory.value.slice(0, -2),
            {
              role: "user",
              content: prompt,
            },
          ]
        : [];

      // get the response stream
      streamingResponse.value = "";
      return messages;
    } catch (e) {
      console.log(e);
    }
  };

  const processPrompt = async (): Promise<void> => {
    try {
      const messages = await promptSetup();
      // Step 1: Send the array of messages to the POST endpoint to get the resource ID
      const response = await fetch(
        `${runtimeConfig.public.apiUrl}/chat/completions`,
        {
          method: "POST",
          // credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${TEMP_USER_NAME}`,
          },
          body: JSON.stringify({
            messages: messages,
          }),
        }
      );
      // Scroll to bottom
      if (!response.ok) {
        throw new Error("Failed to get resource ID");
      }
      const { data } = await response.json();

      // Step 2: Create a Promise that resolves when the EventSource closes
      eventSourcePromise.value = createEventSourcePromise(data.resource_id);
      await scrollToResponsesBottom(true);

      // Step 3: Wait for the EventSource to close
      await eventSourcePromise.value;
    } catch (error) {
      console.error("Error in processPrompt:", error);
    } finally {
      await runEventStreamCleanup();
    }
  };

  function focusUserPrompt() {
    if (userInputRef.value) userInputRef.value.focus();
  }

  // Watch user input to reset countdown
  watch(userPrompt, (newValue) => {
    if (threadRef.value.messages.length > 0 && newValue.length > 0) {
      chatbotStore.reset();
    }
  });

  // expose managed state as return value
  return {
    sampleQuestions,
    prettyFunctionNameMappings,
    useSampleQuestion,
    scrollToResponsesBottom,
    handleUserPromptSubmission,
    cancelCurrentStream,
    createEventSourcePromise,
    processPrompt,
    userPrompt,
    focusUserPrompt,
    runMockToolCall,
    runMockResponse,
  };
}
