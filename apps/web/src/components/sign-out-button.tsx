"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/button";

import { createSupabaseBrowserClient } from "#lib/supabase-browser";

export function SignOutButton() {
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function signOut(): Promise<void> {
    setPending(true);
    setFailed(false);
    try {
      const result = await createSupabaseBrowserClient().auth.signOut({ scope: "local" });
      if (result.error !== null) {
        setFailed(true);
        setPending(false);
        return;
      }
      router.replace("/auth/login");
      router.refresh();
    } catch (error: unknown) {
      if (error instanceof Error) {
        setFailed(true);
        setPending(false);
        return;
      }
      throw error;
    }
  }

  return (
    <div className="flex items-center gap-3">
      {failed ? (
        <p role="status" className="text-muted-foreground text-sm">
          Sign-out failed. Try again.
        </p>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          void signOut();
        }}
        disabled={pending}
      >
        {pending ? "Signing out..." : "Sign out"}
      </Button>
    </div>
  );
}
