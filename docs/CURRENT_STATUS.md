# EarthDex 現況稽核

基準：`main` / `2008db9`。2026-11-11；本文件的「基準」描述修改前，後續完成狀態見 `DELIVERY.md`。

|分類|基準功能與證據|
|---|---|
|已實作|React 19/Vite、手機導覽、相機 JPEG 拍攝、重拍；`src/main.tsx`, `src/recognizer.ts`。|
|已實作|BioCLIP 裝置端 WASM + 512 維參考庫排序、來源/授權；`engine/recognition/rank.ts`, `reference-bank.json`, `docs/MODEL.md`。非全球模型。|
|已實作|D1 profiles/matches JSON aggregate、R2 私人照片、CAS 寫入與所有權驗證；`server/api.ts`, `schema.ts`, `visitor.ts`。|
|已實作|答錯換題、照片 SHA256 去重、領卡冪等、對戰只解鎖問答；`server/field.ts`, `model.ts`, `tests/api.test.ts`。|
|已實作|共享 AI/PVP 3×3 引擎、5 張持有牌、同種至多2張、快照翻轉/抵抗/3層連鎖/重播；`engine/engine.ts`, `tests/engine.test.ts`。|
|部分實作|82 筆本地遊戲分類單元（包含亞種），中文/學名/棲地、Wikimedia 圖片授權；`engine/species.ts`, `taiwan-data.json`, `src/media.json`。沒有外部 taxon 對照、正式分類同步與保育來源。|
|部分實作|辨識有候選與 lowConfidence，但**全部採第一名**且答題即可發卡，與新需求衝突；`rank.ts`, `api.ts`, `field.ts`。森林與灰圖也被強制分類。|
|部分實作|生成有預算、技能標籤，但新領卡使用 crypto 隨機種子；讀取時會修補平坦舊卡。與同種固定版本需求衝突；`model.ts`, `engine.ts`。|
|部分實作|圖鑑系列、收藏與徽章；`species.ts`, `main.tsx`。目前展示檔案7張卡/7筆觀察是 fixture，不是校園調查。|
|未實作|GBIF/iNaturalist/TaiCOL API、快取、速率/逾時/同物異名不確定處理。|
|未實作|逢甲候選清單、校園確認證據、地區/類群多系列。|
|未實作|GPS 授權/儲存、私人地圖、校園統計、好友分享權限。`distanceKm` 只有純函式。|
|未實作|可用人工審核流程；雖有歷史 status 字串，公開 profile 會改顯示 saved；沒有申請/決定端點。|
|未實作|1 km/7天正式重複領卡政策；需求本身尚待定義，不應擅自啟用。|
|測試未通過|無基準單元測試失敗：`npm test` 59/59、`npm run build` 成功。實際手機相機與本環境瀏覽器/WASM 尚未於稽核時重測；舊 JSON 報告不視為此次證據。|

## 資料與部署

- SQL 結構：`drizzle/0000_messy_sabra.sql`（正式）、`migrations/0000_initial.sql`（歷史副本）。沒有其他關聯物種表。
- 原始 `README.md`/`IMPLEMENTATION.md` 較新的文字要求即時第一名/隨機卡；本次使用者需求明確取代該政策。
- 本機 clone 沒有正式資料；不對遠端 DB 執行遷移或清除。新增 profile JSON 欄位需向後相容，既有卡牌/對局快照保留。
- `.openai/hosting.json` 有既有 Sites ID；不建立替代網站。部署需要既有服務的寫入/部署能力，最終報告需區分本機驗證與正式部署。
