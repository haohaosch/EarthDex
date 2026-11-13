# 私人位置、分享與校園統計

相機頁的定位選項使用瀏覽器 geolocation、授權後才取得一次定位，可略過/移除；拒絕、無法定位、逾時均有提示。不從 URL query 信任或記錄座標。照片 POST 以 `X-Earthdex-Location` JSON 傳 `lat,lng,accuracy,measuredAt`，伺服器驗範圍/數值/時間，並標記 >100m、舊定位、估計 >300km/h 的異常。GPS與客戶端時間不能證明真實性，不會把這些檢查宣稱為防偽保證。

預設 `privacy={visibility:'private',shareWith:[]}`。`GET /api/observation-map?from=YYYY-MM-DD&to=…&species=…&region=…` 是**擁有者專用**資料，回私人位置及統計。日期依 Asia/Taipei（含首尾日）。Leaflet+OSM 地圖顯示自己的點、定位精度和狀態，也有無定位計數。逢甲周邊矩形只能標 `fcu-vicinity`，校內 `fcu` 必須另外有可追溯的位置與物種確認依據。

`POST /api/observations/:id/privacy` `{visibility:'private'|'public'|'friends',shareWith:string[]}`。好友 ID 是可信平台身份，不是前端暱稱/角色。`GET /api/shared?owner=<分享檔案代碼>` 只能讀公開或明確授權自己身份的紀錄；無權限回404。投影永遠不包含照片、審核說明、定位精度/時間與私人精確座標；一般物種約略到0.001度，敏感物種位置一律 null。照片媒體路由仍只能擁有者讀取。頁面可以改權限、撤銷、讀取好友分享。朋友邀請/通訊錄尚未實作，需對方提供帳號ID。

`GET /api/campus/stats` 只聚合正式 profile、明確公開、有來源確認且校內位置另經核對的紀錄。私人、好友、示範、模型候選皆排除。AI遊戲收集另有類群/每日/每月統計，不計入科學確認。個人統計包括已確認物種/紀錄/動物類群/校內區域/日期/月份/圖鑑完成率；觀察數不是族群數。同物種可在同地點留下不同觀察，不能由數據推論不同個體。

## 1km / 7天未定規則

`engine/observation-policy.ts` 獨立、預設 enabled=false，API 明示 repeatPolicyEnforced=false，目前不作正式獎勵限制。伺服器AI比對/問答/照片去重仍必須通過。可測三種語義：

|情境|cooldown + 最近一次地點|cooldown + 最近7天所有地點|僅最近7天距離|
|---|---|---|---|
|8天後在原處|距離不足|視窗空集合→可領|視窗空集合→可領|
|1天後在2km外|冷卻未滿|冷卻未滿|可領|
|恰7天/恰1km|含邊界，符合|7天窗含邊界|含邊界|
|地點已刪除/無定位|有比對紀錄時 unknown|空集合如何處理仍待決|同左|

要啟用必須確認時間基準、視窗首尾、空集合、精度誤差、刪除紀錄與首張無GPS政策；不要僅修改 enabled。測試直接呈現矛盾結果。本次沒有將某種解釋接到正式領卡判定。

## 儲存與相容

SQL表不變；可選 location/privacy/review/verification 欄位存於既有 profiles JSON，舊資料欄位缺少視為私人/未確認，不批次改寫。舊已領卡保留；舊未領候選有recognition可直接問答。正式資料未在本次環境存取或遷移。備份/回復見 `MIGRATION.md`。
