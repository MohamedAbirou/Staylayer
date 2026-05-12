import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

const buttonStyles = cva(
  "inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sl-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
  {
    variants: {
      tone: {
        primary:
          "bg-[var(--sl-orange)] text-white shadow-[0_8px_28px_rgba(224,112,56,0.38),0_2px_8px_rgba(224,112,56,0.18)] hover:-translate-y-0.5 hover:bg-[#cc6430] hover:shadow-[0_12px_36px_rgba(224,112,56,0.48)]",
        secondary:
          "border border-[rgba(26,72,112,0.14)] bg-white/82 text-[var(--sl-navy)] hover:-translate-y-0.5 hover:bg-white hover:border-[rgba(224,112,56,0.3)] hover:shadow-[0_6px_20px_rgba(224,112,56,0.1)]",
        ghost:
          "text-[var(--sl-navy)] hover:bg-[rgba(26,72,112,0.07)] hover:text-[var(--sl-orange)]",
        amber:
          "bg-[var(--sl-gold)] text-[var(--sl-navy-deep)] shadow-[0_8px_28px_rgba(240,176,48,0.38)] hover:-translate-y-0.5 hover:bg-[#d9a028]",
        navy: "bg-[var(--sl-navy)] text-white shadow-[0_8px_28px_rgba(26,72,112,0.32)] hover:-translate-y-0.5 hover:bg-[var(--sl-navy-deep)]",
        teal: "bg-[var(--sl-teal)] text-white shadow-[0_8px_28px_rgba(58,152,152,0.32)] hover:-translate-y-0.5 hover:bg-[#2e8080]",
      },
    },
    defaultVariants: {
      tone: "primary",
    },
  },
);

type ButtonToneProps = VariantProps<typeof buttonStyles>;

export function OrbitLink({
  href,
  tone,
  className,
  children,
}: PropsWithChildren<{ href: string; className?: string } & ButtonToneProps>) {
  return (
    <Link href={href} className={clsx(buttonStyles({ tone }), className)}>
      {children}
    </Link>
  );
}

export function OrbitButton({
  tone,
  className,
  children,
  ...props
}: PropsWithChildren<
  ButtonToneProps & ButtonHTMLAttributes<HTMLButtonElement>
>) {
  return (
    <button {...props} className={clsx(buttonStyles({ tone }), className)}>
      {children}
    </button>
  );
}
