import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import {unified} from 'unified'
import { type AssistantMessage, type ChatMessage } from './server/chat'
import { on, Show, For, Switch, Match, createSignal, createEffect } from 'solid-js'
import { apiKey, sendMessage, keyErr, setApiKey, chatStream, chatMessages } from "./server/chat";
import type { MessageStream } from './server/stream'


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

  createEffect(on(chatStream, (current, prev) => {
    if (current && !prev && scrollable)
      scrollable.scrollTo(0, scrollable.scrollHeight)
  }));

  return (
  <div class="max-h-screen flex-1 flex flex-col justify-between py-2 items-center">
    <div class="w-[400px]">
      <ApiKey />
    </div>
    <div class="flex justify-center min-h-0 flex-1 overflow-y-auto w-screen items-start scroll-smooth"
      ref={scrollable}
    >
      <div class="w-[400px] py-2">
        <ChatMessages messages={chatMessages()}/>
          <Show when={chatStream()}>
            {stream=> <ChatStream stream={stream()}/>}
          </Show>
      </div>
    </div>
    <div class="w-[400px]">
      <ChatInput />
    </div>
  </div>)
}

function ChatInput() {
  const [input, setInput] = createSignal("");
  const send = () => {
    sendMessage(input())
    setInput("");
  }
  return(
  <div class="flex border border-green-400 w-[400px] items-end flex-0">
    <textarea
      placeholder="Search the knowledge base with AI"
      class="px-2 py-1 focus:outline-none min-h-[80px] align-top flex-1 resize-none text-sm"
      onInput={e => setInput(e.currentTarget.value)}
      value={input()}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          send()
          e.preventDefault()
        }
      }}

    />
    <div class="px-1 hover:bg-green-400/20"
      onClick={send}
    >
      <UpArrow/>
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
			<div class="!text-green-400 text-xs font-mono"> API KEY</div>
			<input
				class="px-2 py-1 focus:outline-none border border-green-400 w-[400px] h-[40px] text-sm italic font-mono"
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
  return (<div class="assistant-message max-w-4/5 px-2 py-1 text-sm">
    <Markdown md={props.message.content} />
  </div>);
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
                  <Markdown md={message.content} />
              </div>
            </div>
          </Match>
          <Match when={message.role === "assistant" && message}>
              {message => <AssistantMessageComponent message={message()} />}
          </Match>
          <Match when={message.role === "tool"}>
            <div> tool call</div>
          </Match>
        </Switch>
      )}
    </For>
  </div>);
}


function UpArrow() {
  return (
    <svg
      class="text-green-400"
      fill="currentColor"
      stroke-width="0"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      height="24px"
      width="24px">
      <path fill-rule="evenodd" d="m8.024 5.928-4.357 4.357-.62-.618L7.716 5h.618L13 9.667l-.619.618-4.357-4.357z" clip-rule="evenodd"></path>
    </svg>
  )
}
