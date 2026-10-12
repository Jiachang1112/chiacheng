# chiacheng1112.com

個人作品集網站。純靜態（不需要打包），內容存在 Firebase Firestore，用自己做的後台編輯。

## 檔案

```
index.html            前台（只有一個空殼，內容由 js/site.js 畫出來）
css/site.css          前台樣式
js/site.js            前台：畫出各區塊、作品篩選、聯絡表單、捲動淡入
js/data.js            預設內容、資料格式整理 normalize()、共用小工具
js/store.js           Firebase 連線與前台讀取（SDK 用動態載入，載入失敗仍會顯示預設內容）

admin.html            後台入口
css/admin.css         後台樣式
js/admin/main.js      登入、外框、路由、發布流程、即時預覽
js/admin/core.js      草稿、發布、檢查、變更摘要
js/admin/cloud.js     後台用的 Firebase 操作與錯誤訊息
js/admin/ui.js        對話框、提示、標籤輸入等小元件
js/admin/views/       各頁面：總覽、基本資料、專案、技術、日誌、連結、外觀、訊息、備份

firestore.rules       Firestore 安全規則（需要自己貼到 Firebase 主控台）
CNAME                 自訂網域
```

## 後台能做什麼

- **總覽**：內容檢查清單、專案與技術統計、最近操作
- **基本資料**：姓名、標語、簡介、頭像上傳（自動縮圖）、關於、聯絡方式、搜尋引擎說明
- **專案**：搜尋、分類與狀態篩選、排序、批次改分類／狀態／精選／刪除、複製、上下移動
- **技術**：分類管理，並能從專案的技術標籤找出還沒歸類的項目
- **日誌**：支援粗體、連結、清單、程式碼，可置頂，有即時預覽
- **連結**：常用連結，可匯入舊版後台存的連結
- **外觀**：配色範本與自訂顏色（附對比檢查）、區塊順序與顯示、作品清單選項、頁尾、聯絡表單開關
- **訊息**：訪客留言收件匣
- **備份與紀錄**：資料大小、匯出／匯入 JSON、最近 20 次發布紀錄可還原、重設

所有修改都先存在草稿（也會自動存在瀏覽器），按「發布」才會上線。發布前會顯示變更摘要，
並檢查線上版本有沒有被別處改過。讀不到線上資料時不能發布，避免用預設內容蓋掉真正的資料。
右側的即時預覽會同步顯示草稿（寬螢幕才有）。

## 設定 Firebase（第一次必做）

1. 在 Firebase 主控台 → Authentication 建立一個 Email／密碼帳號，這就是後台的登入帳號。
2. 打開 `firestore.rules`，把 `YOUR_ADMIN_EMAIL` 換成那個 Email，整份貼到
   Firestore Database → 規則，按「發布」。沒有做這一步，後台無法儲存，聯絡表單也無法送出。
3. 開啟 `/admin.html` 登入。第一次按「發布」會把目前的內容寫進雲端。

資料位置：`portfolio/site_data_v1`（內容）、`portfolio_history`（發布紀錄）、`messages`（留言）。

## 部署

純靜態檔案，直接放到 Cloudflare Pages、Vercel 或 GitHub Pages 即可，不需要 build 指令。
網域設定在 `CNAME`。

## 本機預覽

```
python3 -m http.server 8000
```

然後開 http://localhost:8000 。
