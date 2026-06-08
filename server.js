require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_STORAGE_BUCKET,
  JWT_SECRET,
  NODE_ENV
} = process.env;

const requiredEnv = {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_STORAGE_BUCKET,
  JWT_SECRET
};

for (const [name, value] of Object.entries(requiredEnv)) {
  if (!value) {
    console.warn(`Missing environment variable: ${name}`);
  }
}

const supabase = createClient(SUPABASE_URL || "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY || "missing", {
  auth: { persistSession: false }
});

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image uploads are allowed."));
    cb(null, true);
  }
});

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeCode(length) {
  let output = "";
  for (let i = 0; i < length; i += 1) {
    output += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return output;
}

const makeFamilyCode = () => makeCode(8);
const makeChildCode = () => makeCode(4);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

function ok(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

function fail(res, status, message) {
  return res.status(status).json({ ok: false, message });
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET || "dev-secret", { expiresIn: "7d" });
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function assertFields(body, fields) {
  for (const field of fields) {
    if (!String(body[field] || "").trim()) {
      return `${field} is required.`;
    }
  }
  return null;
}

async function uniqueCode(table, column, generator) {
  for (let i = 0; i < 20; i += 1) {
    const code = generator();
    const { data, error } = await supabase.from(table).select("id").eq(column, code).maybeSingle();
    if (error) throw error;
    if (!data) return code;
  }
  throw new Error(`Could not generate a unique ${column}.`);
}

function requireAuth(role) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return fail(res, 401, "Missing authorization token.");

    try {
      const payload = jwt.verify(token, JWT_SECRET || "dev-secret");
      if (role && payload.role !== role) return fail(res, 403, "This account cannot use that action.");
      req.user = payload;
      next();
    } catch {
      return fail(res, 401, "Invalid or expired token.");
    }
  };
}

const requireManager = requireAuth("manager");
const requireChild = requireAuth("child");

async function getFamilyByCode(familyCode) {
  const { data, error } = await supabase
    .from("families")
    .select("*")
    .eq("family_code", normalizeCode(familyCode))
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function createFamilyAccount(body) {
  const missing = assertFields(body, ["managerName", "managerPassword"]);
  if (missing) {
    const error = new Error(missing);
    error.status = 400;
    throw error;
  }

  const familyCode = await uniqueCode("families", "family_code", makeFamilyCode);
  const managerHash = await bcrypt.hash(body.managerPassword, 12);
  const answer = String(body.recoveryAnswer || "").trim();
  const recoveryAnswerHash = answer ? await bcrypt.hash(answer.toLowerCase(), 12) : null;

  const { data, error } = await supabase
    .from("families")
    .insert({
      family_code: familyCode,
      family_name: String(body.familyName || "").trim() || null,
      manager_name: String(body.managerName).trim(),
      manager_password_hash: managerHash,
      recovery_question: String(body.recoveryQuestion || "").trim() || null,
      recovery_answer_hash: recoveryAnswerHash
    })
    .select("id, family_code, manager_name")
    .single();

  if (error) throw error;
  return data;
}

async function createChildAccount(familyId, childName) {
  if (!String(childName || "").trim()) {
    const error = new Error("childName is required.");
    error.status = 400;
    throw error;
  }

  const childCode = await uniqueCode("children", "child_code", makeChildCode);
  const { data, error } = await supabase
    .from("children")
    .insert({
      family_id: familyId,
      child_name: String(childName).trim(),
      child_code: childCode
    })
    .select("id, child_name, child_code, points")
    .single();

  if (error) throw error;
  return data;
}

async function getChildInFamily(familyId, childId) {
  const { data, error } = await supabase
    .from("children")
    .select("*")
    .eq("family_id", familyId)
    .eq("id", childId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function changeChildPoints(childId, delta) {
  const { data: child, error: readError } = await supabase
    .from("children")
    .select("points")
    .eq("id", childId)
    .single();
  if (readError) throw readError;

  const nextPoints = Math.max(0, Number(child.points || 0) + delta);
  const { data, error } = await supabase
    .from("children")
    .update({ points: nextPoints, updated_at: new Date().toISOString() })
    .eq("id", childId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/manager", (req, res) => res.sendFile(path.join(__dirname, "public", "manager.html")));
app.get("/child", (req, res) => res.sendFile(path.join(__dirname, "public", "child.html")));

app.get("/api/health", (req, res) => ok(res, { status: "running", env: NODE_ENV || "development" }));

app.post("/api/families", asyncRoute(async (req, res) => {
  const family = await createFamilyAccount(req.body);
  return ok(res, { familyCode: family.family_code, managerName: family.manager_name }, 201);
}));

app.post("/api/signup", asyncRoute(async (req, res) => {
  const missing = assertFields(req.body, ["familyName", "managerName", "managerPassword", "childName"]);
  if (missing) return fail(res, 400, missing);

  const family = await createFamilyAccount(req.body);
  let child;
  try {
    child = await createChildAccount(family.id, req.body.childName);
  } catch (error) {
    await supabase.from("families").delete().eq("id", family.id);
    throw error;
  }
  const managerToken = signToken({ family_id: family.id, role: "manager" });

  return ok(res, {
    token: managerToken,
    familyCode: family.family_code,
    managerName: family.manager_name,
    child: {
      childId: child.id,
      childName: child.child_name,
      childCode: child.child_code,
      points: child.points
    }
  }, 201);
}));

app.post("/api/manager/login", asyncRoute(async (req, res) => {
  const missing = assertFields(req.body, ["familyCode", "password"]);
  if (missing) return fail(res, 400, missing);

  const family = await getFamilyByCode(req.body.familyCode);
  if (!family) return fail(res, 401, "Family code or password is incorrect.");

  const valid = await bcrypt.compare(String(req.body.password), family.manager_password_hash);
  if (!valid) return fail(res, 401, "Family code or password is incorrect.");

  const token = signToken({ family_id: family.id, role: "manager" });
  return ok(res, { token, familyCode: family.family_code, managerName: family.manager_name });
}));

app.post("/api/manager/reset-password", asyncRoute(async (req, res) => {
  const missing = assertFields(req.body, ["familyCode", "managerName", "recoveryAnswer", "newPassword"]);
  if (missing) return fail(res, 400, missing);

  const family = await getFamilyByCode(req.body.familyCode);
  if (!family || family.manager_name !== String(req.body.managerName).trim() || !family.recovery_answer_hash) {
    return fail(res, 401, "Password reset information is incorrect.");
  }

  const valid = await bcrypt.compare(String(req.body.recoveryAnswer).trim().toLowerCase(), family.recovery_answer_hash);
  if (!valid) return fail(res, 401, "Password reset information is incorrect.");

  const managerPasswordHash = await bcrypt.hash(req.body.newPassword, 12);
  const { error } = await supabase
    .from("families")
    .update({ manager_password_hash: managerPasswordHash, updated_at: new Date().toISOString() })
    .eq("id", family.id);
  if (error) throw error;
  return ok(res, { message: "Password updated." });
}));

app.get("/api/manager/dashboard", requireManager, asyncRoute(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

  const familyId = req.user.family_id;
  const [{ count: childrenCount }, { data: tasks }, { count: redemptions }, { count: fines }] = await Promise.all([
    supabase.from("children").select("id", { count: "exact", head: true }).eq("family_id", familyId),
    supabase.from("tasks").select("done, photo_url, created_at").eq("family_id", familyId),
    supabase.from("redemptions").select("id", { count: "exact", head: true }).eq("family_id", familyId).gte("created_at", todayIso),
    supabase.from("fines").select("id", { count: "exact", head: true }).eq("family_id", familyId).gte("created_at", todayIso)
  ]);

  const taskList = tasks || [];
  return ok(res, {
    childrenCount: childrenCount || 0,
    todayTasksCount: taskList.filter((task) => new Date(task.created_at) >= today).length,
    doneTasksCount: taskList.filter((task) => task.done).length,
    notDoneTasksCount: taskList.filter((task) => !task.done).length,
    photoSubmittedCount: taskList.filter((task) => Boolean(task.photo_url)).length,
    todayRedemptionsCount: redemptions || 0,
    todayFinesCount: fines || 0
  });
}));

app.post("/api/manager/children", requireManager, asyncRoute(async (req, res) => {
  const data = await createChildAccount(req.user.family_id, req.body.childName);
  return ok(res, { childId: data.id, childName: data.child_name, childCode: data.child_code, points: data.points }, 201);
}));

app.get("/api/manager/children", requireManager, asyncRoute(async (req, res) => {
  const { data, error } = await supabase
    .from("children")
    .select("id, child_name, child_code, points, created_at")
    .eq("family_id", req.user.family_id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ok(res, { children: data });
}));

app.delete("/api/manager/children/:childId", requireManager, asyncRoute(async (req, res) => {
  const { error } = await supabase.from("children").delete().eq("family_id", req.user.family_id).eq("id", req.params.childId);
  if (error) throw error;
  return ok(res, { deleted: true });
}));

app.post("/api/manager/children/:childId/tasks", requireManager, asyncRoute(async (req, res) => {
  const child = await getChildInFamily(req.user.family_id, req.params.childId);
  if (!child) return fail(res, 404, "Child not found.");

  const missing = assertFields(req.body, ["taskName"]);
  if (missing) return fail(res, 400, missing);

  const points = Math.max(1, Number.parseInt(req.body.points, 10) || 1);
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      family_id: req.user.family_id,
      child_id: req.params.childId,
      task_name: String(req.body.taskName).trim(),
      task_note: String(req.body.taskNote || "").trim() || null,
      category: String(req.body.category || "家事").trim(),
      need_photo: Boolean(req.body.needPhoto),
      points
    })
    .select()
    .single();

  if (error) throw error;
  return ok(res, { task: data }, 201);
}));

app.get("/api/manager/children/:childId/tasks", requireManager, asyncRoute(async (req, res) => {
  const child = await getChildInFamily(req.user.family_id, req.params.childId);
  if (!child) return fail(res, 404, "Child not found.");

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("family_id", req.user.family_id)
    .eq("child_id", req.params.childId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ok(res, { tasks: data });
}));

app.delete("/api/manager/children/:childId/tasks/:taskId", requireManager, asyncRoute(async (req, res) => {
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("family_id", req.user.family_id)
    .eq("child_id", req.params.childId)
    .eq("id", req.params.taskId);
  if (error) throw error;
  return ok(res, { deleted: true });
}));

app.post("/api/child/login", asyncRoute(async (req, res) => {
  const missing = assertFields(req.body, ["familyCode", "childCode"]);
  if (missing) return fail(res, 400, missing);

  const family = await getFamilyByCode(req.body.familyCode);
  if (!family) return fail(res, 401, "Family code or child code is incorrect.");

  const { data: child, error } = await supabase
    .from("children")
    .select("id, child_name, points")
    .eq("family_id", family.id)
    .eq("child_code", normalizeCode(req.body.childCode))
    .maybeSingle();
  if (error) throw error;
  if (!child) return fail(res, 401, "Family code or child code is incorrect.");

  const token = signToken({ family_id: family.id, child_id: child.id, role: "child" });
  return ok(res, { token, childName: child.child_name, points: child.points });
}));

app.get("/api/child/me", requireChild, asyncRoute(async (req, res) => {
  const child = await getChildInFamily(req.user.family_id, req.user.child_id);
  if (!child) return fail(res, 404, "Child not found.");
  return ok(res, { childName: child.child_name, childCode: child.child_code, points: child.points });
}));

app.get("/api/child/tasks", requireChild, asyncRoute(async (req, res) => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("family_id", req.user.family_id)
    .eq("child_id", req.user.child_id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ok(res, { tasks: data });
}));

app.post("/api/child/tasks/:taskId/photo", requireChild, upload.single("photo"), asyncRoute(async (req, res) => {
  if (!req.file) return fail(res, 400, "Photo is required.");

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id")
    .eq("family_id", req.user.family_id)
    .eq("child_id", req.user.child_id)
    .eq("id", req.params.taskId)
    .maybeSingle();
  if (taskError) throw taskError;
  if (!task) return fail(res, 404, "Task not found.");

  const ext = path.extname(req.file.originalname).toLowerCase() || ".jpg";
  const storagePath = `${req.user.family_id}/${req.user.child_id}/${req.params.taskId}/${Date.now()}${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(storagePath);
  const photoUrl = publicUrlData.publicUrl;

  const { error: updateError } = await supabase
    .from("tasks")
    .update({ photo_url: photoUrl })
    .eq("id", req.params.taskId);
  if (updateError) throw updateError;

  return ok(res, { photoUrl });
}));

app.put("/api/child/tasks/:taskId/finish", requireChild, asyncRoute(async (req, res) => {
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("*")
    .eq("family_id", req.user.family_id)
    .eq("child_id", req.user.child_id)
    .eq("id", req.params.taskId)
    .maybeSingle();
  if (taskError) throw taskError;
  if (!task) return fail(res, 404, "Task not found.");
  if (task.done) return ok(res, { task, earnedPoints: 0 });
  if (task.need_photo && !task.photo_url) return fail(res, 400, "This task needs a photo before it can be finished.");

  const earnedPoints = task.rewarded ? 0 : Number(task.points || 0);
  if (earnedPoints > 0) await changeChildPoints(req.user.child_id, earnedPoints);

  const { data: updatedTask, error: updateError } = await supabase
    .from("tasks")
    .update({ done: true, rewarded: true, completed_at: new Date().toISOString() })
    .eq("id", req.params.taskId)
    .select()
    .single();
  if (updateError) throw updateError;
  return ok(res, { task: updatedTask, earnedPoints });
}));

app.post("/api/manager/children/:childId/fines", requireManager, asyncRoute(async (req, res) => {
  const child = await getChildInFamily(req.user.family_id, req.params.childId);
  if (!child) return fail(res, 404, "Child not found.");

  const points = Math.max(1, Number.parseInt(req.body.points, 10) || 1);
  const deducted = Math.min(points, Number(child.points || 0));
  const reason = String(req.body.reason || "").trim();
  if (!reason) return fail(res, 400, "reason is required.");

  await changeChildPoints(req.params.childId, -deducted);
  const { data, error } = await supabase
    .from("fines")
    .insert({ family_id: req.user.family_id, child_id: req.params.childId, points, deducted, reason })
    .select()
    .single();
  if (error) throw error;
  return ok(res, { fine: data }, 201);
}));

app.get("/api/manager/children/:childId/fines", requireManager, asyncRoute(async (req, res) => {
  const { data, error } = await supabase
    .from("fines")
    .select("*")
    .eq("family_id", req.user.family_id)
    .eq("child_id", req.params.childId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ok(res, { fines: data });
}));

app.get("/api/child/fines", requireChild, asyncRoute(async (req, res) => {
  const { data, error } = await supabase
    .from("fines")
    .select("*")
    .eq("family_id", req.user.family_id)
    .eq("child_id", req.user.child_id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ok(res, { fines: data });
}));

app.post("/api/manager/shop", requireManager, asyncRoute(async (req, res) => {
  const missing = assertFields(req.body, ["name", "cost"]);
  if (missing) return fail(res, 400, missing);

  const { data, error } = await supabase
    .from("shop_items")
    .insert({
      family_id: req.user.family_id,
      name: String(req.body.name).trim(),
      description: String(req.body.description || "").trim() || null,
      cost: Math.max(1, Number.parseInt(req.body.cost, 10) || 1),
      stock: Math.max(0, Number.parseInt(req.body.stock, 10) || 1),
      active: req.body.active !== false
    })
    .select()
    .single();
  if (error) throw error;
  return ok(res, { item: data }, 201);
}));

app.get("/api/manager/shop", requireManager, asyncRoute(async (req, res) => {
  const { data, error } = await supabase.from("shop_items").select("*").eq("family_id", req.user.family_id).order("created_at", { ascending: false });
  if (error) throw error;
  return ok(res, { items: data });
}));

app.delete("/api/manager/shop/:itemId", requireManager, asyncRoute(async (req, res) => {
  const { error } = await supabase.from("shop_items").update({ active: false }).eq("family_id", req.user.family_id).eq("id", req.params.itemId);
  if (error) throw error;
  return ok(res, { deleted: true });
}));

app.get("/api/child/shop", requireChild, asyncRoute(async (req, res) => {
  const { data, error } = await supabase
    .from("shop_items")
    .select("*")
    .eq("family_id", req.user.family_id)
    .eq("active", true)
    .gt("stock", 0)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ok(res, { items: data });
}));

app.post("/api/child/shop/:itemId/redeem", requireChild, asyncRoute(async (req, res) => {
  const { data: item, error: itemError } = await supabase
    .from("shop_items")
    .select("*")
    .eq("family_id", req.user.family_id)
    .eq("id", req.params.itemId)
    .eq("active", true)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!item || Number(item.stock) <= 0) return fail(res, 404, "Shop item is not available.");

  const child = await getChildInFamily(req.user.family_id, req.user.child_id);
  if (Number(child.points || 0) < Number(item.cost)) return fail(res, 400, "Not enough points.");

  await changeChildPoints(req.user.child_id, -Number(item.cost));
  const { error: stockError } = await supabase
    .from("shop_items")
    .update({ stock: Number(item.stock) - 1, updated_at: new Date().toISOString() })
    .eq("id", item.id);
  if (stockError) throw stockError;

  const { data: redemption, error } = await supabase
    .from("redemptions")
    .insert({
      family_id: req.user.family_id,
      child_id: req.user.child_id,
      shop_item_id: item.id,
      item_name: item.name,
      cost: item.cost
    })
    .select()
    .single();
  if (error) throw error;
  return ok(res, { redemption }, 201);
}));

app.post("/api/manager/encouragements", requireManager, asyncRoute(async (req, res) => {
  const missing = assertFields(req.body, ["message"]);
  if (missing) return fail(res, 400, missing);

  const { data, error } = await supabase
    .from("encouragement_messages")
    .insert({ family_id: req.user.family_id, message: String(req.body.message).trim(), active: req.body.active !== false })
    .select()
    .single();
  if (error) throw error;
  return ok(res, { message: data }, 201);
}));

app.get("/api/manager/encouragements", requireManager, asyncRoute(async (req, res) => {
  const { data, error } = await supabase
    .from("encouragement_messages")
    .select("*")
    .eq("family_id", req.user.family_id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ok(res, { messages: data });
}));

app.get("/api/child/encouragement", requireChild, asyncRoute(async (req, res) => {
  const { data, error } = await supabase
    .from("encouragement_messages")
    .select("message")
    .eq("family_id", req.user.family_id)
    .eq("active", true);
  if (error) throw error;
  if (!data || data.length === 0) return ok(res, { message: "Keep going. Every finished task counts." });
  const item = data[Math.floor(Math.random() * data.length)];
  return ok(res, { message: item.message });
}));

function aiSuggestion(input) {
  const text = String(input || "").trim();
  if (!text) {
    return [
      { taskName: "Tidy one shared area", category: "家事", points: 3, needPhoto: true },
      { taskName: "Read for 15 minutes", category: "學習", points: 2, needPhoto: false },
      { taskName: "Prepare tomorrow's bag", category: "生活", points: 2, needPhoto: true }
    ];
  }

  return [
    { taskName: `${text} - small step`, category: "學習", points: 2, needPhoto: false },
    { taskName: `${text} - show proof`, category: "家事", points: 3, needPhoto: true },
    { taskName: `${text} - finish and reflect`, category: "其他", points: 1, needPhoto: false }
  ];
}

app.post("/api/manager/ai-suggestion", requireManager, (req, res) => {
  return ok(res, { suggestions: aiSuggestion(req.body.prompt) });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (error.status) return fail(res, error.status, error.message);
  if (error instanceof multer.MulterError) return fail(res, 400, error.message);
  if (error.message === "Only image uploads are allowed.") return fail(res, 400, error.message);
  return fail(res, 500, "Server error. Check server logs for details.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Family task server running on port ${PORT}`);
});
