#pragma once

namespace Asam{
	class Application{
	public:
		static void Init(const char * canvasId){
			if (s_instance) { return; }
			s_instance = new Application();
			s_instance->init(canvasId);
		}

		static void Destroy(){
			if (s_instance == nullptr) { return; }
			delete s_instance; s_instance = nullptr;
		}

	private:
		Application();
		~Application();
		void init(const char * canvasId);

	private:
		static Application * s_instance;
		class Root * m_root;
	};
}