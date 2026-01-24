const STORAGE_KEY="yoah_timer_state_v1";
const SETTINGS_KEY="yoah_timer_settings_v1";
const ALARM_PREFIX="yoah_auc_";
const SNOOZE_PREFIX="yoah_snooze_";
const NOTIF_PREFIX="yoah_auc_";
const SNOOZE_MS = 5 * 60 * 1000;

function loadState(){return new Promise(r=>chrome.storage.local.get([STORAGE_KEY],res=>r(res[STORAGE_KEY]||{auctions:[]})));}
function saveState(s){return new Promise(r=>chrome.storage.local.set({[STORAGE_KEY]:s},()=>r()));}

function loadSettings(){
  return new Promise((resolve)=>{
    chrome.storage.sync.get([SETTINGS_KEY], (res)=>{
      const s = res[SETTINGS_KEY] || {};
      resolve({
        remoteEnabled: !!s.remoteEnabled,
        remoteProvider: s.remoteProvider === 'ifttt' ? 'ifttt' : 'ntfy',
        ntfyTopic: typeof s.ntfyTopic === 'string' ? s.ntfyTopic.trim() : '',
        iftttEvent: typeof s.iftttEvent === 'string' ? s.iftttEvent.trim() : 'yoah_ending',
        iftttKey: typeof s.iftttKey === 'string' ? s.iftttKey.trim() : ''
      });
    });
  });
}

async function sendRemoteAlert(title, message){
  try{
    const s = await loadSettings();
    if(!s.remoteEnabled) return { ok: false, skipped: true, reason: 'disabled' };

    if(s.remoteProvider === 'ifttt'){
      if(!s.iftttEvent || !s.iftttKey) return { ok: false, error: 'IFTTT not configured' };
      const url = `https://maker.ifttt.com/trigger/${encodeURIComponent(s.iftttEvent)}/with/key/${encodeURIComponent(s.iftttKey)}?value1=${encodeURIComponent(title)}&value2=${encodeURIComponent(message)}`;
      await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store' });
      return { ok: true };
    }

    // ntfy (default)
    if(!s.ntfyTopic) return { ok: false, error: 'ntfy not configured' };
    const url = `https://ntfy.sh/${encodeURIComponent(s.ntfyTopic)}?title=${encodeURIComponent(title)}`;
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: message
    });
    return { ok: true };
  }catch(e){
    console.error('Remote alert failed', e);
    return { ok: false, error: 'Remote alert failed' };
  }
}

function clearAllAlarms(){
  return new Promise(resolve=>{
    chrome.alarms.getAll(alarms=>{
      const ours=alarms.filter(a=>a.name.startsWith(ALARM_PREFIX) || a.name.startsWith(SNOOZE_PREFIX));
      let remaining=ours.length;
      if(!remaining) return resolve();
      for(const a of ours){
        chrome.alarms.clear(a.name, ()=>{remaining-=1; if(!remaining) resolve();});
      }
    });
  });
}

async function reschedule(){
  const state=await loadState();
  await clearAllAlarms();
  const now=Date.now();
  for(const auc of (state.auctions||[])){
    if(!auc.enabled) continue;
    if(!auc.endMs || auc.endMs<=now) continue;
    const fireAt=auc.endMs-10*60*1000;
    chrome.alarms.create(ALARM_PREFIX+auc.id, { when: fireAt<=now ? now+5000 : fireAt });
  }
}

function notifyAuction(auc, { snoozed } = { snoozed: false }){
  const title = snoozed ? "Auction ending soon (snoozed)" : "Auction ending soon";
  const message = `${auc.name} — ends at ${new Date(auc.endMs).toLocaleString()}`;
  const notificationId = NOTIF_PREFIX + auc.id;

  chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: "icons/128x128.png",
    title,
    message,
    buttons: [{ title: "Snooze 5m" }]
  });

  // Fire-and-forget: also try to deliver remotely (phone/email) if configured.
  sendRemoteAlert(title, message);
}

chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  (async()=>{
    if(msg?.type==="YOAH_RESCHEDULE"){ await reschedule(); sendResponse({ok:true}); return; }
    if(msg?.type==="YOAH_TEST_NOTIFY"){ chrome.notifications.create({ type:"basic", iconUrl:"icons/128x128.png", title:"YoAH Timer", message:"Test notification. Your reminders are working." }); sendResponse({ok:true}); return; }
    if(msg?.type==="YOAH_TEST_REMOTE"){
      const res = await sendRemoteAlert('YoAH Timer remote test', `Remote alerts are working. ${new Date().toLocaleString()}`);
      if(res?.ok) sendResponse({ok:true});
      else if(res?.skipped) sendResponse({ok:false, error:'Remote alerts are disabled.'});
      else sendResponse({ok:false, error: res?.error || 'Remote alert failed.'});
      return;
    }
    sendResponse({ok:false});
  })();
  return true;
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex)=>{
  if(buttonIndex !== 0) return;
  if(!notificationId || !notificationId.startsWith(NOTIF_PREFIX)) return;
  const id = notificationId.slice(NOTIF_PREFIX.length);
  chrome.alarms.create(SNOOZE_PREFIX + id, { when: Date.now() + SNOOZE_MS });
  chrome.notifications.clear(notificationId);
});

chrome.alarms.onAlarm.addListener(async (alarm)=>{
  const state=await loadState();

  if(alarm.name.startsWith(ALARM_PREFIX)){
    const id=alarm.name.slice(ALARM_PREFIX.length);
    const auc=(state.auctions||[]).find(a=>a.id===id);
    if(!auc) return;
    notifyAuction(auc, { snoozed: false });
    auc.enabled=false;
    await saveState(state);
    return;
  }

  if(alarm.name.startsWith(SNOOZE_PREFIX)){
    const id=alarm.name.slice(SNOOZE_PREFIX.length);
    const auc=(state.auctions||[]).find(a=>a.id===id);
    if(!auc) return;
    notifyAuction(auc, { snoozed: true });
    return;
  }
});
