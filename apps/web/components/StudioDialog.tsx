"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { StudioIcon } from "./StudioIcon";
import styles from "./Studio.module.css";
export function StudioDialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const restoreFocus = () => {
    const trigger = returnFocus.current;
    returnFocus.current = null;
    if (trigger) window.requestAnimationFrame(() => trigger.focus());
  };
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current =
        window.document.activeElement instanceof HTMLElement
          ? window.document.activeElement
          : null;
      dialog.showModal();
      window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={titleId} onClose={() => { onClose(); restoreFocus(); }} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
    <header><h2 id={titleId}>{title}</h2><button ref={closeButtonRef} type="button" aria-label={`Close ${title}`} onClick={() => ref.current?.close()}><StudioIcon name="close" /></button></header>
    <div className={styles.dialogBody}>{children}</div>
  </dialog>;
}
