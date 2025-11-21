// ---------- Speicher / Initialisierung ----------
const STORAGE_KEY = 'produkte_v2';
const SALES_KEY = 'sales_v2';
let db = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let sales = JSON.parse(localStorage.getItem(SALES_KEY) || '[]');

// DOM
const els = {
  name: id('name'), barcode: id('barcode'), qty: id('qty'), price: id('price'), category: id('category'), img: id('img'),
  saveBtn: id('saveBtn'), clearForm: id('clearForm'), productList: id('productList'), categorySelect: id('categorySelect'),
  categoryInput: id('category'), categoryFilter: id('filterCategory'), search: id('search'), applyFilter: id('applyFilter'), resetFilter: id('resetFilter'),
  minQty: id('minQty'), maxPrice: id('maxPrice'), csvFile: id('csvFile'), importBtn: id('importBtn'), exportBtn: id('exportBtn'), importMode: id('importMode'),
  sellSelect: id('sellSelect'), sellQty: id('sellQty'), sellBtn: id('sellBtn'), salesList: id('salesList'),
  totalValue: id('totalValue'), catChart: id('catChart'), salesChart: id('salesChart'),
  labelSelect: id('labelSelect'), printLabel: id('printLabel'), printAllLabels: id('printAllLabels'), labelPreview: id('labelPreview'), darkToggle: id('darkToggle')
};

// Charts
let catChartObj = null; 
let salesChartObj = null;

// Initial render
renderAll();

// ---------- Event Listeners ----------
els.saveBtn.addEventListener('click', saveProduct);
els.clearForm.addEventListener('click', clearForm);
els.applyFilter.addEventListener('click', renderAll);
els.resetFilter.addEventListener('click', resetFilters);
els.search.addEventListener('input', renderAll);
els.exportBtn.addEventListener('click', exportCSV);
els.importBtn.addEventListener('click', importCSV);
els.sellBtn.addEventListener('click', sellProduct);
els.printLabel.addEventListener('click', ()=>printLabels(false));
els.printAllLabels.addEventListener('click', ()=>printLabels(true));
els.darkToggle.addEventListener('change', toggleDarkMode);

// ---------- Funktionen ----------
function id(i){return document.getElementById(i)}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); 
  localStorage.setItem(SALES_KEY, JSON.stringify(sales));
}

function generateBarcode(){
  return 'BC'+Math.floor(Date.now()+Math.random()*1000)
}

async function saveProduct(){
  const name = els.name.value.trim(); 
  if(!name) return alert('Name fehlt');
  const qty = Number(els.qty.value) || 0; 
  const price = Number(els.price.value) || 0;
  const barcode = els.barcode.value.trim() || generateBarcode(); 
  const category = els.category.value.trim() || 'Unkategorisiert';

  let imgData = '';
  if (els.img.files && els.img.files[0]){
    imgData = await toBase64(els.img.files[0]);
  }

  const existing = db.find(p=>p.barcode === barcode);
  if(existing){
    existing.name = name; existing.qty = qty; existing.price = price; existing.category = category; 
    if(imgData) existing.img = imgData;
  } else {
    db.push({id: Date.now(), name, qty, price, barcode, category, img: imgData, sold: 0});
  }
  saveState(); renderAll(); clearForm();
}

function clearForm(){
  els.name.value=''; els.barcode.value=''; els.qty.value=''; els.price.value=''; els.category.value=''; els.img.value='';
}

function toBase64(file){
  return new Promise((res,rej)=>{
    const r=new FileReader(); 
    r.onload=()=>res(r.result); 
    r.onerror=rej; 
    r.readAsDataURL(file);
  });
}

function renderAll(){
  buildCategoryLists(); 
  renderProducts(); 
  renderSales(); 
  renderStats(); 
  populateSelects();
}

function buildCategoryLists(){
  const cats = Array.from(new Set(db.map(d=>d.category || 'Unkategorisiert'))).sort();
  els.categorySelect.innerHTML = '<option value="">Kategorie wählen</option>' + cats.map(c=>`<option>${escapeHtml(c)}</option>`).join('');
  els.categoryFilter.innerHTML = '<option value="">Alle Kategorien</option>' + cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
}

function renderProducts(){
  const tpl = document.getElementById('productTpl'); 
  els.productList.innerHTML='';
  const q = els.search.value.trim().toLowerCase(); 
  const fcat = els.filterCategory.value; 
  const minQ = Number(els.minQty.value) || 0; 
  const maxP = Number(els.maxPrice.value) || Infinity;

  db.filter(p=>{
    if(fcat && p.category !== fcat) return false;
    if(p.qty < minQ) return false;
    if(p.price > maxP) return false;
    if(q){ if(!(p.name.toLowerCase().includes(q) || (p.barcode||'').toLowerCase().includes(q))) return false; }
    return true;
  }).forEach(p=>{
    const node = tpl.content.cloneNode(true);
    node.querySelector('.pname').textContent = p.name;
    node.querySelector('.pbarcode').textContent = p.barcode;
    node.querySelector('.pcat').textContent = p.category || '';
    node.querySelector('.pqty').textContent = p.qty;
    node.querySelector('.pprice').textContent = Number(p.price).toFixed(2);
    const imgEl = node.querySelector('.thumb'); imgEl.src = p.img || '';
    const svg = node.querySelector('.barcodeSvg'); svg.id = 'b'+p.id;

    node.querySelector('.edit').addEventListener('click', ()=>{
      els.name.value = p.name; els.barcode.value = p.barcode; els.qty.value = p.qty; els.price.value = p.price; els.category.value = p.category; 
      window.scrollTo({top:0, behavior:'smooth'});
    });
    node.querySelector('.del').addEventListener('click', ()=>{ 
      if(confirm('Löschen?')){ 
        db=db.filter(x=>x.id!==p.id); saveState(); renderAll(); 
      }
    });

    els.productList.appendChild(node);

    try{ 
      JsBarcode('#b'+p.id, p.barcode, {format:'CODE128', displayValue:true, width:2, height:40}); 
    } catch(e){}
  });
}

// ... Der restliche Code für renderSales, renderStats, populateSelects, sellProduct, CSV-Import/Export, Labels, Utilities etc. bleibt gleich.
