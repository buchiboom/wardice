@echo off
REM Rebuild Dicestorm.apk (debug) after editing the web app. Run from this folder.
setlocal
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
set "ANDROID_HOME=C:\Android\sdk"
set "ANDROID_SDK_ROOT=C:\Android\sdk"
cd /d "%~dp0"

echo == Assembling web assets into www\ ==
call node scripts\copy-web.mjs || goto :err

echo == Syncing web assets + plugins into the Android project ==
call npx cap sync android || goto :err

echo == Building debug APK ==
cd android
call gradlew.bat assembleDebug --no-daemon || goto :err
cd ..

copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "Dicestorm.apk" >nul
echo.
echo DONE -> %~dp0Dicestorm.apk
goto :eof

:err
echo.
echo BUILD FAILED (see output above).
exit /b 1
