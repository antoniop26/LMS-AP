"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";
import { cn } from "@/lib/utils";
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
}: FilePickerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const generatedId = React.useId();
  const inputId = id ?? generatedId;

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

  // Keep native input in sync when parent clears value (e.g. after successful submit)
  React.useEffect(() => {
    if (!value && inputRef.current && inputRef.current.value) {
      inputRef.current.value = "";
    }
  }, [value]);

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        required={required && !value}
        disabled={disabled}
        className="sr-only"
        onChange={handleChange}
        tabIndex={-1}
        aria-hidden={false}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          aria-controls={inputId}
        >
          <FileIcon className="mr-2 h-4 w-4" />
          {buttonLabel}
        </Button>
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
    </div>
  );
}
