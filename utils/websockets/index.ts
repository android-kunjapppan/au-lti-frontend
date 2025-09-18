import { WebSocketResponseEventType } from "../constants.js";

// Checks if is text event
export const isTextEvent = (eventType: string) => {
  if (
    eventType === WebSocketResponseEventType.EVENT_TEXT_END ||
    eventType === WebSocketResponseEventType.EVENT_TEXT_START ||
    eventType === WebSocketResponseEventType.EVENT_TEXT_UPDATE
  )
    return true;
  else return false;
};
