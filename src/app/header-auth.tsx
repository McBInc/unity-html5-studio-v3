// src/app/header-auth.tsx
"use client";

import React from "react";
import { signIn, signOut, useSession } from "next-auth/react";

export default function HeaderAuth() {
  const { data: session, status } = useSession();
  const email = session?.user?.email ?? null;

  if (status === "loading") {
    return <span style={{ fontSize: 13, opacity: 0.7 }}>Checking…</span>;
  }

  if (status === "unauthenticated") {
    return (
      <button
        onClick={() => signIn(undefined, { callbackUrl: "/history" })}
        style={{
          fontSize: 13,
          padding: "8px 10px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: "black",
          color: "white",
          cursor: "pointer",
        }}
      >
        Sign in
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 13, opacity: 0.8 }}>
        {email ? (
          <>
            Signed in as <strong>{email}</strong>
          </>
        ) : (
          "Signed in"
        )}
      </span>

      <button
        onClick={() => signOut({ callbackUrl: "/signin" })}
        style={{
          fontSize: 13,
          padding: "8px 10px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: "white",
          cursor: "pointer",
        }}
      >
        Sign out
      </button>
    </div>
  );
}
