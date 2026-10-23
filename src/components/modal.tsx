"use client";

import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./ui";

/** Modal baseado em <dialog>. `trigger` recebe a função que abre o modal. */
export function Modal({
  title,
  trigger,
  children,
  wide,
}: {
  title: string;
  trigger: (open: () => void) => ReactNode;
  children: (close: () => void) => ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = () => ref.current?.showModal();
  const close = () => ref.current?.close();
  return (
    <>
      {trigger(open)}
      <dialog
        ref={ref}
        className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl border border-line bg-surface p-0 text-zinc-100`}
        onClick={(e) => e.target === ref.current && close()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <Button variant="ghost" size="sm" type="button" onClick={close} aria-label="Fechar">
            <X className="size-4" />
          </Button>
        </div>
        <div className="p-5">{children(close)}</div>
      </dialog>
    </>
  );
}
