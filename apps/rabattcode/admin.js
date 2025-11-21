const createBtn = document.getElementById('createBtn');
const codeTableBody = document.querySelector('#codeTable tbody');

createBtn.addEventListener('click', () => {
  const code = document.getElementById('codeInput').value.trim();
  const type = document.getElementById('typeInput').value.trim();
  const group = document.getElementById('groupInput').value.trim();
  const expires = document.getElementById('expireInput').value;
  const count = parseInt(document.getElementById('countInput').value) || 1;

  if (!code) return alert('Bitte einen Code eingeben');

  let codes = JSON.parse(localStorage.getItem('codes') || '[]');

  for (let i = 0; i < count; i++) {
    let newCode = {
      code: code + (count>1 ? '-' + (i+1) : ''),
      type,
      group,
      expires,
      used: false
    };
    codes.push(newCode);
  }

  localStorage.setItem('codes', JSON.stringify(codes));
  renderTable();
});

function renderTable() {
  let codes = JSON.parse(localStorage.getItem('codes') || '[]');
  codeTableBody.innerHTML = '';

  codes.forEach((c, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.code}</td>
      <td>${c.type}</td>
      <td>${c.group}</td>
      <td>${c.expires}</td>
      <td>${c.used ? '❌ Verwendet' : '✅ Aktiv'}</td>
      <td><div id="qrcode-${i}"></div></td>
      <td><button onclick="toggleUsed(${i})">🔍 / 🗑️</button></td>
    `;
    codeTableBody.appendChild(tr);

    new QRCode(document.getElementById(`qrcode-${i}`), {
      text: c.code,
      width: 64,
      height: 64
    });
  });
}

function toggleUsed(index) {
  let codes = JSON.parse(localStorage.getItem('codes') || '[]');
  codes[index].used = !codes[index].used;
  localStorage.setItem('codes', JSON.stringify(codes));
  renderTable();
}

renderTable();
