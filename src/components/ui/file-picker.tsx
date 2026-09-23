"use client";

import * as React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatBytes, cn } from "@/lib/utils";
import { FileIcon, X } from "lucide-react";

export type FilePickerProps = {
  id?: string;
  accept?: string;
  required?: boolean;
  disabled?: boolean;
  value?: File | null;
  onFileChange: (file: File | null) => void;
  className?: string;
  buttonLabel?: string;
  /** Set false to hide the local-only «Usar archivo de ejemplo» control. */
  allowDemoFile?: boolean;
};

export function FilePicker({
  id,
  accept,
  required,
  disabled,
  value,
  onFileChange,
  className,
  buttonLabel = "Seleccionar archivo",
  allowDemoFile,
}: FilePickerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const [dragging, setDragging] = React.useState(false);
  const [isLocalHost, setIsLocalHost] = React.useState(
    process.env.NODE_ENV === "development"
  );
  const showDemo = allowDemoFile !== false && isLocalHost;

  React.useEffect(() => {
    setIsLocalHost(
      process.env.NODE_ENV === "development" ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
    );
  }, []);

  function clear() {
    onFileChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0] ?? null;
    onFileChange(next);
    // Allow re-selecting the same file after clear / cancel
    if (!next && inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file) {
      onFileChange(file);
    }
  }

  function useDemoFile() {
    if (disabled) return;
    const file = new File(
      [`Entrega de prueba — ${new Date().toISOString()}\n`],
      "entrega-ejemplo.txt",
      { type: "text/plain" }
    );
    onFileChange(file);
  }

  // Keep native input in sync when parent clears value (e.g. after successful submit)
  React.useEffect(() => {
    if (!value && inputRef.current && inputRef.current.value) {
      inputRef.current.value = "";
    }
  }, [value]);

  return (
    <div className={cn("space-y-2", className)}>
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "rounded-md border-2 border-dashed p-4 transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-gray-300 bg-gray-50/50",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <p className="mb-3 text-sm text-gray-600">
          Arrastre un archivo aquí o…
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {/*
            Native <label> + opacity-0 input overlay (non-zero size).
            Avoids sr-only/clip + programmatic click, which many browsers block.
          */}
          <label
            htmlFor={inputId}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "relative cursor-pointer",
              disabled && "pointer-events-none opacity-50"
            )}
          >
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept={accept}
              required={required && !value}
              disabled={disabled}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              onChange={handleChange}
            />
            <FileIcon className="mr-2 h-4 w-4" aria-hidden />
            {buttonLabel}
          </label>
          {showDemo && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={useDemoFile}
            >
              Usar archivo de ejemplo
            </Button>
          )}
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={clear}
              aria-label="Quitar archivo"
            >
              <X className="mr-1 h-4 w-4" />
              Quitar
            </Button>
          )}
        </div>
      </div>
      <p className="truncate text-sm text-gray-600" aria-live="polite">
        {value ? (
          <>
            <span className="font-medium text-gray-900">{value.name}</span>
            <span className="text-gray-500"> · {formatBytes(value.size)}</span>
          </>
        ) : (
          "Ningún archivo seleccionado"
        )}
      </p>
      {showDemo && (
        <p className="text-xs text-gray-500">
          Si el explorador no abre (pantalla remota), arrastre el archivo o use
          el archivo de ejemplo.
        </p>
      )}
    </div>
  );
}
