"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { StudioIcon } from "./StudioIcon";
import styles from "./Studio.module.css";
export function StudioDialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current?.close();
  }, [open]);
  return <dialog ref={ref} className={styles.dialog} aria-label={title} onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
    <header><h2>{title}</h2><button type="button" aria-label={`Close ${title}`} onClick={onClose}><StudioIcon name="close" /></button></header>
    <div className={styles.dialogBody}>{children}</div>
  </dialog>;
}
