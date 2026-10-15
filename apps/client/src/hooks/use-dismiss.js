import { useEffect } from "react";

// Closes a popup when the user clicks outside `ref` or presses Escape
export function useDismiss(ref, open, onClose) {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => !ref.current?.contains(e.target) && onClose();
    const onKeyDown = (e) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [ref, open, onClose]);
}
