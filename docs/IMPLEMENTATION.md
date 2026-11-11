# EarthDex 持續開發實作

本次需求取代早期「永遠第一名、無審核、隨機實例」政策。React 19/Vite、D1/R2、BioCLIP與共享戰鬥引擎保留。基準main `2008db9`，功能分支 `feat/feng-chia-ecology`。

## 模組

- `server/biodiversity.ts`：三來源查詢/保守學名階層匹配/來源版本/24h cache/30d離線降級/逾時與限速；R2 cache另名空間，無任意URL代理。英文與分類由外部資料取得，生態/保育缺值不造資料。
- `data/campus-species.json`, `engine/campus.ts`, `src/campus-page.tsx`：12個都市校園候選，有校內證據才列確認；與自己或正式公開的經審核校內觀察分層呈現。共用既有解鎖/系列徽章。
- `engine/recognition/rank.ts`, `server/review.ts`, `src/review-page.tsx`：低可信候選標uncertain，所有新照片需review confirmation才能取field quiz。審核員由server環境allowlist；決定、狀態與歷史一次CAS寫回。缺審核員不假裝已送出。
- `engine/observation-policy.ts`, `server/observations.ts`, `src/ecology-page.tsx`：選用私人GPS、異常旗標、Leaflet地圖/篩選、約略分享投影、排除demo的正式公開校園統計；未決重複領卡規則完全停用。
- `engine/official-cards.ts`, `data/card-balance-v1.json`：同物種同版固定能力。新牌與新AI/PVP都用manifest；既有取得快照不變，API投影新版並可查看原版；active/initial/replay不重算。等待舊版房間拒絕混版加入。
- `server/api.ts`, `field.ts`, `model.ts`：維持profile/match分別CAS，原子領卡/解鎖；私照存R2且按身份隔離，照片指紋防同檔重領。對戰只給圖鑑問答資格。

## 資料生命週期

沒有DDL或破壞性批次migration。可選JSON欄位是新增、缺省私人/未確認。舊卡、grant、取得時間、balanceHistory、戰報全部保留。刪觀察會刪GPS與照片引用，發卡指紋保存在實例，防止刪後重領；不同照片仍需獨立確認。R2與D1沒有跨儲存交易，需維運補孤立物件清理與備份驗證。

## 驗證界線

單元/API測試、TypeScript、Worker建置、真實三來源API、真實Node/WASM模型與多情境發卡門檻均已執行，證據見DELIVERY與docs/evidence。瀏覽器工具啟動失敗，managed preview relay 4173超時；沒有通過實際手機相機/GPS/UI或真實雙手機PVP驗收。現有手勢/拖曳測試保留，但不能代替裝置QA。
