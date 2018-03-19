#pragma once

namespace Asam {

	class Scene{
		virtual ~Scene();
	
		virtual void Render() = 0;
	};

}