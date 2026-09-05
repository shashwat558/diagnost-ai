/** Maps raw API/machine error codes to plain-language messages (+ docs hint). */

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Wrong email or password. Try again.",
  email_taken: "That email already has an account. Try logging in instead.",
  weak_password: "Password must be at least 8 characters.",
  invalid_email: "Enter a valid email address.",
  missing_fields: "Please fill in every field.",
  invalid_json: "Something went wrong sending your request. Try again.",
  unauthenticated: "You're logged out. Log in and try again.",
  forbidden: "Your role can't do that — ask a workspace admin.",
  invalid_plan: "That plan doesn't exist.",
  price_not_configured: "Billing isn't set up yet — contact support.",
  product_not_configured: "Billing isn't set up yet — contact support.",
  no_customer: "No payment method yet — complete a checkout first.",
  no_checkout_url: "The payment page couldn't open. Try again.",
  dodo_checkout_failed: "The payment page couldn't open. Try again.",
  quota_exceeded: "Monthly event limit reached — upgrade in Settings to keep ingesting.",
  "channel already exists": "That channel is already added.",
  "channel must be 'email' or 'slack'": "Pick Email or Slack.",
  "target is required": "Enter an email address or webhook URL.",
  "target too long": "That value is too long.",
  "enter a valid email address": "Enter a valid email address.",
  "enabled must be boolean": "Something went wrong. Try again.",
  not_found: "That item no longer exists. Refresh the page.",
  Signup: "Signup failed. Try again.",
  "Login failed.": "Login failed. Check your connection and try again.",
};

export function friendlyError(raw: string | null | undefined, fallback = "Something went wrong. Try again."): string {
  if (!raw) return fallback;
  const key = raw.trim();
  if (MESSAGES[key]) return MESSAGES[key];
  // provider errors come prefixed ("delivery failed: ...") — keep the detail, soften the lead
  if (/^(delivery failed|webhook_error|checkout failed)/i.test(key)) {
    return key.replace(/^webhook_error:\s*/i, "Payment service error: ");
  }
  return fallback;
}
