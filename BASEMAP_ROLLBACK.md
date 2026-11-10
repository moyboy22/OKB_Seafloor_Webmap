# Basemap and interface rollback (10 November 2026)

## Current design

- Floating basemap control on the map right.
- **Ocean Relief** is the default global basemap: GEBCO_2026 shaded-relief
  WMS (`gebco_2026`) styled consistently across global Web Mercator.
- **Fishing Chart** uses GEBCO_2026 globally colour-coded flat-map WMS
  (`gebco_2026_2`), with optional global relief detail.
- The original `GEBCO_LATEST` WMS remains available as **Original GEBCO**
  and automatically returns at zoom >= 10 in custom modes.
- Regional `GEBCO_2026_TerrainRGB_Z7.pmtiles` is still used for the
  *red numerical depth highlighter*, which defaults to 1000–2000 m.
  It is NOT used for global basemap colours. Numeric highlighting is
  only available within the uploaded raster's valid coverage.
- Regional 500-m contours and SPRFMO layers are unchanged.
- The former AOI rectangle and AOI layer script have been removed.

The global WMS images are pre-coloured map images, not raw depth rasters.
The Fishing Chart appearance must not be confused with a continuous
globally numerical depth classification from our PMTiles.
GEBCO is not for navigation or safety-at-sea purposes.

## On-screen rollback

Tap the floating basemap selector (layers icon on map right), then choose
**Original GEBCO**. It hides both alternative global WMS views.
The remaining overlays, depth highlighter, navigation and measurement
tools are unaffected.

## Code rollback

A guaranteed snapshot of `main` immediately before this global-WMS
basemap and depth-default update was saved to:

`backup/before-global-basemap-2026-11-10`

To undo the full change in a local Git clone, revert the global-basemap
commit shown in the repository's commit history:

```sh
git revert <global-basemap-commit-sha>
git push origin main
```

The previous backup `backup/before-ui-and-aoi-redesign-2026-11-10`
is also retained.

Do not delete the 24 MB numerical depth PMTiles: it is required for
the functioning highlighter. For a fully numerical globe-wide basemap
in a future release, a separate global GEBCO raster processing and
hosting pipeline will be necessary.
