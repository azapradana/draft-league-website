"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type ImportResult = {
  error?: string;
  errors?: string[];
  preview?: {
    packCount: number;
    dropItemCount: number;
    megaFormCount: number;
  };
};

const MAX_FILE_SIZE = 2 * 1024 * 1024;

export function PackCsvImporter() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<{
    file: File;
    packCount: number;
    dropItemCount: number;
    megaFormCount: number;
  } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  function chooseFile(candidate: File | undefined) {
    setErrors([]);
    setPreview(null);
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setErrors(["Choose a file with the .csv extension."]);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setFile(null);
      setErrors(["CSV files must be 2 MB or smaller."]);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(candidate);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  }

  async function previewCsv() {
    setErrors([]);
    setPreview(null);
    if (!file) {
      setErrors(["Select a CSV file before previewing."]);
      return;
    }

    setPreviewing(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("mode", "preview");
      const response = await fetch("/api/admin/packs/import", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as ImportResult;
      if (!response.ok) {
        setErrors(result.errors?.length ? result.errors : [result.error ?? "The CSV could not be validated."]);
        return;
      }
      if (!result.preview) {
        setErrors(["The CSV validation response was incomplete. Please try again."]);
        return;
      }
      setPreview({ file, ...result.preview });
    } catch {
      setErrors(["The CSV could not be validated. Check your connection and try again."]);
    } finally {
      setPreviewing(false);
    }
  }

  async function importCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors([]);
    if (!file) {
      setErrors(["Select a CSV file before importing."]);
      return;
    }
    if (preview?.file !== file) {
      setErrors(["Preview and validate this CSV before importing it."]);
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("mode", "import");
      const response = await fetch("/api/admin/packs/import", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as ImportResult;
      if (!response.ok) {
        setErrors(result.errors?.length ? result.errors : [result.error ?? "The CSV could not be imported."]);
        return;
      }

      router.push("/admin/packs?imported=1");
    } catch {
      setErrors(["The CSV could not be uploaded. Check your connection and try again."]);
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-[#243775] bg-[#0C1638] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Import a pack from CSV</h2>
          <p className="mt-1 max-w-3xl text-sm text-[#9FB0E6]">
            Each row defines one global pack. Put all its Pokémon and Mega forms in the quoted pokemonList field as
            pokemonName:rarity:dropWeight entries, separated by commas or semicolons. Price is checked but configured
            later when the pack is attached to a tournament.
          </p>
        </div>
        <a
          href="/pack_import_template.csv"
          download="pack_import_template.csv"
          className="shrink-0 rounded-lg border border-[#243775] px-4 py-2 text-sm font-semibold text-[#EEF2FF] hover:border-[#F5C542]"
        >
          Download CSV template
        </a>
      </div>

      <form onSubmit={importCsv} className="mt-5">
        <label
          htmlFor="pack-csv-file"
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-5 py-7 text-center transition ${
            dragging ? "border-[#F5C542] bg-[#F5C542]/10" : "border-[#43558F] hover:border-[#F5C542]"
          }`}
        >
          <span className="font-semibold">{file ? file.name : "Drop a CSV file here or browse"}</span>
          <span className="mt-1 text-sm text-[#9FB0E6]">.csv files up to 2 MB</span>
          <input
            ref={inputRef}
            id="pack-csv-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => chooseFile(event.currentTarget.files?.[0])}
            className="sr-only"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!file || !preview || preview.file !== file || importing}
            className="rounded-lg bg-[#F5C542] px-5 py-2.5 font-bold text-[#070D24] hover:bg-[#D9A21B] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importing ? "Importing…" : "Import packs"}
          </button>
          <button
            type="button"
            onClick={previewCsv}
            disabled={!file || previewing || importing}
            className="rounded-lg border border-[#43558F] px-5 py-2.5 font-semibold text-[#EEF2FF] hover:border-[#F5C542] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {previewing ? "Validating…" : "Preview import"}
          </button>
          {file && (
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setPreview(null);
                setErrors([]);
                if (inputRef.current) inputRef.current.value = "";
              }}
              disabled={previewing || importing}
              className="rounded-lg border border-[#243775] px-4 py-2.5 text-sm text-[#EEF2FF] hover:border-[#F5C542]"
            >
              Clear file
            </button>
          )}
        </div>
      </form>

      {preview?.file === file && (
        <div role="status" className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-4 text-sm text-emerald-100">
          <p className="font-semibold">CSV validated. Nothing has been saved yet.</p>
          <p className="mt-1">
            {preview.packCount} {preview.packCount === 1 ? "pack" : "packs"} · {preview.dropItemCount} total Pokémon drops ·{" "}
            {preview.megaFormCount} Mega {preview.megaFormCount === 1 ? "form" : "forms"}
          </p>
        </div>
      )}

      {errors.length > 0 && (
        <div role="alert" className="mt-4 rounded-lg border border-red-500/50 bg-red-950/40 p-4 text-sm text-red-200">
          <p className="font-semibold">The CSV was not imported. Fix these issues and try again:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
