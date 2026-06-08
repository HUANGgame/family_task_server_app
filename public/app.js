function storage(prefix) {
  return {
    get token() {
      return sessionStorage.getItem(`${prefix}:token`);
    },
    set token(value) {
      sessionStorage.setItem(`${prefix}:token`, value);
    },
    clear() {
      sessionStorage.removeItem(`${prefix}:token`);
    }
  };
}

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function setStatus(element, message, error = false) {
  if (!element) return;
  element.textContent = message || "";
  element.classList.toggle("error", Boolean(error));
}

async function api(path, options = {}, token = "") {
  const headers = options.headers || {};
  const config = { ...options, headers: { ...headers } };

  if (!(config.body instanceof FormData)) {
    config.headers["Content-Type"] = "application/json";
    if (config.body && typeof config.body !== "string") config.body = JSON.stringify(config.body);
  }

  if (token) config.headers.Authorization = `Bearer ${token}`;

  const response = await fetch(path, config);
  const payload = await response.json().catch(() => ({ ok: false, message: "Invalid server response." }));
  if (!response.ok || !payload.ok) {
    throw new Error(payload.message || "Request failed.");
  }
  return payload.data;
}

function bindTabs() {
  qsa("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.tab;
      qsa("[data-tab]").forEach((item) => item.classList.toggle("active", item === button));
      qsa("[data-view]").forEach((view) => view.classList.toggle("active", view.dataset.view === target));
    });
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
