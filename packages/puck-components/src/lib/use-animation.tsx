import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "./cn";
import {
  animationMap,
  animationDurationMap,
  animationDelayMap,
} from "./animations";

// ─── Intersection Observer Animation Hook ──────────────────────────────────
// Triggers animation when element scrolls into view.

export function useScrollAnimation(
  animation: string = "none",
  duration: string = "normal",
  delay: string = "none",
) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (animation === "none") {
      setIsVisible(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [animation]);

  // Looping animations (bounce, pulse, float) don't need intersection logic
  const isLooping = ["bounce", "pulse", "float"].includes(animation);

  const animationClassName =
    isVisible || isLooping
      ? cn(
          animationMap[animation],
          animationDurationMap[duration],
          animationDelayMap[delay],
        )
      : "";

  const style: CSSProperties =
    !isVisible && !isLooping && animation !== "none" ? { opacity: 0 } : {};

  return { ref, animationClassName, style };
}

// ─── Animation Wrapper Component ────────────────────────────────────────────
// Wraps any content and applies scroll-triggered animation.

interface AnimationWrapperProps {
  animation?: string;
  duration?: string;
  delay?: string;
  className?: string;
  children: React.ReactNode;
}

export function AnimationWrapper({
  animation = "none",
  duration = "normal",
  delay = "none",
  className,
  children,
}: AnimationWrapperProps) {
  const { ref, animationClassName, style } = useScrollAnimation(
    animation,
    duration,
    delay,
  );

  if (animation === "none") {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={ref} className={cn(className, animationClassName)} style={style}>
      {children}
    </div>
  );
}
