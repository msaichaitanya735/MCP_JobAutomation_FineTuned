"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    startTransition(() => {
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={logout}
      disabled={pending}
      className="gap-1.5 font-mono text-xs"
    >
      <LogOut className="size-3.5" />
      log out
    </Button>
  );
}
