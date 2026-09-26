import { ImageResponse } from "next/og";
import { getPublicStack } from "@/services";

export const alt = "Cleave proof of split";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ink = "#111114";
const muted = "#85858e";
const ok = "#2e7d5b";
const okSoft = "#e7f3ec";
const warn = "#93600f";
const warnSoft = "#fbf1de";

/** Share card for a public proof: title, verdict and the layer strip, with real numbers. */
export default async function Image({ params }: { params: Promise<{ stackId: string }> }) {
  const { stackId } = await params;
  const found = await getPublicStack(stackId);

  if (!found) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f7f4", color: ink, fontSize: 56 }}>
          Cleave
        </div>
      ),
      size,
    );
  }

  const { stack } = found;
  const checks = stack.verification.checks;
  const passing = checks.filter((c) => c.state === "pass").length;
  const total = stack.layers.reduce((s, l) => s + l.additions + l.deletions, 0) || 1;
  const original = stack.additions + stack.deletions;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f8f7f4", padding: "64px 72px", color: ink }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: muted }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ width: 26, height: 12, background: ink, borderRadius: "13px 13px 2px 2px" }} />
            <div style={{ width: 26, height: 12, background: "#5b5bd6", borderRadius: "2px 2px 13px 13px" }} />
          </div>
          <span style={{ color: ink, fontWeight: 600 }}>Cleave</span>
          <span>· Proof of split</span>
        </div>

        <div style={{ marginTop: 56, fontSize: 26, color: muted, display: "flex" }}>
          {stack.repoFullName}
          {stack.prNumber ? ` · #${stack.prNumber}` : ""}
        </div>
        <div style={{ marginTop: 12, fontSize: 64, lineHeight: 1.05, letterSpacing: -1.5, display: "flex", maxWidth: 1000 }}>{stack.title}</div>

        <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                width: 76,
                height: 76,
                borderRadius: 38,
                background: passing === checks.length ? okSoft : warnSoft,
                color: passing === checks.length ? ok : warn,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 40,
              }}
            >
              {passing === checks.length ? "✓" : "!"}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 48, fontWeight: 600, display: "flex" }}>
                {passing}/{checks.length} checks pass
              </span>
              <span style={{ fontSize: 24, color: muted, display: "flex" }}>
                {original.toLocaleString("en")} lines → {stack.layers.length} layers · 0 lines written by AI
              </span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 36, display: "flex", gap: 8, height: 44 }}>
          {stack.layers.map((l) => (
            <div
              key={l.index}
              style={{
                flexGrow: (l.additions + l.deletions) / total,
                flexBasis: 0,
                minWidth: 44,
                borderRadius: 10,
                background: l.status === "pass" ? okSoft : warnSoft,
                border: `2px solid ${l.status === "pass" ? "#bfe0cc" : "#f0d9ad"}`,
                color: l.status === "pass" ? ok : warn,
                fontSize: 20,
                display: "flex",
                alignItems: "center",
                paddingLeft: 12,
              }}
            >
              {String(l.index).padStart(2, "0")}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
