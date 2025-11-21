document.addEventListener('DOMContentLoaded', () => {
  // ---------- Speicher ----------
  const STORAGE_KEY = 'produkte_v2';
  const SALES_KEY = 'sales_v2';
  let db = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  let sales = JSON.parse(localStorage.getItem(SALES_KEY) || '[]');

  // DOM
  const els = {
    name: id('name'), barcode: id('barcode'), qty: id('qty'), price: id('price'), category: id('category'), img: id('img'),
    saveBtn: id('saveBtn'), clearForm: id('clearForm'), productList: id('productList'), categorySelect: id('categorySelect'),
    categoryFilter: id('filterCategory'), search: id('search'), applyFilter: id('applyFilter'), resetFilter: id('resetFilter'),
    minQty: id('minQty'), maxPrice: id('maxPrice'), csvFile: id('csvFile'), importBtn: id('importBtn'), exportBtn: id('exportBtn'), importMode: id('importMode'),
    sellSelect: id('sellSelect'), sellQty: id('sellQty'), sellBtn: id('sellBtn'), salesList: id('salesList'),
    totalValue: id('totalValue'), catChart: id('catChart'), salesChart: id('salesChart'),
    labelSelect: id('labelSelect'), printLabel: id('printLabel'), printAllLabels: id('printAllLabels'), labelPreview: id('labelPreview'), darkToggle: id('darkToggle')
  };

  let catChartObj=null, salesChartObj=null;

  renderAll();

  // ---------- Event Listener ----------
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
  function saveState(){localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); localStorage.setItem(SALES_KEY, JSON.stringify(sales));}
  function generateBarcode(){return 'BC'+Math.floor(Date.now()+Math.random()*1000);}
  function toBase64(file, callback){const r=new FileReader(); r.onload=()=>callback(r.result); r.readAsDataURL(file);}

  function saveProduct(){
    const name = els.name.value.trim(); if(!name) return alert('Name fehlt');
    const qty = Number(els.qty.value) || 0; const price = Number(els.price.value) || 0;
    const barcode = els.barcode.value.trim() || generateBarcode(); const category = els.category.value.trim() || 'Unkategorisiert';

    if(els.img.files && els.img.files[0]){
      toBase64(els.img.files[0], imgData => finalizeSave(imgData));
    } else finalizeSave('');

    function finalizeSave(imgData){
      const existing = db.find(p=>p.barcode===barcode);
      if(existing){
        existing.name=name; existing.qty=qty; existing.price=price; existing.category=category; if(imgData) existing.img=imgData;
      } else {
        db.push({id:Date.now(), name, qty, price, barcode, category, img:imgData, sold:0});
      }
      saveState(); renderAll(); clearForm();
    }
  }

  function clearForm(){ els.name.value=''; els.barcode.value=''; els.qty.value=''; els.price.value=''; els.category.value=''; els.img.value=''; }

  function renderAll(){ buildCategoryLists(); renderProducts(); renderSales(); renderStats(); populateSelects(); }

  function buildCategoryLists(){
    const cats = Array.from(new Set(db.map(d=>d.category || 'Unkategorisiert'))).sort();
    els.categorySelect.innerHTML = '<option value="">Kategorie wählen</option>'+cats.map(c=>`<option>${c}</option>`).join('');
    els.categoryFilter.innerHTML = '<option value="">Alle Kategorien</option>'+cats.map(c=>`<option>${c}</option>`).join('');
  }

  function renderProducts(){
    const tpl = document.getElementById('productTpl'); els.productList.innerHTML='';
    const q=els.search.value.trim().toLowerCase(); const fcat=els.categoryFilter.value; const minQ=Number(els.minQty.value)||0; const maxP=Number(els.maxPrice.value)||Infinity;

    db.filter(p=>{
      if(fcat && p.category!==fcat) return false;
      if(p.qty<minQ) return false;
      if(p.price>maxP) return false;
      if(q && !(p.name.toLowerCase().includes(q)||(p.barcode||'').toLowerCase().includes(q))) return false;
      return true;
    }).forEach(p=>{
      const node=tpl.content.cloneNode(true);
      node.querySelector('.pname').textContent=p.name;
      node.querySelector('.pbarcode').textContent=p.barcode;
      node.querySelector('.pcat').textContent=p.category;
      node.querySelector('.pqty').textContent=p.qty;
      node.querySelector('.pprice').textContent=Number(p.price).toFixed(2);
      const imgEl=node.querySelector('.thumb'); imgEl.src=p.img||'';
      const svg=node.querySelector('.barcodeSvg'); svg.id='b'+p.id;
      node.querySelector('.edit').addEventListener('click', ()=>{ els.name.value=p.name; els.barcode.value=p.barcode; els.qty.value=p.qty; els.price.value=p.price; els.category.value=p.category; window.scrollTo({top:0, behavior:'smooth'}); });
      node.querySelector('.del').addEventListener('click', ()=>{ if(confirm('Löschen?')){ db=db.filter(x=>x.id!==p.id); saveState(); renderAll(); }});
      els.productList.appendChild(node);
      try{ JsBarcode('#b'+p.id, p.barcode, {format:'CODE128', displayValue:true, width:2, height:40}); }catch(e){}
    });
  }

  function renderSales(){ els.salesList.innerHTML=''; sales.slice().reverse().forEach(s=>{ const d=document.createElement('div'); d.className='saleItem'; d.innerHTML=`${s.date}: <strong>${s.name}</strong> × ${s.qty} — ${Number(s.sum).toFixed(2)} €`; els.salesList.appendChild(d);}); }

  function renderStats(){
    const total=db.reduce((acc,p)=>acc+Number(p.qty||0)*Number(p.price||0),0); els.totalValue.textContent=total.toFixed(2)+' €';
    const catMap={}; db.forEach(p=>{ catMap[p.category]=(catMap[p.category]||0)+Number(p.qty||0); });
    const labels=Object.keys(catMap); const data=labels.map(l=>catMap[l]);
    if(catChartObj) catChartObj.destroy();
    catChartObj=new Chart(els.catChart.getContext('2d'),{type:'pie', data:{labels,datasets:[{data}]}, options:{plugins:{legend:{display:true}}}});
    const last30={}; const now=new Date(); for(let i=0;i<30;i++){ const d=new Date(now); d.setDate(now.getDate()-i); last30[dateKey(d)]=0; }
    sales.forEach(s=>{ const k=dateKey(new Date(s.date)); if(k in last30) last30[k]+=Number(s.qty); });
    const sLabels=Object.keys(last30).reverse(); const sData=sLabels.map(k=>last30[k]);
    if(salesChartObj) salesChartObj.destroy();
    salesChartObj=new Chart(els.salesChart.getContext('2d'),{type:'bar', data:{labels:sLabels,datasets:[{label:'Verkaufte Stück',data:sData}]}, options:{scales:{y:{beginAtZero:true}}}});
  }

  function populateSelects(){
    els.sellSelect.innerHTML=db.map(p=>`<option value="${p.barcode}">${p.name} (${p.qty})</option>`).join('');
    els.labelSelect.innerHTML=db.map(p=>`<option value="${p.barcode}">${p.name}</option>`).join('');
  }

  function sellProduct(){
    const barcode=els.sellSelect.value; const qty=Number(els.sellQty.value)||1; const prod=db.find(p=>p.barcode===barcode); if(!prod) return alert('Produkt nicht gefunden');
    if(prod.qty<qty) return alert('Nicht genügend Bestand'); prod.qty-=qty; prod.sold=(prod.sold||0)+qty; const sum=qty*Number(prod.price||0); sales.push({date:new Date().toISOString(), barcode:prod.barcode, name:prod.name, qty, sum}); saveState(); renderAll();
  }

  function exportCSV(){
    const rows=[['id','name','qty','price','barcode','category','img','sold']];
    db.forEach(p=>rows.push([p.id,p.name,p.qty,p.price,p.barcode,p.category,p.img?p.img.split(',')[1]:'',p.sold||0]));
    const csv=rows.map(r=>r.map(c=>`"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='produkte_export.csv'; a.click(); URL.revokeObjectURL(url);
  }

  async function importCSV(){
    const file=els.csvFile.files[0]; if(!file) return alert('Keine Datei gewählt'); const txt=await file.text();
    const lines=parseCSV(txt); if(lines.length<2) return alert('Keine Daten'); const headers=lines[0].map(h=>h.toLowerCase()); const data=lines.slice(1).map(r=>Object.fromEntries(r.map((c,i)=>[headers[i]||i,c])));
    if(els.importMode.value==='overwrite'){
      db=data.map(d=>({id:Number(d.id)||Date.now()+Math.random(), name:d.name||'', qty:Number(d.qty)||0, price:Number(d.price)||0, barcode:d.barcode||generateBarcode(), category:d.category||'Unkategorisiert', img:d.img?('data:image/*;base64,'+d.img):'', sold:Number(d.sold)||0}));
    } else {
      data.forEach(d=>{
        const bc=d.barcode||generateBarcode(); const existing=db.find(x=>x.barcode===bc);
        if(existing){ existing.qty=(Number(existing.qty)||0)+(Number(d.qty)||0); if(d.name) existing.name=d.name; if(d.price) existing.price=Number(d.price)||existing.price; if(d.category) existing.category=d.category; if(d.img) existing.img='data:image/*;base64,'+d.img; } 
        else db.push({id:Number(d.id)||Date.now()+Math.random(), name:d.name||'', qty:Number(d.qty)||0, price:Number(d.price)||0, barcode:bc, category:d.category||'Unkategorisiert', img:d.img?('data:image/*;base64,'+d.img):'', sold:Number(d.sold)||0});
      });
    }
    saveState(); renderAll(); alert('Import fertig');
  }

  function parseCSV(text){ const rows=[]; let cur=[]; let curCell=''; let inQuotes=false; for(let i=0;i<text.length;i++){ const ch=text[i]; const nxt=text[i+1]; if(inQuotes){ if(ch==='"'){ if(nxt==='"'){ curCell+='"'; i++; } else inQuotes=false; } else curCell+=ch; } else { if(ch==='"'){ inQuotes=true; } else if(ch===','){ cur.push(curCell); curCell=''; } else if(ch==='
'){ continue; } else if(ch==='
'){ cur.push(curCell); rows.push(cur); cur=[]; curCell=''; } else curCell+=ch; } } if(curCell!==''||cur.length>0){ cur.push(curCell); rows.push(cur); } return rows; }

  function createLabelHTML(prod){ return `<div class="labelPage"><div class="labelInner"><h2>${prod.name}</h2><p>Preis: ${Number(prod.price||0).toFixed(2)} €</p><svg id="lbl-${prod.id}"></svg><p>${prod.barcode}</p></div></div>`; }
  function printLabels(all){
    let items = all ? db.slice() : [db.find(x=>x.barcode===els.labelSelect.value)]; if(!items[0]) return alert('Kein Produkt gewählt');
    els.labelPreview.innerHTML=items.map(createLabelHTML).join('');
    items.forEach(p=>{ try{ JsBarcode(`#lbl-${p.id}`, p.barcode, {format:'CODE128', displayValue:false, width:2, height:80}); }catch(e){} });
    setTimeout(()=>{ window.print(); },300);
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }
  function dateKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

  // Darkmode
  const dark = localStorage.getItem('darkMode')==='1'; els.darkToggle.checked=dark; applyDark(dark);
  function toggleDarkMode(){ applyDark(els.darkToggle.checked); localStorage.setItem('darkMode', els.darkToggle.checked?'1':'0'); }
  function applyDark(on){ document.documentElement.classList.toggle('dark', !!on); }

  function resetFilters(){ els.search.value=''; els.minQty.value=''; els.maxPrice.value=''; els.categoryFilter.value=''; renderAll(); }

});
