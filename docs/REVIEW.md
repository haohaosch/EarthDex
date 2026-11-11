# 辨識與人工確認

BioCLIP/參考影像與文字向量保留，排序仍回前三名；低於既有校準閾值、前兩名過近、或文字偏好不受支援時 status=uncertain。分數不是正確率，閾值不是經野外驗證的真偽分類器。為避免模糊、多動物、非動物與庫外照片發卡，**所有新觀察先保留為模型候選**，需審核員確認才能取問答。這個保守展示流程不宣稱已完成自動辨識可靠性驗證。

- `GET /api/review-config` 回 configured/reviewer，不列出管理員識別碼。
- `POST /api/observations/:id/review` `{note}`：玩家自己的申請。已送出不重建；退回可 `/appeal` 重新送出，保留歷史。沒有審核員配置回503，UI明示無法送出，不假裝正在審核。
- `GET /api/reviews`：只有 `REVIEWER_IDS` 中的可信平台帳號，最多50個含待審核項目的 profile。
- `GET /api/reviews/media?owner=…&observation=…`：僅授權審核員、僅待審申請，可看申請者同意的私人影像。
- `POST /api/reviews/decide`：`owner, revision, observationId, reviewId, decision, speciesId, basis, campusConfirmed, zone`。只能處理 pending，審核結果以 profile CAS 一次寫回；approved 仍不發卡，答對問答後才發；rejected 可補件覆核。
- 網站頂部選單對已配置審核員顯示工作台，可看照片、改正候選、填依據、確認/退回。校內位置確認是獨立核對，不能只看探索矩形。審核員不能藉此直接建立卡牌。

部署時設定 `REVIEWER_IDS` 為逗號分隔的 Sites 可信帳號 ID；本機以 `EARTHDEX_REVIEWER_IDS` 傳給 local runtime。不要使用客戶端提交的角色。Sites 必須由可信入口覆寫 `oai-authenticated-user-id`（沿用既有身份架構）；獨立 Worker 部署前必須補上真實身分驗證，不可直接相信外部同名 header。

本機自動化覆蓋申請/權限/私人影像/退回/覆核/改判/寫回/舊候選不自動發卡/過期revision/重複決定/問答重試/同觀察僅一張。非動物真實特徵 fixture 必須 uncertain。模糊、多目標與未知分類的真人識別能力仍須現場資料評估，保守審核門檻不能被當作已測得的模型準確率。
