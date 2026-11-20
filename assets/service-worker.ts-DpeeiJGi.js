import{f as e,l as t,n,o as r,r as i,t as a,v as o,x as s}from"./logger-Cl8-E4U8.js";
import{c,n as l,o as u,s as d,t as f,v as p,y as m}from"./timed-booking.scheduler-BbyfB0iu.js";

async function h(e,t){
  let r=(await i.getJourneyTemplateById(e))||(await i.getActiveJourney());
  if(!r)return null;
  let a=await i.getPassengersByIds(t);
  if((!a||a.length===0)&&(a=await i.getActivePassengers()),!a||a.length===0)return null;
  let o=await i.getSettings(),s;
  return o.autoFillLogin&&(s=await n()??void 0),{journey:r,passengers:a,loginCredentials:s};
}

async function _(e){
  try{
    let history=(await chrome.storage.local.get("irctcBookingHistory"))["irctcBookingHistory"]||[];
    let record={
      id:"book_"+Date.now(),
      pnr:e.pnr||"",
      trainNumber:e.trainNumber,
      journeyClass:e.journeyClass,
      passengerCount:e.passengerCount,
      errorMessage:e.errorMessage,
      passengerStatuses:e.passengerStatuses||[],
      createdAt:new Date().toISOString()
    };
    history.unshift(record);
    if(history.length>50)history=history.slice(0,50);
    await chrome.storage.local.set({irctcBookingHistory:history});
    return record;
  }catch{
    return null;
  }
}

var v=new a("Background"),y=["*://*.irctc.co.in/*"],b=null;
x();

async function x(){
  let e=await i.getAutomationSnapshot();
  if(e?.tabId)try{await chrome.tabs.get(e.tabId),b=e.tabId}catch{b=null}
}

chrome.storage?.local?.get(["window_display_mode"],res=>{
  if(res?.window_display_mode==="sidepanel"){
    try{
      chrome.sidePanel?.setPanelBehavior?.({openPanelOnActionClick:!0});
      chrome.action?.setPopup?.({popup:""});
    }catch{}
  }
});

chrome.action?.onClicked?.addListener?.(async tab=>{
  try{
    if(chrome.sidePanel?.open&&tab?.windowId){
      await chrome.sidePanel.open({windowId:tab.windowId});
    }
  }catch(err){
    v.warn("action onClicked sidePanel: "+(err instanceof Error?err.message:err));
  }
});

chrome.runtime.onMessage.addListener((e,t,n)=>(
  S(e,t.tab?.id)
    .then(e=>n(e))
    .catch(e=>{n({ok:!1,error:e instanceof Error?e.message:"Background handler failed"})}),
  !0
));

chrome.alarms.onAlarm.addListener(e=>{
  if(e.name.startsWith("tatkal-")){
    k(e.name.slice(u.length)).catch(e=>{
      let t=e instanceof Error?e.message:"Scheduled booking failed";
      v.error(t);
    });
    return;
  }
  if(e.name.startsWith("timed-booking-")){
    A(e.name.slice(f.length)).catch(e=>{
      let t=e instanceof Error?e.message:"Timed booking failed";
      v.error(t);
    });
  }
});

l.restoreAlarms();

async function S(e,t){
  if(e.type==="STATUS_UPDATE"){
    let n=e.payload;
    return await T(n,t),await P(n),{ok:!0};
  }
  if(e.type==="GET_LOGIN_CREDENTIALS")return D();
  if(e.type==="CHECK_ENTITLEMENT")return{ok:!0,data:await c()};
  if(e.type==="REPORT_BOOKING_OUTCOME")return E(e.payload);

  if(!new Set(["START_AUTOMATION","STOP_AUTOMATION","RESUME_AUTOMATION","GET_STATUS"]).has(e.type))
    return{ok:!1,error:"Unhandled background message"};

  let n=t;
  if(!n&&e.type!=="GET_STATUS"){
    let[activeTab]=await chrome.tabs.query({active:!0,currentWindow:!0});
    if(activeTab?.url&&activeTab.url.includes("irctc.co.in")){
      n=activeTab.id;
    }else{
      let irctcTabs=await chrome.tabs.query({url:y});
      if(irctcTabs.length>0&&irctcTabs[0].id){
        n=irctcTabs[0].id;
        await chrome.tabs.update(n,{active:!0});
      }
    }
  }

  if(e.type==="START_AUTOMATION"){
    if(!n){
      v.info("No active IRCTC tab found — auto-launching IRCTC tab");
      let base=e.payload?.irctcSpaBase==="eticket"?"eticket":"nget";
      let targetUrl=base==="eticket"?"https://www.irctc.co.in/eticket/train-search":"https://www.irctc.co.in/nget/train-search";
      let tab=await chrome.tabs.create({url:targetUrl,active:!0});
      if(!tab.id)return{ok:!1,error:"Failed to open IRCTC tab"};
      await M(tab.id);
      await N(tab.id);
      n=tab.id;
    }
    let t=await O(n,e);
    if(t.ok){
      b=n;
      let data=t.data;
      data&&await T({context:data,state:data.state,message:"Automation started"},n);
    }
    return t;
  }

  if(e.type==="OPEN_SIDE_PANEL"){
    try{
      let winId=e.windowId;
      if(!winId){
        let [activeTab]=await chrome.tabs.query({active:!0,currentWindow:!0});
        winId=activeTab?.windowId;
      }
      if(!winId){
        let win=await chrome.windows.getCurrent();
        winId=win?.id;
      }
      if(chrome.sidePanel?.open&&winId){
        await chrome.sidePanel.open({windowId:winId});
        return{ok:!0};
      }
    }catch(err){
      v.warn("Failed to open sidePanel: "+(err instanceof Error?err.message:err));
    }
    return{ok:!1};
  }

  if(e.type==="SET_PANEL_BEHAVIOR"){
    try{
      if(chrome.sidePanel?.setPanelBehavior){
        await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:!!e.openOnActionClick});
      }
      if(chrome.action?.setPopup){
        await chrome.action.setPopup({popup:e.openOnActionClick?"":"index.html"});
      }
      await chrome.storage.local.set({window_display_mode:e.openOnActionClick?"sidepanel":"popup"});
      return{ok:!0};
    }catch(err){
      v.warn("Failed to setPanelBehavior: "+(err instanceof Error?err.message:err));
    }
    return{ok:!1};
  }

  if(e.type==="GET_STATUS")return C(n);

  let r=b??n;
  if(!r)return{ok:!1,error:"No automation tab found. Open IRCTC and try again."};
  let res=await O(r,e);
  if(res.ok&&res.data){
    let t=res.data;
    (e.type==="STOP_AUTOMATION"||e.type==="RESUME_AUTOMATION")&&await T({
      context:t,
      state:t.state,
      message:e.type==="STOP_AUTOMATION"?t.suspended?"Automation stopped — click Start to run again or Resume to continue":"Automation stopped":"Automation resumed"
    },r);
  }
  return res;
}

async function C(e){
  let t=await w(e);
  if(t){
    let e=await O(t,{type:"GET_STATUS"});
    if(e.ok&&e.data){
      let n=e.data;
      return b=t,await T({
        context:n,
        state:n.state,
        message:n.suspended?"Automation stopped — click Start to run again or Resume to continue":`Automation running — ${n.state}`
      },t),e;
    }
  }
  let n=await i.getAutomationSnapshot();
  return n?{ok:!0,data:n.context}:{ok:!1,error:"No automation tab found. Open IRCTC and try again."};
}

async function w(e){
  let t=[b,e];
  for(let e of t)if(e)try{return await chrome.tabs.get(e),b=e,e}catch{b===e&&(b=null)}
  let n=await i.getAutomationSnapshot();
  if(n?.tabId)try{return await chrome.tabs.get(n.tabId),b=n.tabId,n.tabId}catch{}
  let a=await chrome.tabs.query({url:y});
  for(let e of a)if(e.id)try{
    let t=await O(e.id,{type:"GET_STATUS"});
    if(!t.ok||!t.data)continue;
    let n=t.data;
    if(r(n))return b=e.id,e.id;
  }catch{continue}
  return null;
}

async function T(e,t){
  t&&(b=t),await i.saveAutomationSnapshot({context:e.context,statusMessage:e.message,tabId:t??b??void 0,updatedAt:new Date().toISOString()});
}

async function E(e){
  try{
    let t=await _(e);
    return t?(v.info(t.pnr?`Booking recorded PNR ${t.pnr}`:"Booking outcome recorded"),{ok:!0,data:t}):{ok:!0,data:e};
  }catch(e){
    let t=e instanceof Error?e.message:"Failed to report booking outcome";
    return v.error(t),{ok:!1,error:t};
  }
}

async function D(){
  let[e,t]=await Promise.all([s.getUsername(),s.getPassword()]);
  return!e?.trim()||!t?{ok:!1,error:"No login credentials saved"}:{ok:!0,data:{username:e.trim(),password:t}};
}

async function O(e,t){
  try{
    return await chrome.tabs.sendMessage(e,t)??{ok:!0};
  }catch(e){
    let t=e instanceof Error?e.message:"Failed to reach content script";
    return v.error(t),{ok:!1,error:t};
  }
}

async function k(e){
  v.info(`Executing Tatkal schedule: ${e}`);
  let n=(await i.getTatkalSchedules()).find(t=>t.id===e&&t.enabled);
  if(!n){v.warn(`Schedule not found or disabled: ${e}`);return}
  let r=await h(n.journeyTemplateId,n.passengerProfileIds);
  if(!r){v.error(`Schedule missing journey template or passengers`);return}
  await chrome.notifications.create({
    type:"basic",
    iconUrl:t,
    title:"AutoMotor Pro — Tatkal",
    message:`Starting Tatkal automation for ${r.journey.sourceStation} → ${r.journey.destinationStation}`
  });
  await j({...r,tatkalTimedBooking:o(r.journey.travelClass),irctcSpaBase:n.irctcSpaBase??"nget"});
  await d.cancelSchedule(e);
  v.info("Scheduled Tatkal automation started");
}

async function A(e){
  v.info(`Executing timed booking schedule: ${e}`);
  let n=(await i.getTimedBookingSchedules()).find(t=>t.id===e&&t.enabled);
  if(!n){v.warn(`Timed schedule not found or disabled: ${e}`);return}
  let r=await h(n.journeyTemplateId,n.passengerProfileIds);
  if(!r){v.error(`Timed schedule missing journey template or passengers`);return}
  await chrome.notifications.create({
    type:"basic",
    iconUrl:t,
    title:n.windowTimedBooking?"AutoMotor Pro — Advance Booking":"AutoMotor Pro — Scheduled Start",
    message:`Starting booking at ${n.triggerTimeIst} IST for ${r.journey.sourceStation} → ${r.journey.destinationStation}`
  });
  await j({
    ...r,
    ...n.windowTimedBooking?{tatkalTimedBooking:{openHour:n.windowTimedBooking.openHour,openMinute:n.windowTimedBooking.openMinute,classClickSecond:n.windowTimedBooking.classClickSecond,classClickDelayMs:n.windowTimedBooking.classClickDelayMs}}:{},
    irctcSpaBase:n.irctcSpaBase??"nget"
  });
  await l.cancelSchedule(e);
  v.info("Timed booking automation started");
}

async function j(t){
  let n=t.irctcSpaBase==="eticket"?"eticket":"nget",r=e(n);
  v.info(`Opening IRCTC ${n} train-search for scheduled automation`);
  let i=await chrome.tabs.create({url:r,active:!0});
  if(!i.id)throw Error("Failed to open IRCTC tab");
  await M(i.id);
  await N(i.id);
  let a=await O(i.id,{type:"START_AUTOMATION",payload:t});
  if(!a.ok)throw Error(a.error??"Failed to start scheduled automation");
  b=i.id;
  let o=a.data;
  o&&await T({context:o,state:o.state,message:"Automation started"},i.id);
}

async function M(e,t=8e3){
  let n=Date.now()+t;
  for(;Date.now()<n;){
    if((await chrome.tabs.get(e)).status==="complete")return;
    await new Promise(e=>setTimeout(e,150));
  }
  v.warn("IRCTC tab still loading background assets — starting automation on partial DOM");
}

async function N(e,t=45e3){
  let n=Date.now()+t;
  for(;Date.now()<n;){
    try{
      if(await chrome.tabs.sendMessage(e,{type:"GET_STATUS"}))return;
    }catch{}
    await new Promise(e=>setTimeout(e,200));
  }
  throw Error("Content script not ready on IRCTC tab");
}

async function P(e){
  let n=await i.getSettings(),{state:r,message:a}=e;
  r==="OTP_WAIT"&&n.notifyOnOtp&&await chrome.notifications.create({
    type:"basic",
    iconUrl:t,
    title:"AutoMotor Pro",
    message:"OTP required on IRCTC — enter it to continue booking."
  });
  r==="BOOKING_COMPLETE"&&v.info(a);
}

v.info("Background service worker initialized");
