---
source_file: "src/lib/orderLifecycle.ts"
type: "code"
community: "Order Lifecycle & Completion"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/Order_Lifecycle__Completion
---

# orderLifecycle.ts

## Connections
- [[CompletionResult]] - `contains` [EXTRACTED]
- [[StockAdjustment]] - `contains` [EXTRACTED]
- [[WorkOrder]] - `imports` [EXTRACTED]
- [[WorkOrderItem]] - `imports` [EXTRACTED]
- [[applyCompletion()]] - `contains` [EXTRACTED]
- [[deletionStockRestorations()]] - `contains` [EXTRACTED]
- [[orderLifecycle.test.ts]] - `imports_from` [EXTRACTED]
- [[orderOps.ts]] - `imports_from` [EXTRACTED]
- [[stockDeltas()]] - `contains` [EXTRACTED]
- [[workOrderStore.ts]] - `imports_from` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/Order_Lifecycle__Completion