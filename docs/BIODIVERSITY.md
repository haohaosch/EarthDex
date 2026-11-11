# 物種資料與外部來源

`server/biodiversity.ts`：穩定的 EarthDex ID 保留既有 catalog ID，未來不依中文名稱或上游名稱改動。kingdom、rank、分類欄位為通用字串，能支援植物與真菌；實際相機仍限目前動物參考庫。

- `GET /api/species/:id`：中文/英文（有資料時）/學名、分類、外部對照、來源與警告。
- `GET /api/species/:id/occurrences`：目前提供逢甲周邊研究視窗的公開研究等級 iNaturalist 與 GBIF 紀錄。不是玩家成果，也不自動列為校內確認證據。
- `node --import tsx scripts/check-sources.ts`：真實整合驗證；Cloud Node 請加 `NODE_USE_ENV_PROXY=1`。結果存 `docs/evidence/live-sources.json`。三個原始成功回應另存 `gbif.json`/`inat.json`/`taicol.json`，測試會從這些錄製回應驗證轉換；使用 stub 的測試名稱均標 Mock。

GBIF strict exact + canonicalName + rank + confidence≥95 才接受；同物異名保留原 key 與 accepted key，等待接受名複核，不直接對照。iNaturalist 須唯一、有效、同學名與階層；TaiCOL 須唯一 accepted、同學名與階層。不同來源 kingdom 衝突停止對照；中文名從不作 join key。分類拆分、歷史別名的自動遷移仍待審核。

快取：同 worker isolate 記憶體最多300筆，R2 `biodiversity/v1/` 持久化，24小時新鮮、離線最多30天舊資料且標 stale。單 isolate 請求串行且間隔1.1秒，8秒 AbortController，2MB回應上限，429延後且不自動重試。多 isolate 的全域限速需未來集中排程/DO；目前固定82個 catalog ID，不能任意代理 URL。無上游時回本地物種與明確 unknown，不造資料。API版本與檢索時間保留，TaiCOL原始 updated_at 保存在快取中；上游不提供可固定全域資料版本時不虛構版本。

照片目前不自動置換圖鑑封面；原 Wikimedia author/license/source 保留。外部觀察只有明確 CC0/CC BY/CC BY-SA 的照片才回傳引用（不複製照片）。非授權照片與敏感/模糊座標不輸出。保育等級目前 unknown，不能從名錄缺值推導安全狀態。原有描述是百科來源的遊戲內容，尚非專業校園調查。
