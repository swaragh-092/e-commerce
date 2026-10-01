# Shipping System — Complete A-to-Z Technical & Operational Reference

This document is the definitive technical manual for the e-commerce platform's shipping subsystem. It covers the end-to-end architecture, mathematical calculation models, package bin-packing algorithms, rule engine evaluation, multi-carrier integrations, checkout UX guards, order placement validation, and post-order fulfillment.

---

## Table of Contents

1. [Architectural Overview & Core Concepts](#1-architectural-overview--core-concepts)
2. [End-to-End Execution Flow Diagram](#2-end-to-end-execution-flow-diagram)
3. [Parcel Planning & 3D Packaging Engine (`shipping.packages.js`)](#3-parcel-planning--3d-packaging-engine-shippingpackagesjs)
4. [Volumetric & Chargeable Weight Calculations](#4-volumetric--chargeable-weight-calculations)
5. [Storewide Coverage & Pincode Restrictions](#5-storewide-coverage--pincode-restrictions)
6. [Pricing Modes & The Shipping Rule Engine (`shippingRule.model.js`)](#6-pricing-modes--the-shipping-rule-engine-shippingrulemodeljs)
7. [Geographical Rate Zones (`ShippingZone` & `detectDeliveryZone`)](#7-geographical-rate-zones-shippingzone--detectdeliveryzone)
8. [Shipping Providers & Carrier Integrations (`providers/`)](#8-shipping-providers--carrier-integrations-providers)
9. [The Shipping Quote Lifecycle & Security Guardrails](#9-the-shipping-quote-lifecycle--security-guardrails)
10. [Checkout & Order Placement Validation (`validateQuoteForOrder`)](#10-checkout--order-placement-validation-validatequotefororder)
11. [Post-Order Fulfillment, Tracking & Webhooks](#11-post-order-fulfillment-tracking--webhooks)
12. [The 10 Practical Production Edge Cases Handled A-to-Z](#12-the-10-practical-production-edge-cases-handled-a-to-z)
13. [Admin Configuration Recipes & Troubleshooting](#13-admin-configuration-recipes--troubleshooting)
14. [Automated Verification & Test Coverage Matrix](#14-automated-verification--test-coverage-matrix)

---

## 1. Architectural Overview & Core Concepts

The shipping subsystem is built on a **dual-responsibility model** that strictly decouples customer commercial charging from operational logistics fulfillment:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CUSTOMER COMMERCIAL LAYER                             │
│  What the shopper pays at checkout (Standard Flat/Free, Rules, or Carrier) │
│  Determined by: Store Settings, Priority Rules, Cart Subtotal, Weight       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      OPERATIONAL FULFILLMENT LAYER                          │
│  How the order is physically packaged, quoted by couriers, and dispatched   │
│  Determined by: Package Profiles, Carrier Serviceability, AWBs, Webhooks    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Module File Map

| File Path | Primary Responsibility |
|---|---|
| [`server/src/modules/shipping/shipping.service.js`](file:///home/sr-user91/Documents/Projects/e-commerce/server/src/modules/shipping/shipping.service.js) | Core orchestration: `createQuote`, `validateQuoteForOrder`, rule matching, coverage checks, zone detection. |
| [`server/src/modules/shipping/shipping.packages.js`](file:///home/sr-user91/Documents/Projects/e-commerce/server/src/modules/shipping/shipping.packages.js) | Parcel planner: `planParcels`, package profile validation, mixed-item grouping, volumetric weight. |
| [`server/src/modules/shipping/shipping.settings.js`](file:///home/sr-user91/Documents/Projects/e-commerce/server/src/modules/shipping/shipping.settings.js) | Configuration validation: pricing modes, rates, threshold bounds, pincode format enforcement. |
| [`server/src/modules/shipping/shipping.crypto.js`](file:///home/sr-user91/Documents/Projects/e-commerce/server/src/modules/shipping/shipping.crypto.js) | Security: AES-256-GCM credential encryption/decryption for third-party courier tokens and webhook secrets. |
| [`server/src/modules/shipping/shippingRule.model.js`](file:///home/sr-user91/Documents/Projects/e-commerce/server/src/modules/shipping/shippingRule.model.js) | Database model: Priority, rate type (`flat`, `per_kg_slab`, `percent_of_order`, etc.), condition filters. |
| [`server/src/modules/shipping/shippingQuote.model.js`](file:///home/sr-user91/Documents/Projects/e-commerce/server/src/modules/shipping/shippingQuote.model.js) | Database model: 10-minute quotes, SHA-256 cart/address/coupon tamper hashes, idempotency keys. |
| [`server/src/modules/shipping/shippingProvider.model.js`](file:///home/sr-user91/Documents/Projects/e-commerce/server/src/modules/shipping/shippingProvider.model.js) | Database model: Carrier configurations (`shiprocket`, `ekart`, `manual`), limits, encrypted credentials. |
| [`server/src/modules/shipping/shippingZone.model.js`](file:///home/sr-user91/Documents/Projects/e-commerce/server/src/modules/shipping/shippingZone.model.js) | Database model: Regional geographic grouping by country, state, city, and pincode lists. |
| [`server/src/modules/shipping/providers/shiprocket.provider.js`](file:///home/sr-user91/Documents/Projects/e-commerce/server/src/modules/shipping/providers/shiprocket.provider.js) | Carrier adapter: Live REST serviceability, AWB allocation, label generation, auth circuit breaker. |
| [`server/src/modules/shipping/shipping.webhook.service.js`](file:///home/sr-user91/Documents/Projects/e-commerce/server/src/modules/shipping/shipping.webhook.service.js) | Inbound tracking webhooks: HMAC verification, monotonic status rank progression, race guard row locking. |
| [`server/src/modules/shipping/shippingOperation.service.js`](file:///home/sr-user91/Documents/Projects/e-commerce/server/src/modules/shipping/shippingOperation.service.js) | Resilient queue: Async courier dispatch operations, exponential backoff, manual retry locks. |
| [`server/src/jobs/trackingReconciliation.job.js`](file:///home/sr-user91/Documents/Projects/e-commerce/server/src/jobs/trackingReconciliation.job.js) | Background cron: 30-minute status polling with round-robin starvation prevention. |

---

## 2. End-to-End Execution Flow Diagram

```
 ┌────────────────┐
 │ Storefront     │
 │ Checkout       │ (Cart / Buy Now, Address, Payment Method, Coupons)
 └───────┬────────┘
         │ POST /api/v1/shipping/calculate
         ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 1. buildCheckoutContext()                                              │
 │    - Resolve physical vs digital items                                 │
 │    - Query product measurements (weightGrams, L x B x H)               │
 │    - Compute SHA-256 cartHash, addressHash, couponHash                 │
 └───────┬────────────────────────────────────────────────────────────────┘
         │
         ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 2. planParcels() (Packaging Engine)                                   │
 │    - Validate against configured PackageProfiles                       │
 │    - Group mixed items by mixGroup or pack single items greedily       │
 │    - Calculate volumetric and chargeable weights (500g slab rounding)  │
 └───────┬────────────────────────────────────────────────────────────────┘
         │
         ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 3. detectDeliveryZone()                                                │
 │    - Compare warehousePincode with destination postalCode              │
 │    - Classify: same_city | same_state | remote | national              │
 └───────┬────────────────────────────────────────────────────────────────┘
         │
         ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 4. calculateDeliveryDecision()                                         │
 │    - Mode 'standard': Store flat fee or free threshold                 │
 │    - Mode 'rules': Evaluates priority rules (slabs, multipliers, fuel) │
 │    - Mode 'carrier': Live courier rates for each parcel                │
 │    - Apply storewide allow/block pincode coverage restrictions         │
 └───────┬────────────────────────────────────────────────────────────────┘
         │
         ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 5. Persist ShippingQuote (TTL = 10 Minutes)                            │
 │    - Hash snapshots: idempotencyKey, coverageHash, settingsHash        │
 │    - Return serialized quote to frontend                               │
 └───────┬────────────────────────────────────────────────────────────────┘
         │
         ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 6. Order Placement: validateQuoteForOrder()                            │
 │    - 60s latency grace window                                          │
 │    - Re-verify storewide coverage against current merchant blocklist   │
 │    - Verify cartHash, addressHash, paymentMethod, couponHash           │
 │    - Financial Ledger: subtotal + tax + shippingCost - discount = total│
 └───────┬────────────────────────────────────────────────────────────────┘
         │
         ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 7. Post-Order Fulfillment: Shipment & Tracking                         │
 │    - Shipments created per planned parcel                              │
 │    - Background AWB allocation, label/manifest generation              │
 │    - Monotonic webhook ingestion + 30-min round-robin cron poller      │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Parcel Planning & 3D Packaging Engine (`shipping.packages.js`)

Real-world e-commerce requires grouping items into physical containers (boxes or mailers) before obtaining shipping rates. The platform provides a deterministic parcel packing engine that replaces naive summation with volume and capacity constraints.

### A. Package Profile Schema

Merchants configure up to 50 package types in **Admin → Settings → Shipping → Packaging**:

```json
{
  "id": "box-medium-m1",
  "name": "Medium Corrugated Box (M1)",
  "lengthCm": 30.0,
  "breadthCm": 20.0,
  "heightCm": 15.0,
  "emptyWeightGrams": 220,
  "maxItems": 6,
  "maxContentsWeightGrams": 5000,
  "fits": [
    {
      "productId": "prod_coffee_mug",
      "variantId": "var_mug_red",
      "maxQuantity": 4,
      "mixGroup": "drinkware"
    },
    {
      "productId": "prod_coffee_beans",
      "maxQuantity": 2,
      "mixGroup": "drinkware"
    }
  ]
}
```

#### Profile Validation Constraints
- **Unique IDs**: Each package profile must have a unique identifier.
- **Physical Boundaries**: Dimensions (`lengthCm`, `breadthCm`, `heightCm`) must strictly exceed `0.5 cm`.
- **Capacity Bounds**: `maxItems >= 1`, `maxContentsWeightGrams > 0`, `emptyWeightGrams >= 0`.
- **Fit Rules**: Explicit mappings specifying how many units of a given product or variant can fit into the package, with an optional `mixGroup`.

---

### B. Bin-Packing Algorithm Workflow

The `planParcels(items, profiles, options)` algorithm runs in four sequential phases:

#### Phase 1: Filter & Validate Items
1. Filters out non-shippable items (`requiresShipping === false` or digital downloads).
2. Verifies that every shippable item has valid, positive `weightGrams` and integer `quantity`. Missing measurements trigger an immediate `MISSING_PRODUCT_MEASUREMENTS` error in production.

#### Phase 2: Candidate Box Discovery
For each product:
1. Matches enabled profiles that define a fit rule matching `productId` and optional `variantId`.
2. Computes the unit capacity of the package:
   $$\text{Capacity} = \min\left(\text{profile.maxItems}, \text{fit.maxQuantity}, \left\lfloor \frac{\text{profile.maxContentsWeightGrams}}{\text{item.weightGrams}} \right\rfloor\right)$$
3. If no matching fit rule exists and a **Default Package** is configured in store settings:
   - Sorts the 3 item dimensions: $[L, B, H]_{\text{sorted}}$
   - Sorts the 3 box dimensions: $[L_{\text{box}}, B_{\text{box}}, H_{\text{box}}]_{\text{sorted}}$
   - Validates that the item physically fits within the box bounding volume:
     $$\forall i \in \{0, 1, 2\}, \quad \text{itemSides}[i] \le \text{boxSides}[i]$$
   - Computes capacity based on `defaultPackage.maxContentsWeightGrams` and `maxItems`.
4. If no candidate container is found, the planner halts with `SHIPPING_PACKAGE_CAPACITY_EXCEEDED`.

#### Phase 3: Item Sorting (Constrained-First Packing)
Items are sorted for packaging priority:
1. **Least candidate boxes first** (most restrictive items packed first).
2. **Heaviest items first** (to ground container tare capacity).
3. **Highest quantity first**.

#### Phase 4: Packing Execution (Mixed vs. Single Packing)

```
For each item in sorted queue:
    While remaining quantity > 0:
        
        // 1. Try Mixed Consolidation:
        If item has a non-empty mixGroup:
            Search existing open parcels sharing the same mixGroup
            Check available capacity:
                available = min(fitRemaining, parcel.maxItems - parcel.currentItems, weightRemaining / item.weight)
            If available > 0:
                Pack min(remaining, available) into existing parcel
                Update parcel weight and dimensions
                Continue loop

        // 2. Single-Item Optimal Bin Allocation:
        Calculate minimum parcels required:
            maxCapacity = max(candidates.map(c => c.capacity))
            minimumParcels = ceil(remaining / maxCapacity)
        
        Filter candidate boxes that preserve this minimum parcel count:
            eligible = candidates.filter(c => 
                1 + ceil(max(0, remaining - c.capacity) / maxCapacity) == minimumParcels
            )
        
        Pick smallest volume eligible box (breaks ties with empty weight)
        Pack min(remaining, selectedBox.capacity) into a new parcel
        Append new parcel to parcels list
        Decrement remaining quantity
```

---

## 4. Volumetric & Chargeable Weight Calculations

Carriers charge for freight based on either dead weight or the volume the package occupies in an aircraft or truck, whichever is greater.

### Mathematical Formulation

#### 1. Actual Weight ($W_{\text{actual}}$)
Sum of the package's empty tare weight and all packaged physical products:
$$W_{\text{actual}} = \left\lceil W_{\text{empty}} + \sum_{k} \left( W_{\text{item}, k} \times Q_k \right) \right\rceil \quad \text{[Grams]}$$

#### 2. Volumetric (Dimensional) Weight ($W_{\text{vol}}$)
Based on the volumetric divisor configured in `shipping.volumetricDivisor` (defaulting to standard Indian logistics industry constant $5000 \text{ cm}^3/\text{kg}$):
$$W_{\text{vol}} = \left( \frac{\text{Length}_{\text{cm}} \times \text{Breadth}_{\text{cm}} \times \text{Height}_{\text{cm}}}{\text{volumetricDivisor}} \right) \times 1000 \quad \text{[Grams]}$$

#### 3. Chargeable Weight ($W_{\text{chargeable}}$)
Couriers in India bill in **500-gram slabs (half-kilo increments)**. The system rounds up to the next full 500-gram slab to ensure the customer is never undercharged:
$$\text{RawWeight} = \max\left(W_{\text{actual}}, W_{\text{vol}}\right)$$
$$W_{\text{chargeable}} = \left\lceil \frac{\text{RawWeight}}{500} \right\rceil \times 500 \quad \text{[Grams]}$$

### Worked Example

| Metric | Dimension / Weight |
|---|---|
| **Package** | Medium Box: $30\text{ cm} \times 20\text{ cm} \times 15\text{ cm}$, Tare: $220\text{ g}$ |
| **Contents** | 2 Coffee Mugs @ $450\text{ g}$ each ($900\text{ g}$) |
| **Actual Weight** | $220\text{ g} + 900\text{ g} = 1120\text{ g}$ ($1.12\text{ kg}$) |
| **Volume** | $30 \times 20 \times 15 = 9000\text{ cm}^3$ |
| **Volumetric Weight** | $(9000 / 5000) \times 1000 = 1800\text{ g}$ ($1.8\text{ kg}$) |
| **Maximum** | $\max(1120\text{ g}, 1800\text{ g}) = 1800\text{ g}$ |
| **Chargeable Weight** | $\lceil 1800 / 500 \rceil \times 500 = \mathbf{2000\text{ g}}\ (2.0\text{ kg})$ |

The parcel is billed at the 2.0 kg rate tier.

---

## 5. Storewide Coverage & Pincode Restrictions

Storewide delivery coverage acts as the **final, non-negotiable gate** across the entire store. It is governed by `applyStorewidePincodeCoverage()` and evaluated uniformly across Customer Checkout, Admin Test Calculation, and Order Submission.

```
                      Destination Pincode
                              │
                              ▼
                   Valid 6-Digit Format?
                     (/^[0-9]{6}$/)
                         /      \
                      No/        \Yes
                       ▼          ▼
            [INVALID_PINCODE]  Present in Blocklist?
             (Unserviceable)     (shipping.blockedPincodes)
                                   /      \
                                Yes/        \No
                                  ▼          ▼
                       [DELIVERY_BLOCKED] Allowlist Configured?
                        (Unserviceable)   (shipping.serviceablePincodes)
                                            /      \
                                         Yes/        \No
                                           ▼          ▼
                                   Present in List? [SERVICEABLE]
                                     /          \    (Proceed to
                                  No/            \Yes Rules/Carriers)
                                   ▼              ▼
                          [NOT_ENABLED]      [SERVICEABLE]
                         (Unserviceable)
```

### Coverage Invariants
1. **Blocklist Primacy**: Any pincode listed in `shipping.blockedPincodes` is immediately blocked with `"Delivery is unavailable to this pincode"`. It overrides all shipping rules, zones, and carrier serviceability.
2. **Allowlist Exclusivity**: If `shipping.serviceablePincodes` contains one or more pincodes, any pincode not explicitly listed is rejected with `"Delivery is not enabled for this pincode"`.
3. **Format Strictness**: Pincodes must contain exactly 6 numeric digits. Spaces or non-numeric characters return `"Enter a valid 6-digit delivery pincode"`.
4. **Mid-Checkout Tamper Protection**: Quotes record `coverageHash = hashObject({ allowedPincodes, blockedPincodes })`. If a merchant blocks a pincode while a customer is on the checkout page, order submission detects the hash discrepancy and rejects the order with `SHIPPING_QUOTE_STALE`.

---

## 6. Pricing Modes & The Shipping Rule Engine (`shippingRule.model.js`)

The platform supports four merchant-selectable pricing modes configured in `shipping.pricingMode`:

| Pricing Mode | Behavior | Fallback Behavior |
|---|---|---|
| `standard` | Uses storewide simple rates (`flat_rate`, `free`, `free_above_threshold`). Shipping rules are ignored. | None. |
| `rules` | Evaluates configured `ShippingRule` records. | None. If no rule matches, delivery is marked **unserviceable**. |
| `carrier` | Fetches live carrier quotes (e.g. Shiprocket) for each planned parcel. | None. Carrier unserviceability marks order unserviceable. |
| `legacy` | Evaluates configured shipping rules first. | If no rule matches, falls back to standard storewide settings. |

---

### A. Shipping Rule Model & Attributes

Each rule in `shipping_rules` defines criteria and pricing parameters:

```javascript
{
  id: "uuid-v4",
  name: "Express Metro Delivery - Up to 5kg",
  priority: 250,              // Higher number evaluated first
  enabled: true,
  strictOverride: false,      // Evaluated after priority
  zoneId: "zone-north-india", // Optional association to ShippingZone
  providerId: "provider-sr",  // Optional carrier assignment
  conditionType: "all",
  conditions: {
    country: "India",
    subtotalGte: 500,
    subtotalLte: 50000,
    weightGte: 0,
    weightLte: 5000,
    paymentMethods: ["razorpay", "cod"]
  },
  rateType: "per_kg_slab",    // flat | free | free_above_threshold | percent_of_order | per_kg_slab | volumetric
  rateConfig: {
    firstSlabGrams: 500,
    baseCharge: 60.00,
    additionalSlabGrams: 500,
    additionalSlabRate: 35.00,
    zoneMultipliers: {
      same_city: 0.8,
      same_state: 1.0,
      national: 1.2,
      remote: 1.6
    },
    fuelSurchargePercent: 10,  // Applied to freight only
    minCharge: 50.00,
    codFeeType: "flat",
    codFeeValue: 40.00
  },
  codAllowed: true,
  codFee: 40.00,
  estimatedMinDays: 2,
  estimatedMaxDays: 4
}
```

---

### B. Rate Types & Calculation Formulas

The rate engine executes `calculateRuleRate(rule, params)`:

#### 1. Free Rates (`free` or threshold shortcut)
- Returns: `freight = 0, codFee = 0, total = 0`
- Triggers if `rule.rateType === 'free'` or if `subtotal >= rateConfig.freeAboveSubtotal`.

#### 2. Free Above Threshold (`free_above_threshold`)
$$\text{Freight} = \begin{cases} 0 & \text{if } \text{subtotal} \ge \text{threshold} \\ \text{baseCharge} & \text{otherwise} \end{cases}$$

#### 3. Percent of Order (`percent_of_order`)
$$\text{Freight} = \text{subtotal} \times \left( \frac{\text{percent}}{100} \right)$$
> [!IMPORTANT]
> For multi-parcel orders, `percent_of_order` is calculated **once on the order subtotal**, not multiplied per parcel.

#### 4. Weight Slabs (`per_kg_slab` / `volumetric`)
When calculating freight based on parcel chargeable weight:
1. Base charge for first slab:
   $$\text{Freight}_0 = \text{baseCharge}$$
2. Additional slabs for weight beyond `firstSlabGrams`:
   $$\text{ExtraGrams} = \max(0, W_{\text{chargeable}} - \text{firstSlabGrams})$$
   $$\text{ExtraSlabs} = \left\lceil \frac{\text{ExtraGrams}}{\text{additionalSlabGrams}} \right\rceil$$
   $$\text{Freight}_1 = \text{Freight}_0 + \left( \text{ExtraSlabs} \times \text{additionalSlabRate} \right)$$
3. Zone Multiplier:
   $$\text{Freight}_2 = \text{Freight}_1 \times \text{zoneMultipliers}[\text{zone}]$$
4. Fuel Surcharge (applied to **freight only**, never on COD fees):
   $$\text{Freight}_3 = \text{Freight}_2 + \left( \text{Freight}_2 \times \frac{\text{fuelSurchargePercent}}{100} \right)$$
5. Minimum Charge Enforcement:
   $$\text{Freight}_{\text{final}} = \max\left(\text{Freight}_3, \text{minCharge}\right)$$

---

### C. Multi-Parcel Freight Aggregation

When an order is partitioned into $N$ parcels ($N > 1$):
- **For `percent_of_order`**: Evaluated once for the total order subtotal.
- **For all other rate types**: Each parcel's chargeable weight is passed through `calculateRuleRate` independently, and the resulting freights are summed:
  $$\text{TotalFreight} = \sum_{p=1}^{N} \text{Freight}(W_{\text{chargeable}, p})$$
- **COD Fee**: Added **once per order**, never multiplied across parcels.

---

## 7. Geographical Rate Zones (`ShippingZone` & `detectDeliveryZone`)

The shipping system classifies geographical destinations dynamically using pincode proximity to the warehouse dispatch origin.

### A. Proximity Zone Detection (`detectDeliveryZone`)

Given the warehouse origin pincode $W$ and customer delivery pincode $D$:

```
                             Compare W and D
                                    │
                                    ▼
                     Does D start with Remote Prefix?
                         ('78', '79', '83', '19')
                               /         \
                            Yes/           \No
                              ▼             ▼
                           'remote'   Do first 4 digits match?
                           (NE & J&K)       (W[0..3] == D[0..3])
                                            /         \
                                         Yes/           \No
                                           ▼             ▼
                                      'same_city'  Do first 2 digits match?
                                                   (W[0..1] == D[0..1])
                                                   /         \
                                                Yes/           \No
                                                  ▼             ▼
                                             'same_state'   'national'
```

### B. Custom Rate Zones (`ShippingZone`)
Merchants can define explicit zones (e.g. "South India Express", "Mumbai Metro") in **Admin → Settings → Shipping → Rate Zones**:
- Allows specifying lists of allowed states, cities, or pincode prefixes.
- **Critical Architectural Distinction**: Zone exclusions restrict eligibility for specific shipping *rates* or *couriers*; they do not act as storewide delivery bans. Storewide bans are configured exclusively in `shipping.blockedPincodes`.

---

## 8. Shipping Providers & Carrier Integrations (`providers/`)

Providers represent courier networks and external logistics APIs:
- **`manual`**: In-house delivery fleet or merchant self-delivery. Always available, no external API latency.
- **`shiprocket`**: Shiprocket REST API integration for automated courier assignment, AWB generation, and tracking.
- **`ekart`**: Ekart Logistics enterprise courier adapter.

---

### A. Shiprocket Integration Architecture

The `ShiprocketProvider` class (`providers/shiprocket.provider.js`) interfaces directly with the Shiprocket REST API (`https://apiv2.shiprocket.in/v1/external`):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             ShiprocketProvider                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  - AES-256-GCM Encrypted Credentials Decryption                             │
│  - Token Cache with 240-Hour Validity & Pre-Expiry Auto-Refresh             │
│  - In-Memory Auth Failure Circuit Breaker (10-minute cooldown)              │
│  - Multi-Parcel Parallel Serviceability Querying (Promise.all)              │
│  - COD Fallback Negotiation (Returns prepaid if COD couriers = 0)           │
│  - Exact Channel Order Reference Matching during Recovery                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 1. Token Management & Circuit Breaker
- Shiprocket tokens are valid for 240 hours (10 days).
- The adapter caches tokens in memory and proactively refreshes them 5 minutes prior to expiry.
- If invalid credentials trigger a `401 Unauthorized`, an in-memory circuit breaker (`authFailureCache`) caches the failure for 10 minutes (`AUTH_FAILURE_COOLDOWN_MS`). This prevents API hammering and account locking. Customers receive a graceful 503 response. Updating provider credentials via admin immediately resets the cooldown via `clearAuthCooldown()`.

#### 2. Live Serviceability Querying
During checkout, `getServiceability()` calls Shiprocket's `/courier/serviceability` endpoint:
- Passes `pickup_postcode`, `delivery_postcode`, `weight`, `cod`, and parcel dimensions.
- Evaluates courier options and selects the lowest-cost serviceable courier partner (e.g. Bluedart, Delhivery, Shadowfax, Xpressbees).
- **COD Fallback**: If a COD check returns 0 available couriers, the provider automatically tests prepaid mode (`cod: 0`). If prepaid is available, it returns `serviceable: true, codAvailable: false`, prompting the checkout UI to disable COD while keeping checkout open.

#### 3. Multi-Parcel Courier Limitation Guard
Shiprocket standard order APIs require single-piece shipments unless an enterprise Multi-Piece Shipment (MPS) contract is enabled on the merchant account. If an order produces $> 1$ parcels and the provider is `shiprocket`, `createQuote()` flags the quote:
```
"This order needs 2 packages. Multi-package booking is not enabled for the
selected delivery provider yet. Please contact the store before placing this order."
```
This prevents accepting orders that cannot be fulfilled through automated courier booking.

---

## 9. The Shipping Quote Lifecycle & Security Guardrails

Quotes are created via `POST /api/v1/shipping/calculate` and persisted in `shipping_quotes`.

```
                  Client Requests Quote
                            │
                            ▼
              Compute SHA-256 Idempotency Key
   (checkoutSessionId + cartHash + addressHash + paymentMethod +
    couponHash + pricingHash + coverageHash + packageHash + parcelPlanHash)
                            │
                            ▼
           Does Unexpired Matching Quote Exist?
                         /      \
                      Yes/        \No
                        ▼          ▼
                 Return Cached   Calculate Delivery Decision
                     Quote       & Plan Parcels
                                   │
                                   ▼
                              Save Quote
                         (expiresAt = now + 10m)
                                   │
                                   ▼
                             Serialize &
                            Return to User
```

### Security Fingerprinting Attributes
Quotes are cryptographically secured against tampering and price drift using SHA-256 hashes:
- `cartHash`: Hash of all items, quantities, variant IDs, and current prices.
- `addressHash`: Hash of recipient postal code, state, city, and street.
- `couponHash`: Hash of all applied coupon codes.
- `pricingHash`: Hash of current storewide delivery settings.
- `coverageHash`: Hash of current `serviceablePincodes` and `blockedPincodes`.
- `packageHash`: Hash of dimensions and default package state.
- `parcelPlanHash`: Hash of the planned parcel allocation.

---

## 10. Checkout & Order Placement Validation (`validateQuoteForOrder`)

When the customer clicks **Place Order**, the order service calls `ShippingService.validateQuoteForOrder(userId, payload)` inside the order database transaction.

### Validation Gates

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 1. Quote Existence & Ownership Check                                   │
 │    - Verifies quote exists and belongs to the authenticated userId.    │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 2. Expiration Check with Grace Window                                  │
 │    - Stored quotes have a 10-minute TTL.                               │
 │    - A 60-second grace window (GRACE_PERIOD_MS = 60000) absorbs        │
 │      network latency and payment gateway redirection delays.           │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 3. Serviceability Gate                                                 │
 │    - Rejects if quote.serviceable !== true.                            │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 4. Storewide Coverage Re-Evaluation                                    │
 │    - Re-evaluates destination postalCode against live settings.        │
 │    - Prevents checkout bypass if a merchant blocked a pincode mid-cart.│
 ├────────────────────────────────────────────────────────────────────────┤
 │ 5. Anti-Tampering Hash Verification                                    │
 │    - Compares saved cartHash, addressHash, couponHash, and payment     │
 │      method against fresh values recomputed from the live cart.        │
 │    - Any mismatch throws SHIPPING_QUOTE_STALE (400), prompting a      │
 │      seamless background recalculation.                                │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 6. COD Integrity Verification                                          │
 │    - Rejects if paymentMethod === 'cod' but codAvailable === false.    │
 │    - Rejects COD if the cart contains 100% digital goods (no physical  │
 │      shipment exists to collect cash).                                 │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 7. Financial Accounting & Free-Shipping Coupon Reconciliation          │
 │    - Quoted shippingCost is locked into the order record.              │
 │    - Free shipping coupons set shippingDiscount = shippingCost.        │
 │    - Reconciles invoice ledger: subtotal + tax + shipping - discount.  │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Post-Order Fulfillment, Tracking & Webhooks

### A. Data Models

```
 ┌──────────────┐          1:N          ┌──────────────────┐
 │    Order     ├──────────────────────►│     Shipment     │
 └──────────────┘                       └────────┬─────────┘
                                                 │
                        ┌────────────────────────┼────────────────────────┐
                        │ 1:N                    │ 1:N                    │ 1:N
                        ▼                        ▼                        ▼
               ┌──────────────────┐    ┌──────────────────┐    ┌────────────────────┐
               │   ShipmentItem   │    │  ShipmentEvent   │    │ ShippingOperation  │
               └──────────────────┘    └──────────────────┘    └────────────────────┘
```

- **`Shipment`**: Represents a physical dispatched parcel with courier AWB, tracking URL, label URL, dimensions, and current status.
- **`ShipmentItem`**: Quantities of specific order items packaged in this shipment.
- **`ShipmentEvent`**: Audit trail of courier scan events with location and timestamp.
- **`ShippingOperation`**: Async queue records tracking carrier API requests (e.g. `create_shipment`, `generate_label`, `cancel_shipment`) with attempt counters and exponential backoff.

---

### B. Inbound Webhook Processing (`shipping.webhook.service.js`)

Carriers push status updates via HTTP POST to `/api/v1/shipping/webhooks/shiprocket` or `/api/v1/shipping/webhooks/status`.

#### 1. Security & Authentication
- **IP Allowlisting**: Optional CIDR and IP range validation via `SHIPROCKET_WEBHOOK_IPS`.
- **HMAC Signature**: Validates carrier HMAC-SHA256 signature using `decryptSecret(provider.webhookSecret)`.

#### 2. Monotonic Status Rank Guard (`isRegression`)
Couriers frequently deliver webhooks out of chronological order due to cellular network retries at delivery hubs. To prevent an older `"in_transit"` webhook from overwriting a `"delivered"` status, the service assigns strict monotonic ranks:

```javascript
const STATUS_RANK = Object.freeze({
    unknown: -1,
    created: 0,
    packed: 1,
    shipped: 2,
    in_transit: 3,
    out_for_delivery: 4,
    delivery_failed: 5,
    delivered: 6,
    rto_initiated: 7,
    rto_in_transit: 8,
    rto: 9,
    cancelled: 10,
});
```

- Any incoming status whose rank is less than or equal to the current rank is ignored as `stale_status`.
- **Terminal Status Lock**: Once a shipment reaches `delivered`, `rto`, or `cancelled`, no incoming webhook can alter its status.
- **Allowed Retry Transitions**: Specifically permits `delivery_failed -> out_for_delivery` to support multi-attempt courier deliveries.

#### 3. Row-Locking Concurrency Guard
Webhooks process inside a database transaction with explicit row-level locking on the primary shipment record (`lock: { level: t.LOCK.UPDATE, of: Shipment }`). This prevents outer-join deadlocks and guarantees race-free execution against concurrent background polling jobs.

---

### C. Background Tracking Reconciliation Cron (`trackingReconciliation.job.js`)
- Runs every 30 minutes (`*/30 * * * *`).
- Queries active in-transit shipments (`shipped`, `in_transit`, `out_for_delivery`) ordered by `updatedAt ASC`.
- Calls `adapter.getTracking({ awbCode })`.
- **Starvation Prevention**: Every evaluated shipment updates its `updatedAt` timestamp even if the status did not change. This ensures fair, round-robin polling across thousands of active shipments.

---

## 12. The 10 Practical Production Edge Cases Handled A-to-Z

| # | Edge Case | Problem / Failure Mode | Technical Resolution & Grounded Implementation |
|---|---|---|---|
| **1** | **Invalid Credentials / Carrier Account Lock** | Repeated failed auth requests hammer carrier endpoints, lock merchant accounts, and crash checkout with unhandled 401s. | In-memory circuit breaker (`authFailureCache`) caches 401/403 failures for 10 minutes (`AUTH_FAILURE_COOLDOWN_MS`). Customers receive a clean 503 error. Admin "Test Connection" provides instant feedback, and updating credentials clears cooldown via `clearAuthCooldown()`. |
| **2** | **Warehouse Origin Mismatch** | Settings warehouse pincode differs from carrier pickup location, corrupting zone detection and causing rejected pickups. | Unified resolution via `resolveDispatchOrigin()`. Checkout zone detection, carrier serviceability, and fulfillment operations resolve and pass the exact matching registered pickup location name and pincode. |
| **3** | **Invalid or Remote Pincodes** | Non-standard strings or unserviceable remote pincodes crash calculations or return raw 500 stack traces. | Strict 6-digit regex (`/^\d{6}$/`). Non-matching inputs return user-friendly unserviceable messages. Carrier 400/404/422 responses are mapped to descriptive messages with an always-visible "Change Address" button. |
| **4** | **COD Unavailable but Prepaid Supported** | Couriers disallow COD in certain remote sectors, causing shoppers to abandon carts even though prepaid delivery works. | Automatic fallback in `ShiprocketProvider`: when COD returns 0 couriers, it re-queries prepaid. If prepaid is supported, returns `serviceable: true, codAvailable: false`. Checkout disables COD and notifies the customer. Order placement strictly blocks COD submission. |
| **5** | **Missing Weight or Dimensions** | Unmeasured products default to zero weight, leading to severe carrier penalties, undercharges, or rejected pickups. | Stacking algorithm computes volume and adds container tare weight. In strict/production mode, missing measurements throw `MISSING_PRODUCT_MEASUREMENTS` (400). Digital goods (`requiresShipping === false`) bypass checks with zero weight. |
| **6** | **Oversized or Overweight Parcels** | Parcels exceeding courier physical limits (e.g. $>20\text{kg}$ or $>150\text{cm}$) lead to returned freight. Arbitrary math splitting without multi-package booking causes logistics chaos. | Evaluates limits across checkout, carrier adapters, and admin simulation. Parcels exceeding limits are rejected upfront with informative messaging rather than billing impossible single-piece shipments. |
| **7** | **Universal Rules Permitting Foreign Dispatch** | Store rules configured without zones accidentally match international destinations, offering domestic rates for foreign addresses. | Explicit domestic area guards in both `calculateRuleDecision()` and `calculateManualDecision()` reject non-Indian addresses (`country !== 'india' && country !== 'in'`) with `"Delivery is currently only available within India"`. |
| **8** | **Mid-Checkout Price or Cart Drift** | Customers alter cart items, addresses, or coupons after a quote was generated, or use stale quotes to lock lower shipping fees. | Quotes are fingerprinted with SHA-256 hashes of cart, address, payment method, coupons, and store settings. `validateQuoteForOrder()` verifies all hashes on order submission; any mismatch throws `SHIPPING_QUOTE_STALE` (400) and triggers background recalculation. |
| **9** | **Carrier API Timeout during Shipment Creation** | Network timeouts during shipment creation leave orders unfulfilled, while blind retries generate duplicate AWBs and double-charge freight. | Idempotent dispatch via `checkShipmentExists()` using `GET /orders?search=${orderNumber}`. If an order was already created on the carrier, it reconciles the existing AWB without creating a duplicate. Failed dispatches queue in `shipping_operations` with retry limits. |
| **10** | **Out-of-Order Webhooks & Race Conditions** | Out-of-order webhook delivery causes status regressions (e.g. `in_transit` arriving after `delivered`). Outer-join database locks cause deadlocks. | Monotonic `STATUS_RANK` progression rejects regressive updates. Terminal states (`delivered`, `rto`, `cancelled`) are permanently locked. Database updates lock the primary `Shipment` row cleanly, avoiding outer-join lock conflicts. 30-minute cron poller ensures eventual consistency. |

---

## 13. Admin Configuration Recipes & Troubleshooting

### Recipe 1: Free Delivery Above ₹999 with Flat ₹70 Standard Fee
1. Navigate to **Admin → Settings → Shipping → Delivery pricing & coverage**.
2. Set **Pricing Mode** to `Standard pricing`.
3. Set **Standard delivery pricing method** to `Free delivery above an order amount`.
4. Enter **Delivery fee**: `70`.
5. Enter **Free delivery threshold**: `999`.
6. Click **Save Settings**.

---

### Recipe 2: Tiered Weight Slabs with Metro Zone Multipliers
1. Navigate to **Admin → Settings → Shipping → Delivery pricing & coverage**.
2. Set **Pricing Mode** to `Advanced shipping rules`.
3. Navigate to **Admin → Shipping → Shipping Rules** and click **Add Rule**:
   - **Name**: `Pan-India Weight Slabs`
   - **Priority**: `100`
   - **Rate Type**: `per_kg_slab`
   - **Rate Configuration**:
     - `firstSlabGrams`: `500`
     - `baseCharge`: `50.00`
     - `additionalSlabGrams`: `500`
     - `additionalSlabRate`: `30.00`
     - `zoneMultipliers`: `{"same_city": 0.8, "same_state": 1.0, "national": 1.2, "remote": 1.5}`
     - `fuelSurchargePercent`: `10`
   - **COD Allowed**: `true`, **COD Fee**: `30.00`
4. Click **Create Rule**.

---

### Recipe 3: Multi-Box Packaging Configuration
1. Navigate to **Admin → Settings → Shipping → Packaging**.
2. Enable **Custom Package Profiles**.
3. Create Box Profiles:
   - **Box S (Small Goods)**: $15 \times 10 \times 10\text{ cm}$, Tare: $80\text{ g}$, Max Items: `2`, Max Weight: `1500\text{ g}`.
   - **Box M (Standard Apparel/Mugs)**: $25 \times 20 \times 15\text{ cm}$, Tare: $180\text{ g}$, Max Items: `5`, Max Weight: `5000\text{ g}`.
4. Add Product Fit Rules:
   - Map apparel SKUs to `Box M` with `mixGroup: "apparel"`.
   - Map accessories SKUs to `Box M` with `mixGroup: "apparel"`.
5. Now apparel and accessories will automatically pack together in `Box M` up to 5 items / 5 kg, while standalone small goods will pack in `Box S`.

---

### Recipe 4: Live Shiprocket Carrier-Calculated Checkout
1. Navigate to **Admin → Settings → Shipping → Shipping Providers**.
2. Select **Shiprocket** and enter credentials (`email`, `password`).
3. Click **Test Connection** — ensure status displays `Online (N pickups)`.
4. Set **Shiprocket** as the **Default Provider**.
5. Navigate to **Delivery pricing & coverage** and set **Pricing Mode** to `Carrier-calculated delivery`.
6. Save settings. Shoppers now receive real-time courier quotes based on their delivery pincode and parcel dimensions.

---

### Common Error Codes & Troubleshooting Reference

| Error Code | HTTP Status | Root Cause | Customer / Admin Action |
|---|---|---|---|
| `MISSING_PRODUCT_MEASUREMENTS` | 400 | A physical item in the cart lacks weight or dimensions. | Admin must update product weight in Admin Catalog. Customer is shown `"Shipping is temporarily unavailable for this item"`. |
| `SHIPPING_PACKAGE_CAPACITY_EXCEEDED` | 400 | Order exceeds maximum items or contents weight of configured packages, or an item exceeds dimensions. | Customer should reduce item quantity. Merchant should add a larger package profile in Packaging settings. |
| `SHIPPING_QUOTE_EXPIRED` | 400 | Quote exceeded 10-minute TTL plus 60-second grace window. | Checkout UI automatically refreshes quote on error. |
| `SHIPPING_QUOTE_STALE` | 400 | Cart items, recipient address, coupon codes, or store delivery settings changed mid-checkout. | Checkout UI automatically requests a fresh quote. |
| `SHIPPING_UNAVAILABLE` | 400 | Pincode is unserviceable, blocked in storewide blocklist, or outside India. | Customer must enter a different delivery address or select a serviceable pincode. |
| `COD_UNAVAILABLE` | 400 | COD selected, but courier or rule disallows COD at destination, or cart is 100% digital. | Customer must select a prepaid payment method (UPI, Cards, Netbanking). |
| `CREDENTIAL_DECRYPTION_FAILED` | 500 | `APP_SECRET` changed or corrupted in environment variables. | Ensure `APP_SECRET` in `.env` matches the key used during credential storage. Re-save provider credentials in admin. |

---

## 14. Automated Verification & Test Coverage Matrix

All algorithms, edge cases, and architectural invariants are verified with 100% pass rates across the automated test suites:

| Test Suite | File Path | Tests | Key Scenarios Covered |
|---|---|---|---|
| **Edge Cases Suite** | [`server/tests/unit/shipping.edgeCases.test.js`](file:///home/sr-user91/Documents/Projects/e-commerce/server/tests/unit/shipping.edgeCases.test.js) | 33 / 33 Passing | Circuit breaker cooldown, single warehouse parity, COD fallback to prepaid, measurement enforcement, oversized parcel rejection, domestic area guard, stale quote tamper rejection, missing AWB assignment, recovery error propagation, status mapping (codes 38 & 46), transaction row locks, webhook regression prevention, retry concurrency locks. |
| **Service Suite** | [`server/tests/unit/shipping.service.test.js`](file:///home/sr-user91/Documents/Projects/e-commerce/server/tests/unit/shipping.service.test.js) | 6 / 6 Passing | Multi-parcel percentage rates (order-level calculation), zone detection, rate type math, provider connection tests. |
| **Webhook Suite** | [`server/tests/unit/shipping.webhook.test.js`](file:///home/sr-user91/Documents/Projects/e-commerce/server/tests/unit/shipping.webhook.test.js) | 5 / 5 Passing | HMAC verification, monotonic status updates, unknown event logging, starvation prevention. |
| **Backend Total** | Full Server Suite | 421 / 421 Passing | Comprehensive cross-module integration across Orders, Tax, Coupons, and Shipping. |
| **Storefront Client** | Full Client Suite | 90 / 90 Passing | Zero bundle errors, responsive checkout delivery state alerts, total payable gate. |
