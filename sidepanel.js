const STORAGE_KEY = "yoah_timer_state_v1";
const DRAFT_KEY = "yoah_timer_draft_v1";
const SETTINGS_KEY = "yoah_timer_settings_v1";
const HISTORY_RETENTION_DAYS = 30;
const HISTORY_RETENTION_MS = HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;

function $(s){return document.querySelector(s);}
function el(t,c){const e=document.createElement(t); if(c) e.className=c; return e;}

let state = { auctions: [], history: [] };

let draftSaveTimer = null;

function loadSettings(){
  return new Promise((resolve)=>{
    chrome.storage.sync.get([SETTINGS_KEY], (res)=>{
      const s = res[SETTINGS_KEY] || {};
      resolve({
        remoteEnabled: !!s.remoteEnabled,
        remoteProvider: s.remoteProvider === 'ifttt' ? 'ifttt' : 'ntfy',
        ntfyTopic: typeof s.ntfyTopic === 'string' ? s.ntfyTopic : '',
        iftttEvent: typeof s.iftttEvent === 'string' ? s.iftttEvent : 'yoah_ending',
        iftttKey: typeof s.iftttKey === 'string' ? s.iftttKey : ''
      });
    });
  });
}

function saveSettings(next){
  return new Promise((resolve)=>{
    chrome.storage.sync.set({
      [SETTINGS_KEY]: {
        remoteEnabled: !!next.remoteEnabled,
        remoteProvider: next.remoteProvider === 'ifttt' ? 'ifttt' : 'ntfy',
        ntfyTopic: (next.ntfyTopic || '').trim(),
        iftttEvent: (next.iftttEvent || '').trim(),
        iftttKey: (next.iftttKey || '').trim()
      }
    }, ()=>resolve());
  });
}

function toggleRemoteProviderUI(provider){
  const p = provider === 'ifttt' ? 'ifttt' : 'ntfy';
  const ntfy = document.getElementById('remote-ntfy');
  const ifttt = document.getElementById('remote-ifttt');
  if(ntfy) ntfy.hidden = (p !== 'ntfy');
  if(ifttt) ifttt.hidden = (p !== 'ifttt');
}

function collectRemoteSettingsFromUI(){
  return {
    remoteEnabled: !!document.getElementById('in-remote-enabled')?.checked,
    remoteProvider: document.getElementById('in-remote-provider')?.value === 'ifttt' ? 'ifttt' : 'ntfy',
    ntfyTopic: document.getElementById('in-ntfy-topic')?.value || '',
    iftttEvent: document.getElementById('in-ifttt-event')?.value || '',
    iftttKey: document.getElementById('in-ifttt-key')?.value || ''
  };
}

function loadDraft(){
  return new Promise((resolve)=>{
    chrome.storage.local.get([DRAFT_KEY], (res)=>resolve(res[DRAFT_KEY]||null));
  });
}

function saveDraft(draft){
  return new Promise((resolve)=>{
    chrome.storage.local.set({[DRAFT_KEY]: draft}, ()=>resolve());
  });
}

function collectDraft(){
  return {
    activeTab: 'sidepanel',
    form: {
      name: $("#in-name")?.value || "",
      left: $("#in-left")?.value || "",
      img: $("#in-img")?.value || "",
      enabled: !!$("#in-enabled")?.checked
    }
  };
}

function scheduleDraftSave(){
  clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(async ()=>{
    try{ await saveDraft(collectDraft()); }catch(e){ console.error(e); }
  }, 250);
}

function loadState(){
  return new Promise((resolve)=>{
    chrome.storage.local.get([STORAGE_KEY], (res)=>{
      const s = res[STORAGE_KEY] || { auctions: [], history: [] };
      const next = {
        auctions: Array.isArray(s.auctions) ? s.auctions : [],
        history: Array.isArray(s.history) ? s.history : []
      };

      // Auto-prune history older than retention window.
      const cutoff = Date.now() - HISTORY_RETENTION_MS;
      const before = next.history.length;
      next.history = next.history.filter(h => !h?.closedAt || h.closedAt >= cutoff);
      state = next;

      if(before !== next.history.length){
        chrome.storage.local.set({[STORAGE_KEY]: state}, ()=>resolve());
        return;
      }
      resolve();
    });
  });
}

function saveState(){
  return new Promise((resolve)=>{
    chrome.storage.local.set({[STORAGE_KEY]: state}, ()=>resolve());
  });
}

function left(ms){return ms - Date.now();}

function fmtLeftHHMM(msLeft){
  if(!Number.isFinite(msLeft) || msLeft <= 0) return "00:00";
  const totalSeconds = Math.floor(msLeft / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2,'0')}`;
}

function parseTimeLeftToMs(value){
  const raw = (value || '').trim();
  if(!raw) return null;
  const m = raw.match(/^\s*(\d+)\s*:\s*(\d{1,2})\s*$/);
  if(!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if(!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if(hours < 0 || minutes < 0 || minutes > 59) return null;
  return (hours * 60 + minutes) * 60000;
}

function uid(p){return p+"_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8);}

function setImgPreview(url){
  const img = $("#img-preview");
  if(!img) return;
  if(!url){
    img.removeAttribute('src');
    img.style.display = 'none';
    return;
  }
  img.src = url;
  img.style.display = 'block';
  img.onerror = () => { img.style.display = 'none'; };
}

function looksLikeImageUrl(url){
  return /\.(png|jpe?g|gif|webp)(\?|#|$)/i.test(url);
}

async function resolveImageUrl(inputUrl){
  const raw = (inputUrl||'').trim();
  if(!raw) return '';
  let url;
  try{ url = new URL(raw); }catch{ return ''; }

  if(looksLikeImageUrl(url.href)) return url.href;

  // If it's a yoworld.info page, try to pull og:image.
  if(/(^|\.)yoworld\.info$/i.test(url.hostname)){
    const res = await fetch(url.href, { credentials: 'omit' });
    if(!res.ok) return '';
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const og = doc.querySelector('meta[property="og:image"], meta[name="og:image"]');
    const content = og && og.getAttribute('content');
    if(content){
      try{ return new URL(content, url.href).href; }catch{ return content; }
    }
    const imgSrc = doc.querySelector('img')?.getAttribute('src');
    if(imgSrc){
      try{ return new URL(imgSrc, url.href).href; }catch{ return imgSrc; }
    }
  }

  // Otherwise, treat as a direct URL (may still work in <img>).
  return url.href;
}

function buildYwCdnImageUrlFromId(itemId){
  const id = Number(itemId);
  if(!Number.isFinite(id) || id <= 0) return '';
  const g1 = String(Math.floor(id / 10000)).padStart(2,'0');
  const g2 = String(Math.floor((id % 10000) / 100)).padStart(2,'0');
  return `https://yw-web.yoworld.com/cdn/items/${g1}/${g2}/${id}/${id}.png`;
}

async function searchTopItemByName(name){
  const q = (name||'').trim();
  if(!q) return null;
  const url = `https://api.yoworld.info/api/items/search?query=${encodeURIComponent(q)}&page=1&itemsPerPage=12&itemCategoryId=-1`;
  const res = await fetch(url, { credentials: 'omit' });
  if(!res.ok) return null;
  const json = await res.json();
  const item = json?.data?.pagination?.data?.[0];
  if(!item?.id) return null;
  return { id: item.id, name: item.name || '' };
}

async function loadImageFromInput(){
  const inp = $("#in-img");
  if(!inp) return;
  const val = inp.value.trim();
  if(!val){ setImgPreview(''); return; }
  try{
    const resolved = await resolveImageUrl(val);
    if(!resolved){ alert('Could not find an image for that URL.'); return; }
    inp.value = resolved;
    setImgPreview(resolved);
    scheduleDraftSave();
  }catch(e){
    console.error(e);
    alert('Failed to load image.');
  }
}

async function findImageFromName(){
  const name = $("#in-name")?.value || '';
  if(!name.trim()){
    alert('Enter an Item name first.');
    return;
  }

  try{
    const top = await searchTopItemByName(name);
    if(!top){
      alert('No matches found on yoworld.info for that name.');
      return;
    }
    const imgUrl = buildYwCdnImageUrlFromId(top.id);
    if(!imgUrl){
      alert('Found a match, but could not build an image URL.');
      return;
    }

    const inp = $("#in-img");
    if(inp) inp.value = imgUrl;
    setImgPreview(imgUrl);
    scheduleDraftSave();
  }catch(e){
    console.error(e);
    alert('Failed to search for item image.');
  }
}

function clearImageInput(){
  const inp = $("#in-img");
  if(inp) inp.value = '';
  setImgPreview('');
  scheduleDraftSave();
}

async function addAuction(){
  const name = $("#in-name")?.value.trim() || '';
  const leftVal = $("#in-left")?.value || '';
  const imageUrl = $("#in-img")?.value.trim() || '';
  const enabled = !!$("#in-enabled")?.checked;

  if(!name){ alert('Item name required.'); return; }
  const deltaMs = parseTimeLeftToMs(leftVal);
  if(deltaMs === null){ alert('Time Left must be in H:MM (e.g., 2:15).'); return; }
  if(deltaMs <= 0){ alert('Time Left must be greater than 0:00.'); return; }

  const endMs = Date.now() + deltaMs;
  state.auctions = state.auctions || [];
  state.auctions.push({ id: uid('auc'), name, endMs, imageUrl, enabled, createdAt: Date.now(), source: 'manual' });

  if($("#in-name")) $("#in-name").value = '';
  if($("#in-left")) $("#in-left").value = '';
  if($("#in-img")) $("#in-img").value = '';
  if($("#in-enabled")) $("#in-enabled").checked = true;
  setImgPreview('');
  scheduleDraftSave();

  await saveState();
  await chrome.runtime.sendMessage({type:"YOAH_RESCHEDULE"});
  render();
}

function label(a){
  if(!a.enabled) return "disabled";
  const l = left(a.endMs);
  if(l<=0) return "ended";
  if(l<=10*60*1000) return "ending soon";
  return "active";
}

function render(){
  const list = $("#list");
  if(!list) return;
  list.innerHTML = "";

  const items = [...(state.auctions||[])].sort((a,b)=>a.endMs-b.endMs); // ending soonest
  if(!items.length){
    const d = el("div","small");
    d.textContent = "No current bids yet.";
    list.appendChild(d);
    return;
  }

  for(const a of items){
    const card = el("div","item");
    const top = el("div","item-top");

    const leftWrap = el("div","item-left");
    if(a.imageUrl){
      const thumb = el("img","thumb");
      thumb.src = a.imageUrl;
      thumb.alt = "Item thumbnail";
      thumb.loading = "lazy";
      thumb.referrerPolicy = 'no-referrer';
      leftWrap.appendChild(thumb);
    }

    const L = el("div","");
    const nm = el("div","item-name");
    nm.textContent = a.name || "(Unnamed)";
    L.appendChild(nm);

    const m = el("div","item-meta");
    const msLeft = left(a.endMs);
    m.textContent = msLeft <= 0 ? "Time left: ended" : ("Time left: " + fmtLeftHHMM(msLeft));
    L.appendChild(m);

    leftWrap.appendChild(L);

    const R = el("div","");
    const p = el("span","pill");
    p.textContent = label(a);
    R.appendChild(p);

    top.appendChild(leftWrap);
    top.appendChild(R);
    card.appendChild(top);

    const actions = el("div","actions");
    const bt = el("button","");
    bt.textContent = a.enabled ? "Disable" : "Enable";
    bt.addEventListener('click', async()=>{
      a.enabled = !a.enabled;
      await saveState();
      await chrome.runtime.sendMessage({type:"YOAH_RESCHEDULE"});
      render();
    });

    const be = el("button","");
    be.textContent = "Edit";
    be.addEventListener('click', async()=>{
      const newName = prompt("Item name:", a.name || "");
      if(newName === null) return;
      const newLeft = prompt("Time Left (H:MM)", fmtLeftHHMM(left(a.endMs)));
      if(newLeft === null) return;
      const newImg = prompt("Image URL (optional):", a.imageUrl || "");
      if(newImg === null) return;

      const deltaMs = parseTimeLeftToMs(newLeft);
      if(deltaMs === null || deltaMs <= 0){
        alert("Time Left must be in H:MM and greater than 0:00.");
        return;
      }

      a.name = (newName || '').trim();
      a.endMs = Date.now() + deltaMs;
      a.imageUrl = (newImg || '').trim();

      await saveState();
      await chrome.runtime.sendMessage({type:"YOAH_RESCHEDULE"});
      render();
    });

    const bw = el("button","");
    bw.textContent = "Won";
    bw.addEventListener('click', async()=>{
      const curRaw = prompt("Won in which currency? (coins / yocash)", "coins");
      if(curRaw === null) return;
      const currency = String(curRaw).trim().toLowerCase();
      const normCurrency = (currency === 'coins' || currency === 'coin' || currency === 'c')
        ? 'coins'
        : (currency === 'yocash' || currency === 'yc' || currency === 'y')
          ? 'yocash'
          : null;
      if(!normCurrency){
        alert("Currency must be 'coins' or 'yocash'.");
        return;
      }

      const raw = prompt(`Won for how much? (${normCurrency})`, "");
      if(raw === null) return;
      const amount = Number(String(raw).replace(/[,\s]/g,''));
      if(!Number.isFinite(amount) || amount <= 0){
        alert(`Enter a valid ${normCurrency} amount.`);
        return;
      }
      state.history = state.history || [];
      state.history.unshift({
        id: a.id,
        name: a.name,
        endMs: a.endMs,
        imageUrl: a.imageUrl || "",
        outcome: "won",
        amount,
        currency: normCurrency,
        closedAt: Date.now()
      });
      state.auctions = (state.auctions||[]).filter(x=>x.id!==a.id);
      await saveState();
      await chrome.runtime.sendMessage({type:"YOAH_RESCHEDULE"});
      render();
    });

    const bl = el("button","");
    bl.textContent = "Lost";
    bl.addEventListener('click', async()=>{
      if(!confirm("Mark as lost and move to History?")) return;
      state.history = state.history || [];
      state.history.unshift({
        id: a.id,
        name: a.name,
        endMs: a.endMs,
        imageUrl: a.imageUrl || "",
        outcome: "lost",
        amount: null,
        closedAt: Date.now()
      });
      state.auctions = (state.auctions||[]).filter(x=>x.id!==a.id);
      await saveState();
      await chrome.runtime.sendMessage({type:"YOAH_RESCHEDULE"});
      render();
    });

    const bd = el("button","");
    bd.textContent = "Delete";
    bd.addEventListener('click', async()=>{
      if(!confirm("Delete this item?")) return;
      state.auctions = (state.auctions||[]).filter(x=>x.id!==a.id);
      await saveState();
      await chrome.runtime.sendMessage({type:"YOAH_RESCHEDULE"});
      render();
    });

    actions.appendChild(bt);
    actions.appendChild(bw);
    actions.appendChild(bl);
    actions.appendChild(be);
    actions.appendChild(bd);
    card.appendChild(actions);

    list.appendChild(card);
  }

  const historyList = $("#history-list");
  if(historyList){
    historyList.innerHTML = "";
    const hist = [...(state.history||[])].sort((a,b)=>(b.closedAt||0)-(a.closedAt||0));
    if(!hist.length){
      const d=el("div","small");
      d.textContent = "No history yet.";
      historyList.appendChild(d);
    }else{
      for(const h of hist){
        const card=el("div","item");
        const top=el("div","item-top");

        const leftWrap=el("div","item-left");
        if(h.imageUrl){
          const thumb=el("img","thumb");
          thumb.src=h.imageUrl;
          thumb.alt="Item thumbnail";
          thumb.loading="lazy";
          thumb.referrerPolicy = 'no-referrer';
          leftWrap.appendChild(thumb);
        }

        const L=el("div","");
        const nm=el("div","item-name"); nm.textContent=h.name||"(Unnamed)"; L.appendChild(nm);
        const m=el("div","item-meta");
        if(h.outcome === 'won'){
          const cur = (h.currency || 'coins').toLowerCase();
          if(cur === 'yocash') m.textContent = `Won for: ${Number(h.amount).toLocaleString()} YoCash`;
          else m.textContent = `Won for: ${Number(h.amount).toLocaleString()} coins`;
        }
        else if(h.outcome === 'lost') m.textContent = "Lost";
        else m.textContent = "Completed";
        L.appendChild(m);
        leftWrap.appendChild(L);

        const R=el("div","");
        const p=el("span","pill");
        p.textContent = h.outcome || 'done';
        R.appendChild(p);

        top.appendChild(leftWrap);
        top.appendChild(R);
        card.appendChild(top);
        historyList.appendChild(card);
      }
    }
  }
}

async function clearEnded(){
  const before = (state.auctions||[]).length;
  state.auctions = (state.auctions||[]).filter(a=>a.endMs>Date.now());
  const after = state.auctions.length;
  await saveState();
  await chrome.runtime.sendMessage({type:"YOAH_RESCHEDULE"});
  render();
  alert(`Removed ${before-after} ended item(s).`);
}

async function clearHistory(){
  const count = (state.history || []).length;
  if(!count){
    alert('History is already empty.');
    return;
  }
  if(!confirm(`Clear ${count} history item(s)? This cannot be undone.`)) return;
  state.history = [];
  await saveState();
  render();
}

async function testRemote(){
  const res = await chrome.runtime.sendMessage({type:"YOAH_TEST_REMOTE"});
  if(res?.ok) alert('Remote alert sent (check your phone/email).');
  else alert(res?.error || 'Remote alert failed. Check settings.');
}

document.addEventListener('DOMContentLoaded', async()=>{
  await loadState();
  render();

  // Remote alert settings UI
  const remoteProvider = document.getElementById('in-remote-provider');
  if(remoteProvider){
    remoteProvider.addEventListener('change', ()=>toggleRemoteProviderUI(remoteProvider.value));
  }

  const saved = await loadSettings();
  const re = document.getElementById('in-remote-enabled');
  if(re) re.checked = !!saved.remoteEnabled;
  if(remoteProvider) remoteProvider.value = saved.remoteProvider;
  const nt = document.getElementById('in-ntfy-topic');
  if(nt) nt.value = saved.ntfyTopic;
  const ie = document.getElementById('in-ifttt-event');
  if(ie) ie.value = saved.iftttEvent;
  const ik = document.getElementById('in-ifttt-key');
  if(ik) ik.value = saved.iftttKey;
  toggleRemoteProviderUI(saved.remoteProvider);

  const btnSaveRemote = document.getElementById('btn-save-remote');
  if(btnSaveRemote){
    btnSaveRemote.addEventListener('click', async()=>{
      const next = collectRemoteSettingsFromUI();
      if(next.remoteEnabled){
        if(next.remoteProvider === 'ntfy' && !String(next.ntfyTopic).trim()){
          alert('Enter an ntfy topic (or disable remote alerts).');
          return;
        }
        if(next.remoteProvider === 'ifttt' && (!String(next.iftttEvent).trim() || !String(next.iftttKey).trim())){
          alert('Enter both IFTTT event name and key (or disable remote alerts).');
          return;
        }
      }
      await saveSettings(next);
      alert('Remote settings saved.');
    });
  }

  const btnTestRemote = document.getElementById('btn-test-remote');
  if(btnTestRemote) btnTestRemote.addEventListener('click', testRemote);

  const draft = await loadDraft();
  if(draft?.form){
    if($("#in-name")) $("#in-name").value = draft.form.name || "";
    if($("#in-left")) $("#in-left").value = draft.form.left || "";
    if($("#in-img")) $("#in-img").value = draft.form.img || "";
    if($("#in-enabled")) $("#in-enabled").checked = draft.form.enabled !== false;
    setImgPreview(draft.form.img || "");
  }

  const btnClear = $("#btn-clear-ended");
  if(btnClear) btnClear.addEventListener('click', clearEnded);

  const btnClearHistory = $("#btn-clear-history");
  if(btnClearHistory) btnClearHistory.addEventListener('click', clearHistory);

  const btnAdd = $("#btn-add");
  if(btnAdd) btnAdd.addEventListener('click', addAuction);

  const btnImg = $("#btn-img");
  if(btnImg) btnImg.addEventListener('click', loadImageFromInput);
  const btnImgFind = $("#btn-img-find");
  if(btnImgFind) btnImgFind.addEventListener('click', findImageFromName);
  const btnImgClear = $("#btn-img-clear");
  if(btnImgClear) btnImgClear.addEventListener('click', clearImageInput);

  const imgInp = $("#in-img");
  if(imgInp) imgInp.addEventListener('input', () => { setImgPreview(imgInp.value.trim()); scheduleDraftSave(); });

  // Autosave draft as the user types.
  ["#in-name", "#in-left", "#in-enabled"].forEach((sel)=>{
    const node = $(sel);
    if(!node) return;
    const evt = sel === "#in-enabled" ? 'change' : 'input';
    node.addEventListener(evt, scheduleDraftSave);
  });

  // Live countdown: update every second while panel is open.
  setInterval(render, 1000);

  // Keep in sync if popup/service worker updates storage.
  chrome.storage.onChanged.addListener((changes, area)=>{
    if(area !== 'local') return;
    if(changes[STORAGE_KEY]){
      const s = changes[STORAGE_KEY].newValue || {auctions:[], history:[]};
      state = {
        auctions: Array.isArray(s.auctions) ? s.auctions : [],
        history: Array.isArray(s.history) ? s.history : []
      };
      render();
    }
  });
});
