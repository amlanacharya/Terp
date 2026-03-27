# Build Resources

This directory contains build resources for TravelERP Lite installer.

## Required Files:

### Icon Files:
- `icon.ico` - Application icon (256x256 minimum, recommended 512x512)
  - Used for: Application icon, installer icon, uninstaller icon
  - Format: Windows ICO file with multiple sizes

### Installer Images (Optional):
- `installer-header.bmp` - Installer header image (493x58 px)
- `installer-sidebar.bmp` - Installer sidebar image (164x314 px)

## How to Create Icon:

1. Design or use an existing logo
2. Convert to ICO format with multiple sizes:
   - 16x16, 32x32, 48x48, 256x256
3. Save as `icon.ico` in this directory

## Tools for ICO Creation:
- Online: https://www.icoconverter.com/
- GIMP with ICO plugin
- Adobe Photoshop with ICO plugin
- Paint.NET with ICO plugin

## PostgreSQL Portable:
PostgreSQL binaries will be downloaded to `build/postgres/` during setup.
