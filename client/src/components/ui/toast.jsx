import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva } from "class-variance-authority"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-full max-w-[380px] outline-none",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  [
    // base layout
    "group relative flex items-start gap-3 w-full overflow-hidden",
    "rounded-xl border p-4 pr-9",
    "shadow-lg shadow-black/20",
    // left accent bar via pseudo-element
    "before:absolute before:left-0 before:top-3 before:bottom-3",
    "before:w-[3px] before:rounded-full before:content-['']",
    // swipe + animation
    "transition-all duration-300",
    "data-[swipe=cancel]:translate-x-0",
    "data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
    "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full",
    "data-[state=open]:slide-in-from-bottom-4 data-[state=open]:fade-in-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default:     "bg-card border-border/60     text-foreground before:bg-primary",
        destructive: "bg-card border-destructive/25 text-foreground before:bg-destructive",
        success:     "bg-card border-emerald-500/25 text-foreground before:bg-emerald-500",
        warning:     "bg-card border-amber-500/25   text-foreground before:bg-amber-500",
        info:        "bg-card border-blue-500/25    text-foreground before:bg-blue-500",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

const Toast = React.forwardRef(({ className, variant, ...props }, ref) => (
  <ToastPrimitives.Root
    ref={ref}
    className={cn(toastVariants({ variant }), className)}
    {...props}
  />
))
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "mt-1 inline-flex shrink-0 items-center justify-center rounded-lg",
      "border border-border/50 bg-transparent px-3 py-1.5",
      "text-xs font-medium text-foreground",
      "transition-colors hover:bg-secondary",
      "focus:outline-none focus:ring-1 focus:ring-ring",
      "disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-3 top-3 rounded-md p-0.5",
      "text-muted-foreground/50 hover:text-foreground",
      "opacity-0 group-hover:opacity-100 transition-all",
      "focus:outline-none focus:ring-1 focus:ring-ring",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold text-foreground leading-snug", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-xs text-muted-foreground leading-relaxed mt-0.5", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastClose,
}