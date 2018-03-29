#pragma once

#ifndef STDAFX
#include "../../stdafx.h"
#endif

namespace Asam{

	class Camera;
	class Scene;
	class Viewport;
	class Layer;

	class RenderTarget {
	public:
		RenderTarget();
		virtual ~RenderTarget();

		void Render() const;
		
		void SetCamera(Camera * camera);
		void SetScene(Scene * scene);
		
		class Viewport * CreateViewport();
		bool DeleteViewport(Viewport * vp);

	private:
		void resortViewport();

	private:
		std::vector<class Viewport *> m_viewportList;
		bool m_isNeedSortViewportList;		
	};

	class Viewport {
		friend class RenderTarget;
	private:		
		Viewport(int zIndex);
		~Viewport();

	public:
		void SetCamera(Camera * camera);
		void SetScene(Scene * scene);

		class Layer * CreateLayer();
		const Recti & GetViewportRect() const { return m_rect; }

	private:
		std::vector<class Layer *> m_layerList;
		Recti m_rect;		
		int m_zIndex;
		bool m_isNeedSortLayerList;
	};

	class Layer {
	friend class RenderTarget;
	friend class Viewport;
	private:	
		Layer(int zIndex);
		~Layer();

	public:
		void SetCamera(Camera * camera);
		void SetScene(Scene * scene);

	private:
		class Camera * m_camera;
		class Scene * m_scene;
		class FrameBuffer * m_frameBuffer;		
	};

}