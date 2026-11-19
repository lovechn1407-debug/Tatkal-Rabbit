import {
  x as credentialsManager,
  r as storageManager,
  g as calcTatkalTime,
  y as calcTatkalAlarm,
  b as getTatkalHour,
  a as AutomationStates,
  v as getTatkalTimedBooking
} from "./assets/logger-Cl8-E4U8.js";

import {
  s as tatkalScheduler,
  n as timedScheduler,
  r as formatIstTime,
  a as validateTimeStr
} from "./assets/timed-booking.scheduler-BbyfB0iu.js";

import {
  m as searchStationsList,
  r as getBerthsByClass,
  f as getStationByCode,
  g as classNamesMap,
  E as quotaNamesMap
} from "./assets/extension-links-B5zadNJ_.js";

// Global In-Memory State
let appSettings = null;
let journeyTemplates = [];
let activeJourney = null;
let passengerProfiles = [];
let activePassengers = [];
let activeInfants = [];
let stationCache = [];
let tatkalCountdownInterval = null;
let currentTheme = "dark";
let currentAuthUser = null;
let currentSubscription = null;

// Initialize on Load
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initTheme();
    await initData();
    setupNavigation();
    setupTipsDialog();
    setupAuthAndSubscription();
    setupSiteVersionSwitcher();
    setupStationAutocomplete();
    setupJourneyControls();
    setupPassengerControls();
    setupSchedulerControls();
    setupPreferencesControls();
    setupPaymentControls();
    setupCredentialsControls();
    setupMasterActionButtons();
    startTatkalCountdownTicker();
    listenToAutomationUpdates();
    await refreshCurrentStatus();
  } catch (err) {
    console.error("[Tatkal Rabbit] Init error:", err);
  }
});

// Tips, FAQ, Caution & Guide Dialog Controller
function setupTipsDialog() {
  const btnOpen = document.getElementById("btnOpenTips");
  const btnClose = document.getElementById("btnCloseTips");
  const dialog = document.getElementById("dialogTips");

  if (btnOpen && dialog) {
    btnOpen.addEventListener("click", () => {
      if (typeof dialog.show === "function") {
        dialog.show();
      } else {
        dialog.open = true;
      }
    });
  }

  if (btnClose && dialog) {
    btnClose.addEventListener("click", () => {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.open = false;
      }
    });
  }
}

// 1. Theme Initialization & Toggle (Light / Dark Mode)
async function initTheme() {
  const btnToggle = document.getElementById("btnThemeToggle");

  const stored = await new Promise(resolve => {
    chrome.storage.local.get(["appTheme"], resolve);
  });

  if (stored?.appTheme) {
    currentTheme = stored.appTheme;
  } else {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    currentTheme = prefersDark ? "dark" : "light";
  }

  applyTheme(currentTheme);

  if (btnToggle) {
    btnToggle.addEventListener("click", () => {
      currentTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(currentTheme);
      chrome.storage.local.set({ appTheme: currentTheme });
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const iconTheme = document.getElementById("iconTheme");
  if (iconTheme) {
    iconTheme.textContent = theme === "dark" ? "light_mode" : "dark_mode";
  }
}

// 2. Data Initialization
async function initData() {
  loadStationsList();

  const storageData = await storageManager.getStorageData();
  appSettings = storageData.settings || {};
  journeyTemplates = storageData.journeyTemplates || [];

  activeJourney = (await storageManager.getActiveJourney()) || journeyTemplates[0] || {
    id: "journey_" + Date.now(),
    name: "New Journey",
    sourceStation: "NDLS",
    destinationStation: "MMCT",
    journeyDate: getTomorrowDateStr(),
    travelClass: "3A",
    quota: "TQ",
    trainNumber: "",
    changeBoardingStation: false,
    boardingStation: "",
    irctcSpaBase: "nget"
  };

  if (!activeJourney.irctcSpaBase) activeJourney.irctcSpaBase = "nget";

  passengerProfiles = await storageManager.getPassengerProfiles();
  activePassengers = (await storageManager.getActivePassengers()) || [];
  if (activePassengers.length === 0) {
    activePassengers = passengerProfiles.length > 0 ? passengerProfiles : [
      {
        id: "psgn_" + Date.now(),
        name: "",
        age: 28,
        gender: "M",
        berthPreference: "LB",
        foodChoice: "V",
        childBerthRequired: true
      }
    ];
  }

  populateSiteVersionUI();
  populateJourneyUI();
  renderPassengerCards();
  populatePreferencesUI();
  populatePaymentUI();
  populateCredentialsUI();
  renderActiveSchedules();
  updateHeroRouteCard();
}

async function loadStationsList() {
  try {
    const res = await fetch(chrome.runtime.getURL("station_list.json"));
    if (res.ok) {
      stationCache = await res.json();
      updateHeroStationNames();
    }
  } catch (e) {
    console.warn("Could not load station list json", e);
  }
}

// 3. Navigation Tabs
function setupNavigation() {
  const mainTabs = document.getElementById("mainTabs");
  const panes = ["journey", "passengers", "preferences", "credentials", "scheduler"];

  const switchTab = (index) => {
    panes.forEach((name, i) => {
      const paneEl = document.getElementById(`pane-${name}`);
      if (paneEl) {
        paneEl.classList.toggle("active", i === index);
      }
    });

    if (panes[index] === "scheduler") updateSchedulerDetails();
  };

  if (mainTabs) {
    mainTabs.addEventListener("change", () => {
      switchTab(mainTabs.activeTabIndex);
    });

    panes.forEach((name, i) => {
      const btn = document.getElementById(`tabBtn-${name}`);
      if (btn) {
        btn.addEventListener("click", () => {
          mainTabs.activeTabIndex = i;
          switchTab(i);
        });
      }
    });
  }
}

// 4. Site Version Switcher (Old Website /nget vs New Website /eticket)
function setupSiteVersionSwitcher() {
  const btnNget = document.getElementById("btnSiteNget");
  const btnEticket = document.getElementById("btnSiteEticket");

  if (btnNget) {
    btnNget.addEventListener("click", () => {
      activeJourney.irctcSpaBase = "nget";
      populateSiteVersionUI();
      updateHeroRouteCard();
      saveJourneyState();
    });
  }

  if (btnEticket) {
    btnEticket.addEventListener("click", () => {
      activeJourney.irctcSpaBase = "eticket";
      populateSiteVersionUI();
      updateHeroRouteCard();
      saveJourneyState();
    });
  }
}

function populateSiteVersionUI() {
  const isEticket = activeJourney?.irctcSpaBase === "eticket";
  const btnNget = document.getElementById("btnSiteNget");
  const btnEticket = document.getElementById("btnSiteEticket");

  if (btnNget) btnNget.classList.toggle("active", !isEticket);
  if (btnEticket) btnEticket.classList.toggle("active", isEticket);

  const schedSiteLabel = document.getElementById("schedSiteLabel");
  if (schedSiteLabel) {
    schedSiteLabel.textContent = isEticket ? "New Site (/eticket)" : "Old Site (/nget)";
  }
}

// 5. Station Autocomplete & Swap
function setupStationAutocomplete() {
  setupStationInput("inputOrigin", "dropdownOrigin", code => {
    activeJourney.sourceStation = code;
    updateHeroRouteCard();
    saveJourneyState();
  });

  setupStationInput("inputDest", "dropdownDest", code => {
    activeJourney.destinationStation = code;
    updateHeroRouteCard();
    saveJourneyState();
  });

  setupStationInput("inputBoarding", "dropdownBoarding", code => {
    activeJourney.boardingStation = code;
    saveJourneyState();
  });

  const swapBtn = document.getElementById("btnSwapStations");
  if (swapBtn) {
    swapBtn.addEventListener("click", () => {
      const temp = activeJourney.sourceStation;
      activeJourney.sourceStation = activeJourney.destinationStation;
      activeJourney.destinationStation = temp;

      const originInput = document.getElementById("inputOrigin");
      const destInput = document.getElementById("inputDest");
      if (originInput) originInput.value = activeJourney.sourceStation;
      if (destInput) destInput.value = activeJourney.destinationStation;

      updateHeroRouteCard();
      saveJourneyState();
    });
  }

  // Quick Hub Chips
  document.querySelectorAll(".chip-quick-station").forEach(chip => {
    chip.addEventListener("click", () => {
      const code = chip.dataset.code;
      const originInput = document.getElementById("inputOrigin");
      const destInput = document.getElementById("inputDest");

      if (!originInput.value || originInput.value === code) {
        originInput.value = code;
        activeJourney.sourceStation = code;
      } else {
        destInput.value = code;
        activeJourney.destinationStation = code;
      }
      updateHeroRouteCard();
      saveJourneyState();
    });
  });
}

function setupStationInput(inputId, dropdownId, onSelect) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  if (!input || !dropdown) return;

  input.addEventListener("input", () => {
    const query = (input.value || "").trim().toLowerCase();
    if (!query || stationCache.length === 0) {
      dropdown.classList.remove("open");
      dropdown.innerHTML = "";
      return;
    }

    const matches = stationCache.filter(st => {
      const codeMatch = st.station_code.toLowerCase().includes(query);
      const nameMatch = st.station_name.toLowerCase().includes(query);
      return codeMatch || nameMatch;
    }).slice(0, 8);

    if (matches.length === 0) {
      dropdown.classList.remove("open");
      dropdown.innerHTML = "";
      return;
    }

    dropdown.innerHTML = matches.map(st => `
      <div class="station-item" data-code="${st.station_code}">
        <span>${st.station_name}</span>
        <span class="station-code-badge">${st.station_code}</span>
      </div>
    `).join("");

    dropdown.classList.add("open");

    dropdown.querySelectorAll(".station-item").forEach(item => {
      item.addEventListener("click", () => {
        const code = item.dataset.code;
        input.value = code;
        dropdown.classList.remove("open");
        dropdown.innerHTML = "";
        onSelect(code);
      });
    });
  });

  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove("open");
    }
  });
}

// 6. Journey Controls
function setupJourneyControls() {
  const dateInput = document.getElementById("inputJourneyDate");
  if (dateInput) {
    dateInput.addEventListener("change", () => {
      activeJourney.journeyDate = dateInput.value;
      updateSchedulerDetails();
      updateHeroRouteCard();
      saveJourneyState();
    });
  }

  const btnToday = document.getElementById("btnDateToday");
  if (btnToday) {
    btnToday.addEventListener("click", () => {
      const d = getTodayDateStr();
      if (dateInput) dateInput.value = d;
      activeJourney.journeyDate = d;
      updateHeroRouteCard();
      saveJourneyState();
    });
  }

  const btnTomorrow = document.getElementById("btnDateTomorrow");
  if (btnTomorrow) {
    btnTomorrow.addEventListener("click", () => {
      const d = getTomorrowDateStr();
      if (dateInput) dateInput.value = d;
      activeJourney.journeyDate = d;
      updateHeroRouteCard();
      saveJourneyState();
    });
  }

  const btnTatkal = document.getElementById("btnDateTatkal");
  if (btnTatkal) {
    btnTatkal.addEventListener("click", () => {
      const d = getTomorrowDateStr();
      if (dateInput) dateInput.value = d;
      activeJourney.journeyDate = d;
      activeJourney.quota = "TQ";
      updateQuotaChips("TQ");
      updateHeroRouteCard();
      saveJourneyState();
    });
  }

  // Quota Filter Chips
  const quotaChips = document.querySelectorAll("#quotaPillGrid md-filter-chip");
  quotaChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const quota = chip.dataset.quota;
      activeJourney.quota = quota;
      updateQuotaChips(quota);
      updateHeroRouteCard();
      saveJourneyState();
    });
  });

  // Travel Class Filter Chips
  const classChips = document.querySelectorAll("#classPillGrid md-filter-chip");
  classChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const cls = chip.dataset.class;
      activeJourney.travelClass = cls;
      updateClassChips(cls);
      renderPassengerCards();
      updateSchedulerDetails();
      updateHeroRouteCard();
      saveJourneyState();
    });
  });

  const trainInput = document.getElementById("inputTrainNumber");
  if (trainInput) {
    trainInput.addEventListener("input", () => {
      activeJourney.trainNumber = (trainInput.value || "").trim();
      updateHeroRouteCard();
      saveJourneyState();
    });
  }

  const checkBoarding = document.getElementById("checkBoarding");
  const boxBoarding = document.getElementById("boxBoardingStation");
  if (checkBoarding && boxBoarding) {
    checkBoarding.addEventListener("change", () => {
      activeJourney.changeBoardingStation = !!checkBoarding.selected;
      boxBoarding.style.display = checkBoarding.selected ? "block" : "none";
      saveJourneyState();
    });
  }

  const btnSavePlan = document.getElementById("btnSaveJourneyPlan");
  if (btnSavePlan) {
    btnSavePlan.addEventListener("click", async () => {
      const name = prompt("Enter a name for this Journey Plan:", `${activeJourney.sourceStation} - ${activeJourney.destinationStation} (${activeJourney.travelClass})`);
      if (name) {
        activeJourney.name = name;
        await storageManager.upsertJourneyTemplate(activeJourney);
        journeyTemplates = await storageManager.getJourneyTemplates();
        refreshJourneyTemplatesDropdown();
        alert("Journey plan saved successfully!");
      }
    });
  }

  const btnDeletePlan = document.getElementById("btnDeleteJourneyPlan");
  if (btnDeletePlan) {
    btnDeletePlan.addEventListener("click", async () => {
      const select = document.getElementById("selectJourneyTemplate");
      const id = select?.value;
      if (id) {
        if (confirm("Delete this saved journey plan?")) {
          await storageManager.deleteJourneyTemplate(id);
          journeyTemplates = await storageManager.getJourneyTemplates();
          refreshJourneyTemplatesDropdown();
        }
      }
    });
  }

  const selectPlan = document.getElementById("selectJourneyTemplate");
  if (selectPlan) {
    selectPlan.addEventListener("change", (e) => {
      const id = selectPlan.value;
      if (!id) return;
      const found = journeyTemplates.find(j => j.id === id);
      if (found) {
        activeJourney = { ...found };
        populateSiteVersionUI();
        populateJourneyUI();
        renderPassengerCards();
        updateHeroRouteCard();
        saveJourneyState();
      }
    });
  }
}

function populateJourneyUI() {
  const originInput = document.getElementById("inputOrigin");
  const destInput = document.getElementById("inputDest");
  const dateInput = document.getElementById("inputJourneyDate");
  const trainInput = document.getElementById("inputTrainNumber");

  if (originInput) originInput.value = activeJourney.sourceStation || "";
  if (destInput) destInput.value = activeJourney.destinationStation || "";
  if (dateInput) dateInput.value = activeJourney.journeyDate || getTomorrowDateStr();
  if (trainInput) trainInput.value = activeJourney.trainNumber || "";

  const checkBoarding = document.getElementById("checkBoarding");
  const boxBoarding = document.getElementById("boxBoardingStation");
  const boardingInput = document.getElementById("inputBoarding");

  if (checkBoarding) checkBoarding.selected = !!activeJourney.changeBoardingStation;
  if (boxBoarding) boxBoarding.style.display = activeJourney.changeBoardingStation ? "block" : "none";
  if (boardingInput) boardingInput.value = activeJourney.boardingStation || "";

  updateQuotaChips(activeJourney.quota || "TQ");
  updateClassChips(activeJourney.travelClass || "3A");
  refreshJourneyTemplatesDropdown();
}

function updateQuotaChips(quota) {
  document.querySelectorAll("#quotaPillGrid md-filter-chip").forEach(chip => {
    chip.selected = (chip.dataset.quota === quota);
  });
}

function updateClassChips(cls) {
  document.querySelectorAll("#classPillGrid md-filter-chip").forEach(chip => {
    chip.selected = (chip.dataset.class === cls);
  });
}

function refreshJourneyTemplatesDropdown() {
  const select = document.getElementById("selectJourneyTemplate");
  if (!select) return;
  select.innerHTML = '<md-select-option value="" selected><div slot="headline">-- Select Journey Plan --</div></md-select-option>';
  journeyTemplates.forEach(t => {
    const opt = document.createElement("md-select-option");
    opt.value = t.id;
    opt.innerHTML = `<div slot="headline">${t.name || t.sourceStation + ' → ' + t.destinationStation} (${t.travelClass})</div>`;
    if (activeJourney && activeJourney.id === t.id) opt.selected = true;
    select.appendChild(opt);
  });
}

async function saveJourneyState() {
  await storageManager.saveActiveJourney(activeJourney);
}

// Hero Route Card Visualizer
function updateHeroRouteCard() {
  const originCodeEl = document.getElementById("heroOriginCode");
  const destCodeEl = document.getElementById("heroDestCode");
  const dateTag = document.getElementById("heroDateTag");
  const quotaTag = document.getElementById("heroQuotaTag");
  const classTag = document.getElementById("heroClassTag");
  const psgnTag = document.getElementById("heroPsgnTag");
  const siteTag = document.getElementById("heroSiteTag");

  if (originCodeEl) originCodeEl.textContent = activeJourney.sourceStation || "FROM";
  if (destCodeEl) destCodeEl.textContent = activeJourney.destinationStation || "TO";
  if (dateTag) dateTag.textContent = activeJourney.journeyDate || "Tomorrow";
  if (quotaTag) quotaTag.textContent = `${activeJourney.quota || "TQ"}`;
  if (classTag) classTag.textContent = `${activeJourney.travelClass || "3A"}`;
  if (psgnTag) psgnTag.textContent = `${activePassengers.length} ${activePassengers.length === 1 ? "Passenger" : "Passengers"}`;
  if (siteTag) siteTag.textContent = activeJourney.irctcSpaBase === "eticket" ? "New Site" : "Old Site";

  updateHeroStationNames();
}

function updateHeroStationNames() {
  if (stationCache.length === 0) return;
  const originNameEl = document.getElementById("heroOriginName");
  const destNameEl = document.getElementById("heroDestName");

  const stOrigin = stationCache.find(s => s.station_code === activeJourney.sourceStation);
  const stDest = stationCache.find(s => s.station_code === activeJourney.destinationStation);

  if (originNameEl && stOrigin) originNameEl.textContent = stOrigin.station_name;
  if (destNameEl && stDest) destNameEl.textContent = stDest.station_name;
}

// 7. Passenger Controls
function setupPassengerControls() {
  const btnAdd = document.getElementById("btnAddPassenger");
  if (btnAdd) {
    btnAdd.addEventListener("click", () => {
      if (activePassengers.length >= 6) {
        alert("IRCTC permits a maximum of 6 passengers per booking.");
        return;
      }
      activePassengers.push({
        id: "psgn_" + Date.now(),
        name: "",
        age: 30,
        gender: "M",
        berthPreference: "LB",
        foodChoice: "V",
        childBerthRequired: true
      });
      renderPassengerCards();
      updateHeroRouteCard();
      savePassengerState();
    });
  }

  const btnAddInfant = document.getElementById("btnAddInfant");
  if (btnAddInfant) {
    btnAddInfant.addEventListener("click", () => {
      if (activeInfants.length >= 2) {
        alert("Maximum 2 infants without berth allowed.");
        return;
      }
      activeInfants.push({
        id: "inf_" + Date.now(),
        name: "",
        age: 2,
        gender: "M"
      });
      renderInfantCards();
    });
  }

  const btnSavePreset = document.getElementById("btnSavePsgnPreset");
  if (btnSavePreset) {
    btnSavePreset.addEventListener("click", async () => {
      if (activePassengers.length === 0) return;
      await storageManager.savePassengerProfiles(activePassengers);
      alert("Passenger list saved as default preset!");
    });
  }

  const btnLoadPreset = document.getElementById("btnLoadPsgnPreset");
  if (btnLoadPreset) {
    btnLoadPreset.addEventListener("click", async () => {
      const profiles = await storageManager.getPassengerProfiles();
      if (profiles.length > 0) {
        activePassengers = JSON.parse(JSON.stringify(profiles));
        renderPassengerCards();
        updateHeroRouteCard();
        savePassengerState();
      } else {
        alert("No saved passenger presets found.");
      }
    });
  }
}

function renderPassengerCards() {
  const container = document.getElementById("passengerCardsList");
  if (!container) return;
  container.innerHTML = "";

  const counterLabel = document.getElementById("psgnCounterLabel");
  if (counterLabel) {
    const textSpan = counterLabel.querySelector("span:last-child");
    if (textSpan) textSpan.textContent = `Passengers (${activePassengers.length}/6)`;
  }

  const travelClass = activeJourney?.travelClass || "3A";
  const berthOptions = getBerthsByClass(travelClass);

  activePassengers.forEach((psgn, idx) => {
    const card = document.createElement("div");
    card.className = "passenger-card";
    card.innerHTML = `
      <div class="passenger-card-header">
        <div class="passenger-num-pill">
          <span class="passenger-avatar">${idx + 1}</span>
          <span>Passenger #${idx + 1}</span>
        </div>
        ${activePassengers.length > 1 ? `<md-icon-button class="btn-remove-psgn" data-idx="${idx}" title="Remove Passenger"><md-icon>delete_outline</md-icon></md-icon-button>` : ""}
      </div>
      <div class="m3-grid-2">
        <md-outlined-text-field class="psgn-name" label="Full Name" value="${psgn.name || ""}" placeholder="As per Govt ID (Max 16 chars)" maxlength="16"></md-outlined-text-field>
        <md-outlined-text-field class="psgn-age" type="number" label="Age" value="${psgn.age || 25}" min="1" max="125"></md-outlined-text-field>
        <md-outlined-select class="psgn-gender" label="Gender">
          <md-select-option value="M" ${psgn.gender === "M" ? "selected" : ""}><div slot="headline">Male (M)</div></md-select-option>
          <md-select-option value="F" ${psgn.gender === "F" ? "selected" : ""}><div slot="headline">Female (F)</div></md-select-option>
          <md-select-option value="T" ${psgn.gender === "T" ? "selected" : ""}><div slot="headline">Transgender (T)</div></md-select-option>
        </md-outlined-select>
        <md-outlined-select class="psgn-berth" label="Berth Preference">
          ${berthOptions.map(b => `<md-select-option value="${b.value}" ${psgn.berthPreference === b.value ? "selected" : ""}><div slot="headline">${b.label}</div></md-select-option>`).join("")}
        </md-outlined-select>
        <md-outlined-select class="psgn-meal" label="Meal Preference" style="grid-column: 1 / -1;">
          <md-select-option value="V" ${psgn.foodChoice === "V" ? "selected" : ""}><div slot="headline">Veg</div></md-select-option>
          <md-select-option value="N" ${psgn.foodChoice === "N" ? "selected" : ""}><div slot="headline">Non-Veg</div></md-select-option>
          <md-select-option value="J" ${psgn.foodChoice === "J" ? "selected" : ""}><div slot="headline">Jain Meal</div></md-select-option>
          <md-select-option value="F" ${psgn.foodChoice === "F" ? "selected" : ""}><div slot="headline">Veg Diabetic</div></md-select-option>
          <md-select-option value="G" ${psgn.foodChoice === "G" ? "selected" : ""}><div slot="headline">Non-Veg Diabetic</div></md-select-option>
        </md-outlined-select>
      </div>
      ${psgn.age >= 1 && psgn.age <= 11 ? `
        <div class="m3-switch-row" style="margin-top: 8px;">
          <div class="m3-switch-label">
            <strong>Child Berth Required</strong>
            <p>Full berth allotted for child (Age 1–11)</p>
          </div>
          <md-switch class="psgn-child-berth" ${psgn.childBerthRequired ? "selected" : ""} icons></md-switch>
        </div>
      ` : ""}
    `;

    const nameInput = card.querySelector(".psgn-name");
    if (nameInput) {
      nameInput.addEventListener("input", () => {
        psgn.name = nameInput.value;
        savePassengerState();
      });
    }

    const ageInput = card.querySelector(".psgn-age");
    if (ageInput) {
      ageInput.addEventListener("change", () => {
        psgn.age = parseInt(ageInput.value, 10) || 25;
        savePassengerState();
        renderPassengerCards();
      });
    }

    const genderSelect = card.querySelector(".psgn-gender");
    if (genderSelect) {
      genderSelect.addEventListener("change", () => {
        psgn.gender = genderSelect.value;
        savePassengerState();
      });
    }

    const berthSelect = card.querySelector(".psgn-berth");
    if (berthSelect) {
      berthSelect.addEventListener("change", () => {
        psgn.berthPreference = berthSelect.value;
        savePassengerState();
      });
    }

    const mealSelect = card.querySelector(".psgn-meal");
    if (mealSelect) {
      mealSelect.addEventListener("change", () => {
        psgn.foodChoice = mealSelect.value;
        savePassengerState();
      });
    }

    const childBerth = card.querySelector(".psgn-child-berth");
    if (childBerth) {
      childBerth.addEventListener("change", () => {
        psgn.childBerthRequired = !!childBerth.selected;
        savePassengerState();
      });
    }

    const removeBtn = card.querySelector(".btn-remove-psgn");
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        activePassengers.splice(idx, 1);
        renderPassengerCards();
        updateHeroRouteCard();
        savePassengerState();
      });
    }

    container.appendChild(card);
  });
}

function renderInfantCards() {
  const container = document.getElementById("infantCardsList");
  if (!container) return;
  container.innerHTML = "";

  activeInfants.forEach((inf, idx) => {
    const card = document.createElement("div");
    card.className = "m3-card m3-row";
    card.style.gap = "8px";
    card.innerHTML = `
      <md-outlined-text-field class="inf-name" placeholder="Infant Name" value="${inf.name}" style="flex: 2;"></md-outlined-text-field>
      <md-outlined-select class="inf-age" label="Age" style="flex: 1;">
        <md-select-option value="0" ${inf.age === 0 ? "selected" : ""}><div slot="headline">&lt; 1 yr</div></md-select-option>
        <md-select-option value="1" ${inf.age === 1 ? "selected" : ""}><div slot="headline">1 yr</div></md-select-option>
        <md-select-option value="2" ${inf.age === 2 ? "selected" : ""}><div slot="headline">2 yrs</div></md-select-option>
        <md-select-option value="3" ${inf.age === 3 ? "selected" : ""}><div slot="headline">3 yrs</div></md-select-option>
        <md-select-option value="4" ${inf.age === 4 ? "selected" : ""}><div slot="headline">4 yrs</div></md-select-option>
      </md-outlined-select>
      <md-outlined-select class="inf-gender" label="Gender" style="flex: 1;">
        <md-select-option value="M" ${inf.gender === "M" ? "selected" : ""}><div slot="headline">M</div></md-select-option>
        <md-select-option value="F" ${inf.gender === "F" ? "selected" : ""}><div slot="headline">F</div></md-select-option>
      </md-outlined-select>
      <md-icon-button class="btn-del-inf" title="Remove Infant"><md-icon>delete_outline</md-icon></md-icon-button>
    `;

    card.querySelector(".inf-name").addEventListener("input", (e) => {
      inf.name = e.target.value;
    });

    card.querySelector(".inf-age").addEventListener("change", (e) => {
      inf.age = parseInt(e.target.value, 10);
    });

    card.querySelector(".inf-gender").addEventListener("change", (e) => {
      inf.gender = e.target.value;
    });

    card.querySelector(".btn-del-inf").addEventListener("click", () => {
      activeInfants.splice(idx, 1);
      renderInfantCards();
    });

    container.appendChild(card);
  });
}

async function savePassengerState() {
  await storageManager.saveActivePassengers(activePassengers);
}

// 8. Schedulers Controls
function setupSchedulerControls() {
  const btnSetTatkal = document.getElementById("btnSetTatkalSchedule");
  if (btnSetTatkal) {
    btnSetTatkal.addEventListener("click", async () => {
      try {
        if (!activeJourney || !activeJourney.journeyDate) {
          alert("Please select a journey date first.");
          return;
        }
        const scheduleId = "tatkal_" + Date.now();
        const payload = {
          id: scheduleId,
          journeyTemplateId: activeJourney.id,
          passengerProfileIds: activePassengers.map(p => p.id),
          irctcSpaBase: activeJourney.irctcSpaBase || "nget"
        };

        await tatkalScheduler.scheduleBooking(payload, {
          journeyDate: activeJourney.journeyDate,
          travelClass: activeJourney.travelClass || "3A"
        });

        alert(`⚡ Tatkal Auto-Start Scheduled on ${activeJourney.irctcSpaBase === 'eticket' ? 'New Site' : 'Old Site'}! The extension will automatically open IRCTC and begin booking 30 seconds before window.`);
        renderActiveSchedules();
      } catch (err) {
        alert("Error: " + (err.message || err));
      }
    });
  }
}

function updateSchedulerDetails() {
  const travelClass = activeJourney?.travelClass || "3A";
  const hour = getTatkalHour(travelClass);
  const isAc = hour === 10;

  const classTypeEl = document.getElementById("schedClassType");
  const openTimeEl = document.getElementById("schedOpenTime");
  const alarmTimeEl = document.getElementById("schedAlarmTime");

  if (classTypeEl) classTypeEl.textContent = `${travelClass} (${isAc ? "AC Class" : "Non-AC / Sleeper"})`;
  if (openTimeEl) openTimeEl.textContent = `${hour}:00:00 AM IST`;

  if (alarmTimeEl && activeJourney?.journeyDate) {
    try {
      const alarmDate = calcTatkalAlarm(activeJourney.journeyDate, travelClass);
      alarmTimeEl.textContent = alarmDate.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    } catch {
      alarmTimeEl.textContent = "Window already passed for this date";
    }
  }
}

async function renderActiveSchedules() {
  const listEl = document.getElementById("activeSchedulesList");
  if (!listEl) return;

  const [tatkalList, timedList] = await Promise.all([
    storageManager.getTatkalSchedules(),
    storageManager.getTimedBookingSchedules()
  ]);

  const activeTatkal = (tatkalList || []).filter(s => s.enabled);
  const activeTimed = (timedList || []).filter(s => s.enabled);

  if (activeTatkal.length === 0 && activeTimed.length === 0) {
    listEl.textContent = "No active alarms scheduled.";
    return;
  }

  let html = "";
  activeTatkal.forEach(s => {
    const siteTag = s.irctcSpaBase === "eticket" ? "New Site" : "Old Site";
    html += `
      <div class="m3-row" style="justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--md-sys-color-surface-container-highest);">
        <span>⚡ <b>Tatkal Alarm (${siteTag})</b>: ${new Date(s.scheduledFor).toLocaleTimeString()} IST</span>
        <md-outlined-button class="btn-cancel-tatkal" data-id="${s.id}"><md-icon slot="icon">close</md-icon>Cancel</md-outlined-button>
      </div>
    `;
  });

  activeTimed.forEach(s => {
    html += `
      <div class="m3-row" style="justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--md-sys-color-surface-container-highest);">
        <span>⏰ <b>Timed Alarm</b>: ${s.triggerTimeIst} IST</span>
        <md-outlined-button class="btn-cancel-timed" data-id="${s.id}"><md-icon slot="icon">close</md-icon>Cancel</md-outlined-button>
      </div>
    `;
  });

  listEl.innerHTML = html;

  listEl.querySelectorAll(".btn-cancel-tatkal").forEach(b => {
    b.addEventListener("click", async () => {
      await tatkalScheduler.cancelSchedule(b.dataset.id);
      renderActiveSchedules();
    });
  });

  listEl.querySelectorAll(".btn-cancel-timed").forEach(b => {
    b.addEventListener("click", async () => {
      await timedScheduler.cancelSchedule(b.dataset.id);
      renderActiveSchedules();
    });
  });
}

// 9. Preferences Controls
function setupPreferencesControls() {
  const bindSwitch = (id, prop) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", () => {
      const val = !!el.selected;
      appSettings[prop] = val;
      storageManager.updateSettings({ [prop]: val });
    });
  };

  const bindInput = (id, prop) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      const val = (el.value || "").trim();
      appSettings[prop] = val;
      storageManager.updateSettings({ [prop]: val });
    });
  };

  bindSwitch("checkConfirmOnly", "bookOnlyIfConfirmBerthAllotted");
  bindSwitch("checkAutoUpgrade", "considerAutoUpgradation");
  bindSwitch("checkNoFood", "doNotWantFood");
  bindSwitch("checkNotifyOtp", "notifyOnOtp");

  bindInput("inputPrefCoach", "preferredCoachNumber");
  bindInput("inputMobileNumber", "mobileNumber");

  bindInput("inputGstin", "gstin");
  bindInput("inputGstName", "gstName");
  bindInput("inputGstFlat", "gstFlat");
  bindInput("inputGstStreet", "gstStreet");
  bindInput("inputGstArea", "gstArea");
  bindInput("inputGstPin", "gstPin");
  bindInput("inputGstCity", "gstCity");
}

function populatePreferencesUI() {
  if (!appSettings) return;
  const setSwitch = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.selected = !!val;
  };

  setSwitch("checkConfirmOnly", appSettings.bookOnlyIfConfirmBerthAllotted);
  setSwitch("checkAutoUpgrade", appSettings.considerAutoUpgradation);
  setSwitch("checkNoFood", appSettings.doNotWantFood);
  setSwitch("checkNotifyOtp", appSettings.notifyOnOtp !== false);

  const setInput = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || "";
  };

  setInput("inputPrefCoach", appSettings.preferredCoachNumber);
  setInput("inputMobileNumber", appSettings.mobileNumber);
  setInput("inputGstin", appSettings.gstin);
  setInput("inputGstName", appSettings.gstName);
  setInput("inputGstFlat", appSettings.gstFlat);
  setInput("inputGstStreet", appSettings.gstStreet);
  setInput("inputGstArea", appSettings.gstArea);
  setInput("inputGstPin", appSettings.gstPin);
  setInput("inputGstCity", appSettings.gstCity);
}

// 10. Payment Controls (with Branded Cards)
function setupPaymentControls() {
  const chipUpi = document.getElementById("chipPayUpi");
  const chipWallet = document.getElementById("chipPayWallet");
  const boxUpi = document.getElementById("boxUpiGateway");

  const updateMode = (mode) => {
    appSettings.defaultPaymentMode = mode;
    storageManager.updateSettings({ defaultPaymentMode: mode });
    if (chipUpi) chipUpi.selected = (mode === "UPI");
    if (chipWallet) chipWallet.selected = (mode === "WALLET");
    if (boxUpi) boxUpi.style.display = mode === "UPI" ? "block" : "none";
  };

  if (chipUpi) chipUpi.addEventListener("click", () => updateMode("UPI"));
  if (chipWallet) chipWallet.addEventListener("click", () => updateMode("WALLET"));

  const gwCards = document.querySelectorAll(".m3-gateway-card");
  gwCards.forEach(card => {
    card.addEventListener("click", () => {
      gwCards.forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      const upi = card.dataset.upi;
      appSettings.upiProvider = upi;
      storageManager.updateSettings({ upiProvider: upi });
    });
  });
}

function populatePaymentUI() {
  if (!appSettings) return;
  const isWallet = appSettings.defaultPaymentMode === "WALLET";
  const chipUpi = document.getElementById("chipPayUpi");
  const chipWallet = document.getElementById("chipPayWallet");
  const boxUpi = document.getElementById("boxUpiGateway");

  if (chipUpi) chipUpi.selected = !isWallet;
  if (chipWallet) chipWallet.selected = isWallet;
  if (boxUpi) boxUpi.style.display = isWallet ? "none" : "block";

  const upi = appSettings.upiProvider || "PAYTM";
  document.querySelectorAll(".m3-gateway-card").forEach(card => {
    card.classList.toggle("selected", card.dataset.upi === upi);
  });
}

// 11. Credentials Controls
function setupCredentialsControls() {
  const checkLogin = document.getElementById("checkAutoFillLogin");
  if (checkLogin) {
    checkLogin.addEventListener("change", () => {
      appSettings.autoFillLogin = !!checkLogin.selected;
      storageManager.updateSettings({ autoFillLogin: checkLogin.selected });
    });
  }

  const pwdInput = document.getElementById("inputPassword");
  const toggleBtn = document.getElementById("btnTogglePassword");
  const toggleIcon = document.getElementById("iconTogglePassword");

  if (toggleBtn && pwdInput) {
    toggleBtn.addEventListener("click", () => {
      const isPass = pwdInput.type === "password";
      pwdInput.type = isPass ? "text" : "password";
      if (toggleIcon) toggleIcon.textContent = isPass ? "visibility_off" : "visibility";
    });
  }

  const btnSave = document.getElementById("btnSaveCredentials");
  if (btnSave) {
    btnSave.addEventListener("click", async () => {
      const user = (document.getElementById("inputUsername")?.value || "").trim();
      const pass = pwdInput?.value || "";
      if (!user || !pass) {
        alert("Please enter both IRCTC User ID and Password.");
        return;
      }
      try {
        await credentialsManager.saveCredentials(user, pass);
        alert("Credentials saved locally!");
      } catch (err) {
        alert("Error saving credentials: " + err.message);
      }
    });
  }

  const btnClear = document.getElementById("btnClearCredentials");
  if (btnClear) {
    btnClear.addEventListener("click", async () => {
      if (confirm("Clear saved IRCTC login credentials?")) {
        await credentialsManager.clearCredentials();
        const userInput = document.getElementById("inputUsername");
        if (userInput) userInput.value = "";
        if (pwdInput) pwdInput.value = "";
        alert("Credentials cleared.");
      }
    });
  }
}

async function populateCredentialsUI() {
  const checkLogin = document.getElementById("checkAutoFillLogin");
  if (checkLogin && appSettings) {
    checkLogin.selected = appSettings.autoFillLogin !== false;
  }

  const [username, password] = await Promise.all([
    credentialsManager.getUsername(),
    credentialsManager.getPassword()
  ]);

  const userInput = document.getElementById("inputUsername");
  const pwdInput = document.getElementById("inputPassword");

  if (userInput && username) userInput.value = username;
  if (pwdInput && password) pwdInput.value = password;
}

// Check if current IST time is right at the Tatkal opening minute
function isAtTatkalWindowMinute(travelClass) {
  const now = new Date();
  const istTime = new Date(now.getTime() + 330 * 60 * 1000);
  const hour = istTime.getUTCHours();
  const min = istTime.getUTCMinutes();
  const targetHour = getTatkalHour(travelClass); // 10 or 11
  return (hour === targetHour - 1 && min >= 58) || (hour === targetHour && min <= 2);
}

// 12. Master Action Buttons
let isActionPending = false;

function setupMasterActionButtons() {
  const btnStart = document.getElementById("btnStartAutomation");
  if (btnStart) {
    btnStart.addEventListener("click", async (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();

      if (isActionPending) return;

      // Subscription Verification Guard
      if (!isSubscriptionValid(currentSubscription)) {
        renderAuthAndSubscriptionUI();
        showToast("Valid Tatkal Rabbit subscription required to run automation!", "error");
        return;
      }

      isActionPending = true;
      try {
        setUiRunningState(true, "Launching automation...");

        // Reveal the visual stepper below the start button
        const tracker = document.getElementById("automationTracker");
        if (tracker) tracker.classList.add("visible");

        await saveJourneyState();
        await savePassengerState();

        const creds = await credentialsManager.hasCredentials() ? {
          username: await credentialsManager.getUsername(),
          password: await credentialsManager.getPassword()
        } : undefined;

        const travelClass = activeJourney.travelClass || "3A";
        const isTatkal = activeJourney.quota === "TQ" || activeJourney.quota === "PT";
        const openHour = getTatkalHour(travelClass);

        const shouldWaitTatkal = isTatkal && isAtTatkalWindowMinute(travelClass);

        let response;
        try {
          response = await chrome.runtime.sendMessage({
            type: "START_AUTOMATION",
            payload: {
              journey: activeJourney,
              passengers: activePassengers,
              loginCredentials: creds,
              tatkalTimedBooking: shouldWaitTatkal ? {
                openHour: openHour,
                openMinute: 0,
                classClickSecond: 7
              } : undefined,
              irctcSpaBase: activeJourney.irctcSpaBase || "nget"
            }
          });
        } catch (msgErr) {
          // If popup unloads or message channel closes when focusing IRCTC tab, automation is already running!
          if (msgErr?.message?.includes("message channel closed") || msgErr?.message?.includes("response was received")) {
            response = { ok: true };
          } else {
            throw msgErr;
          }
        }

        if (!response?.ok) {
          setUiRunningState(false, "Failed to start: " + (response?.error || "Unknown error"));
          showToast(response?.error || "Failed to start automation", "error");
        } else {
          setUiRunningState(true, "Automation active on IRCTC");
        }
      } catch (err) {
        setUiRunningState(false, "Error: " + err.message);
        showToast(err.message || "Failed to start", "error");
      } finally {
        isActionPending = false;
      }
    });
  }

  const btnResume = document.getElementById("btnResumeAutomation");
  if (btnResume) {
    btnResume.addEventListener("click", async (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();

      if (isActionPending) return;
      isActionPending = true;

      try {
        const res = await chrome.runtime.sendMessage({ type: "RESUME_AUTOMATION" });
        if (res?.ok) {
          setUiRunningState(true, "Automation resumed");
        } else {
          showToast(res?.error || "Could not resume", "error");
        }
      } finally {
        isActionPending = false;
      }
    });
  }

  const btnStop = document.getElementById("btnStopAutomation");
  if (btnStop) {
    btnStop.addEventListener("click", async (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();

      if (isActionPending) return;
      isActionPending = true;

      try {
        // Immediate UI feedback and full reset to Ready
        setUiRunningState(false, "Automation stopped", false);
        updateVisualStepper(AutomationStates.IDLE, "Stopped", false);
        const tracker = document.getElementById("automationTracker");
        if (tracker) tracker.classList.remove("visible");

        // Broadcast STOP to all IRCTC tabs immediately (stops all content loops and resets state)
        if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
          const tabs = await chrome.tabs.query({ url: "*://*.irctc.co.in/*" }).catch(() => []);
          for (const t of tabs) {
            if (t.id) chrome.tabs.sendMessage(t.id, { type: "STOP_AUTOMATION" }).catch(() => {});
          }
        }

        // Notify background service worker to reset snapshot
        await chrome.runtime.sendMessage({ type: "STOP_AUTOMATION" }).catch(() => {});
        showToast("Automation stopped and reset to ready");
      } catch (err) {
        console.warn("Stop error:", err);
      } finally {
        setUiRunningState(false, "Ready", false);
        isActionPending = false;
      }
    });
  }

  const btnOpenIrctc = document.getElementById("btnDashOpenIrctc");
  if (btnOpenIrctc) {
    btnOpenIrctc.addEventListener("click", () => {
      const base = activeJourney.irctcSpaBase === "eticket" ? "eticket" : "nget";
      chrome.tabs.create({ url: `https://www.irctc.co.in/${base}/train-search`, active: true });
    });
  }
}

// 13. Live Clock & Tatkal Countdown Ticker (No IST word)
function startTatkalCountdownTicker() {
  if (tatkalCountdownInterval) clearInterval(tatkalCountdownInterval);

  const tick = () => {
    const now = new Date();
    const istTime = new Date(now.getTime() + 330 * 60 * 1000);
    const curHour = istTime.getUTCHours();
    const curMin = istTime.getUTCMinutes();
    const curSec = istTime.getUTCSeconds();

    // Update Header Clock Text (No IST word)
    const istText = document.getElementById("istClockText");
    if (istText) {
      const hStr = String(curHour).padStart(2, "0");
      const mStr = String(curMin).padStart(2, "0");
      const sStr = String(curSec).padStart(2, "0");
      istText.textContent = `${hStr}:${mStr}:${sStr}`;
    }

    let targetHour = 10;
    if (curHour >= 11 || (curHour === 10 && curMin >= 0)) {
      targetHour = curHour < 11 ? 11 : 10;
    }

    let targetDate = new Date(istTime);
    if (curHour > targetHour || (curHour === targetHour && (curMin > 0 || curSec > 0))) {
      if (targetHour === 10 && curHour < 11) {
        targetHour = 11;
      } else {
        targetDate.setUTCDate(targetDate.getUTCDate() + 1);
        targetHour = 10;
      }
    }

    targetDate.setUTCHours(targetHour, 0, 0, 0);
    const diffMs = targetDate.getTime() - istTime.getTime();

    if (diffMs > 0) {
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      const s = Math.floor((diffMs % 60000) / 1000);
      const timerStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      const timerEl = document.getElementById("tatkalCountdownTimer");
      const titleEl = document.getElementById("tatkalBannerTitle");
      if (timerEl) timerEl.textContent = timerStr;
      if (titleEl) titleEl.textContent = `⚡ Next Window: ${targetHour === 10 ? "AC Classes (10 AM)" : "Non-AC (11 AM)"}`;
    }
  };

  tick();
  tatkalCountdownInterval = setInterval(tick, 1000);
}

// 14. Automation Progress & State Handling
function listenToAutomationUpdates() {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "STATUS_UPDATE") {
      handleStateUpdate(msg.payload);
    }
  });
}

async function refreshCurrentStatus() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
    if (res?.ok && res.data) {
      handleStateUpdate({ context: res.data, state: res.data.state, message: "Status synced" });
    }
  } catch {}
}

function handleStateUpdate(payload) {
  const { state, message, context } = payload;
  const isSuspended = context?.suspended;
  const isRunning = state && state !== AutomationStates.IDLE && state !== AutomationStates.BOOKING_COMPLETE && state !== AutomationStates.ERROR && !isSuspended;

  setUiRunningState(isRunning, message || state, isSuspended);
  updateVisualStepper(state, message, isSuspended);
}

function setUiRunningState(isRunning, statusMsg, isSuspended = false) {
  const dot = document.getElementById("headerStatusDot");
  const statusText = document.getElementById("headerStatusText");
  const footerText = document.getElementById("footerStatusText");
  const startBtn = document.getElementById("btnStartAutomation");
  const resumeBtn = document.getElementById("btnResumeAutomation");
  const stopBtn = document.getElementById("btnStopAutomation");

  if (footerText) footerText.textContent = statusMsg || "Ready";

  if (isSuspended) {
    if (dot) dot.className = "m3-status-dot waiting";
    if (statusText) statusText.textContent = "Paused (Action Needed)";
    if (resumeBtn) resumeBtn.style.display = "flex";
    if (stopBtn) stopBtn.style.display = "flex";
    if (startBtn) startBtn.style.display = "none";
  } else if (isRunning) {
    if (dot) dot.className = "m3-status-dot running";
    if (statusText) statusText.textContent = "Running";
    if (resumeBtn) resumeBtn.style.display = "none";
    if (stopBtn) stopBtn.style.display = "flex";
    if (startBtn) startBtn.style.display = "none";
  } else {
    if (dot) dot.className = "m3-status-dot active";
    if (statusText) statusText.textContent = "Ready";
    if (resumeBtn) resumeBtn.style.display = "none";
    if (stopBtn) stopBtn.style.display = "none";
    if (startBtn) startBtn.style.display = "flex";
  }
}

// LIVE VISUAL STEPPER UPDATER
function updateVisualStepper(state, statusMsg, isSuspended = false) {
  const stateStepMap = {
    [AutomationStates.IDLE]: 0,
    [AutomationStates.LOGIN_PAGE]: 1,
    [AutomationStates.SEARCH_PAGE]: 2,
    [AutomationStates.TRAIN_SELECTION]: 3,
    [AutomationStates.PASSENGER_ENTRY]: 4,
    [AutomationStates.REVIEW_BOOKING]: 5,
    [AutomationStates.CAPTCHA_WAIT]: 5,
    [AutomationStates.OTP_WAIT]: 5,
    [AutomationStates.PAYMENT_PAGE]: 6,
    [AutomationStates.BOOKING_COMPLETE]: 7,
    [AutomationStates.ERROR]: -1
  };

  const currentStep = stateStepMap[state] !== undefined ? stateStepMap[state] : 0;
  const steps = [
    { el: "flowStep-login", num: 1, label: "Login" },
    { el: "flowStep-search", num: 2, label: "Train Search" },
    { el: "flowStep-train", num: 3, label: "Availability" },
    { el: "flowStep-psgn", num: 4, label: "Passengers" },
    { el: "flowStep-review", num: 5, label: "Review & CAPTCHA" },
    { el: "flowStep-pay", num: 6, label: "Payment Checkout" }
  ];

  const trackerDot = document.getElementById("trackerStatusDot");
  const trackerText = document.getElementById("trackerStatusText");
  const trackerDetail = document.getElementById("trackerStepDetail");
  const trackerProgress = document.getElementById("trackerProgress");
  const footerStep = document.getElementById("footerStepIndicator");
  const automationTracker = document.getElementById("automationTracker");

  if (automationTracker) {
    if (currentStep > 0 || isSuspended) {
      automationTracker.classList.add("visible");
    }
  }

  // Update Tracker Header Text & Detail
  if (isSuspended) {
    if (trackerDot) trackerDot.className = "m3-status-dot waiting";
    if (trackerText) trackerText.textContent = "⚠️ Action Needed (CAPTCHA / OTP)";
    if (trackerDetail) trackerDetail.textContent = statusMsg || "Waiting for user input on IRCTC";
    if (trackerProgress) trackerProgress.style.display = "none";
  } else if (currentStep > 0 && currentStep <= 6) {
    if (trackerDot) trackerDot.className = "m3-status-dot running";
    if (trackerText) trackerText.textContent = `⚡ Automation: Step ${currentStep} of 6`;
    if (trackerDetail) trackerDetail.textContent = steps[currentStep - 1]?.label || statusMsg;
    if (trackerProgress) trackerProgress.style.display = "block";
    if (footerStep) footerStep.textContent = `Step ${currentStep}/6: ${steps[currentStep - 1]?.label}`;
  } else if (currentStep === 7) {
    if (trackerDot) trackerDot.className = "m3-status-dot active";
    if (trackerText) trackerText.textContent = "🎉 Booking Completed Successfully!";
    if (trackerDetail) trackerDetail.textContent = "Done";
    if (trackerProgress) trackerProgress.style.display = "none";
    if (footerStep) footerStep.textContent = "Completed (6/6)";
  } else {
    if (trackerDot) trackerDot.className = "m3-status-dot active";
    if (trackerText) trackerText.textContent = "Automation: Ready";
    if (trackerDetail) trackerDetail.textContent = "Idle";
    if (trackerProgress) trackerProgress.style.display = "none";
    if (footerStep) footerStep.textContent = "Step 0/6";
  }

  // Update Individual Steps Visuals
  steps.forEach(s => {
    const el = document.getElementById(s.el);
    if (!el) return;
    el.classList.remove("active", "completed", "waiting");

    if (currentStep === 7 || s.num < currentStep) {
      el.classList.add("completed");
    } else if (s.num === currentStep) {
      if (isSuspended) {
        el.classList.add("waiting");
      } else {
        el.classList.add("active");
      }
    }
  });

  // Update Connectors
  for (let i = 1; i <= 5; i++) {
    const conn = document.getElementById(`connector-${i}`);
    if (conn) {
      conn.classList.toggle("completed", currentStep === 7 || i < currentStep);
    }
  }
}

function getTodayDateStr() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

function getTomorrowDateStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

// ==========================================================================
// 15. Google Auth & Subscription Gating System
// ==========================================================================
function setupAuthAndSubscription() {
  const btnUserAccount = document.getElementById("btnUserAccount");
  const dialogUser = document.getElementById("dialogUserAccount");
  const btnCloseUserAccount = document.getElementById("btnCloseUserAccount");
  const btnOpenClientPortal = document.getElementById("btnOpenClientPortal");
  const btnDialogSyncSub = document.getElementById("btnDialogSyncSub");
  const btnDialogLogout = document.getElementById("btnDialogLogout");
  const btnProfileUpgrade = document.getElementById("btnProfileUpgrade");

  // Sign-In Modal Elements
  const authModal = document.getElementById("authSignInModal");
  const btnCloseAuthModal = document.getElementById("btnCloseAuthModal");
  const btnModalGoogleLogin = document.getElementById("btnModalGoogleLogin");
  const btnModalUnlockClipboard = document.getElementById("btnModalUnlockClipboard");
  const btnModalPasteToken = document.getElementById("btnModalPasteToken");

  // Paywall elements
  const btnSyncSubscriptionStatus = document.getElementById("btnSyncSubscriptionStatus");
  const btnOpenClientPage = document.getElementById("btnOpenClientPage");
  const btnPaywallPasteToken = document.getElementById("btnPaywallPasteToken");
  const btnSetPortalUrl = document.getElementById("btnSetPortalUrl");

  // Open Live Web Client Page on Vercel
  async function openClientWebpage(query = "") {
    const portalBase = await getWebPortalUrl();
    const extId = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) ? chrome.runtime.id : "";
    let cleanQuery = query.startsWith("?") ? query.substring(1) : query;
    if (extId) {
      cleanQuery = cleanQuery ? `extId=${extId}&${cleanQuery}` : `extId=${extId}`;
    }
    const fullUrl = `${portalBase}/client${cleanQuery ? '?' + cleanQuery : ''}`;
    
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: fullUrl });
    } else {
      window.open(fullUrl, "_blank");
    }
  }

  // Open & Close User Profile Modal (or Sign-in Modal if not logged in)
  if (btnUserAccount) {
    btnUserAccount.addEventListener("click", () => {
      if (!currentAuthUser && authModal) {
        authModal.style.display = "flex";
      } else if (dialogUser) {
        dialogUser.style.display = "flex";
      }
    });
  }

  if (btnCloseUserAccount && dialogUser) {
    btnCloseUserAccount.addEventListener("click", () => {
      dialogUser.style.display = "none";
    });
  }

  if (dialogUser) {
    dialogUser.addEventListener("click", (e) => {
      if (e.target === dialogUser) dialogUser.style.display = "none";
    });
  }

  // Sign-In Modal Handlers
  if (btnCloseAuthModal && authModal) {
    btnCloseAuthModal.addEventListener("click", () => {
      authModal.style.display = "none";
    });
  }

  if (authModal) {
    authModal.addEventListener("click", (e) => {
      if (e.target === authModal) authModal.style.display = "none";
    });
  }

  if (btnModalGoogleLogin) {
    btnModalGoogleLogin.addEventListener("click", () => {
      openClientWebpage("?action=login&source=extension");
    });
  }

  if (btnModalUnlockClipboard) {
    btnModalUnlockClipboard.addEventListener("click", async () => {
      const ok = await tryUnlockFromClipboard(true);
      if (ok && authModal) authModal.style.display = "none";
    });
  }

  if (btnModalPasteToken) {
    btnModalPasteToken.addEventListener("click", async () => {
      const tokenStr = prompt("Paste your Tatkal Rabbit Extension Sync Token copied from the Web Client Portal:");
      if (!tokenStr) return;
      const ok = await applySyncToken(tokenStr.trim());
      if (ok && authModal) authModal.style.display = "none";
    });
  }

  // Upgrade button in profile modal
  if (btnProfileUpgrade) {
    btnProfileUpgrade.addEventListener("click", () => {
      if (dialogUser) dialogUser.style.display = "none";
      const overlay = document.getElementById("subscriptionPaywallOverlay");
      if (overlay) overlay.scrollIntoView({ behavior: "smooth" });
    });
  }

  // Open Client portal buttons
  if (btnOpenClientPortal) {
    btnOpenClientPortal.addEventListener("click", () => {
      openClientWebpage();
    });
  }
  if (btnOpenClientPage) {
    btnOpenClientPage.addEventListener("click", () => {
      openClientWebpage();
    });
  }

  // Buy Pass Buttons in Paywall (Supports both modern .tr-plan-btn and legacy .m3-paywall-buy-btn)
  document.querySelectorAll(".tr-plan-btn, .m3-paywall-buy-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const plan = btn.getAttribute("data-plan") || "monthly";
      openClientWebpage(`?plan=${plan}&source=extension`);
    });
  });

  // Sync Status Buttons
  const doSync = async () => {
    await refreshSubscriptionState();
    if (isSubscriptionValid(currentSubscription)) {
      showToast("🎉 Tatkal Rabbit Pass is Active & Unlocked!");
    } else {
      // Try auto-reading from clipboard
      const clipSuccess = await tryUnlockFromClipboard();
      if (!clipSuccess) {
        showToast("No active pass found. Click 'Open Web Portal' or 'Unlock from Clipboard'.", "warning");
      }
    }
  };
  if (btnSyncSubscriptionStatus) btnSyncSubscriptionStatus.addEventListener("click", doSync);
  if (btnDialogSyncSub) btnDialogSyncSub.addEventListener("click", doSync);

  // Unlock from Clipboard Button
  const btnUnlockClipboard = document.getElementById("btnUnlockClipboard");
  if (btnUnlockClipboard) {
    btnUnlockClipboard.addEventListener("click", async () => {
      const ok = await tryUnlockFromClipboard(true);
      if (!ok) {
        showToast("No sync token found in clipboard. Copy it from your web portal first.", "warning");
      }
    });
  }

  // Paste Sync Token Handlers
  if (btnPaywallPasteToken) {
    btnPaywallPasteToken.addEventListener("click", async () => {
      const tokenStr = prompt("Paste your Tatkal Rabbit Extension Sync Token copied from the Web Client Portal:");
      if (!tokenStr) return;
      applySyncToken(tokenStr.trim());
    });
  }

  // Change Web Portal URL Handler
  if (btnSetPortalUrl) {
    btnSetPortalUrl.addEventListener("click", async () => {
      const cur = await getWebPortalUrl();
      const entered = prompt("Enter your Tatkal Rabbit Web Portal URL (Vercel domain):", cur);
      if (entered && entered.trim()) {
        const clean = entered.trim().replace(/\/$/, "");
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({ tatkal_web_portal_url: clean });
        }
        showToast("Portal URL updated to: " + clean);
      }
    });
  }

  // Logout (TASK 1: Show Sign-In Popup Immediately)
  if (btnDialogLogout) {
    btnDialogLogout.addEventListener("click", async () => {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove(["tatkal_auth_user", "tatkal_subscription", "tatkal_active_sub"]);
      }
      currentAuthUser = null;
      currentSubscription = null;
      if (dialogUser) dialogUser.style.display = "none";
      showToast("Signed out successfully");
      renderAuthAndSubscriptionUI();
      // SHOW SIGN-IN POPUP AGAIN IMMEDIATELY
      if (authModal) authModal.style.display = "flex";
    });
  }

  // Listen to storage changes in real time (e.g. from client portal tab)
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local") {
        if (changes.tatkal_auth_user) {
          currentAuthUser = changes.tatkal_auth_user.newValue || null;
        }
        if (changes.tatkal_subscription) {
          currentSubscription = changes.tatkal_subscription.newValue || null;
        }
        if (changes.tatkal_custom_pricing) {
          applyCustomPricing(changes.tatkal_custom_pricing.newValue);
        }
        renderAuthAndSubscriptionUI();
      }
    });
  }

  // Initial state check
  refreshSubscriptionState();
}

// Robust Timestamp Parser
function parseTimestamp(val) {
  if (!val) return null;
  if (typeof val.toDate === "function") return val.toDate();
  if (typeof val.seconds === "number") return new Date(val.seconds * 1000);
  if (typeof val._seconds === "number") return new Date(val._seconds * 1000);
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Check subscription validity with robust seconds & ISO parsing
function isSubscriptionValid(sub) {
  if (!sub) return false;
  if (sub.isSuspended) return false;
  if (sub.status !== "active") return false;
  if (!sub.validUntil) return false;

  const expiry = parseTimestamp(sub.validUntil);
  if (!expiry) return false;
  return expiry.getTime() > Date.now();
}

// Apply encoded sync token from clipboard or prompt
async function applySyncToken(tokenStr) {
  try {
    let clean = tokenStr.trim();
    let jsonStr = "";
    try {
      jsonStr = decodeURIComponent(escape(atob(clean)));
    } catch {
      jsonStr = clean;
    }
    const decoded = JSON.parse(jsonStr);
    const sub = decoded.subscription || decoded.sub || decoded;
    const expiry = parseTimestamp(sub.validUntil);

    if (sub && sub.status === "active" && expiry && expiry.getTime() > Date.now()) {
      currentAuthUser = {
        uid: decoded.uid || "web_user",
        email: decoded.email || "subscriber@gmail.com",
        displayName: decoded.displayName || (decoded.email ? decoded.email.split("@")[0] : "Verified Traveler"),
        photoURL: decoded.photoURL || ""
      };
      currentSubscription = sub;

      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        const payload = {
          tatkal_auth_user: currentAuthUser,
          tatkal_subscription: sub
        };
        if (decoded.pricing) payload.tatkal_custom_pricing = decoded.pricing;
        await chrome.storage.local.set(payload);
      }
      if (decoded.pricing) {
        applyCustomPricing(decoded.pricing);
      }
      renderAuthAndSubscriptionUI();
      showToast("🎉 Tatkal Rabbit Pass Verified & Unlocked!", "success");
      return true;
    } else {
      showToast("Pass in token is expired or inactive", "warning");
      return false;
    }
  } catch (e) {
    console.warn("Token decode error:", e);
    return false;
  }
}

// Try auto-unlocking from clipboard
async function tryUnlockFromClipboard(explicit = false) {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      const clipText = await navigator.clipboard.readText();
      if (clipText && (clipText.includes("eyJ") || clipText.includes("subscription") || clipText.includes("active"))) {
        return await applySyncToken(clipText);
      }
    }
  } catch (e) {
    if (explicit) console.warn("Clipboard read permission:", e);
  }
  return false;
}

// Web Portal URL Helper (supports custom Vercel domain or default)
async function getWebPortalUrl() {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    try {
      const stored = await chrome.storage.local.get(["tatkal_web_portal_url"]);
      if (stored && stored.tatkal_web_portal_url) return stored.tatkal_web_portal_url.replace(/\/$/, "");
    } catch (e) {}
  }
  return "https://tatkal-rabbit.vercel.app";
}

// Fetch live pricing from serverless API / Firestore REST for all users (including unauthenticated)
async function fetchCloudPricing() {
  const applyAndSave = (pricing) => {
    if (pricing && pricing["2day"]) {
      applyCustomPricing(pricing);
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ tatkal_custom_pricing: pricing });
      }
    }
  };

  // 1. Try Vercel Serverless /api/pricing
  try {
    const portalBase = await getWebPortalUrl();
    const res = await fetch(`${portalBase}/api/pricing?t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && data["2day"]) {
        applyAndSave(data);
        return;
      }
    }
  } catch (e) {}

  // 2. Try Firestore REST API directly
  try {
    const res = await fetch("https://firestore.googleapis.com/v1/projects/tatkal-rabbit/databases/(default)/documents/settings/pricing");
    if (res.ok) {
      const json = await res.json();
      if (json && json.fields) {
        const live = {
          "2day": {
            discountedPrice: Number(json.fields["2day"]?.mapValue?.fields?.discountedPrice?.integerValue ?? json.fields["2day"]?.mapValue?.fields?.discountedPrice?.doubleValue ?? 49),
            originalPrice: Number(json.fields["2day"]?.mapValue?.fields?.originalPrice?.integerValue ?? json.fields["2day"]?.mapValue?.fields?.originalPrice?.doubleValue ?? 149)
          },
          "weekly": {
            discountedPrice: Number(json.fields["weekly"]?.mapValue?.fields?.discountedPrice?.integerValue ?? json.fields["weekly"]?.mapValue?.fields?.discountedPrice?.doubleValue ?? 119),
            originalPrice: Number(json.fields["weekly"]?.mapValue?.fields?.originalPrice?.integerValue ?? json.fields["weekly"]?.mapValue?.fields?.originalPrice?.doubleValue ?? 399)
          },
          "monthly": {
            discountedPrice: Number(json.fields["monthly"]?.mapValue?.fields?.discountedPrice?.integerValue ?? json.fields["monthly"]?.mapValue?.fields?.discountedPrice?.doubleValue ?? 299),
            originalPrice: Number(json.fields["monthly"]?.mapValue?.fields?.originalPrice?.integerValue ?? json.fields["monthly"]?.mapValue?.fields?.originalPrice?.doubleValue ?? 999)
          }
        };
        applyAndSave(live);
      }
    }
  } catch (e) {}
}

// Dynamic Custom Pricing Update for Popup UI
function applyCustomPricing(pricingData) {
  if (!pricingData) return;
  
  if (pricingData["2day"]) {
    const p = pricingData["2day"].discountedPrice !== undefined ? pricingData["2day"].discountedPrice : (pricingData["2day"].price || 49);
    const c = pricingData["2day"].originalPrice || 149;
    const elP = document.getElementById("subPrice_2day");
    const elC = document.getElementById("subCutPrice_2day");
    const btn = document.getElementById("subBuyBtn_2day");
    if (elP) elP.innerHTML = `&#8377;${p}`;
    if (elC) elC.innerHTML = `&#8377;${c}`;
    if (btn) btn.innerHTML = `<md-icon style="font-size:14px;">flash_on</md-icon> <span>Buy (&#8377;${p})</span>`;
  }
  
  if (pricingData["weekly"]) {
    const p = pricingData["weekly"].discountedPrice !== undefined ? pricingData["weekly"].discountedPrice : (pricingData["weekly"].price || 119);
    const c = pricingData["weekly"].originalPrice || 399;
    const elP = document.getElementById("subPrice_weekly");
    const elC = document.getElementById("subCutPrice_weekly");
    const btn = document.getElementById("subBuyBtn_weekly");
    if (elP) elP.innerHTML = `&#8377;${p}`;
    if (elC) elC.innerHTML = `&#8377;${c}`;
    if (btn) btn.innerHTML = `<md-icon style="font-size:15px;">bolt</md-icon> <span>Buy Weekly (&#8377;${p})</span>`;
  }

  if (pricingData["monthly"]) {
    const p = pricingData["monthly"].discountedPrice !== undefined ? pricingData["monthly"].discountedPrice : (pricingData["monthly"].price || 299);
    const c = pricingData["monthly"].originalPrice || 999;
    const elP = document.getElementById("subPrice_monthly");
    const elC = document.getElementById("subCutPrice_monthly");
    const btn = document.getElementById("subBuyBtn_monthly");
    if (elP) elP.innerHTML = `&#8377;${p}`;
    if (elC) elC.innerHTML = `&#8377;${c}`;
    if (btn) btn.innerHTML = `<md-icon style="font-size:14px;">stars</md-icon> <span>Buy VIP (&#8377;${p})</span>`;
  }
}

// Refresh subscription from storage
async function refreshSubscriptionState() {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    try {
      const data = await chrome.storage.local.get(["tatkal_auth_user", "tatkal_subscription", "tatkal_active_sub", "tatkal_custom_pricing"]);
      currentAuthUser = data.tatkal_auth_user || null;
      currentSubscription = data.tatkal_subscription || data.tatkal_active_sub || null;
      if (data.tatkal_custom_pricing) {
        applyCustomPricing(data.tatkal_custom_pricing);
      }
    } catch (e) {
      console.warn("Storage get failed:", e);
    }
  }

  // Fetch live pricing in background regardless of logged-in status so unauthenticated users see updated prices
  fetchCloudPricing();

  // If not valid yet, try auto-reading clipboard token seamlessly
  if (!isSubscriptionValid(currentSubscription)) {
    await tryUnlockFromClipboard(false);
  }

  renderAuthAndSubscriptionUI();
}

// Render UI based on Auth & Subscription State
function renderAuthAndSubscriptionUI() {
  const headerAvatar = document.getElementById("headerUserAvatar");
  const headerPassChip = document.getElementById("headerPassActiveChip");
  const headerPassName = document.getElementById("headerPassName");

  const dialogAvatar = document.getElementById("dialogUserAvatar");
  const dialogAvatarDot = document.getElementById("dialogAvatarStatusDot");
  const dialogName = document.getElementById("dialogUserName");
  const dialogEmail = document.getElementById("dialogUserEmail");
  const dialogBadge = document.getElementById("dialogSubStatusBadge");
  const dialogActivePlanBox = document.getElementById("dialogActivePlanBox");
  const dialogInactivePlanBox = document.getElementById("dialogInactivePlanBox");
  const dialogActivePlanTitle = document.getElementById("dialogActivePlanTitle");
  const dialogActivePlanExpiry = document.getElementById("dialogActivePlanExpiry");

  const subBanner = document.getElementById("subscriptionPaywallOverlay");
  const contentArea = document.querySelector(".m3-content-area");
  const btnStartAutomation = document.getElementById("btnStartAutomation");

  const hasUser = Boolean(currentAuthUser && currentAuthUser.email);
  const hasActiveSub = isSubscriptionValid(currentSubscription);

  // Update Header Avatar & Overlapping Days Badge
  const daysBadge = document.getElementById("btnUserAccount");
  const daysText = document.getElementById("headerSubDaysText");

  // Update Header Avatar Image
  if (headerAvatar) {
    if (hasUser && currentAuthUser.photoURL) {
      headerAvatar.src = currentAuthUser.photoURL;
    } else {
      headerAvatar.src = "assets/rabbit_32.png";
    }
  }

  // Update Overlapping Days Badge
  if (daysText) {
    if (!hasUser) {
      daysText.textContent = "LOGIN";
      daysText.className = "tr-avatar-days-badge login";
      if (daysBadge) daysBadge.title = "Not signed in - Click to Sign In";
    } else if (hasActiveSub && currentSubscription) {
      const exp = parseTimestamp(currentSubscription.validUntil);
      if (exp) {
        const diffMs = exp.getTime() - Date.now();
        const daysLeft = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
        daysText.textContent = `${daysLeft}D`;
        if (daysBadge) daysBadge.title = `Active Pass: ${daysLeft} days remaining`;
      } else {
        daysText.textContent = "PRO";
        if (daysBadge) daysBadge.title = "Active Pass";
      }
      daysText.className = "tr-avatar-days-badge active";
    } else {
      daysText.textContent = "0D";
      daysText.className = "tr-avatar-days-badge inactive";
      if (daysBadge) daysBadge.title = "No active pass - Click to view plans";
    }
  }

  // Update Header Pass Chip
  if (headerPassChip) {
    if (hasActiveSub && currentSubscription) {
      headerPassChip.style.display = "inline-flex";
      const planTxt = currentSubscription.plan ? currentSubscription.plan.toUpperCase() : "PRO";
      if (headerPassName) headerPassName.textContent = `${planTxt} ACTIVE`;
    } else {
      headerPassChip.style.display = "none";
    }
  }

  // Update Account Profile Modal
  if (dialogAvatar) {
    dialogAvatar.src = (hasUser && currentAuthUser.photoURL) ? currentAuthUser.photoURL : "assets/rabbit_32.png";
  }
  if (dialogAvatarDot) {
    if (hasActiveSub) dialogAvatarDot.classList.add("active");
    else dialogAvatarDot.classList.remove("active");
  }
  if (dialogName) {
    dialogName.textContent = hasUser ? (currentAuthUser.displayName || currentAuthUser.email.split("@")[0]) : "Guest User";
  }
  if (dialogEmail) {
    dialogEmail.textContent = hasUser ? currentAuthUser.email : "Not signed in";
  }

  if (dialogBadge) {
    if (!hasUser) {
      dialogBadge.className = "tr-status-pill inactive";
      dialogBadge.textContent = "Sign-In Required";
    } else if (hasActiveSub) {
      dialogBadge.className = "tr-status-pill active";
      dialogBadge.textContent = "PRO PASS ACTIVE";
    } else if (currentSubscription && currentSubscription.isSuspended) {
      dialogBadge.className = "tr-status-pill inactive";
      dialogBadge.textContent = "Pass Suspended";
    } else {
      dialogBadge.className = "tr-status-pill inactive";
      dialogBadge.textContent = "No Active Pass";
    }
  }

  if (dialogActivePlanBox && dialogInactivePlanBox) {
    if (hasActiveSub && currentSubscription) {
      dialogActivePlanBox.style.display = "block";
      dialogInactivePlanBox.style.display = "none";
      const planName = currentSubscription.plan ? currentSubscription.plan.toUpperCase() + " PASS" : "PRO PASS";
      if (dialogActivePlanTitle) dialogActivePlanTitle.textContent = planName;
      if (dialogActivePlanExpiry && currentSubscription.validUntil) {
        const exp = parseTimestamp(currentSubscription.validUntil);
        if (exp) {
          dialogActivePlanExpiry.textContent = "Valid until: " + exp.toLocaleDateString("en-IN") + " " + exp.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' });
        }
      }
    } else {
      dialogActivePlanBox.style.display = "none";
      dialogInactivePlanBox.style.display = "block";
    }
  }

  // Non-Obstructive Locking System:
  // All options in all panels remain 100% visible!
  if (hasActiveSub) {
    // 1. Subscription is active: HIDE the banner, unlock start button
    if (subBanner) subBanner.style.display = "none";
    if (contentArea) contentArea.classList.remove("m3-locked-state");
    if (btnStartAutomation) {
      const targetState = "active";
      if (btnStartAutomation.dataset.subState !== targetState) {
        btnStartAutomation.dataset.subState = targetState;
        btnStartAutomation.disabled = false;
        btnStartAutomation.innerHTML = '<md-icon slot="icon">bolt</md-icon> Start IRCTC Automation';
      }
    }
  } else {
    // 2. Subscription required: SHOW the inline banner card, lock start button
    if (subBanner) subBanner.style.display = "block";
    if (contentArea) contentArea.classList.add("m3-locked-state");
    if (btnStartAutomation) {
      const targetState = "locked";
      if (btnStartAutomation.dataset.subState !== targetState) {
        btnStartAutomation.dataset.subState = targetState;
        btnStartAutomation.disabled = false; // Keep clickable to guide user
        btnStartAutomation.innerHTML = '<md-icon slot="icon">lock</md-icon> Start Automation (Pass Required)';
      }
    }
  }

  // Sign-In Modal Management (Task 1: Show sign-in popup when logged out / unauthenticated)
  const authModal = document.getElementById("authSignInModal");
  if (authModal) {
    if (!hasUser) {
      authModal.style.display = "flex";
    } else {
      authModal.style.display = "none";
    }
  }
}
