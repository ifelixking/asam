SET workingDir=%cd%

rem exit nginx...
cd tool\nginx-1.13.0
call stop_nginx.bat
cd %workingDir%