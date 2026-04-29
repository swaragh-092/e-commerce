# Shipping Rate Engine — Technical Specification

**Version:** 1.0  
**Status:** Approved for Implementation  
**Scope:** `server/src/modules/shipping/`

---

## 1. Industry Model

Every major Indian carrier (Shiprocket, Delhivery, Ekart, Bluedart) bills using this formula:

```
Chargeable Weight = MAX(Actual Weight, Volumetric Weight)
Volumetric Weight = (L × B × H in cm) ÷ Divisor × 1000   [grams]

Final Charge = Base Rate
             + Slab Charge       (per 500g beyond first slab)
             × Zone Multiplier
             + Fuel Surcharge%   (on freight only — NOT on COD)
             + COD Fee           (separate — flat or % of order)

Floor: MAX(above, Min Charge)
```

### 1.1 Volumetric Divisors

| Carrier | Divisor |
|---|---|
| Shiprocket | 5000 |
| Ekart | 4000 |
| Delhivery | 5000 |
| FedEx India | 6000 |

System setting: `shipping.volumetricDivisor` (default `5000`). Rules may override via `rateConfig.volumetricDivisor`.

### 1.2 Zone Tiers

| Zone | Scope | Typical Multiplier |
|---|---|---|
| `same_city` | First 4 pincode digits match | 1.0× |
| `same_state` | First 2 pincode digits match | 1.3× |
| `national` | Rest of India | 1.6× |
| `remote` | NE India (78–83), J&K (19) | 2.0–2.5× |

---

## 2. All 9 Issues — Design Decisions

### FIX 1 — Volumetric Aggregation (Stacking Model)

**Problem:** `Σ(L×B×H×qty)` over-inflates volume; items share a box.

**Decision — Vertical Stacking:**
```
footprint = max(L) × max(B)
height    = Σ(H × qty)
volumeCm3 = footprint × height
```

**Future:** Bin-packing for carts with >5 distinct item types.

---

### FIX 2 — Slab Rounding (Critical)

Carriers never bill raw grams. Always round UP to next 500g slab:

```js
const chargeableWeightGrams = Math.ceil(raw / 500) * 500;
```

| Raw | Billed |
|---|---|
| 480g | 500g |
| 501g | 1000g |
| 1250g | 1500g |

---

### FIX 3 — COD Fee from `rateConfig`

COD fee is a **separate line** applied AFTER fuel surcharge:

```
percent mode: codFee = MAX(codFeeMin, orderValue × codFeeValue%)
flat mode:    codFee = codFeeValue
total = freight + codFee
```

---

### FIX 4 — Configurable Volumetric Divisor

Priority: `rateConfig.volumetricDivisor` → `settings.shipping.volumetricDivisor` → `5000`

---

### FIX 5 — Zone Detection (MVP)

Pincode prefix matching — known limitation for cross-district borders.

```
4-digit prefix match → same_city
2-digit prefix match → same_state
prefix in [78,79,83,19] → remote
otherwise → national
```

**Production upgrade (Phase 2):** India Post pincode CSV → `pincode_zones` table.

---

### FIX 6 — Fuel Surcharge Order of Operations

```
1. freight  = baseCharge + slabCharge
2. freight  = freight × zoneMultiplier
3. freight  = freight + (freight × fuelSurcharge%)   ← NOT on COD
4. freight  = MAX(freight, minCharge)
5. codFee   = calculated separately
6. total    = freight + codFee
```

---

### FIX 7 — Minimum Charge

```js
freight = Math.max(freight, Number(config.minCharge || 0));
```
Applied after fuel surcharge, before COD fee.

---

### FIX 8 — Max Weight Guard

If `provider.maxWeightKg` is set and `chargeableWeightGrams > maxWeightKg × 1000`, the rule is **skipped** and the engine falls through to the next matching rule or manual fallback.

---

### FIX 9 — Multi-Package Splitting

```
packageCount           = ceil(totalWeight / maxWeightPerPackage)
weightPerPackage       = ceil(totalWeight / packageCount)   [balanced]
totalFreight           = singlePackageFreight × packageCount
```

COD fee is charged once per order, not per package.

---

## 3. `rateConfig` Schema

```jsonc
{
  // Pricing
  "baseCharge": 40,
  "firstSlabGrams": 500,
  "additionalSlabGrams": 500,
  "additionalSlabRate": 15,
  "minCharge": 30,
  "freeAboveSubtotal": 999,

  // Volumetric
  "volumetricDivisor": 5000,

  // Zone multipliers
  "zoneMultipliers": {
    "same_city":  1.0,
    "same_state": 1.3,
    "national":   1.6,
    "remote":     2.1
  },

  // Fuel surcharge (on freight only)
  "fuelSurchargePercent": 3,

  // COD
  "codFeeType":  "percent",  // "percent" | "flat"
  "codFeeValue": 2,
  "codFeeMin":   30
}
```

### Supported `rateType` Values

| `rateType` | Description |
|---|---|
| `flat` | Fixed charge regardless of weight |
| `free` | Always ₹0 |
| `free_above_threshold` | Free if cart ≥ threshold |
| `percent_of_order` | X% of cart subtotal |
| `per_kg_slab` | Base + per-500g slabs with zone multiplier |
| `volumetric` | Alias for `per_kg_slab` (emphasises volumetric billing) |

---

## 4. `conditions` Schema (Extended)

```jsonc
{
  "country": "IN",
  "state": "Karnataka",
  "city": "Bangalore",
  "pincodes": ["560001-560100"],
  "blockedPincodes": ["560099"],
  "subtotalGte": 0,
  "subtotalLte": 999,
  "weightGte": 0,       // Chargeable weight in grams ≥
  "weightLte": 5000,    // Chargeable weight in grams ≤
  "paymentMethods": ["cod", "razorpay"]
}
```

---

## 5. Data Model Changes

### Products Table (one migration)

```sql
ALTER TABLE products ADD COLUMN weight_grams  DECIMAL(10,2) DEFAULT 500;
ALTER TABLE products ADD COLUMN length_cm     DECIMAL(8,2)  DEFAULT 10;
ALTER TABLE products ADD COLUMN breadth_cm    DECIMAL(8,2)  DEFAULT 10;
ALTER TABLE products ADD COLUMN height_cm     DECIMAL(8,2)  DEFAULT 10;
```

File: `20260429200000-add-product-shipping-dimensions.js` ✅

### Settings Required

| Key | Group | Description |
|---|---|---|
| `warehousePincode` | `shipping` | Origin pincode for zone detection |
| `volumetricDivisor` | `shipping` | Default divisor (5000) |

No other migrations needed — `rateConfig` and `conditions` are already JSONB.

---

## 6. Provider Adapter Interface

### Input (`calculateRate` receives)

```js
{
  pincode:               '560001',
  pickupPincode:         '400001',
  city:                  'Bangalore',
  state:                 'Karnataka',
  country:               'IN',
  weightGrams:           1500,       // Chargeable (rounded slab)
  actualWeightGrams:     1200,
  volumetricWeightGrams: 800,
  declaredValue:         1499,       // Cart subtotal
  paymentMode:           'cod',      // 'cod' | 'prepaid'
  zone:                  'same_state',
  packageCount:          1,
  itemCount:             3,
}
```

### Output

```js
{
  rate:                  150,   // Total (freight + codFee)
  freight:               120,
  codFee:                30,
  currency:              'INR',
  estimatedMinDays:      2,
  estimatedMaxDays:      4,
  chargeableWeightGrams: 1500,
  zone:                  'same_state',
  packageCount:          1,
  rawResponse:           {},
}
```

---

## 7. Calculation Flow

```
POST /shipping/calculate
  │
  ▼
buildCheckoutContext()
  ├─ Fetch cart + products (weightGrams, L, B, H)
  └─ computePackageDimensions() → stacking model → volumeCm3

  │
  ▼
createQuote()
  ├─ computeChargeableWeight(dims, divisor)  → 500g slab rounding
  ├─ detectDeliveryZone(warehouse, delivery) → zone tier
  └─ splitIntoPackages(weight, maxPerPkg)    → packageCount

  │
  ▼
calculateRuleDecision()
  ├─ Rules ordered by priority DESC
  ├─ For each rule:
  │   ├─ zoneMatches()
  │   ├─ conditionsMatch()  [includes weightGte/weightLte]
  │   ├─ providerSupportsDecision()
  │   └─ FIX 8: maxWeightKg guard → skip rule if exceeded
  ├─ calculateRuleRate() → { freight, codFee, total }
  │   ├─ slab calculation
  │   ├─ zone multiplier
  │   ├─ fuel surcharge on freight only
  │   ├─ minCharge floor
  │   └─ COD fee separate
  └─ FIX 9: freight × packageCount

  │
  ▼
ShippingQuote.create()
  └─ decisionSnapshot.rateBreakdown { freight, codFee, packageCount, zone }
```

---

## 8. Admin UI — Rule Builder Fields

### Rate Type Dropdown (extend existing)

```
Flat Rate
Free Shipping
Free Above ₹X
Per-kg Slab       ← NEW
% of Order Value  ← NEW
Volumetric        ← NEW
```

### Dynamic Fields — Per-kg Slab

| Field | Default |
|---|---|
| Base Charge (₹) | 40 |
| First Slab (g) | 500 |
| Additional Slab Size (g) | 500 |
| Per Slab Rate (₹) | 15 |
| Min Charge (₹) | 30 |
| Fuel Surcharge % | 0 |
| Free Above ₹ | — |

### Zone Multipliers

| Zone | Default |
|---|---|
| Same City | 1.0 |
| Same State | 1.3 |
| National | 1.6 |
| Remote | 2.0 |

### COD Fee Section

| Field | Default |
|---|---|
| Fee Type (percent/flat) | flat |
| Fee Value | 0 |
| Fee Min (₹) | 0 |

### Weight Conditions

| Field | Notes |
|---|---|
| Weight ≥ (g) | Optional lower bound |
| Weight ≤ (g) | Optional upper bound |

---

## 9. Implementation Checklist

### Phase A — Backend (In Progress)

- [x] Migration: product shipping dimensions
- [x] `product.model.js`: dimension fields
- [x] `computePackageDimensions()` — stacking model
- [x] `computeChargeableWeight()` — 500g slab rounding
- [x] `detectDeliveryZone()` — prefix matching
- [x] `splitIntoPackages()` — multi-package
- [x] `conditionsMatch()` — weight conditions
- [x] `calculateRuleRate()` — all 9 fixes
- [x] `buildCheckoutContext()` — packageDims
- [x] `calculateRuleDecision()` — weight + zone + max-weight + per-package
- [x] `createQuote()` — compute weight/zone/packages
- [ ] `shipping.validation.js` — extend rateType enum + weight conditions
- [ ] `ekart.provider.js` — real weight/zone-based rate
- [ ] `shiprocket.provider.js` — real weight/zone-based rate

### Phase B — Admin UI

- [ ] Rule modal: new rateType options
- [ ] Rule modal: dynamic form per rateType
- [ ] Rule modal: zone multiplier inputs
- [ ] Rule modal: COD fee inputs
- [ ] Rule modal: weight condition inputs

### Phase C — Product Management

- [ ] Admin product form: weight + dimensions fields
- [ ] Product API: accept + persist dimensions

### Phase D — Future

- [ ] India Post pincode CSV → `pincode_zones` table
- [ ] Bin-packing for mixed-item carts
- [ ] Per-package label generation

---

## 10. Test Scenarios

| Scenario | Input | Expected |
|---|---|---|
| Light item | 480g actual | Billed 500g |
| Medium item | 1100g actual | Billed 1500g (3 slabs) |
| Volumetric wins | 10g actual, 30cm cube | vol=1800g → billed 2000g |
| Same-city | 4-digit prefix match | zone=same_city, 1.0× |
| Remote NE | pincode starts 78 | zone=remote, 2.0× |
| COD 2% | subtotal=₹800 | codFee=max(30,16)=₹30 |
| Heavy order | 25000g, max 20kg | packageCount=2, freight×2 |
| Provider limit | 15000g, maxWeightKg=10 | Rule skipped → fallback |
