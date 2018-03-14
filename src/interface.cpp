#include <stdio.h>
#include <emscripten/html5.h>
// #include <vector>

extern "C" {

int main()
{
	// printf("--ASAM--\n");
}

EM_BOOL cbMouse(int eventType, const EmscriptenMouseEvent *mouseEvent, void *userData){
	printf("eventType: %d\n", eventType);
	return true;
}

int as_test()
{
	// std::vector<int> vec;
	// vec.push_back(1);
	// vec.push_back(2);
	// int result = (int)vec.size();
	// int a = 33;
	// return a;

	// int a = 1;
	// int b = 2;
	// int c = a + b;
	// return c;

	int result = emscripten_set_click_callback("callback", NULL, false, cbMouse);
	printf("result: %d\n", result);

	return 0;
}


}