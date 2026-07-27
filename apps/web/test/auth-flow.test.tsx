// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPassword = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("#lib/supabase-browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithPassword },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

import { SignInForm } from "../src/components/sign-in-form";

describe("invite-only Supabase sign-in", () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    replace.mockReset();
    refresh.mockReset();
  });

  it("submits credentials directly to Supabase and returns to the requested route", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<SignInForm nextPath="/private" />);

    await user.type(screen.getByRole("textbox", { name: "Email address" }), "person@example.test");
    await user.type(screen.getByLabelText("Password"), "synthetic-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "person@example.test",
      password: "synthetic-password",
    });
    expect(replace).toHaveBeenCalledWith("/private");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("returns one generic rejection without provider or account detail", async () => {
    signInWithPassword.mockResolvedValue({
      error: { status: 400, message: "Invalid login credentials" },
    });
    const user = userEvent.setup();
    render(<SignInForm nextPath="/" />);

    await user.type(screen.getByRole("textbox", { name: "Email address" }), "person@example.test");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Sign-in failed. Check your credentials and try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Invalid login credentials/u)).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("surfaces provider availability failures without provider detail", async () => {
    signInWithPassword.mockResolvedValue({
      error: {
        name: "AuthRetryableFetchError",
        status: 0,
        message: "sensitive provider detail",
      },
    });
    const user = userEvent.setup();
    render(<SignInForm nextPath="/" />);

    await user.type(screen.getByRole("textbox", { name: "Email address" }), "person@example.test");
    await user.type(screen.getByLabelText("Password"), "synthetic-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Sign-in is temporarily unavailable. Try again later."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/sensitive provider detail/u)).not.toBeInTheDocument();
  });

  it("rejects malformed credentials without contacting Supabase", async () => {
    const user = userEvent.setup();
    render(<SignInForm nextPath="/" />);

    await user.type(screen.getByRole("textbox", { name: "Email address" }), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Enter a valid email address and password."),
    ).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
