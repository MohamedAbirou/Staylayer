"use client";

import { motion, useReducedMotion } from "framer-motion";
import { clsx } from "clsx";
import type { CSSProperties, PropsWithChildren } from "react";

export function Reveal({
  children,
  className,
  style,
  delay = 0,
}: PropsWithChildren<{
  className?: string;
  style?: CSSProperties;
  delay?: number;
}>) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={clsx(className)}
      style={style}
    >
      {children}
    </motion.div>
  );
}
