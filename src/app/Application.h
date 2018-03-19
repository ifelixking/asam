#pragma once

#ifndef STDAFX
#include "../stdafx.h"
#endif

class Root;

namespace Asam{
	class Application{
	public:
		Application();
		~Application();

		void Create();
	private:
		Root * m_root;
	};
}