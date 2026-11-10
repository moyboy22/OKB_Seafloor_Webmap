/* OKAINS BAY bathymetric basemap modes (MapLibre GL JS 5.6.2).
 * All custom styles are optional overlays on the original GEBCO WMS.
 * No map.setStyle() call, so sources, contours, research areas and tools persist.
 * Select "Original GEBCO" to disable both layers immediately.
 * Ocean Relief is the default; GEBCO WMS is styled globally outside DEM coverage.
 * At zoom >= 10, WMS reverts to its original appearance for close inspection.
 * Source is the same validated GEBCO 2026 raster-dem PMTiles used by depth.js.
 */
(() => {
  "use strict";
  const sourceId = "okb-gebco-depth-dem";
  const reliefId = "okb-base-color-relief";
  const shadeId = "okb-base-hillshade";
  const select = document.getElementById("basemap-style");
  const shadeControl = document.getElementById("basemap-shade");
  const status = document.getElementById("basemap-status");
  const widget = document.getElementById("basemap-widget");
  const button = document.getElementById("basemap-button");
  const popover = document.getElementById("basemap-popover");
  let renderedWmsMode = null;
  const originalWms = {
    "raster-opacity": 0.95,
    "raster-contrast": 0.07,
    "raster-saturation": 0,
    "raster-hue-rotate": 0,
    "raster-brightness-min": 0,
    "raster-brightness-max": 1
  };
  // Global rendered GEBCO WMS cannot provide per-pixel numerical depths.
  // These values create cohesive, low-cost backdrops outside the local DEM.
  const wmsAppearances = {
    original: originalWms,
    ocean: {
      "raster-opacity": 1,
      "raster-contrast": 0.14,
      "raster-saturation": -0.30,
      "raster-hue-rotate": 0,
      "raster-brightness-min": 0,
      "raster-brightness-max": 0.64
    },
    chart: {
      "raster-opacity": 1,
      "raster-contrast": 0.16,
      "raster-saturation": 0.04,
      "raster-hue-rotate": 0,
      "raster-brightness-min": 0,
      "raster-brightness-max": 0.86
    }
  };

  function setPanelOpen(open) {
    popover.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  }
  button.addEventListener("click", () => setPanelOpen(popover.hidden));
  document.addEventListener("pointerdown", event => {
    if (!popover.hidden && !widget.contains(event.target)) setPanelOpen(false);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !popover.hidden) {
      setPanelOpen(false);
      button.focus();
    }
  });

  function styleGlobalWms(mode) {
    if (!map.getLayer("gebco-bathymetry")) return;
    // Ocean relief uses the existing GEBCO WMS across the whole map.
    // Avoid overscaled elevation shading on close zooms: use original WMS.
    const effective = map.getZoom() >= 10 ? "original" : mode;
    if (effective === renderedWmsMode) return;
    const values = wmsAppearances[effective] || originalWms;
    for (const [key, value] of Object.entries(values)) {
      map.setPaintProperty("gebco-bathymetry", key, value);
    }
    renderedWmsMode = effective;
  }

  // Constant-elevation color ramps. At +32767 m (encoded NoData),
  // both styles are fully transparent and the original WMS remains visible.
  const palettes = {
    ocean: [
      "interpolate", ["linear"], ["elevation"],
      -32768, "rgba(0,0,0,0)",
      -14000, "rgba(0,0,0,0)",
      -12000, "#071928",
      -7000, "#092337",
      -6000, "#0c2c42",
      -5000, "#11384e",
      -4000, "#184f67",
      -3000, "#267087",
      -2000, "#438c9c",
      -1000, "#66abb5",
      -500, "#8dcdcb",
      -100, "#bce1d8",
      0, "#dcefe7",
      1200, "#d1d3b8",
      2800, "#b6b99d",
      4000, "rgba(0,0,0,0)",
      32767, "rgba(0,0,0,0)"
    ],
    chart: [
      "interpolate", ["linear"], ["elevation"],
      -32768, "rgba(0,0,0,0)",
      -14000, "rgba(0,0,0,0)",
      -12000, "#08254c",
      -5001, "#08254c",
      -5000, "#124a8a",
      -4001, "#124a8a",
      -4000, "#155f9e",
      -3001, "#155f9e",
      -3000, "#237eb9",
      -2001, "#237eb9",
      -2000, "#4b9fc8",
      -1001, "#4b9fc8",
      -1000, "#77bed6",
      -501, "#77bed6",
      -500, "#a0d8e2",
      -201, "#a0d8e2",
      -200, "#c8eaee",
      -1, "#c8eaee",
      0, "#e3f3ec",
      2000, "#d5d9bb",
      4000, "rgba(0,0,0,0)",
      32767, "rgba(0,0,0,0)"
    ]
  };

  function message(value, caution = false) {
    status.textContent = value;
    status.style.color = caution ? "#ffbd98" : "#aec8d1";
  }

  function visibility(id, visible) {
    if (map.getLayer(id))
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }

  function contourColours(mode) {
    if (!map.getLayer("contour-lines")) return;
    const line = mode === "chart" ? "#e8f8ff" :
      mode === "ocean" ? "#c2e1e9" : "#b8edf7";
    map.setPaintProperty("contour-lines", "line-color", line);
  }

  function prepareLayers() {
    if (!map.getSource(sourceId)) return false;
    const beforeId = map.getLayer("okb-depth-highlight")
      ? "okb-depth-highlight"
      : map.getLayer("contour-lines") ? "contour-lines" : undefined;
    if (!map.getLayer(reliefId)) {
      map.addLayer({
        id: reliefId,
        type: "color-relief",
        source: sourceId,
        maxzoom: 10,
        layout: { visibility: "none" },
        paint: {
          "color-relief-color": palettes.ocean,
          "color-relief-opacity": 1
        }
      }, beforeId);
    }
    if (!map.getLayer(shadeId)) {
      map.addLayer({
        id: shadeId,
        type: "hillshade",
        source: sourceId,
        maxzoom: 10,
        layout: { visibility: "none" },
        paint: {
          "hillshade-exaggeration": 0.22,
          "hillshade-illumination-direction": 315,
          "hillshade-illumination-anchor": "viewport",
          "hillshade-highlight-color": "#b6e4e9",
          "hillshade-shadow-color": "#071b2d",
          "hillshade-accent-color": "#23556d"
        }
      }, beforeId);
    }
    return true;
  }

  function restoreOriginal(reason) {
    visibility(reliefId, false);
    visibility(shadeId, false);
    select.value = "original";
    shadeControl.disabled = true;
    contourColours("original");
    try { styleGlobalWms("original"); }
    catch (error) { console.warn("Could not reset GEBCO paint:", error); }
    message(reason || "Original GEBCO WMS restored; all other map layers remain.", !!reason);
  }

  function applyStyle() {
    const mode = select.value;
    try {
      if (mode === "original") {
        restoreOriginal();
        return;
      }
      if (!palettes[mode]) {
        restoreOriginal("Unknown basemap option: returned to Original GEBCO.");
        return;
      }
      // Global image styling does not require the numerical DEM archive.
      // Apply it before attempting local colour relief/hillshade.
      shadeControl.disabled = false;
      styleGlobalWms(mode);
      if (!prepareLayers()) {
        visibility(reliefId, false);
        visibility(shadeId, false);
        message((mode === "ocean" ? "Ocean Relief" : "Fishing Chart") +
          " global GEBCO backdrop active; numerical detail will appear when tiles load.");
        return;
      }
      map.setPaintProperty(reliefId, "color-relief-color", palettes[mode]);
      map.setPaintProperty(shadeId, "hillshade-exaggeration", mode === "ocean" ? 0.22 : 0.12);
      map.setPaintProperty(shadeId, "hillshade-shadow-color",
        mode === "ocean" ? "#071b2d" : "#184a68");
      map.setPaintProperty(shadeId, "hillshade-highlight-color",
        mode === "ocean" ? "#b6e4e9" : "#ffffff");
      map.setPaintProperty(shadeId, "hillshade-accent-color",
        mode === "ocean" ? "#23556d" : "#387b9e");

      visibility(reliefId, true);
      visibility(shadeId, shadeControl.checked);
      contourColours(mode);
      message((mode === "ocean" ? "Ocean Relief" : "Fishing Chart") +
        " across the map via GEBCO WMS; local DEM adds detail where available. " +
        "Original GEBCO appears at zoom 10+.");
    } catch (error) {
      console.error("OKB basemap error; restoring GEBCO:", error);
      restoreOriginal("Custom basemap unavailable. Safely returned to Original GEBCO.");
    }
  }

  select.addEventListener("change", applyStyle);
  shadeControl.addEventListener("change", applyStyle);
  window.addEventListener("okb-depth-source-ready", applyStyle);
  map.on("zoom", () => {
    try { styleGlobalWms(select.value); }
    catch (error) { console.warn("GEBCO zoom fallback:", error); }
  });
  if (map.loaded()) applyStyle();
  else map.on("load", applyStyle);

  // Ocean Relief is the default on each load; Original GEBCO is always
  // one selection away and the pre-change commit is backed up.
})();