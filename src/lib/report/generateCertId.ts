// src/lib/report/generateCertId.ts
export function formatCertId(n: number) {
  return `WGL-CERT-${String(n).padStart(6, "0")}`;
}