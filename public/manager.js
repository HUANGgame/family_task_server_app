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
  const formId = mode === "create" ? "#createFamilyForm" : mode === "login" ? "#loginForm" : "#resetForm";
  qs(formId).classList.remove("hidden");
}

async function authed(path, options = {}) {
  return api(path, options, managerToken());
}

async function loadDashboard() {
  const data = await authed("/api/manager/dashboard");
  const labels = [
    ["Children", data.childrenCount],
    ["Today Tasks", data.todayTasksCount],
    ["Done", data.doneTasksCount],
    ["Open", data.notDoneTasksCount],
    ["Photos", data.photoSubmittedCount],
    ["Redemptions", data.todayRedemptionsCount],
    ["Fines", data.todayFinesCount]
  ];
  qs("#stats").innerHTML = labels.map(([label, value]) => `<div class="stat"><span class="muted small">${label}</span><strong>${value}</strong></div>`).join("");
}

function renderChildren() {
  const html = managerState.children.map((child) => `
    <article class="item">
      <div class="item-head">
        <div>
          <h3>${escapeHtml(child.child_name)}</h3>
          <div class="small muted">Child Code <span class="code">${escapeHtml(child.child_code)}</span></div>
        </div>
        <span class="badge">${child.points || 0} pts</span>
      </div>
      <div class="button-row">
        <button class="btn danger" data-delete-child="${child.id}">刪除</button>
      </div>
    </article>
  `).join("");
  qs("#childrenList").innerHTML = html || `<p class="muted">尚未新增孩子。</p>`;
  qsa("[data-delete-child]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Delete this child and related data?")) return;
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
          <div class="small muted">${escapeHtml(task.childName)} · ${escapeHtml(task.category)} · ${task.need_photo ? "需要照片" : "不需照片"}</div>
          ${task.task_note ? `<p>${escapeHtml(task.task_note)}</p>` : ""}
        </div>
        <span class="badge ${task.done ? "" : "orange"}">${task.done ? "Done" : `${task.points} pts`}</span>
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
        <span class="badge orange">-${fine.deducted}</span>
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
        <span class="badge">${item.cost} pts · stock ${item.stock}</span>
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
        <span class="badge">${message.active ? "active" : "inactive"}</span>
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
setAuthMode("create");
qsa("[data-auth]").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.auth)));

qs("#createFamilyForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = qs("#createStatus");
  setStatus(status, "Creating...");
  try {
    const data = await api("/api/families", { method: "POST", body: formData(event.target) });
    setStatus(status, `Created. Family Code: ${data.familyCode}`);
    qs("#loginForm [name=familyCode]").value = data.familyCode;
    setAuthMode("login");
  } catch (error) {
    setStatus(status, error.message, true);
  }
});

qs("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = qs("#loginStatus");
  setStatus(status, "Logging in...");
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
  setStatus(status, "Updating...");
  try {
    await api("/api/manager/reset-password", { method: "POST", body: formData(event.target) });
    setStatus(status, "Password updated.");
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
    setStatus(status, `Child created. Code: ${data.childCode}`);
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
    setStatus(status, "Task created.");
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
    setStatus(status, "Fine created.");
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
    setStatus(status, "Shop item created.");
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
    setStatus(status, "Message created.");
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
            <div class="small muted">${escapeHtml(item.category)} · ${item.needPhoto ? "需要照片" : "不需照片"}</div>
          </div>
          <span class="badge">${item.points} pts</span>
        </div>
      </article>
    `).join("");
    setStatus(status, "Demo suggestions generated.");
  } catch (error) {
    setStatus(status, error.message, true);
  }
});

qs("#refreshDashboardBtn").addEventListener("click", refreshManagerData);
qs("#logoutBtn").addEventListener("click", () => {
  managerStore.clear();
  sessionStorage.removeItem("manager:familyCode");
  location.reload();
});
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
