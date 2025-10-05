import type { ChatCompletionCreateParamsStreaming } from "openai/resources.js";

export type ChatMessage =
	ChatCompletionCreateParamsStreaming["messages"][number];

export function scrubBadToolCalls(messages: ChatMessage[]): ChatMessage[] {
  const toolsWithoutResponse = new Set();
  const responsesWithNoCall = new Set();

  messages.forEach(message => {
    if (message.role === "assistant") {
      if (!message.tool_calls)
        return;
      message.tool_calls.forEach(call => {
        toolsWithoutResponse.add(call.id)
      })
    }
    else if (message.role === "tool") {
      if (!toolsWithoutResponse.delete(message.tool_call_id)) {
        responsesWithNoCall.add(message.tool_call_id);
      }
    }
  });

  return messages.map(msg => {
    if (msg.role !== "assistant")
      return msg
    if (!msg.tool_calls)
      return msg
    const filtered = msg.tool_calls.filter(call =>
      !toolsWithoutResponse.has(call.id)
    );
    if (filtered.length === 0) {
      msg.tool_calls = undefined;
    } else {
      msg.tool_calls = filtered;
    }
    return msg;
  })
    .filter(msg => {
      if (msg.role !== "tool")
        return true
      return !responsesWithNoCall.has(msg.tool_call_id);
    });
}
