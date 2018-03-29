#pragma once

namespace Asam {

class Scene;
class Canvas;

class Root{
public:
	Root();
	~Root();

	class Canvas * CreateCanvas();
	void Render();

private:
	std::vector<Canvas *> m_canvasList;
};

}