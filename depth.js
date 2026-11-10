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
  const enabled = document.getElementById("depth-enabled");
  const minInput = document.getElementById("depth-min");
  const maxInput = document.getElementById("depth-max");
  const opacityInput = document.getElementById("depth-opacity");
  const opacityLabel = document.getElementById("depth-opacity-value");
  const status = document.getElementById("depth-status");

  let sourceReady = false;
  const transparent = "rgba(0,0,0,0)";
  const highlight = "rgba(255,48,48,1)";

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
      deepElevation, highlight,
      shallowElevation, highlight,
      shallowElevation + edge, transparent,
      32767, transparent
    ];
  }

  function updateDepthStyle() {
    const range = readRange();
    if (!range) {
      setMessage("Enter a valid depth range: 0–8000 m, minimum less than maximum.", "error");
      return;
    }
    const [shallow, deep] = range;
    if (!sourceReady) return;
    try {
      map.setPaintProperty(layerId, "color-relief-color", colorForDepths(shallow, deep));
      map.setPaintProperty(layerId, "color-relief-opacity", Number(opacityInput.value) / 100);
      const checked = enabled.checked;
      map.setLayoutProperty(layerId, "visibility", checked ? "visible" : "none");
      setMessage(
        checked ? "Highlighting " + shallow.toLocaleString() + "–" +
          deep.toLocaleString() + " m below sea level · GEBCO 2026." :
          "Depth tiles ready. Turn on Depth Highlighter to show selected depths.",
        "success"
      );
    } catch (e) {
      console.error("Depth highlighter update:", e);
      setMessage("Depth rendering error. Check the browser console.", "error");
    }
  }

  function bindControls() {
    enabled.addEventListener("change", updateDepthStyle);
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

  async function initDepthHighlighter() {
    // The 76 MB archive is uploaded separately; don't break the working map.
    setMessage("Checking whether the GEBCO depth tiles are deployed…");
    try {
      let selected = null;
      for (const candidate of filenames) {
        const url = new URL("./" + candidate, window.location.href).href;
        try {
          const response = await fetch(url, { method: "HEAD", cache: "no-store" });
          if (response.ok) { selected = { url, candidate }; break; }
        } catch (networkError) {
          console.debug("Depth tile archive check:", candidate, networkError);
        }
      }
      if (!selected) throw new Error("No matching PMTiles archive in site root");
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: "raster-dem",
          url: "pmtiles://" + selected.url,
          encoding: "custom",
          // RGB PNG is a signed Int16 elevation with a +32768 offset.
          // Positive redFactor is essential for MapLibre color-relief's
          // elevation stop packing, even though encoded R is always zero.
          redFactor: 65536,
          greenFactor: 256,
          blueFactor: 1,
          baseShift: 32768,
          tileSize: 256,
          // PMTiles TileJSON controls minzoom/maxzoom (7 or 8).
          attribution: "GEBCO Compilation Group (2026). Not for navigation."
        });
      }
      if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: "color-relief",
          source: sourceId,
          layout: { visibility: "none" },
          paint: {
            "color-relief-color": colorForDepths(3000, 5000),
            "color-relief-opacity": 0.72
          }
        }, map.getLayer("contour-lines") ? "contour-lines" : undefined);
      }
      sourceReady = true;
      // Share the validated DEM source with optional basemap styling.
      // Consumers that load later can also discover it with map.getSource().
      window.dispatchEvent(new CustomEvent("okb-depth-source-ready", {
        detail: { sourceId, archive: selected.candidate }
      }));
      enabled.disabled = false;
      enabled.checked = true;
      updateDepthStyle();
      console.info("OKB depth highlighter activated with", selected.candidate,
        "· RGB decode: R*65536 + G*256 + B - 32768");
    } catch (e) {
      sourceReady = false;
      enabled.disabled = true;
      enabled.checked = false;
      setMessage("Depth tiles not available yet. Upload either " +
        "GEBCO_2026_TerrainRGB_Z7.pmtiles (24 MB) or " +
        "GEBCO_2026_TerrainRGB_Z8.pmtiles (76 MB) to the " +
        "GitHub repository root, then refresh.", "info");
      console.info("Depth highlighter pending data:", e);
    }
  }

  bindControls();
  if (map.loaded()) initDepthHighlighter();
  else map.on("load", initDepthHighlighter);
})();