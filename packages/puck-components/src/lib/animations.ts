// ─── Animation Utility Maps ────────────────────────────────────────────────
// CSS keyframes are injected via the AnimationWrapper component.
// Components use these maps to apply Tailwind-compatible animation classes.

export const animationMap: Record<string, string> = {
  none: "",
  "fade-in": "puck-animate-fade-in",
  "fade-up": "puck-animate-fade-up",
  "fade-down": "puck-animate-fade-down",
  "fade-left": "puck-animate-fade-left",
  "fade-right": "puck-animate-fade-right",
  "zoom-in": "puck-animate-zoom-in",
  "zoom-out": "puck-animate-zoom-out",
  "slide-up": "puck-animate-slide-up",
  "slide-down": "puck-animate-slide-down",
  bounce: "puck-animate-bounce",
  pulse: "puck-animate-pulse",
  float: "puck-animate-float",
};

export const animationDurationMap: Record<string, string> = {
  fast: "puck-duration-300",
  normal: "puck-duration-500",
  slow: "puck-duration-700",
  "very-slow": "puck-duration-1000",
};

export const animationDelayMap: Record<string, string> = {
  none: "",
  short: "puck-delay-100",
  medium: "puck-delay-300",
  long: "puck-delay-500",
};

export const animationField = {
  type: "select" as const,
  label: "Animation",
  options: [
    { label: "None", value: "none" },
    { label: "Fade In", value: "fade-in" },
    { label: "Fade Up", value: "fade-up" },
    { label: "Fade Down", value: "fade-down" },
    { label: "Fade Left", value: "fade-left" },
    { label: "Fade Right", value: "fade-right" },
    { label: "Zoom In", value: "zoom-in" },
    { label: "Zoom Out", value: "zoom-out" },
    { label: "Slide Up", value: "slide-up" },
    { label: "Slide Down", value: "slide-down" },
    { label: "Bounce", value: "bounce" },
    { label: "Pulse", value: "pulse" },
    { label: "Float", value: "float" },
  ],
};

export const animationDurationField = {
  type: "select" as const,
  label: "Animation Speed",
  options: [
    { label: "Fast (0.3s)", value: "fast" },
    { label: "Normal (0.5s)", value: "normal" },
    { label: "Slow (0.7s)", value: "slow" },
    { label: "Very Slow (1s)", value: "very-slow" },
  ],
};

export const animationDelayField = {
  type: "select" as const,
  label: "Animation Delay",
  options: [
    { label: "None", value: "none" },
    { label: "Short (0.1s)", value: "short" },
    { label: "Medium (0.3s)", value: "medium" },
    { label: "Long (0.5s)", value: "long" },
  ],
};

// ─── CSS Keyframes (injected once globally) ─────────────────────────────────

export const animationStyles = `
@keyframes puck-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes puck-fade-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes puck-fade-down { from { opacity: 0; transform: translateY(-24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes puck-fade-left { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: translateX(0); } }
@keyframes puck-fade-right { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
@keyframes puck-zoom-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
@keyframes puck-zoom-out { from { opacity: 0; transform: scale(1.1); } to { opacity: 1; transform: scale(1); } }
@keyframes puck-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes puck-slide-down { from { transform: translateY(-100%); } to { transform: translateY(0); } }
@keyframes puck-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes puck-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
@keyframes puck-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }

.puck-animate-fade-in { animation-name: puck-fade-in; animation-fill-mode: both; }
.puck-animate-fade-up { animation-name: puck-fade-up; animation-fill-mode: both; }
.puck-animate-fade-down { animation-name: puck-fade-down; animation-fill-mode: both; }
.puck-animate-fade-left { animation-name: puck-fade-left; animation-fill-mode: both; }
.puck-animate-fade-right { animation-name: puck-fade-right; animation-fill-mode: both; }
.puck-animate-zoom-in { animation-name: puck-zoom-in; animation-fill-mode: both; }
.puck-animate-zoom-out { animation-name: puck-zoom-out; animation-fill-mode: both; }
.puck-animate-slide-up { animation-name: puck-slide-up; animation-fill-mode: both; }
.puck-animate-slide-down { animation-name: puck-slide-down; animation-fill-mode: both; }
.puck-animate-bounce { animation-name: puck-bounce; animation-iteration-count: infinite; }
.puck-animate-pulse { animation-name: puck-pulse; animation-iteration-count: infinite; }
.puck-animate-float { animation-name: puck-float; animation-iteration-count: infinite; animation-timing-function: ease-in-out; }

.puck-duration-300 { animation-duration: 0.3s; }
.puck-duration-500 { animation-duration: 0.5s; }
.puck-duration-700 { animation-duration: 0.7s; }
.puck-duration-1000 { animation-duration: 1s; }

.puck-delay-100 { animation-delay: 0.1s; }
.puck-delay-300 { animation-delay: 0.3s; }
.puck-delay-500 { animation-delay: 0.5s; }

@keyframes puck-highlight-color-cycle {
  0%, 100% { color: var(--h-c1, #3B82F6); }
  25%  { color: var(--h-c2, #8B5CF6); }
  50%  { color: var(--h-c3, #EC4899); }
  75%  { color: var(--h-c4, #F59E0B); }
}
.puck-highlight-color-cycle { animation: puck-highlight-color-cycle 5s ease-in-out infinite; }

@keyframes marquee-scroll {
  from { transform: translateX(0); }
  to   { transform: translateX(-33.333%); }
}
.marquee-container:hover .marquee-track { animation-play-state: paused; }

@media (prefers-reduced-motion: reduce) {
  [class*="puck-animate-"], .puck-highlight-color-cycle {
    animation: none !important;
  }
}
`;
