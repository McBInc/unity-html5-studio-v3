// src/lib/launch/scoring.ts

export type Deduction = {
  reason: string;
  penalty: number;
  meta?: Record<string, any>;
};

export type ScoreBreakdown = {
  score: number;
  deductions: Deduction[];
};

export type NormalizedScan = {
  totalBytes: number;
  initialDownloadBytes?: number | null;
  fileCount?: number | null;
  maxSingleFileBytes?: number | null;

  hasBrotli: boolean;
  hasGzip: boolean;

  requiresSpaFallback?: boolean | null;
  sdkDetected?: string[] | null;

  raw?: any;
};

export type PlatformRules = {
  name: string;
  slug: string;
  initialDownloadMaxMB?: number | null;
  totalBuildMaxMB?: number | null;
  maxFileCount?: number | null;
  maxSingleFileMB?: number | null;
  requiresCompressedBuild: boolean;
  acceptedCompression: string[];
  requiresSdkInjection: boolean;
  sdkType?: string | null;
};

export type HostRules = {
  name: string;
  slug: string;
  supportsBrotli: boolean;
  supportsGzip: boolean;
  requiresManualHeaderConfig: boolean;
  defaultSpaFallback: boolean;
};

export type LaunchScore = {
  platformFit: ScoreBreakdown;
  hostCompatibility: ScoreBreakdown;
  readinessScore: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function mb(bytes: number) {
  return bytes / (1024 * 1024);
}

//
// PLATFORM FIT
//

export function scorePlatformFit(
  scan: NormalizedScan,
  rules: PlatformRules
): ScoreBreakdown {
  let score = 100;
  const deductions: Deduction[] = [];

  // 1) Initial download size (only if we actually have it)
  if (
    rules.initialDownloadMaxMB != null &&
    scan.initialDownloadBytes != null
  ) {
    const initialMB = mb(scan.initialDownloadBytes);
    if (initialMB > rules.initialDownloadMaxMB) {
      const over = initialMB - rules.initialDownloadMaxMB;
      const penalty = clamp(over * 2.0, 5, 35);
      score -= penalty;
      deductions.push({
        reason: "Initial download too large",
        penalty,
        meta: {
          initialMB: Number(initialMB.toFixed(2)),
          maxMB: rules.initialDownloadMaxMB,
        },
      });
    }
  }

  // 2) Total build size
  if (rules.totalBuildMaxMB != null) {
    const totalMB = mb(scan.totalBytes);
    if (totalMB > rules.totalBuildMaxMB) {
      const over = totalMB - rules.totalBuildMaxMB;
      const penalty = clamp(over * 0.5, 5, 30);
      score -= penalty;
      deductions.push({
        reason: "Total build too large",
        penalty,
        meta: {
          totalMB: Number(totalMB.toFixed(2)),
          maxMB: rules.totalBuildMaxMB,
        },
      });
    }
  }

  // 3) File count
  if (
    rules.maxFileCount != null &&
    scan.fileCount != null
  ) {
    if (scan.fileCount > rules.maxFileCount) {
      const over = scan.fileCount - rules.maxFileCount;
      const penalty = clamp(over / 50, 3, 20);
      score -= penalty;
      deductions.push({
        reason: "Too many files",
        penalty,
        meta: {
          fileCount: scan.fileCount,
          max: rules.maxFileCount,
        },
      });
    }
  }

  // 4) Single file size
  if (
    rules.maxSingleFileMB != null &&
    scan.maxSingleFileBytes != null
  ) {
    const maxSingleMB = mb(scan.maxSingleFileBytes);
    if (maxSingleMB > rules.maxSingleFileMB) {
      const over = maxSingleMB - rules.maxSingleFileMB;
      const penalty = clamp(over * 0.4, 3, 20);
      score -= penalty;
      deductions.push({
        reason: "Single file too large",
        penalty,
        meta: {
          maxSingleMB: Number(maxSingleMB.toFixed(2)),
          maxMB: rules.maxSingleFileMB,
        },
      });
    }
  }

  // 5) Compression requirement
  if (rules.requiresCompressedBuild) {
    const compressionSatisfied =
      (rules.acceptedCompression.includes("brotli") && scan.hasBrotli) ||
      (rules.acceptedCompression.includes("gzip") && scan.hasGzip);

    if (!compressionSatisfied) {
      score -= 25;
      deductions.push({
        reason: "Missing required compression",
        penalty: 25,
      });
    }
  }

  // 6) SDK requirement
  if (rules.requiresSdkInjection && rules.sdkType) {
    const detected = scan.sdkDetected ?? [];
    if (!detected.includes(rules.sdkType)) {
      score -= 15;
      deductions.push({
        reason: "Required SDK not detected",
        penalty: 15,
        meta: { sdkType: rules.sdkType },
      });
    }
  }

  score = clamp(score, 0, 100);

  return {
    score: Math.round(score),
    deductions,
  };
}

//
// HOST COMPATIBILITY
//

export function scoreHostCompatibility(
  scan: NormalizedScan,
  host: HostRules
): ScoreBreakdown {
  let score = 100;
  const deductions: Deduction[] = [];

  if (scan.hasBrotli && !host.supportsBrotli) {
    score -= 18;
    deductions.push({
      reason: "Build uses Brotli but host may not serve it",
      penalty: 18,
    });
  }

  if (scan.hasGzip && !host.supportsGzip) {
    score -= 12;
    deductions.push({
      reason: "Build uses Gzip but host may not serve it",
      penalty: 12,
    });
  }

  if (scan.requiresSpaFallback && !host.defaultSpaFallback) {
    score -= 15;
    deductions.push({
      reason: "SPA fallback likely required but host default is off",
      penalty: 15,
    });
  }

  if (host.requiresManualHeaderConfig) {
    score -= 6;
    deductions.push({
      reason: "Manual header config needed",
      penalty: 6,
    });
  }

  score = clamp(score, 0, 100);

  return {
    score: Math.round(score),
    deductions,
  };
}

//
// FINAL COMPOSITE
//

export function scoreLaunch(
  scan: NormalizedScan,
  platform: PlatformRules,
  host: HostRules
): LaunchScore {
  const platformFit = scorePlatformFit(scan, platform);
  const hostCompatibility = scoreHostCompatibility(scan, host);

  const readiness = Math.round(
    platformFit.score * 0.6 + hostCompatibility.score * 0.4
  );

  return {
    platformFit,
    hostCompatibility,
    readinessScore: readiness,
  };
}
