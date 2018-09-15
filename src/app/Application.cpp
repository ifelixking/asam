#include "../stdafx.h"
#include "Application.h"
#include "../engine/Root.h"

namespace Asam{
	Application * Application::s_instance = nullptr;

	Application::Application()
		: m_root(NULL)
	{
	}
	Application::~Application(){
		delete m_root;
	}

	void Application::init(const char * canvasId){
		m_root = new Root();
		m_root->CreateCanvas(canvasId);
	}
}