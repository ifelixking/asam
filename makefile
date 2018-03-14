OUT_DIR = ./dist
OUT_FILENAME = as.js
TARGET = $(OUT_DIR)/$(OUT_FILENAME)

SRC_DIR = ./src

CC = emcc
DEFINE = -g4 -s ASSERTIONS=1 -s SAFE_HEAP=1 -s STACK_OVERFLOW_CHECK=1 -s USE_WEBGL2=1

main: $(TARGET)
	$(CC) $(DEFINE) -o $(TARGET) $(SRC_DIR)/interface.cpp

names = a b c d 

test:
	$(foreach n,$(names), echo $(n).o) 