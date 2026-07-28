; VK Radar Installer
!include "MUI2.nsh"

Name "VK Radar"
OutFile "VK-Radar-Setup.exe"
InstallDir "$LOCALAPPDATA\VK-Radar"
InstallDirRegKey HKCU "Software\VK-Radar" "InstallDir"
RequestExecutionLevel user

; MUI Settings
!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"
!define MUI_WELCOMEPAGE_TITLE "VK Radar"
!define MUI_WELCOMEPAGE_TEXT "Установка VK Radar - локального сканера VK.$\r$\n$\r$\nПриложение включает:$\r$\n- Сканер постов VK$\r$\n- Веб-интерфейс с радаром$\r$\n- Фильтрацию спама$\r$\n$\r$\nНажмите Далее для продолжения."

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Language
!insertmacro MUI_LANGUAGE "Russian"

Section "VK Radar" SecMain
  SetOutPath "$INSTDIR"
  
  ; Copy all files
  File /r "release\*.*"
  
  ; Create uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"
  
  ; Create shortcuts
  CreateDirectory "$SMPROGRAMS\VK Radar"
  CreateShortCut "$SMPROGRAMS\VK Radar\VK Radar.lnk" "$INSTDIR\VK Radar.bat" "" "$INSTDIR\bin\node.exe"
  CreateShortCut "$SMPROGRAMS\VK Radar\Uninstall.lnk" "$INSTDIR\uninstall.exe"
  CreateShortCut "$DESKTOP\VK Radar.lnk" "$INSTDIR\VK Radar.bat" "" "$INSTDIR\bin\node.exe"
  
  ; Registry
  WriteRegStr HKCU "Software\VK-Radar" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VK-Radar" "DisplayName" "VK Radar"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VK-Radar" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VK-Radar" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VK-Radar" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VK-Radar" "NoRepair" 1
SectionEnd

Section "Uninstall"
  RMDir /r "$INSTDIR"
  
  Delete "$SMPROGRAMS\VK Radar\VK Radar.lnk"
  Delete "$SMPROGRAMS\VK Radar\Uninstall.lnk"
  RMDir "$SMPROGRAMS\VK Radar"
  Delete "$DESKTOP\VK Radar.lnk"
  
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VK-Radar"
  DeleteRegKey HKCU "Software\VK-Radar"
SectionEnd
