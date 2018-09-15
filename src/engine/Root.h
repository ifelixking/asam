#pragma once

namespace Asam {

class Root{
public:
	Root();
	~Root();

	class HtmlCanvas * CreateCanvas(const char * canvasId);
	void Render();

private:
	std::vector<class HtmlCanvas *> m_canvasList;
};

}