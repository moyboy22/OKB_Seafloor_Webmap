/* OKAINS BAY Seafloor Explorer — lightweight navigation and measurement tools */
(() => {
  "use strict";
  const areaList = document.getElementById("research-area-list");
  const coordStatus = document.getElementById("coordinate-status");
  const measureStatus = document.getElementById("measure-status");
  const measureButton = document.getElementById("measure-toggle");
  const areaByName = new Map();
  const labelByName = new Map();
  const emptyCollection = () => ({ type: "FeatureCollection", features: [] });
  let selectedName = null;
  let measuring = false;
  let vertices = [];
  let cursorPosition = null;

  const asDegrees = (value, axis) => {
    const raw = String(value || "").trim().toUpperCase()
      .replace(/[º˚]/g, "°").replace(/[′’]/g, "'")
      .replace(/[″“”]/g, '"');
    if (!raw) throw Error("Enter both latitude and longitude.");
    const hemis = raw.match(/[NSEW]/g) || [];
    if (hemis.length > 1) throw Error("Use only one compass direction per coordinate.");
    const hemi = hemis[0] || "";
    if ((axis === "lat" && /[EW]/.test(hemi)) ||
        (axis === "lon" && /[NS]/.test(hemi))) {
      throw Error("The compass direction does not match the coordinate.");
    }
    const values = (raw.match(/\d+(?:\.\d+)?/g) || []).map(Number);
    if (values.length < 1 || values.length > 3 ||
        values.some(n => !Number.isFinite(n))) {
      throw Error("Use decimal degrees or degrees, minutes and seconds.");
    }
    if ((values[1] || 0) >= 60 || (values[2] || 0) >= 60) {
      throw Error("Minutes and seconds must be less than 60.");
    }
    const dec = values[0] + (values[1] || 0) / 60 + (values[2] || 0) / 3600;
    const sign = /[SW]/.test(hemi) || (!hemi && raw.startsWith("-")) ? -1 : 1;
    const answer = sign * dec;
    if (Math.abs(answer) > (axis === "lat" ? 90 : 180)) {
      throw Error(axis === "lat" ? "Latitude must be within ±90°." : "Longitude must be within ±180°.");
    }
    return answer;
  };

  document.getElementById("coordinate-go-form").addEventListener("submit", event => {
    event.preventDefault();
    try {
      const lat = asDegrees(document.getElementById("go-latitude").value, "lat");
      const lon = asDegrees(document.getElementById("go-longitude").value, "lon");
      map.flyTo({ center: [lon, lat], zoom: Math.max(5, map.getZoom()), essential: true });
      coordStatus.textContent = "Navigated to " + lat.toFixed(5) + "°, " + lon.toFixed(5) + "°.";
      coordStatus.style.color = "#a4e7e7";
    } catch (err) {
      coordStatus.textContent = err.message;
      coordStatus.style.color = "#ffbd98";
    }
  });

  document.getElementById("reset-view").addEventListener("click", () => {
    map.flyTo({ center: [150, -55], zoom: 3, bearing: 0, pitch: 0, essential: true });
  });

  const haversineKm = (a, b) => {
    const rad = Math.PI / 180;
    const dLat = (b[1] - a[1]) * rad;
    const dLon = (b[0] - a[0]) * rad;
    const lat1 = a[1] * rad, lat2 = b[1] * rad;
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 6371.0088 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  };

  const measurementFeatures = () => {
    const features = vertices.map((point, index) => ({
      type: "Feature",
      properties: { sequence: index + 1 },
      geometry: { type: "Point", coordinates: point }
    }));
    if (vertices.length >= 2) features.push({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: vertices.slice() }
    });
    return { type: "FeatureCollection", features };
  };

  const showMeasure = () => {
    const source = map.getSource("okb-measure");
    if (source) source.setData(measurementFeatures());
    const distance = vertices.slice(1).reduce((sum, point, index) =>
      sum + haversineKm(vertices[index], point), 0);
    if (vertices.length === 0) {
      measureStatus.textContent = measuring
        ? "Click your first point on the map."
        : "Click Measure, then click points on the map. Double-click to finish.";
    } else {
      const km = distance < 1 ? (distance * 1000).toFixed(0) + " m" :
        distance.toFixed(2) + " km";
      measureStatus.textContent = vertices.length + " points · " + km +
        " · " + (distance / 1.852).toFixed(2) + " nautical miles";
    }
  };

  const toggleMeasuring = (newState) => {
    measuring = newState;
    window.okbMeasurementActive = newState;
    measureButton.classList.toggle("active", newState);
    measureButton.setAttribute("aria-pressed", String(newState));
    measureButton.textContent = newState ? "Finish measuring" : "Measure distance";
    map.getCanvas().style.cursor = newState ? "crosshair" : "";
    if (newState) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
    showMeasure();
  };

  measureButton.addEventListener("click", () => toggleMeasuring(!measuring));
  document.getElementById("measure-clear").addEventListener("click", () => {
    vertices = [];
    showMeasure();
  });

  const selectResearchArea = (name, flyTo) => {
    const feature = areaByName.get(name);
    if (!feature) return;
    selectedName = name;
    for (const button of areaList.querySelectorAll(".research-item")) {
      const active = button.dataset.area === name;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    const selected = map.getSource("okb-selected-area");
    if (selected) selected.setData({ type: "FeatureCollection", features: [feature] });
    if (!flyTo) return;

    const coords = feature.geometry.type === "Polygon"
      ? feature.geometry.coordinates[0] : feature.geometry.coordinates;
    if (feature.geometry.type === "Polygon" && coords.length > 2) {
      const bounds = coords.reduce((b, p) => b.extend(p),
        new maplibregl.LngLatBounds(coords[0], coords[0]));
      const compact = window.innerWidth < 650;
      map.fitBounds(bounds, {
        padding: compact ? { top: 105, left: 20, bottom: 60, right: 20 } :
          { top: 95, left: 325, bottom: 80, right: 60 },
        maxZoom: 6.5,
        duration: 900
      });
    } else {
      const label = labelByName.get(name);
      const center = label ? label.geometry.coordinates :
        coords[Math.floor(coords.length / 2)];
      map.flyTo({ center, zoom: 5.1, essential: true });
    }

    const label = labelByName.get(name);
    const coordsForPopup = label ? label.geometry.coordinates : coords[0];
    if (typeof window.okbOpenResearchPopup === "function") {
      // Delay popup until camera movement has completed.
      map.once("moveend", () =>
        window.okbOpenResearchPopup(feature, { lng: coordsForPopup[0], lat: coordsForPopup[1] }));
    }
  };

  const buildResearchList = data => {
    const geometry = (data.features || []).filter(f =>
      f.properties && f.properties.feature_role === "geometry");
    for (const f of geometry) areaByName.set(f.properties.research_area, f);
    for (const f of (data.features || [])) {
      if (f.properties && f.properties.feature_role === "label")
        labelByName.set(f.properties.research_area, f);
    }
    areaList.replaceChildren();
    for (const feature of geometry) {
      const p = feature.properties;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "research-item";
      button.dataset.area = p.research_area;
      button.setAttribute("aria-pressed", "false");
      const title = document.createElement("strong");
      title.textContent = p.research_area;
      const detail = document.createElement("small");
      detail.textContent = p.member + " · " +
        (p.representation === "exact_rectangle" ? "Exact polygon" : "Schematic/partial");
      button.append(title, detail);
      button.addEventListener("click", () => {
        if (!document.getElementById("sprfmo-toggle").checked)
          document.getElementById("sprfmo-toggle").click();
        selectResearchArea(p.research_area, true);
      });
      areaList.appendChild(button);
    }
    if (!geometry.length) areaList.textContent = "No research areas available.";
  };

  map.on("load", () => {
    map.addSource("okb-measure", { type: "geojson", data: emptyCollection() });
    map.addLayer({
      id: "okb-measure-line", type: "line", source: "okb-measure",
      filter: ["==", ["geometry-type"], "LineString"],
      paint: { "line-color": "#67ecfc", "line-width": 3, "line-dasharray": [2, 1] }
    });
    map.addLayer({
      id: "okb-measure-points", type: "circle", source: "okb-measure",
      filter: ["==", ["geometry-type"], "Point"],
      paint: { "circle-radius": 5, "circle-color": "#ffffff",
        "circle-stroke-width": 2, "circle-stroke-color": "#00a7c4" }
    });

    map.addSource("okb-selected-area", { type: "geojson", data: emptyCollection() });
    map.addLayer({
      id: "okb-selected-outline", type: "line", source: "okb-selected-area",
      paint: { "line-color": "#53f2f8", "line-width": 4, "line-opacity": 0.95 }
    });

    for (const layerId of ["sprfmo-fill", "sprfmo-line-hit", "sprfmo-labels"]) {
      map.on("click", layerId, event => {
        if (!measuring && event.features && event.features.length)
          selectResearchArea(event.features[0].properties.research_area, false);
      });
    }
    document.getElementById("sprfmo-toggle").addEventListener("change", event => {
      map.setLayoutProperty("okb-selected-outline", "visibility",
        event.target.checked ? "visible" : "none");
    });
    map.on("click", event => {
      if (!measuring) return;
      vertices.push([event.lngLat.lng, event.lngLat.lat]);
      showMeasure();
    });
    map.on("dblclick", event => {
      if (!measuring) return;
      event.preventDefault();
      // Double-click emits an extra click; remove duplicate point.
      if (vertices.length >= 2 &&
          haversineKm(vertices[vertices.length - 1], vertices[vertices.length - 2]) < 0.002)
        vertices.pop();
      toggleMeasuring(false);
    });
    fetch("./SPRFMO_research_areas.geojson")
      .then(response => { if (!response.ok) throw Error("HTTP " + response.status); return response.json(); })
      .then(buildResearchList)
      .catch(err => { areaList.textContent = "Unable to load areas: " + err.message; });
  });

  map.on("mousemove", event => { cursorPosition = event.lngLat; });
  document.getElementById("coordinates").title = "Click to copy latitude and longitude";
  document.getElementById("coordinates").addEventListener("click", () => {
    if (!cursorPosition || !navigator.clipboard) return;
    navigator.clipboard.writeText(cursorPosition.lat.toFixed(6) + ", " +
      cursorPosition.lng.toFixed(6)).then(() => {
        document.getElementById("coordinates").title = "Copied decimal coordinates";
    }).catch(() => {});
  });
})();