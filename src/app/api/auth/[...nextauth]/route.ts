import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// ✅ Force Node runtime (EmailProvider / SMTP requires Node)
export const runtime = "nodejs";
// ✅ Avoid caching issues on auth routes
export const dynamic = "force-dynamic";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
