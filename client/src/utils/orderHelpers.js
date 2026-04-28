/**
 * Build a compact product summary from order items.
 * Handles both `items` (new backend alias) and `OrderItems` (legacy).
 */
export const getProductSummary = (order, maxNames = 2) => {
    const items = order.items || order.OrderItems || [];
    if (!items.length) return { summary: 'No items', count: 0, qty: 0 };

    const names = items
        .map((i) => i.Product?.name || i.product?.name || null)
        .filter(Boolean);

    const totalQty = items.reduce((s, i) => s + (i.quantity || 1), 0);
    const shown = names.slice(0, maxNames);
    const extra = names.length - shown.length;

    return {
        summary: shown.join(', ') + (extra > 0 ? ` +${extra} more` : ''),
        count: items.length,
        qty: totalQty,
    };
};

export const formatOrderDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
    });
