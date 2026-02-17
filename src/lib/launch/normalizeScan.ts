// src/lib/launch/normalizeScan.ts
import type { NormalizedScan } from "./scoring";

/**
 * Normalizes your persisted scan JSON (Build.scanResult) into a stable shape for scoring.
 * This is intentionally defensive: scans evolve, but scoring needs consistent fields.
 */
export function normalizeScan(scanJson: any, buildRow?: any): NormalizedScan {
  // Prefer explicit summary fields if present, then fall back to common variants.
  const totalBytes =
    num(
      scanJson?.summary?.totalBytes ??
        scanJson?.totalBytes ??
        buildRow?.scanResult?.summary?.totalBytes ??
        buildRow?.scanResult?.totalBytes
    ) ?? 0;

  const fileCount =
    num(
      scanJson?.summary?.fileCount ??
        scanJson?.fileCount ??
        (Array.isArray(scanJson?.files) ? scanJson.files.length : null) ??
        buildRow?.scanResult?.summary?.fileCount ??
        buildRow?.scanResult?.fileCount
    ) ?? null;

  const maxSingleFileBytes =
    num(
      scanJson?.summary?.maxFileBytes ??
        scanJson?.summary?.maxSingleFileBytes ??
        scanJson?.maxSingleFileBytes ??
        scanJson?.maxFileBytes ??
        buildRow?.scanResult?.summary?.maxFileBytes ??
        buildRow?.scanResult?.maxSingleFileBytes
    ) ?? null;

  // Optional. If not present, leave null. Later you can estimate critical path files.
  const initialDownloadBytes =
    num(
      scanJson?.summary?.initialDownloadBytes ??
        scanJson?.initialDownloadBytes ??
        buildRow?.scanResult?.summary?.initialDownloadBytes ??
        buildRow?.scanResult?.initialDownloadBytes
    ) ?? null;

  // Your Build model has these as columns (best source of truth)
  const hasBrotli = Boolean(
    buildRow?.brotliPresent ??
      scanJson?.compression?.brotli ??
      scanJson?.brotliPresent ??
      scanJson?.summary?.brotliPresent
  );

  const hasGzip = Boolean(
    buildRow?.gzipPresent ??
      scanJson?.compression?.gzip ??
      scanJson?.gzipPresent ??
      scanJson?.summary?.gzipPresent
  );

  const requiresSpaFallback = Boolean(
    scanJson?.signals?.spaFallbackRequired ??
      scanJson?.signals?.requiresSpaFallback ??
      scanJson?.requiresSpaFallback ??
      false
  );

  const sdkDetected =
    scanJson?.signals?.sdkDetected ??
    scanJson?.sdkDetected ??
    scanJson?.summary?.sdkDetected ??
    null;

  return {
    totalBytes,
    initialDownloadBytes,
    fileCount,
    maxSingleFileBytes,
    hasBrotli,
    hasGzip,
    requiresSpaFallback,
    sdkDetected,
    raw: scanJson,
  };
}

/** Convert unknown numeric-like values safely. Returns null if not a finite number. */
function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
