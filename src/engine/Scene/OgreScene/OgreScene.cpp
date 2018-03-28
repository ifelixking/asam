#include "../../../stdafx.h"
#include "OgreScene.h"

namespace Asam{

	OgreScene::OgreScene(){
		
	}

	OgreScene::~OgreScene(){
		
	}

	void OgreScene::Render(){
		prepareRenderQueue();


	}

	void OgreScene::prepareRenderQueue(){

		for(auto itor=m_nodeList.begin(); itor!=m_nodeList.end(); ++itor){
			const Node * node = *itor;
			if (node->visible())
		}

	}


}