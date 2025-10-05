import { makePersisted } from "@solid-primitives/storage";
import {  createSignal } from "solid-js";
import type { MessageStream } from "./stream";
import { SYSTEM_PROMPT, TOOLS } from "./prompt";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources.js";
import { scrubBadToolCalls } from "./util";


export type ChatMessage =
	ChatCompletionCreateParamsStreaming["messages"][number];
export type AssistantMessage = Extract<ChatMessage, { role: "assistant" }>;

export const [apiKey, setApiKey] = makePersisted(createSignal<string>(), {
	name: "OPENAI_API_KEY",
});

export const [keyErr, setKeyErr] = createSignal(false);
export const [stream, setStream] = createSignal<MessageStream<AssistantMessage>>();
export const [messages, setMessages] = makePersisted(createSignal<ChatMessage[]>([
 {role: "system", content: SYSTEM_PROMPT}
]), { name: "CHAT_MESSAGES", deserialize: (data) => {
  try {
    const obj = JSON.parse(data);
    return scrubBadToolCalls(obj);
  } catch {
    return [];
  }
}, });




export const [processingTools, setProcessing] = createSignal(false);

export const ready = () => {
  if (processingTools()) return false;
  let s = stream();
  if (!s) {
    return true;
  }
  if (s.isDone()) {
    return true;
  }
  if (!s.isDone()) {
    return false;
  }
  return true;
}
