SET workingDir=%cd%

rem startup nginx...
cd tool\nginx-1.13.0
call start_nginx.bat
cd %workingDir%