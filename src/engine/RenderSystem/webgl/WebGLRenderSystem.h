#pragma once

#include "../RenderTarget.h"

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

	class HtmlCanvas : public RenderTarget{
	public:
		// HtmlCanvas();
		// ~HtmlCanvas();
		void CreateContext(const char * canvasId);
		void DestroyContext();
		void MakeCurrent();

	private:
		std::string m_canvasId;
		EMSCRIPTEN_WEBGL_CONTEXT_HANDLE m_glContext;
	};
	
	class WebGLRenderSystem{
	public:
		static WebGLRenderSystem * GetInstance(){ return s_instance; }

	public:
		WebGLRenderSystem();
		~WebGLRenderSystem();

		void SetViewport(const Recti & rect){}
		void SetFrameBuffer(const WebGLFrameBuffer * frameBuffer);

		void Draw(RenderData);

		HtmlCanvas * CreateHtmlCanvas(const char * canvasId){return nullptr;}

	private:
		static WebGLRenderSystem * s_instance;
		

	};

}