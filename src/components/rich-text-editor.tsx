"use client";

import { useId, useRef, useState } from "react";
import { RichText } from "./rich-text";

const buttonClassName =
  "rounded border border-[#243775] px-2 py-1 text-xs font-semibold text-[#EEF2FF] hover:border-[#F5C542] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542] disabled:cursor-not-allowed disabled:opacity-40";

export function RichTextEditor({
  name,
  label,
  defaultValue = "",
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  const editorId = useId();
  const [value, setValue] = useState(defaultValue);
  const [previewing, setPreviewing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function wrapSelection(before: string, after = before) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || "text";
    const nextValue =
      value.slice(0, start) + before + selected + after + value.slice(end);
    setValue(nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selected.length,
      );
    });
  }

  function prefixLines(prefix: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const selectedEnd = value.indexOf("\n", end);
    const lineEnd = selectedEnd === -1 ? value.length : selectedEnd;
    const selected = value.slice(lineStart, lineEnd);
    const nextValue =
      value.slice(0, lineStart) +
      selected
        .split("\n")
        .map((line) => `${prefix}${line}`)
        .join("\n") +
      value.slice(lineEnd);
    setValue(nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart, lineStart + selected.length + prefix.length);
    });
  }

  return (
    <div>
      <label htmlFor={editorId} className="mb-2 block text-sm text-[#9FB0E6]">
        {label}
      </label>
      <div className="rounded-lg border border-[#243775] bg-[#070D24]">
        <div className="flex flex-wrap gap-2 border-b border-[#243775] p-2">
          <button type="button" className={buttonClassName} aria-label="Bold" disabled={previewing} onMouseDown={(event) => event.preventDefault()} onClick={() => wrapSelection("**")}>
            <strong>B</strong>
          </button>
          <button type="button" className={buttonClassName} aria-label="Italic" disabled={previewing} onMouseDown={(event) => event.preventDefault()} onClick={() => wrapSelection("*")}>
            <em>I</em>
          </button>
          <button type="button" className={buttonClassName} aria-label="Add link" disabled={previewing} onMouseDown={(event) => event.preventDefault()} onClick={() => wrapSelection("[", "](https://example.com)")}>
            Link
          </button>
          <button type="button" className={buttonClassName} aria-label="Bulleted list" disabled={previewing} onMouseDown={(event) => event.preventDefault()} onClick={() => prefixLines("- ")}>
            • List
          </button>
          <button type="button" className={buttonClassName} aria-label="Numbered list" disabled={previewing} onMouseDown={(event) => event.preventDefault()} onClick={() => prefixLines("1. ")}>
            1. List
          </button>
          <button type="button" className={buttonClassName} aria-label="Heading" disabled={previewing} onMouseDown={(event) => event.preventDefault()} onClick={() => prefixLines("## ")}>
            H
          </button>
          <div className="ml-auto flex gap-2" role="group" aria-label="Editor mode">
            <button
              type="button"
              className={buttonClassName}
              aria-pressed={!previewing}
              onClick={() => setPreviewing(false)}
            >
              Write
            </button>
            <button
              type="button"
              className={buttonClassName}
              aria-pressed={previewing}
              onClick={() => setPreviewing(true)}
            >
              Preview
            </button>
          </div>
        </div>
        {previewing ? (
          <>
            <input type="hidden" name={name} value={value} />
            <div className="min-h-32 p-3">
              {value ? (
                <RichText value={value} />
              ) : (
                <p className="text-sm text-[#9FB0E6]">Nothing to preview yet.</p>
              )}
            </div>
          </>
        ) : (
          <textarea
            ref={textareaRef}
            id={editorId}
            name={name}
            value={value}
            maxLength={5000}
            placeholder={placeholder}
            onChange={(event) => setValue(event.target.value)}
            className="min-h-32 w-full resize-y rounded-b-lg bg-transparent p-3 text-[#EEF2FF] placeholder:text-[#6676A7] focus-visible:outline-none"
          />
        )}
      </div>
      <p className="mt-1 text-xs text-[#6676A7]">
        Supports bold, italic, headings, lists, and links. Maximum 5,000 characters.
      </p>
    </div>
  );
}
