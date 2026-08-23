import { describe, expect, it, vi } from "vitest";
import { publish } from "./index.js";

describe("publish", () => {
  it("serializes payloads to JSON and preserves keys", async () => {
    const send = vi.fn().mockResolvedValue([]);
    const producer = { send } as unknown as Parameters<typeof publish>[0];

    await publish(producer, "events.raw", [
      { key: "trace-1", value: { id: 1 } },
      { value: { id: 2 } },
    ]);

    expect(send).toHaveBeenCalledWith({
      topic: "events.raw",
      messages: [
        { key: "trace-1", value: expect.any(Buffer) },
        { key: undefined, value: expect.any(Buffer) },
      ],
    });
    const msgs = send.mock.calls[0]![0].messages as Array<{ value: Buffer }>;
    expect(JSON.parse(msgs[0]!.value.toString())).toEqual({ id: 1 });
  });

  it("no-ops on empty input", async () => {
    const send = vi.fn();
    const producer = { send } as unknown as Parameters<typeof publish>[0];
    await publish(producer, "events.raw", []);
    expect(send).not.toHaveBeenCalled();
  });
});
