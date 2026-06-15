"use client";

import type { CSSProperties, ChangeEvent } from "react";
import { cn } from "@/lib/utils";

type ThinSliderProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  className?: string;
  "aria-label": string;
};

export function ThinSlider({
  value,
  min,
  max,
  step = 1,
  onValueChange,
  className,
  "aria-label": ariaLabel,
}: ThinSliderProps) {
  const progress = max > min ? ((value - min) / (max - min)) * 100 : 0;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onValueChange(Number(event.target.value));
  };

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={handleChange}
      aria-label={ariaLabel}
      className={cn("thin-slider h-4 w-full cursor-pointer appearance-none rounded-full", className)}
      style={{ "--slider-progress": `${Math.min(Math.max(progress, 0), 100)}%` } as CSSProperties}
    />
  );
}
