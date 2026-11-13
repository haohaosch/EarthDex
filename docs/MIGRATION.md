# 相容、備份與回復

本次無 SQL DDL migration：`profiles`/`matches` 表與 Drizzle journal 保留。新增內容均為向後相容的 profile JSON 可選欄位，或公開資料的 R2 cache，不會在啟動時改寫所有玩家資料。此開發環境沒有正式玩家 DB，沒有執行遠端資料遷移。

部署前由維運者：

1. 暫停寫入或建立可一致讀取的備份時間點，使用 D1 export/平台快照備份 profiles、matches；R2 observations 做物件清單與版本備份。驗證備份可以還原到獨立測試 DB（包含舊照片）。勿把私人備份提交 Git。
2. 記錄部署 commit、Worker版本與環境變數，保留目前既有 build。先在獨立 DB/R2 執行舊 profile 載入、舊 active match/重播、一次領卡、問答領卡 CAS 測試。
3. 上線後核對 profile/card/match 數量與既有 ID，測試權限。來源 cache 可刪除重建，玩家 observations 不可用清 cache 的方式清除。
4. 回復先停寫、備份失敗版本的新增紀錄、回復舊 Worker；若需還原 DB/R2，從同一時間點還原到新 binding，核對後切換。不得將舊快照直接覆寫正在寫入的正式DB而丟失期間新資料。

位置屬私人資料，刪除觀察會刪除其位置/照片引用並刪R2物件；卡牌與舊對局快照保留。跨D1/R2非分散式交易：CAS保存失敗會清掉新照片；刪觀察先成功CAS再刪R2，避免競爭時損壞仍存在的觀察。R2刪除失敗仍須由維運者清理孤立物件，正式環境需再補儲存回收工作排程。恢復備份也必須遵守玩家後續刪除要求。

## 固定卡牌能力遷移設計（先於程式修改）

採非破壞性讀取投影：既有 `instances[].definition`、ID、grantId、observationId 與 balanceHistory 完全保留，不再讀取時自動修補。收藏API另回 acquiredDefinition 作取得快照，主要 definition 顯示目前官方能力。新領卡存官方能力；新對戰從 speciesId 解析同一版官方定義，不採客戶端或舊隨機值。已建立/等待中的PVP與AI對局保存自己的 initial/state/waitingDeck，開始前版本不同即拒絕加入並要求重建房間，絕不重算舊對局快照。歷史 replay 維持原規則與數值。

官方 manifest 以版控發布（speciesId/能力/技能/seed/版本），有來源且本次核對的標籤才可用；缺資料中性。新版本必須新增 manifest/常數與測試，而非改寫既有 manifest。回復舊Worker會重新顯示既有取得快照；新生成official卡本身仍含完整定義，不會丟資料。備份與DB/R2回復流程同上。

依最新指示不部署人工審核模組。既有review/verification歷史欄位不刪，舊pending有AI比對紀錄可直接續答；新AI收集不建立科學verification，也不將既有資料批次升級成已確認校園成果。

## ecology-0.2 / official-2

新增獨立的v2能力manifest與規則分流，舊v1檔案不改。`generateCard`未指定版本時仍使用原experimental-0.1種子，避免無快照舊卡重算出不同值。新對局才用新技能；舊active與initial.ruleVersion保留走legacy分支，舊等待房間版本不同須重建，沒有刪除原房間。

新增match JSON欄位handReveals/turnSnapshots/endReason、卡牌skillDisabled與技能事件。均不執行DDL或批次覆寫；維運備份/回復流程同上。新遊戲最多100手，回合快照含私人手牌，DB/備份仍屬玩家資料；對外回應同時遮蔽目前及歷史快照的對手手牌，掠食者只傳本人有效快照。完整重播只在結束後提供。對戰仍不新增/移轉卡牌所有權。

## tactics-0.3 / official-3

新增v3 manifest與獨立規則引擎，v1/v2 manifests及舊規則保留。新對局7張牌、後手植物、17種遊戲技能；不再以生態來源作技能資格。BattleCard.modifiers/obstacle、Move.swapCell與遠攻方向事件為JSON可選欄位，無SQL變更。植物不進實例庫；強制換防只把本局卡放到當前陣營手牌，不轉移正式實例所有權。

既有demo五張選擇從已持有卡補足7張並CAS保存，無法補足則保留原選擇讓玩家調整；正式檔案不自動選牌或發卡。已開始對局與重播保留當時5張與原規則，舊等待房間不可混用新版本。回滾注意新對局需要理解tactics-0.3的Worker；只能回滾到仍支援三套規則的修復版。
