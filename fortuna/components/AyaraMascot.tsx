import type { CSSProperties } from "react";

export type AyaraMascotVariant =
  | "idle"
  | "happy"
  | "ticket"
  | "guide"
  | "claimed"
  | "icon";

type AyaraMascotProps = {
  variant: AyaraMascotVariant;
  size?: number | string;
  className?: string;
  ariaLabel?: string;
};

const SPRITE_POSITIONS: Record<AyaraMascotVariant, string> = {
  idle: "0% 0%",
  happy: "50% 0%",
  ticket: "100% 0%",
  guide: "0% 100%",
  claimed: "50% 100%",
  icon: "100% 100%",
};

export function AyaraMascot({
  variant,
  size,
  className,
  ariaLabel,
}: AyaraMascotProps) {
  const style = {
    "--ayara-mascot-position": SPRITE_POSITIONS[variant],
    ...(size === undefined
      ? {}
      : {
          "--ayara-mascot-size":
            typeof size === "number" ? `${size}px` : size,
        }),
  } as CSSProperties;

  return (
    <span
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      className={["ayara-mascot", `ayara-mascot--${variant}`, className]
        .filter(Boolean)
        .join(" ")}
      role={ariaLabel ? "img" : undefined}
      style={style}
    />
  );
}
