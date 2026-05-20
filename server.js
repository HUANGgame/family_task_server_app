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

function ensureDirectories() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function defaultData() {
  return {
    managerName: "",
    children: []
  };
}

function normalizeText(value, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeData(data) {
  const source = data && typeof data === "object" ? data : defaultData();
  const children = Array.isArray(source.children) ? source.children : [];

  return {
    managerName: normalizeText(source.managerName),
    children: children.map(child => ({
      id: String(child.id || makeId()),
      name: normalizeText(child.name) || "未命名孩子",
      tasks: Array.isArray(child.tasks) ? child.tasks.map(task => ({
        id: String(task.id || makeId()),
        name: normalizeText(task.name) || "未命名任務",
        note: normalizeText(task.note, MAX_NOTE_LENGTH),
        needPhoto: task.needPhoto === "yes" ? "yes" : "no",
        done: Boolean(task.done),
        photo: typeof task.photo === "string" ? task.photo : "",
        createdAt: typeof task.createdAt === "string" ? task.createdAt : getNowText(),
        completedAt: typeof task.completedAt === "string" ? task.completedAt : ""
      })) : []
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
    console.error("讀取 data.json 失敗，已使用空白資料：", error.message);
    return defaultData();
  }
}

function writeData(data) {
  const normalized = normalizeData(data);
  fs.writeFileSync(DATA_FILE, JSON.stringify(normalized, null, 2), "utf8");
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getNowText() {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());
}

function findChild(data, childId) {
  return data.children.find(child => child.id === childId);
}

function findTask(child, taskId) {
  return child.tasks.find(task => task.id === taskId);
}

ensureDirectories();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
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
  res.json(readData());
});

app.put("/api/manager", (req, res) => {
  const managerName = normalizeText(req.body.managerName);
  if (!managerName) {
    return res.status(400).json({ message: "請輸入家長名稱" });
  }

  const data = readData();
  data.managerName = managerName;
  writeData(data);
  res.json(data);
});

app.post("/api/children", (req, res) => {
  const name = normalizeText(req.body.name);
  if (!name) {
    return res.status(400).json({ message: "請輸入孩子名稱" });
  }

  const data = readData();
  const child = {
    id: makeId(),
    name,
    tasks: []
  };

  data.children.push(child);
  writeData(data);
  res.status(201).json(child);
});

app.delete("/api/children/:childId", (req, res) => {
  const data = readData();
  const beforeCount = data.children.length;
  data.children = data.children.filter(child => child.id !== req.params.childId);

  if (data.children.length === beforeCount) {
    return res.status(404).json({ message: "找不到這位孩子" });
  }

  writeData(data);
  res.json(data);
});

app.post("/api/children/:childId/tasks", (req, res) => {
  const name = normalizeText(req.body.name);
  const note = normalizeText(req.body.note, MAX_NOTE_LENGTH);
  const needPhoto = req.body.needPhoto === "yes" ? "yes" : "no";

  if (!name) {
    return res.status(400).json({ message: "請輸入任務名稱" });
  }

  const data = readData();
  const child = findChild(data, req.params.childId);

  if (!child) {
    return res.status(404).json({ message: "找不到這位孩子" });
  }

  const task = {
    id: makeId(),
    name,
    note: note || "沒有補充說明",
    needPhoto,
    done: false,
    photo: "",
    createdAt: getNowText(),
    completedAt: ""
  };

  child.tasks.unshift(task);
  writeData(data);
  res.status(201).json(task);
});

app.delete("/api/children/:childId/tasks/:taskId", (req, res) => {
  const data = readData();
  const child = findChild(data, req.params.childId);

  if (!child) {
    return res.status(404).json({ message: "找不到這位孩子" });
  }

  const beforeCount = child.tasks.length;
  child.tasks = child.tasks.filter(task => task.id !== req.params.taskId);

  if (child.tasks.length === beforeCount) {
    return res.status(404).json({ message: "找不到這個任務" });
  }

  writeData(data);
  res.json(data);
});

app.post("/api/children/:childId/tasks/:taskId/photo", upload.single("photo"), (req, res) => {
  const data = readData();
  const child = findChild(data, req.params.childId);

  if (!child) {
    return res.status(404).json({ message: "找不到這位孩子" });
  }

  const task = findTask(child, req.params.taskId);

  if (!task) {
    return res.status(404).json({ message: "找不到這個任務" });
  }

  if (!req.file) {
    return res.status(400).json({ message: "請選擇要上傳的照片" });
  }

  task.photo = `/uploads/${req.file.filename}`;
  writeData(data);
  res.json(task);
});

app.put("/api/children/:childId/tasks/:taskId/finish", (req, res) => {
  const data = readData();
  const child = findChild(data, req.params.childId);

  if (!child) {
    return res.status(404).json({ message: "找不到這位孩子" });
  }

  const task = findTask(child, req.params.taskId);

  if (!task) {
    return res.status(404).json({ message: "找不到這個任務" });
  }

  if (task.needPhoto === "yes" && !task.photo) {
    return res.status(400).json({ message: "這個任務需要先上傳照片才能完成" });
  }

  task.done = true;
  task.completedAt = getNowText();
  writeData(data);
  res.json(task);
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
  console.log(`家庭任務 App 已啟動：http://localhost:${PORT}`);
  console.log(`同一個 Wi-Fi 內可用本機 IP 開啟，例如：http://你的IPv4:${PORT}`);
});
