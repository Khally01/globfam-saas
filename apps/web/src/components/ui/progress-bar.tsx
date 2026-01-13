"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ProgressBarProps {
  value: number
  max: number
  label?: string
  showPercentage?: boolean
  className?: string
  variant?: "auto" | "success" | "warning" | "error"
}

export function ProgressBar({
  value,
  max,
  label,
  showPercentage = true,
  className,
  variant = "auto",
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  // Automatic color based on percentage
  const getVariant = () => {
    if (variant !== "auto") return variant
    if (percentage < 70) return "success"
    if (percentage < 90) return "warning"
    return "error"
  }

  const colorVariant = getVariant()

  const colorClasses = {
    success: "bg-success",
    warning: "bg-warning",
    error: "bg-error",
  }

  const bgColorClasses = {
    success: "bg-success/10",
    warning: "bg-warning/10",
    error: "bg-error/10",
  }

  return (
    <div className={cn("w-full space-y-2", className)}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-sm">
          {label && <span className="font-medium">{label}</span>}
          {showPercentage && (
            <span className="text-muted-foreground">
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full",
          bgColorClasses[colorVariant]
        )}
      >
        <div
          className={cn(
            "h-full transition-all duration-300 ease-in-out",
            colorClasses[colorVariant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
