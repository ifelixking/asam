#pragma once

#ifndef STDAFX
#include "../../../stdafx.h"
#endif

namespace Asam{

	class Renderable;

	class Node{
	public:
		Node();
		virtual ~Node();

		virtual void GetRenderables() = 0;


	private:
		
		// std::vector<Renderable *> m_renderableList;

	};

}