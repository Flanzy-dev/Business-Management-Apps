# Counter SOP — what to ask when a customer arrives

A script for the counter, not the workshop floor: what to say, in what order, and which field on
screen each answer goes into. Every question here is written as the actual phrase to say in
Indonesian, with an English gloss underneath — say the Indonesian, use the English to understand
it.

This assumes you're starting a new order the normal way: **Ctrl+N**, or the **"New Work Order"**
button, which opens the New Order dialog described in
[the user guide's Work Orders section](USER_GUIDE.md#work-orders--the-main-flow).

---

## Scenario 1 — Returning customer (the common case)

Most cars that come through the gate have been here before. Lead with the plate, not the name —
it's what the customer has memorized, and it's a single lookup instead of three.

1. **"Nomor polisinya berapa, Pak/Bu?"**
   *(What's your plate number?)*
   Type it straight into **Quick Find** at the top of the New Order dialog — it matches plate, VIN,
   or owner name across every vehicle at once. Pick the result; owner and vehicle are both set in
   one tap. If Quick Find comes up empty, fall back to the owner-type → customer → vehicle pickers
   below it (a badly-worn plate, a partial number, or a typo the search couldn't stretch to).

2. **"Ini kendaraannya, ya?"** *(This is the vehicle, right?)*
   Confirm what's already on screen — make/model/plate — instead of asking again. If a due-service
   badge shows on the vehicle, that's Scenario 4, not something you need to ask about.

3. **"Km sekarang berapa?"** *(What's the odometer reading now?)*
   The **Odometer at Arrival** field prefills from the last reading on file — check it against what
   the customer says (or the dash) and overwrite it if it's different. Don't skip this: it's the
   number every "due for service" calculation downstream is built from.

4. **"Ada keluhan apa?"** *(Any complaints — noise, leak, anything?)*
   Goes straight into the **Complaint** field. A one-line answer is fine — "bunyi kasar dari depan",
   "oli rembes", or just "servis rutin" if there's nothing specific.

5. **Assign a technician** from the dropdown and create the order. Everything past this point is
   the checkout screen — see the user guide's Work Orders flow.

---

## Scenario 2 — New customer, new car

Only two things are required at the counter: **name** and **phone number**. Everything else
(address, email) is a later, optional fill-in from the Customers page — don't hold up the line for
it.

1. **"Belum pernah ke sini sebelumnya, ya?"** *(Haven't been here before, right?)*
   Pick **"+ Add new customer…"** from the owner dropdown. This opens right inside the same order
   dialog — you never leave the order you're building.

2. **"Nama dan nomor HP-nya?"** *(Name and phone number?)*
   Type them in, save — you land back in the order with this customer already selected as the
   owner, straight into the vehicle form (a brand-new customer never has a car on file yet, so this
   is always the next question).

3. **"Mobilnya apa — merek, model, tahun berapa?"** *(What's the car — make, model, what year?)*
   Fill in make/model/year, then the plate.

4. **"Km berapa sekarang?"** *(What's the current odometer?)*

5. **The fluid specs are worth asking once and never again**: oil type + capacity
   ("Oli yang dipakai apa, berapa liter?"), transmission fluid, gardan/differential fluid. Every
   later visit reuses whatever's filled in here — this is the one moment it's cheap to ask.

6. **"Mau ganti oli tiap berapa km?"** *(How often do you want to change your oil — every how many
   km?)* — see **Scenario 5** below; this is the same form, right below the fluid specs.

7. Save the vehicle — you're back in the order with owner *and* vehicle selected. Continue from
   step 3 of Scenario 1 (odometer at arrival, complaint, technician).

---

## Scenario 3 — Fleet vehicle / company driver

A company account can have several drivers; the work order should note which driver actually
brought the car in, even though the company is who gets billed.

1. **"Ini mobil dari perusahaan mana?"** *(Which company is this vehicle from?)*
   Switch the owner type to **Company/Fleet** and pick it from the dropdown. A brand-new company
   still goes through the existing "+ Add new company…" page — that round trip is unchanged.

2. **"Yang antar siapa?"** *(Who's dropping it off?)*
   Pick the driver from the **Driver (Optional)** dropdown — same round trip as adding a new
   company if the driver isn't listed yet.

3. Continue as Scenario 1 from the vehicle-confirm step onward. The driver is a record of *who
   showed up*, not *who pays* — don't confuse the two when talking to whoever's at the counter.

---

## Scenario 4 — Vehicle already due, or arriving from Reminders/Appointments

If you opened this order from the **Reminders** page, an **Appointments** slot, or Global Search
(Ctrl+K) already showed a due badge, the screen is already telling you things — read them back to
the customer instead of asking:

- **Due status badge** (overdue / due soon) — what's due and by how much.
- **Last service date and odometer** — when they were last in, and at what reading.
- **Oil type on file** — what was used last time, so you're not guessing at a match.

**"Sesuai catatan kami, [oli mesin] Bapak/Ibu sudah waktunya diganti — betul?"**
*(Our records show your [engine oil] is due for a change — is that right?)* is a confirmation, not
a question you need an answer to before proceeding.

---

## Scenario 5 — Customer names their own interval

Some customers have a habit from a previous shop, a manufacturer recommendation, or just a
preference — every 3,000 km instead of the shop's usual 5,000. That's a fact worth recording once,
not re-asking every visit.

**"Mau ganti oli tiap berapa km?"** *(How often do you want to change your oil — every how many
km?)*

- **New car, at registration** — the natural moment to ask. On the Add Vehicle form, pick
  **"Customer's Interval"** instead of Workshop Default, type the km. Every other fluid
  (transmission, gardan, brake) still follows the shop's own schedule — this only ever overrides
  engine oil.
- **Returning customer, changing their mind** — at checkout, on the tagged oil line ("Tag as
  service item"), there's a requested-interval field next to the liters/action controls. Only shows
  when the action is **Changed** — a top-up can't move a schedule, so there's nothing to set there.
- **The reverse question** — "berapa km lagi saya harus balik?" *(how many more km until I need to
  come back?)* — is printed on the receipt's **Next due** line once the order completes. Read it
  off the receipt rather than doing the math out loud.

---

## At checkout

Once the order is open and items are being added:

- **Odometer at Service** — confirm or correct the arrival reading if the car moved between
  drop-off and now (rare, but it happens with a queue).
- **Changed vs. topped up** — was the fluid fully replaced, or just topped off? This decides
  whether the service schedule moves at all.
- **Customer's requested interval** — see Scenario 5, same tagged-line field.
- **Payment method** — cash, QRIS, card, or check, asked once the ticket is settled.

---

## Do not ask this — the screen already knows

The single biggest time-save at the counter is *not* re-asking what's already on file:

| Don't ask... | ...it's already shown here |
|---|---|
| "Kapan terakhir servis?" (when was the last service?) | Vehicle's service history / GlobalSearch's "Last: {date}" |
| "Oli apa yang dipakai kemarin?" (what oil was used last time?) | The oil-type line under a vehicle result in Quick Find / Global Search |
| "Km berapa waktu itu?" (what was the odometer then?) | "Last known: {km}" hint under the Odometer at Arrival field |
| "Sudah waktunya ganti oli belum?" (is it due for an oil change?) | Due-status badge (overdue / due soon), on the vehicle row and in search |
| "Nomor rangka/VIN-nya apa?" (what's the VIN?) — for a known car | Already on file; only ask for a car new to the system |

---

## Field map — question to store field

| Question | Where it's typed | What it becomes |
|---|---|---|
| Plate / VIN / name (Quick Find) | New Order dialog's Quick Find box | Selects an existing `Vehicle` + owner |
| Name, phone | Inline "Add New Customer" step | `Customer.name`, `Customer.phone` |
| Make/model/year, plate, fluids | Inline vehicle form | `Vehicle.make/model/year/licensePlate/oilTypeRequired/...` |
| "How many km for oil changes?" | Add Vehicle form's *Customer's Interval*, or the checkout tagged line | `ScheduleRule.intervalKm` with `source: 'customer_request'` |
| Current odometer | New Order dialog's **Odometer at Arrival** | `WorkOrder.odometerAtArrival` |
| Complaint | New Order dialog's **Complaint** field | `WorkOrder.notes` |
| Company / driver | Owner-type radio + Driver dropdown | `WorkOrder.vehicleId` (via company vehicle) + `WorkOrder.driverId` |
| Odometer at handover | Checkout ticket's **Odometer at Service** | `WorkOrder.odometerAtService` |
| Changed vs. topped up | Tagged line's action select | `WorkOrderItem.serviceAction` |
| Payment method | Charge dialog | `WorkOrder.paymentMethod` |
