; TravelERP Lite Installer Script
; Requires NSIS 3.0+

!include "MUI2.nsh"

; Configuration
Name "TravelERP Lite"
OutFile "dist/installer/TravelERP-Lite-Setup-1.0.0.exe"
InstallDir "$PROGRAMFILES\TravelERP"
InstallDirRegKey HKLM "Software\TravelERP" "InstallLocation"
RequestExecutionLevel admin

; Variables
Var PostgresInstalled
Var StartMenuFolder

; Interface Settings
!define MUI_ABORTWARNING
!define MUI_ICON "build\icon.ico"
!define MUI_UNICON "build\icon.ico"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "build\LICENSE.txt"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Languages
!insertmacro MUI_LANGUAGE "English"

; Installer Sections
Section "TravelERP Lite (Required)" SecApp
  SectionIn RO

  SetOutPath $INSTDIR
  File /r "dist\*"
  File /r "electron\*"
  File /r "server\dist\*"

  ; Store installation folder
  WriteRegStr HKLM "Software\TravelERP" "InstallLocation" $INSTDIR

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Add to Add/Remove Programs
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TravelERP" \
                   "DisplayName" "TravelERP Lite"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TravelERP" \
                   "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TravelERP" \
                   "Publisher" "TravelERP"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TravelERP" \
                   "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TravelERP" \
                   "NoRepair" 1

  ; Create shortcuts
  CreateDirectory "$SMPROGRAMS\$StartMenuFolder"
  CreateShortCut "$SMPROGRAMS\$StartMenuFolder\TravelERP Lite.lnk" \
                 "$INSTDIR\TravelERP-Lite.exe" "" "$INSTDIR\build\icon.ico" 0
  CreateShortCut "$DESKTOP\TravelERP Lite.lnk" \
                 "$INSTDIR\TravelERP-Lite.exe" "" "$INSTDIR\build\icon.ico" 0
SectionEnd

Section "PostgreSQL Database" SecPostgres
  SetOutPath "$INSTDIR\pgsql"
  File /r "resources\postgresql\*"

  ; Initialize database cluster
  ExecWait '"$INSTDIR\pgsql\bin\initdb.exe" -D "$INSTDIR\pgsql\data" -U travelerp -E UTF8 -W'

  ; Configure for localhost only
  FileOpen $0 "$INSTDIR\pgsql\data\postgresql.conf" a
  FileSeek $0 0 END
  FileWrite $0 "listen_addresses = 'localhost'$\r$\n"
  FileWrite $0 "port = 5432$\r$\n"
  FileWrite $0 "max_connections = 20$\r$\n"
  FileClose $0

  ; Register as Windows service
  ExecWait '"$INSTDIR\pgsql\bin\pg_ctl.exe" register -N "TravelERP-PostgreSQL" -D "$INSTDIR\pgsql\data" -U travelerp'

  ; Start service
  ExecWait 'net start "TravelERP-PostgreSQL"'

  StrCpy $PostgresInstalled 1
SectionEnd

Section "Initialize Database" SecDatabase
  ; Wait for PostgreSQL to be ready
  Sleep 5000

  ; Create database
  ExecWait '"$INSTDIR\pgsql\bin\psql.exe" -U travelerp -c "CREATE DATABASE travelerp_lite;"'

  ; Run schema
  ExecWait '"$INSTDIR\pgsql\bin\psql.exe" -U travelerp -d travelerp_lite -f "$INSTDIR\server\db\schema.sql"'
SectionEnd

; Uninstaller Section
Section "Uninstall"
  ; Stop PostgreSQL service
  ExecWait 'net stop "TravelERP-PostgreSQL"'
  ExecWait '"$INSTDIR\pgsql\bin\pg_ctl.exe" unregister -N "TravelERP-PostgreSQL"'

  ; Remove files
  RMDir /r "$INSTDIR"

  ; Remove shortcuts
  Delete "$SMPROGRAMS\$StartMenuFolder\TravelERP Lite.lnk"
  Delete "$DESKTOP\TravelERP Lite.lnk"
  RMDir "$SMPROGRAMS\$StartMenuFolder"

  ; Remove registry keys
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TravelERP"
  DeleteRegKey HKLM "Software\TravelERP"
SectionEnd
