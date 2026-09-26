"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupInput } from "@/lib/validation";
import { useSignup } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { friendlyError } from "@/lib/friendly-errors";

export default function SignupPage() {
  const router = useRouter();
  const signup = useSignup();
  const [apiKey, setApiKey] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { workspaceName: "", email: "", password: "" },
  });

  const busy = isSubmitting || signup.isPending;

  const onSubmit = handleSubmit(async (data) => {
    try {
      const res = await signup.mutateAsync({
        email: data.email,
        password: data.password,
        workspaceName: data.workspaceName || undefined,
      });
      setApiKey(res.apiKey ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : null;
      if (msg === "email_taken" || msg === "weak_password" || msg === "invalid_email") {
        setError("email", { message: friendlyError(msg) });
      } else {
        setError("root", { message: friendlyError(msg) });
      }
    }
  });

  if (apiKey) {
    return (
      <div className="space-y-4 font-sans text-ink">
        <h1 className="font-display text-lg font-bold text-ink tracking-tight">Welcome to Diagnost AI</h1>
        <p className="font-tech text-xs text-ink-muted">
          Your ingestion API key — copy it now, it won&apos;t be shown again.
        </p>
        <code className="block break-all rounded-none border border-line-strong bg-surface-2 px-3 py-2 font-mono text-xs text-brand">
          {apiKey}
        </code>
        <Button
          onClick={() => {
            router.push("/dashboard");
            router.refresh();
          }}
          className="mt-4 w-full"
        >
          Open dashboard →
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 font-sans text-ink"
      noValidate
    >
      <div>
        <h1 className="font-display text-lg font-bold text-ink tracking-tight">Create your workspace</h1>
        <p className="font-tech text-xs text-ink-muted mt-0.5">Free plan — 50k events/month included.</p>
      </div>

      <div>
        <label className="block font-tech text-xs uppercase tracking-wider text-ink-muted">
          Workspace Name <span className="text-ink-muted/60 font-normal">(optional)</span>
        </label>
        <Input {...register("workspaceName")} className="mt-1" placeholder="Acme Agents" />
        {errors.workspaceName && (
          <p className="mt-1 font-tech text-xs text-red-600 dark:text-red-400">{errors.workspaceName.message}</p>
        )}
      </div>

      <div>
        <label className="block font-tech text-xs uppercase tracking-wider text-ink-muted">Email Address</label>
        <Input type="email" {...register("email")} className="mt-1" placeholder="you@company.com" />
        {errors.email && <p className="mt-1 font-tech text-xs text-red-600 dark:text-red-400">{errors.email.message}</p>}
      </div>

      <div>
        <label className="block font-tech text-xs uppercase tracking-wider text-ink-muted">Password</label>
        <Input type="password" {...register("password")} className="mt-1" placeholder="At least 8 characters" />
        {errors.password && <p className="mt-1 font-tech text-xs text-red-600 dark:text-red-400">{errors.password.message}</p>}
        {errors.root && <p className="mt-2 font-tech text-xs text-red-600 dark:text-red-400">{errors.root.message}</p>}
      </div>

      <Button type="submit" disabled={busy} className="mt-2 w-full">
        {busy ? "Creating…" : "Create workspace"}
      </Button>

      <p className="mt-4 text-center font-tech text-xs text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-brand hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
