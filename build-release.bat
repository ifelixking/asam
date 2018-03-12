mkdir dist
copy .\src\*.html .\dist\
copy .\src\*.js .\dist\

SET ExpFuncs="['_main','_as_test']"

set EMCC_DEBUG=2
emcc -o ./dist/as.js -s WASM=1 -s USE_WEBGL2=1 -s EXPORTED_FUNCTIONS=%ExpFuncs% -s EXTRA_EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap']" ./src/interface.cpp ./src/t1/test.cpp
set EMCC_DEBUG=0