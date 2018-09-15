OUT_DIR = ./dist
OUT_FILENAME = asam.js
TARGET = $(OUT_DIR)/$(OUT_FILENAME)

TEMP_DIR = ./temp

PCH_H = ./src/stdafx.h
PCH = $(TEMP_DIR)/stdafx.pch

SRC_FILENAMES = \
	./src/engine/root.cpp \
	./src/engine/Scene/Scene.cpp \
	./src/engine/Scene/OgreScene/OgreScene.cpp \
	./src/engine/Scene/OgreScene/Camera.cpp \
	./src/engine/Scene/OgreScene/Renderable/Renderable.cpp \
	./src/engine/RenderSystem/RenderTarget.cpp \
	./src/engine/RenderSystem/webgl/WebGLRenderSystem.cpp \
	./src/interface.cpp \
	./src/app/Application.cpp

CC = emcc
DEFINE = -std=c++11 -g4 -s ASSERTIONS=1 -s SAFE_HEAP=1 -s STACK_OVERFLOW_CHECK=1 -s USE_WEBGL2=1
USE_PCH = -include $(PCH_H) -include-pch $(PCH)

main: $(PCH)
	$(CC) $(DEFINE) $(USE_PCH) -o $(TARGET) $(SRC_FILENAMES)

$(PCH): $(PCH_H)
	$(CC) $(DEFINE) -x c++-header -o $(PCH) $(PCH_H)