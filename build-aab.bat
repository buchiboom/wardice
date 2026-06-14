@echo off
REM Build the signed release Android App Bundle (.aab) for Play Store upload.
setlocal
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
set "ANDROID_HOME=C:\Android\sdk"
set "ANDROID_SDK_ROOT=C:\Android\sdk"
cd /d "%~dp0"

echo == Assembling web assets ==
call node scripts\copy-web.mjs || goto :err
echo == Syncing into the Android project ==
call npx cap sync android || goto :err
echo == Building signed release bundle ==
cd android
call gradlew.bat bundleRelease --no-daemon || goto :err
cd ..

echo.
echo DONE -^> android\app\build\outputs\bundle\release\app-release.aab
goto :eof

:err
echo.
echo BUILD FAILED (see output above).
exit /b 1
