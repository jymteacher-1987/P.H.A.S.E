// ================================================================
// Firebase 설정 파일
// Firebase 콘솔(https://console.firebase.google.com) > 프로젝트 설정 >
// "내 앱" > 웹 앱(</>) 에서 나오는 firebaseConfig 값을 아래에 그대로 붙여넣으세요.
// (배포 가이드 문서 2단계 참고)
// ================================================================
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBTv7FPJQBtED1cqefzV8zyi3dqvJ5PAqE",
  authDomain: "physics-lab-b0591.firebaseapp.com",
  projectId: "physics-lab-b0591",
  storageBucket: "physics-lab-b0591.firebasestorage.app",
  messagingSenderId: "678968269888",
  appId: "1:678968269888:web:40fc6804666d0546f493a5"
};

// 관리자 로그인에 사용할 이메일 (Firebase Authentication에 등록한 계정)
// 이 값은 "누가 관리자 UI를 볼 수 있는지"를 프론트에서 표시용으로만 쓰는 값이고,
// 실제 쓰기 권한은 firestore.rules / storage.rules 에서 강제됩니다.
window.ADMIN_EMAIL = "phase@phase.com";
