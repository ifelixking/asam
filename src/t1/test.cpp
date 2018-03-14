#include <GLES2/gl2.h>
#include <EGL/egl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include  <X11/Xlib.h>
#include  <X11/Xatom.h>
#include  <X11/Xutil.h>
#include <emscripten/html5.h>
#include <emscripten.h>

struct ESContext
{
	void *userData;
	GLint width;
	GLint height;
	EGLNativeWindowType hWnd;
	EGLDisplay eglDisplay;
	EGLContext eglContext;
	EGLSurface eglSurface;
	void (* drawFunc)(ESContext *);
	void (* keyFunc)(ESContext *, unsigned char, int, int);
	void (* updateFunc)(ESContext *, float deltaTime);
};

struct UserData{
	GLuint programObject;
	GLuint vertexPosObject;
};

void esInitContext(ESContext * content){
	if (content != NULL){
		memset(content, 0, sizeof(ESContext));
	}
}

enum CREATEWINDOWFLAG{
	CWF_WINDOW_RGB		= 0x00,
	CWF_WINDOW_ALPHA	= 0x01,
	CWF_WINDOW_DEPTH		= 0x02,
	CWF_WINDOW_STENCIL		= 0x04,
	CWF_WINDOW_MULTISAMPLE	= 0x08,
};

#ifndef FALSE
#define FALSE 0
#endif
#ifndef TRUE
#define TRUE 1
#endif

static Display *x_display = NULL;

GLboolean CreateXWindow(ESContext * context, const char * title){
	x_display = XOpenDisplay(NULL); if (x_display == NULL) { return EGL_FALSE; }

	Window root = DefaultRootWindow(x_display);

	XSetWindowAttributes swa; swa.event_mask = ExposureMask | PointerMotionMask | KeyPressMask;
	Window win = XCreateWindow(x_display, root, 0, 0, context->width, context->height, 0, CopyFromParent, InputOutput, CopyFromParent, CWEventMask, &swa);

	XSetWindowAttributes xattr; xattr.override_redirect = FALSE;
	XChangeWindowAttributes(x_display, win, CWOverrideRedirect, &xattr);

	XWMHints hints; hints.input = TRUE; hints.flags = InputHint;
	XSetWMHints(x_display, win, &hints);
	XMapWindow(x_display, win);
	XStoreName(x_display, win, title);
	
	Atom wm_state = XInternAtom(x_display, "_NET_WM_STATE", FALSE);
	XEvent xev;
	memset(&xev, 0, sizeof(XEvent));
	xev.type					= ClientMessage;
	xev.xclient.window			= win;
	xev.xclient.message_type	= wm_state;
	xev.xclient.format			= 32;
	xev.xclient.data.l[0]		= 1;
	xev.xclient.data.l[1]		= FALSE;
	XSendEvent(x_display, DefaultRootWindow(x_display), FALSE, SubstructureNotifyMask, &xev);

	context->hWnd = (EGLNativeDisplayType)win;
	return EGL_TRUE;
}

GLboolean CreateEGLContext(EGLNativeWindowType hWnd, EGLDisplay * eglDisplay, EGLContext * eglContext, EGLSurface * eglSurface, EGLint attribList[]){

	EGLDisplay display = eglGetDisplay((EGLNativeDisplayType)x_display); if (display == EGL_NO_DISPLAY) { return EGL_FALSE; }

	EGLint majorVersion, minorVersoin;
	if (!eglInitialize(display, &majorVersion, &minorVersoin)) { return EGL_FALSE; }

	EGLint numConfigs;
	if (!eglGetConfigs(display, NULL, 0, &numConfigs)) { return EGL_FALSE; }

	EGLConfig config;
	if (!eglChooseConfig(display, attribList, &config, 1, &numConfigs)) { return EGL_FALSE; }

	EGLSurface surface = eglCreateWindowSurface(display, config, (EGLNativeWindowType)hWnd, NULL); if (surface == EGL_NO_SURFACE) { return EGL_FALSE; }

	EGLint contextAttribs[] = { EGL_CONTEXT_CLIENT_VERSION, 2, EGL_NONE, EGL_NONE };
	EGLContext context = eglCreateContext(display, config, EGL_NO_CONTEXT, contextAttribs); if (context == EGL_NO_CONTEXT) { return EGL_FALSE; }

	if (!eglMakeCurrent(display, surface, surface, context)) { return EGL_FALSE; }

	*eglDisplay = display; *eglSurface = surface; *eglContext = context;
	return EGL_TRUE;
}

GLboolean esCreateWindow(ESContext * context, const char * title, int width, int height, CREATEWINDOWFLAG flag){
	if (context == NULL) { return GL_FALSE; }

	context->width = width; context->height = height;
	if (!CreateXWindow(context, title)) { return GL_FALSE; }

	EGLint attribList[] = {
		EGL_RED_SIZE,		5,
		EGL_GREEN_SIZE,		6,
		EGL_BLUE_SIZE,		5,
		EGL_ALPHA_SIZE,		(flag & CWF_WINDOW_ALPHA) ? 8 : EGL_DONT_CARE,
		EGL_DEPTH_SIZE, 	(flag & CWF_WINDOW_DEPTH) ? 8 : EGL_DONT_CARE,
		EGL_STENCIL_SIZE,	(flag & CWF_WINDOW_STENCIL) ? 8 : EGL_DONT_CARE,
		EGL_SAMPLE_BUFFERS,	(flag & CWF_WINDOW_MULTISAMPLE) ? 1 : 0,
		EGL_NONE
	};
	if (!CreateEGLContext(context->hWnd, &context->eglDisplay, &context->eglContext, &context->eglSurface, attribList)){ return GL_FALSE; }

	return GL_TRUE;
}

//#define BUFSIZ  512
void esLogMessage(const char * formatStr, ...){
	va_list params;
	char buf[BUFSIZ];
	va_start(params, formatStr);
	vsprintf(buf, formatStr, params);
	printf("%s", buf);
	va_end(params);
}

GLuint LoadShader(GLenum type, const char * shaderSrc){
	GLuint shader = glCreateShader(type);
	if (shader == 0) { return 0; }
	glShaderSource(shader, 1, &shaderSrc, NULL);
	glCompileShader(shader);
	GLint compiled; glGetShaderiv(shader, GL_COMPILE_STATUS, &compiled);
	if (!compiled) {
		GLint infoLen = 0;
		glGetShaderiv(shader, GL_INFO_LOG_LENGTH, &infoLen);
		if (infoLen > 1){
			char * infoLog = (char *)malloc(sizeof(char) * infoLen);
			glGetShaderInfoLog(shader, infoLen, NULL, infoLog);
			esLogMessage("Error compiling shader:\n%s\n", infoLog);
			free(infoLog);
		}
		glDeleteShader(shader);
		return 0;
	}
	return shader;
}

int Init(ESContext * context){
	context->userData = malloc(sizeof(UserData));
	UserData * userData = (UserData *)context->userData;
	const char * vShaderStr =
		"attribute vec4 vPosition;    \n"
		"void main()                  \n"
		"{                            \n"
		"   gl_Position = vPosition;  \n"
		"}                            \n";
	const char * fShaderStr =
		"precision mediump float;\n"
		"void main()                                  \n"
		"{                                            \n"
		"  gl_FragColor = vec4 ( 1.0, 0.0, 0.0, 1.0 );\n"
		"}                                            \n";
	GLuint vertexShader = LoadShader(GL_VERTEX_SHADER, vShaderStr);
	GLuint fragmentShader = LoadShader(GL_FRAGMENT_SHADER, fShaderStr);
	
	GLuint programObject = glCreateProgram(); if (programObject == 0) { return 0; }
	glAttachShader(programObject, vertexShader);
	glAttachShader(programObject, fragmentShader);
	glBindAttribLocation(programObject, 0, "vPosition");
	glLinkProgram(programObject);
	GLint linked; glGetProgramiv(programObject, GL_LINK_STATUS, &linked);
	if (!linked){
		GLint infoLen = 0;
		glGetProgramiv(programObject, GL_INFO_LOG_LENGTH, &infoLen);
		if (infoLen > 1) {
			char *infoLog = (char *)malloc(sizeof(char) * infoLen);
			glGetProgramInfoLog(programObject, infoLen, NULL, infoLog);
			esLogMessage("Error linking program:\n%s\n", infoLog);
			free(infoLog);
		}
		glDeleteProgram(programObject);
		return GL_FALSE;
	}
	userData->programObject = programObject;

	//
	GLfloat vVertices[] = {0.0f, 0.5f, 0.0f,
						   -0.5f, -0.5f, 0.0f,
						   0.5f, -0.5f, 0.0f};
	GLuint vertexPosObject;
	glGenBuffers(1, &vertexPosObject);
	glBindBuffer(GL_ARRAY_BUFFER, vertexPosObject);
	glBufferData(GL_ARRAY_BUFFER, 9 * sizeof(float), vVertices, GL_STATIC_DRAW);	
	userData->vertexPosObject = vertexPosObject;

	glClearColor(0.f, 0.f, 0.f, 0.f);

	return GL_TRUE;
}

void Draw(ESContext * context){
	UserData * userData = (UserData *)context->userData;
	glViewport(0, 0, context->width, context->height);
	glClear(GL_COLOR_BUFFER_BIT);
	glUseProgram(userData->programObject);
	glBindBuffer(GL_ARRAY_BUFFER, userData->vertexPosObject);
	glVertexAttribPointer(0, 3, GL_FLOAT, 0, 0, 0);
	glEnableVertexAttribArray(0);
	glDrawArrays(GL_TRIANGLES, 0, 3);
}

// ESContext context;

extern "C" {

void EMSCRIPTEN_KEEPALIVE as_test_render_init() {
	// esCreateWindow(&context, "hello", 320, 240, CWF_WINDOW_RGB);
	// if(!Init(&context)){ return; }
	// context.drawFunc = Draw;

	EmscriptenWebGLContextAttributes attribs;
	emscripten_webgl_init_context_attributes(&attribs);
	attribs.alpha = false;
	attribs.enableExtensionsByDefault = false;

	EMSCRIPTEN_WEBGL_CONTEXT_HANDLE context = emscripten_webgl_create_context("canvas1", &attribs);
	emscripten_webgl_make_context_current(context);

	glClearColor(0.f, 1.f, 0.f, 0.f);

}
void EMSCRIPTEN_KEEPALIVE as_test_render() {

	glViewport(0, 0, 320, 240);
	glClear(GL_COLOR_BUFFER_BIT);

	// if (context.updateFunc != NULL){
	// 	context.updateFunc(&context, 30);
	// }
	// if (context.drawFunc != NULL){
	// 	context.drawFunc(&context);
	// }
	// eglSwapBuffers(context.eglDisplay, context.eglSurface);
}

}