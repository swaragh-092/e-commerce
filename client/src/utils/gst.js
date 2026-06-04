const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const roundMoney = (value) => Number(toNumber(value).toFixed(2));

const normalizeRate = (value) => {
  const number = toNumber(value, 0);
  if (Math.abs(number) <= 1) return number;
  return number / 100;
};

const isEnabled = (value) => value === true || value === 'true';

const normalizeState = (value) => String(value || '').trim().toLowerCase();

const getEffectiveTax = (product = {}, taxSettings = {}) => {
  const taxConfig = product?.taxConfig;

  if (taxConfig?.isCustom) {
    return {
      sgst: normalizeRate(taxConfig.sgst || 0),
      cgst: normalizeRate(taxConfig.cgst || 0),
      igst: normalizeRate(taxConfig.igst || 0),
      flatRate: normalizeRate(taxConfig.flatRate || taxConfig.rate || 0),
      inclusive: Boolean(taxConfig.inclusive),
      useGST: Boolean(taxConfig.sgst || taxConfig.cgst || taxConfig.igst),
    };
  }

  const enableCGST = isEnabled(taxSettings.enableCGST);
  const enableSGST = isEnabled(taxSettings.enableSGST);
  const enableIGST = isEnabled(taxSettings.enableIGST);
  const useGST = enableCGST || enableSGST || enableIGST;

  return {
    sgst: enableSGST ? normalizeRate(taxSettings.sgstRate || 0) : 0,
    cgst: enableCGST ? normalizeRate(taxSettings.cgstRate || 0) : 0,
    igst: enableIGST ? normalizeRate(taxSettings.igstRate || 0) : 0,
    flatRate: !useGST ? normalizeRate(taxSettings.rate || 0) : 0,
    inclusive: !useGST && isEnabled(taxSettings.inclusive),
    useGST,
  };
};

const computeItemTax = (effectiveTax, itemSubtotal, destinationState = '', originState = '') => {
  const isIntraState =
    !destinationState ||
    !originState ||
    normalizeState(destinationState) === normalizeState(originState);

  let sgst = 0;
  let cgst = 0;
  let igst = 0;
  let flatTax = 0;

  if (effectiveTax.inclusive) {
    return {
      sgst: 0,
      cgst: 0,
      igst: 0,
      flatTax: 0,
      totalTax: 0,
      isInclusive: true,
      rates: {
        sgst: roundMoney(normalizeRate(effectiveTax.sgst) * 100),
        cgst: roundMoney(normalizeRate(effectiveTax.cgst) * 100),
        igst: roundMoney(normalizeRate(effectiveTax.igst) * 100),
        flatTax: roundMoney(normalizeRate(effectiveTax.flatRate) * 100),
      },
    };
  }

  if (effectiveTax.useGST) {
    if (isIntraState) {
      sgst = itemSubtotal * effectiveTax.sgst;
      cgst = itemSubtotal * effectiveTax.cgst;
    } else {
      igst = itemSubtotal * effectiveTax.igst;
    }
  } else {
    flatTax = itemSubtotal * effectiveTax.flatRate;
  }

  const roundedSgst = roundMoney(sgst);
  const roundedCgst = roundMoney(cgst);
  const roundedIgst = roundMoney(igst);
  const roundedFlatTax = roundMoney(flatTax);

  return {
    sgst: roundedSgst,
    cgst: roundedCgst,
    igst: roundedIgst,
    flatTax: roundedFlatTax,
    totalTax: roundMoney(roundedSgst + roundedCgst + roundedIgst + roundedFlatTax),
    isInclusive: false,
    rates: {
      sgst: roundMoney(normalizeRate(effectiveTax.sgst) * 100),
      cgst: roundMoney(normalizeRate(effectiveTax.cgst) * 100),
      igst: roundMoney(normalizeRate(effectiveTax.igst) * 100),
      flatTax: roundMoney(normalizeRate(effectiveTax.flatRate) * 100),
    },
  };
};

const getUniqueRateLabel = (label, rates = []) => {
  const uniqueRates = [...new Set(rates.filter((rate) => toNumber(rate) > 0).map((rate) => roundMoney(rate)))];
  if (uniqueRates.length === 1) return `${label} (${uniqueRates[0].toFixed(1)}%)`;
  return label;
};

export const calculateTaxSummary = ({
  items = [],
  settings = {},
  destinationState = '',
  quantityResolver = (item) => Math.max(1, Math.floor(toNumber(item?.quantity, 1))),
  priceResolver,
} = {}) => {
  if (typeof priceResolver !== 'function') {
    throw new TypeError('calculateTaxSummary requires a valid priceResolver function');
  }

  const taxSettings = settings?.tax || {};
  const originState = String(taxSettings.originState || '');
  const totals = {
    cgst: 0,
    sgst: 0,
    igst: 0,
    flatTax: 0,
    totalTax: 0,
    isInclusive: false,
    hasMixedInclusive: false,
    inclusiveCount: 0,
    totalCount: 0,
  };
  const componentRates = {
    cgst: [],
    sgst: [],
    igst: [],
    flatTax: [],
  };

  items.forEach((item) => {
    if (!item?.product) return;
    const quantity = Math.max(1, Math.floor(toNumber(quantityResolver(item), 1)));
    const unitPrice = toNumber(priceResolver(item));
    if (unitPrice < 0) {
      throw new Error(`priceResolver must return a non-negative unit price; got ${unitPrice}`);
    }

    const itemSubtotal = unitPrice * quantity;
    const effectiveTax = getEffectiveTax(item.product, taxSettings);
    const breakdown = computeItemTax(effectiveTax, itemSubtotal, destinationState, originState);

    totals.cgst += breakdown.cgst;
    totals.sgst += breakdown.sgst;
    totals.igst += breakdown.igst;
    totals.flatTax += breakdown.flatTax;
    totals.totalTax += breakdown.totalTax;
    totals.totalCount += 1;
    if (breakdown.isInclusive) totals.inclusiveCount += 1;

    if (breakdown.cgst > 0) componentRates.cgst.push(breakdown.rates.cgst);
    if (breakdown.sgst > 0) componentRates.sgst.push(breakdown.rates.sgst);
    if (breakdown.igst > 0) componentRates.igst.push(breakdown.rates.igst);
    if (breakdown.flatTax > 0) componentRates.flatTax.push(breakdown.rates.flatTax);
  });

  if (totals.totalCount === 0) {
    totals.isInclusive = false;
  } else if (totals.inclusiveCount === 0) {
    totals.isInclusive = false;
  } else if (totals.inclusiveCount === totals.totalCount) {
    totals.isInclusive = true;
  } else {
    totals.isInclusive = null;
    totals.hasMixedInclusive = true;
  }

  const summary = {
    cgst: roundMoney(totals.cgst),
    sgst: roundMoney(totals.sgst),
    igst: roundMoney(totals.igst),
    flatTax: roundMoney(totals.flatTax),
    totalTax: roundMoney(totals.totalTax),
    isInclusive: totals.isInclusive,
    hasMixedInclusive: totals.hasMixedInclusive,
    inclusiveCount: totals.inclusiveCount,
    totalCount: totals.totalCount,
    useGST: roundMoney(totals.cgst + totals.sgst + totals.igst) > 0,
    originState,
    destinationState: String(destinationState || ''),
  };

  return {
    ...summary,
    taxRows: [
      ...(summary.cgst > 0 ? [{ key: 'cgst', label: getUniqueRateLabel('CGST', componentRates.cgst), amount: summary.cgst }] : []),
      ...(summary.sgst > 0 ? [{ key: 'sgst', label: getUniqueRateLabel('SGST', componentRates.sgst), amount: summary.sgst }] : []),
      ...(summary.igst > 0 ? [{ key: 'igst', label: getUniqueRateLabel('IGST', componentRates.igst), amount: summary.igst }] : []),
      ...(summary.flatTax > 0 ? [{ key: 'flatTax', label: getUniqueRateLabel('Tax', componentRates.flatTax), amount: summary.flatTax }] : []),
    ],
  };
};
