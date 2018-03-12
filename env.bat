SET workingDir=%cd%

rem setting emsdk evn...
cd ..\emsdk-portable-64bit
call emsdk_env.bat
cd %workingDir%