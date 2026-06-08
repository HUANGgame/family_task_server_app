const managerStore = storage("manager");
let managerState = { children: [], familyCode: sessionStorage.getItem("manager:familyCode") || "" };

function managerToken() {
  return managerStore.token;
}

function showManagerApp(show) {
  qs("#authPanel").classList.toggle("hidden", show);
  qs("#appPanel").classList.toggle("hidden", !show);
  qs("#familyCodeText").textContent = managerState.familyCode || "-";
}

function setAuthMode(mode) {
  qsa("[data-auth]").forEach((button) => button.classList.toggle("good", button.dataset.auth === mode));
  qsa("[data-auth]").forEach((button) => button.classList.toggle("secondary", button.dataset.auth !== mode));
  qsa(".auth-form").forEach((form) => form.classList.add("hidden"));
  const formId = mode === "login" ? "#loginForm" : mode === "reset" ? "#resetForm" : "#createFamilyForm";
  qs(formId).classList.remove("hidden");
}

async function authed(path, options = {}) {
  return api(path, options, managerToken());
}

async function loadDashboard() {
  const data = await authed("/api/manager/dashboard");
  const labels = [
    ["小孩", data.childrenCount],
    ["今日任務", data.todayTasksCount],
    ["已完成", data.doneTasksCount],
    ["未完成", data.notDoneTasksCount],
    ["已上傳照片", data.photoSubmittedCount],
    ["今日兌換", data.todayRedemptionsCount],
    ["今日扣點", data.todayFinesCount]
  ];
  qs("#stats").innerHTML = labels.map(([label, value]) => `<div class="stat"><span class="muted small">${label}</span><strong>${value}</strong></div>`).join("");
}

function renderChildren() {
  const html = managerState.children.map((child) => `
    <article class="item child-account-card">
      <div class="item-head">
        <div>
          <h3>${escapeHtml(child.child_name)}</h3>
          <div class="small muted">小孩登入用代碼</div>
          <div class="child-code-display code">${escapeHtml(child.child_code)}</div>
          <p class="small muted">請把 Family Code 和這 4 位 Child Code 給小孩。</p>
        </div>
        <span class="badge">${child.points || 0} 點</span>
      </div>
      <div class="button-row">
        <button class="btn secondary" data-copy-code="${escapeHtml(child.child_code)}">複製 Child Code</button>
        <button class="btn danger" data-delete-child="${child.id}">刪除帳號</button>
      </div>
    </article>
  `).join("");

  qs("#childrenList").innerHTML = html || `<p class="muted">尚未建立小孩帳號。</p>`;

  qsa("[data-copy-code]").forEach((button) => {
    button.addEventListener("click", async () => {
      await navigator.clipboard?.writeText(button.dataset.copyCode);
      setStatus(qs("#childStatus"), `已複製 Child Code：${button.dataset.copyCode}`);
    });
  });

  qsa("[data-delete-child]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("確定要刪除這個小孩帳號和相關資料嗎？")) return;
      await authed(`/api/manager/children/${button.dataset.deleteChild}`, { method: "DELETE" });
      await refreshManagerData();
    });
  });
}

function updateChildSelects() {
  const options = managerState.children.map((child) => `<option value="${child.id}">${escapeHtml(child.child_name)} (${escapeHtml(child.child_code)})</option>`).join("");
  qsa(".childSelect").forEach((select) => {
    select.innerHTML = options;
  });
}

async function loadChildren() {
  const data = await authed("/api/manager/children");
  managerState.children = data.children || [];
  renderChildren();
  updateChildSelects();
}

async function loadTasks() {
  const all = [];
  for (const child of managerState.children) {
    const data = await authed(`/api/manager/children/${child.id}/tasks`);
    for (const task of data.tasks || []) all.push({ ...task, childName: child.child_name });
  }

  qs("#tasksList").innerHTML = all.map((task) => `
    <article class="item">
      <div class="item-head">
        <div>
          <h3>${escapeHtml(task.task_name)}</h3>
          <div class="small muted">${escapeHtml(task.childName)} · ${escapeHtml(task.category)} · ${task.need_photo ? "需要照片" : "不需要照片"}</div>
          ${task.task_note ? `<p>${escapeHtml(task.task_note)}</p>` : ""}
        </div>
        <span class="badge ${task.done ? "" : "orange"}">${task.done ? "已完成" : `${task.points} 點`}</span>
      </div>
      ${task.photo_url ? `<a class="small" href="${escapeHtml(task.photo_url)}" target="_blank" rel="noreferrer">查看照片</a>` : ""}
      <div class="button-row"><button class="btn danger" data-delete-task="${task.id}" data-child="${task.child_id}">刪除任務</button></div>
    </article>
  `).join("") || `<p class="muted">尚無任務。</p>`;

  qsa("[data-delete-task]").forEach((button) => {
    button.addEventListener("click", async () => {
      await authed(`/api/manager/children/${button.dataset.child}/tasks/${button.dataset.deleteTask}`, { method: "DELETE" });
      await refreshManagerData();
    });
  });
}

async function loadFines() {
  const all = [];
  for (const child of managerState.children) {
    const data = await authed(`/api/manager/children/${child.id}/fines`);
    for (const fine of data.fines || []) all.push({ ...fine, childName: child.child_name });
  }

  qs("#finesList").innerHTML = all.map((fine) => `
    <article class="item">
      <div class="item-head">
        <div>
          <h3>${escapeHtml(fine.reason)}</h3>
          <div class="small muted">${escapeHtml(fine.childName)} · ${new Date(fine.created_at).toLocaleString()}</div>
        </div>
        <span class="badge orange">-${fine.deducted} 點</span>
      </div>
    </article>
  `).join("") || `<p class="muted">尚無扣點紀錄。</p>`;
}

async function loadShop() {
  const data = await authed("/api/manager/shop");
  qs("#shopList").innerHTML = (data.items || []).map((item) => `
    <article class="item">
      <div class="item-head">
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <div class="small muted">${escapeHtml(item.description || "")}</div>
        </div>
        <span class="badge">${item.cost} 點 · 庫存 ${item.stock}</span>
      </div>
      <div class="button-row"><button class="btn danger" data-delete-shop="${item.id}">下架</button></div>
    </article>
  `).join("") || `<p class="muted">尚無商店商品。</p>`;

  qsa("[data-delete-shop]").forEach((button) => {
    button.addEventListener("click", async () => {
      await authed(`/api/manager/shop/${button.dataset.deleteShop}`, { method: "DELETE" });
      await loadShop();
    });
  });
}

async function loadMessages() {
  const data = await authed("/api/manager/encouragements");
  qs("#messagesList").innerHTML = (data.messages || []).map((message) => `
    <article class="item">
      <div class="item-head">
        <h3>${escapeHtml(message.message)}</h3>
        <span class="badge">${message.active ? "啟用" : "停用"}</span>
      </div>
    </article>
  `).join("") || `<p class="muted">尚無鼓勵語。</p>`;
}

async function refreshManagerData() {
  if (!managerToken()) return;
  showManagerApp(true);
  await loadChildren();
  await Promise.all([loadDashboard(), loadTasks(), loadFines(), loadShop(), loadMessages()]);
}

bindTabs();
setAuthMode("login");
qsa("[data-auth]").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.auth)));

qs("#createFamilyForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = qs("#createStatus");
  setStatus(status, "建立中...");
  try {
    const data = await api("/api/signup", { method: "POST", body: formData(event.target) });
    managerStore.token = data.token;
    managerState.familyCode = data.familyCode;
    sessionStorage.setItem("manager:familyCode", data.familyCode);
    setStatus(status, `已建立。Family Code：${data.familyCode}，小孩 Child Code：${data.child.childCode}`);
    await refreshManagerData();
  } catch (error) {
    setStatus(status, error.message, true);
  }
});

qs("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = qs("#loginStatus");
  setStatus(status, "登入中...");
  try {
    const data = await api("/api/manager/login", { method: "POST", body: formData(event.target) });
    managerStore.token = data.token;
    managerState.familyCode = data.familyCode;
    sessionStorage.setItem("manager:familyCode", data.familyCode);
    setStatus(status, "");
    await refreshManagerData();
  } catch (error) {
    setStatus(status, error.message, true);
  }
});

qs("#resetForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = qs("#resetStatus");
  setStatus(status, "重設中...");
  try {
    await api("/api/manager/reset-password", { method: "POST", body: formData(event.target) });
    setStatus(status, "密碼已更新，請回到家長登入。");
    qs("#loginForm [name=familyCode]").value = qs("#resetForm [name=familyCode]").value;
    setAuthMode("login");
  } catch (error) {
    setStatus(status, error.message, true);
  }
});

qs("#childForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = qs("#childStatus");
  try {
    const data = await authed("/api/manager/children", { method: "POST", body: formData(event.target) });
    event.target.reset();
    setStatus(status, `小孩帳號已建立。請給小孩 4 位 Child Code：${data.childCode}`);
    await refreshManagerData();
  } catch (error) {
    setStatus(status, error.message, true);
  }
});

qs("#taskForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = qs("#taskStatus");
  const data = formData(event.target);
  data.needPhoto = data.needPhoto === "true";
  try {
    await authed(`/api/manager/children/${data.childId}/tasks`, { method: "POST", body: data });
    event.target.reset();
    setStatus(status, "任務已建立。");
    await refreshManagerData();
  } catch (error) {
    setStatus(status, error.message, true);
  }
});

qs("#fineForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = qs("#fineStatus");
  const data = formData(event.target);
  try {
    await authed(`/api/manager/children/${data.childId}/fines`, { method: "POST", body: data });
    event.target.reset();
    setStatus(status, "扣點已建立。");
    await refreshManagerData();
  } catch (error) {
    setStatus(status, error.message, true);
  }
});

qs("#shopForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = qs("#shopStatus");
  try {
    await authed("/api/manager/shop", { method: "POST", body: formData(event.target) });
    event.target.reset();
    setStatus(status, "商品已建立。");
    await loadShop();
  } catch (error) {
    setStatus(status, error.message, true);
  }
});

qs("#messageForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = qs("#messageStatus");
  try {
    await authed("/api/manager/encouragements", { method: "POST", body: formData(event.target) });
    event.target.reset();
    setStatus(status, "鼓勵語已建立。");
    await loadMessages();
  } catch (error) {
    setStatus(status, error.message, true);
  }
});

qs("#aiForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = qs("#aiStatus");
  try {
    const data = await authed("/api/manager/ai-suggestion", { method: "POST", body: formData(event.target) });
    qs("#aiList").innerHTML = data.suggestions.map((item) => `
      <article class="item">
        <div class="item-head">
          <div>
            <h3>${escapeHtml(item.taskName)}</h3>
            <div class="small muted">${escapeHtml(item.category)} · ${item.needPhoto ? "需要照片" : "不需要照片"}</div>
          </div>
          <span class="badge">${item.points} 點</span>
        </div>
      </article>
    `).join("");
    setStatus(status, "已產生建議。");
  } catch (error) {
    setStatus(status, error.message, true);
  }
});

qs("#refreshDashboardBtn").addEventListener("click", refreshManagerData);
qs("#clearSessionBtn").addEventListener("click", () => {
  managerStore.clear();
  sessionStorage.removeItem("manager:familyCode");
  location.reload();
});

if (managerToken()) refreshManagerData().catch((error) => {
  managerStore.clear();
  showManagerApp(false);
  setStatus(qs("#loginStatus"), error.message, true);
});
