#include "../stdafx.h"
#include "Root.h"

namespace Asam {

Root::Root()
	:m_scene(NULL)
{
	
}

Root::~Root(){
	
}

Scene * Root::SetScene(Scene * scene){
	Scene * oldScene = m_scene;
	m_scene = scene;
	return scene;
}

}