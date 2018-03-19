#pragma once

#ifndef STDAFX
#include "../../../stdafx.h"
#endif
#include "../Scene.h"

namespace Asam{

	class Node;

	class OgreScene : public Scene{
	public:
		OgreScene();
		~OgreScene();

		void Render();

	private:
		std::vector<Node *> m_nodeList;

	};

}