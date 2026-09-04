export type ChannelType = "email" | "slack";

/** Returns an error message when the target is invalid, else null. */
export function validateChannel(channel: string, target: string): string | null {
  if (channel !== "email" && channel !== "slack") {
    return "channel must be 'email' or 'slack'";
  }
  const t = (target ?? "").trim();
  if (!t) return "target is required";
  if (t.length > 500) return "target too long";
  if (channel === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return "enter a valid email address";
  } else {
    if (!/^https:\/\/hooks\.slack\.com\//.test(t) && !/^https:\/\//.test(t)) {
      return "enter a valid Slack webhook URL (https://hooks.slack.com/…)";
    }
  }
  return null;
}
