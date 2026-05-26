import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import data from "./chain-data.json";

export const FPS = 30;

// Scene durations in seconds
const S1_TITLE       = 4;
const S2_PROBLEM     = 6;
const S3_ARCH        = 9;
const S4_TIERS       = 12;
const S5_PROOF       = 8;
const S6_OUTRO       = 4;

const seq = (sec: number) => Math.round(sec * FPS);
const FROM = {
  s1: 0,
  s2: seq(S1_TITLE),
  s3: seq(S1_TITLE + S2_PROBLEM),
  s4: seq(S1_TITLE + S2_PROBLEM + S3_ARCH),
  s5: seq(S1_TITLE + S2_PROBLEM + S3_ARCH + S4_TIERS),
  s6: seq(S1_TITLE + S2_PROBLEM + S3_ARCH + S4_TIERS + S5_PROOF),
};
const TOTAL = seq(S1_TITLE + S2_PROBLEM + S3_ARCH + S4_TIERS + S5_PROOF + S6_OUTRO);
export const MAIN_DURATION_FRAMES = TOTAL;

const COLORS = {
  bg: "#0a0b0d",
  panel: "#14161a",
  border: "#23262d",
  text: "#e6e8eb",
  muted: "#8b8f98",
  accent: "#4f8cff",
  accentDeep: "#8a5cf7",
  green: "#4ade80",
  gold: "#f0c14b",
};

const FONT = { fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif' as const };

export const Main: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, color: COLORS.text, ...FONT }}>
      <Sequence from={FROM.s1} durationInFrames={seq(S1_TITLE)}><Title /></Sequence>
      <Sequence from={FROM.s2} durationInFrames={seq(S2_PROBLEM)}><Problem /></Sequence>
      <Sequence from={FROM.s3} durationInFrames={seq(S3_ARCH)}><Architecture /></Sequence>
      <Sequence from={FROM.s4} durationInFrames={seq(S4_TIERS)}><TierDemo /></Sequence>
      <Sequence from={FROM.s5} durationInFrames={seq(S5_PROOF)}><Proof /></Sequence>
      <Sequence from={FROM.s6} durationInFrames={seq(S6_OUTRO)}><Outro /></Sequence>
    </AbsoluteFill>
  );
};

// ----------------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------------

function useFadeIn(startFrame = 0, lengthFrames = 12) {
  const f = useCurrentFrame();
  return interpolate(f - startFrame, [0, lengthFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

function useSpring(delay = 0, config: Parameters<typeof spring>[0]["config"] = { damping: 18, stiffness: 120 }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config });
}

const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      background: COLORS.panel,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 24,
      padding: 32,
      ...style,
    }}
  >
    {children}
  </div>
);

// ----------------------------------------------------------------------------
// Scene 1 — Title
// ----------------------------------------------------------------------------

const Title: React.FC = () => {
  const titleScale = useSpring(0);
  const subFade = useFadeIn(20, 16);
  const tagFade = useFadeIn(60, 16);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", transform: `scale(${0.85 + titleScale * 0.15})` }}>
        <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2 }}>
          OKB <span style={{ color: COLORS.accent }}>Loyalty Hook</span>
        </div>
        <div style={{ fontSize: 32, marginTop: 16, color: COLORS.muted, opacity: subFade }}>
          A Uniswap V4 hook on X Layer that turns trading volume into a fee discount
        </div>
        <div style={{ fontSize: 22, marginTop: 48, color: COLORS.gold, opacity: tagFade, letterSpacing: 4 }}>
          HOOK THE FUTURE · X LAYER × UNISWAP × FLAP
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ----------------------------------------------------------------------------
// Scene 2 — Problem
// ----------------------------------------------------------------------------

const Problem: React.FC = () => {
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 1300 }}>
        <ProblemLine delay={0} text="Most loyalty programs are off-chain spreadsheets." />
        <ProblemLine delay={36} text="DEX fees are the same for the user with $1 of volume" />
        <ProblemLine delay={72} text="and the user with $1 million of volume." />
        <ProblemLine delay={108} text="That's not a market structure — that's a leak." emphasis />
      </div>
    </AbsoluteFill>
  );
};

const ProblemLine: React.FC<{ delay: number; text: string; emphasis?: boolean }> = ({ delay, text, emphasis }) => {
  const fade = useFadeIn(delay, 16);
  const slide = interpolate(useCurrentFrame() - delay, [0, 16], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        fontSize: emphasis ? 56 : 40,
        fontWeight: emphasis ? 700 : 500,
        color: emphasis ? COLORS.gold : COLORS.text,
        opacity: fade,
        transform: `translateY(${slide}px)`,
        marginTop: emphasis ? 40 : 16,
      }}
    >
      {text}
    </div>
  );
};

// ----------------------------------------------------------------------------
// Scene 3 — Architecture
// ----------------------------------------------------------------------------

const Architecture: React.FC = () => {
  const head = useFadeIn(0, 14);
  const swapBox  = useSpring(20);
  const beforeBox = useSpring(60);
  const afterBox  = useSpring(120);
  const sbtBox    = useSpring(180);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 64 }}>
      <div style={{ fontSize: 48, fontWeight: 700, opacity: head, marginBottom: 48 }}>
        Two callbacks. One soulbound score.
      </div>

      <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
        <ArchBox label="swap" sub="Trader sends" scale={swapBox} color={COLORS.muted} />
        <Arrow />
        <ArchBox label="beforeSwap" sub="Read tier → override fee" scale={beforeBox} color={COLORS.accent} highlight />
        <Arrow />
        <ArchBox label="afterSwap" sub="Credit volume → maybe promote" scale={afterBox} color={COLORS.accent} highlight />
      </div>

      <div style={{ marginTop: 48, transform: `scale(${0.7 + sbtBox * 0.3})`, opacity: sbtBox }}>
        <div
          style={{
            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDeep})`,
            color: "white",
            padding: "20px 40px",
            borderRadius: 16,
            fontSize: 32,
            fontWeight: 700,
            boxShadow: `0 12px 48px ${COLORS.accent}66`,
          }}
        >
          LoyaltySBT — soulbound, non-transferable
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ArchBox: React.FC<{ label: string; sub: string; scale: number; color: string; highlight?: boolean }> = ({ label, sub, scale, color, highlight }) => (
  <div
    style={{
      transform: `scale(${0.7 + scale * 0.3})`,
      opacity: scale,
      background: highlight ? "#1a2940" : COLORS.panel,
      border: `2px solid ${color}`,
      borderRadius: 20,
      padding: "28px 36px",
      width: 320,
      textAlign: "center",
    }}
  >
    <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "monospace" }}>{label}</div>
    <div style={{ fontSize: 16, color: COLORS.muted, marginTop: 8 }}>{sub}</div>
  </div>
);

const Arrow: React.FC = () => (
  <div style={{ fontSize: 40, color: COLORS.muted }}>→</div>
);

// ----------------------------------------------------------------------------
// Scene 4 — Tier demo
// ----------------------------------------------------------------------------

const TIERS = [
  { name: "Newcomer", fee: 3000, threshold: 0n },
  { name: "Bronze",   fee: 2500, threshold: 100n },
  { name: "Silver",   fee: 1500, threshold: 1000n },
  { name: "Gold",     fee: 500,  threshold: 10000n },
];

const TierDemo: React.FC = () => {
  const f = useCurrentFrame();
  const head = useFadeIn(0, 14);
  // promote at: frame 90 → Bronze, 180 → Silver, 270 → Gold
  const tier = f < 90 ? 0 : f < 180 ? 1 : f < 270 ? 2 : 3;

  // animate volume counter
  const volPath = [0, 50, 95, 100, 700, 990, 1000, 5000, 9900, 10000, 10000];
  const tPath   = [0, 30, 60, 90,  120, 150, 180,  220,  260,   270,   330];
  const volume = interpolate(f, tPath, volPath, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 64 }}>
      <div style={{ fontSize: 42, fontWeight: 700, opacity: head, marginBottom: 32 }}>
        Volume crosses a threshold → next swap pays a lower fee.
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {TIERS.map((t, i) => (
          <TierCard key={i} tier={t} index={i} current={i === tier} unlocked={i < tier} />
        ))}
      </div>

      <div style={{ width: 1100, marginTop: 16 }}>
        <div style={{ height: 12, background: "#23262d", borderRadius: 999, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${(Math.log10(Math.max(volume, 1)) / 4) * 100}%`,
              background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accentDeep})`,
              borderRadius: 999,
              transition: "width 0.3s",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, color: COLORS.muted, fontSize: 18 }}>
          <span>Volume: {Math.round(volume).toLocaleString()}</span>
          <span>Current fee: <span style={{ color: COLORS.green, fontWeight: 700 }}>{(TIERS[tier].fee / 10000).toFixed(2)}%</span></span>
        </div>
      </div>

      <PromoBanner triggerFrame={90}  label="Bronze" />
      <PromoBanner triggerFrame={180} label="Silver" />
      <PromoBanner triggerFrame={270} label="Gold" />
    </AbsoluteFill>
  );
};

const TierCard: React.FC<{ tier: typeof TIERS[number]; index: number; current: boolean; unlocked: boolean }> = ({ tier, current, unlocked }) => {
  const lift = current ? -12 : 0;
  return (
    <div
      style={{
        width: 240,
        padding: 24,
        background: current ? "linear-gradient(180deg, #1a2940 0%, #0f1a2c 100%)" : COLORS.panel,
        border: `2px solid ${current ? COLORS.accent : COLORS.border}`,
        borderRadius: 20,
        textAlign: "center",
        transform: `translateY(${lift}px)`,
        boxShadow: current ? `0 16px 48px ${COLORS.accent}33` : "none",
        transition: "transform 0.3s, border-color 0.3s",
        opacity: current ? 1 : unlocked ? 0.7 : 0.45,
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 600, color: current ? COLORS.accent : COLORS.muted }}>{tier.name}</div>
      <div style={{ fontSize: 36, fontWeight: 800, marginTop: 8 }}>{(tier.fee / 10000).toFixed(2)}%</div>
      <div style={{ fontSize: 14, color: COLORS.muted, marginTop: 8 }}>≥ {tier.threshold.toString()} volume</div>
    </div>
  );
};

const PromoBanner: React.FC<{ triggerFrame: number; label: string }> = ({ triggerFrame, label }) => {
  const f = useCurrentFrame();
  const t = f - triggerFrame;
  if (t < 0 || t > 30) return null;
  const scale = interpolate(t, [0, 6, 24, 30], [0.5, 1.1, 1.0, 1.0], { extrapolateRight: "clamp" });
  const opacity = interpolate(t, [0, 4, 22, 30], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        top: 320,
        left: "50%",
        transform: `translateX(-50%) scale(${scale})`,
        opacity,
        background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDeep})`,
        color: "white",
        padding: "20px 48px",
        borderRadius: 20,
        fontSize: 36,
        fontWeight: 800,
        boxShadow: "0 24px 64px rgba(79,140,255,0.4)",
      }}
    >
      ⬆ Promoted to {label}
    </div>
  );
};

// ----------------------------------------------------------------------------
// Scene 5 — Real on-chain proof
// ----------------------------------------------------------------------------

const Proof: React.FC = () => {
  const head = useFadeIn(0, 14);
  const grid = useFadeIn(28, 18);
  const txFade = useFadeIn(80, 16);
  const stamp = useSpring(160);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 64 }}>
      <div style={{ fontSize: 42, fontWeight: 700, opacity: head, marginBottom: 8 }}>
        Live on X Layer mainnet.
      </div>
      <div style={{ fontSize: 22, color: COLORS.muted, opacity: head, marginBottom: 32 }}>
        chain {data.chainId} · pre-deployed Uniswap V4 PoolManager
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, width: 1300, opacity: grid }}>
        <KV k="OKBLoyaltyHook" v={data.contracts.hook} />
        <KV k="LoyaltySBT" v={data.contracts.sbt} />
        <KV k="LoyaltyRouter" v={data.contracts.router} />
        <KV k="V4 PoolManager" v={data.contracts.poolManager} />
      </div>

      <div style={{ marginTop: 40, opacity: txFade, width: 1300 }}>
        <Card style={{ borderColor: COLORS.green, background: "#0f1c14" }}>
          <div style={{ fontSize: 16, color: COLORS.muted }}>DEMO SWAP TX (gas {data.demoSwap.gasUsed.toLocaleString()})</div>
          <div style={{ fontSize: 22, fontFamily: "monospace", marginTop: 12, color: COLORS.green, wordBreak: "break-all" }}>
            {data.demoSwap.hash}
          </div>
          <div style={{ marginTop: 16, fontSize: 18, color: COLORS.muted }}>
            block #{data.demoSwap.blockNumber.toLocaleString()} · status {data.demoSwap.status === 1 ? "✓ success" : "fail"} · {data.demoSwap.logCount} logs
          </div>
        </Card>
      </div>

      <div style={{
        position: "absolute", top: 60, right: 60,
        opacity: stamp,
        transform: `rotate(-12deg) scale(${0.5 + stamp * 0.5})`,
        border: `4px solid ${COLORS.green}`, color: COLORS.green,
        padding: "12px 28px", borderRadius: 12,
        fontSize: 28, fontWeight: 800, letterSpacing: 2,
      }}>
        ON CHAIN
      </div>
    </AbsoluteFill>
  );
};

const KV: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <div
    style={{
      background: COLORS.panel,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 12,
      padding: 16,
    }}
  >
    <div style={{ fontSize: 14, color: COLORS.muted, letterSpacing: 1 }}>{k.toUpperCase()}</div>
    <div style={{ fontSize: 20, fontFamily: "monospace", marginTop: 6, wordBreak: "break-all" }}>{v}</div>
  </div>
);

// ----------------------------------------------------------------------------
// Scene 6 — Outro
// ----------------------------------------------------------------------------

const Outro: React.FC = () => {
  const headFade = useFadeIn(0, 16);
  const tagFade = useFadeIn(40, 16);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 80, fontWeight: 800, opacity: headFade, letterSpacing: -1 }}>
          OKB <span style={{ color: COLORS.accent }}>Loyalty Hook</span>
        </div>
        <div style={{ fontSize: 28, color: COLORS.muted, marginTop: 24, opacity: tagFade }}>
          @XLayerOfficial · @Uniswap · @flapdotsh
        </div>
        <div style={{ fontSize: 22, color: COLORS.gold, marginTop: 32, opacity: tagFade, letterSpacing: 4 }}>
          HOOK THE FUTURE
        </div>
      </div>
    </AbsoluteFill>
  );
};
