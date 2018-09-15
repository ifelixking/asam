#include "../../../stdafx.h"
#include "WebGLRenderSystem.h"
// #include "../Window.h"

namespace Asam{

	WebGLRenderSystem * WebGLRenderSystem::s_instance = nullptr;

	// void WebGLRenderSystem::SetViewport(const Recti & rect){
	// 	glViewport(rect.position.x, rect.position.y, rect.size.x, rect.size.y);
	// }

	// HtmlCanvas * WebGLRenderSystem::CreateHtmlCanvas(const char * canvasId){
	// 	HtmlCanvas * canvas = new HtmlCanvas;
	// 	canvas->CreateContext(canvasId);
	// 	return canvas;
	// }

	// HtmlCanvas::HtmlCanvas()
	// 	: m_glContext(0)
	// {
	// }

	// HtmlCanvas::~HtmlCanvas(){
	// 	DestroyContext();
	// }

	// void HtmlCanvas::CreateContext(const char * canvasId){
	// 	if (m_glContext) { DestroyContext(); }
	// 	m_canvasId = canvasId;
	// 	EmscriptenWebGLContextAttributes attribs;
	// 	emscripten_webgl_init_context_attributes(&attribs);
	// 	attribs.alpha = false;
	// 	attribs.enableExtensionsByDefault = false;
	// 	m_glContext = emscripten_webgl_create_context(m_canvasId.c_str(), &attribs);
	// }

	// void HtmlCanvas::DestroyContext(){

	// }
	
	// void HtmlCanvas::MakeCurrent(){
	// 	assert(m_glContext);
	// 	emscripten_webgl_make_context_current(m_glContext);
	// }

}