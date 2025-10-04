export function useDebounce<T, R>(
	f: (args: T) => R,
	ms: number,
): (args: T) => void {
	let timeout: number | undefined;
	return (args: T) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => f(args), ms);
	};
}
