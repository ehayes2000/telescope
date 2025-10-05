import { type Result, ok, err } from "../../types";
import { setMessages, stream, setProcessing } from "./signals";
import { createEffect } from "solid-js";
import {type AssistantMessage, type ToolMessage, type ToolCall, complete } from "./chat";
import {
  search,
  type Document,
} from "../search";

type SearchTool = {
  queries: string[]
}

type ReadTool = {
  id: string
}

// this is not checked :)
function asJson<T>(id: string, s: string): Result<T, ToolMessage>{
  try {
    return ok(JSON.parse(s))
  } catch {
    return err(
      {
        role: "tool",
        tool_call_id: id,
        content: "Error - malformed json"
      }
    )
  }
}

async function handleSearch(tool: { id: string, args: SearchTool}): Promise<ToolMessage> {
  const searches = tool.args.queries.map(query =>
    search({ phrase: query })
  )
  const resultMap: Record<string, Document> = {};
  (await Promise.all(searches))
    .flatMap(result => (result.type === "ok" ? result.data : []) as Document[])
    .forEach((doc) => {
      resultMap[doc.id] = doc;
    });

  if (Object.keys(resultMap).length === 0)
    return {
      content: "No Results",
      role: "tool",
      tool_call_id: tool.id
    };

  const text = Object.values(resultMap)
    .slice(0,5)
    .map((doc) => JSON.stringify(doc, null, 2))
    .join("\n")

  return {
    content: text,
    role: 'tool',
    tool_call_id: tool.id
  };
}

async function handleRead(tool: { id: string, args: ReadTool}): Promise<ToolMessage> {
  return {
    role:"tool",
    content: "Read tool is broken",
    tool_call_id: tool.id
  }
}

type ToolHandler = (c: Extract<ToolCall, {type: "function"}>) => Promise<ToolMessage>;

const tools: Record<string, { handle: ToolHandler }> = {
  search: {
    handle: async (call) => {
      const args = asJson<SearchTool>(call.id, call.function.arguments)
      if (args.type === "err") {
        return args.err
      }
      return await handleSearch({args: args.data, id: call.id})
    },
  }
}

async function callTool(call: ToolCall) {
  try {
    if (call.type === "custom") {
      setMessages(p => [...p, {
        role: "tool",
        tool_call_id: call.id,
        content: "error - unsupported tool call"
      }])
      return;
    } else if (call.function.name in tools) {
      const message = await tools[call.function.name].handle(call)
      setMessages(p => [...p, message]);
      return
    } else {
      setMessages(p => [...p, {
        role: "tool",
        tool_call_id: call.id,
        content: "error - unknown tool name"
      }])
      return;
    }
  } catch {
    // if wrong schema we come here
    setMessages(p => [...p, {
      role: "tool",
      tool_call_id: call.id,
      content: "error - bad arguments"
    }])
  }
}

async function handleAllTools(message: AssistantMessage) {
  if (message.tool_calls && message.tool_calls.length > 0) {
    setProcessing(true);
    for (const call of message.tool_calls) {
      await callTool(call);
    }
    setProcessing(false);
    complete();
  }
}


createEffect(() => {
  const data = stream()?.data()
  if (!data) return;
  handleAllTools(data)
})
