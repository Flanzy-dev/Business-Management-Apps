---
type: community
members: 14
---

# Order Lifecycle & Completion

**Members:** 14 nodes

## Members
- [[CompleteOrderResult]] - code - src/lib/ops/orderOps.ts
- [[CompletionResult]] - code - src/lib/orderLifecycle.ts
- [[StockAdjustment]] - code - src/lib/orderLifecycle.ts
- [[WorkOrderItem]] - code - src/store/workOrderStore.ts
- [[applyCompletion()]] - code - src/lib/orderLifecycle.ts
- [[completeOrder()]] - code - src/lib/ops/orderOps.ts
- [[deleteOrder()]] - code - src/lib/ops/orderOps.ts
- [[deletionStockRestorations()]] - code - src/lib/orderLifecycle.ts
- [[item()_2]] - code - src/lib/__tests__/orderLifecycle.test.ts
- [[order()_2]] - code - src/lib/__tests__/orderLifecycle.test.ts
- [[orderLifecycle.test.ts]] - code - src/lib/__tests__/orderLifecycle.test.ts
- [[orderLifecycle.ts]] - code - src/lib/orderLifecycle.ts
- [[orderOps.ts]] - code - src/lib/ops/orderOps.ts
- [[stockDeltas()]] - code - src/lib/orderLifecycle.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Order_Lifecycle__Completion
SORT file.name ASC
```

## Connections to other communities
- 10 edges to [[_COMMUNITY_Work Orders, Receipt & Search]]
- 6 edges to [[_COMMUNITY_Deletion Policy & Entity Ops]]
- 1 edge to [[_COMMUNITY_Reports & P&L Charts]]

## Top bridge nodes
- [[orderOps.ts]] - degree 12, connects to 2 communities
- [[orderLifecycle.ts]] - degree 10, connects to 2 communities
- [[orderLifecycle.test.ts]] - degree 8, connects to 2 communities
- [[WorkOrderItem]] - degree 5, connects to 2 communities
- [[completeOrder()]] - degree 4, connects to 1 community