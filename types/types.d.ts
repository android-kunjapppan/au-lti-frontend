/// <reference types="vite-plugin-glsl/ext" />
import type { Mesh } from "three";

import type { APIResponseBody } from "@edplus-engineering/api-response-standard";
import type {
  SupportedLang,
  WebSocketEventType,
  WebSocketTextRequestType,
} from "~/utils/constants";
//#region Utils

export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;
export interface CustomTresObject3D extends TresObject3D {
  position?: { x: number; y: number; z: number };
  morphTargetDictionary?: { [key: string]: number };
  morphTargetInfluences?: number[];
}
//#endregion

//#region UserApp
export interface ThreadMessage {
  role: Role;
  content: string | null;
  excludeFromHistory?: boolean;
}
export interface Thread {
  name: string;
  messages: ThreadMessage[];
}

export type BotAction = "play" | "translate" | "slow" | "feedback";

export interface MouthMesh {
  mesh: Mesh;
  targetName: string;
  targetIndex: number;
}

export interface LipSyncParams {
  sensitivity: number;
  threshold: number;
  smoothness: number;
  minFrequency: number;
  maxFrequency: number;
}

export interface MorphMeshTarget {
  mesh: Mesh;
  targetName: string;
  targetIndex: number;
}
export interface ETSessionToken {
  asurite: string;
  name?: string;
  type: "web";
  iat: number;
  exp: number;
  // update
  iss: ":shrug:";
}

export interface CanvasUser {
  ASUrite: string;
  CanvasUserId: string;
  CreatedTimestamp: string;
  Name: string;
  User_UUID: string;
}
export interface CanvasAssignment {
  Assignment_UUID: string;
  CanvasAssignmentId: number;
  Course_UUID: string;
  CreatedTimestamp: string;
  IsTest: boolean;
  MaxPairs: number;
  MinPairsRequired: number;
  Name: string;
  UpdatedTimestamp: string;
}

export interface UserInfo {
  userId: string;
  name: string;
  courseId: string;
  assignmentId: string;
  selectedTemplate: string;
  assignmentInfo?: {
    assignment: {
      Assignment_UUID: string;
      Name: string;
      IsTest: boolean;
      MaxPairs: number;
      MinPairsRequired: number;
      course?: {
        Course_UUID: string;
        CourseName: string;
        CanvasCourseCode: string;
        CanvasCourseId: number;
        Language: string;
        AcademicYear_UUID: string;
        Session_UUID: string;
        IsArchived: boolean;
        CreatedTimestamp: string;
        UpdatedTimestamp: string;
      };
      [key: string]: string | number | boolean | undefined;
    };
    submittedCount: number;
    currentAttempt: number;
    isTest: boolean;
    maxAttempts: number;
    maxAttemptsReached: boolean;
    lastSubmittedConversation?: {
      conversation_id: string;
      messages: Array<{
        text: string;
        translation: string;
        message_id: string;
        feedback: string;
        type: "user" | "bot";
        created_at: string;
      }>;
    };
  };
}

export interface UpdateUserDetailsResponse {
  success: boolean;
  message: string;
}

export interface LessonOverviewData {
  lesson: {
    lessonId: number;
    location: {
      city: string;
      photo?: string;
    };
    character: {
      name: string;
    };
    lesson: {
      title: string;
      description: string;
    };
  };
}
//#endregion

//#region WebSocket Requests
export type ConversationRequestBodyBase = {
  user_id: string;
  event_type: (typeof WebSocketEventType)[keyof typeof WebSocketEventType];
  conversation_id: string;
  selectedTemplate: string;
};

export interface ConversationStartRequestBody {
  user_id: string;
  selectedTemplate: string;
  event_type: typeof WebSocketEventType.EVENT_CONVERSATION_START;
  assignment_id: string;
  data: {
    request_type: typeof WebSocketTextRequestType.START_CONVERSATION;
  };
}

export interface ConversationEndRequestBody {
  user_id: string;
  selectedTemplate: string;
  event_type: typeof WebSocketEventType.EVENT_CONVERSATION_END;
  conversation_id: string;
  lb_canvas_jwt: string;
}

export type TextConversationRequestBodyBase<
  T extends
    (typeof WebSocketTextRequestType)[keyof typeof WebSocketTextRequestType],
> = ConversationRequestBodyBase & {
  event_type: typeof WebSocketEventType.EVENT_TEXT_START;
  message_id: string;
  selectedTemplate: string;
  data: {
    request_type: T;
    text: string;
    language: (typeof SupportedLang)[keyof typeof SupportedLang];
    bot_message_id?: string;
  };
};

export interface UserTextConversationRequestBody
  extends TextConversationRequestBodyBase<
    typeof WebSocketTextRequestType.USER_TEXT
  > {}
export interface TTSConversationRequestBody
  extends ConversationRequestBodyBase<typeof WebSocketTextRequestType.TTS> {}

export interface TranslationConversationRequestBody
  extends ConversationRequestBodyBase<
    typeof WebSocketTextRequestType.TRANSLATION
  > {}
export interface FeedbackConversationRequestBody
  extends TextConversationRequestBodyBase<
    typeof WebSocketTextRequestType.FEEDBACK
  > {}

export interface AudioConversationRequestBody
  extends ConversationRequestBodyBase {
  event_type:
    | typeof WebSocketEventType.EVENT_AUDIO_START
    | typeof WebSocketEventType.EVENT_AUDIO_UPDATED;
  message_id: string;
  data: {
    request_type: typeof WebSocketTextRequestType.USER_AUDIO;
    audio: string; // Base64 encoded audio data
    language: (typeof SupportedLang)[keyof typeof SupportedLang];
  };
}
//#endregion

//#region WebSocket Response
export type WebSocketResponse<T extends {} = {}> = APIResponseBody & {
  event_type: string;
  data: T;
};

export interface ConversationStartWebSocketResponseData {
  conversation_id: string;
  max_pairs: number;
  min_pairs_required: number;
  isTest: boolean;
  messages?: Array<{
    message_id: string;
    text: string;
    type: "user" | "bot";
    translation?: string;
    feedback?: string;
    created_at?: string;
  }>;
}

export interface ConversationEndWebSocketResponseData {
  feedback: {
    whatWentWell: string[];
    suggestionsForImprovement: string[];
  };
}

export interface UserTextWebSocketResponseData {
  text: string;
  message_id: string;
  response_type: typeof WebSocketResponseType.USER_TEXT;
}

export interface TranslationWebSocketResponseData {
  text: string;
  message_id: string;
  response_type: typeof WebSocketResponseType.TRANSLATION;
}
export interface TTSWebSocketResponseData {
  // might need to update type?
  audio: Buffer;
  message_id: string;
  response_type: typeof WebSocketResponseType.TTS;
}
export interface FeedbackWebSocketResponseData {
  text: string;
  message_id: string;
  response_type: typeof WebSocketResponseType.FEEDBACK;
}

export interface SuggestionWebSocketResponseData {
  text: string;
  message_id: string;
  response_type: typeof WebSocketResponseType.SUGGESTION;
}

export interface TextEndWebSocketResponseData {
  text: string;
  message_id: string;
  // No response_type for EVENT_TEXT_END
}

//#endregion

// Define the DashboardFilters interface
export interface DashboardFilters {
  dateRange: {
    start: string;
    end: string;
  };
  selectedStudentNames: string[];
  selectedAssignmentIds: string[];
  assignmentTypeFilter: {
    practice: boolean;
    test: boolean;
  };
}
