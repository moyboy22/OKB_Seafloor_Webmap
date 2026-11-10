/* OKB Southern Ocean project Area of Interest overlay.
 * This box marks the ORIGINAL PROJECT AOI (130–170°E, 50–60°S),
 * not the footprint of every individual bathymetry or contour tile.
 * The numerical GEBCO DEM archive extends farther north/west/east
 * and has partial NoData coverage south of 64.44°S.
 * These distinctions are explained in the Dataset Information panel.
 */
(() => {
  "use strict";
  const sourceId = "okb-project-aoi";
  const aoi = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature", properties: { role: "extent", name: "AOI" },
        geometry: {
          type: "Polygon",
          coordinates: [[[130,-60],[170,-60],[170,-50],[130,-50],[130,-60]]]
        }
      },
      {
        type: "Feature", properties: { role: "label", name: "AOI" },
        geometry: { type: "Point", coordinates: [150,-50.65] }
      }
    ]
  };

  function addAoi() {
    if (map.getSource(sourceId)) return;
    map.addSource(sourceId, { type: "geojson", data: aoi });
    const beforeId = map.getLayer("contour-lines") ? "contour-lines" : undefined;
    map.addLayer({
      id: "okb-aoi-fill",
      type: "fill",
      source: sourceId,
      filter: ["==", ["get", "role"], "extent"],
      maxzoom: 10,
      paint: { "fill-color": "#57deea", "fill-opacity": 0.018 }
    }, beforeId);
    map.addLayer({
      id: "okb-aoi-glow",
      type: "line",
      source: sourceId,
      filter: ["==", ["get", "role"], "extent"],
      maxzoom: 10,
      paint: {
        "line-color": "#5fdef2",
        "line-width": 5,
        "line-opacity": 0.18,
        "line-blur": 2
      }
    }, beforeId);
    map.addLayer({
      id: "okb-aoi-outline",
      type: "line",
      source: sourceId,
      filter: ["==", ["get", "role"], "extent"],
      maxzoom: 10,
      paint: {
        "line-color": "#70e5eb",
        "line-width": ["interpolate", ["linear"], ["zoom"], 2, 1.3, 6, 1.8, 9, 2.2],
        "line-opacity": 0.83,
        "line-dasharray": [5, 3]
      }
    }, beforeId);
    map.addLayer({
      id: "okb-aoi-label",
      type: "symbol",
      source: sourceId,
      filter: ["==", ["get", "role"], "label"],
      maxzoom: 10,
      layout: {
        "text-field": "AOI",
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
        "text-letter-spacing": 0.18,
        "text-anchor": "center",
        "text-allow-overlap": false
      },
      paint: {
        "text-color": "#bff8ff",
        "text-halo-color": "#052236",
        "text-halo-width": 2.4,
        "text-halo-blur": 0.5
      }
    }, beforeId);
  }

  if (map.loaded()) addAoi();
  else map.on("load", addAoi);
})();