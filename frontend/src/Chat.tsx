import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import {unified} from 'unified'
import { type AssistantMessage, type ChatMessage, type ToolMessage } from './server/chat'
import { on, Show, For, Switch, Match, createSignal, createEffect } from 'solid-js'
import { ready, apiKey, sendMessage, setApiKey, stream, messages, setMessages} from "./server/chat";
import type { MessageStream } from './server/chat'
import { RenderToolCall } from './server/chat'


const processor= unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeStringify)

export function Markdown(props: { md: string }) {
  const htmlString = () => String(processor.processSync(props.md))
  return <div innerHTML={htmlString()} />
}

export function Chat() {
  let scrollable: HTMLDivElement | undefined;

  createEffect(on(stream, (current, prev) => {
    if (current && !prev && scrollable)
      scrollable.scrollTo(0, scrollable.scrollHeight)
  }));

  return (
  <div class="min-h-screen max-h-screen flex flex-col justify-between py-2 items-center">
    <div class="w-[400px]">
      <ApiKey />
    </div>
    <div class="flex justify-center min-h-0 flex-1 overflow-y-scroll w-screen items-start scroll-smooth pl-[22px]"
      ref={scrollable}
    >
      <div class="w-[400px] py-2">
        <ChatMessages messages={messages()}/>
          <Show when={stream()}>
            {stream=> <ChatStream stream={stream()}/>}
          </Show>
        <Spinner/>
      </div>
    </div>
    <div class="w-[400px]">
      <ChatInput />
    </div>
  </div>)
}

function Spinner() {

  const emptyStream = () => {
    const s = stream();
    if (!s) return true;
    const c = s.data().content;
    if (c && c.length > 0) {
      return false;
    }
    return true;
  }

  const [spinner, setSpinner] = createSignal("****");
  const [i, setI] = createSignal(0);
  const spin = () => setTimeout(() => {
    const c = Array.from("****");
    c[i()] = " ";
    setSpinner(c.join(""))
    setI(p => (p + 1) % 4);
    spin()
  }, 125)
  spin()

  return ( <Show when={!ready() && emptyStream()}>
    <pre class="!text-green-400">
      [{spinner()}]
    </pre>
  </Show>
  )
}

function ChatInput() {
  const [input, setInput] = createSignal("");
  const send = () => {
    if (ready() && input().length > 0) {
      sendMessage(input())
      setInput("");
    }
  }
  return(
  <div class="flex border border-green-400 w-[400px] items-end flex-0 relative">
    <textarea
      placeholder="Search the knowledge base with AI"
      class="px-2 py-1 focus:outline-none min-h-[80px] align-top flex-1 resize-none text-sm
      placeholder:!text-green-400/40
      "
      onInput={e => setInput(e.currentTarget.value)}
      value={input()}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          send()
          e.preventDefault()
        }
      }}

    />
    <div class="hover:bg-green-400/20 absolute bottom-0 right-0"
      onClick={send}
    >
      <UpArrow/>
    </div>
   <div class="px-2 py-1 absolute bottom-0 left-0 text-xs font-mono select-none hover:bg-green-400/20 !text-green-400"
     onClick={() => setMessages([])}
   >
    Reset
   </div>

  </div>)
}

function ApiKey() {
	const secretKey = () => {
		const v = apiKey();
		if (!v) return "";
		return Array.from(v)
			.map((_) => "*")
			.join("");
	};

	return (
		<div class="flex-0">
			<input
				class="px-2 py-1 focus:outline-none border border-green-400 w-[400px] h-[40px] text-sm italic font-mono
				placeholder:text-green-400/20
				"
				value={secretKey()}
				placeholder="OPEN_AI_API_KEY"
				type="text"
				onInput={(e) => setApiKey(e.currentTarget.value)}
			/>
		</div>
	);
}


function ChatStream(props: {stream: MessageStream<AssistantMessage>}) {
  return <AssistantMessageComponent message={props.stream.data()}/>
}

function AssistantMessageComponent(props: { message: AssistantMessage }) {
  return (
    <div class="assistant-message max-w-4/5 text-sm">
      <Show when={typeof props.message.content === "string" && props.message.content}>
        {text =>
          <Markdown md={text()} />
        }
      </Show>
      <For each={props.message.tool_calls ?? []}>
        {call => <RenderToolCall tool={call} />}
      </For>
  </div>);
}

function ToolResponseMessage(_: { message: ToolMessage }) {
 return(
  <div class="text-sm !text-green-400 font-mono">
    Done
  </div>)
}


function ChatMessages(props: { messages: ChatMessage[] }) {
  return (
    <div class="flex flex-col gap-y-2 text-sm">
    <For each={props.messages}>
      {message => (
        <Switch>
          <Match when={message.role === "user"}>
            <div class="flex justify-end">
              <div class="max-w-4/5 bg-green-400/20 px-2 py-1">
                {/*@ts-ignore*/}
                <Markdown md={message.content} />
              </div>
            </div>
          </Match>
          <Match when={message.role === "assistant" && message}>
              {message => <AssistantMessageComponent message={message()} />}
          </Match>
          <Match when={message.role === "tool" && message}>
              {message => <ToolResponseMessage message={message()} />}
          </Match>
        </Switch>
      )}
    </For>
  </div>);
}


function UpArrow() {
  return (
    <pre class="!text-green-400 select-none text-2lx w-[24px] h-[20px] pl-[8px]">
     ^
    </pre>
  )
}
