# Basemap rollback and safety

This project deliberately keeps `gebco-bathymetry` (the original GEBCO WMS)
as the bottom layer. The optional `basemap.js` overlays use the same local
GEBCO numerical depth PMTiles archive as the depth highlighter.

## Immediate rollback (no deployment needed)
Choose **Basemap Style → Original GEBCO · Default**. This hides the
Ocean Relief and Fishing Chart overlays without touching depth highlighting,
research polygons, contours, or measurement tools. Refreshing the page also
restores Original GEBCO as the default (custom selection is not persisted).

## Code rollback
A snapshot of `main` before basemap work was saved to branch:

`backup/gebco-basemap-before-style-selector-2026-11-10`

At the GitHub repo, revert the single basemap-feature commit using the
repository's commit history, or run:

```sh
git revert <basemap-feature-commit-sha>
git push origin main
```

Reverting the feature commit removes `basemap.js`, the selector UI, and
the shared DEM-ready event; it restores prior 500 m contour styling.

Do not delete the `GEBCO_2026_TerrainRGB_Z7.pmtiles` archive. It is also
used by the working depth highlighter.

## Known limits
- Existing raster DEM numerical coverage: approximately 113.84–179.9°E,
  45–64.44°S (not the full requested 80°S).
- Custom styles stop at map zoom 10 to avoid extreme overscaling of
  the available zoom-7 DEM; the original WMS remains available.
- Current contours remain genuine 500 m contours; 250 m and 100 m require
  separate high-resolution contour processing.
- GEBCO data are not for navigation or any safety-at-sea purpose.
