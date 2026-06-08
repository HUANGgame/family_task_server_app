const signupStore = storage("manager");

qs("#signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = qs("#signupStatus");
  setStatus(status, "建立中...");

  try {
    const data = await api("/api/signup", { method: "POST", body: formData(event.target) });
    signupStore.token = data.token;
    sessionStorage.setItem("manager:familyCode", data.familyCode);
    qs("#resultFamilyCode").textContent = data.familyCode;
    qs("#resultChildCode").textContent = data.child.childCode;
    qs("#signupResult").classList.remove("hidden");
    event.target.classList.add("hidden");
    setStatus(status, "");
  } catch (error) {
    setStatus(status, error.message, true);
  }
});
