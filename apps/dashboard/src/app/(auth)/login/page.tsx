"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error === "invalid_credentials" ? "Wrong email or password." : "Login failed.");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h1 className="text-[15px] font-semibold text-gray-900">Log in</h1>
      <label className="mt-4 block text-[12px] font-medium text-gray-700">Email</label>
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
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-accent"
        placeholder="••••••••"
      />
      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full rounded-md bg-accent py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Logging in…" : "Log in"}
      </button>
      <p className="mt-3 text-center text-[12px] text-gray-500">
        No account?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Sign up free
        </Link>
      </p>
    </form>
  );
}
