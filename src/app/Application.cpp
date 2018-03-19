#include "Application.h"
#include "../engine/Root.h"

namespace Asam{
	Application::Application()
		: m_root(NULL)
	{
	}
	Application::~Application(){
		delete m_root;

	}

	void Application::Create(){
		m_root = new Root();
	}
}