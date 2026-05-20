# 家庭任務積分與獎勵商店

這是一個簡單的家庭任務 App。家長登入後可以建立孩子、派任務、設定每次任務可得積分，並在商店上架獎勵商品。孩子可以進入自己的介面，完成任務取得積分，再用積分兌換商店商品。

## 功能

- 家長密碼登入
- 家長與孩子不同介面
- 新增孩子
- 派任務並設定任務積分
- 任務可設定是否需要照片
- 孩子完成任務後自動得到積分
- 家長可上架商店商品
- 孩子可用積分兌換商品
- 家長可查看兌換紀錄

## Render 部署設定

- Build Command: `npm install`
- Start Command: `npm start`

## 本機啟動

```bash
npm install
npm start
```

開啟：

```text
http://localhost:3000
```

## 檔案

```text
server.js            Express API
public/index.html    前端介面
data.json            本機資料
public/uploads       任務照片
```
