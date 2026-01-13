"use client"

import * as React from "react"
import { Calendar } from "lucide-react"
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns"
import { Button } from "./button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./dialog"
import { cn } from "@/lib/utils"

export interface DateRange {
  from: Date
  to: Date
}

export interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  className?: string
}

const presets = [
  {
    label: "Today",
    getValue: () => ({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Last 7 days",
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Last 30 days",
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "This month",
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Last month",
    getValue: () => {
      const lastMonth = new Date()
      lastMonth.setMonth(lastMonth.getMonth() - 1)
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      }
    },
  },
]

export function DateRangePicker({
  value,
  onChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [customFrom, setCustomFrom] = React.useState(
    format(value.from, "yyyy-MM-dd")
  )
  const [customTo, setCustomTo] = React.useState(
    format(value.to, "yyyy-MM-dd")
  )

  const displayText = React.useMemo(() => {
    const fromStr = format(value.from, "MMM d, yyyy")
    const toStr = format(value.to, "MMM d, yyyy")
    return `${fromStr} - ${toStr}`
  }, [value])

  const handlePresetClick = (preset: typeof presets[0]) => {
    const newRange = preset.getValue()
    onChange(newRange)
    setOpen(false)
  }

  const handleCustomApply = () => {
    const from = startOfDay(new Date(customFrom))
    const to = endOfDay(new Date(customTo))
    if (from <= to) {
      onChange({ from, to })
      setOpen(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn(
          "justify-start text-left font-normal",
          className
        )}
      >
        <Calendar className="mr-2 h-4 w-4" />
        {displayText}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select Date Range</DialogTitle>
            <DialogDescription>
              Choose a preset or select a custom date range
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Presets */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Presets</label>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetClick(preset)}
                    className="justify-start"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Custom Range</label>
              <div className="grid gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">From</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">To</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <Button onClick={handleCustomApply} className="w-full">
                  Apply Custom Range
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
