mkdir dist
copy .\src\*.html .\dist\
copy .\src\*.js .\dist\

rem SET ExpFuncs="['_main','_as_test','_as_test_render_init','_as_test_render']"

rem set EMCC_DEBUG=2
rem emcc -v -g4 -s ASSERTIONS=1 -s SAFE_HEAP=1 -s STACK_OVERFLOW_CHECK=1 -o ./dist/as.js -s USE_WEBGL2=1 -s EXPORTED_FUNCTIONS=%ExpFuncs% -s EXTRA_EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap']" ./src/interface.cpp ./src/t1/test.cpp
rem emcc -v -g4 -s ASSERTIONS=1 -s SAFE_HEAP=1 -s STACK_OVERFLOW_CHECK=1 -o ./dist/as.js -s USE_WEBGL2=1 -s EXTRA_EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap']" ./src/interface.cpp ./src/t1/test.cpp
rem set EMCC_DEBUG=0
emcc -g4 -s ASSERTIONS=1 -s SAFE_HEAP=1 -s STACK_OVERFLOW_CHECK=1 -o ./dist/as.js -s USE_WEBGL2=1 ./src/interface.cpp ./src/t1/test.cpp