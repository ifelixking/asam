#pragma once

namespace Asam {

	class Scene{
	public:
		virtual ~Scene();
	
		virtual void Render(class Camera * camera) = 0;
	};

}