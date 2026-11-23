/**
 * Illustrated covers / thumbnails (UI uplift). Each item gets a stable colour from its id
 * and an original vector illustration for what it is — books, notes, research, videos,
 * schools, tutoring. Pure SVG: no downloads, crisp on any screen, light on data.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { WaveLines } from "@/components/app/art";

export type CoverKind =
  | "book"
  | "course"
  | "research"
  | "notes"
  | "video"
  | "audio"
  | "link"
  | "store"
  | "school"
  | "tutor";

const PALETTES = [
  "bg-[linear-gradient(140deg,oklch(0.28_0.07_262),oklch(0.42_0.1_255))]",
  "bg-[linear-gradient(140deg,oklch(0.38_0.09_160),oklch(0.55_0.12_150))]",
  "bg-[linear-gradient(140deg,oklch(0.5_0.12_70),oklch(0.68_0.13_85))]",
  "bg-[linear-gradient(140deg,oklch(0.4_0.1_230),oklch(0.58_0.11_220))]",
  "bg-[linear-gradient(140deg,oklch(0.4_0.13_290),oklch(0.56_0.13_300))]",
  "bg-[linear-gradient(140deg,oklch(0.45_0.15_20),oklch(0.62_0.15_35))]",
  "bg-[linear-gradient(140deg,oklch(0.36_0.08_200),oklch(0.52_0.1_185))]",
];

function paletteFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length]!;
}

const W = "white";
const GOLD = "oklch(0.8 0.13 88)";
const INK = "oklch(0.22 0.05 262)";
const PAPER = "oklch(0.97 0.01 90)";

export function CoverIllustration({ kind }: { kind: CoverKind }) {
  switch (kind) {
    case "book":
      return (
        <>
          {/* stacked closed books behind */}
          <rect x="44" y="104" width="112" height="16" rx="3" fill={GOLD} />
          <rect x="52" y="90" width="98" height="15" rx="3" fill={W} opacity="0.35" />
          <path d="M52 112h96M60 97h82" stroke={INK} strokeOpacity="0.25" strokeWidth="2" />
          {/* open book */}
          <path d="M30 62c22-10 46-10 70 4v50c-24-14-48-14-70-4V62Z" fill={PAPER} />
          <path d="M170 62c-22-10-46-10-70 4v50c24-14 48-14 70-4V62Z" fill="oklch(0.92 0.02 88)" />
          <path d="M100 66v50" stroke={INK} strokeOpacity="0.2" strokeWidth="2" />
          <path
            d="M42 74c14-5 30-5 46 1M42 84c14-5 30-5 46 1M42 94c14-5 30-5 46 1M112 75c16-6 32-6 46-1M112 85c16-6 32-6 46-1M112 95c16-6 32-6 46-1"
            stroke={INK}
            strokeOpacity="0.25"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* bookmark ribbon */}
          <path d="M140 58v26l6-5 6 5V60" fill="oklch(0.63 0.2 25)" />
          <circle cx="40" cy="40" r="3" fill={GOLD} />
          <circle cx="164" cy="34" r="4" fill={W} opacity="0.7" />
          <path d="M156 20l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill={GOLD} />
        </>
      );
    case "course":
      return (
        <>
          {/* spiral notebook */}
          <rect x="56" y="44" width="80" height="96" rx="8" fill={PAPER} />
          <path
            d="M70 70h52M70 84h52M70 98h40M70 112h46"
            stroke={INK}
            strokeOpacity="0.25"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {[52, 66, 80, 94, 108, 122].map((y) => (
            <circle
              key={y}
              cx="56"
              cy={y}
              r="4"
              fill="none"
              stroke={INK}
              strokeOpacity="0.5"
              strokeWidth="2.5"
            />
          ))}
          {/* pencil */}
          <path d="M146 136l18-70 10 3-18 70-12 6 2-9Z" fill={GOLD} />
          <path d="M164 66l3-10 10 3-3 10" fill="oklch(0.63 0.2 25)" />
          {/* graduation cap */}
          <path d="M112 30l34-14 34 14-34 14-34-14Z" fill={INK} />
          <path d="M126 36v12c0 6 40 6 40 0V36" fill={INK} />
          <path d="M180 30v16" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
          <circle cx="180" cy="48" r="3.5" fill={GOLD} />
        </>
      );
    case "research":
      return (
        <>
          {/* flask */}
          <path
            d="M84 36h32M92 36v34l-30 52c-4 8 2 16 10 16h56c8 0 14-8 10-16l-30-52V36"
            fill={PAPER}
          />
          <path
            d="M70 112l14-24h32l14 24c4 7-1 14-8 14H78c-7 0-12-7-8-14Z"
            fill="oklch(0.62 0.12 160)"
          />
          <circle cx="92" cy="106" r="4" fill={W} opacity="0.8" />
          <circle cx="108" cy="98" r="3" fill={W} opacity="0.8" />
          <circle cx="100" cy="116" r="2.5" fill={W} opacity="0.8" />
          {/* magnifier */}
          <circle cx="150" cy="58" r="20" fill="none" stroke={GOLD} strokeWidth="7" />
          <path d="M164 72l18 18" stroke={GOLD} strokeWidth="8" strokeLinecap="round" />
          {/* atom */}
          <g
            transform="translate(48 50)"
            stroke={W}
            strokeOpacity="0.7"
            strokeWidth="2"
            fill="none"
          >
            <ellipse rx="20" ry="8" />
            <ellipse rx="20" ry="8" transform="rotate(60)" />
            <ellipse rx="20" ry="8" transform="rotate(-60)" />
          </g>
          <circle cx="48" cy="50" r="3.5" fill={GOLD} />
        </>
      );
    case "notes":
      return (
        <>
          <rect
            x="62"
            y="40"
            width="84"
            height="104"
            rx="6"
            fill={W}
            opacity="0.35"
            transform="rotate(-8 104 92)"
          />
          <rect x="58" y="36" width="84" height="104" rx="6" fill={PAPER} />
          <path
            d="M72 62h56M72 76h56M72 90h56M72 104h38M72 118h48"
            stroke={INK}
            strokeOpacity="0.22"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M72 50h30" stroke="oklch(0.55 0.15 255)" strokeWidth="4" strokeLinecap="round" />
          {/* paperclip */}
          <path
            d="M128 26v34a8 8 0 0 1-16 0V34"
            fill="none"
            stroke={GOLD}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M160 120l8-8M160 104l14-14"
            stroke={W}
            strokeOpacity="0.5"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      );
    case "video":
      return (
        <>
          <rect x="40" y="44" width="120" height="78" rx="12" fill={PAPER} />
          <path d="M90 66v34l28-17-28-17Z" fill="oklch(0.63 0.2 25)" />
          <rect x="40" y="128" width="120" height="10" rx="5" fill={W} opacity="0.35" />
          <rect x="40" y="128" width="48" height="10" rx="5" fill={GOLD} />
          {[52, 70, 88, 106, 124, 142].map((x) => (
            <rect key={x} x={x} y="30" width="10" height="7" rx="2" fill={W} opacity="0.5" />
          ))}
        </>
      );
    case "audio":
      return (
        <>
          <path
            d="M58 104V88a42 42 0 0 1 84 0v16"
            fill="none"
            stroke={PAPER}
            strokeWidth="9"
            strokeLinecap="round"
          />
          <rect x="46" y="98" width="24" height="38" rx="10" fill={GOLD} />
          <rect x="130" y="98" width="24" height="38" rx="10" fill={GOLD} />
          {[78, 88, 98, 108, 118].map((x, i) => (
            <rect
              key={x}
              x={x}
              y={112 - [10, 22, 30, 18, 8][i]!}
              width="6"
              height={[20, 44, 60, 36, 16][i]!}
              rx="3"
              fill={W}
              opacity="0.85"
            />
          ))}
        </>
      );
    case "link":
      return (
        <>
          <circle cx="100" cy="88" r="44" fill={PAPER} />
          <path
            d="M56 88h88M100 44c-16 14-16 74 0 88M100 44c16 14 16 74 0 88M64 64h72M64 112h72"
            stroke="oklch(0.55 0.12 230)"
            strokeWidth="3"
            fill="none"
          />
          <rect
            x="128"
            y="104"
            width="44"
            height="22"
            rx="11"
            fill="none"
            stroke={GOLD}
            strokeWidth="6"
          />
          <rect
            x="150"
            y="120"
            width="40"
            height="20"
            rx="10"
            fill="none"
            stroke={W}
            strokeWidth="6"
          />
        </>
      );
    case "store":
      return (
        <>
          <path d="M80 60v-8a20 20 0 0 1 40 0v8" fill="none" stroke={PAPER} strokeWidth="6" />
          <path d="M58 60h84l-6 82H64l-6-82Z" fill={GOLD} />
          <rect
            x="74"
            y="40"
            width="16"
            height="40"
            rx="3"
            fill="oklch(0.55 0.12 230)"
            transform="rotate(-10 82 60)"
          />
          <rect x="94" y="36" width="16" height="44" rx="3" fill={PAPER} />
          <rect
            x="114"
            y="42"
            width="14"
            height="38"
            rx="3"
            fill="oklch(0.62 0.12 160)"
            transform="rotate(8 121 61)"
          />
          <path
            d="M78 96h44"
            stroke={INK}
            strokeOpacity="0.3"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="160" cy="44" r="12" fill={W} opacity="0.85" />
          <path d="M156 44h8M160 40v8" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
        </>
      );
    case "school":
      return (
        <>
          <path d="M40 76l60-34 60 34H40Z" fill={GOLD} />
          <rect x="48" y="76" width="104" height="62" fill={PAPER} />
          {[60, 84, 108, 132].map((x) => (
            <rect key={x} x={x} y="86" width="10" height="44" rx="2" fill={INK} opacity="0.12" />
          ))}
          <rect x="90" y="106" width="20" height="32" rx="3" fill={INK} />
          <circle cx="100" cy="64" r="7" fill={PAPER} />
          <path d="M100 42V18" stroke={W} strokeWidth="2.5" />
          <path d="M100 18h20l-6 6 6 6h-20" fill="oklch(0.63 0.2 25)" />
          <rect x="36" y="138" width="128" height="6" rx="3" fill={W} opacity="0.4" />
          {/* tree */}
          <circle cx="172" cy="112" r="14" fill="oklch(0.62 0.12 160)" />
          <rect x="170" y="122" width="4" height="18" fill={INK} opacity="0.5" />
        </>
      );
    case "tutor":
      return (
        <>
          <rect x="36" y="40" width="96" height="66" rx="8" fill="oklch(0.3 0.05 160)" />
          <rect
            x="36"
            y="40"
            width="96"
            height="66"
            rx="8"
            fill="none"
            stroke={GOLD}
            strokeWidth="5"
          />
          <path
            d="M50 62h36M50 76h52M50 90h28"
            stroke={W}
            strokeOpacity="0.75"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path d="M70 106v26M98 106v26" stroke={GOLD} strokeWidth="5" strokeLinecap="round" />
          {/* trophy / medal */}
          <path d="M146 54h32v14a16 16 0 0 1-32 0V54Z" fill={GOLD} />
          <path
            d="M146 58h-8a10 10 0 0 0 10 12M178 58h8a10 10 0 0 1-10 12"
            fill="none"
            stroke={GOLD}
            strokeWidth="4"
          />
          <rect x="156" y="84" width="12" height="16" fill={GOLD} />
          <rect x="146" y="100" width="32" height="8" rx="2" fill={PAPER} />
          <path d="M162 24l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-7Z" fill={W} />
        </>
      );
  }
}

/**
 * Coloured gradient + wave lines + illustration. Fills its parent (give the parent a size
 * and `relative`). `art` controls where the illustration sits: "top" for portrait covers
 * (title goes underneath), "right" for landscape headers.
 */
export function CoverArt({
  kind,
  seed,
  art = "right",
  className,
  children,
}: {
  kind: CoverKind;
  seed: string;
  art?: "top" | "right" | "center";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden", paletteFor(seed + kind), className)}>
      <WaveLines className="absolute inset-0 h-full w-full" />
      <svg
        viewBox="0 0 200 160"
        aria-hidden
        className={cn(
          "pointer-events-none absolute select-none drop-shadow-[0_6px_10px_rgb(0_0_0/0.18)]",
          art === "top" && "inset-x-[8%] top-[8%] h-[56%] w-[84%]",
          art === "right" && "-right-2 bottom-0 h-[92%] w-[55%]",
          art === "center" && "inset-[10%] h-[80%] w-[80%]",
        )}
        fill="none"
      >
        <CoverIllustration kind={kind} />
      </svg>
      {children ? <div className="relative h-full">{children}</div> : null}
    </div>
  );
}
