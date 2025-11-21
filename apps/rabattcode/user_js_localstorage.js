const checkBtn = document.getElementById('checkBtn');
const resultSection = document.getElementById('resultSection');
const resCode = document.getElementById('resCode');
const resType = document.getElementById('resType');
const resGroup = document.getElementById('resGroup');
const resExpire = document.getElementById('resExpire');
const resStatus = document.getElementById('resStatus');

checkBtn.addEventListener('click', () => {
  const codeInput = document.getElementById('codeInput').value.trim();
  if (!codeInput) return alert('Bitte Code eingeben');

  let codes = JSON.parse(localStorage.getItem('codes') || '[]');
  const code = codes.find(c => c.code === codeInput);

  if (!code) return alert('Code nicht gefunden');

  resCode.textContent = code.code;
  resType.textContent = code.type;
  resGroup.textContent = code.group;
  resExpire.textContent = code.expires;
  resStatus.textContent = code.used ? '❌ Verwendet' : '✅ Aktiv';

  if (!code.used) {
    code.used = true;
    localStorage.setItem('codes', JSON.stringify(codes));
  }

  resultSection.style.display = 'block';
});
