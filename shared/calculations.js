export function calculateTax(subtotal, taxRate) {
  const rate = Number(taxRate) || 0;
  return subtotal * (Math.abs(rate) <= 1 ? rate : rate / 100);
}
