# PowerShell script to create minimal valid icon files for development testing
# These are basic placeholders - replace with real icons before production

Add-Type -AssemblyName System.Drawing

# Create a simple 16x16 icon (minimal valid ICO)
$bitmap = New-Object System.Drawing.Bitmap 16, 16
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::Blue)
$graphics.Dispose()

# Save as ICO (basic format - not production quality but works for testing)
$stream = [System.IO.File]::Open("icon.ico", [System.IO.FileMode]::Create)
$writer = New-Object System.IO.BinaryWriter($stream)

# ICO header
$writer.Write([UInt16]0)    # Reserved
$writer.Write([UInt16]1)    # Type: 1 = ICO
$writer.Write([UInt16]1)    # Number of images

# Directory entry
$writer.Write([Byte]16)     # Width
$writer.Write([Byte]16)     # Height
$writer.Write([Byte]0)      # Color count
$writer.Write([Byte]0)      # Reserved
$writer.Write([UInt16]1)    # Color planes
$writer.Write([UInt16]32)   # Bits per pixel
$writer.Write([UInt32]0)    # Size of image data (will update)
$writer.Write([UInt32]22)   # Offset to image data

# Write bitmap data (minimal PNG would be better, but using BMP for simplicity)
$bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Bmp)

$writer.Close()
$stream.Close()
$bitmap.Dispose()

Write-Host "Created minimal icon.ico (development placeholder)"

# Create a minimal background.png
$bgBitmap = New-Object System.Drawing.Bitmap 800, 600
$bgGraphics = [System.Drawing.Graphics]::FromImage($bgBitmap)
$bgGraphics.Clear([System.Drawing.Color]::FromArgb(240, 240, 240))
$bgGraphics.DrawString("TravelERP Lite", [System.Drawing.Font]::new("Arial", 24), [System.Drawing.Brushes]::Black, 250, 275)
$bgGraphics.Dispose()
$bgBitmap.Save("background.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bgBitmap.Dispose()

Write-Host "Created minimal background.png (development placeholder)"

# Copy icon.ico as installer-icon.ico
Copy-Item "icon.ico" "installer-icon.ico"
Write-Host "Created installer-icon.ico (copy of icon.ico)"
