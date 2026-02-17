// prisma/seed.ts
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  // ----------------------------
  // Platforms
  // ----------------------------
  await prisma.platform.upsert({
    where: { slug: "poki" },
    update: {
      name: "Poki",
      initialDownloadMaxMB: 10,
      requiresCompressedBuild: true,
      acceptedCompression: JSON.stringify(["brotli", "gzip"]),
      requiresSdkInjection: true,
      sdkType: "poki",
      notes:
        "Target ~8–10MB initial download. Treat 10MB as a hard target; excessive load size hurts approval/retention.",
    },
    create: {
      slug: "poki",
      name: "Poki",
      initialDownloadMaxMB: 10,
      requiresCompressedBuild: true,
      acceptedCompression: JSON.stringify(["brotli", "gzip"]),
      requiresSdkInjection: true,
      sdkType: "poki",
      notes:
        "Target ~8–10MB initial download. Treat 10MB as a hard target; excessive load size hurts approval/retention.",
    },
  });

  await prisma.platform.upsert({
    where: { slug: "crazygames" },
    update: {
      name: "CrazyGames",
      initialDownloadMaxMB: 50,
      totalBuildMaxMB: 250,
      maxFileCount: 1500,
      requiresCompressedBuild: true,
      acceptedCompression: JSON.stringify(["brotli", "gzip"]),
      requiresSdkInjection: true,
      sdkType: "crazysdk",
      notes:
        "Compressed builds only. Initial download <=50MB, total <=250MB, file count <=1500. Prefer Brotli.",
    },
    create: {
      slug: "crazygames",
      name: "CrazyGames",
      initialDownloadMaxMB: 50,
      totalBuildMaxMB: 250,
      maxFileCount: 1500,
      requiresCompressedBuild: true,
      acceptedCompression: JSON.stringify(["brotli", "gzip"]),
      requiresSdkInjection: true,
      sdkType: "crazysdk",
      notes:
        "Compressed builds only. Initial download <=50MB, total <=250MB, file count <=1500. Prefer Brotli.",
    },
  });

  await prisma.platform.upsert({
    where: { slug: "itchio-html5" },
    update: {
      name: "itch.io (HTML5)",
      totalBuildMaxMB: 500,
      maxSingleFileMB: 200,
      maxFileCount: 1000,
      requiresCompressedBuild: false,
      acceptedCompression: JSON.stringify(["none", "gzip", "brotli"]),
      requiresSdkInjection: false,
      sdkType: null,
      notes:
        "ZIP extraction limits: <=1000 files, extracted total <=500MB, any single file <=200MB, path length limits.",
    },
    create: {
      slug: "itchio-html5",
      name: "itch.io (HTML5)",
      totalBuildMaxMB: 500,
      maxSingleFileMB: 200,
      maxFileCount: 1000,
      requiresCompressedBuild: false,
      acceptedCompression: JSON.stringify(["none", "gzip", "brotli"]),
      requiresSdkInjection: false,
      sdkType: null,
      notes:
        "ZIP extraction limits: <=1000 files, extracted total <=500MB, any single file <=200MB, path length limits.",
    },
  });

  // ----------------------------
  // Hosts
  // ----------------------------
  const hosts = [
    {
      slug: "vercel",
      name: "Vercel",
      supportsBrotli: true,
      supportsGzip: true,
      requiresManualHeaderConfig: false,
      defaultSpaFallback: true,
      edgeNetwork: "vercel-edge",
      notes:
        "Strong defaults; still confirm correct Content-Type + encoding headers for Unity assets.",
    },
    {
      slug: "netlify",
      name: "Netlify",
      supportsBrotli: true,
      supportsGzip: true,
      requiresManualHeaderConfig: true,
      defaultSpaFallback: true,
      edgeNetwork: "netlify-edge",
      notes:
        "Often requires explicit _headers and _redirects for Unity WebGL + SPA fallback + compression serving.",
    },
    {
      slug: "cloudflare-pages",
      name: "Cloudflare Pages",
      supportsBrotli: true,
      supportsGzip: true,
      requiresManualHeaderConfig: true,
      defaultSpaFallback: true,
      edgeNetwork: "cloudflare",
      notes:
        "Great CDN; expect explicit headers/routing rules for Unity WebGL to ensure correct encodings and wasm types.",
    },
  ] as const;

  for (const h of hosts) {
    await prisma.host.upsert({
      where: { slug: h.slug },
      update: { ...h },
      create: { ...h },
    });
  }

  console.log("✅ Seed complete (Platforms + Hosts)");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
