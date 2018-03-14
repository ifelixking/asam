@echo off
SET __workingDir=%cd%

echo ======================================
echo ======== setting emsdk evn... ========
echo ======================================
cd ..\emsdk-portable-64bit
call emsdk_env.bat
cd %__workingDir%

echo =======================================
echo ======== setting vs dev env... ========
echo =======================================
SET __VSDEVCMD="d:\Program Files (x86)\Microsoft Visual Studio\2017\Enterprise\Common7\Tools\VsDevCmd.bat"
%__VSDEVCMD%