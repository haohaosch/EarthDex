# EarthDex · 逢甲校園生態探索

免費、非營利的繁體中文生物探索與3×3卡牌教育遊戲。這是既有 React/Vite、Cloudflare D1/R2 專案的持續開發，保留原有相機、圖鑑、收藏、手機操作與 AI/PVP。第一個場域為逢甲校園；候選物種不等於實地調查確認。

## 執行與驗證

Node 24：

```sh
npm ci
npm run dev
npm test
npm run build
```

`npm run build` 產出 `dist/server/index.js` 自含前端的 Worker；既有 `.openai/hosting.json` 保留 `project_id`、DB D1、BUCKET R2。相機與定位需 HTTPS 或 localhost。`npm run check` 可單獨檢查 TypeScript。`.github/workflows/ci.yml` 執行單元/API測試及建置；不將尚未執行的CI稱為已通過。

真實外部來源檢查：`NODE_USE_ENV_PROXY=1 node --import tsx scripts/check-sources.ts`（Cloud Node需環境proxy；一般本機可省略前綴），證據在 `docs/evidence/live-sources.json`。獨立離線單元測試用錄製資料/明確標Mock，沒有冒充即時API。

真實 WASM：準備 Python Pillow/NumPy，`python scripts/download-vision-model.py` 後執行 `npm run test:wasm`。固定 MIT BioCLIP 模型約165MiB，權重與工作照片在忽略版控的 `.sites-runtime/models/`。此測試實際執行 ONNX Runtime Web 1.22.0 的 WASM provider，包含正常海龜、森林、灰圖、合成模糊/多動物、庫外象照片及答題後收集流程；是 Node 執行瀏覽器WASM，**不是手機或瀏覽器UI驗收**。

## 目前流程

1. 內建相機拍單張JPEG、預覽、重拍；可選擇授權GPS，也可略過。照片不送往第三方公民科學平台或推論服務。
2. 裝置端BioCLIP擷取512維特徵，伺服器排序前三候選。分數是相似度，不是正確率；低分/接近候選標不確定。目前只支援參考庫內的有限臺灣動物，不宣稱全球辨識。
3. 依最新指示**先不加入人工審核**。伺服器採用AI最高分物種，直接呈現該物種的收集問答；低分或相似候選提示不確定，可重拍或繼續目前問答。
4. 答對一題才原子儲存卡牌與解鎖；答錯可先學習再換題，重送不重複領卡。玩家送的物種ID不能改變伺服器已選物種或直接發卡。刪除觀察不會刪卡或重置已領照片指紋。
5. 同物種同 `official-2` 版能力完全一致，28點含方向及技能成本；只有已核對來源的生態標籤可選技能，資料不足中性。既有取得快照/ID保留，收藏可查看歷史能力；新對戰統一官方版，舊對局/重播保留當時快照。

## 校園、地圖與統計

頂部選單新增逢甲校園、觀察地圖與統計。12種校園候選由可維護JSON管理，無虛構校內調查證據；有來源確認的校內紀錄與AI遊戲解鎖分開呈現。一次解鎖會更新逢甲、臺灣、鳥類等重疊系列及徽章。物種詳情保留本地文字/照片授權，另從後端查GBIF、iNaturalist、TaiCOL的分類/英文名/對照/來源時間；未知保育資訊明示未知。

私人地圖用 Leaflet/OpenStreetMap，支援日期、物種、地區篩選及定位精度顯示。公開/指定好友投影只含約略位置；敏感物種無座標，照片仍私人。校園公開統計只計正式、主動公開、有來源確認且位置核對過的校內觀察；AI遊戲收集另有類群/日期/月統計，排除示範資料。觀察筆數不是動物個體或族群數量。

1km/7天的矛盾仍待規則決定；獨立模組可比較三種語義，**沒有啟用正式距離/時間領卡限制**。GPS不等於真實性證明。

## 對戰

雙方初始各5張持有卡，同種最多2張；3×3自由落牌、不可旋轉，一般較大值翻面，反捕食者改由較小值翻較大者，相等不翻。快照比較後同時處理抵抗/返手/翻面，集體行為與防禦性攻擊受最多3層技能連鎖限制。九格滿後控制數多者勝；沒有返手/替換時仍先手5張後手4張，有返手/替換時可超過9手，100手結算可平手。AI/PVP共用伺服器規則。對戰結束仍控制對方未知物種時，各答一題解鎖圖鑑，**絕不產生或轉移卡牌**。

舊official-1固定牌組/正常AI/交換位置的400局模擬先手勝率58.75%，保留作歷史資料；新版測試另存v2報告，不能將舊版數字當作新技能平衡證據。

## 部署與身份

沿用既有 Sites 身份與公開展示。匿名訪客使用 Secure/HttpOnly Cookie 隔離示範資料，正式檔案需登入；本機資料在 `.sites-runtime/`。正式部署需 DB/BUCKET 綁定。目前沒有人工審核或管理員設定需求；不要把私密runtime資料提交Git。獨立部署到非Sites Worker時，需自行接可信身分驗證，不能相信使用者自行送的身份header。

無SQL結構遷移，新增欄位為向後相容JSON；不直接批次覆寫正式玩家資料。部署前備份D1與R2，回復流程見下方文件。

## 技術文件

- [修改前稽核](docs/CURRENT_STATUS.md)、[交付狀態與TODO](docs/DELIVERY.md)
- [資料模型與API](docs/API_AND_DATA.md)、[外部來源](docs/BIODIVERSITY.md)
- [校園候選](docs/CAMPUS.md)、[AI辨識與問答政策](docs/REVIEW.md)、[模型來源](docs/MODEL.md)
- [GPS/分享/未決重複規則](docs/OBSERVATIONS.md)、[卡牌與對戰](docs/CARDS_AND_BATTLE.md)
- [相容/備份/回復](docs/MIGRATION.md)、[實作摘要](docs/IMPLEMENTATION.md)

原始草案 `docs/specification-v0.6.md` 留作歷史，不取代本次需求。這是可部署的校園展示持續開發版，尚未完成真實手機驗收、大規模營運或校園專業調查，不宣稱正式上線品質。

對戰現在會依伺服器結算播放出牌、技能加成、抵抗與翻面；戰場綠色數字含技能加成，問號/卡面基礎能力仍與實際加成分開。「減少動態效果」會直接顯示結果。逢甲候選清單改為深色且區分鎖定/解鎖。詳見 [對戰文件](docs/CARDS_AND_BATTLE.md)。

新版新對局使用 `ecology-0.2 / official-2`，包含集體行為、反捕食者防禦、防禦性攻擊、防禦機制、逃避、擬態、遷徙、掠食者八項技能。返手與替換可延長對局；達100手以目前控制格數判勝，可平手。對手手牌已在API真正遮蔽，掠食者情報限定本人且會隨來源失效；完整重播於結束後開放。既有對局與取得快照保留原規則/能力。完整規則、交互作用、來源與相容方式見 [八項生態技能](docs/ECOLOGY_SKILLS.md)。
