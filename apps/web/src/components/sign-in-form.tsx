"use client";

import { useState, type SyntheticEvent } from "react";
import { z } from "zod";
import { Button } from "@repo/ui/components/button";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "#lib/supabase-browser";

const credentialsSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(1_024),
});
type FormStatus = "idle" | "invalid" | "loading" | "rejected" | "unavailable";

function statusMessage(status: FormStatus): string | undefined {
  switch (status) {
    case "idle":
    case "loading":
      return undefined;
    case "invalid":
      return "Enter a valid email address and password.";
    case "rejected":
      return "Sign-in failed. Check your credentials and try again.";
    case "unavailable":
      return "Sign-in is temporarily unavailable. Try again later.";
  }
}

interface SignInFormProperties {
  readonly nextPath: string;
}

export function SignInForm({ nextPath }: SignInFormProperties) {
  const [status, setStatus] = useState<FormStatus>("idle");
  const router = useRouter();

  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>): Promise<void> {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const credentials = credentialsSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!credentials.success) {
      setStatus("invalid");
      return;
    }

    setStatus("loading");
    try {
      const result = await createSupabaseBrowserClient().auth.signInWithPassword(credentials.data);
      formElement.reset();
      if (result.error === null) {
        router.replace(nextPath);
        router.refresh();
        return;
      }

      const operationalFailure =
        result.error.status === 0 ||
        result.error.status === undefined ||
        result.error.status === 429 ||
        result.error.status >= 500 ||
        result.error.name === "AuthRetryableFetchError";
      setStatus(operationalFailure ? "unavailable" : "rejected");
    } catch (error: unknown) {
      if (error instanceof Error) {
        formElement.reset();
        setStatus("unavailable");
        return;
      }
      throw error;
    }
  }

  const message = statusMessage(status);
  return (
    <form
      className="mt-8 flex flex-col gap-5"
      onSubmit={(event) => {
        void submit(event);
      }}
      noValidate
    >
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          aria-describedby="sign-in-help sign-in-status"
          className="border-input bg-background text-foreground focus-visible:ring-ring focus-visible:ring-offset-background min-h-10 rounded-md border px-3 py-2 text-base shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={1_024}
          aria-describedby="sign-in-help sign-in-status"
          className="border-input bg-background text-foreground focus-visible:ring-ring focus-visible:ring-offset-background min-h-10 rounded-md border px-3 py-2 text-base shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        />
      </div>
      <p id="sign-in-help" className="text-muted-foreground text-sm leading-6">
        Access is invite-only. Credentials go directly to Supabase Auth and are never logged.
      </p>
      <Button type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Signing in..." : "Sign in"}
      </Button>
      <p id="sign-in-status" role="status" aria-live="polite" className="min-h-6 text-sm">
        {message}
      </p>
    </form>
  );
}
