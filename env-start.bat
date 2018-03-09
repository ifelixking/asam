SET workingDir=%cd%

rem setting emsdk evn...
cd ..\emsdk-portable-64bit
call emsdk_env.bat
cd %workingDir%

rem startup nginx...
cd tool\nginx-1.13.0
call start_nginx.bat
cd %workingDir%