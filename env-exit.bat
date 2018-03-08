SET workingDir=%cd%

rem 退出 nginx
cd tool\nginx-1.13.0
call stop_nginx.bat
cd %workingDir%