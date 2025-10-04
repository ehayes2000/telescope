export type Result<T, E> = { type: "ok"; data: T } | { type: "err"; err: E };

export const ok = <T, E>(data: T): Result<T, E> => ({ type: "ok", data });
export const err = <T, E>(err: E): Result<T, E> => ({ type: "err", err });
