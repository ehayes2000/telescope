import { makePersisted } from "@solid-primitives/storage";
import OpenAI from "openai";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources.js";
import { createEffect, createSignal } from "solid-js";
import type { MessageStream } from "./stream";
import { TOOLS } from "./prompt";
import type { ChatCompletionChunk } from "openai/resources";

export type ChatMessage =
	ChatCompletionCreateParamsStreaming["messages"][number];
export type AssistantMessage = Extract<ChatMessage, { role: "assistant" }>;

export const [apiKey, setApiKey] = makePersisted(createSignal<string>(), {
	name: "OPENAI_API_KEY",
});

export const [keyErr, setKeyErr] = createSignal(false);
const [stream, setStream] = createSignal<MessageStream<AssistantMessage>>();
const [messages, setMessages] = createSignal<ChatMessage[]>([]);

const useClient = () => {
	const key = apiKey();
	if (!key || key.length === 0) {
		setKeyErr(true);
		return;
	}
	setKeyErr(false);
	return new OpenAI({
		apiKey: key,
		dangerouslyAllowBrowser: true,
	});
};

createEffect(() => {
  const s = stream();
  if (!s || !s.isDone()) {
    return;
  }
  const text = s.data().content;
  const tools = s.data().tool_calls;
  if (text && text.length > 0 || tools && tools.length > 0) {
    setMessages(p => [...p, s.data()])
  }
  setStream(undefined)
});

export function sendMessage(message: string) {
	setMessages((p) => [...p, { role: "user", content: message }]);
	const newStream = chat({
		model: "gpt-4",
		messages: messages(),
		stream: true,
		tools: TOOLS
	});
	if (newStream) setStream(newStream);
}

createEffect(() => {
  console.log(stream()?.data())
})

function chat(
	args: ChatCompletionCreateParamsStreaming,
): MessageStream<AssistantMessage> | undefined {
	const [message, setMessage] = createSignal<AssistantMessage>({
		role: "assistant",
		content: "",
	});
	const [done, setDone] = createSignal(false);
	const [err, setErr] = createSignal(false);
	const client = useClient();
	if (!client) return;

	let stream: ReturnType<typeof client.chat.completions.stream>;
	try {
		stream = client.chat.completions.stream(args);
	} catch {
		setErr(true);
	}
	const processStream = async () => {
	  type ToolCalls = NonNullable<AssistantMessage['tool_calls']>
    type ToolCall = ToolCalls[number];
		type ToolDelta = ChatCompletionChunk.Choice.Delta.ToolCall
		const toolDeltas: ToolDelta[] = [];
		const collectToolDeltas = (): ToolCalls | undefined => {
      const toolMap: Record<string, { id: string, function: { name: string, arguments: string } }> = {};
      for (const delta of toolDeltas) {
        if (delta.id) {
          toolMap[delta.index] = { id: delta.id, function: { name: "", arguments: "" } };
        }
        if (delta.function?.name) {
          toolMap[delta.index].function.name = delta.function.name;
        }
        if (delta.function?.arguments) {
          toolMap[delta.index].function.arguments += delta.function.arguments;
        }
      }
      if (toolDeltas.length === 0) return;
      return Object.values(toolMap)
        .map((call) => ({
          id: call.id,
          type: "function",
          function: call.function
        } satisfies ToolCall))
		}

		for await (const part of stream) {
			const f = part.choices.at(0);
			if (!f) continue;
			if (f.finish_reason) {
        const tools = collectToolDeltas();
        setMessage(p => ({ ...p, tool_calls: tools }));
				if (f.finish_reason === "content_filter") setErr(true);
				setDone(true);
				return;
			}
			if (f.delta.tool_calls) {
				f.delta.tool_calls.forEach((c) => {
					toolDeltas.push(c);
				});
			}
			if (f.delta.content) {
				const text = f.delta.content;
				setMessage((p) => ({
					...p,
					content: p.content + text,
				}));
			}
		}
	};

	let stopStream: () => void = () => {};
	new Promise((resolve) => {
		processStream();
    stopStream = () => {
      resolve("stopped")
    };
	});

	return {
		isDone: done,
		isErr: err,
		data: message,
		stop: stopStream,
	};
}
