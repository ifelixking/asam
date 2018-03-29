#pragma once

#ifndef STDAFX
#include "../../../stdafx.h"
#endif
#include "../Scene.h"

namespace Asam{

	class Node;

	class OgreRenderQueue{};

	class OgreScene : public Scene{
	public:
		OgreScene();
		~OgreScene();

		void Render();

	private:
		void prepareRenderQueue();

	private:
		std::vector<Node *> m_nodeList;
		class OgreRenderQueue m_renderQueue;
	};

	

}