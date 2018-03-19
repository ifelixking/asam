OUT_DIR = ./dist
OUT_FILENAME = as.js
TARGET = $(OUT_DIR)/$(OUT_FILENAME)

SRC_FILENAMES = ./src/interface.cpp ./src/t1/test.cpp

CC = emcc
DEFINE = -g4 -s ASSERTIONS=1 -s SAFE_HEAP=1 -s STACK_OVERFLOW_CHECK=1 -s USE_WEBGL2=1

main: $(TARGET)
	$(CC) $(DEFINE) -o $(TARGET) $(SRC_FILENAMES)