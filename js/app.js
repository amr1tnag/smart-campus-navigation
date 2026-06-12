// ================= GLOBALS =================
let steps = [];
let currentStepIndex = 0;
let currentPath = [];
let currentLayer;
let voiceEnabled = false;
const defaultMapCenter = [19.0443, 73.0245];
const defaultMapZoom = 17;

function syncAppHeight() {
  const height = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${height}px`);
}

syncAppHeight();
window.addEventListener("resize", syncAppHeight);
window.visualViewport?.addEventListener("resize", syncAppHeight);

// ================= TOAST =================
function showToast(message, type = "error") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  setTimeout(() => {
    toast.classList.remove("toast-visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 3200);
}

// ================= MARKER CATEGORIES =================
const markerCategories = {
  academic: {
    label: "Academic",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 5l9 5.5-9 5.5-9-5.5Z"/><path d="M6.5 13.5v3.2c1.5 1.3 3.3 1.9 5.5 1.9s4-.6 5.5-1.9v-3.2"/></svg>'
  },
  building: {
    label: "Building",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 20V5.8C6 4.8 6.8 4 7.8 4h8.4c1 0 1.8.8 1.8 1.8V20"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2M4 20h16"/></svg>'
  },
  gate: {
    label: "Gate",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V8.5C5 6 7 4 9.5 4h5C17 4 19 6 19 8.5V20"/><path d="M8 20v-9h8v9M12 11v9"/></svg>'
  },
  hospital: {
    label: "Hospital",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V6h14v14"/><path d="M9 12h6M12 9v6M4 20h16"/></svg>'
  },
  hostel: {
    label: "Hostel",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18V7h16v11"/><path d="M4 13h16M7 13v-2.2C7 9.8 7.8 9 8.8 9H11v4M13 13V9h2.2c1 0 1.8.8 1.8 1.8V13M4 18h16"/></svg>'
  },
  lab: {
    label: "Lab",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6M10 4v5.2l-4.5 7.4C4.6 18.1 5.7 20 7.5 20h9c1.8 0 2.9-1.9 2-3.4L14 9.2V4"/><path d="M8 15h8"/></svg>'
  },
  parking: {
    label: "Parking",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 20V4h5.2C16.4 4 18 5.8 18 8.3s-1.6 4.3-4.8 4.3H8"/><path d="M8 12.6h5"/></svg>'
  },
  sports: {
    label: "Sports",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M5.5 9.5c3.6 1.1 7.4 1.1 13 0M5.5 14.5c3.6-1.1 7.4-1.1 13 0M12 4c-2 2.2-3 4.9-3 8s1 5.8 3 8M12 4c2 2.2 3 4.9 3 8s-1 5.8-3 8"/></svg>'
  },
  worship: {
    label: "Place",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 5 11h14l-7-7Z"/><path d="M7 11v9M17 11v9M10 20v-5h4v5M5 20h14"/></svg>'
  },
  default: {
    label: "Location",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>'
  }
};

// ================= PANEL TOGGLE =================
const controlsPanel = document.getElementById("controls");
const panelToggle = document.getElementById("panelToggle");

if (controlsPanel && panelToggle) {
  const mobilePanelQuery = window.matchMedia("(max-width: 720px)");

  function setPanelCollapsed(isCollapsed) {
    controlsPanel.classList.toggle("is-collapsed", isCollapsed);
    panelToggle.innerText = isCollapsed ? "Expand" : "Collapse";
    panelToggle.setAttribute("aria-expanded", String(!isCollapsed));
  }

  setPanelCollapsed(mobilePanelQuery.matches);

  panelToggle.addEventListener("click", () => {
    setPanelCollapsed(!controlsPanel.classList.contains("is-collapsed"));
    setTimeout(() => { if (window.map) map.invalidateSize(); }, 260);
  });

  mobilePanelQuery.addEventListener("change", (event) => {
    setPanelCollapsed(event.matches);
  });
}

// ================= FETCH DATA =================
fetch("campus_nodes_edges.json")
  .then((response) => response.json())
  .then((data) => {

    data.nodes.forEach((node) => graph.addNode(node));
    data.edges.forEach((edge) => graph.addEdge(edge));

    // ================= GROUP NODES =================
    const nodesByName = {};

    data.nodes.forEach((node) => {
      if (node.name && node.name.trim() !== "") {
        const name = node.name.trim();
        if (!nodesByName[name]) nodesByName[name] = [];
        nodesByName[name].push(node);
      }
    });

    // ================= LOCATION MARKERS =================
    const locationMarkers = [];

    for (const name in nodesByName) {
      const nodes = nodesByName[name];
      const avgLat = nodes.reduce((sum, n) => sum + n.lat, 0) / nodes.length;
      const avgLng = nodes.reduce((sum, n) => sum + n.lng, 0) / nodes.length;
      locationMarkers.push({ name, lat: avgLat, lng: avgLng, category: getLocationCategory(name, nodes) });
    }

    locationMarkers.forEach((loc) => {
      L.marker([loc.lat, loc.lng], {
        icon: createLocationIcon(loc.category),
        title: loc.name
      })
        .bindPopup(`<strong>${loc.name}</strong><br>${markerCategories[loc.category].label}`)
        .addTo(map);
    });

    addMarkerLegend();

    // ================= POPULATE DATALISTS =================
    const startInput = document.getElementById("start");
    const endInput = document.getElementById("end");
    const startList = document.getElementById("start-list");
    const endList = document.getElementById("end-list");

    const sortedNames = locationMarkers.map(l => l.name).sort();

    sortedNames.forEach((name) => {
      const opt1 = document.createElement("option");
      opt1.value = name;
      startList.appendChild(opt1);

      const opt2 = document.createElement("option");
      opt2.value = name;
      endList.appendChild(opt2);
    });

    document.getElementById("voiceToggle").addEventListener("change", (e) => {
      voiceEnabled = e.target.checked;
    });

    document.getElementById("swapRoute").addEventListener("click", () => {
      const tmp = startInput.value;
      startInput.value = endInput.value;
      endInput.value = tmp;
    });

    document.getElementById("clearRoute").addEventListener("click", clearRoute);

    // ================= DRAW EDGES =================
    data.edges.forEach((edge) => {
      const from = graph.nodes.get(edge.from);
      const to = graph.nodes.get(edge.to);
      L.polyline([[from.lat, from.lng], [to.lat, to.lng]], { color: "gray", weight: 1, opacity: 0.5 }).addTo(map);
    });

    // ================= ROUTE BUTTON =================
    document.getElementById("findRoute").addEventListener("click", () => {
      const startName = startInput.value.trim();
      const endName = endInput.value.trim();

      if (!startName) { showToast("Please enter a start location"); return; }
      if (!endName) { showToast("Please enter an end location"); return; }
      if (!nodesByName[startName]) { showToast(`"${startName}" not found — pick from the list`); return; }
      if (!nodesByName[endName]) { showToast(`"${endName}" not found — pick from the list`); return; }
      if (startName === endName) { showToast("Start and end cannot be the same location"); return; }

      const findBtn = document.getElementById("findRoute");
      findBtn.disabled = true;
      findBtn.textContent = "Finding…";

      setTimeout(() => {
        const startIds = nodesByName[startName].map(n => n.id);
        const endIds = nodesByName[endName].map(n => n.id);

        let bestPath = null;
        let bestDistance = Infinity;

        for (const s of startIds) {
          for (const e of endIds) {
            const path = dijkstra(graph, s, e);
            if (path.length > 0) {
              const dist = calculateDistance(path);
              if (dist < bestDistance) {
                bestDistance = dist;
                bestPath = path;
              }
            }
          }
        }

        findBtn.disabled = false;
        findBtn.textContent = "Find Route";

        if (!bestPath) {
          showToast("No route found between these locations");
          return;
        }

        drawPath(bestPath);
        currentPath = bestPath;

        const distance = bestDistance.toFixed(0);
        const time = (bestDistance / 1.4 / 60).toFixed(1);

        document.getElementById("distance").innerText = distance + " m";
        document.getElementById("time").innerText = time + " min";
        document.getElementById("routeStats").hidden = false;

        steps = generateSteps(bestPath);
        currentStepIndex = 0;

        document.getElementById("directionsCard").hidden = false;
        showStep();
        speak(steps[currentStepIndex]);
        focusOnStep(currentPath, 0);

        showToast(`Route found: ${distance} m, ~${time} min`, "success");
      }, 0);
    });
  })
  .catch(() => {
    showToast("Failed to load campus data. Please refresh.");
  });

// ================= MARKER ICONS =================
function getLocationCategory(name, nodes = []) {
  const text = name.toLowerCase();
  const nodeTypes = nodes.map((node) => (node.type || "").toLowerCase());

  if (text.includes("parking") || text.includes("park")) return "parking";
  if (text.includes("gate") || text.includes("entrance")) return "gate";
  if (text.includes("lab") || text.includes("laboratory")) return "lab";
  if (text.includes("hospital") || text.includes("medical")) return "hospital";
  if (text.includes("hostel") || text.includes("quarter")) return "hostel";
  if (text.includes("stadium") || text.includes("ground") || text.includes("sports")) return "sports";
  if (text.includes("mandir") || text.includes("temple")) return "worship";
  if (
    text.includes("college") || text.includes("school") ||
    text.includes("university") || text.includes("centre") ||
    text.includes("center") || text.includes("coe")
  ) return "academic";
  if (text.includes("building") || text.includes("bldng") || nodeTypes.includes("building")) return "building";
  return "default";
}

function createLocationIcon(category) {
  const marker = markerCategories[category] || markerCategories.default;
  return L.divIcon({
    className: "",
    html: `<div class="map-marker map-marker-${category}"><span>${marker.icon}</span></div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
    popupAnchor: [0, -36]
  });
}

function addMarkerLegend() {
  const legend = L.control({ position: "bottomright" });
  const items = ["academic", "building", "gate", "hospital", "hostel", "lab", "parking", "sports"];

  legend.onAdd = function () {
    const div = L.DomUtil.create("div", "marker-legend");
    div.innerHTML = items.map((category) => {
      const marker = markerCategories[category];
      return `
        <div class="marker-legend-item">
          <span class="marker-legend-dot map-marker-${category}">${marker.icon}</span>
          <span>${marker.label}</span>
        </div>
      `;
    }).join("");
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    return div;
  };

  legend.addTo(map);
}

// ================= DISTANCE =================
function calculateDistance(path) {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const edges = graph.adjacencyList.get(path[i]);
    const edge = edges.find(e => e.to === path[i + 1]);
    if (edge) total += edge.weight;
  }
  return total;
}

// ================= DRAW PATH =================
function drawPath(path) {
  if (currentLayer) map.removeLayer(currentLayer);

  const coords = path.map(id => {
    const n = graph.nodes.get(id);
    return [n.lat, n.lng];
  });

  currentLayer = L.polyline(coords, { color: "#800000", weight: 5 }).addTo(map);
  map.fitBounds(currentLayer.getBounds());
}

function clearRoute() {
  if (currentLayer) {
    map.removeLayer(currentLayer);
    currentLayer = null;
  }

  steps = [];
  currentStepIndex = 0;
  currentPath = [];

  document.getElementById("routeStats").hidden = true;
  document.getElementById("directionsCard").hidden = true;
  document.getElementById("distance").innerText = "-";
  document.getElementById("time").innerText = "-";
  document.getElementById("stepText").innerText = "Click Find Route";
  document.getElementById("stepCounter").innerText = "";
  document.getElementById("allStepsList").innerHTML = "";

  updateNavButtons();

  if (window.speechSynthesis?.speaking) window.speechSynthesis.cancel();
  map.setView(defaultMapCenter, defaultMapZoom);
}

// ================= STEP GENERATION =================
function generateSteps(path) {
  const result = [];

  function getDirection(a, b, c) {
    if (!a || !b || !c) return "Continue straight";
    const angle =
      Math.atan2(c.lng - b.lng, c.lat - b.lat) -
      Math.atan2(b.lng - a.lng, b.lat - a.lat);
    let deg = (angle * 180) / Math.PI;
    deg = ((deg + 540) % 360) - 180;

    if (deg > -15 && deg < 15) return "Continue straight";
    if (deg >= 15 && deg < 45) return "Turn slight right";
    if (deg >= 45 && deg < 110) return "Turn right";
    if (deg >= 110 && deg < 170) return "Make a sharp right";
    if (deg <= -15 && deg > -45) return "Turn slight left";
    if (deg <= -45 && deg > -110) return "Turn left";
    if (deg <= -110 && deg > -170) return "Make a sharp left";
    return "Make a U-turn";
  }

  for (let i = 0; i < path.length - 1; i++) {
    const prev = graph.nodes.get(path[i - 1]);
    const curr = graph.nodes.get(path[i]);
    const next = graph.nodes.get(path[i + 1]);

    const edges = graph.adjacencyList.get(path[i]);
    const edge = edges.find(e => e.to === path[i + 1]);
    const dist = edge ? edge.weight : 0;

    let instruction;
    if (i === 0) {
      instruction = `Start and head straight for ${dist.toFixed(0)} m`;
    } else {
      const dir = getDirection(prev, curr, next);
      instruction = `${dir} for ${dist.toFixed(0)} m`;
    }

    if (next.name) instruction += ` towards ${next.name}`;
    result.push(instruction);
  }

  const lastNode = graph.nodes.get(path[path.length - 1]);
  if (lastNode?.name) result.push(`You have arrived at ${lastNode.name}`);

  return result;
}

// ================= SHOW STEP =================
function showStep() {
  const el = document.getElementById("stepText");
  const counter = document.getElementById("stepCounter");

  if (steps.length === 0) {
    el.innerText = "No directions available";
    counter.innerText = "";
    updateNavButtons();
    return;
  }

  el.innerText = steps[currentStepIndex];
  counter.innerText = `Step ${currentStepIndex + 1} of ${steps.length}`;
  updateNavButtons();
  renderAllSteps();
}

function updateNavButtons() {
  const prev = document.getElementById("prevStep");
  const next = document.getElementById("nextStep");
  prev.disabled = steps.length === 0 || currentStepIndex === 0;
  next.disabled = steps.length === 0 || currentStepIndex === steps.length - 1;
}

function renderAllSteps() {
  const list = document.getElementById("allStepsList");
  list.innerHTML = steps.map((s, i) =>
    `<li class="${i === currentStepIndex ? "active-step" : ""}">${s}</li>`
  ).join("");

  const active = list.querySelector(".active-step");
  if (active) active.scrollIntoView({ block: "nearest" });
}

// ================= MAP FOCUS =================
function focusOnStep(path, stepIndex) {
  if (!path || path.length < 2) return;
  const from = graph.nodes.get(path[stepIndex]);
  const to = graph.nodes.get(path[Math.min(stepIndex + 1, path.length - 1)]);
  if (!from || !to) return;
  map.fitBounds(L.latLngBounds([from.lat, from.lng], [to.lat, to.lng]), {
    padding: [50, 50],
    maxZoom: 19
  });
}

// ================= VOICE =================
function speak(text) {
  if (!voiceEnabled) return;
  const synth = window.speechSynthesis;
  if (synth.speaking) synth.cancel();
  const utter = new SpeechSynthesisUtterance(" " + text);
  utter.rate = 0.95;
  utter.pitch = 1;
  utter.volume = 1;
  setTimeout(() => synth.speak(utter), 100);
}

// ================= GPS =================
document.getElementById("gpsBtn").addEventListener("click", () => {
  const btn = document.getElementById("gpsBtn");
  if (!navigator.geolocation) {
    showToast("GPS not available on this device");
    return;
  }

  btn.classList.add("gps-loading");
  btn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      btn.classList.remove("gps-loading");
      btn.disabled = false;

      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 18);

      if (window._gpsMarker) map.removeLayer(window._gpsMarker);
      window._gpsMarker = L.circleMarker([latitude, longitude], {
        radius: 8,
        color: "#2563eb",
        fillColor: "#3b82f6",
        fillOpacity: 0.9,
        weight: 3
      }).bindPopup("You are here").addTo(map);

      document.getElementById("start").value = "My Location";
      window._gpsCoords = { lat: latitude, lng: longitude };
      showToast("Location found! Now pick your destination.", "success");
    },
    (err) => {
      btn.classList.remove("gps-loading");
      btn.disabled = false;
      const msgs = {
        1: "Location permission denied",
        2: "Location unavailable",
        3: "Location request timed out"
      };
      showToast(msgs[err.code] || "Could not get location");
    },
    { timeout: 10000, maximumAge: 30000 }
  );
});

// ================= MAP TAP TO SET DESTINATION =================
let tapMode = false;
let tapMarker = null;

function setTapMode(active) {
  tapMode = active;
  document.getElementById("map").style.cursor = active ? "crosshair" : "";
  document.getElementById("tapHint").textContent = active
    ? "Tap the map to set destination…"
    : "Tip: tap the map to set destination";
  document.getElementById("tapHint").classList.toggle("tap-hint-active", active);
}

document.getElementById("end").addEventListener("focus", () => setTapMode(true));
document.getElementById("end").addEventListener("blur", () => {
  setTimeout(() => setTapMode(false), 200);
});

// ================= PREV / NEXT =================
document.getElementById("nextStep").addEventListener("click", () => {
  if (currentStepIndex < steps.length - 1) {
    currentStepIndex++;
    showStep();
    focusOnStep(currentPath, currentStepIndex);
    speak(steps[currentStepIndex]);
  }
});

document.getElementById("prevStep").addEventListener("click", () => {
  if (currentStepIndex > 0) {
    currentStepIndex--;
    showStep();
    focusOnStep(currentPath, currentStepIndex);
    speak(steps[currentStepIndex]);
  }
});
