# Sample data

## Duplex_A_20110907.ifc.gz

A small two-storey residential building — the "Duplex Apartment" model, authored
in Autodesk Revit Architecture 2011 and published as an IFC2X3 file. 2.38 MB
uncompressed, 452 KB as stored here.

The seed script uploads it to Speckle so the demo contains one project built
from a **real IFC import** rather than geometry generated in code. That matters
because Speckle's IFC importer produces a different shape from a native
connector: every object is typed `Objects.Data.DataObject` with the real class
in `ifcType`, and quantities arrive under
`properties.Quantities.BaseQuantities`. This package reads both shapes, and
without a real file there is nothing to demonstrate it on.

**Source:** [buildingSMART Community Sample Test Files](https://github.com/buildingsmart-community/Community-Sample-Test-Files),
`IFC 2.3.0.1 (IFC 2x3)/Duplex Apartment/Duplex_A_20110907.ifc`

**Licence:** [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)

**Attribution:** © buildingSMART community contributors. Redistributed here
unmodified apart from gzip compression, under the terms of CC BY 4.0.

### What it does and does not show

Categories come through in full: the mirror reads 14 real IFC classes from
`ifcType` — 56 `IfcWallStandardCase`, 24 `IfcWindow`, 21 `IfcSlab`, 14
`IfcDoor`, and so on down to a single `IfcRoof`.

**Masses stay empty for this project, and the file is why.** This export carries
no element quantities at all: zero `IFCQUANTITYVOLUME`, zero
`IFCQUANTITYLENGTH`, and its 21 quantity sets are "GSA Space Areas" attached to
`IfcSpace` — a US federal space-area measure, not the standard `BaseQuantities`
on building elements. The mirror reads `NetVolume`, `NetSideArea` / `NetArea`
and `Length` under `properties.Quantities.BaseQuantities`, and excludes spaces
from element totals on purpose. So the empty mass columns here are the file
being honest, not the reader failing.

Plenty of real-world exports are like this, which is worth knowing before a
client asks why the tonnage is blank. A model exported *with* quantity sets —
most current Revit and Archicad IFC exports, if the quantity option is enabled
— fills those columns.

To use a different model instead, pass `--ifc <path>` to the seed script; it
accepts a plain `.ifc` file or a gzipped one. Nothing about the demo depends on
this particular building.
