const childStore = storage("child");

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

async function loadMe() {
  const data = await childApi("/api/child/me");
  qs("#childName").textContent = data.childName;
  qs("#childPoints").textContent = data.points || 0;
}

async function loadEncouragement() {
  const data = await childApi("/api/child/encouragement");
  qs("#encouragementText").textContent = data.message;
}

async function uploadPhoto(taskId, input) {
  if (!input.files || !input.files[0]) throw new Error("請先選擇照片。");
  const data = new FormData();
  data.append("photo", input.files[0]);
  return childApi(`/api/child/tasks/${taskId}/photo`, { method: "POST", body: data });
}

async function loadTasks() {
  const data = await childApi("/api/child/tasks");
  const tasks = data.tasks || [];
  qs("#childTasksList").innerHTML = tasks.map((task) => `
    <article class="item">
      <div class="item-head">
        <div>
          <h3>${escapeHtml(task.task_name)}</h3>
          <div class="small muted">${escapeHtml(task.category)} · ${task.need_photo ? "需要照片" : "不需照片"}</div>
          ${task.task_note ? `<p>${escapeHtml(task.task_note)}</p>` : ""}
        </div>
        <span class="badge ${task.done ? "" : "orange"}">${task.done ? "Done" : `${task.points} pts`}</span>
      </div>
      ${task.photo_url ? `<a class="small" href="${escapeHtml(task.photo_url)}" target="_blank" rel="noreferrer">查看已上傳照片</a>` : ""}
      <div class="button-row">
        ${task.need_photo && !task.done ? `<input type="file" accept="image/*" data-photo-input="${task.id}"> <button class="btn secondary" data-upload="${task.id}">上傳照片</button>` : ""}
        <button class="btn good" data-finish="${task.id}" ${task.done ? "disabled" : ""}>完成任務</button>
      </div>
      <p class="status" data-task-status="${task.id}"></p>
    </article>
  `).join("") || `<p class="muted">目前沒有任務。</p>`;

  qsa("[data-upload]").forEach((button) => {
    button.addEventListener("click", async () => {
      const status = qs(`[data-task-status="${button.dataset.upload}"]`);
      const input = qs(`[data-photo-input="${button.dataset.upload}"]`);
      setStatus(status, "Uploading...");
      try {
        await uploadPhoto(button.dataset.upload, input);
        setStatus(status, "照片已上傳。");
        await refreshChildData();
      } catch (error) {
        setStatus(status, error.message, true);
      }
    });
  });

  qsa("[data-finish]").forEach((button) => {
    button.addEventListener("click", async () => {
      const status = qs(`[data-task-status="${button.dataset.finish}"]`);
      setStatus(status, "Finishing...");
      try {
        const data = await childApi(`/api/child/tasks/${button.dataset.finish}/finish`, { method: "PUT" });
        setStatus(status, data.earnedPoints ? `完成，獲得 ${data.earnedPoints} 點。` : "已完成。");
        await refreshChildData();
      } catch (error) {
        setStatus(status, error.message, true);
      }
    });
  });
}

async function loadShop() {
  const data = await childApi("/api/child/shop");
  qs("#childShopList").innerHTML = (data.items || []).map((item) => `
    <article class="item">
      <div class="item-head">
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <div class="small muted">${escapeHtml(item.description || "")}</div>
        </div>
        <span class="badge">${item.cost} pts · stock ${item.stock}</span>
      </div>
      <div class="button-row"><button class="btn warn" data-redeem="${item.id}">兌換</button></div>
      <p class="status" data-shop-status="${item.id}"></p>
    </article>
  `).join("") || `<p class="muted">目前沒有可兌換商品。</p>`;
  qsa("[data-redeem]").forEach((button) => {
    button.addEventListener("click", async () => {
      const status = qs(`[data-shop-status="${button.dataset.redeem}"]`);
      setStatus(status, "Redeeming...");
      try {
        await childApi(`/api/child/shop/${button.dataset.redeem}/redeem`, { method: "POST" });
        setStatus(status, "兌換成功。");
        await refreshChildData();
      } catch (error) {
        setStatus(status, error.message, true);
      }
    });
  });
}

async function loadFines() {
  const data = await childApi("/api/child/fines");
  qs("#childFinesList").innerHTML = (data.fines || []).map((fine) => `
    <article class="item">
      <div class="item-head">
        <div>
          <h3>${escapeHtml(fine.reason)}</h3>
          <div class="small muted">${new Date(fine.created_at).toLocaleString()}</div>
        </div>
        <span class="badge orange">-${fine.deducted}</span>
      </div>
    </article>
  `).join("") || `<p class="muted">沒有扣點紀錄。</p>`;
}

async function refreshChildData() {
  if (!childToken()) return;
  showChildApp(true);
  await Promise.all([loadMe(), loadTasks(), loadShop(), loadFines(), loadEncouragement()]);
}

bindTabs();

qs("#childLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = qs("#childLoginStatus");
  setStatus(status, "Logging in...");
  try {
    const data = await api("/api/child/login", { method: "POST", body: formData(event.target) });
    childStore.token = data.token;
    setStatus(status, "");
    await refreshChildData();
  } catch (error) {
    setStatus(status, error.message, true);
  }
});

qs("#refreshChildBtn").addEventListener("click", refreshChildData);
qs("#encourageBtn").addEventListener("click", loadEncouragement);
qs("#childLogoutBtn").addEventListener("click", () => {
  childStore.clear();
  location.reload();
});
qs("#childClearSessionBtn").addEventListener("click", () => {
  childStore.clear();
  location.reload();
});

if (childToken()) refreshChildData().catch((error) => {
  childStore.clear();
  showChildApp(false);
  setStatus(qs("#childLoginStatus"), error.message, true);
});
