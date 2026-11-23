/**
 * Original vector artwork for Memskool (UI uplift). Pure SVG: crisp at any size, a few KB,
 * and it loads instantly on a slow connection — no image downloads.
 */
import { cn } from "@/lib/utils";

/** Layered foliage, used at the foot of the sidebar and on promo cards. */
export function LeafCluster({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 200"
      aria-hidden
      className={cn("pointer-events-none select-none", className)}
      fill="none"
    >
      <path
        d="M40 200C36 150 52 104 96 70c-6 42-22 94-56 130Z"
        fill="oklch(0.62 0.1 228)"
        opacity="0.55"
      />
      <path
        d="M70 200c6-56 34-98 86-120-14 40-42 92-86 120Z"
        fill="oklch(0.55 0.1 155)"
        opacity="0.7"
      />
      <path
        d="M120 200c-2-46 18-84 64-108-6 38-28 82-64 108Z"
        fill="oklch(0.7 0.13 88)"
        opacity="0.75"
      />
      <path
        d="M150 200c10-40 40-70 84-80-18 30-46 64-84 80Z"
        fill="oklch(0.62 0.1 228)"
        opacity="0.45"
      />
      <path
        d="M0 200c8-60 40-100 88-118C70 120 40 168 0 200Z"
        fill="oklch(0.55 0.1 155)"
        opacity="0.45"
      />
      <path d="M96 70c-22 40-40 86-56 130" stroke="white" strokeOpacity="0.35" strokeWidth="1.5" />
      <path d="M156 80c-34 34-62 76-86 120" stroke="white" strokeOpacity="0.35" strokeWidth="1.5" />
      <path d="M184 92c-28 30-48 66-64 108" stroke="white" strokeOpacity="0.35" strokeWidth="1.5" />
      <circle cx="196" cy="54" r="6" fill="oklch(0.7 0.13 88)" opacity="0.8" />
      <circle cx="214" cy="34" r="3" fill="white" opacity="0.6" />
      <circle cx="60" cy="40" r="4" fill="white" opacity="0.35" />
    </svg>
  );
}

/** Flowing contour lines for dark cards (welcome banner, promo tiles). */
export function WaveLines({ className }: { className?: string }) {
  const lines = Array.from({ length: 14 }, (_, i) => i);
  return (
    <svg
      viewBox="0 0 400 200"
      preserveAspectRatio="none"
      aria-hidden
      className={cn("pointer-events-none select-none", className)}
      fill="none"
    >
      {lines.map((i) => (
        <path
          key={i}
          d={`M-20 ${150 - i * 9} C 80 ${90 - i * 6}, 160 ${210 - i * 8}, 260 ${120 - i * 7} S 420 ${30 + i * 12}, 440 ${10 + i * 15}`}
          stroke="white"
          strokeOpacity={0.05 + (i % 4) * 0.025}
          strokeWidth="1.2"
        />
      ))}
    </svg>
  );
}

/** A friendly school scene: board, books, globe, cap and a plant. */
export function SchoolScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 220"
      aria-hidden
      className={cn("pointer-events-none select-none", className)}
      fill="none"
    >
      {/* floor shadow */}
      <ellipse cx="170" cy="204" rx="140" ry="10" fill="black" opacity="0.12" />
      {/* chalkboard */}
      <rect x="92" y="28" width="172" height="112" rx="12" fill="oklch(0.3 0.05 160)" />
      <rect
        x="92"
        y="28"
        width="172"
        height="112"
        rx="12"
        stroke="oklch(0.7 0.13 88)"
        strokeWidth="6"
      />
      <path
        d="M112 62h60M112 80h96M112 98h44"
        stroke="white"
        strokeOpacity="0.7"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M200 112l14-22 14 14 14-30"
        stroke="oklch(0.7 0.13 88)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M150 140v46M206 140v46"
        stroke="oklch(0.7 0.13 88)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* book stack */}
      <rect x="24" y="168" width="96" height="18" rx="4" fill="oklch(0.62 0.1 228)" />
      <rect x="32" y="150" width="84" height="18" rx="4" fill="oklch(0.7 0.13 88)" />
      <rect x="20" y="132" width="90" height="18" rx="4" fill="oklch(0.55 0.1 155)" />
      <path
        d="M30 141h70M40 159h66M34 177h76"
        stroke="white"
        strokeOpacity="0.55"
        strokeWidth="2"
      />
      {/* graduation cap on books */}
      <path d="M38 118l30-14 30 14-30 14-30-14Z" fill="oklch(0.22 0.05 262)" />
      <path d="M50 124v10c0 6 36 6 36 0v-10" fill="oklch(0.22 0.05 262)" />
      <path d="M98 118v14" stroke="oklch(0.7 0.13 88)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="98" cy="134" r="3.5" fill="oklch(0.7 0.13 88)" />
      {/* globe */}
      <circle cx="274" cy="160" r="26" fill="oklch(0.62 0.1 228)" />
      <path
        d="M256 150c8 2 10 10 18 8s8-12 16-10M252 168c10-2 14 6 22 4s10-8 22-6"
        stroke="oklch(0.55 0.1 155)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M274 186v12M260 200h28"
        stroke="oklch(0.22 0.05 262)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* plant */}
      <path d="M296 70c-14 10-16 30-4 40 10-10 12-30 4-40Z" fill="oklch(0.55 0.1 155)" />
      <path d="M296 110c12-6 22-2 24 8-10 6-20 2-24-8Z" fill="oklch(0.55 0.1 155)" opacity="0.8" />
      <rect x="284" y="112" width="24" height="20" rx="4" fill="oklch(0.7 0.13 88)" />
      {/* pencil */}
      <path d="M40 92l50-50 10 10-50 50-14 4 4-14Z" fill="oklch(0.7 0.13 88)" />
      <path d="M90 42l6-6 10 10-6 6" fill="oklch(0.63 0.21 25)" />
      <path d="M44 102l-4 4 4-14" fill="oklch(0.22 0.05 262)" />
      {/* sparks of colour */}
      <circle cx="78" cy="22" r="5" fill="oklch(0.62 0.1 228)" opacity="0.7" />
      <circle cx="292" cy="30" r="4" fill="oklch(0.7 0.13 88)" />
      <circle cx="16" cy="70" r="3" fill="oklch(0.55 0.1 155)" />
    </svg>
  );
}

/** Small empty-state illustration: an open book with a sprout. */
export function EmptyArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 90"
      aria-hidden
      className={cn("pointer-events-none", className)}
      fill="none"
    >
      <ellipse cx="60" cy="82" rx="44" ry="5" fill="currentColor" opacity="0.08" />
      <path
        d="M14 30c16-6 32-6 46 4v44c-14-10-30-10-46-4V30Z"
        fill="oklch(0.62 0.1 228)"
        opacity="0.25"
      />
      <path
        d="M106 30c-16-6-32-6-46 4v44c14-10 30-10 46-4V30Z"
        fill="oklch(0.7 0.13 88)"
        opacity="0.3"
      />
      <path d="M60 34v44" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M60 34c0-12 4-20 12-24-2 10-6 18-12 24Z" fill="oklch(0.55 0.1 155)" />
      <path d="M60 30c-2-10-8-16-16-16 2 8 8 14 16 16Z" fill="oklch(0.55 0.1 155)" opacity="0.7" />
    </svg>
  );
}
