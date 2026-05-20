const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const DATA_FILE = path.join(__dirname, "data.json");
const UPLOAD_DIR = path.join(__dirname, "public", "uploads");
const MAX_TEXT_LENGTH = 120;
const MAX_NOTE_LENGTH = 500;

function defaultData() {
  return {
    managerName: "",
    managerPassword: "",
    children: [],
    shop: [],
    redemptions: []
  };
}

function ensureDirectories() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowText() {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());
}

function text(value, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function normalizeData(input) {
  const source = input && typeof input === "object" ? input : defaultData();
  const children = Array.isArray(source.children) ? source.children : [];
  const shop = Array.isArray(source.shop) ? source.shop : [];
  const redemptions = Array.isArray(source.redemptions) ? source.redemptions : [];

  return {
    managerName: text(source.managerName),
    managerPassword: typeof source.managerPassword === "string" ? source.managerPassword : "",
    children: children.map(child => ({
      id: String(child.id || makeId()),
      name: text(child.name) || "未命名孩子",
      points: numberValue(child.points, 0),
      tasks: Array.isArray(child.tasks) ? child.tasks.map(task => ({
        id: String(task.id || makeId()),
        name: text(task.name) || "未命名任務",
        note: text(task.note, MAX_NOTE_LENGTH) || "沒有補充說明",
        needPhoto: task.needPhoto === "yes" ? "yes" : "no",
        points: numberValue(task.points, 1),
        done: Boolean(task.done),
        rewarded: Boolean(task.rewarded || task.done),
        photo: typeof task.photo === "string" ? task.photo : "",
        createdAt: typeof task.createdAt === "string" ? task.createdAt : nowText(),
        completedAt: typeof task.completedAt === "string" ? task.completedAt : ""
      })) : []
    })),
    shop: shop.map(item => ({
      id: String(item.id || makeId()),
      name: text(item.name) || "未命名商品",
      description: text(item.description, MAX_NOTE_LENGTH),
      cost: numberValue(item.cost, 1),
      stock: numberValue(item.stock, 1),
      active: item.active !== false,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : nowText()
    })),
    redemptions: redemptions.map(record => ({
      id: String(record.id || makeId()),
      childId: String(record.childId || ""),
      childName: text(record.childName) || "未知孩子",
      itemId: String(record.itemId || ""),
      itemName: text(record.itemName) || "未知商品",
      cost: numberValue(record.cost, 0),
      createdAt: typeof record.createdAt === "string" ? record.createdAt : nowText()
    }))
  };
}

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      writeData(defaultData());
    }

    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return normalizeData(raw ? JSON.parse(raw) : defaultData());
  } catch (error) {
    console.error("Failed to read data.json:", error.message);
    return defaultData();
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(normalizeData(data), null, 2), "utf8");
}

function publicData(data) {
  const normalized = normalizeData(data);
  return {
    managerName: normalized.managerName,
    hasManagerPassword: Boolean(normalized.managerPassword),
    children: normalized.children,
    shop: normalized.shop,
    redemptions: normalized.redemptions
  };
}

function managerPasswordFromRequest(req) {
  return String(req.headers["x-manager-password"] || req.body.managerPassword || "");
}

function requireManager(req, res, next) {
  const data = readData();
  if (!data.managerPassword) {
    req.appData = data;
    return next();
  }

  if (managerPasswordFromRequest(req) !== data.managerPassword) {
    return res.status(401).json({ message: "家長密碼不正確" });
  }

  req.appData = data;
  next();
}

function findChild(data, childId) {
  return data.children.find(child => child.id === childId);
}

function findTask(child, taskId) {
  return child.tasks.find(task => task.id === taskId);
}

function findShopItem(data, itemId) {
  return data.shop.find(item => item.id === itemId);
}

ensureDirectories();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `${makeId()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return cb(new Error("只能上傳圖片檔"));
    }
    cb(null, true);
  }
});

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/data", (req, res) => {
  const data = readData();
  writeData(data);
  res.json(publicData(data));
});

app.post("/api/manager/login", (req, res) => {
  const password = String(req.body.password || "");
  const data = readData();

  if (!data.managerPassword) {
    return res.json({ ok: true, needsSetup: true });
  }

  if (password !== data.managerPassword) {
    return res.status(401).json({ message: "家長密碼不正確" });
  }

  res.json({ ok: true, managerName: data.managerName });
});

app.put("/api/manager", requireManager, (req, res) => {
  const managerName = text(req.body.managerName);
  const managerPassword = String(req.body.newPassword || req.body.managerPassword || "").trim();

  if (!managerName) {
    return res.status(400).json({ message: "請輸入家長名稱" });
  }

  if (!req.appData.managerPassword && managerPassword.length < 4) {
    return res.status(400).json({ message: "第一次設定請輸入至少 4 碼密碼" });
  }

  req.appData.managerName = managerName;
  if (managerPassword) req.appData.managerPassword = managerPassword;
  writeData(req.appData);
  res.json(publicData(req.appData));
});

app.post("/api/children", requireManager, (req, res) => {
  const name = text(req.body.name);
  if (!name) {
    return res.status(400).json({ message: "請輸入孩子名稱" });
  }

  const child = {
    id: makeId(),
    name,
    points: 0,
    tasks: []
  };

  req.appData.children.push(child);
  writeData(req.appData);
  res.status(201).json(child);
});

app.delete("/api/children/:childId", requireManager, (req, res) => {
  const beforeCount = req.appData.children.length;
  req.appData.children = req.appData.children.filter(child => child.id !== req.params.childId);

  if (req.appData.children.length === beforeCount) {
    return res.status(404).json({ message: "找不到這位孩子" });
  }

  writeData(req.appData);
  res.json(publicData(req.appData));
});

app.post("/api/children/:childId/tasks", requireManager, (req, res) => {
  const name = text(req.body.name);
  const note = text(req.body.note, MAX_NOTE_LENGTH);
  const needPhoto = req.body.needPhoto === "yes" ? "yes" : "no";
  const points = numberValue(req.body.points, 1);
  const child = findChild(req.appData, req.params.childId);

  if (!child) return res.status(404).json({ message: "找不到這位孩子" });
  if (!name) return res.status(400).json({ message: "請輸入任務名稱" });
  if (points < 1) return res.status(400).json({ message: "任務積分至少要 1 分" });

  const task = {
    id: makeId(),
    name,
    note: note || "沒有補充說明",
    needPhoto,
    points,
    done: false,
    rewarded: false,
    photo: "",
    createdAt: nowText(),
    completedAt: ""
  };

  child.tasks.unshift(task);
  writeData(req.appData);
  res.status(201).json(task);
});

app.delete("/api/children/:childId/tasks/:taskId", requireManager, (req, res) => {
  const child = findChild(req.appData, req.params.childId);
  if (!child) return res.status(404).json({ message: "找不到這位孩子" });

  const beforeCount = child.tasks.length;
  child.tasks = child.tasks.filter(task => task.id !== req.params.taskId);
  if (child.tasks.length === beforeCount) {
    return res.status(404).json({ message: "找不到這個任務" });
  }

  writeData(req.appData);
  res.json(publicData(req.appData));
});

app.post("/api/shop", requireManager, (req, res) => {
  const name = text(req.body.name);
  const description = text(req.body.description, MAX_NOTE_LENGTH);
  const cost = numberValue(req.body.cost, 1);
  const stock = numberValue(req.body.stock, 1);

  if (!name) return res.status(400).json({ message: "請輸入商品名稱" });
  if (cost < 1) return res.status(400).json({ message: "商品積分至少要 1 分" });

  const item = {
    id: makeId(),
    name,
    description,
    cost,
    stock,
    active: true,
    createdAt: nowText()
  };

  req.appData.shop.unshift(item);
  writeData(req.appData);
  res.status(201).json(item);
});

app.delete("/api/shop/:itemId", requireManager, (req, res) => {
  const beforeCount = req.appData.shop.length;
  req.appData.shop = req.appData.shop.filter(item => item.id !== req.params.itemId);

  if (req.appData.shop.length === beforeCount) {
    return res.status(404).json({ message: "找不到這個商品" });
  }

  writeData(req.appData);
  res.json(publicData(req.appData));
});

app.post("/api/children/:childId/tasks/:taskId/photo", upload.single("photo"), (req, res) => {
  const data = readData();
  const child = findChild(data, req.params.childId);
  if (!child) return res.status(404).json({ message: "找不到這位孩子" });

  const task = findTask(child, req.params.taskId);
  if (!task) return res.status(404).json({ message: "找不到這個任務" });
  if (!req.file) return res.status(400).json({ message: "請選擇要上傳的照片" });

  task.photo = `/uploads/${req.file.filename}`;
  writeData(data);
  res.json(task);
});

app.put("/api/children/:childId/tasks/:taskId/finish", (req, res) => {
  const data = readData();
  const child = findChild(data, req.params.childId);
  if (!child) return res.status(404).json({ message: "找不到這位孩子" });

  const task = findTask(child, req.params.taskId);
  if (!task) return res.status(404).json({ message: "找不到這個任務" });
  if (task.needPhoto === "yes" && !task.photo) {
    return res.status(400).json({ message: "這個任務需要先上傳照片" });
  }

  if (!task.done) {
    task.done = true;
    task.completedAt = nowText();
  }

  if (!task.rewarded) {
    child.points += task.points;
    task.rewarded = true;
  }

  writeData(data);
  res.json({ task, childPoints: child.points, earnedPoints: task.points });
});

app.post("/api/children/:childId/redeem/:itemId", (req, res) => {
  const data = readData();
  const child = findChild(data, req.params.childId);
  const item = findShopItem(data, req.params.itemId);

  if (!child) return res.status(404).json({ message: "找不到這位孩子" });
  if (!item || !item.active) return res.status(404).json({ message: "找不到這個商品" });
  if (item.stock < 1) return res.status(400).json({ message: "商品已兌換完" });
  if (child.points < item.cost) return res.status(400).json({ message: "積分不夠" });

  child.points -= item.cost;
  item.stock -= 1;

  const record = {
    id: makeId(),
    childId: child.id,
    childName: child.name,
    itemId: item.id,
    itemName: item.name,
    cost: item.cost,
    createdAt: nowText()
  };

  data.redemptions.unshift(record);
  writeData(data);
  res.status(201).json(record);
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ message: "照片大小不可超過 5MB" });
  }

  if (error) {
    return res.status(400).json({ message: error.message || "請求失敗" });
  }

  next();
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Family task app is running on port ${PORT}`);
});
