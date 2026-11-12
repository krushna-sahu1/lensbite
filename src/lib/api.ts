/** Browser calls to LensBite's own API routes, with friendly errors. */
import type { AnalyzeResult } from "./analyze";
import type { BarcodeProduct } from "./openfoodfacts";

async function call<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    throw new Error("Can't reach the server. Check your internet connection.");
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status}).`);
  return body;
}

/** Estimates a described and/or photographed meal. */
export function analyzeFood(input: { text?: string; image?: { data: string; mimeType: string } }): Promise<AnalyzeResult> {
  return call<AnalyzeResult>("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/** Looks a barcode up in Open Food Facts. */
export function lookupBarcode(code: string): Promise<BarcodeProduct> {
  return call<BarcodeProduct>(`/api/product?code=${encodeURIComponent(code)}`);
}
