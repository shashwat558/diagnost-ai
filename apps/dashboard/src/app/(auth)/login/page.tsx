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
      className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      noValidate
    >
      <h1 className="text-[15px] font-semibold text-gray-900">Log in</h1>

      <label className="mt-4 block text-[12px] font-medium text-gray-700">Email</label>
      <Input
        type="email"
        {...register("email")}
        className="mt-1"
        placeholder="you@company.com"
        aria-invalid={!!errors.email}
      />
      {errors.email?.message && errors.email.message.trim() && (
        <p className="mt-1 text-[12px] text-red-600">{errors.email.message}</p>
      )}

      <label className="mt-3 block text-[12px] font-medium text-gray-700">Password</label>
      <Input
        type="password"
        {...register("password")}
        className="mt-1"
        placeholder="••••••••"
        aria-invalid={!!errors.password}
      />
      {errors.password?.message && (
        <p className="mt-1 text-[12px] text-red-600">{errors.password.message}</p>
      )}

      <Button type="submit" disabled={busy} className="mt-4 w-full">
        {busy ? "Logging in…" : "Log in"}
      </Button>
      <p className="mt-3 text-center text-[12px] text-gray-500">
        No account?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Sign up free
        </Link>
      </p>
    </form>
  );
}
