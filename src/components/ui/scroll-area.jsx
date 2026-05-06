import * as React from "react"

import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("relative overflow-auto", className)}
    {...props}>
    {children}
  </div>
))

ScrollArea.displayName = "ScrollArea"

const ScrollBar = React.forwardRef(({ className, orientation = "vertical", ...props }, ref) => (
  <div
    ref={ref}
    aria-hidden="true"
    className={cn(
      "hidden",
      orientation === "vertical" ? "h-full w-2.5" : "h-2.5 w-full",
      className
    )}
    {...props}
  />
))

ScrollBar.displayName = "ScrollBar"

export { ScrollArea, ScrollBar }
