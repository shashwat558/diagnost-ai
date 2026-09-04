"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddInstruction } from "@/hooks/use-instructions";

const formSchema = z.object({
  handles_intent: z.string().min(1, "Pick an intent"),
  name: z
    .string()
    .min(1, "Name is required")
    .max(80, "Max 80 characters")
    .regex(/^[a-z0-9_]+$/, "Use snake_case (letters, numbers, underscores)"),
  content: z.string().min(10, "At least 10 characters").max(10_000),
});
type FormInput = z.infer<typeof formSchema>;

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export function NewInstructionDialog({
  intents,
  onClose,
}: {
  intents: string[];
  onClose: (createdName: string | null) => void;
}) {
  const add = useAddInstruction();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: { handles_intent: intents[0] ?? "", name: "", content: "" },
  });
  const intent = watch("handles_intent");

  const onSubmit = handleSubmit(async (data) => {
    try {
      const created = await add.mutateAsync(data);
      onClose(created.name);
    } catch (err) {
      setError("name", { message: err instanceof Error ? err.message : "Create failed." });
    }
  });

  const busy = isSubmitting || add.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={() => !busy && onClose(null)}
      role="dialog"
      aria-modal="true"
      aria-label="New instruction"
    >
      <div
        className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-semibold text-gray-900">New instruction</h2>
        <p className="mt-0.5 text-[12px] text-gray-500">
          A versioned prompt the auto-improver can refine. Saved as v1 — future
          remediation runs propose v2+ with eval reports.
        </p>

        <form onSubmit={onSubmit} className="mt-4" noValidate>
          <label className="block text-[12px] font-medium text-gray-700">Handles intent</label>
          <select
            {...register("handles_intent")}
            className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-[13px] outline-none focus:border-gray-300"
          >
            {intents.map((i) => (
              <option key={i} value={i}>
                {i.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          {errors.handles_intent && (
            <p className="mt-1 text-[12px] text-red-600">{errors.handles_intent.message}</p>
          )}

          <label className="mt-3 block text-[12px] font-medium text-gray-700">
            Name{" "}
            <button
              type="button"
              className="font-normal text-accent hover:underline"
              onClick={() => setValue("name", `${slugify(intent)}_prompt`, { shouldValidate: true })}
            >
              suggest
            </button>
          </label>
          <Input {...register("name")} className="mt-1" placeholder="booking_assistant_prompt" />
          {errors.name && <p className="mt-1 text-[12px] text-red-600">{errors.name.message}</p>}

          <label className="mt-3 block text-[12px] font-medium text-gray-700">
            Prompt content (v1)
          </label>
          <textarea
            {...register("content")}
            rows={6}
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 font-mono text-[12px] outline-none placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-violet-100"
            placeholder="You are a booking assistant. Always validate dates (month 1-12) before confirming…"
          />
          {errors.content && (
            <p className="mt-1 text-[12px] text-red-600">{errors.content.message}</p>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onClose(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save instruction"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
