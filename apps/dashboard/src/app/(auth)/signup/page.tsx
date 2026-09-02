"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, workspaceName: workspaceName || undefined }),
      });
      const data = (await res.json()) as { apiKey?: string; error?: string };
      if (!res.ok) {
        const messages: Record<string, string> = {
          email_taken: "That email already has an account.",
          weak_password: "Password must be at least 8 characters.",
          invalid_email: "Enter a valid email address.",
        };
        setError(messages[data.error ?? ""] ?? "Signup failed.");
        return;
      }
      setApiKey(data.apiKey ?? null); // shown once
    } finally {
      setBusy(false);
    }
  }

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
        <button
          onClick={() => {
            router.push("/");
            router.refresh();
          }}
          className="mt-4 w-full rounded-md bg-accent py-2 text-[13px] font-medium text-white hover:opacity-90"
        >
          Open dashboard →
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h1 className="text-[15px] font-semibold text-gray-900">Create your workspace</h1>
      <p className="mt-0.5 text-[12px] text-gray-500">Free plan — 50k events/month.</p>
      <label className="mt-4 block text-[12px] font-medium text-gray-700">
        Workspace name{" "}
        <span className="font-normal text-gray-400">(optional)</span>
      </label>
      <input
        value={workspaceName}
        onChange={(e) => setWorkspaceName(e.target.value)}
        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-accent"
        placeholder="Acme Agents"
      />
      <label className="mt-3 block text-[12px] font-medium text-gray-700">Email</label>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-accent"
        placeholder="you@company.com"
      />
      <label className="mt-3 block text-[12px] font-medium text-gray-700">Password</label>
      <input
        type="password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-accent"
        placeholder="At least 8 characters"
      />
      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full rounded-md bg-accent py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create workspace"}
      </button>
      <p className="mt-3 text-center text-[12px] text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
