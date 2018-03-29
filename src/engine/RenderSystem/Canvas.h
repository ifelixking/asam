#pragma once

#ifndef STDAFX
#include "../../stdafx.h"
#endif

#include "RenderTarget.h"

namespace Asam{

	class Canvas : public RenderTarget{
	public:
		Canvas();
		virtual ~Canvas();

		// 方便用户手动控制某个Canvas是否渲染, 比如当窗口隐藏, 或被别的窗口完全覆盖时
		void SetActivated(bool activated) { m_isActivated = activated; }
		bool GetActivate() const { return m_isActivated; }

	private:
		bool m_isActivated;
	};

}