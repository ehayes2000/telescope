import type { Accessor } from "solid-js";

export interface MessageStream<T> {
	data: Accessor<T>;
	stop: () => void;
	isDone: () => boolean;
	isErr: () => boolean;
}
