import type { ComponentConfig } from "@puckeditor/core";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { useScrollAnimation } from "../../lib/use-animation";
import {
  animationField,
  animationDurationField,
  animationDelayField,
} from "../../lib/animations";

export interface BentoGridProps {
  layout: string;
  gap: string;
  cell1: ReactNode;
  cell2: ReactNode;
  cell3: ReactNode;
  cell4: ReactNode;
  cell5: ReactNode;
  cell6: ReactNode;
  animation: string;
  animationDuration: string;
  animationDelay: string;
}

// ─── Static layout configs (container grid class + per-cell responsive classes)
// CSS auto-placement fills items around explicitly-spanned cells correctly.
interface LayoutConfig {
  container: string;
  cells: string[];
}

const layoutConfigs: Record<string, LayoutConfig> = {
  "2x2": {
    container: "grid-cols-1 sm:grid-cols-2",
    cells: ["min-h-[150px]", "min-h-[150px]", "min-h-[150px]", "min-h-[150px]"],
  },
  "hero-left": {
    container: "grid-cols-1 sm:grid-cols-3",
    cells: [
      "min-h-[200px] sm:col-span-2 sm:row-span-2 sm:min-h-[300px]",
      "min-h-[150px]",
      "min-h-[150px]",
    ],
  },
  "hero-right": {
    container: "grid-cols-1 sm:grid-cols-3",
    cells: [
      "min-h-[150px]",
      "min-h-[200px] sm:col-span-2 sm:row-span-2 sm:min-h-[300px]",
      "min-h-[150px]",
    ],
  },
  "1-2": {
    container: "grid-cols-1 sm:grid-cols-3",
    cells: [
      "min-h-[200px]",
      "min-h-[200px] sm:col-span-2",
      "min-h-[150px] sm:col-span-3",
    ],
  },
  "2-1": {
    container: "grid-cols-1 sm:grid-cols-3",
    cells: [
      "min-h-[200px] sm:col-span-2",
      "min-h-[200px]",
      "min-h-[150px] sm:col-span-3",
    ],
  },
  featured: {
    container: "grid-cols-1 sm:grid-cols-4",
    cells: [
      "min-h-[200px] sm:col-span-2 sm:row-span-2 sm:min-h-[300px]",
      "min-h-[150px] sm:col-span-2",
      "min-h-[150px]",
      "min-h-[150px]",
      "min-h-[150px] sm:col-span-4",
    ],
  },
  mosaic: {
    container: "grid-cols-1 sm:grid-cols-3",
    cells: [
      "min-h-[150px] sm:col-span-2",
      "min-h-[150px]",
      "min-h-[150px]",
      "min-h-[150px] sm:col-span-2",
      "min-h-[150px] sm:col-span-2",
      "min-h-[150px]",
    ],
  },
};

const gapMap: Record<string, string> = {
  none: "gap-0",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
};

export const BentoGrid = ({
  layout = "2x2",
  gap = "md",
  cell1: Cell1,
  cell2: Cell2,
  cell3: Cell3,
  cell4: Cell4,
  cell5: Cell5,
  cell6: Cell6,
  animation = "none",
  animationDuration = "normal",
  animationDelay = "none",
}: BentoGridProps) => {
  const {
    ref: animRef,
    animationClassName,
    style: animStyle,
  } = useScrollAnimation(animation, animationDuration, animationDelay);

  const config = layoutConfigs[layout] ?? layoutConfigs["2x2"];

  const slots = [
    Cell1 as unknown as React.FC,
    Cell2 as unknown as React.FC,
    Cell3 as unknown as React.FC,
    Cell4 as unknown as React.FC,
    Cell5 as unknown as React.FC,
    Cell6 as unknown as React.FC,
  ];

  return (
    <div
      ref={animRef}
      className={cn(
        "grid w-full",
        config.container,
        gapMap[gap],
        animationClassName,
      )}
      style={animStyle}
    >
      {config.cells.map((cellClass, i) => {
        const Slot = slots[i];
        if (!Slot) return null;
        return (
          <div key={i} className={cellClass}>
            <Slot />
          </div>
        );
      })}
    </div>
  );
};

export const bentoGridConfig: ComponentConfig<BentoGridProps> = {
  label: "Bento Grid",
  fields: {
    cell1: { type: "slot" },
    cell2: { type: "slot" },
    cell3: { type: "slot" },
    cell4: { type: "slot" },
    cell5: { type: "slot" },
    cell6: { type: "slot" },
    layout: {
      type: "select",
      label: "Layout",
      options: [
        { label: "2×2 Equal", value: "2x2" },
        { label: "Hero Left", value: "hero-left" },
        { label: "Hero Right", value: "hero-right" },
        { label: "Narrow + Wide", value: "1-2" },
        { label: "Wide + Narrow", value: "2-1" },
        { label: "Featured (5 cells)", value: "featured" },
        { label: "Mosaic (6 cells)", value: "mosaic" },
      ],
    },
    gap: {
      type: "select",
      label: "Gap",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
      ],
    },
    animation: animationField,
    animationDuration: animationDurationField,
    animationDelay: animationDelayField,
  },
  defaultProps: {
    layout: "2x2",
    gap: "md",
    cell1: [],
    cell2: [],
    cell3: [],
    cell4: [],
    cell5: [],
    cell6: [],
    animation: "none",
    animationDuration: "normal",
    animationDelay: "none",
  },
  render: BentoGrid,
};
