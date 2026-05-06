/**

 * RPBDD auth pages — password visibility toggles.

 * Masked (••••): shows “eye closed” (slash). Visible plain text: shows “eye open”.

 * Uses document-level delegation so toggles work in dynamically rendered markup (e.g. team cards).

 */

(function () {

  'use strict';



  function syncToggleButton(btn, input) {

    if (!input) return;

    var masked = input.type === 'password';

    var iconMasked = btn.querySelector('.rpbdd-toggle-pw__icon--masked');

    var iconVisible = btn.querySelector('.rpbdd-toggle-pw__icon--visible');

    if (iconMasked) iconMasked.hidden = !masked;

    if (iconVisible) iconVisible.hidden = masked;

    btn.setAttribute('aria-label', masked ? 'Show password' : 'Hide password');

    btn.setAttribute('aria-pressed', masked ? 'false' : 'true');

  }



  function syncAllTogglesIn(root) {

    var scope = root && root.querySelectorAll ? root : document;

    scope.querySelectorAll('[data-toggle-password]').forEach(function (btn) {

      var id = btn.getAttribute('data-toggle-password');

      var input = id ? document.getElementById(id) : null;

      if (input) syncToggleButton(btn, input);

    });

  }



  document.addEventListener('click', function (e) {

    var btn = e.target.closest('[data-toggle-password]');

    if (!btn) return;

    var tid = btn.getAttribute('data-toggle-password');

    var inp = tid ? document.getElementById(tid) : null;

    if (!inp) return;

    e.preventDefault();

    var show = inp.type === 'password';

    inp.type = show ? 'text' : 'password';

    syncToggleButton(btn, inp);

  });



  syncAllTogglesIn(document);



  window.rpbddSyncPasswordToggles = syncAllTogglesIn;

})();


