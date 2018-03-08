SET workingDir=%cd%

rem 设置 emsdk 环境
cd ..\emsdk-portable-64bit
call emsdk_env.bat
cd %workingDir%

rem 启动 nginx
cd tool\nginx-1.13.0
call start_nginx.bat
cd %workingDir%