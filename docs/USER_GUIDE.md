# User guide

A guide to using the Surya Baru Service Console day to day. No technical background needed —
for how the app is built, see [README.md](../README.md) and [docs/ARCHITECTURE.md](ARCHITECTURE.md)
instead.

## Getting started

Surya Baru runs on the shop's own computer(s) — it works with no internet connection. All prices
are shown in Indonesian Rupiah, and distances/volumes in kilometers and liters. The look of the app
(dark, amber accent) is fixed and not something you need to configure.

The core flow, the thing the app is built around:

> Customer arrives → look up their vehicle (or add a new one) → create a work order → assign a
> technician → add the services/parts done → complete the order & print the receipt → the parts
> used come off the shelf automatically → it all shows up in Reports.

If more than one device is set up in your shop (a tablet at the counter, a second PC), they all
show the same customers, vehicles, and — most importantly — the same stock count. See
**Settings → Multi-device sync** below for what that looks like day to day.

## Dashboard

The first thing you see: today's numbers at a glance (revenue, orders, appointments), which bays
are occupied, which technicians have a queue, low-stock items, and recent activity charts. It's a
summary — nothing here is edited directly; it just reflects what's happening in the rest of the app.

## Appointments

Book a customer in ahead of time: pick a vehicle (or a walk-in with no vehicle on file yet), a date
and time, and what kind of service. An appointment moves through statuses as the day goes —
scheduled → arrived → in progress → completed (or cancelled / no-show).

## Bays

A live board of every physical service bay: which one's free, which one's occupied and by which
work order and technician, and roughly when it'll be free. Useful for seeing shop capacity at a
glance without walking the floor.

## Work Orders — the main flow

This is where the actual transaction happens. For a script of what to actually say to a customer
at the counter — returning customer, new customer, fleet driver, and what's worth confirming versus
asking from scratch — see [docs/COUNTER_SOP.md](COUNTER_SOP.md).

1. **Start a new order.** Look up the customer or company by name/phone/plate — if they're new,
   add them right from the same screen rather than leaving the order.
2. **Pick the vehicle.** Existing vehicles for that customer/company show up automatically; add a
   new one if needed (make/model/year, plate, and its engine/transmission/gardan fluid specs — worth
   filling in once, since it saves re-asking every visit).
3. **Assign a technician** and record the odometer reading.
4. **Add line items** — parts from Inventory (this is what will deduct stock) and/or services from
   the price list (labor, which doesn't touch stock). Tag an oil/fluid change against the vehicle's
   service schedule so the next reminder is automatic.
5. **Complete the order.** This is the point stock actually leaves the shelf and the cost of goods
   is locked in for that sale — completing an order later than you started it doesn't change what
   it cost. Print or reprint the receipt any time after.

An order can also be cancelled or deleted — deleting a *completed* order puts its stock back.

## Service History

Every vehicle's past visits in one place — what was done, when, and at what odometer reading. This
is what the reminder system and "due for service" badges are built from.

## Customers & Companies

**Customers** are individuals. **Companies** are fleet/corporate accounts — a company can have
several **drivers** attached to it, and a work order for a fleet vehicle can note which driver
brought it in.

Both support search by name/phone, and show every vehicle and past order tied to that
customer/company right on their page.

## Vehicles

The full list of every vehicle in the system, searchable by plate, VIN, make/model, or owner. A
vehicle's page shows its full spec (engine, transmission, gardan/differential fluids) and its
service history — useful for looking something up without going through the owner first.

## Technicians

The list of shop staff who get assigned to work orders. A technician who's left can be marked
**inactive** instead of deleted — their name needs to stay on old work orders, so removing them
outright isn't offered while they're still referenced anywhere.

## Inventory

The parts the shop stocks — name, SKU, supplier code, category, cost/sell price, and current stock
level. A few things worth knowing:

- **SKU vs. supplier code**: the SKU is the shop's own code for an item; the **supplier code** is
  the code the supplier's price list gives it — for this shop, the "modal" code. Both are optional,
  and searching the product list (here and at the register) matches either, so a code read off a
  price list finds the product. Unlike the SKU, the supplier code is *not* required to be unique:
  the modal code encodes cost, so everything bought at the same price shares one.

- **Stock drops automatically** when a work order using that product is completed — you don't
  manually decrement it.
- **Low stock** is flagged with a badge once a product's quantity reaches its reorder point.
- **Oversold** (a red "Oversold" badge, quantity shown as negative) can happen on a multi-device
  setup if two devices both sold the last of something while one was briefly offline — both sales
  are real, so nothing gets silently dropped, but the count needs a human to reconcile it back to
  what's actually on the shelf. Use the **Reconcile** action on that product: type in the counted
  quantity and it corrects the total without erasing the sales history that caused it.
- **Adjust stock** lets you add stock (optionally recording the purchase as an expense in the same
  step) or remove it for reasons other than a sale (breakage, waste).
- **Price history** on a product shows what it's actually cost the shop to restock over time.

The **Services** tab alongside Inventory is the separate labor price list — services don't hold
stock, they're just what gets charged for a job.

## Suppliers

Vendor contact info — who you buy parts from. Mostly reference; linked from a product's purchase
history.

## Expenses

Manual expense entries — rent, utilities, payroll, and so on. An expense can optionally be linked
to a specific inventory product and quantity, which is exactly what happens automatically when you
record a stock purchase from the Inventory page — the two stay in sync either direction.

## Reports

Five views, switchable by tab: **Sales** (revenue over time), **P&L** (profit & loss — revenue
minus cost of goods and expenses), **Customers** (who's spending the most, repeat-visit patterns),
**Workers** (performance by technician), and **Inventory** (stock value, top products). Pick a date
range at the top; every tab respects it.

## Messages

Currently a placeholder for a future feature — not yet functional. Use **Reminders** below for
following up with customers today.

## Reminders

Vehicles that are due (or coming due) for a service, based on their schedule — sorted so the most
overdue show first. For each one you can copy a ready-made reminder message to send yourself, call
the customer directly, or jump straight into starting a work order for them.

## Settings

- **Shop information** — name, address, phone, tax rate, and the message printed at the bottom of
  every receipt.
- **Language** — switch the whole app between English and Indonesian at any time.
- **Service item types** and **product categories** — the shop's own taxonomy (what counts as
  "Oli Mesin," "Oli Mesin Diesel," etc.) — rename or add to these as your shop's own vocabulary needs it.
- **Data backup** — download a full backup file, or restore from one. Worth doing regularly,
  independent of whether multi-device sync is set up.
- **Multi-device sync** — if your shop has more than one device:
  - The status shown here (and in the sidebar) is one of: **Synced** (up to date), **Syncing…**,
    **Offline** (working locally, will catch up once reconnected), or **Password needed** (this
    device is pointed at a server that requires a password it doesn't have yet).
  - **This device holds the data** vs. **Use another device or server** — most shops just leave the
    main shop PC as "holds the data" and point tablets at it using the address shown here. If your
    shop has a dedicated always-on server, ask whoever set it up for its address and password and
    enter those under "Use another device or server" instead — see
    [docs/ubuntu-server.md](ubuntu-server.md) for the technical side of setting that server up.
  - **Force full resync** re-downloads this device's data fresh if something ever looks out of
    sync — safe to use any time, rarely actually needed.

## Profile

A simple placeholder for the person operating this device — not tied to shop data or accounts.
