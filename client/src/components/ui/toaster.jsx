import { CheckCircle2, XCircle, AlertTriangle, Info, Bell } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

const VARIANT_ICON = {
  default:     { Icon: Bell,           color: "text-primary"     },
  destructive: { Icon: XCircle,        color: "text-destructive" },
  success:     { Icon: CheckCircle2,   color: "text-emerald-500" },
  warning:     { Icon: AlertTriangle,  color: "text-amber-500"   },
  info:        { Icon: Info,           color: "text-blue-500"    },
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, variant = "default", ...props }) => {
        const { Icon, color } = VARIANT_ICON[variant] ?? VARIANT_ICON.default

        return (
          <Toast key={id} variant={variant} {...props}>
            {/* Colored icon matching the accent bar */}
            <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${color}`} />

            {/* Text */}
            <div className="flex-1 min-w-0">
              {title       && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
              {action}
            </div>

            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}