export function calculateTax(subtotal, taxRate) {
  return subtotal * (taxRate / 100);
}