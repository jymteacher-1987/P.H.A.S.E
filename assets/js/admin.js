(function () {
  if (!window.FIREBASE_CONFIG || String(window.FIREBASE_CONFIG.apiKey).includes("여기에")) {
    document.getElementById("loginMsg").textContent =
      "Firebase 설정이 아직 안 되어 있습니다. assets/js/firebase-config.js 파일에 설정값을 입력해주세요. (배포 가이드 참고)";
    document.getElementById("loginMsg").style.display = "block";
    document.getElementById("loginBtn").disabled = true;
    return;
  }

  firebase.initializeApp(window.FIREBASE_CONFIG);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const storage = firebase.storage();
  const ADMIN_EMAIL = window.ADMIN_EMAIL;

  const loginCard = document.getElementById("loginCard");
  const dashCard = document.getElementById("dashCard");
  const loginMsg = document.getElementById("loginMsg");
  const uploadMsg = document.getElementById("uploadMsg");

  // ---------- 로그인 ----------
  document.getElementById("loginBtn").addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    loginMsg.style.display = "none";
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (e) {
      loginMsg.textContent = "로그인 실패: 이메일 또는 비밀번호를 확인해주세요.";
      loginMsg.style.display = "block";
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", (e) => {
    e.preventDefault();
    auth.signOut();
  });

  auth.onAuthStateChanged((user) => {
    if (user && user.email === ADMIN_EMAIL) {
      loginCard.style.display = "none";
      dashCard.style.display = "block";
      loadCategories();
      loadUploadedList();
    } else {
      loginCard.style.display = "block";
      dashCard.style.display = "none";
      if (user && user.email !== ADMIN_EMAIL) {
        loginMsg.textContent = "관리자 권한이 없는 계정입니다.";
        loginMsg.style.display = "block";
        auth.signOut();
      }
    }
  });

  // ---------- 카테고리 옵션 ----------
  function loadCategories() {
    const data = window.EXPERIMENTS_DATA || { categories: [] };
    const sel = document.getElementById("fCategory");
    sel.innerHTML = data.categories.map((c) => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join("");
  }

  // ---------- 업로드 ----------
  document.getElementById("uploadForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("uploadBtn");
    const file = document.getElementById("fFile").files[0];
    const title = document.getElementById("fTitle").value.trim();
    const category = document.getElementById("fCategory").value;
    const description = document.getElementById("fDesc").value.trim();
    const tags = document
      .getElementById("fTags")
      .value.split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    uploadMsg.style.display = "none";
    if (!file) return;

    btn.disabled = true;
    btn.textContent = "업로드 중…";

    try {
      const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const storageRef = storage.ref(`experiments/${id}.html`);
      await storageRef.put(file, { contentType: "text/html" });
      const fileUrl = await storageRef.getDownloadURL();

      await db.collection("experiments").doc(id).set({
        title,
        category,
        description,
        tags,
        fileUrl,
        date: new Date().toISOString().slice(0, 10),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      uploadMsg.className = "msg success";
      uploadMsg.textContent = `"${title}" 업로드 완료! 사이트에 바로 반영됩니다.`;
      uploadMsg.style.display = "block";
      document.getElementById("uploadForm").reset();
      loadUploadedList();
    } catch (err) {
      console.error(err);
      uploadMsg.className = "msg error";
      uploadMsg.textContent = "업로드 실패: " + err.message;
      uploadMsg.style.display = "block";
    } finally {
      btn.disabled = false;
      btn.textContent = "업로드";
    }
  });

  // ---------- 업로드 목록 + 삭제 ----------
  async function loadUploadedList() {
    const listEl = document.getElementById("uploadedList");
    listEl.innerHTML = "불러오는 중…";
    try {
      const snap = await db.collection("experiments").orderBy("createdAt", "desc").get();
      if (snap.empty) {
        listEl.innerHTML = `<p style="color:var(--text-faint); font-size:13px;">아직 업로드한 실험이 없습니다.</p>`;
        return;
      }
      listEl.innerHTML = snap.docs
        .map((d) => {
          const v = d.data();
          return `
          <div class="admin-row">
            <div>
              <div class="r-title">${v.title}</div>
              <div class="r-cat">${v.category} · ${v.date || ""}</div>
            </div>
            <a href="#" class="r-del" data-id="${d.id}" data-url="${v.fileUrl}">삭제</a>
          </div>`;
        })
        .join("");

      listEl.querySelectorAll(".r-del").forEach((el) => {
        el.addEventListener("click", async (e) => {
          e.preventDefault();
          if (!confirm("정말 삭제하시겠습니까? 사이트에서 즉시 사라집니다.")) return;
          const id = el.dataset.id;
          const url = el.dataset.url;
          try {
            await db.collection("experiments").doc(id).delete();
            if (url) await storage.refFromURL(url).delete();
          } catch (err) {
            console.warn("삭제 중 오류:", err);
          }
          loadUploadedList();
        });
      });
    } catch (e) {
      listEl.innerHTML = `<p style="color:var(--accent-warn); font-size:13px;">목록을 불러오지 못했습니다.</p>`;
    }
  }
})();
