(function () {
  const el = (id) => document.getElementById(id);
  function showMessage(node, kind, message) {
    node.className = `msg ${kind}`;
    node.textContent = message;
    node.style.display = 'block';
  }
  if (typeof firebase === 'undefined' || typeof SITE === 'undefined' || !SITE.isFirebaseConfigured()) {
    showMessage(el('loginMsg'), 'error', '관리자 연결을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침해주세요.');
    el('loginBtn').disabled = true;
    return;
  }

  // 기존 관리자 로그인 앱과 계정을 유지한다. 공개 목록용 SITE 앱은 읽기만 한다.
  let app, auth, db;
  try {
    app = firebase.apps.find((item) => item.name === '[DEFAULT]') || firebase.initializeApp(window.FIREBASE_CONFIG);
    auth = app.auth();
    db = app.firestore();
  } catch (_) {
    showMessage(el('loginMsg'), 'error', '관리자 연결을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침해주세요.');
    el('loginBtn').disabled = true;
    return;
  }
  // 소개 수정에는 Storage가 필요 없다. 해당 SDK가 차단되어도 편집기는 작동한다.
  function getStorage() {
    if (typeof app.storage !== 'function') throw new Error('Storage unavailable');
    return app.storage();
  }
  const ADMIN_EMAIL = window.ADMIN_EMAIL;
  let catalog = null;
  let items = [];
  let loadVersion = 0;
  let saving = false;
  let dirty = false;
  let lessonDirty = false;
  let selectedId = '';
  let legacyLoaded = false;

  // ---------- 로그인 ----------
  el('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    el('loginMsg').style.display = 'none';
    el('loginBtn').disabled = true;
    try {
      await auth.signInWithEmailAndPassword(el('loginEmail').value.trim(), el('loginPassword').value);
      el('loginPassword').value = '';
    } catch (_) {
      showMessage(el('loginMsg'), 'error', '로그인 실패: 이메일, 비밀번호와 인터넷 연결을 확인해주세요.');
    } finally { el('loginBtn').disabled = false; }
  });

  el('logoutBtn').addEventListener('click', async () => {
    if (saving || ((dirty || lessonDirty) && !confirm('저장하지 않은 변경 내용을 버리고 로그아웃할까요?'))) return;
    try { await auth.signOut(); }
    catch (_) { showMessage(el('catalogMsg'), 'error', '로그아웃하지 못했습니다. 다시 시도해주세요.'); }
  });

  auth.onAuthStateChanged((user) => {
    const isAdmin = user && user.email === ADMIN_EMAIL;
    el('loginCard').style.display = isAdmin ? 'none' : 'block';
    el('dashCard').style.display = isAdmin ? 'block' : 'none';
    if (isAdmin) {
      loadCategories();
      loadCatalog();
    } else {
      loadVersion++;
      catalog = null;
      items = [];
      dirty = false;
      lessonDirty = false;
      if (user) {
        showMessage(el('loginMsg'), 'error', '관리자 권한이 없는 계정입니다.');
        auth.signOut().catch(() => {});
      }
    }
  });

  function metadataOf(item) {
    return { title: item.title || '', description: item.description || '', tags: item.tags || [], listed: true };
  }
  function selection() { return items.find((item) => item.id === selectedId); }
  function canEdit() { return Boolean(selection() && catalog?.catalogStatus.overrides === 'ready'); }
  function canEditNote() { return Boolean(selection() && selection().section !== 'play' && catalog?.catalogStatus.lessonNotes === 'ready'); }
  function setBusy(busy) {
    saving = busy;
    el('catalogFields').disabled = busy || !canEdit();
    el('lessonFields').disabled = busy || !canEditNote();
    el('catalogItem').disabled = busy || items.length === 0;
    el('catalogReload').disabled = busy;
    el('logoutBtn').disabled = busy;
    el('catalogSave').textContent = busy ? '저장 확인 중…' : '변경 내용 저장';
    el('catalogRestore').disabled = !catalog?.overrides[selectedId];
    el('lessonSave').textContent = busy ? '저장 확인 중…' : '길잡이 저장';
    el('lessonRestore').disabled = !catalog?.lessonNotes?.[selectedId];
  }
  function renderSummary(node, value) {
    node.replaceChildren();
    for (const [label, text] of [
      ['제목', value.title], ['설명', value.description || '없음'],
      ['태그', value.tags.join(', ') || '없음'], ['목록 표시', value.listed ? '표시' : '숨김'],
    ]) {
      const term = document.createElement('dt');
      const detail = document.createElement('dd');
      term.textContent = label;
      detail.textContent = text;
      node.append(term, detail);
    }
  }
  function renderMetadataSelection() {
    const item = selection();
    if (!item) return;
    const original = metadataOf(item);
    const saved = catalog.overrides[item.id];
    const value = saved || original;
    el('catalogTitle').value = value.title;
    el('catalogDescription').value = value.description;
    el('catalogTags').value = value.tags.join(', ');
    el('catalogListed').checked = value.listed;
    el('catalogComparison').hidden = false;
    renderSummary(el('catalogOriginal'), original);
    if (saved) {
      renderSummary(el('catalogSaved'), saved);
      const date = typeof saved.updatedAt?.toDate === 'function' ? saved.updatedAt.toDate() : null;
      el('catalogSavedStatus').textContent = date ? `마지막 저장: ${date.toLocaleString('ko-KR')}` : '저장된 소개를 사용하고 있습니다.';
    } else {
      el('catalogSaved').replaceChildren();
      el('catalogSavedStatus').textContent = catalog.catalogStatus.overrides === 'ready'
        ? '별도 저장된 정보가 없어 원래 정보를 사용합니다.'
        : '저장된 정보를 확인하지 못했습니다. 새로 불러온 뒤 수정해주세요.';
    }
    dirty = false;
    setBusy(false);
  }
  function renderLessonSelection() {
    const item = selection();
    if (!item) return;
    el('lessonEditor').hidden = item.section === 'play';
    const saved = catalog.lessonNotes?.[item.id];
    const note = saved || (item.lessonNote ? { ...item.lessonNote, visible: true } : null);
    el('lessonQuestion').value = note?.question || '';
    el('lessonFocus').value = note?.focus || '';
    el('lessonVisible').checked = note?.visible !== false;
    el('lessonSavedStatus').textContent = saved
      ? 'Firebase에 저장한 메모를 사용하고 있습니다.'
      : item.lessonNote ? '감수한 기본 문구를 사용하고 있습니다.' : '아직 작성한 메모가 없습니다.';
    lessonDirty = false;
    setBusy(false);
  }
  function renderSelection() {
    renderMetadataSelection();
    renderLessonSelection();
  }
  function renderOptions(preferredId) {
    const select = el('catalogItem');
    select.replaceChildren();
    for (const [label, entries] of [['가상 실험', catalog.experiments], ['과학 놀이', catalog.plays]]) {
      if (!entries.length) continue;
      const group = document.createElement('optgroup');
      group.label = label;
      for (const item of entries) {
        const option = document.createElement('option');
        const saved = catalog.overrides[item.id];
        option.value = item.id;
        option.textContent = `${saved?.title || item.title}${saved?.listed === false ? ' · 목록 숨김' : ''}`;
        group.append(option);
      }
      select.append(group);
    }
    selectedId = items.some((item) => item.id === preferredId) ? preferredId : items[0]?.id || '';
    select.value = selectedId;
  }
  async function loadCatalog() {
    const version = ++loadVersion;
    el('catalogFields').disabled = true;
    el('catalogItem').disabled = true;
    el('catalogReload').disabled = true;
    el('catalogMsg').style.display = 'none';
    el('catalogLoadStatus').textContent = '저장된 소개와 목록을 불러오는 중…';
    try {
      const data = await SITE.getCatalogEditorData();
      if (version !== loadVersion) return;
      catalog = data;
      items = [...data.experiments, ...data.plays];
      renderOptions(selectedId);
      renderSelection();
      const notes = [];
      if (data.catalogStatus.overrides !== 'ready') notes.push('저장된 소개를 읽지 못했습니다. 연결과 Firestore 규칙을 확인한 뒤 새로 불러오세요. 현재는 원래 정보를 보여줍니다.');
      else notes.push(`${items.length}개 활동 · Firebase 연결됨`);
      if (data.catalogStatus.lessonNotes !== 'ready') notes.push('실험 길잡이를 읽지 못했습니다. 연결과 Firestore 규칙을 확인하세요. 기본 문구는 그대로 표시됩니다.');
      if (data.catalogStatus.experiments !== 'ready') notes.push('기존 Firebase 업로드 목록을 확인하지 못했습니다.');
      if (data.invalidOverrideCount) notes.push(`형식이 맞지 않는 저장 정보 ${data.invalidOverrideCount}개는 적용하지 않았습니다.`);
      if (data.invalidLessonNoteCount) notes.push(`형식이 맞지 않는 실험 길잡이 ${data.invalidLessonNoteCount}개는 적용하지 않았습니다.`);
      el('catalogLoadStatus').textContent = notes.join(' ');
    } catch (_) {
      el('catalogLoadStatus').textContent = '목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
    } finally {
      if (version === loadVersion) setBusy(false);
    }
  }
  el('catalogReload').addEventListener('click', () => {
    if ((dirty || lessonDirty) && !confirm('저장하지 않은 변경 내용을 버리고 다시 불러올까요?')) return;
    loadCatalog();
  });
  el('catalogItem').addEventListener('change', () => {
    if ((dirty || lessonDirty) && !confirm('저장하지 않은 변경 내용을 버리고 다른 활동을 선택할까요?')) {
      el('catalogItem').value = selectedId;
      return;
    }
    selectedId = el('catalogItem').value;
    el('catalogMsg').style.display = 'none';
    renderSelection();
  });
  el('catalogForm').addEventListener('input', () => { dirty = true; });
  el('lessonForm').addEventListener('input', () => { lessonDirty = true; });
  window.addEventListener('beforeunload', (event) => {
    if (!dirty && !lessonDirty && !saving) return;
    event.preventDefault();
    event.returnValue = '';
  });

  function saveError(error) {
    if (error?.code === 'permission-denied') return '저장 권한이 없습니다. 관리자 계정과 catalogOverrides의 Firestore 규칙을 확인해주세요. 변경 내용은 저장되지 않았습니다.';
    return '저장을 확인하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해주세요. 입력한 내용은 그대로 남아 있습니다.';
  }
  async function saveMetadata(restore, value) {
    if (saving || !canEdit()) return;
    const id = selectedId;
    setBusy(true);
    showMessage(el('catalogMsg'), 'info', restore ? '원래 정보로 복원하는 중…' : 'Firebase에 저장하는 중…');
    // 오프라인 쓰기는 나중에 전송될 수 있다. 시간 초과를 성공/실패로 단정하지 않는다.
    const waiting = setTimeout(() => {
      showMessage(el('catalogMsg'), 'info', '아직 저장 응답을 기다리고 있습니다. 인터넷 연결을 확인하고 이 화면을 열어두세요.');
    }, 8000);
    try {
      const ref = db.collection('catalogOverrides').doc(id);
      if (restore) await ref.delete();
      else await ref.set({ ...value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      if (restore) delete catalog.overrides[id];
      else catalog.overrides[id] = { ...value, updatedAt: null };
      renderOptions(id);
      renderMetadataSelection();
      showMessage(el('catalogMsg'), 'success', restore
        ? '원래 정보로 복원했습니다. 목록을 다시 열면 반영됩니다.'
        : '저장했습니다. 방문자가 목록을 다시 열면 변경 내용이 반영됩니다.');
    } catch (error) {
      showMessage(el('catalogMsg'), 'error', saveError(error));
    } finally {
      clearTimeout(waiting);
      setBusy(false);
    }
  }
  el('catalogForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const result = SITE.validateCatalogMetadata({
      title: el('catalogTitle').value.trim(), description: el('catalogDescription').value.trim(),
      tags: el('catalogTags').value.split(',').map((tag) => tag.trim()).filter(Boolean),
      listed: el('catalogListed').checked,
    });
    if (result.error) { showMessage(el('catalogMsg'), 'error', result.error); return; }
    saveMetadata(false, result.value);
  });
  el('catalogRestore').addEventListener('click', () => {
    if (!canEdit() || !catalog.overrides[selectedId]) return;
    if (confirm('저장된 소개를 삭제하고 원래 정보와 목록 표시 상태로 복원할까요?')) saveMetadata(true);
  });

  async function saveLessonNote(restore, value) {
    if (saving || !canEditNote()) return;
    const id = selectedId;
    setBusy(true);
    showMessage(el('lessonMsg'), 'info', restore ? '기본 문구로 되돌리는 중…' : '실험 길잡이를 저장하는 중…');
    const waiting = setTimeout(() => {
      showMessage(el('lessonMsg'), 'info', '아직 저장 응답을 기다리고 있습니다. 인터넷 연결을 확인하고 이 화면을 열어두세요.');
    }, 8000);
    try {
      const ref = db.collection('lessonNotes').doc(id);
      if (restore) await ref.delete();
      else await ref.set({ ...value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      if (restore) delete catalog.lessonNotes[id];
      else catalog.lessonNotes[id] = { ...value, updatedAt: null };
      renderLessonSelection();
      showMessage(el('lessonMsg'), 'success', restore
        ? '기본 문구로 되돌렸습니다. 새로 열면 반영됩니다.'
        : '실험 길잡이를 저장했습니다. 방문자가 새로 열면 반영됩니다.');
    } catch (error) {
      showMessage(el('lessonMsg'), 'error', error?.code === 'permission-denied'
        ? '저장 권한이 없습니다. 관리자 계정과 lessonNotes의 Firestore 규칙을 확인해주세요.'
        : '저장을 확인하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해주세요. 입력한 내용은 그대로 남아 있습니다.');
    } finally {
      clearTimeout(waiting);
      setBusy(false);
    }
  }
  el('lessonForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const result = SITE.validateLessonNote({
      question: el('lessonQuestion').value.trim(), focus: el('lessonFocus').value.trim(),
      visible: el('lessonVisible').checked,
    });
    if (result.error) { showMessage(el('lessonMsg'), 'error', result.error); return; }
    saveLessonNote(false, result.value);
  });
  el('lessonRestore').addEventListener('click', () => {
    if (!canEditNote() || !catalog.lessonNotes?.[selectedId]) return;
    if (confirm('Firebase에 저장한 메모를 삭제하고 기본 문구로 되돌릴까요?')) saveLessonNote(true);
  });

  // ---------- 기존 파일 업로드 (Storage를 사용하는 환경을 위해 보존) ----------
  function loadCategories() {
    const select = el('fCategory');
    select.replaceChildren();
    for (const category of window.EXPERIMENTS_DATA?.categories || []) {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = `${category.icon} ${category.name}`;
      select.append(option);
    }
  }
  el('legacyUploads').addEventListener('toggle', () => {
    if (el('legacyUploads').open && !legacyLoaded) { legacyLoaded = true; loadUploadedList(); }
  });
  el('uploadForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = el('fFile').files[0];
    if (!file) return;
    const title = el('fTitle').value.trim();
    el('uploadBtn').disabled = true;
    el('uploadBtn').textContent = '업로드 중…';
    el('uploadMsg').style.display = 'none';
    try {
      const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const ref = getStorage().ref(`experiments/${id}.html`);
      await ref.put(file, { contentType: 'text/html' });
      const fileUrl = await ref.getDownloadURL();
      await db.collection('experiments').doc(id).set({
        title, category: el('fCategory').value, description: el('fDesc').value.trim(),
        tags: el('fTags').value.split(',').map((tag) => tag.trim()).filter(Boolean),
        fileUrl, date: new Date().toISOString().slice(0, 10),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      showMessage(el('uploadMsg'), 'success', `“${title}” 업로드 완료! 목록에 반영됩니다.`);
      el('uploadForm').reset();
      loadUploadedList();
      loadCatalog();
    } catch (_) { showMessage(el('uploadMsg'), 'error', '업로드하지 못했습니다. 현재 프로젝트의 Storage 사용 설정을 확인해주세요.'); }
    finally { el('uploadBtn').disabled = false; el('uploadBtn').textContent = '파일 업로드'; }
  });
  async function loadUploadedList() {
    const list = el('uploadedList');
    list.textContent = '불러오는 중…';
    try {
      const snap = await db.collection('experiments').orderBy('createdAt', 'desc').get({ source: 'server' });
      list.replaceChildren();
      if (snap.empty) { list.textContent = '아직 업로드한 실험이 없습니다.'; return; }
      for (const doc of snap.docs) {
        const value = doc.data();
        const row = document.createElement('div'); row.className = 'admin-row';
        const content = document.createElement('div');
        const title = document.createElement('div'); title.className = 'r-title'; title.textContent = value.title;
        const category = document.createElement('div'); category.className = 'r-cat'; category.textContent = `${value.category} · ${value.date || ''}`;
        content.append(title, category);
        const remove = document.createElement('button'); remove.className = 'r-del catalog-text-button'; remove.type = 'button'; remove.textContent = '삭제';
        remove.addEventListener('click', async () => {
          if (!confirm('정말 삭제하시겠습니까? 사이트에서 즉시 사라집니다.')) return;
          remove.disabled = true;
          try {
            const fileRef = value.fileUrl ? getStorage().refFromURL(value.fileUrl) : null;
            await db.collection('experiments').doc(doc.id).delete();
            if (fileRef) await fileRef.delete();
            showMessage(el('uploadMsg'), 'success', '업로드한 실험을 삭제했습니다.');
          } catch (_) { showMessage(el('uploadMsg'), 'error', '삭제를 완료하지 못했습니다. 목록과 Storage를 확인해주세요.'); }
          loadUploadedList();
          loadCatalog();
        });
        row.append(content, remove);
        list.append(row);
      }
    } catch (_) { list.textContent = '목록을 불러오지 못했습니다. 인터넷 연결을 확인해주세요.'; }
  }
})();
