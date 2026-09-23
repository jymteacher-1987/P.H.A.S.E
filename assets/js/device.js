/* Screen size and touch support also describe desktop windows and laptops.
   Only phones/tablets should opt into automatic immersive activity launch. */
(function () {
  const ua = navigator.userAgent || '';
  const isPhone = navigator.userAgentData?.mobile === true
    || /iPhone|iPod/i.test(ua)
    || (/Android/i.test(ua) && /Mobile/i.test(ua));
  const isPhoneOrTablet = navigator.userAgentData?.mobile === true
    || /Android|iPhone|iPad|iPod/i.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  window.PHASE_DEVICE = Object.freeze({ isPhoneOrTablet, isPhone });
  document.documentElement.classList.toggle('phone-tablet', isPhoneOrTablet);
  document.documentElement.classList.toggle('phone-device', isPhone);
})();
