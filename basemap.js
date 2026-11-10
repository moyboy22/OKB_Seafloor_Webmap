/* OKAINS BAY — seamless global GEBCO 2026 basemaps.
 *
 * IMPORTANT:
 * The small regional DEM PMTiles are only for numeric depth highlighting.
 * Basemaps use separate GLOBAL GEBCO WMS layers, so no DEM rectangle/seams.
 * Ocean Relief = GEBCO 2026 shaded bathymetry, colour-adjusted in MapLibre.
 * Fishing Chart = GEBCO 2026 flat elevation colour map, with optional relief.
 * Original GEBCO remains available and returns at zoom 10+.
 */
(() => {
  "use strict";

  const select = document.getElementById("basemap-style");
  const reliefToggle = document.getElementById("basemap-shade");
  const status = document.getElementById("basemap-status");
  const widget = document.getElementById("basemap-widget");
  const button = document.getElementById("basemap-button");
  const popover = document.getElementById("basemap-popover");
  const originalId = "gebco-bathymetry";
  const oceanId = "okb-global-ocean";
  const chartId = "okb-global-chart";
  const chartShadeId = "okb-global-chart-shade";
  const oceanSource = "okb-gebco-2026-shaded";
  const chartSource = "okb-gebco-2026-flat";
  const highZoomThreshold = 10;
  let lastState = null;
  let tileErrors = 0;

  function getTiles(layerName) {
    return [
      "https://wms.gebco.net/2026/mapserv?" +
      "SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap" +
      "&LAYERS=" + encodeURIComponent(layerName) +
      "&STYLES=&FORMAT=image/png&TRANSPARENT=false" +
      "&SRS=EPSG:3857&BBOX={bbox-epsg-3857}" +
      "&WIDTH=256&HEIGHT=256"
    ];
  }

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

  function message(text, warning = false) {
    status.textContent = text;
    status.style.color = warning ? "#ffbd98" : "#aec8d1";
  }

  function addGlobalSourcesAndLayers() {
    // Fixed GEBCO 2026 global WMS sources, NOT regional raster-dem tiles.
    if (!map.getSource(oceanSource)) {
      map.addSource(oceanSource, {
        type: "raster", tiles: getTiles("gebco_2026"), tileSize: 256,
        attribution: "GEBCO Compilation Group (2026). Not for navigation."
      });
    }
    if (!map.getSource(chartSource)) {
      map.addSource(chartSource, {
        type: "raster", tiles: getTiles("gebco_2026_2"), tileSize: 256,
        attribution: "GEBCO Compilation Group (2026). Not for navigation."
      });
    }

    // All basemap layers must remain BELOW the red numerical highlighter,
    // contours and research areas.
    const before = map.getLayer("okb-depth-highlight")
      ? "okb-depth-highlight"
      : map.getLayer("contour-lines") ? "contour-lines" : undefined;

    if (!map.getLayer(oceanId)) {
      map.addLayer({
        id: oceanId, type: "raster", source: oceanSource, maxzoom: highZoomThreshold,
        layout: { visibility: "none" },
        paint: {
          "raster-opacity": 1,
          "raster-contrast": 0.16,
          "raster-saturation": -0.24,
          "raster-brightness-min": 0,
          "raster-brightness-max": 0.78
        }
      }, before);
    }

    if (!map.getLayer(chartId)) {
      map.addLayer({
        id: chartId, type: "raster", source: chartSource, maxzoom: highZoomThreshold,
        layout: { visibility: "none" },
        paint: {
          "raster-opacity": 1,
          "raster-contrast": 0.09,
          "raster-saturation": 0.08,
          "raster-brightness-min": 0,
          "raster-brightness-max": 0.97
        }
      }, before);
    }

    // A light, full-globe shaded-relief overlay for the flat-map mode.
    if (!map.getLayer(chartShadeId)) {
      map.addLayer({
        id: chartShadeId, type: "raster", source: oceanSource,
        maxzoom: highZoomThreshold,
        layout: { visibility: "none" },
        paint: {
          "raster-opacity": 0.17,
          "raster-saturation": -0.70,
          "raster-contrast": 0.22
        }
      }, before);
    }
  }

  function visible(id, value) {
    if (!map.getLayer(id)) return;
    const target = value ? "visible" : "none";
    if (map.getLayoutProperty(id, "visibility") !== target)
      map.setLayoutProperty(id, "visibility", target);
  }

  function applyColours(mode) {
    if (!map.getLayer("contour-lines")) return;
    const colour = mode === "chart" ? "#ecf8ff" :
      mode === "ocean" ? "#cae5ec" : "#b8edf7";
    map.setPaintProperty("contour-lines", "line-color", colour);
  }

  function applyMode() {
    try {
      const mode = select.value;
      const close = map.getZoom() >= highZoomThreshold;
      if (!["original", "ocean", "chart"].includes(mode)) {
        select.value = "original";
        applyMode();
        return;
      }

      addGlobalSourcesAndLayers();
      const state = [mode, close, reliefToggle.checked].join(":");
      if (lastState === state) return;
      lastState = state;

      // Only one global WMS basemap is active at a time; no regional seam.
      visible(originalId, mode === "original" || close);
      visible(oceanId, mode === "ocean" && !close);
      visible(chartId, mode === "chart" && !close);
      visible(chartShadeId, mode === "chart" && !close && reliefToggle.checked);

      // The global Ocean WMS already has relief baked in. The checkbox
      // adjusts its definition, not an unavailable numerical hillshade.
      if (map.getLayer(oceanId)) {
        map.setPaintProperty(oceanId, "raster-contrast",
          reliefToggle.checked ? 0.16 : 0.05);
      }
      applyColours(mode);

      reliefToggle.disabled = mode === "original";
      if (mode === "original") {
        message("Original GEBCO shaded imagery across the globe.");
      } else if (close) {
        message("Zoom 10+: original GEBCO detail is displayed. Zoom out to view " +
          (mode === "ocean" ? "Ocean Relief." : "Fishing Chart."));
      } else if (mode === "ocean") {
        message("Worldwide GEBCO 2026 shaded relief. No regional basemap edges.");
      } else {
        message("Worldwide GEBCO 2026 depth-coloured chart imagery.");
      }
    } catch (error) {
      console.error("Basemap change failed; returning to original GEBCO:", error);
      select.value = "original";
      lastState = null;
      // The original GEBCO layer is pre-existing and known to work.
      try {
        visible(originalId, true);
        visible(oceanId, false);
        visible(chartId, false);
        visible(chartShadeId, false);
      } catch (restoreError) {
        console.error("Could not restore original GEBCO:", restoreError);
      }
      message("Basemap issue: Original GEBCO restored.", true);
    }
  }

  select.addEventListener("change", () => { tileErrors = 0; applyMode(); });
  reliefToggle.addEventListener("change", applyMode);
  map.on("zoom", applyMode);
  map.on("error", event => {
    // Auto-revert only after repeated failures from the active WMS source.
    const src = event.sourceId || event.source?.id;
    const active = select.value === "ocean" ? oceanSource :
      select.value === "chart" ? chartSource : null;
    if (!active || src !== active) return;
    tileErrors += 1;
    if (tileErrors < 3) return;
    console.warn("Global basemap WMS unavailable; reverting to classic.", event.error);
    select.value = "original";
    lastState = null;
    applyMode();
    message("Global 2026 service unavailable; Original GEBCO restored.", true);
  });

  if (map.loaded()) applyMode();
  else map.on("load", applyMode);
})();