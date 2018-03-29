#pragma once

#ifndef STDAFX
#include "../../../stdafx.h"
#endif

namespace Asam{

	enum PRIMITIVE_TYPE : unsigned short{
		PT_POINTS = GL_POINTS, 
		PT_LINE_STRIP = GL_LINE_STRIP,
		PT_LINE_LOOP = GL_LINE_LOOP, 
		PT_LINES = GL_LINES,
		PT_TRIANGLE_STRIP = GL_TRIANGLE_STRIP, 
		PT_TRIANGLE_FAN  = GL_TRIANGLE_FAN,
		PT_TRIANGLES = GL_TRIANGLES,
	};

	enum INDEX_TYPE : unsigned short{
		IT_BYTE = GL_UNSIGNED_BYTE,
		IT_SHORT = GL_UNSIGNED_SHORT,
		IT_INT = GL_UNSIGNED_INT,
	};

	struct RenderData{
		PRIMITIVE_TYPE PrimitiveType;
		INDEX_TYPE IndexType;
		GLuint VertexBuffer;
		GLuint IndexBuffer;
		void * startPtr;
		GLsizei count;
	};

	class WebGLFrameBuffer {

	};
	
	class WebGLRenderSystem{
	public:
		static WebGLRenderSystem * GetInstance(){ return s_instance; }

	public:
		WebGLRenderSystem();
		~WebGLRenderSystem();

		void SetViewport(const Recti & rect);
		void SetFrameBuffer(const WebGLFrameBuffer * frameBuffer);

		void Draw(RenderData);

	private:
		static WebGLRenderSystem * s_instance;
		

	};

	typedef WebGLRenderSystem RenderSystem;
	typedef WebGLFrameBuffer FrameBuffer;

}