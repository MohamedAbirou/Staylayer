/**
 * Extract a user-presentable error message from an unknown thrown value.
 * Handles axios errors (response.data.message can be string or string[]),
 * generic Error instances, and falls back to a stable default.
 */
export function extractErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const maybeAxios = err as {
      response?: { data?: { message?: string | string[] } };
      message?: string;
    };
    const msg = maybeAxios.response?.data?.message;
    if (Array.isArray(msg)) return msg.join("; ");
    if (typeof msg === "string") return msg;
    if (maybeAxios.message) return maybeAxios.message;
  }
  return "Action failed. Please retry.";
}
