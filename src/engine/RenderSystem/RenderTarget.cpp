#include "../../stdafx.h"
#include "webgl/WebGLRenderSystem.h"
#include "RenderTarget.h"

namespace Asam{

	RenderTarget::RenderTarget()
		: m_isNeedSortViewportList(false)
	{
		Viewport * vp = CreateViewport();
	}

	RenderTarget::~RenderTarget(){
		for(auto itor=m_viewportList.begin(); itor!=m_viewportList.end(); ++itor){
			Viewport * vp = *itor; delete vp;
		}
	}

	Viewport * RenderTarget::CreateViewport(){
		Viewport * vp = new Viewport((int)(m_viewportList.size() + 1));
		m_viewportList.push_back(vp);
		m_isNeedSortViewportList = true;
		return vp;
	}

	bool RenderTarget::DeleteViewport(Viewport * vp){
		assert(m_viewportList.size() > 0);
		if (m_viewportList.size() == 1) { return false; }	// 至少留一个
		auto findResult = std::find(m_viewportList.begin(), m_viewportList.end(), vp);
		if (findResult == m_viewportList.end()){ return false; }
		m_viewportList.erase(findResult);
		delete vp;
		return true;
	}

	void RenderTarget::resortViewport(){
		class compare{
			bool operator()(const Viewport & a, const Viewport & b) const {
				return a.m_zIndex < b.m_zIndex;
			}
		};
		std::sort(m_viewportList.begin(), m_viewportList.end(), compare());
	}

	void RenderTarget::Render() const{
		if (m_isNeedSortViewportList) { ((RenderTarget *)(this))->resortViewport(); }
		for (auto itorViewport=m_viewportList.rbegin(); itorViewport!=m_viewportList.rend(); ++itorViewport){
			const Viewport * vp = *itorViewport;
			RenderSystem::GetInstance()->SetViewport(vp->GetViewportRect());
			for (auto itorLayer=vp->m_layerList.begin(); itorLayer!=vp->m_layerList.end(); ++itorLayer){
				const Layer * layer = *itorLayer;
				RenderSystem::GetInstance()->SetFrameBuffer(layer->m_frameBuffer);
			}
			

		}

	}

	void RenderTarget::SetCamera(Camera * camera){
		assert(m_viewportList.size() > 0);
		(*m_viewportList.begin())->SetCamera(camera);
	}
	
	void RenderTarget::SetScene(Scene * scene){
		assert(m_viewportList.size() > 0);
		(*m_viewportList.begin())->SetScene(scene);
	}


	// Viewport ====================================================================================================================================================================================================

	Viewport::Viewport(int zIndex)
		: m_zIndex(zIndex)
	{
		Layer * layer = CreateLayer();
	}

	Viewport::~Viewport(){
		for (auto itor=m_layerList.begin(); itor!=m_layerList.end(); ++itor){
			Layer * layer = *itor; delete layer;			
		}
	}

	Layer * Viewport::CreateLayer(){
		Layer * layer = new Layer((int)(m_layerList.size() + 1));
		m_layerList.push_back(layer);
		m_isNeedSortLayerList = true;
		return layer;
	}

	void Viewport::SetCamera(Camera * camera){
		assert(m_layerList.size() > 0);
		(*m_layerList.begin())->SetCamera(camera);

	}
	
	void Viewport::SetScene(Scene * scene){
		assert(m_layerList.size() > 0);
		(*m_layerList.begin())->SetScene(scene);
	}

	// Layer ====================================================================================================================================================================================================
	void Layer::SetCamera(Camera * camera){
		m_camera = camera;
	}
	
	void Layer::SetScene(Scene * scene){
		m_scene = scene;
	}

}

