#pragma once

namespace Asam {

class Scene;

class Root{
public:
	Root();
	~Root();

	Scene * GetScene() { return m_scene; }
	Scene * SetScene(Scene * scene);

	void Render();

private:
	Scene * m_scene;
};

}