---
type: community
members: 11
---

# Persistence & Backup

**Members:** 11 nodes

## Members
- [[PERSISTED_STORES]] - code - src/lib/persistence.ts
- [[Settings]] - code - src/store/settingsStore.ts
- [[Settings()]] - code - src/pages/Settings.tsx
- [[SettingsStore]] - code - src/store/settingsStore.ts
- [[applyBackup()]] - code - src/lib/persistence.ts
- [[clearAllData()]] - code - src/lib/persistence.ts
- [[collectBackup()]] - code - src/lib/persistence.ts
- [[defaultSettings]] - code - src/store/settingsStore.ts
- [[persistence.ts]] - code - src/lib/persistence.ts
- [[settingsStore.ts]] - code - src/store/settingsStore.ts
- [[useSettingsStore]] - code - src/store/settingsStore.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Persistence__Backup
SORT file.name ASC
```

## Connections to other communities
- 7 edges to [[_COMMUNITY_Cards, Profile & Settings]]
- 3 edges to [[_COMMUNITY_Work Orders, Receipt & Search]]
- 1 edge to [[_COMMUNITY_App Shell & Entity Pages]]

## Top bridge nodes
- [[Settings()]] - degree 6, connects to 2 communities
- [[settingsStore.ts]] - degree 6, connects to 2 communities
- [[useSettingsStore]] - degree 5, connects to 2 communities
- [[persistence.ts]] - degree 5, connects to 1 community
- [[collectBackup()]] - degree 3, connects to 1 community