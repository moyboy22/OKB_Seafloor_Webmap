# OKB Seafloor Explorer: basemap and UI rollback

## Current implementation
- Floating basemap selector at the right of the map.
- **Ocean Relief** is the default; **Fishing Chart** and **Original GEBCO** remain selectable.
- All styles retain the original global GEBCO WMS as the base source.
- Outside local numerical GEBCO depth tiles, Ocean Relief and Fishing Chart
  apply colour/contrast transformations to the global rendered GEBCO WMS.
  This is a visual backdrop, **not** global numeric bathymetry.
- At zoom 10 and greater, custom numerical colour relief and hillshade are hidden,
  and the original GEBCO WMS colours are restored, retaining close-zoom detail.
- The box labelled AOI covers the original **130–170°E, 50–60°S project area**.
  This is NOT the exact contour/DEM tile footprint. DEM valid coverage
  extends roughly 113.84–179.9°E, 45–64.44°S.
- The left sidebar consists of collapsible panels; contour labels and opacity
  are inside the optional Contour settings disclosure.

## Fast on-screen rollback (no deployment)
Tap the small **Basemap** layers button at the upper right and select
**Original GEBCO**. Custom colour relief and hillshade are hidden;
the original WMS rendering and all overlay tools remain in place.

## Guaranteed code rollback
Before the current changes, commit `404d7c8b00e7b5694323e3279d04265becc012e3`
was saved as a branch:

`backup/before-ui-and-aoi-redesign-2026-11-10`

To undo only the new UI/AOI redesign, revert its single commit from the
GitHub history, or from a local Git clone:

```sh
git revert <ui-aoi-redesign-commit-sha>
git push origin main
```

The prior backup branch
`backup/gebco-basemap-before-style-selector-2026-11-10`
retains the earlier original-WMS-only design.

## Data and attribution guardrails
- Do not delete `GEBCO_2026_TerrainRGB_Z7.pmtiles`: the working red
  depth highlighter and new custom styles both use this source.
- Contours still contain genuine 500 m lines only. The AOI frame is a
  project reference, not a guarantee that all data are present everywhere.
- GEBCO is not for navigation or other safety-at-sea decisions.
