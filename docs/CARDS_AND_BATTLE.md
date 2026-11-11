# 官方卡牌與對戰

`data/card-balance-v1.json` 發布 `official-1`，82個既有物種ID。`scripts/build-official-cards.ts` 以 speciesId/版本/固定 traits-1 種子重建；版本固定時 manifest 不得原地更新。`data/trait-evidence.json` 記錄本次實際取得並核對的 Cornell/ADW/NOAA 來源。只有麻雀/獼猴群聚、翠鳥伏擊、綠蠵龜硬殼等四筆通過本次核對；其他原有標籤仍保留作歷史資料，官方版本先中性。這是保守資料完整性選擇，技能/成本不是動物的科學能力數據。

同物種同版值/技能完全一致；28點方向+技能共用預算，各方向1–10，只有一個主要技能；未知生態使用適應/7,7,7,7。新領卡的 ID/發卡ID可不同但能力相同。既有取得快照不改寫，API回 acquiredDefinition，圖鑑持有卡可展開歷史能力；新對戰一律投影官方版本，所有AI/PVP都從同一manifest讀取。不要用客戶端或舊隨機實例的能力建立新對局。

既有 `experimental-0.1` 戰鬥事件規則保持相容。新BattleState加 balanceVersion；createBattle 拒絕 mixed official versions/無效方向。applyMove 拒絕未知 ruleVersion。舊active/state/initial快照不重算；等待中的舊PVP房間平衡版本不同時須重建，原房間資料保留。

事件次序：合法操作→放置→同一快照比較四鄰（群聚/伏擊/隱蔽修正）→嚴格大於時才進入抵抗→所有成功翻轉同時提交→翻面技能的額外波1/2/3。普通翻轉不連鎖。群聚上限2、隱蔽1、伏擊2由SKILLS定義；堅甲每局一次，翻面不重設。新控制者取得技能，resetOnFlip依技能定義。漣漪只在引擎測試使用，不配給缺乏生態來源的真實物種。

每人5張持有卡，同種至多2；任意空格、無旋轉、九格滿後以控制格數判勝。先手5張後手4張不變。對戰結束仍控制的對方未知物種各取得一題資格，答題可解鎖所有所屬圖鑑，**不生成/轉移卡牌**。一般翻牌、相等、抵抗、連鎖上限、控制者、版本/非法操作/重播與API AI/PVP完整對局均有測試。

`node --import tsx scripts/simulate.ts 200 normal` 以兩副固定牌組、交換雙方位置的400局模擬；結果見 `evidence/balance-simulation.json`。只描述該策略/牌組，成對樣本相關，不宣稱整體公平。先後手機制需更多真人/牌組與策略分析後再改。
