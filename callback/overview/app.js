(() => {
  'use strict';
  const accountDialog=document.querySelector('#account-connect-dialog'),accountButton=document.querySelector('#open-account-connect'),accountForm=document.querySelector('#account-connect-form');
  let accountClient,accountTicket=0;
  const connection=import('../account-connection.js?v=20261113-account1').then(module=>{accountClient=module.createAccountConnection();accountButton.hidden=module.readExistingConnection().connected;return module;}).catch(()=>{document.querySelector('#account-connect-summary').textContent='개인 연결을 확인하지 못했어요. 잠시 후 다시 열어 주세요.';});
  accountButton.addEventListener('click',async()=>{await connection;if(!accountClient)return;document.querySelector('#account-connect-status').textContent='';accountDialog.showModal();document.querySelector('#account-connect-id').focus();});
  document.querySelector('#cancel-account-connect').addEventListener('click',()=>accountDialog.close());
  accountDialog.addEventListener('close',()=>{accountTicket++;accountClient?.cancel();document.querySelector('#account-connect-password').value='';accountForm.querySelector('[type=submit]').disabled=false;(accountButton.hidden?document.querySelector('.legacy-records-link'):accountButton).focus();});
  accountForm.addEventListener('submit',async event=>{event.preventDefault();const ticket=++accountTicket,submit=accountForm.querySelector('[type=submit]'),status=document.querySelector('#account-connect-status');submit.disabled=true;status.textContent='본인 기록 연결을 확인하고 있어요…';try{await connection;await accountClient.connect(document.querySelector('#account-connect-id').value.trim(),document.querySelector('#account-connect-password').value);if(ticket!==accountTicket)return;accountDialog.close();location.href='../sheets/index.html?view=archive';}catch(error){if(ticket!==accountTicket)return;status.textContent=error.code==='callback/profile-missing'?'워크북에서 내 콜백 링크를 먼저 확인해 주세요.':error.code==='callback/account-changed'?'이미 연결된 계정이 있어요. 기존 개인 콜백 링크를 확인해 주세요.':'계정 연결을 확인하지 못했어요. 아이디와 비밀번호를 확인하고 다시 시도해 주세요.';}finally{if(ticket===accountTicket){document.querySelector('#account-connect-password').value='';submit.disabled=false;}}});
  window.addEventListener('presence-callback-connected',()=>{accountButton.hidden=true;});
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
