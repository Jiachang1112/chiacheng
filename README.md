# chiacheng1112.com — 使用說明

這是一個純靜態網站（HTML + CSS + JS，不需要資料庫或後端），設計主題是「深夜書桌 / 手記」的個人部落格。

## 檔案結構

```
index.html          首頁（介紹、文章列表、關於、連結區）
post-example.html    單篇文章範本
style.css            所有樣式
script.js             滑鼠跟隨光暈效果、自動年份
```

## 怎麼客製化

### 1. 換掉基本資訊
- `index.html` 裡的「Chia Cheng」「Kaohsiung, Taiwan」等，換成你自己的介紹。
- `<title>` 和 `<meta name="description">` 也建議一起改，對 SEO 比較好。

### 2. 新增一篇文章
1. 複製 `post-example.html`，改檔名，例如 `post-002.html`。
2. 打開新檔案，把標題、日期、內文換掉。
3. 回到 `index.html` 的 `#entries` 區塊，仿照現有的 `<article class="entry">` 複製一段，
   把連結指到你的新檔案（例如 `post-002.html`），並更新編號 `NO. 004`、日期、標題、摘要。

### 3. 你提到「有時候需要跳轉到指定連結」
就是 `index.html` 裡 `#links` 這個區塊（`.links-grid` 底下的 `.link-tag`）。
每一個都是一個可點擊的按鈕，直接改 `href` 就會跳到你要的網址：

```html
<a class="link-tag" href="這裡換成你要跳轉的網址" target="_blank" rel="noopener">
  <span class="icon">XX</span>
  <div><div class="label">顯示的標題</div><div class="sub">顯示的副標</div></div>
</a>
```

需要幾個按鈕就複製幾份，順序、數量都可以自由調整。若要跳轉到站內某個區塊（像 `#about`），
把 `href` 換成 `#區塊id` 並拿掉 `target="_blank"` 即可。

### 4. 換色 / 換字型
所有顏色都是 CSS 變數，寫在 `style.css` 最上面的 `:root { ... }` 裡，改那幾個顏色碼即可整站套用。

## 怎麼把網站放上 chiacheng1112.com

這是純靜態檔案，最簡單、免費的兩種方式：

**方式一：Cloudflare Pages（推薦，速度快、有 CDN）**
1. 把這幾個檔案上傳到一個 GitHub repo。
2. 到 Cloudflare Pages 建立專案，連接該 repo，Build command 留空、輸出目錄設成根目錄。
3. 部署完成後，到 Cloudflare Pages 專案設定「Custom domains」，加入 `chiacheng1112.com`，
   並依照畫面指示，把網域的 DNS 指向 Cloudflare（如果網域也用 Cloudflare 管理會最順）。

**方式二：Netlify**
1. 把整個資料夾拖進 Netlify 的部署頁面（不需要 GitHub 也可以，支援直接拖曳資料夾）。
2. 部署完成後在 Netlify 的 Domain settings 加入 `chiacheng1112.com`，
   並到你買網域的地方（GoDaddy／Namecheap／其他）把 DNS 的 A 記錄 / CNAME 改成 Netlify 提供的值。

兩種都是免費方案即可使用。之後每次改完檔案重新上傳（或 push 到 GitHub），網站會自動更新。
