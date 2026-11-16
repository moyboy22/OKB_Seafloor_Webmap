/* GEBCO 2026 dynamic depth highlighter.
 * Source: elevation GeoTIFF reprojected into PMTiles raster-dem tiles.
 * Encoding: RGB(0, high byte, low byte); elevation = 256*G + B - 32768.
 * MapLibre 5.6.2 uses DEMData.unpack = dot(RGB, factors) - baseShift.
 * redFactor MUST be nonzero because color-relief packDEMData divides by minFactor.
 * NoData: +32767 m (always transparent in the highlighter ramp).
 * No raster computation happens when changing depth limits.
 */
(() => {
  "use strict";

  // Prefer full zoom-8 detail; accept browser-uploadable zoom-7 fallback.
  const filenames = [
    "GEBCO_2026_TerrainRGB_Z8.pmtiles",
    "GEBCO_2026_TerrainRGB_Z7.pmtiles"
  ];
  const sourceId = "okb-gebco-depth-dem";
  const layerId = "okb-depth-highlight";
  const globalSourceId = "okb-global-depth-dem";
  const globalLayerId = "okb-global-depth-highlight";
  const globalArchive = window.OKB_GLOBAL_DEPTH_URL ||
    "./GEBCO_2026_Global_TerrainRGB_Z5.pmtiles";
  const regionalBounds = {west:113.84,east:179.9,south:-64.44,north:-45};
  const regionalDetailZoom = 6;
  let regionalReady = false, globalReady = false, globalTileErrors = 0;
  const enabled = document.getElementById("depth-enabled");
  const minInput = document.getElementById("depth-min");
  const maxInput = document.getElementById("depth-max");
  const opacityInput = document.getElementById("depth-opacity");
  const colorInput = document.getElementById("depth-color");
  const opacityLabel = document.getElementById("depth-opacity-value");
  const status = document.getElementById("depth-status");

  const transparent = "rgba(0,0,0,0)";
  const defaultColor = "#ff3030";
  const colorStorageKey = "okb-depth-highlight-color";
  function validColor(value) {
    return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
  }
  try {
    const stored = localStorage.getItem(colorStorageKey);
    colorInput.value = validColor(stored) ? stored : defaultColor;
  } catch (error) {
    colorInput.value = defaultColor;
  }

  function currentHighlight() {
    return colorInput.value;
  }

  function setMessage(message, type = "info") {
    status.textContent = message;
    status.style.color = type === "error" ? "#ffbd98" :
      type === "success" ? "#a4f0d3" : "#afc4ce";
  }

  function readRange() {
    const shallow = Number(minInput.value);
    const deep = Number(maxInput.value);
    if (!Number.isFinite(shallow) || !Number.isFinite(deep) ||
        minInput.value.trim() === "" || maxInput.value.trim() === "" ||
        shallow < 0 || deep > 8000 || shallow >= deep) {
      return null;
    }
    return [shallow, deep];
  }

  function colorForDepths(shallow, deep) {
    // Elevations are negative underwater, while depth inputs are positive.
    // Small ramps at the boundaries give an effectively discrete highlight
    // while using MapLibre's documented interpolate/elevation expression.
    const deepElevation = -deep, shallowElevation = -shallow;
    // DEM tiles are encoded at 1-metre precision. Sub-metre stops
    // collapse to the same packed elevation and can corrupt the ramp.
    const edge = 1;
    return [
      "interpolate", ["linear"], ["elevation"],
      -32768, transparent,
      deepElevation - edge, transparent,
      deepElevation, currentHighlight(),
      shallowElevation, currentHighlight(),
      shallowElevation + edge, transparent,
      32767, transparent
    ];
  }

  function isInRegion() {
    const p = map.getCenter();
    const lon = ((p.lng + 180) % 360 + 360) % 360 - 180;
    return lon >= regionalBounds.west && lon <= regionalBounds.east &&
      p.lat >= regionalBounds.south && p.lat <= regionalBounds.north;
  }

  function activeTier() {
    if (regionalReady && (!globalReady ||
      (map.getZoom() >= regionalDetailZoom && isInRegion()))) return "regional";
    return globalReady ? "global" : regionalReady ? "regional" : null;
  }

  function updateDepthStyle() {
    const range = readRange();
    if (!range) {
      setMessage("Enter a valid depth range: 0–8000 m, minimum less than maximum.", "error");
      return;
    }
    const tier = activeTier();
    if (!tier) {
      enabled.disabled = true;
      setMessage("Depth tiles unavailable. Basemap and other layers still work.");
      return;
    }
    enabled.disabled = false;
    try {
      const ramp = colorForDepths(range[0], range[1]);
      const opacity = Number(opacityInput.value) / 100;
      for (const [id, name] of [[layerId, "regional"], [globalLayerId, "global"]]) {
        if (!map.getLayer(id)) continue;
        map.setPaintProperty(id, "color-relief-color", ramp);
        map.setPaintProperty(id, "color-relief-opacity", opacity);
        map.setLayoutProperty(id, "visibility",
          enabled.checked && tier === name ? "visible" : "none");
      }
      const detail = tier === "regional" ? "regional detail" : "global overview (coarse)";
      const note = !globalReady ? " Global elevation archive not yet deployed." : "";
      setMessage(enabled.checked
        ? "Highlighting " + range[0].toLocaleString() + "–" +
          range[1].toLocaleString() + " m · " + detail + " · GEBCO 2026." + note
        : "Depth tiles ready (" + detail + "). Turn on to highlight." + note,
        "success");
    } catch (error) {
      console.error("Depth highlighter update:", error);
      setMessage("Depth rendering error. Check the browser console.", "error");
    }
  }

  function bindControls() {
    enabled.addEventListener("change", updateDepthStyle);
    colorInput.addEventListener("input", () => {
      try {
        localStorage.setItem(colorStorageKey, colorInput.value);
      } catch (error) {
        // The picker still works when browser storage is disabled.
      }
      updateDepthStyle();
    });
    minInput.addEventListener("input", updateDepthStyle);
    maxInput.addEventListener("input", updateDepthStyle);
    opacityInput.addEventListener("input", () => {
      opacityLabel.textContent = opacityInput.value + "%";
      updateDepthStyle();
    });
    for (const button of document.querySelectorAll(".depth-preset")) {
      button.addEventListener("click", () => {
        minInput.value = button.dataset.min;
        maxInput.value = button.dataset.max;
        updateDepthStyle();
      });
    }
  }

  function addTier(source, layer, url) {
    if (!map.getSource(source)) map.addSource(source, {
      type: "raster-dem", url: "pmtiles://" + url,
      encoding: "custom", redFactor: 65536,
      greenFactor: 256, blueFactor: 1, baseShift: 32768,
      tileSize: 256,
      attribution: "GEBCO Compilation Group (2026). Not for navigation."
    });
    if (!map.getLayer(layer)) map.addLayer({
      id: layer, type: "color-relief", source,
      layout: {visibility: "none"},
      paint: {
        "color-relief-color": colorForDepths(1000, 2000),
        "color-relief-opacity": Number(opacityInput.value) / 100
      }
    }, map.getLayer("contour-lines") ? "contour-lines" : undefined);
  }

  async function findRegional() {
    for (const candidate of filenames) {
      const url = new URL("./" + candidate, window.location.href).href;
      try {
        const response = await fetch(url, {method:"HEAD",cache:"no-store"});
        if (response.ok) return {url,candidate};
      } catch (error) {
        console.debug("Regional archive check:", candidate, error);
      }
    }
    return null;
  }

  async function findGlobal() {
    const url = new URL(globalArchive, window.location.href);
    if (!["https:", "http:"].includes(url.protocol)) throw Error("Invalid archive URL");
    // Validate byte-range support and PMTiles magic bytes before enabling.
    const response = await fetch(url.href, {
      headers: {Range:"bytes=0-15"}, cache:"no-store"
    });
    if (response.status !== 206) {
      if (response.body) await response.body.cancel();
      throw Error("Global archive requires HTTP 206 byte-range responses.");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (String.fromCharCode(...bytes.slice(0,7)) !== "PMTiles")
      throw Error("Invalid PMTiles file signature.");
    return url.href;
  }

  async function initDepthHighlighter() {
    setMessage("Checking available GEBCO depth tiles…");
    // Regional is checked first; global failures never break current tiles.
    try {
      const selected = await findRegional();
      if (selected) {
        addTier(sourceId, layerId, selected.url);
        regionalReady = true;
        window.dispatchEvent(new CustomEvent("okb-depth-source-ready", {
          detail: {sourceId, archive: selected.candidate}
        }));
        enabled.disabled = false;
        enabled.checked = true;
        updateDepthStyle();
      }
    } catch (error) {
      console.warn("Regional depth archive unavailable:", error);
    }
    try {
      const url = await findGlobal();
      addTier(globalSourceId, globalLayerId, url);
      globalReady = true;
      if (!regionalReady) enabled.checked = true;
      console.info("OKB global depth archive enabled:", url);
    } catch (error) {
      console.info("Global depth archive unavailable:", error.message);
    }
    updateDepthStyle();
  }

  // Choose exactly one relief source, avoiding double highlights and
  // transparency seams between different DEM resolutions.
  map.on("moveend", updateDepthStyle);
  map.on("error", event => {
    const id = event.sourceId || event.source?.id;
    if (id !== globalSourceId || !globalReady) return;
    if (++globalTileErrors < 3) return;
    globalReady = false;
    console.warn("Global DEM failed; reverting to regional-only mode.", event.error);
    updateDepthStyle();
  });

  bindControls();
  if (map.loaded()) initDepthHighlighter();
  else map.on("load", initDepthHighlighter);
})();