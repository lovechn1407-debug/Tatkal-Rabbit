import{C as e,S as t,r as n,t as r,y as i}from"./logger-Cl8-E4U8.js";
var a="https://w2wq11a3nd.execute-api.ap-south-1.amazonaws.com/prod",
    o="https://www.automotor.cloud",
    s="100% Free & Unrestricted Pro Version.",
    c="Active subscription required.",
    l="Please log in with your phone number to continue.",
    u="automotorAuthSession",
    d="automotor-auth-cleared",
    f=new class{
      async saveSession(e){}
      async getSession(){return{accessToken:"pro_unlocked",user:{phone:"9999999999"}};}
      async getAccessToken(){return"pro_unlocked";}
      async getUser(){return{phone:"9999999999"};}
      async isLoggedIn(){return true;}
      async clearSession(){}
    };

function p(){return true;}
function m(){return false;}
async function h(e){return"OK";}
async function g(e,t={},n){return{};}
async function _(e){return{success:true};}
async function v(e,t){return{accessToken:"pro_unlocked",user:{phone:e}};}
async function y(){return[{id:"lifetime",name:"Pro Lifetime",price:0,active:true}];}
var b="Pro Active",x=600*1e3;
function S(e){return Date.now()+864e5*365;}
function C(e){return false;}
async function w(){return"pro_unlocked";}
async function T(){return{active:true,plan:"Pro Lifetime",expiresAt:"2099-12-31T23:59:59Z"};}
async function E(){}
var D="automotorSubscriptionSnapshot";
async function O(){return{active:true,plan:"Pro Lifetime",expiresAt:"2099-12-31T23:59:59Z"};}
async function k(e){}
async function A(){return{active:true,plan:"Pro Lifetime",expiresAt:"2099-12-31T23:59:59Z"};}
function j(e){return false;}

// Unlocked entitlement: always allowed
async function M(){
  return{
    allowed:true,
    subscription:{
      active:true,
      plan:"Pro Lifetime",
      expiresAt:"2099-12-31T23:59:59Z"
    }
  };
}
function N(){}

var P=new r("TatkalScheduler"),F="tatkal-",I=new class{
  async scheduleBooking(e,t){
    let r=i(t.journeyDate,t.travelClass);
    if(r.getTime()<=Date.now())throw Error("Tatkal window has already passed for this journey date");
    let a={...e,scheduledFor:r.toISOString(),enabled:!0};
    await chrome.alarms.create(`${F}${e.id}`,{when:r.getTime()});
    await n.upsertTatkalSchedule(a);
    P.info(`Tatkal alarm scheduled for ${a.scheduledFor}`);
  }
  async cancelSchedule(e){
    await chrome.alarms.clear(`${F}${e}`);
    let t=(await n.getTatkalSchedules()).find(t=>t.id===e);
    t&&await n.upsertTatkalSchedule({...t,enabled:!1});
    P.info(`Tatkal alarm cancelled: ${e}`);
  }
  async getSchedules(){return n.getTatkalSchedules();}
};

var L=330;
function R(e,t=new Date,n=0){
  let[r,i]=e.split(":").map(Number),
      a=t.getTime()+L*60*1e3,
      o=new Date(a),
      s=o.getUTCFullYear(),
      c=o.getUTCMonth(),
      l=o.getUTCDate(),
      u=o.getUTCHours(),
      d=o.getUTCMinutes();
  if(u>r||u===r&&d>=i){
    let e=new Date(Date.UTC(s,c,l)+864e5);
    s=e.getUTCFullYear();c=e.getUTCMonth();l=e.getUTCDate();
  }
  let f=new Date(Date.UTC(s,c,l,r,i,0)-L*60*1e3);
  return new Date(f.getTime()-n*1e3);
}

function z(e){
  let[t,n]=e.split(":").map(Number),r=t>=12?"PM":"AM";
  return`${t%12==0?12:t%12}:${String(n).padStart(2,"0")} ${r} IST`;
}

function B(e){
  let t=e.trim().match(/^(\d{1,2}):(\d{2})$/);
  if(!t)throw Error("Time must be in HH:mm format");
  let n=Number(t[1]),r=Number(t[2]);
  if(n<0||n>23||r<0||r>59)throw Error("Invalid time");
  return`${String(n).padStart(2,"0")}:${String(r).padStart(2,"0")}`;
}

var V=new r("TimedBookingScheduler"),H="timed-booking-",U=new class{
  async scheduleBooking(e,t){
    let r=R(e.triggerTimeIst,new Date,e.leadTimeSeconds??0);
    if(r.getTime()<=Date.now())throw Error("Scheduled time has already passed for today");
    let i={...e,scheduledFor:r.toISOString(),enabled:!0};
    await chrome.alarms.create(`${H}${e.id}`,{when:r.getTime()});
    await n.upsertTimedBookingSchedule(i);
    V.info(`Timed booking alarm scheduled for ${i.triggerTimeIst} IST (${i.scheduledFor})`);
  }
  async cancelSchedule(e){
    await chrome.alarms.clear(`${H}${e}`);
    let t=(await n.getTimedBookingSchedules()).find(t=>t.id===e);
    t&&await n.upsertTimedBookingSchedule({...t,enabled:!1});
    V.info(`Timed booking alarm cancelled: ${e}`);
  }
  async getSchedules(){return n.getTimedBookingSchedules();}
  async restoreAlarms(){
    let e=await n.getTimedBookingSchedules();
    for(let t of e.filter(e=>e.enabled)){
      let e=R(t.triggerTimeIst,new Date,t.leadTimeSeconds??0);
      e.getTime()<=Date.now()||await chrome.alarms.create(`${H}${t.id}`,{when:e.getTime()});
    }
  }
};

export{d as _,B as a,o as b,M as c,y as d,E as f,p as g,m as h,R as i,N as l,v as m,U as n,F as o,_ as p,z as r,I as s,H as t,O as u,f as v,s as x,a as y};
