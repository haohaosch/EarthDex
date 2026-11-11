# API 與資料結構

所有API沿用可信Sites身份、同源寫入保護、private/no-store與Cookie隔離；正式/示範 profile 分開。未授權資料不出現在一般列表。圖片上傳上限10MiB，JSON請求上限10000字元。

|路徑|用途/驗證|
|---|---|
|GET /api/session|登入/訪客狀態與自己的分享帳號ID；不列其他帳號|
|GET /api/profile?profile=demo或real|自己的profile；正式需登入；回新版能力與原取得快照|
|POST /api/deck|5張自己持有的不同實例、每種至多2|
|GET /api/species/:id|本地穩定ID的三來源整合資料，保守分類對照|
|GET /api/species/:id/occurrences|固定逢甲周邊探索區的外部公開觀察；不算玩家紀錄|
|POST /api/observations|相機照片；x-earthdex-features=2048byte Float32 base64；可選x-earthdex-location JSON。伺服器重排候選/驗檔案/指紋，初始identified（AI遊戲候選）|
|GET /api/observations/:id/media|自己的私人照片/舊影片|
|DELETE /api/observations/:id|刪自己的觀察、GPS與影像，保留卡牌/取得快照/照片領取指紋|
|POST /api/observations/:id/review或appeal|已停用人工流程，回410；無管理員API|
|GET /api/field-quiz?observation=…|伺服器AI已選物種，直接出題；不回正確答案|
|POST /api/collect|observationId/choice/attempt；伺服器比對紀錄與題目版本驗證；同profile一次CAS寫 observation+card+unlock+badges；冪等|
|POST /api/observations/:id/privacy|自己的private/public/friends與明確身份allowlist|
|GET /api/observation-map|自己的精確位置；from/to/species/region篩選及個人統計|
|GET /api/shared?owner=…|僅公開或授權好友投影；一般物種約略座標、敏感物種null、無私照|
|GET /api/campus/stats|正式+public+有來源確認+校內位置核對才聚合；不包括示範/私人/好友|
|POST /api/matches|合法持有牌組、新AI/PVP官方一致能力；存initial/state快照|
|POST /api/matches/:id/join|另一身份、房間未滿、官方平衡版本相符|
|POST /api/matches/:id/move|自己身份/回合/revision/手牌ID/空格，server applyMove；AI同引擎|
|POST /api/matches/:id/settle|已結束且冪等；未知敵方物種只給問答資格|
|GET /api/matches/:id/replay|對局玩家可讀原始initial+moves；不重算卡牌|
|GET/POST /api/quiz|對戰資格、答案與attempt版本；只解鎖不發卡|

## 實際SQL

`profiles(id TEXT PK, revision INTEGER, data TEXT JSON)`；`matches(id TEXT PK, revision INTEGER, p0 TEXT, p1 TEXT, data TEXT JSON, updated_at TEXT)`。索引matches_players(p0,p1)。Drizzle來源 `server/schema.ts`，正式journal `drizzle/meta/_journal.json`，本次無DDL新增。請勿同時套用歷史 `migrations/0000_initial.sql` 與Drizzle初始SQL。

Profile保留：demo、instances、unlocks、observations、deck、pending、attempts、badges、stats、revision。新增欄位：

- Observation.location?：lat/lng/accuracy/measuredAt（私人）；locationFlags?：低精度/舊定位/異常速度；privacy?：visibility/shareWith，缺省private。
- Observation.recognition：候選speciesId/similarity/margin/modelVersion，加可選candidates/lowConfidence，非確認。
- Observation.review?：只保留舊版欄位與history，不建立新審核工作台或申請。
- Observation.verification?：method=human、confirmed speciesId、時間、依據、campusConfirmed與粗區域zone；僅相容原有有來源確認資料，新AI收集不建立此欄位。舊verified字串本身不算科學確認。
- CardInstance.definition?：取得快照不改寫；photoHash?：已領照片指紋，刪觀察仍保留；API的definition為目前官方投影，acquiredDefinition是取得時能力。
- BattleState.balanceVersion?：新對局能力版；ruleVersion保留。initial/state/卡牌controller/spent/events/moves均為可重播快照。

統一物種記錄：id、names zh/en/scientific、kingdom/classification、distribution、habitat/ecology及來源、conservation（無可靠來源=null）、images作者/授權/source、三個externalIds、各TaxonMatch與provenance、updatedAt/warnings。Provenance.version是API版本，dataVersion取上游ETag/Last-Modified（無則null），TaiCOL的recordUpdatedAt另保留；不把API版本冒稱固定資料集版本。來源原始JSON存R2 cache，離線stale標示清楚。

私人影像：R2 observations/<player namespace>/<observation id>；公開來源快取：R2 biodiversity/v1/<encoded request URL>。快取不含玩家照片。JSON可選欄位向後相容，不會在啟動時批次改寫正式資料。備份與回復見MIGRATION。
