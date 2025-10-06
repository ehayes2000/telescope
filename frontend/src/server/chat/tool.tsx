import { Dynamic } from "solid-js/web";
import { type Component } from "solid-js";
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
    .slice(0, 5)
    .map((doc) => {
      doc.metadata.authors = doc.metadata.authors.slice(0, 3);
      return JSON.stringify(doc, null, 2);
    })
    .join("\n")

  return {
    content: text,
    role: 'tool',
    tool_call_id: tool.id
  };
}

function ToolCallError(props: {name?: string}) {
  return <div class="text-sm font-mono !text-gray-200">
    {props.name ? `// AI Failed to use the ${props.name} tool` : '// AI Failed to use a tool'}
  </div>
}

const RenderSearchTool: ToolRenderer = (props) => {
  const args = asJson<SearchTool>(props.id, props.function.arguments);
  if (args.type === "err") {
    return <ToolCallError name="search"/>
  }
  const queries = args.data;
  return <div class="text-sm !text-green-400 font-mono"> Searched for
    <pre>
      {queries.queries.join('\n')}
    </pre>
  </div>
}

type ToolHandler = (c: Extract<ToolCall, {type: "function"}>) => Promise<ToolMessage>;
type ToolRenderer = Component<Extract<ToolCall, { type: "function" }>>;

const tools: Record<string, {
  handle: ToolHandler,
  render: ToolRenderer
}> = {
  search: {
    handle: async (call) => {
      const args = asJson<SearchTool>(call.id, call.function.arguments)
      if (args.type === "err") {
        return args.err
      }
      return await handleSearch({args: args.data, id: call.id})
    },
    render: RenderSearchTool
  }
}

export function RenderToolCall(props: {tool: ToolCall}) {
  if (props.tool.type === "custom")
    return <ToolCallError />
  if (!(props.tool.function.name in tools)) {
    return <ToolCallError />
  }
  const handler = tools[props.tool.function.name];
  const t = props.tool;
  return <Dynamic
    component={() => handler.render(t)}
  />
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
