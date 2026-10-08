(() => {
  'use strict';
  const dialog = document.querySelector('#record-mode-dialog');
  document.querySelector('#open-record-options').addEventListener('click', () => { if (!dialog.open) dialog.showModal(); });
  document.querySelector('#close-record-options').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target !== dialog) return; const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); });
  if (document.documentElement.dataset.clayAssets === 'ready') {
    document.querySelectorAll('.clay-asset').forEach(img => {
      img.addEventListener('load', () => { img.hidden = false; img.closest('.illustration').classList.add('has-clay'); });
      img.addEventListener('error', () => { img.hidden = true; img.closest('.illustration').classList.remove('has-clay'); });
      img.src = img.dataset.src;
    });
  }
})();
