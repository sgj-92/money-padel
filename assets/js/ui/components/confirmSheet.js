// ===================== UI: A QUESTION, AS A SHEET =====================
// Shaun, 22 Nov: "Replace modals with mobile-friendly slide-up drawers."
// The browser's grey confirm box becomes a sheet from the bottom with two
// big buttons. -> Promise<boolean>. Declarations only.

function confirmSheet(text, opts){
  const o = opts || {};
  return new Promise((resolve) => {
    let sheet = document.getElementById('confirmSheet');
    if(!sheet){
      sheet = document.createElement('div');
      sheet.className = 'shell-more-sheet';
      sheet.id = 'confirmSheet';
      document.body.appendChild(sheet);
    }
    sheet.innerHTML = `<div class="shell-more-panel cf-panel" role="alertdialog" aria-modal="true" aria-labelledby="confirmSheetText">
      ${o.title ? `<h3>${escapeHtml(o.title)}</h3>` : ''}
      <p class="cf-text" id="confirmSheetText">${escapeHtml(text)}</p>
      <div class="cf-actions">
        <button type="button" class="cf-ok${o.danger ? ' is-danger' : ''}">${escapeHtml(o.ok || 'OK')}</button>
        <button type="button" class="cf-cancel">${escapeHtml(o.cancel || 'Cancel')}</button>
      </div></div>`;
    let done = false;
    const finish = (answer) => {
      if(done) return; done = true;
      observer.disconnect();
      sheet.classList.remove('show');
      resolve(answer);
    };
    // Closed any other way (backdrop, swipe, Back) is a no.
    const observer = new MutationObserver(() => { if(!sheet.classList.contains('show')) finish(false); });
    sheet.onclick = (e) => { if(e.target === sheet) finish(false); };
    sheet.querySelector('.cf-ok').onclick = () => finish(true);
    sheet.querySelector('.cf-cancel').onclick = () => finish(false);
    sheet.classList.add('show');
    observer.observe(sheet, { attributes: true, attributeFilter: ['class'] });
    sheet.querySelector('.cf-ok').focus({ preventScroll: true });
  });
}
