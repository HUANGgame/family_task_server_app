const childStore = storage("child");

const zhuyinMap = {
  "兒": "ㄦˊ", "童": "ㄊㄨㄥˊ", "版": "ㄅㄢˇ", "登": "ㄉㄥ", "入": "ㄖㄨˋ",
  "點": "ㄉㄧㄢˇ", "數": "ㄕㄨˋ", "語": "ㄩˇ", "音": "ㄧㄣ", "模": "ㄇㄛˊ", "式": "ㄕˋ",
  "念": "ㄋㄧㄢˋ", "出": "ㄔㄨ", "畫": "ㄏㄨㄚˋ", "面": "ㄇㄧㄢˋ",
  "任": "ㄖㄣˋ", "務": "ㄨˋ", "商": "ㄕㄤ", "店": "ㄉㄧㄢˋ", "扣": "ㄎㄡˋ",
  "紀": "ㄐㄧˋ", "錄": "ㄌㄨˋ", "今": "ㄐㄧㄣ", "日": "ㄖˋ", "鼓": "ㄍㄨˇ", "勵": "ㄌㄧˋ",
  "重": "ㄔㄨㄥˊ", "新": "ㄒㄧㄣ", "整": "ㄓㄥˇ", "理": "ㄌㄧˇ", "家": "ㄐㄧㄚ",
  "事": "ㄕˋ", "學": "ㄒㄩㄝˊ", "習": "ㄒㄧˊ", "生": "ㄕㄥ", "活": "ㄏㄨㄛˊ",
  "運": "ㄩㄣˋ", "動": "ㄉㄨㄥˋ", "其": "ㄑㄧˊ", "他": "ㄊㄚ",
  "需": "ㄒㄩ", "要": "ㄧㄠˋ", "不": "ㄅㄨˋ", "照": "ㄓㄠˋ", "片": "ㄆㄧㄢˋ",
  "上": "ㄕㄤˋ", "傳": "ㄔㄨㄢˊ", "完": "ㄨㄢˊ", "成": "ㄔㄥˊ", "已": "ㄧˇ",
  "可": "ㄎㄜˇ", "兌": "ㄉㄨㄟˋ", "換": "ㄏㄨㄢˋ", "庫": "ㄎㄨˋ", "存": "ㄘㄨㄣˊ",
  "目": "ㄇㄨˋ", "前": "ㄑㄧㄢˊ", "沒": "ㄇㄟˊ", "有": "ㄧㄡˇ", "請": "ㄑㄧㄥˇ",
  "先": "ㄒㄧㄢ", "選": "ㄒㄩㄢˇ", "擇": "ㄗㄜˊ", "照": "ㄓㄠˋ", "成": "ㄔㄥˊ",
  "功": "ㄍㄨㄥ", "獲": "ㄏㄨㄛˋ", "得": "ㄉㄜˊ", "分": "ㄈㄣ", "鐘": "ㄓㄨㄥ",
  "讀": "ㄉㄨˊ", "書": "ㄕㄨ", "房": "ㄈㄤˊ", "間": "ㄐㄧㄢ", "餐": "ㄘㄢ",
  "桌": "ㄓㄨㄛ", "玩": "ㄨㄢˊ", "具": "ㄐㄩˋ", "刷": "ㄕㄨㄚ", "牙": "ㄧㄚˊ",
  "洗": "ㄒㄧˇ", "澡": "ㄗㄠˇ", "睡": "ㄕㄨㄟˋ", "覺": "ㄐㄧㄠˋ", "作": "ㄗㄨㄛˋ",
  "業": "ㄧㄝˋ", "收": "ㄕㄡ", "拾": "ㄕˊ", "幫": "ㄅㄤ", "忙": "ㄇㄤˊ",
  "加": "ㄐㄧㄚ", "油": "ㄧㄡˊ", "很": "ㄏㄣˇ", "棒": "ㄅㄤˋ", "努": "ㄋㄨˇ",
  "力": "ㄌㄧˋ", "做": "ㄗㄨㄛˋ", "到": "ㄉㄠˋ", "了": "ㄌㄜ˙", "登": "ㄉㄥ",
  "出": "ㄔㄨ", "孩": "ㄏㄞˊ", "子": "ㄗˇ", "名": "ㄇㄧㄥˊ", "稱": "ㄔㄥ",
  "原": "ㄩㄢˊ", "因": "ㄧㄣ", "時": "ㄕˊ", "間": "ㄐㄧㄢ", "後": "ㄏㄡˋ"
};

function childToken() {
  return childStore.token;
}

function showChildApp(show) {
  qs("#childAuthPanel").classList.toggle("hidden", show);
  qs("#childAppPanel").classList.toggle("hidden", !show);
}

async function childApi(path, options = {}) {
  return api(path, options, childToken());
}

function zhuyinHtml(text, extraClass = "") {
  const safe = String(text || "");
  const html = Array.from(safe).map((char) => {
    if (/\s/.test(char)) return " ";
    const escaped = escapeHtml(char);
    const note = zhuyinMap[char];
    if (!note) return `<span class="zh-char">${escaped}</span>`;
    return `<ruby class="zh-char">${escaped}<rt>${escapeHtml(note)}</rt></ruby>`;
  }).join("");
  return `<span class="zhuyin-line ${extraClass}">${html}</span>`;
}

function applyStaticZhuyin() {
  qsa(".zhuyin-text").forEach((element) => {
    element.innerHTML = zhuyinHtml(element.dataset.zhuyin || element.textContent);
  });
}

function speakText(text) {
  if (!("speechSynthesis" in window)) {
    setStatus(qs("#childLoginStatus"), "這個瀏覽器不支援語音朗讀。", true);
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(String(text || ""));
  utterance.lang = "zh-TW";
  utterance.rate = 0.82;
  utterance.pitch = 1.15;
  window.speechSynthesis.speak(utterance);
}

function voiceModeOn() {
  return qs("#voiceModeToggle")?.checked;
}

function bindVoiceButtons(root = document) {
  qsa(".voice-readable", root).forEach((element) => {
    element.addEventListener("click", () => {
      if (voiceModeOn()) speakText(element.dataset.speak || element.textContent);
    });
  });
}

function readVisibleChildPage() {
  if (!childToken()) {
    speakText("兒童登入。請輸入 Family Code 和 Child Code。");
    return;
  }

  const activeView = qs(".view.active");
  const text = [
    qs("#childName")?.textContent,
    `點數 ${qs("#childPoints")?.textContent || 0}`,
    qs("#encouragementText")?.textContent,
    activeView?.innerText
  ].filter(Boolean).join("。");
  speakText(text);
}

async function loadMe() {
  const data = await childApi("/api/child/me");
  qs("#childName").innerHTML = zhuyinHtml(data.childName || "兒童", "child-name-zh");
  qs("#childName").dataset.speak = data.childName || "兒童";
  qs("#childPoints").textContent = data.points || 0;
}

async function loadEncouragement() {
  const data = await childApi("/api/child/encouragement");
  qs("#encouragementText").innerHTML = zhuyinHtml(data.message);
  qs("#encouragementText").dataset.speak = data.message;
  if (voiceModeOn()) speakText(data.message);
}

async function uploadPhoto(taskId, input) {
  if (!input.files || !input.files[0]) throw new Error("請先選擇照片。");
  const data = new FormData();
  data.append("photo", input.files[0]);
  return childApi(`/api/child/tasks/${taskId}/photo`, { method: "POST", body: data });
}

function taskMetaText(task) {
  return `${task.category || "任務"}，${task.need_photo ? "需要照片" : "不需要照片"}`;
}

async function loadTasks() {
  const data = await childApi("/api/child/tasks");
  const tasks = data.tasks || [];
  qs("#childTasksList").innerHTML = tasks.map((task) => `
    <article class="item child-card">
      <div class="item-head">
        <div>
          <h3>${zhuyinHtml(task.task_name)}</h3>
          <div class="small muted">${zhuyinHtml(taskMetaText(task), "meta-zh")}</div>
          ${task.task_note ? `<p>${zhuyinHtml(task.task_note)}</p>` : ""}
        </div>
        <span class="badge ${task.done ? "" : "orange"}">${task.done ? zhuyinHtml("已完成") : `${task.points} 點`}</span>
      </div>
      ${task.photo_url ? `<a class="small" href="${escapeHtml(task.photo_url)}" target="_blank" rel="noreferrer">${zhuyinHtml("查看照片")}</a>` : ""}
      <div class="button-row">
        ${task.need_photo && !task.done ? `<input type="file" accept="image/*" data-photo-input="${task.id}"> <button class="btn secondary voice-readable" data-upload="${task.id}" data-speak="上傳照片">上傳照片</button>` : ""}
        <button class="btn good voice-readable" data-finish="${task.id}" data-speak="完成任務" ${task.done ? "disabled" : ""}>完成任務</button>
        <button class="btn secondary voice-readable" type="button" data-read-task="${task.id}" data-speak="${escapeHtml(`${task.task_name}。${taskMetaText(task)}。${task.task_note || ""}`)}">念任務</button>
      </div>
      <p class="status" data-task-status="${task.id}"></p>
    </article>
  `).join("") || `<p class="muted">${zhuyinHtml("目前沒有任務")}</p>`;

  qsa("[data-upload]").forEach((button) => {
    button.addEventListener("click", async () => {
      const status = qs(`[data-task-status="${button.dataset.upload}"]`);
      const input = qs(`[data-photo-input="${button.dataset.upload}"]`);
      setStatus(status, "上傳中...");
      try {
        await uploadPhoto(button.dataset.upload, input);
        setStatus(status, "照片已上傳。");
        if (voiceModeOn()) speakText("照片已上傳");
        await refreshChildData();
      } catch (error) {
        setStatus(status, error.message, true);
        if (voiceModeOn()) speakText(error.message);
      }
    });
  });

  qsa("[data-finish]").forEach((button) => {
    button.addEventListener("click", async () => {
      const status = qs(`[data-task-status="${button.dataset.finish}"]`);
      setStatus(status, "完成中...");
      try {
        const data = await childApi(`/api/child/tasks/${button.dataset.finish}/finish`, { method: "PUT" });
        const message = data.earnedPoints ? `完成，獲得 ${data.earnedPoints} 點。` : "已完成。";
        setStatus(status, message);
        if (voiceModeOn()) speakText(message);
        await refreshChildData();
      } catch (error) {
        setStatus(status, error.message, true);
        if (voiceModeOn()) speakText(error.message);
      }
    });
  });

  bindVoiceButtons(qs("#childTasksList"));
}

async function loadShop() {
  const data = await childApi("/api/child/shop");
  qs("#childShopList").innerHTML = (data.items || []).map((item) => `
    <article class="item child-card">
      <div class="item-head">
        <div>
          <h3>${zhuyinHtml(item.name)}</h3>
          <div class="small muted">${zhuyinHtml(item.description || "獎勵")}</div>
        </div>
        <span class="badge">${item.cost} 點 · ${zhuyinHtml("庫存")} ${item.stock}</span>
      </div>
      <div class="button-row">
        <button class="btn warn voice-readable" data-redeem="${item.id}" data-speak="兌換 ${escapeHtml(item.name)}">兌換</button>
        <button class="btn secondary voice-readable" type="button" data-speak="${escapeHtml(`${item.name}。需要 ${item.cost} 點。庫存 ${item.stock}`)}">念商品</button>
      </div>
      <p class="status" data-shop-status="${item.id}"></p>
    </article>
  `).join("") || `<p class="muted">${zhuyinHtml("目前沒有可兌換商品")}</p>`;
  qsa("[data-redeem]").forEach((button) => {
    button.addEventListener("click", async () => {
      const status = qs(`[data-shop-status="${button.dataset.redeem}"]`);
      setStatus(status, "兌換中...");
      try {
        await childApi(`/api/child/shop/${button.dataset.redeem}/redeem`, { method: "POST" });
        setStatus(status, "兌換成功。");
        if (voiceModeOn()) speakText("兌換成功");
        await refreshChildData();
      } catch (error) {
        setStatus(status, error.message, true);
        if (voiceModeOn()) speakText(error.message);
      }
    });
  });
  bindVoiceButtons(qs("#childShopList"));
}

async function loadFines() {
  const data = await childApi("/api/child/fines");
  qs("#childFinesList").innerHTML = (data.fines || []).map((fine) => `
    <article class="item child-card">
      <div class="item-head">
        <div>
          <h3>${zhuyinHtml(fine.reason)}</h3>
          <div class="small muted">${new Date(fine.created_at).toLocaleString()}</div>
        </div>
        <span class="badge orange">-${fine.deducted} 點</span>
      </div>
    </article>
  `).join("") || `<p class="muted">${zhuyinHtml("沒有扣點紀錄")}</p>`;
}

async function refreshChildData() {
  if (!childToken()) return;
  showChildApp(true);
  await Promise.all([loadMe(), loadTasks(), loadShop(), loadFines(), loadEncouragement()]);
}

bindTabs();
applyStaticZhuyin();
bindVoiceButtons();

qs("#childLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = qs("#childLoginStatus");
  setStatus(status, "登入中...");
  try {
    const data = await api("/api/child/login", { method: "POST", body: formData(event.target) });
    childStore.token = data.token;
    setStatus(status, "");
    await refreshChildData();
  } catch (error) {
    setStatus(status, error.message, true);
    if (voiceModeOn()) speakText(error.message);
  }
});

qs("#refreshChildBtn").addEventListener("click", refreshChildData);
qs("#encourageBtn").addEventListener("click", loadEncouragement);
qs("#readPageBtn").addEventListener("click", readVisibleChildPage);
qs("#childClearSessionBtn").addEventListener("click", () => {
  window.speechSynthesis?.cancel();
  childStore.clear();
  location.reload();
});

if (childToken()) refreshChildData().catch((error) => {
  childStore.clear();
  showChildApp(false);
  setStatus(qs("#childLoginStatus"), error.message, true);
});
