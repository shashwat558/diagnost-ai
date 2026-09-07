"use client";

import { useRouter } from "next/navigation";
import { useLogout } from "@/hooks/use-auth";

export function LogoutButton() {
  const router = useRouter();
  const logout = useLogout();
  return (
    <button
      onClick={async () => {
        await logout.mutateAsync();
        router.push("/login");
        router.refresh();
      }}
      disabled={logout.isPending}
      className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 disabled:opacity-50"
    >
      Log out
    </button>
  );
}
