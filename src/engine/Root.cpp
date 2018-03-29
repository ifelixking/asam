#include "../stdafx.h"
#include "Root.h"
// #include "RenderSystem/webgl/WebGLRenderSystem.cpp"
#include "RenderSystem/Canvas.h"

namespace Asam {

Root::Root(){
	
}

Root::~Root(){
	
}

void Root::Render(){
	for(auto itor=m_canvasList.begin(); itor!=m_canvasList.end(); ++itor){
		Canvas * canvas = *itor;
		if (canvas->GetActivate()) {
			canvas->Render();
		}
	}
}

Canvas * Root::CreateCanvas(){
	Canvas * canvas = new Canvas();
	m_canvasList.push_back(canvas);
	return canvas;
}

}