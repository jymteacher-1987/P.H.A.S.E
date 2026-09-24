// ================================================================
// P.H.A.S.E 시뮬레이션 오류 신고 메일 (Google Apps Script 웹 앱)
// 사이트의 신고 창(assets/js/report.js)이 이 웹 앱으로 내용을 보내면
// 아래 RECIPIENT 로만 메일을 보낸다. 사이트가 보낸 값으로는 받는 사람을 바꿀 수 없다.
// 배포 방법은 같은 폴더의 README.md 를 본다.
// ================================================================
var RECIPIENT = 'jymteacher@naver.com';      // 받는 사람 — 고정
var MAX_PER_HOUR = 20;                        // 한 시간에 보낼 수 있는 신고 수
var MAX_PER_DAY = 80;                         // 하루에 보낼 수 있는 신고 수 (Gmail 한도 100통보다 적게)

function doGet() {
  return reply({ ok: true, service: 'phase-error-report' });
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents || '';
    if (raw.length > 20000) return reply({ ok: false, error: 'TOO_LARGE' });
    var data = JSON.parse(raw || '{}');
    // 사람에게는 보이지 않는 빈칸이 채워졌으면 자동 전송으로 보고 조용히 넘긴다.
    if (clean(data.website, 200)) return reply({ ok: true });
    var message = clean(data.message, 2000);
    if (message.length < 5) return reply({ ok: false, error: 'EMPTY' });
    if (!takeQuota()) return reply({ ok: false, error: 'LIMIT' });

    var title = oneLine(clean(data.activityTitle, 120)) || '사이트 전체 · 기타';
    var contact = oneLine(clean(data.contact, 120));
    var replyTo = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(contact) ? contact : '';
    var body = [
      '활동: ' + title + (clean(data.activityId, 80) ? ' (' + oneLine(clean(data.activityId, 80)) + ')' : ''),
      '',
      message,
      '',
      '답장 받을 이메일: ' + (contact || '적지 않음'),
      '기기: ' + oneLine(clean(data.device, 300)),
      '브라우저 정보: ' + oneLine(clean(data.userAgent, 400)),
      '페이지: ' + oneLine(clean(data.page, 400)),
      '보낸 시각: ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss') + ' (한국 시각)'
    ].join('\n');
    var options = { name: 'P.H.A.S.E 오류 신고' };
    if (replyTo) options.replyTo = replyTo;
    MailApp.sendEmail(RECIPIENT, '[P.H.A.S.E 오류 신고] ' + title, body, options);
    return reply({ ok: true });
  } catch (error) {
    return reply({ ok: false, error: 'SERVER' });
  }
}

function clean(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
}

function oneLine(text) {
  return String(text).replace(/[\r\n]+/g, ' ');
}

// 여러 신고가 한꺼번에 와도 한도를 넘지 않도록 잠근 채 센다.
function takeQuota() {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var cache = CacheService.getScriptCache();
    var hourKey = 'hour-' + Math.floor(Date.now() / 3600000);
    var dayKey = 'day-' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');
    var hour = Number(cache.get(hourKey) || 0), day = Number(cache.get(dayKey) || 0);
    if (hour >= MAX_PER_HOUR || day >= MAX_PER_DAY) return false;
    cache.put(hourKey, String(hour + 1), 3700);
    cache.put(dayKey, String(day + 1), 90000);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function reply(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
