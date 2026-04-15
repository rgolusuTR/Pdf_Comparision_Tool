"use client";

import { useMemo, useState } from "react";
import { diffWords } from "diff";
import pixelmatch from "pixelmatch";

const SCALE = 1.8;
const PIXEL_THRESHOLD = 0.12;
const DIFF_COLOR = [234, 88, 12];
const TEXT_DIFF_PREVIEW_LIMIT = 24;
const MAX_TEXT_RENDER_LENGTH = 8000;

let pdfLibraryPromise;

async function getPdfLibrary() {
  if (!pdfLibraryPromise) {
    pdfLibraryPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((module) => {
      if (typeof window !== "undefined" && typeof Worker !== "undefined" && !module.GlobalWorkerOptions.workerPort) {
        module.GlobalWorkerOptions.workerPort = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), {
          type: "module",
        });
      }
      return module;
    });
  }
  return pdfLibraryPromise;
}

function isPdfFile(file) {
  if (!file) return false;
  const mimeLooksValid = file.type === "application/pdf";
  const extensionLooksValid = file.name.toLowerCase().endsWith(".pdf");
  return mimeLooksValid || extensionLooksValid;
}

async function validatePdfSignature(file) {
  const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const expected = [37, 80, 68, 70, 45];
  return expected.every((byte, index) => signature[index] === byte);
}

async function loadPdf(file) {
  const pdfLibrary = await getPdfLibrary();
  const arrayBuffer = await file.arrayBuffer();
  const typedData = new Uint8Array(arrayBuffer);
  return pdfLibrary.getDocument({ data: typedData }).promise;
}

async function renderPageToCanvas(page, scale = SCALE) {
  const viewport = page.getViewport({ scale });
  const sourceCanvas = document.createElement("canvas");
  const sourceContext = sourceCanvas.getContext("2d");

  sourceCanvas.width = Math.ceil(viewport.width);
  sourceCanvas.height = Math.ceil(viewport.height);

  await page.render({ canvasContext: sourceContext, viewport }).promise;

  // Convert transparent regions to white to keep text readable.
  const normalizedCanvas = document.createElement("canvas");
  const normalizedContext = normalizedCanvas.getContext("2d");
  normalizedCanvas.width = sourceCanvas.width;
  normalizedCanvas.height = sourceCanvas.height;
  normalizedContext.fillStyle = "white";
  normalizedContext.fillRect(0, 0, normalizedCanvas.width, normalizedCanvas.height);
  normalizedContext.drawImage(sourceCanvas, 0, 0);

  return normalizedCanvas;
}

async function extractPageText(page) {
  const textContent = await page.getTextContent();
  return textContent.items
    .map((item) => ("str" in item ? item.str : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function toPreviewSnippet(text, max = 180) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}...`;
}

function buildTextDiffSummary(baseText, targetText) {
  const isTextEqual = baseText === targetText;
  const parts = diffWords(baseText, targetText);
  const changedParts = parts
    .filter((part) => (part.added || part.removed) && part.value.trim().length > 0)
    .slice(0, TEXT_DIFF_PREVIEW_LIMIT)
    .map((part) => ({
      type: part.added ? "added" : "removed",
      value: toPreviewSnippet(part.value),
    }));

  return {
    isTextEqual,
    changes: changedParts,
    basePreview: toPreviewSnippet(baseText, MAX_TEXT_RENDER_LENGTH),
    targetPreview: toPreviewSnippet(targetText, MAX_TEXT_RENDER_LENGTH),
  };
}

function normalizeCanvas(sourceCanvas, width, height) {
  const normalized = document.createElement("canvas");
  const context = normalized.getContext("2d");
  normalized.width = width;
  normalized.height = height;
  context.fillStyle = "white";
  context.fillRect(0, 0, width, height);
  context.drawImage(sourceCanvas, 0, 0, width, height);
  return normalized;
}

async function compareCanvases(leftCanvas, rightCanvas) {
  const width = Math.max(leftCanvas.width, rightCanvas.width);
  const height = Math.max(leftCanvas.height, rightCanvas.height);

  const normalizedLeft = normalizeCanvas(leftCanvas, width, height);
  const normalizedRight = normalizeCanvas(rightCanvas, width, height);
  const diffCanvas = document.createElement("canvas");
  const diffContext = diffCanvas.getContext("2d");
  diffCanvas.width = width;
  diffCanvas.height = height;
  diffContext.fillStyle = "white";
  diffContext.fillRect(0, 0, width, height);

  const leftData = normalizedLeft.getContext("2d").getImageData(0, 0, width, height);
  const rightData = normalizedRight.getContext("2d").getImageData(0, 0, width, height);
  const diffData = diffContext.getImageData(0, 0, width, height);

  const mismatchPixels = pixelmatch(leftData.data, rightData.data, diffData.data, width, height, {
    threshold: PIXEL_THRESHOLD,
    diffColor: DIFF_COLOR,
    includeAA: true,
    alpha: 0.2,
  });

  diffContext.putImageData(diffData, 0, 0);
  const mismatchPercentage = (mismatchPixels / (width * height)) * 100;

  return {
    width,
    height,
    mismatchPixels,
    mismatchPercentage: Number(mismatchPercentage.toFixed(4)),
    basePreview: normalizedLeft.toDataURL("image/png"),
    targetPreview: normalizedRight.toDataURL("image/png"),
    diffPreview: diffCanvas.toDataURL("image/png"),
  };
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

const initialState = {
  comparing: false,
  status: "Ready to compare files.",
  error: "",
  result: null,
};

export default function PdfCompareClient() {
  const [baseFile, setBaseFile] = useState(null);
  const [targetFile, setTargetFile] = useState(null);
  const [state, setState] = useState(initialState);

  const canRun = useMemo(() => Boolean(baseFile && targetFile) && !state.comparing, [baseFile, targetFile, state.comparing]);

  const resetAll = () => {
    setBaseFile(null);
    setTargetFile(null);
    setState(initialState);
  };

  const compareFiles = async () => {
    if (!baseFile || !targetFile) {
      setState((previous) => ({ ...previous, error: "Please upload both PDF files." }));
      return;
    }

    if (!isPdfFile(baseFile) || !isPdfFile(targetFile)) {
      setState((previous) => ({ ...previous, error: "Only PDF files are allowed." }));
      return;
    }

    setState({
      comparing: true,
      status: "Validating files...",
      error: "",
      result: null,
    });

    try {
      const [baseValidSignature, targetValidSignature] = await Promise.all([
        validatePdfSignature(baseFile),
        validatePdfSignature(targetFile),
      ]);

      if (!baseValidSignature || !targetValidSignature) {
        throw new Error("One or both files are not valid PDF binaries.");
      }

      setState((previous) => ({ ...previous, status: "Loading PDF documents..." }));
      const [basePdf, targetPdf] = await Promise.all([loadPdf(baseFile), loadPdf(targetFile)]);
      const totalPages = Math.max(basePdf.numPages, targetPdf.numPages);
      let changedPages = 0;
      let comparedPages = 0;
      const textByPage = new Map();
      const visualByPage = new Map();

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        setState((previous) => ({
          ...previous,
          status: `Phase 1/2: extracting and comparing text for page ${pageNumber} of ${totalPages}...`,
        }));

        const isMissingPage = pageNumber > basePdf.numPages || pageNumber > targetPdf.numPages;
        if (isMissingPage) {
          textByPage.set(pageNumber, {
            pageNumber,
            missingPage: true,
            textEqual: false,
            textDiffs: [],
            baseTextPreview: "",
            targetTextPreview: "",
          });
          continue;
        }

        const [basePage, targetPage] = await Promise.all([basePdf.getPage(pageNumber), targetPdf.getPage(pageNumber)]);
        const [baseText, targetText] = await Promise.all([extractPageText(basePage), extractPageText(targetPage)]);
        const textDiff = buildTextDiffSummary(baseText, targetText);

        textByPage.set(pageNumber, {
          pageNumber,
          missingPage: false,
          textEqual: textDiff.isTextEqual,
          textDiffs: textDiff.changes,
          baseTextPreview: textDiff.basePreview,
          targetTextPreview: textDiff.targetPreview,
        });
      }

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        setState((previous) => ({
          ...previous,
          status: `Phase 2/2: running visual comparison for page ${pageNumber} of ${totalPages}...`,
        }));

        const isMissingPage = pageNumber > basePdf.numPages || pageNumber > targetPdf.numPages;
        if (isMissingPage) {
          visualByPage.set(pageNumber, {
            pageNumber,
            missingPage: true,
            mismatchPixels: 0,
            mismatchPercentage: 0,
            visualDiffRatio: 0,
            width: 0,
            height: 0,
            basePreview: "",
            targetPreview: "",
            diffPreview: "",
          });
          continue;
        }

        const [basePage, targetPage] = await Promise.all([basePdf.getPage(pageNumber), targetPdf.getPage(pageNumber)]);
        const [baseCanvas, targetCanvas] = await Promise.all([renderPageToCanvas(basePage), renderPageToCanvas(targetPage)]);
        const comparison = await compareCanvases(baseCanvas, targetCanvas);
        const visualDiffRatio = comparison.width && comparison.height
          ? comparison.mismatchPixels / (comparison.width * comparison.height)
          : 0;

        visualByPage.set(pageNumber, {
          pageNumber,
          missingPage: false,
          mismatchPixels: comparison.mismatchPixels,
          mismatchPercentage: comparison.mismatchPercentage,
          visualDiffRatio: Number((visualDiffRatio * 100).toFixed(4)),
          width: comparison.width,
          height: comparison.height,
          basePreview: comparison.basePreview,
          targetPreview: comparison.targetPreview,
          diffPreview: comparison.diffPreview,
        });
      }

      const pageDiffs = [];
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        const textComparison = textByPage.get(pageNumber);
        const visualComparison = visualByPage.get(pageNumber);
        const isMissingPage = pageNumber > basePdf.numPages || pageNumber > targetPdf.numPages;
        const textChanged = textComparison ? !textComparison.textEqual : false;
        const visualChanged = visualComparison ? visualComparison.mismatchPixels > 0 : false;
        const changed = isMissingPage || textChanged || visualChanged;

        comparedPages += 1;
        if (changed) {
          changedPages += 1;
        }

        pageDiffs.push({
          pageNumber,
          status: isMissingPage ? "missing-page" : changed ? "changed" : "identical",
          message: isMissingPage ? "This page exists in only one PDF." : "",
          textChanged,
          visualChanged,
          mismatchPixels: visualComparison ? visualComparison.mismatchPixels : 0,
          mismatchPercentage: visualComparison ? visualComparison.mismatchPercentage : 0,
          basePreview: visualComparison ? visualComparison.basePreview : "",
          targetPreview: visualComparison ? visualComparison.targetPreview : "",
          diffPreview: visualComparison ? visualComparison.diffPreview : "",
          visualDiffRatio: visualComparison ? visualComparison.visualDiffRatio : 0,
          textDiffs: textComparison ? textComparison.textDiffs : [],
          baseTextPreview: textComparison ? textComparison.baseTextPreview : "",
          targetTextPreview: textComparison ? textComparison.targetTextPreview : "",
          width: visualComparison ? visualComparison.width : 0,
          height: visualComparison ? visualComparison.height : 0,
        });
      }

      setState({
        comparing: false,
        status: changedPages === 0 ? "Comparison complete. PDFs are identical." : "Comparison complete. Differences found.",
        error: "",
        result: {
          identical: changedPages === 0 && basePdf.numPages === targetPdf.numPages && comparedPages === totalPages,
          totalPages,
          comparedPages,
          changedPages,
          basePages: basePdf.numPages,
          targetPages: targetPdf.numPages,
          pageDiffs,
        },
      });
    } catch (error) {
      setState({
        comparing: false,
        status: "Comparison failed.",
        error: error instanceof Error ? error.message : "Unexpected comparison error.",
        result: null,
      });
    }
  };

  const summary = state.result;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-8 md:px-8">
      <header className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-orange-600 md:text-3xl">PDF Comparison Tool</h1>
        <p className="mt-2 text-sm text-slate-600 md:text-base">
          Upload two PDFs to compare in two phases: first text side-by-side for all pages, then visual page diff testing.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
            <span className="block text-sm font-semibold text-slate-700">Base PDF</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="mt-3 block w-full cursor-pointer text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-orange-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-orange-700"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setBaseFile(file);
              }}
            />
            <span className="mt-2 block truncate text-xs text-slate-500">{baseFile ? baseFile.name : "No file selected"}</span>
          </label>

          <label className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
            <span className="block text-sm font-semibold text-slate-700">Target PDF</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="mt-3 block w-full cursor-pointer text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-orange-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-orange-700"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setTargetFile(file);
              }}
            />
            <span className="mt-2 block truncate text-xs text-slate-500">{targetFile ? targetFile.name : "No file selected"}</span>
          </label>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={compareFiles}
            disabled={!canRun}
            className="rounded-lg bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {state.comparing ? "Comparing..." : "Compare PDFs"}
          </button>
          <button
            type="button"
            onClick={resetAll}
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Reset
          </button>
        </div>

        <p className="mt-4 text-sm font-medium text-slate-600">{state.status}</p>
        {state.error ? <p className="mt-2 text-sm font-semibold text-red-600">{state.error}</p> : null}
      </header>

      {summary ? (
        <main className="space-y-6 pb-10">
          <section className="grid gap-4 md:grid-cols-4">
            <StatCard label="Result" value={summary.identical ? "IDENTICAL" : "DIFFERENT"} valueClass={summary.identical ? "text-emerald-600" : "text-orange-600"} />
            <StatCard label="Compared Pages" value={`${formatNumber(summary.comparedPages)} / ${formatNumber(summary.totalPages)}`} />
            <StatCard label="Changed Pages" value={formatNumber(summary.changedPages)} valueClass={summary.changedPages ? "text-orange-600" : "text-emerald-600"} />
            <StatCard label="Page Count (Base / Target)" value={`${summary.basePages} / ${summary.targetPages}`} />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">Phase 1: Text Comparison (Side by Side)</h2>
            {summary.pageDiffs.map((page) => (
              <article key={`text-${page.pageNumber}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className={`flex items-center justify-between border-b px-5 py-4 ${page.status === "changed" || page.status === "missing-page" ? "bg-orange-50 border-orange-100" : "bg-emerald-50 border-emerald-100"}`}>
                  <h3 className="text-sm font-bold tracking-wide text-slate-800 md:text-base">Page {page.pageNumber}</h3>
                  {page.status === "missing-page" ? (
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">Missing page</span>
                  ) : page.textChanged ? (
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">Text changed</span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Text identical</span>
                  )}
                </div>

                {page.status === "missing-page" ? (
                  <p className="px-5 py-4 text-sm text-slate-700">{page.message}</p>
                ) : (
                  <>
                    <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 md:grid-cols-2">
                      <TextPreviewCard title="Base page text" value={page.baseTextPreview} />
                      <TextPreviewCard title="Target page text" value={page.targetTextPreview} />
                    </div>
                    <div className="px-5 py-4">
                      <p className="mb-2 text-sm font-semibold text-slate-700">Text changes</p>
                      {page.textDiffs.length ? (
                        <div className="grid gap-2">
                          {page.textDiffs.map((diffItem, index) => (
                            <TextDiffRow key={`text-diff-${page.pageNumber}-${index}`} type={diffItem.type} value={diffItem.value} />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-600">No text token differences found on this page.</p>
                      )}
                    </div>
                  </>
                )}
              </article>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">Phase 2: Visual Page Comparison</h2>
            {summary.pageDiffs.map((page) => (
              <article key={`visual-${page.pageNumber}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className={`flex items-center justify-between border-b px-5 py-4 ${page.status === "changed" || page.status === "missing-page" ? "bg-orange-50 border-orange-100" : "bg-emerald-50 border-emerald-100"}`}>
                  <h3 className="text-sm font-bold tracking-wide text-slate-800 md:text-base">Page {page.pageNumber}</h3>
                  {page.status === "missing-page" ? (
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">Missing page</span>
                  ) : page.visualChanged ? (
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                      {formatNumber(page.mismatchPixels)} pixels ({page.mismatchPercentage}%)
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">No visual differences</span>
                  )}
                </div>

                {page.status === "missing-page" ? (
                  <p className="px-5 py-4 text-sm text-slate-700">{page.message}</p>
                ) : (
                  <>
                    <div className="border-b border-slate-200 px-5 py-3">
                      <p className="text-xs font-medium text-slate-500">Visual diff ratio: {page.visualDiffRatio}%</p>
                    </div>
                    <div className="grid gap-px bg-slate-200 md:grid-cols-3">
                      <PreviewCard title="Base PDF" src={page.basePreview} width={page.width} height={page.height} />
                      <PreviewCard title="Difference Highlight" src={page.diffPreview} width={page.width} height={page.height} />
                      <PreviewCard title="Target PDF" src={page.targetPreview} width={page.width} height={page.height} />
                    </div>
                  </>
                )}
              </article>
            ))}
          </section>
        </main>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, valueClass = "text-slate-900" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-lg font-bold md:text-xl ${valueClass}`}>{value}</p>
    </div>
  );
}

function PreviewCard({ title, src, width, height }) {
  return (
    <div className="bg-white p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={title} width={width} height={height} className="h-auto w-full rounded-md border border-slate-200" />
    </div>
  );
}

function TextPreviewCard({ title, value }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="max-h-72 overflow-auto rounded border border-slate-100 bg-slate-50 p-2">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
          {value || "No text detected on this page."}
        </p>
      </div>
    </div>
  );
}

function TextDiffRow({ type, value }) {
  const isAdded = type === "added";
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${isAdded ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
      <span className="mr-2 inline-flex rounded-full bg-white px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
        {isAdded ? "Added" : "Removed"}
      </span>
      <span>{value}</span>
    </div>
  );
}
