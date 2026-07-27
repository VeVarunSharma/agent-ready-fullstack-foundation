import { SignInForm } from "#components/sign-in-form";
import { ThemeToggle } from "@repo/ui/components/theme";

import { parseRelativeApplicationPath } from "../../../lib/relative-application-path";

export const dynamic = "force-dynamic";

interface LoginPageProperties {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProperties) {
  const parameters = await searchParams;
  const requestedPath =
    typeof parameters.next === "string" ? parseRelativeApplicationPath(parameters.next) : undefined;
  const nextPath = requestedPath ?? "/";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-6 sm:px-10 sm:py-8">
      <header className="border-border flex items-center justify-between gap-4 border-b pb-5">
        <p className="text-sm font-semibold tracking-tight">Application foundation</p>
        <ThemeToggle />
      </header>
      <section className="flex flex-1 items-center justify-center py-16 sm:py-24">
        <div className="border-border bg-surface text-surface-foreground w-full max-w-md rounded-xl border p-6 shadow-sm sm:p-8">
          <p className="text-muted-foreground text-sm font-medium">Supabase Auth</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-muted-foreground mt-4 leading-7">
            Use credentials issued through the approved invitation process.
          </p>
          <SignInForm nextPath={nextPath} />
        </div>
      </section>
    </main>
  );
}
