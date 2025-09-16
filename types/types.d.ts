/// <reference types="vite-plugin-glsl/ext" />
export interface ThreadMessage {
  role: Role;
  content: string | null;
  excludeFromHistory?: boolean;
}
export interface Thread {
  name: string;
  messages: ThreadMessage[];
}
