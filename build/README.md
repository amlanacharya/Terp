# Build Resources

This directory contains icon and image assets for the Windows installer.

## Required Files

### Current Status: PLACEHOLDER FILES (Development Only)

The following placeholder files exist for development testing. **Replace with real files before production build:**

- `icon.ico` - Windows executable icon (256x256 minimum)
- `background.png` - Installer background image (1920x1080 recommended)
- `installer-icon.ico` - Installer executable icon

## How to Create Real Icons

### Option 1: Online Converters
1. Create a 256x256 PNG of your logo
2. Use https://convertico.com/ to convert to .ico
3. Place as `icon.ico`

### Option 2: Using Image Editors
1. GIMP: Open logo → Export as .ico
2. Photoshop: Use ICO plugin
3. Paint.NET: Use ICO plugin

### Option 3: Command Line Tools
```bash
# Using ImageMagick (if installed)
magick convert logo.png -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico
```

## Icon Specifications

**icon.ico**
- Format: ICO
- Sizes: 256x256 (minimum), include multiple sizes for best quality
- Used for: Application executable

**background.png**
- Format: PNG
- Size: 1920x1080 (recommended), minimum 800x600
- Used for: Installer background image

**installer-icon.ico**
- Format: ICO
- Size: 256x256 (minimum)
- Used for: Installer/uninstaller executables

## Notes

- electron-builder will fail with invalid icon files
- Test builds work with placeholders but production must use real icons
- Consider branding: use TravelERP logo with consistent colors
