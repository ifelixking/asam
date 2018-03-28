#include "../../../stdafx.h"
#include "WebGLRenderSystem.h"
// #include "../Window.h"

namespace Asam{

	WebGLRenderSystem * WebGLRenderSystem::s_instance = nullptr;

	void WebGLRenderSystem::SetViewport(const Recti & rect){
		glViewport(rect.position.x, rect.position.y, rect.size.x, rect.size.y);
	}

}