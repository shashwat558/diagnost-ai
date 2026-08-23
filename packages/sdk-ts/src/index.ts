export { DiagnostClient, createClient, type DiagnostClientOpts } from "./client.js";
export {
  DiagnostSpanExporter,
  createSpanExporter,
} from "./otel.js";
export {
  redactValue,
  type CustomRule,
  type RedactOptions,
  type RedactionFinding,
  type RedactResult,
} from "./redact.js";
export const SDK_VERSION = "0.1.0";
