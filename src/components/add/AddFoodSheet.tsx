"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { BarcodeIcon, CloseIcon, ImageIcon, PenIcon, SparkIcon } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { ANALYZE_TEXT_MAX, type AnalyzeResult, type AnalyzedItem } from "@/lib/analyze";
import { analyzeFood } from "@/lib/api";
import { encodePhoto, type EncodedImage } from "@/lib/image";
import { useLibrary, type QuickFood } from "@/lib/library";
import { mealTypeForTime } from "@/lib/nutrition";
import { addMeal } from "@/lib/storage";
import type { Meal, MealType } from "@/lib/types";
import { AnalyzeResults } from "./AnalyzeResults";
import { QuickFoodList } from "./QuickFoodList";

/**
 * The "Add food" hub: describe a meal or snap a photo for an AI estimate, log
 * a recent/saved/yesterday food in one tap, or jump to the barcode scanner or
 * the manual form. Everything here works without a Live session.
 */
interface AddFoodProps {
  onClose: () => void;
  /** Meals that were just logged, for the "Logged · Undo" toast. */
  onLogged: (meals: Meal[]) => void;
  onBarcode: () => void;
  onManual: () => void;
}

export function AddFoodSheet({ open, ...props }: AddFoodProps & { open: boolean }) {
  return (
    <Sheet open={open} onClose={props.onClose} title="Add food" subtitle="Describe it, snap it, scan it, or pick a favorite.">
      {/* Mounted only while open, so every opening starts fresh. */}
      {open && <AddFoodBody {...props} />}
    </Sheet>
  );
}

function AddFoodBody({ onClose, onLogged, onBarcode, onManual }: AddFoodProps) {
  const library = useLibrary(true);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<EncodedImage | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [busy, setBusy] = useState<"photo" | "analyze" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Free the preview image when it's replaced or the sheet closes.
  useEffect(() => {
    if (!photo) return;
    return () => URL.revokeObjectURL(photo.previewUrl);
  }, [photo]);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setBusy("photo");
    setError(null);
    try {
      setPhoto(await encodePhoto(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function analyze(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() && !photo) return setError("Describe what you ate, or add a photo.");
    setBusy("analyze");
    setError(null);
    try {
      setResult(
        await analyzeFood({
          text: text.trim() || undefined,
          image: photo ? { data: photo.data, mimeType: photo.mimeType } : undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function logItems(items: AnalyzedItem[], mealType: MealType) {
    const logged: Meal[] = [];
    try {
      for (const item of items) {
        const { meal } = await addMeal({
          name: item.name,
          mealType,
          calories: item.calories,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fat_g: item.fat_g,
          fiber_g: item.fiber_g,
          notes: `${item.portion}; AI estimate ${item.caloriesLow}–${item.caloriesHigh} kcal`.slice(0, 2000),
        });
        logged.push(meal);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      if (logged.length) onLogged(logged);
      return;
    }
    onLogged(logged);
    onClose();
  }

  async function logQuick(foods: QuickFood[], keepType = false) {
    const now = new Date();
    const logged: Meal[] = [];
    for (const food of foods) {
      const { meal } = await addMeal({
        name: food.name,
        mealType: keepType && food.mealType ? food.mealType : mealTypeForTime(now),
        calories: food.calories,
        protein_g: food.protein_g,
        carbs_g: food.carbs_g,
        fat_g: food.fat_g,
        fiber_g: food.fiber_g,
        notes: food.notes,
      });
      logged.push(meal);
    }
    onLogged(logged);
  }

  return (
    <>
      {result ? (
        <AnalyzeResults result={result} onBack={() => setResult(null)} onLog={logItems} />
      ) : (
        <>
          <form onSubmit={analyze}>
            <label className="sr-only" htmlFor="describe-food">
              What did you eat?
            </label>
            <div className="rounded-2xl border border-line bg-background transition focus-within:border-accent-ink">
              <textarea
                id="describe-food"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={ANALYZE_TEXT_MAX}
                rows={3}
                placeholder="e.g. 2 eggs scrambled in butter, a slice of sourdough and a flat white"
                className="block w-full resize-none rounded-2xl bg-transparent px-3.5 pt-3 text-[15px] outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void analyze(e);
                }}
              />
              {photo && (
                <div className="relative mx-3 mb-2 mt-1 w-fit">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                  <img src={photo.previewUrl} alt="Photo to analyze" className="h-20 w-20 rounded-xl object-cover ring-1 ring-line" />
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    aria-label="Remove photo"
                    className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full bg-foreground text-background shadow"
                  >
                    <CloseIcon width={14} height={14} />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 px-2 pb-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  // Opens the camera directly on phones; desktop browsers show a file picker.
                  capture="environment"
                  className="hidden"
                  onChange={(e) => void pickPhoto(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={busy !== null}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted transition hover:bg-track hover:text-foreground disabled:opacity-50"
                >
                  <ImageIcon width={18} height={18} />
                  {busy === "photo" ? "Preparing…" : photo ? "Retake" : "Photo"}
                </button>
                <button
                  type="submit"
                  disabled={busy !== null || (!text.trim() && !photo)}
                  className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-semibold text-background transition active:scale-95 disabled:opacity-40"
                >
                  {busy === "analyze" ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-background/30 border-t-background" />
                      Estimating…
                    </>
                  ) : (
                    <>
                      <SparkIcon width={16} height={16} />
                      Estimate
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {error && (
            <p role="alert" className="mt-3 rounded-2xl bg-fat/15 px-4 py-3 text-sm text-fat-ink">
              {error}
            </p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onBarcode}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-track font-semibold transition hover:brightness-95 active:scale-[0.98]"
            >
              <BarcodeIcon width={18} height={18} />
              Scan barcode
            </button>
            <button
              type="button"
              onClick={onManual}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-track font-semibold transition hover:brightness-95 active:scale-[0.98]"
            >
              <PenIcon width={18} height={18} />
              Type it in
            </button>
          </div>

          <div className="mt-5">
            <QuickFoodList library={library} onLog={logQuick} onError={setError} />
          </div>
        </>
      )}
    </>
  );
}
