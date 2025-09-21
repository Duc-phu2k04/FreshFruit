// FE utility
export const resolveDisplayStock = (p) => {
  if (!p) return 0;
  if (p.isCombo) return Number(p?.comboInventory?.stock ?? 0);
  if (p?.baseVariant?.stock != null) return Number(p.baseVariant.stock) || 0;
  if (Array.isArray(p?.variants)) {
    return p.variants.reduce((sum, v) => sum + (Number(v?.stock) || 0), 0);
  }
  return Number(p?.stock) || 0;
};

export const isOutOfStock = (p) => resolveDisplayStock(p) <= 0;
