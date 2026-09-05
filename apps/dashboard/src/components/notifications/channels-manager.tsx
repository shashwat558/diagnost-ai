"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { friendlyError } from "@/lib/friendly-errors";
import {
  useChannels,
  useAddChannel,
  useToggleChannel,
  useDeleteChannel,
  useTestChannel,
} from "@/hooks/use-channels";

const formSchema = z.object({
  channel: z.enum(["email", "slack"]),
  target: z.string().min(1, "Target is required").max(500),
});
type FormInput = z.infer<typeof formSchema>;

export function ChannelsManager() {
  const { data: channels, isLoading, error } = useChannels();
  const add = useAddChannel();
  const toggle = useToggleChannel();
  const remove = useDeleteChannel();
  const test = useTestChannel();
  const [testResult, setTestResult] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: { channel: "email", target: "" },
  });
  const channel = watch("channel");

  const onSubmit = handleSubmit(async (data) => {
    setTestResult(null);
    try {
      await add.mutateAsync(data);
      reset();
    } catch (err) {
      setError("target", { message: friendlyError(err instanceof Error ? err.message : null, "Couldn't add the channel. Try again.") });
    }
  });

  const onTest = async (id: string) => {
    setTestResult(null);
    try {
      await test.mutateAsync(id);
      setTestResult("Test sent — check the inbox / channel.");
    } catch (err) {
      setTestResult(friendlyError(err instanceof Error ? err.message : null, "Test failed. Check the address or webhook URL and SMTP settings."));
    }
  };

  return (
    <div>
      {isLoading && <p className="mt-2 text-[12px] text-gray-400">Loading channels…</p>}
      {error && (
        <p className="mt-2 text-[12px] text-red-600">
          Couldn't load channels.{" "}
          <button className="underline hover:text-red-700" onClick={() => window.location.reload()}>
            Retry
          </button>
        </p>
      )}

      <table className="mt-2 w-full text-[13px]">
        <tbody>
          {(channels ?? []).map((c) => (
            <tr key={c.id} className="border-b border-gray-100 last:border-0">
              <td className="py-2">
                <Badge variant="secondary">{c.channel}</Badge>
              </td>
              <td className="max-w-[220px] truncate px-3 py-2 font-mono text-[12px] text-gray-700">
                {c.target}
              </td>
              <td className="py-2 text-right">
                <span
                  className={`mr-2 text-[11px] ${c.enabled ? "text-emerald-600" : "text-gray-400"}`}
                >
                  {c.enabled ? "on" : "off"}
                </span>
                <button
                  onClick={() => toggle.mutate({ id: c.id, enabled: !c.enabled })}
                  className="mr-2 text-[11px] text-gray-500 hover:text-gray-800"
                >
                  {c.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => onTest(c.id)}
                  disabled={test.isPending}
                  className="mr-2 text-[11px] text-gray-500 hover:text-gray-800 disabled:opacity-50"
                >
                  Test
                </button>
                <button
                  onClick={() => remove.mutate(c.id)}
                  className="text-[11px] text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {!isLoading && (channels ?? []).length === 0 && (
            <tr>
              <td className="py-2 text-gray-400">No channels yet — add one below.</td>
            </tr>
          )}
        </tbody>
      </table>
      {testResult && <p className="mt-1 text-[12px] text-gray-600">{testResult}</p>}

      <form onSubmit={onSubmit} className="mt-3 flex gap-2" noValidate>
        <select
          {...register("channel")}
          className="h-9 rounded-md border border-gray-200 bg-white px-2 text-[13px] outline-none focus:border-gray-300"
          aria-label="Channel type"
        >
          <option value="email">Email</option>
          <option value="slack">Slack</option>
        </select>
        <Input
          {...register("target")}
          className="flex-1"
          placeholder={channel === "email" ? "oncall@example.com" : "https://hooks.slack.com/…"}
        />
        <Button type="submit" variant="outline" disabled={isSubmitting || add.isPending}>
          {add.isPending ? "…" : "Add"}
        </Button>
      </form>
      {(errors.target || errors.channel) && (
        <p className="mt-1 text-[12px] text-red-600">
          {errors.target?.message ?? errors.channel?.message}
        </p>
      )}
    </div>
  );
}
