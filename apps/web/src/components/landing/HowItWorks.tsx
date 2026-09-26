function MapArt() {
  const nodes = [
    [60, 60], [120, 42], [180, 70], [240, 50], [90, 118], [150, 132], [210, 116], [270, 128], [120, 186], [200, 180],
  ];
  const edges = [[0, 4], [1, 5], [2, 6], [3, 7], [4, 8], [5, 8], [6, 9], [7, 9], [1, 2]];
  return (
    <svg viewBox="0 0 330 230" className="size-full" aria-hidden="true">
      {edges.map(([a, b]) => {
        const p = nodes[a!]!;
        const q = nodes[b!]!;
        return <line key={`${a}-${b}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="var(--line-strong)" strokeWidth="1" />;
      })}
      {nodes.map(([x, y], i) => (
        <rect key={i} x={x! - 7} y={y! - 7} width="14" height="14" rx="3" transform={`rotate(45 ${x} ${y})`} fill="var(--surface)" stroke={i % 3 === 0 ? "var(--accent)" : "var(--ink-3)"} strokeWidth="1.2" />
      ))}
    </svg>
  );
}

function LayerArt() {
  const widths = [210, 170, 240, 150, 190];
  return (
    <svg viewBox="0 0 330 230" className="size-full" aria-hidden="true">
      {widths.map((w, i) => (
        <g key={i} transform={`translate(${60 + i * 6}, ${34 + i * 34})`}>
          <rect width={w} height="24" rx="7" fill="var(--surface)" stroke="var(--line-strong)" />
          <text x="10" y="16" fontSize="10" fontFamily="var(--font-mono)" fill="var(--ink-3)">
            {String(i + 1).padStart(2, "0")}
          </text>
          <rect x="34" y="10" width={w * 0.45} height="4" rx="2" fill={i === 2 ? "var(--accent)" : "var(--line-strong)"} />
        </g>
      ))}
    </svg>
  );
}

function ProveArt() {
  return (
    <svg viewBox="0 0 330 230" className="size-full" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(70, ${30 + i * 30})`}>
          <circle cx="9" cy="9" r="9" fill="var(--ok-soft)" />
          <path d="M5 9.5 8 12.3 13.2 6.5" fill="none" stroke="var(--ok)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="30" y="6" width={120 + ((i * 37) % 60)} height="6" rx="3" fill="var(--line-strong)" />
        </g>
      ))}
      <g transform="translate(70, 186)">
        <rect width="190" height="26" rx="8" fill="var(--surface)" stroke="var(--line-strong)" />
        <text x="12" y="17" fontSize="11" fontFamily="var(--font-mono)" fill="var(--ink-2)">9c1e47d = 9c1e47d</text>
      </g>
    </svg>
  );
}

const steps = [
  {
    n: "01",
    title: "Map",
    lead: "Cut the change into atoms.",
    body: "Cleave splits the diff into its smallest hunks and maps which ones depend on which, using the code itself.",
    art: <MapArt />,
  },
  {
    n: "02",
    title: "Layer",
    lead: "Group atoms into ordered layers.",
    body: "Bob groups related atoms into named layers. It can move atoms between layers, and nothing else.",
    art: <LayerArt />,
  },
  {
    n: "03",
    title: "Prove",
    lead: "Check every layer on its own.",
    body: "Each layer runs your tests in a clean worktree. The final layer must match the original tree exactly.",
    art: <ProveArt />,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 px-5 py-24 sm:px-8 md:py-32">
      <div className="mx-auto max-w-[1200px]">
        <p className="text-[13px] font-medium text-accent-ink">How it works</p>
        <h2 className="mt-3 max-w-xl font-display text-[40px] leading-[1.05] tracking-[-0.02em] text-ink sm:text-[52px]">
          Map. Layer. Prove.
        </h2>
        <div className="mt-14 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
          {steps.map((s) => (
            <div key={s.n}>
              <div className="aspect-[33/23] overflow-hidden rounded-2xl border border-line bg-subtle/60">{s.art}</div>
              <div className="mt-6 flex items-baseline gap-3">
                <span className="font-mono text-[12px] text-ink-3">{s.n}</span>
                <h3 className="text-[17px] font-medium text-ink">{s.title}</h3>
              </div>
              <p className="mt-2 text-[15px] text-ink">{s.lead}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-3">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
