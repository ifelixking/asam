#pragma once

// #ifndef STDAFX
// #include "../../stdafx.h"
// #endif

#include "Vector.h"

namespace Asam{
	struct Rectf{
		Vector2f position;
		Vector2f size;
	};

	struct Recti{
		Vector2i position;
		Vector2i size;
	};
}