"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  const [email, setEmail] = useState("");

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">Sign in</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Continue with GitHub or receive a secure magic link by email.
      </p>

      <div className="rounded-2xl border p-5 space-y-4">
        <button
          className="w-full rounded-xl px-4 py-3 border bg-black text-white"
          onClick={() => signIn("github", { callbackUrl: "/history" })}
        >
          Continue with GitHub
        </button>

        <div className="border-t pt-4">
          <label className="text-sm block mb-2">Email</label>
          <input
            className="w-full border rounded-xl p-3"
            placeholder="you@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button
            className="w-full mt-3 rounded-xl px-4 py-3 border"
            onClick={() => signIn("email", { email, callbackUrl: "/history" })}
            disabled={!email.includes("@")}
          >
            Email me a magic link
          </button>

          <p className="text-xs text-muted-foreground mt-3">
            Tip: You can send the magic link to Gmail for testing. You do not need an aimationtech mailbox yet.
          </p>
        </div>
      </div>
    </div>
  );
}
