// src/lib/auth.ts
import type { NextAuthOptions, LoggerInstance } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

function serializeError(e: unknown) {
  // NextAuth sometimes surfaces ErrorEvent; its `error` property is readonly.
  // We convert it to a plain object to avoid logger crashes.
  const anyE = e as any;

  if (typeof ErrorEvent !== "undefined" && e instanceof ErrorEvent) {
    return {
      name: "ErrorEvent",
      message: e.message,
      filename: (e as any).filename,
      lineno: (e as any).lineno,
      colno: (e as any).colno,
      // underlying error (may be null/undefined)
      inner: (e as any).error
        ? {
            name: (e as any).error?.name,
            message: (e as any).error?.message,
            stack: (e as any).error?.stack,
            code: (e as any).error?.code,
            response: (e as any).error?.response,
            responseCode: (e as any).error?.responseCode,
            command: (e as any).error?.command,
          }
        : null,
    };
  }

  if (anyE && typeof anyE === "object") {
    return {
      name: anyE.name,
      message: anyE.message,
      stack: anyE.stack,
      code: anyE.code,
      response: anyE.response,
      responseCode: anyE.responseCode,
      command: anyE.command,
      cause: anyE.cause,
    };
  }

  return { value: String(e) };
}

const logger: Partial<LoggerInstance> = {
  error(code, metadata) {
    console.error("[next-auth][error]", code, serializeError(metadata));
  },
  warn(code) {
    console.warn("[next-auth][warn]", code);
  },
  debug(code, metadata) {
    console.log("[next-auth][debug]", code, metadata);
  },
};

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  debug: true,
  logger,

  providers: [
    GitHubProvider({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),

    EmailProvider({
  server: {
    host: "smtp.postmarkapp.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.POSTMARK_SERVER_TOKEN!,  // <-- token
      pass: process.env.POSTMARK_SERVER_TOKEN!,  // <-- token
    },
  },

  from: process.env.POSTMARK_FROM_EMAIL!,

  async sendVerificationRequest(params) {
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport(params.provider.server as any);

      const { identifier, url, provider } = params;

      const result = await transport.sendMail({
        to: identifier,
        from: provider.from,
        subject: "Sign in to Unity HTML5 Studio",
        text: `Sign in:\n${url}\n`,
        html: `<p>Sign in:</p><p><a href="${url}">${url}</a></p>`,

        // ✅ Postmark stream header (recommended)
        headers: {
          "X-PM-MESSAGE-STREAM": "outbound",
        },
      });

      console.log("[auth] sendMail result:", result);
    } catch (e: any) {
      console.error("[auth] sendVerificationRequest FAILED:", {
        message: e?.message,
        code: e?.code,
        response: e?.response,
        responseCode: e?.responseCode,
        command: e?.command,
      });
      throw e;
    }
  },
})


  ],

  pages: {
    signIn: "/signin",
  },

  secret: process.env.NEXTAUTH_SECRET,
};
