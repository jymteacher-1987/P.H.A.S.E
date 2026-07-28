// ================================================================
// Firebase 설정 파일
// Firebase 콘솔(https://console.firebase.google.com) > 프로젝트 설정 >
// "내 앱" > 웹 앱(</>) 에서 나오는 firebaseConfig 값을 아래에 그대로 붙여넣으세요.
// (배포 가이드 문서 2단계 참고)
// ================================================================
window.FIREBASE_CONFIG = {
  apiKey: "여기에-API-KEY-입력",
  authDomain: "여기에-PROJECT_ID.firebaseapp.com",
  projectId: "여기에-PROJECT_ID",
  storageBucket: "여기에-PROJECT_ID.appspot.com",
  messagingSenderId: "여기에-SENDER_ID",
  appId: "여기에-APP_ID"
};

// 관리자 로그인에 사용할 이메일 (Firebase Authentication에 등록한 계정)
// 이 값은 "누가 관리자 UI를 볼 수 있는지"를 프론트에서 표시용으로만 쓰는 값이고,
// 실제 쓰기 권한은 firestore.rules / storage.rules 에서 강제됩니다.
window.ADMIN_EMAIL = "extraboy2@gmail.com";
