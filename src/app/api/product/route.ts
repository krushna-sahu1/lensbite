/**
 * GET /api/product?code=<barcode>
 *
 * Looks a packaged food up in Open Food Facts by barcode and returns it as a
 * BarcodeProduct. Done on the server so the request carries a proper
 * User-Agent (Open Food Facts asks apps to identify themselves) and so the
 * browser only ever talks to LensBite. Signed-in users only.
 */
import { isValidBarcode, OFF_FIELDS, parseOffProduct } from "@/lib/openfoodfacts";
import { requireUser } from "@/lib/server/guard";

const USER_AGENT = "LensBite/0.1 (web app)";

export async function GET(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const code = new URL(request.url).searchParams.get("code")?.trim() ?? "";
  if (!isValidBarcode(code)) {
    return Response.json({ error: "That doesn't look like a product barcode (8, 12, 13 or 14 digits)." }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${encodeURIComponent(OFF_FIELDS)}`,
      { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(8000) },
    );
  } catch {
    return Response.json({ error: "Couldn't reach Open Food Facts. Try again in a moment." }, { status: 502 });
  }

  if (res.status === 404) return notFound();
  if (!res.ok) {
    return Response.json({ error: `Open Food Facts answered ${res.status}. Try again later.` }, { status: 502 });
  }
  const body = (await res.json().catch(() => null)) as { status?: number; product?: unknown } | null;
  if (!body || body.status === 0 || !body.product) return notFound();

  const product = parseOffProduct(code, body.product);
  if (!product) {
    return Response.json(
      { error: "This product is in Open Food Facts but has no calorie data yet. Add it by hand or scan the label in Live." },
      { status: 422 },
    );
  }
  // Product data changes rarely; let the browser reuse it for a day.
  return Response.json(product, { headers: { "Cache-Control": "private, max-age=86400" } });
}

function notFound() {
  return Response.json(
    { error: "Product not found in Open Food Facts. Add it by hand, or scan its label in Live." },
    { status: 404 },
  );
}
