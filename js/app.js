// ================= GLOBALS =================
let steps = [];
let currentStepIndex = 0;
let currentPath = [];
let currentLayer;
let startMarker = null;
let endMarker = null;
let positionMarker = null;
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

// ================= HAVERSINE (for nearest-node snapping) =================
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestNamedLocation(lat, lng, locationMarkers) {
  let best = null, bestDist = Infinity;
  for (const loc of locationMarkers) {
    const d = haversine(lat, lng, loc.lat, loc.lng);
    if (d < bestDist) { bestDist = d; best = loc; }
  }
  return best;
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
      const safeName = loc.name.replace(/"/g, "&quot;");
      L.marker([loc.lat, loc.lng], {
        icon: createLocationIcon(loc.category),
        title: loc.name
      })
        .bindPopup(`
          <div class="map-popup">
            <strong>${loc.name}</strong>
            <p class="popup-category">${markerCategories[loc.category].label}</p>
            <div class="popup-actions">
              <button class="popup-btn popup-set-start" data-name="${safeName}">Set as Start</button>
              <button class="popup-btn popup-set-end" data-name="${safeName}">Set as End</button>
            </div>
          </div>
        `, { minWidth: 160 })
        .addTo(map);
    });

    // Popup "Set as Start/End" button handlers
    map.on("popupopen", (e) => {
      const el = e.popup.getElement();
      el.querySelector(".popup-set-start")?.addEventListener("click", () => {
        startInput.value = el.querySelector(".popup-set-start").dataset.name;
        map.closePopup();
      });
      el.querySelector(".popup-set-end")?.addEventListener("click", () => {
        endInput.value = el.querySelector(".popup-set-end").dataset.name;
        map.closePopup();
      });
    });

    addMarkerLegend();

    // ================= RECENT ROUTES =================
    function getRecentRoutes() {
      try { return JSON.parse(localStorage.getItem("recentRoutes")) || []; }
      catch { return []; }
    }

    function saveRecentRoute(from, to) {
      const existing = getRecentRoutes().filter(r => !(r.from === from && r.to === to));
      existing.unshift({ from, to });
      localStorage.setItem("recentRoutes", JSON.stringify(existing.slice(0, 5)));
      renderRecentRoutes();
    }

    function renderRecentRoutes() {
      const routes = getRecentRoutes();
      const container = document.getElementById("recentRoutes");
      const chips = document.getElementById("recentChips");
      if (routes.length === 0) { container.hidden = true; return; }
      container.hidden = false;
      chips.innerHTML = routes.map((r, i) =>
        `<button class="recent-chip" data-index="${i}">
          <span class="recent-from">${r.from}</span>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
          <span class="recent-to">${r.to}</span>
        </button>`
      ).join("");
    }

    document.getElementById("recentChips").addEventListener("click", (e) => {
      const chip = e.target.closest(".recent-chip");
      if (!chip) return;
      const routes = getRecentRoutes();
      const route = routes[+chip.dataset.index];
      if (!route) return;
      startInput.value = route.from;
      endInput.value = route.to;
      findRoute();
    });

    renderRecentRoutes();

    // ================= AUTOCOMPLETE =================
    const startInput = document.getElementById("start");
    const endInput = document.getElementById("end");

    const categoryColors = {
      academic: "#8d1f1f", building: "#475569", gate: "#0f766e",
      hospital: "#dc2626", hostel: "#7c3aed", lab: "#2563eb",
      parking: "#0284c7", sports: "#15803d", worship: "#b45309", default: "#334155"
    };

    function setupAutocomplete(input, dropdownId) {
      const dropdown = document.getElementById(dropdownId);
      let highlighted = -1;

      function getMatches(query) {
        if (!query) return locationMarkers.slice(0, 8);
        const q = query.toLowerCase();
        return locationMarkers
          .filter(l => l.name.toLowerCase().includes(q))
          .slice(0, 8);
      }

      function renderDropdown(matches) {
        highlighted = -1;
        if (matches.length === 0) {
          dropdown.innerHTML = `<div class="autocomplete-empty">No locations found</div>`;
        } else {
          dropdown.innerHTML = matches.map((loc, i) => `
            <div class="autocomplete-item" data-name="${loc.name}" data-index="${i}" role="option">
              <span class="autocomplete-item-dot" style="background:${categoryColors[loc.category] || '#334155'}"></span>
              ${loc.name}
            </div>
          `).join("");
        }
        dropdown.classList.add("is-open");
        input.setAttribute("aria-expanded", "true");
      }

      function closeDropdown() {
        dropdown.classList.remove("is-open");
        input.setAttribute("aria-expanded", "false");
        highlighted = -1;
      }

      function selectItem(name) {
        input.value = name;
        closeDropdown();
      }

      function updateHighlight(items, newIndex) {
        items.forEach((el, i) => el.classList.toggle("is-highlighted", i === newIndex));
        highlighted = newIndex;
      }

      input.addEventListener("input", () => {
        renderDropdown(getMatches(input.value.trim()));
      });

      input.addEventListener("focus", () => {
        renderDropdown(getMatches(input.value.trim()));
      });

      input.addEventListener("keydown", (e) => {
        const items = [...dropdown.querySelectorAll(".autocomplete-item")];
        if (!items.length) return;

        if (e.key === "ArrowDown") {
          e.preventDefault();
          updateHighlight(items, Math.min(highlighted + 1, items.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          updateHighlight(items, Math.max(highlighted - 1, 0));
        } else if (e.key === "Enter") {
          if (highlighted >= 0 && items[highlighted]) {
            e.preventDefault();
            selectItem(items[highlighted].dataset.name);
          }
        } else if (e.key === "Escape") {
          closeDropdown();
        }
      });

      dropdown.addEventListener("mousedown", (e) => {
        const item = e.target.closest(".autocomplete-item");
        if (item) { e.preventDefault(); selectItem(item.dataset.name); }
      });

      dropdown.addEventListener("touchend", (e) => {
        const item = e.target.closest(".autocomplete-item");
        if (item) { e.preventDefault(); selectItem(item.dataset.name); }
      });

      document.addEventListener("click", (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) closeDropdown();
      });
    }

    setupAutocomplete(startInput, "start-dropdown");
    setupAutocomplete(endInput, "end-dropdown");

    document.getElementById("voiceToggle").addEventListener("change", (e) => {
      voiceEnabled = e.target.checked;
    });

    document.getElementById("swapRoute").addEventListener("click", () => {
      const tmp = startInput.value;
      startInput.value = endInput.value;
      endInput.value = tmp;
      // swap any snapped coords too
      const tmpCoords = window._gpsCoords;
      window._gpsCoords = window._tapCoords;
      window._tapCoords = tmpCoords;
    });

    document.getElementById("clearRoute").addEventListener("click", clearRoute);

    // ================= DRAW EDGES =================
    data.edges.forEach((edge) => {
      const from = graph.nodes.get(edge.from);
      const to = graph.nodes.get(edge.to);
      L.polyline([[from.lat, from.lng], [to.lat, to.lng]], { color: "gray", weight: 1, opacity: 0.5 }).addTo(map);
    });

    // ================= FIND ROUTE =================
    function findRoute() {
      let startName = startInput.value.trim();
      let endName = endInput.value.trim();

      if (!startName) { showToast("Please enter a start location"); return; }
      if (!endName) { showToast("Please enter an end location"); return; }

      // Resolve GPS coords → nearest named location
      if (window._gpsCoords && startName === "My Location") {
        const nearest = nearestNamedLocation(window._gpsCoords.lat, window._gpsCoords.lng, locationMarkers);
        if (nearest) { startName = nearest.name; startInput.value = nearest.name; }
      }
      // Resolve tapped map coords → nearest named location
      if (window._tapCoords && startName.startsWith("Pin (")) {
        const nearest = nearestNamedLocation(window._tapCoords.lat, window._tapCoords.lng, locationMarkers);
        if (nearest) { startName = nearest.name; startInput.value = nearest.name; }
      }
      if (window._tapCoords && endName.startsWith("Pin (")) {
        const nearest = nearestNamedLocation(window._tapCoords.lat, window._tapCoords.lng, locationMarkers);
        if (nearest) { endName = nearest.name; endInput.value = nearest.name; }
      }

      if (!nodesByName[startName]) { showToast(`"${startName}" not found — pick from the list`); return; }
      if (!nodesByName[endName]) { showToast(`"${endName}" not found — pick from the list`); return; }
      if (startName === endName) { showToast("Start and end cannot be the same location"); return; }

      const findBtn = document.getElementById("findRoute");
      findBtn.disabled = true;
      findBtn.textContent = "Finding…";

      setTimeout(() => {
        const startIds = nodesByName[startName].map(n => n.id);
        const endIds = nodesByName[endName].map(n => n.id);

        let bestPath = null, bestDistance = Infinity;
        for (const s of startIds) {
          for (const e of endIds) {
            const path = dijkstra(graph, s, e);
            if (path.length > 0) {
              const dist = calculateDistance(path);
              if (dist < bestDistance) { bestDistance = dist; bestPath = path; }
            }
          }
        }

        findBtn.disabled = false;
        findBtn.textContent = "Find Route";

        if (!bestPath) { showToast("No route found between these locations"); return; }

        drawPath(bestPath, startName, endName);
        currentPath = bestPath;

        const distance = bestDistance.toFixed(0);
        const time = (bestDistance / 1.4 / 60).toFixed(1);

        document.getElementById("distance").innerText = distance + " m";
        document.getElementById("time").innerText = time + " min";
        document.getElementById("routeStats").hidden = false;

        steps = generateSteps(bestPath);
        currentStepIndex = 0;

        document.getElementById("directionsCard").hidden = false;
        document.getElementById("shareBtn").hidden = false;
        showStep();
        speak(steps[currentStepIndex]);
        focusOnStep(currentPath, 0);

        // Update share URL
        const url = new URL(window.location.href);
        url.searchParams.set("from", startName);
        url.searchParams.set("to", endName);
        window.history.replaceState({}, "", url);

        saveRecentRoute(startName, endName);
        showToast(`Route found: ${distance} m, ~${time} min`, "success");
      }, 0);
    }

    document.getElementById("findRoute").addEventListener("click", findRoute);

    // Enter key triggers find route
    [startInput, endInput].forEach(input => {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { input.blur(); findRoute(); }
      });
    });

    // ================= SHARE BUTTON =================
    document.getElementById("shareBtn").addEventListener("click", () => {
      const url = window.location.href;
      if (navigator.share) {
        navigator.share({ title: "Campus Route", url });
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => showToast("Link copied!", "success"));
      }
    });

    // ================= LOAD FROM URL PARAMS =================
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get("from");
    const toParam = params.get("to");
    if (fromParam && toParam && nodesByName[fromParam] && nodesByName[toParam]) {
      startInput.value = fromParam;
      endInput.value = toParam;
      findRoute();
    }
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
function makePinIcon(color, label) {
  return L.divIcon({
    className: "",
    html: `<div class="route-pin" style="background:${color}"><span>${label}</span></div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    popupAnchor: [0, -34]
  });
}

function drawPath(path, startName, endName) {
  if (currentLayer) map.removeLayer(currentLayer);
  if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
  if (endMarker) { map.removeLayer(endMarker); endMarker = null; }

  const coords = path.map(id => {
    const n = graph.nodes.get(id);
    return [n.lat, n.lng];
  });

  currentLayer = L.polyline(coords, { color: "#800000", weight: 5 }).addTo(map);
  map.fitBounds(currentLayer.getBounds(), { padding: [40, 40] });

  const first = graph.nodes.get(path[0]);
  const last = graph.nodes.get(path[path.length - 1]);

  startMarker = L.marker([first.lat, first.lng], { icon: makePinIcon("#15803d", "A"), zIndexOffset: 500 })
    .bindPopup(`<strong>Start:</strong> ${startName}`)
    .addTo(map);

  endMarker = L.marker([last.lat, last.lng], { icon: makePinIcon("#8d1f1f", "B"), zIndexOffset: 500 })
    .bindPopup(`<strong>End:</strong> ${endName}`)
    .addTo(map);
}

function clearRoute() {
  if (currentLayer) { map.removeLayer(currentLayer); currentLayer = null; }
  if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
  if (endMarker) { map.removeLayer(endMarker); endMarker = null; }
  if (positionMarker) { map.removeLayer(positionMarker); positionMarker = null; }

  steps = [];
  currentStepIndex = 0;
  currentPath = [];
  window._gpsCoords = null;
  window._tapCoords = null;

  document.getElementById("routeStats").hidden = true;
  document.getElementById("directionsCard").hidden = true;
  document.getElementById("shareBtn").hidden = true;
  document.getElementById("distance").innerText = "-";
  document.getElementById("time").innerText = "-";
  document.getElementById("stepText").innerText = "Click Find Route";
  document.getElementById("stepCounter").innerText = "";
  document.getElementById("allStepsList").innerHTML = "";

  updateNavButtons();
  updateMiniNav();

  // Clear URL params
  const url = new URL(window.location.href);
  url.searchParams.delete("from");
  url.searchParams.delete("to");
  window.history.replaceState({}, "", url);

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
      instruction = `Start and head straight for ${dist.toFixed(0)} meters`;
    } else {
      const dir = getDirection(prev, curr, next);
      instruction = `${dir} for ${dist.toFixed(0)} meters`;
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
    updateMiniNav();
    return;
  }

  el.innerText = steps[currentStepIndex];
  counter.innerText = `Step ${currentStepIndex + 1} of ${steps.length}`;
  updateNavButtons();
  updateMiniNav();
  renderAllSteps();
  updatePositionMarker(currentPath, currentStepIndex);
}

function updatePositionMarker(path, stepIndex) {
  if (!path || path.length === 0) return;
  const node = graph.nodes.get(path[stepIndex]);
  if (!node) return;

  if (positionMarker) map.removeLayer(positionMarker);
  positionMarker = L.marker([node.lat, node.lng], {
    icon: L.divIcon({
      className: "",
      html: `<div class="position-dot"><div class="position-dot-ring"></div></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    }),
    zIndexOffset: 1000,
    interactive: false
  }).addTo(map);
}

function updateNavButtons() {
  const prev = document.getElementById("prevStep");
  const next = document.getElementById("nextStep");
  prev.disabled = steps.length === 0 || currentStepIndex === 0;
  next.disabled = steps.length === 0 || currentStepIndex === steps.length - 1;
}

function updateMiniNav() {
  const miniNav = document.getElementById("miniNav");
  const miniText = document.getElementById("miniStepText");
  const miniPrev = document.getElementById("miniPrev");
  const miniNext = document.getElementById("miniNext");
  const defaultHeading = document.querySelector(".panel-heading-default");

  if (steps.length === 0) {
    miniNav.classList.remove("is-visible");
    if (defaultHeading) defaultHeading.style.display = "";
    return;
  }

  miniNav.classList.add("is-visible");
  if (defaultHeading) defaultHeading.style.display = "none";
  miniText.textContent = `${currentStepIndex + 1}/${steps.length}`;
  miniPrev.disabled = currentStepIndex === 0;
  miniNext.disabled = currentStepIndex === steps.length - 1;
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
    padding: [50, 50], maxZoom: 19
  });
}

// ================= VOICE =================
function speak(text) {
  if (!voiceEnabled) return;
  const synth = window.speechSynthesis;
  if (synth.speaking) synth.cancel();
  const utter = new SpeechSynthesisUtterance(" " + text);
  utter.rate = 0.95; utter.pitch = 1; utter.volume = 1;
  setTimeout(() => synth.speak(utter), 100);
}

// ================= GPS =================
document.getElementById("gpsBtn").addEventListener("click", () => {
  const btn = document.getElementById("gpsBtn");
  if (!navigator.geolocation) { showToast("GPS not available on this device"); return; }

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
        radius: 8, color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.9, weight: 3
      }).bindPopup("You are here").addTo(map);

      window._gpsCoords = { lat: latitude, lng: longitude };
      document.getElementById("start").value = "My Location";
      showToast("Location found! Now pick your destination.", "success");
    },
    (err) => {
      btn.classList.remove("gps-loading");
      btn.disabled = false;
      const msgs = { 1: "Location permission denied", 2: "Location unavailable", 3: "Location request timed out" };
      showToast(msgs[err.code] || "Could not get location");
    },
    { timeout: 10000, maximumAge: 30000 }
  );
});

// ================= MAP TAP TO SET DESTINATION =================
function setTapMode(active) {
  window.tapMode = active;
  document.getElementById("map").style.cursor = active ? "crosshair" : "";
  const hint = document.getElementById("tapHint");
  hint.textContent = active ? "Tap the map to set destination…" : "Tip: tap the map to set destination";
  hint.classList.toggle("tap-hint-active", active);
}

document.getElementById("end").addEventListener("focus", () => setTapMode(true));
document.getElementById("end").addEventListener("blur", () => { setTimeout(() => setTapMode(false), 200); });

// ================= PREV / NEXT =================
function goNext() {
  if (currentStepIndex < steps.length - 1) {
    currentStepIndex++;
    showStep();
    focusOnStep(currentPath, currentStepIndex);
    speak(steps[currentStepIndex]);
  }
}

function goPrev() {
  if (currentStepIndex > 0) {
    currentStepIndex--;
    showStep();
    focusOnStep(currentPath, currentStepIndex);
    speak(steps[currentStepIndex]);
  }
}

document.getElementById("nextStep").addEventListener("click", goNext);
document.getElementById("prevStep").addEventListener("click", goPrev);
document.getElementById("miniNext").addEventListener("click", goNext);
document.getElementById("miniPrev").addEventListener("click", goPrev);
