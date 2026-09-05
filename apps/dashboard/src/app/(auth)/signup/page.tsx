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
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-[15px] font-semibold text-gray-900">Welcome to Diagnost AI</h1>
        <p className="mt-1 text-[12px] text-gray-500">
          Your ingestion API key — copy it now, it won&apos;t be shown again.
        </p>
        <code className="mt-3 block break-all rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-[12px] text-gray-700">
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
      className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      noValidate
    >
      <h1 className="text-[15px] font-semibold text-gray-900">Create your workspace</h1>
      <p className="mt-0.5 text-[12px] text-gray-500">Free plan — 50k events/month.</p>

      <label className="mt-4 block text-[12px] font-medium text-gray-700">
        Workspace name <span className="font-normal text-gray-400">(optional)</span>
      </label>
      <Input {...register("workspaceName")} className="mt-1" placeholder="Acme Agents" />
      {errors.workspaceName && (
        <p className="mt-1 text-[12px] text-red-600">{errors.workspaceName.message}</p>
      )}

      <label className="mt-3 block text-[12px] font-medium text-gray-700">Email</label>
      <Input type="email" {...register("email")} className="mt-1" placeholder="you@company.com" />
      {errors.email && <p className="mt-1 text-[12px] text-red-600">{errors.email.message}</p>}

      <label className="mt-3 block text-[12px] font-medium text-gray-700">Password</label>
      <Input type="password" {...register("password")} className="mt-1" placeholder="At least 8 characters" />
      {errors.password && <p className="mt-1 text-[12px] text-red-600">{errors.password.message}</p>}
      {errors.root && <p className="mt-2 text-[12px] text-red-600">{errors.root.message}</p>}

      <Button type="submit" disabled={busy} className="mt-4 w-full">
        {busy ? "Creating…" : "Create workspace"}
      </Button>
      <p className="mt-3 text-center text-[12px] text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
