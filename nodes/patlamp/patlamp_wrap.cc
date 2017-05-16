/*
 *  Copyright (C) 2016 Lapis Semiconductor Co., Ltd.
 *  file: patlamp_wrap.cc
 *
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/

#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <signal.h>
#include <time.h>
#include <unistd.h>
#include <dlfcn.h>
#include <node.h>
#include <v8.h>
#include "libpatlamp/libpatlamp.h"

using namespace v8;
using namespace patlamp;
using namespace std;

void *handle;

typedef void (*funcptr)(void);

struct PATLAMP_LIB {
	int (*init)(void);
	bool (*readData)(std::string &result);
	void (*snapShot)(std::string filepath);
	void (*setTextColor)(unsigned char r, unsigned char g, unsigned char b);
	int (*setDisplay)(bool on);
	bool (*getDisplay)();
	int (*setMapfile)(std::string str);
	int (*setReportInterval)(int sec);
	int (*setDetectInterval)(int msec);
	int (*setExpandMag)(int mag);
	int (*remove)(void);
} lib;

bool opened = false;
bool initialized = false;

funcptr find(void* handle, const char * name) {
	void (* pfunc)(void);
	char *error;
	dlerror();
	pfunc = (void (*)(void)) dlsym(handle, name);
	if ((error = dlerror()) != NULL)  {
		fprintf (stderr, "%s\n", error);
	}

	return pfunc;
}

Handle<Value> dlopen(const Arguments& args) {
	HandleScope scope;

	if(args.Length() != 1) {
		return ThrowException(String::New("args must be 1"));
	}
	if(!args[0]->IsString()) {
		return ThrowException(String::New("args must be string of library path"));
	}

	String::AsciiValue v8_filepath(args[0]);
	std::string filepath = *v8_filepath;

	printf("%s\n",filepath.c_str());

	if(!opened) {
		handle = dlopen (filepath.c_str(), RTLD_LAZY);
		if (!handle) {
			fprintf (stderr, "%s\n", dlerror());
			return scope.Close(Boolean::New(false));
		}
		lib.init     = (int (*)(void))find(handle, "init");
		lib.readData    = (bool (*)(std::string&))find(handle, "readData");
		lib.snapShot   = (void (*)(std::string))find(handle, "snapShot");
		lib.setTextColor  = (void (*)(unsigned char, unsigned char, unsigned char))find(handle, "setTextColor");
		lib.setDisplay     = (int (*)(bool))find(handle, "setDisplay");
		lib.getDisplay     = (bool (*)(void))find(handle, "getDisplay");
		lib.setMapfile       = (int (*)(std::string))find(handle, "setMapfile");
		lib.setReportInterval    = (int (*)(int))find(handle, "setReportInterval");
		lib.setDetectInterval    = (int (*)(int))find(handle, "setDetectInterval");
		lib.setExpandMag    = (int (*)(int))find(handle, "setExpandMag");
		lib.remove     = (int (*)(void))find(handle, "remove");
		opened = true;
		printf("dlopen\n");
	}
	return scope.Close(Boolean::New(true));
}

Handle<Value> patlamp_init(const Arguments& args) {
	HandleScope scope;

	if(!initialized) {
		if(!lib.init) {
			fprintf (stderr, "libpatlamp cannot open.\n");
		} else {
			if(lib.init() == 0) initialized = true;
		}
		printf("patlamp_init\n");
	}
	return scope.Close(Boolean::New(initialized));
}

Handle<Value> patlamp_readData(const Arguments& args) {
	HandleScope scope;
	std::string str;

	if(initialized) {
		if(lib.readData) {
			if(lib.readData(str) == true) {
				return scope.Close(String::New(str.c_str()));
			}
		} else {
			return ThrowException(String::New("cannot find read function"));
		}
	}
	return scope.Close(String::New(""));
}

Handle<Value> patlamp_snapShot(const Arguments& args) {
	HandleScope scope;

	if(args.Length() != 1) {
		return ThrowException(String::New("args must be 1"));
	}
	if(!args[0]->IsString()) {
		return ThrowException(String::New("args must be string of filepath"));
	}

	String::AsciiValue v8_filepath(args[0]);
	std::string filepath = *v8_filepath;
	/*
	std::string filepath = String::Utf8Value(args[0]);
	String::Utf8Value tmp(args[1]);
	std::string filepath = tmp;
	 */

	if(initialized) {
		if(lib.snapShot) {
			lib.snapShot(filepath);
			return scope.Close(Boolean::New(true));
		} else {
			return ThrowException(String::New("cannot find shapShot in library"));
		}
	}
	return scope.Close(Boolean::New(false));
}

Handle<Value> patlamp_setTextColor(const Arguments& args) {
	HandleScope scope;

	if(args.Length() != 3) {
		return ThrowException(String::New("args must be 3"));
	}
	if((!args[0]->IsNumber()) || (!args[1]->IsNumber()) || (!args[2]->IsNumber())) {
		return ThrowException(String::New("args must be value of r,g,b"));
	}
	int r = args[0]->NumberValue();
	int g = args[1]->NumberValue();
	int b = args[2]->NumberValue();
	
	if(initialized) {
		if(lib.setTextColor) {
			lib.setTextColor(r,g,b);
			return scope.Close(Boolean::New(true));
		} else {
			return ThrowException(String::New("cannot find shapShot in library"));
		}
	}
	return scope.Close(Boolean::New(false));
}

Handle<Value> patlamp_setDisplay(const Arguments& args) {
	HandleScope scope;

	if(args.Length() != 1) {
		return ThrowException(String::New("args must be 1"));
	}
	if(!args[0]->IsBoolean()) {
		return ThrowException(String::New("args must be boolean display on or not"));
	}

	bool disp = args[0]->BooleanValue();

	if(initialized) {
		if(lib.setDisplay) {
			lib.setDisplay(disp);
			return scope.Close(Boolean::New(true));
		} else {
			return ThrowException(String::New("cannot find dispImage in library"));
		}
	}
	return scope.Close(Boolean::New(false));
}

Handle<Value> patlamp_getDisplay(const Arguments& args) {
	HandleScope scope;
	bool disp;
	if(initialized) {
		disp = lib.getDisplay();
		return scope.Close(Boolean::New(disp));
	}
	return scope.Close(Boolean::New(false));
}
Handle<Value> patlamp_setMapfile(const Arguments& args) {
	HandleScope scope;

	if(args.Length() != 1) {
		return ThrowException(String::New("args must be 1"));
	}
	if(!args[0]->IsString()) {
		printf("[warn] patlamp map file is not indicated!!\n");
		return scope.Close(Boolean::New(false));
	}

	String::AsciiValue v8_filepath(args[0]);
	std::string filepath = *v8_filepath;

	if(initialized) {
		if(lib.setMapfile) {
			printf("map file %s\n",filepath.c_str());
			lib.setMapfile(filepath);
			return scope.Close(Boolean::New(true));
		} else {
			return ThrowException(String::New("cannot find setMapfile in library"));
		}
	}
	return scope.Close(Boolean::New(false));
}

Handle<Value> patlamp_setReportInterval(const Arguments& args) {
	HandleScope scope;

	if(args.Length() != 1) {
		return ThrowException(String::New("args must be 1"));
	}
	if(!args[0]->IsNumber()) {
		return ThrowException(String::New("args must be value of reported interval"));
	}
	int sec = args[0]->NumberValue();
	
	if(initialized) {
		if(lib.setReportInterval) {
			lib.setReportInterval(sec);
			return scope.Close(Boolean::New(true));
		} else {
			return ThrowException(String::New("cannot find setReportedInterval in library"));
		}
	}
	return scope.Close(Boolean::New(false));
}

Handle<Value> patlamp_setDetectInterval(const Arguments& args) {
	HandleScope scope;

	if(args.Length() != 1) {
		return ThrowException(String::New("args must be 1"));
	}
	if(!args[0]->IsNumber()) {
		return ThrowException(String::New("args must be value of reported interval"));
	}
	int msec = args[0]->NumberValue();
	
	if(initialized) {
		if(lib.setDetectInterval) {
			lib.setDetectInterval(msec);
			return scope.Close(Boolean::New(true));
		} else {
			return ThrowException(String::New("cannot find setReportedInterval in library"));
		}
	}
	return scope.Close(Boolean::New(false));
}

Handle<Value> patlamp_setExpandMag(const Arguments& args) {
	HandleScope scope;

	if(args.Length() != 1) {
		return ThrowException(String::New("args must be 1"));
	}
	if(!args[0]->IsNumber()) {
		return ThrowException(String::New("args must be value of displayed expand magnification"));
	}
	int mag = args[0]->NumberValue();
	
	if(initialized) {
		if(lib.setExpandMag) {
			lib.setExpandMag(mag);
			return scope.Close(Boolean::New(true));
		} else {
			return ThrowException(String::New("cannot find setExpandMag in library"));
		}
	}
	return scope.Close(Boolean::New(false));
}

Handle<Value> patlamp_remove(const Arguments& args) {
	HandleScope scope;
	bool result = false;

	if(initialized) {
		if(lib.remove) {
			if(lib.remove() == 0) {
				result = true;
				initialized = false;
				printf("patlamp_remove\n");
			}
		} else {
			fprintf (stderr, "libpatlamp cannot remove.\n");
		}
	} else result = true;
	return scope.Close(Boolean::New(result));
}

Handle<Value> dlclose(const Arguments& args) {
	HandleScope scope;
	if(opened) {
		if(handle) {
			dlclose(handle);
		}
		initialized = false;
		opened = false;
		memset(&lib,0,sizeof(lib));
		printf("dlclose\n");
	}
	return scope.Close(Boolean::New(true));
}

//void init(Local<Object> target) {
void node_init(Handle<Object> target) {
	NODE_SET_METHOD(target, "dlopen", dlopen);
	NODE_SET_METHOD(target, "patlamp_init", patlamp_init);
	NODE_SET_METHOD(target, "patlamp_readData", patlamp_readData);
	NODE_SET_METHOD(target, "patlamp_snapShot", patlamp_snapShot);
	NODE_SET_METHOD(target, "patlamp_setTextColor", patlamp_setTextColor);
	NODE_SET_METHOD(target, "patlamp_setDisplay", patlamp_setDisplay);
	NODE_SET_METHOD(target, "patlamp_getDisplay", patlamp_getDisplay);
	NODE_SET_METHOD(target, "patlamp_setMapfile", patlamp_setMapfile);
	NODE_SET_METHOD(target, "patlamp_setReportInterval", patlamp_setReportInterval);
	NODE_SET_METHOD(target, "patlamp_setDetectInterval", patlamp_setDetectInterval);
	NODE_SET_METHOD(target, "patlamp_setExpandMag", patlamp_setExpandMag);
	NODE_SET_METHOD(target, "patlamp_remove", patlamp_remove);
	NODE_SET_METHOD(target, "dlclose", dlclose);
}

NODE_MODULE(patlamp_wrap,node_init)

