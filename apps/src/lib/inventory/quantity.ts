// Stock quantities are plain JS numbers, and a litre of oil is sold in
// fractions (2.2 L off a 3 L drum). Binary floats can't hold those exactly:
// 3 − 2.2 is 0.7999999999999998, so "sell the last 0.8 L" read as insufficient
// stock and a fully drained product showed as 1e-16 oversold. Everything that
// sums or subtracts a quantity rounds through here, to a millilitre.
const SCALE = 1000

/** Round to 3 decimals. Normalises -0 to 0 so it never prints as "-0". */
export function roundQty(n: number): number {
  const rounded = Math.round(n * SCALE) / SCALE
  return rounded === 0 ? 0 : rounded
}

/** Parse a quantity a person typed: decimals allowed, junk and negatives → 0.
 *  Accepts a decimal comma ("2,5"), since that is how the shop writes it. */
export function parseQty(text: string): number {
  const n = parseFloat(text.trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? roundQty(n) : 0
}
