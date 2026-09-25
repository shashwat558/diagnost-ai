"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validation";
import { useLogin } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { friendlyError } from "@/lib/friendly-errors";

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const busy = isSubmitting || login.isPending;

  const onSubmit = handleSubmit(async (data) => {
    try {
      await login.mutateAsync(data);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : null;
      if (msg === "invalid_credentials") {
        setError("password", { message: "Wrong email or password." });
        setError("email", { message: " " });
      } else {
        setError("password", { message: friendlyError(msg) });
      }
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 font-sans text-white"
      noValidate
    >
      <h1 className="font-display text-lg font-bold text-white tracking-tight">Log in to workspace</h1>

      <div>
        <label className="block font-tech text-xs uppercase tracking-wider text-[#999999]">Email Address</label>
        <Input
          type="email"
          {...register("email")}
          className="mt-1"
          placeholder="you@company.com"
          aria-invalid={!!errors.email}
        />
        {errors.email?.message && errors.email.message.trim() && (
          <p className="mt-1 font-tech text-xs text-red-400">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label className="block font-tech text-xs uppercase tracking-wider text-[#999999]">Password</label>
        <Input
          type="password"
          {...register("password")}
          className="mt-1"
          placeholder="••••••••"
          aria-invalid={!!errors.password}
        />
        {errors.password?.message && (
          <p className="mt-1 font-tech text-xs text-red-400">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" disabled={busy} className="mt-2 w-full">
        {busy ? "Logging in…" : "Log in"}
      </Button>

      <p className="mt-4 text-center font-tech text-xs text-[#999999]">
        No account?{" "}
        <Link href="/signup" className="text-[#52a8ff] hover:underline">
          Sign up free
        </Link>
      </p>
    </form>
  );
}
