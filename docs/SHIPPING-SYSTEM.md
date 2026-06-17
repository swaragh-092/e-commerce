# Shipping System — A to Z Working Process

This document provides a comprehensive overview of the shipping engine, from product configuration to delivery tracking.

---

## 1. Core Architecture

The shipping system is built on three main pillars that work together to decide who delivers an order and how much the customer pays.

### A. Shipping Providers (The "Who")
These are the physical services that handle your packages.
- **API-Integrated (Shiprocket, Ekart):** Direct connections to external carriers for real-time rates and label generation.
- **Manual Delivery:** For local delivery or fixed-rate internal fulfillment.

### B. Shipping Zones (The "Where")
Geographical clusters defined by pincode prefixes.
- **Same City:** Local delivery (4-digit prefix match).
- **Same State:** Regional delivery (2-digit prefix match).
- **National:** Standard cross-country delivery.
- **Remote:** Hard-to-reach areas (e.g., North-East India, J&K).

### C. Shipping Rules (The "How")
The logic that connects Providers and Zones with Costs. Rules are evaluated by **Priority** (highest first).
- **Conditions:** Rules can match based on subtotal, weight, pincode, or payment method.
- **Rate Types:** Flat Rate, Per-Kg Slab (Standard Industry Model), % of Order, or Free Shipping.

---

## 2. The Volumetric Data Pipeline

### Step 1: Product Dimensions
Every product is defined by its physical footprint:
- Actual Weight (Grams)
- Length (cm)
- Breadth (cm)
- Height (cm)

### Step 2: The Stacking Model
When multiple items are in a cart, the system uses a **Vertical Stacking Model** instead of simply adding dimensions:
- **Footprint:** The largest item's Length and Breadth.
- **Height:** The sum of all items' Heights.
- **Total Volume:** `Max(L) × Max(B) × Sum(H)`.

### Step 3: Volumetric Calculation
The volume is converted to weight using the **Volumetric Divisor** (configured in Admin Settings, default `5000`).
- `Volumetric Weight = (Volume / Divisor) × 1000 [grams]`

### Step 4: Chargeable Weight
The carrier bills the higher of the two:
- `Chargeable Weight = Max(Actual Weight, Volumetric Weight)`

---

## 3. The Checkout Workflow

1.  **Address Entry:** Customer provides their pincode.
2.  **Quote Request:** The frontend requests a shipping quote.
3.  **Engine Evaluation:**
    - Detects the **Zone** based on the delivery pincode.
    - Calculates the **Chargeable Weight** (rounded UP to the nearest 500g slab).
    - Iterates through **Rules** by priority.
    - Applies the matched rule's **Rate Configuration** (Base Charge + Slab Charges + Zone Multiplier + Fuel Surcharge).
4.  **Quote Locking:** The system returns a "Shipping Quote" ID which locks the price for 10 minutes to prevent changes during payment.

---

## 4. Fulfillment & Tracking

### A. Shipment Creation
Once the order is placed, the Admin fulfills it in the dashboard:
1.  **Provider Call:** The system sends package details to the carrier (e.g., Shiprocket API).
2.  **Manifesting:** The carrier assigns a **Tracking ID (AWB)** and generates a **Shipping Label (PDF)**.
3.  **Persistence:** The Tracking ID and Label are saved to the `Shipments` table.

### B. Live Tracking (Webhooks)
The system remains in sync with the carrier automatically:
1.  **Status Updates:** The carrier sends "Webhooks" (HTTP notifications) when the status changes (e.g., *Out for Delivery*).
2.  **Order Sync:** The system updates the internal `Shipment` and `Order` status.
3.  **Customer Alerts:** Automatic notifications are triggered to keep the customer informed.

---

## 5. Admin Configuration Checklist

To ensure your shipping system is healthy, verify the following in the Admin Panel:

1.  **Warehouse Pincode:** Ensure `settings.shipping.warehousePincode` is accurate.
2.  **Volumetric Divisor:** Ensure this matches your carrier contract (Standard is `5000`).
3.  **Rule Priorities:** Ensure your "Free Shipping" rules have higher priority than "Standard" rules.
4.  **Serviceable Pincodes:** Use "Blocked Pincodes" in Zones to prevent orders from areas your carrier doesn't support.
5.  **COD Rules:** If a carrier doesn't support COD, ensure the "COD Allowed" flag is disabled for those rules.

---

## 6. Shipping Rule Configuration & JSON Conditions

This section explains how to configure rules in the Admin Panel and how to use the "Advanced Conditions" box for complex logic.

### A. Visual Configuration Fields

| Field | Description |
| :--- | :--- |
| **Priority** | A number (e.g., 100). If multiple rules match, the highest number wins. |
| **Slab Pricing** | Defines the "Step" logic. e.g., Base ₹40 for 500g + ₹30 per extra 500g. |
| **Min Charge** | The floor price. The shipping cost will never drop below this. |
| **Zone Multipliers** | Scales the base rate for different distances (e.g., National = 1.6x). |
| **COD Fee** | An extra flat or percentage charge applied only if the user picks Cash on Delivery. |

### B. Advanced JSON Conditions (The "Trigger" Box)

The **Conditions (JSON format)** box allows you to create highly targeted rules. If a rule's JSON condition doesn't match the customer's cart, the system skips it.

#### 1. Price Thresholds
- `subtotalGte`: Apply rule only if Order Value is Greater Than or Equal to X.
- `subtotalLte`: Apply rule only if Order Value is Less Than or Equal to X.
- **Example:** `{"subtotalGte": 1500}` (High-value shipping rule).

#### 2. Payment Filtering
- `paymentMethods`: Limit rule to specific methods (e.g., `["razorpay"]`, `["stripe"]`, `["cod"]`).
- **Example:** `{"paymentMethods": ["cod"]}` (A rule specifically for COD surcharges).

#### 3. Hyper-Local Targeting
- `pincodes`: A list of specific pincodes.
- `blockedPincodes`: Pincodes to exclude.
- `city` / `state` / `country`: Standard geographical strings.
- **Example:** `{"pincodes": ["560001-560010"], "state": "Karnataka"}`.

#### 4. Weight Filtering (Manual Override)
- `weightGte` / `weightLte`: Target specific weight brackets in grams.
- **Example:** `{"weightGte": 10000}` (Heavy-duty shipping rule for >10kg).

### C. Rule "Recipe" Examples

| Goal | JSON Condition |
| :--- | :--- |
| **Free Shipping over ₹999** | `{"subtotalGte": 999}` (Set Rate Type to 'Free') |
| **Bangalore Local Only** | `{"city": "Bangalore"}` |
| **Prepaid-Only Discount** | `{"paymentMethods": ["razorpay", "stripe"]}` |
| **Restrict specific Pincode** | `{"blockedPincodes": ["110001"]}` |

### D. Troubleshooting "Rules Not Matching"
If a rule isn't showing up at checkout, check these common causes:
1.  **Priority too low:** Another rule with higher priority is matching first.
2.  **Zone Mismatch:** The delivery pincode doesn't belong to the Zone assigned to the rule.
3.  **Weight Limit:** The `weightLte` condition in JSON is smaller than the calculated Volumetric weight.
4.  **Provider Support:** If you selected a "Specific Provider," ensure that provider supports the customer's pincode and payment method.

