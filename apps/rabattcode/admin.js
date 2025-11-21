const createBtn = document.getElementById('createBtn');
const codeTableBody = document.querySelector('#codeTable tbody');
const exportBtn = document.getElementById('exportBtn');
const importInput = document.getElementById('importInput');

const lightBtn = document.getElementById('lightBtn');
const darkBtn = document.getElementById('darkBtn');

// Dark/Light Mode speichern
function applyTheme(theme) {
  document.body.className = theme;
  localStorage.setItem('theme', theme);
}

// Theme Buttons
lightBtn.addEventListener('click', () => applyTheme('light'));
darkBtn.addEventListener('click', () => applyTheme('dark'));

// beim Laden Theme anwenden
const savedTheme = localStorage.getItem('theme') || 'light';
applyTheme(savedTheme);

// Code Generator
function generateCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Codes erstellen
createBtn.addEventListener('click', () => {
  const type = document.getElementById('typeInput').value.trim();
  const group = document.getElementById('groupInput').value.trim();
  const expires = document.getElementById('expireInput').value;
  const count = parseInt(document.getElementById('countInput').value) || 1;

  let codes = JSON.parse(localStorage.getItem('codes') || '[]');

  for (let i = 0; i < count; i++) {
    let newCode = {
      code: generateCode(),
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

// Tabelle rendern
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
      <td><button onclick="toggleUsed(${i})">🔍/🗑️</button></td>
    `;
    codeTableBody.appendChild(tr);

    new QRCode(document.getElementById(`qrcode-${i}`), {
      text: c.code,
      width: 64,
      height: 64
    });
  });
}

// Status wechseln
function toggleUsed(index) {
  let codes = JSON.parse(localStorage.getItem('codes') || '[]');
  codes[index].used = !codes[index].used;
  localStorage.setItem('codes', JSON.stringify(codes));
  renderTable();
}

// Export
exportBtn.addEventListener('click', () => {
  const codes = localStorage.getItem('codes');
  if (!codes) return alert('Keine Codes zum Exportieren');
  const blob = new Blob([codes], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'codes.json';
  a.click();
  URL.revokeObjectURL(url);
});

// Import
importInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error('Ungültiges Format');
      localStorage.setItem('codes', JSON.stringify(imported));
      renderTable();
      alert('Codes erfolgreich importiert');
    } catch (err) {
      alert('Fehler beim Importieren: ' + err.message);
    }
  };
  reader.readAsText(file);
});

renderTable();
