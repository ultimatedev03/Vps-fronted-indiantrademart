
import React from "react"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  detectInputKind,
  detectInputKindFromElement,
  maxLengthByKind,
  sanitizeInputByKind,
} from "@/shared/utils/inputSanitizer"

const Input = React.forwardRef(
  (
    {
      className,
      type,
      onChange,
      onInput,
      onWheel,
      disableAutoSanitize = false,
      disablePasswordToggle = false,
      maxLength,
      ...props
    },
    ref
  ) => {
    const localRef = React.useRef(null)

    const setInputRef = React.useCallback(
      (node) => {
        localRef.current = node
        if (typeof ref === "function") {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      },
      [ref]
    )

    const inputKind = React.useMemo(
      () =>
        detectInputKind({
          type,
          name: props.name,
          id: props.id,
          autoComplete: props.autoComplete,
          placeholder: props.placeholder,
          inputMode: props.inputMode,
        }),
      [type, props.name, props.id, props.autoComplete, props.placeholder, props.inputMode]
    )

    const applySanitize = React.useCallback(
      (event) => {
        if (disableAutoSanitize) return
        if (!event?.target) return

        const currentValue = event.target.value
        if (typeof currentValue !== "string") return

        const resolvedKind =
          inputKind && inputKind !== "none"
            ? inputKind
            : detectInputKindFromElement(event.target)

        const nextValue = sanitizeInputByKind(resolvedKind, currentValue)
        if (nextValue !== currentValue) {
          event.target.value = nextValue
        }
      },
      [disableAutoSanitize, inputKind]
    )

    const handleChange = React.useCallback(
      (event) => {
        applySanitize(event)
        onChange?.(event)
      },
      [applySanitize, onChange]
    )

    const handleInput = React.useCallback(
      (event) => {
        applySanitize(event)
        onInput?.(event)
      },
      [applySanitize, onInput]
    )

    React.useEffect(() => {
      if (type !== "number") return undefined
      const node = localRef.current
      if (!node) return undefined

      const preventWheelNumberChange = (event) => {
        if (document.activeElement === node) {
          event.preventDefault()
          node.blur()
        }
      }

      node.addEventListener("wheel", preventWheelNumberChange, { passive: false })
      return () => {
        node.removeEventListener("wheel", preventWheelNumberChange)
      }
    }, [type])

    const handleWheel = React.useCallback(
      (event) => {
        if (type === "number" && document.activeElement === event.currentTarget) {
          event.preventDefault()
          event.currentTarget.blur()
        }
        onWheel?.(event)
      },
      [onWheel, type]
    )

    const resolvedMaxLength =
      maxLength ?? (!disableAutoSanitize ? maxLengthByKind[inputKind] : undefined)

    const hasManualPasswordToggle =
      typeof className === "string" && /\bpr-(9|10|11|12|14|16)\b/.test(className)
    const shouldRenderPasswordToggle =
      type === "password" && !disablePasswordToggle && !hasManualPasswordToggle
    const [showPassword, setShowPassword] = React.useState(false)
    const resolvedType = shouldRenderPasswordToggle && showPassword ? "text" : type

    const inputElement = (
      <input
        type={resolvedType}
        data-disable-auto-sanitize={disableAutoSanitize ? "true" : undefined}
        data-sanitize-kind={inputKind && inputKind !== "none" ? inputKind : undefined}
        className={cn(
          "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
          shouldRenderPasswordToggle && "pr-12"
        )}
        ref={setInputRef}
        maxLength={resolvedMaxLength}
        onChange={handleChange}
        onInput={handleInput}
        onWheel={handleWheel}
        {...props}
      />
    )

    if (!shouldRenderPasswordToggle) return inputElement

    return (
      <div className="relative w-full">
        {inputElement}
        <button
          type="button"
          tabIndex={-1}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          disabled={props.disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setShowPassword((value) => !value)}
          title={showPassword ? "Hide password" : "Show password"}
          className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 touch-manipulation place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted disabled:pointer-events-none disabled:opacity-50"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
