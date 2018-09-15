#include "stdafx.h"
#include "app/Application.h"

extern "C" {

void EMSCRIPTEN_KEEPALIVE asamCreateApplication(const char * canvasId)
{
	Asam::Application::Init(canvasId);
}



}