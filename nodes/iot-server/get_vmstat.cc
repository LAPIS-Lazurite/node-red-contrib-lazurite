/*
 *  Copyright (C) 2016 Lapis Semiconductor Co., Ltd.
 *  file: get_vmstat.cc
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

#if (V8_MAJOR_VERSION == 4)
	#define V8_VER_5
#elif (V8_MAJOR_VERSION == 5)
	#define V8_VER_5
#else
	#define V8_VER_0
#endif

using namespace v8;
using namespace std;

const char* ToCString(const String::Utf8Value& value) {
	return *value ? *value : "<string conversion failed>";
}

#ifdef V8_VER_0
Handle<Value> get_vmstat(const Arguments& args) {
	HandleScope scope;
#endif
#ifdef V8_VER_5
void get_vmstat(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
#endif
	FILE *fp;
	char cmd[256];
	char buf[256];
	char *tmp;

	//  r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
	union {
		long data[20];
		struct {
			long r;
			long b;
			long swap;
			long free;
			long buff;
			long cache;
			long si;
			long so;
			long bi;
			long bo;
			long in;
			long cs;
			long us;
			long sy;
			long id;
			long wa;
			long st;
		} vmstat;
	} log;

	sprintf(cmd,"vmstat");
	fp = popen(cmd,"r");
	if (fp == NULL) {
		//return scope.Close(String::New("error"));
#ifdef V8_VER_0
		return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
#endif
	}
	while(fgets(buf,sizeof(buf),fp) != NULL) {
	}
	pclose(fp);

	tmp = strtok(buf,"\r\n ");

	for(int i=0;i<20;i++) {
		log.data[i] = strtol(tmp,NULL,0);
		tmp = strtok(NULL,"\r\n ");
		if(tmp == NULL) break;
	}

#ifdef V8_VER_0
	Local<Object> obj = Object::New();

	obj->Set(String::NewSymbol("r"),Integer::New(log.vmstat.r));
	obj->Set(String::NewSymbol("b"),Integer::New(log.vmstat.b));
	obj->Set(String::NewSymbol("swap"),Integer::New(log.vmstat.swap));
	obj->Set(String::NewSymbol("free"),Integer::New(log.vmstat.free));
	obj->Set(String::NewSymbol("buff"),Integer::New(log.vmstat.buff));
	obj->Set(String::NewSymbol("cache"),Integer::New(log.vmstat.cache));
	obj->Set(String::NewSymbol("si"),Integer::New(log.vmstat.si));
	obj->Set(String::NewSymbol("so"),Integer::New(log.vmstat.so));
	obj->Set(String::NewSymbol("bi"),Integer::New(log.vmstat.bi));
	obj->Set(String::NewSymbol("bo"),Integer::New(log.vmstat.bo));
	obj->Set(String::NewSymbol("in"),Integer::New(log.vmstat.in));
	obj->Set(String::NewSymbol("cs"),Integer::New(log.vmstat.cs));
	obj->Set(String::NewSymbol("us"),Integer::New(log.vmstat.us));
	obj->Set(String::NewSymbol("sy"),Integer::New(log.vmstat.sy));
	obj->Set(String::NewSymbol("id"),Integer::New(log.vmstat.id));
	obj->Set(String::NewSymbol("wa"),Integer::New(log.vmstat.wa));
	obj->Set(String::NewSymbol("st"),Integer::New(log.vmstat.st));

	return scope.Close(obj);
#endif
#ifdef V8_VER_5
	Local<Object> obj = Object::New(isolate);

	obj->Set(String::NewFromUtf8(isolate,"r"),Integer::New(isolate,log.vmstat.r));
	obj->Set(String::NewFromUtf8(isolate,"b"),Integer::New(isolate,log.vmstat.b));
	obj->Set(String::NewFromUtf8(isolate,"swap"),Integer::New(isolate,log.vmstat.swap));
	obj->Set(String::NewFromUtf8(isolate,"free"),Integer::New(isolate,log.vmstat.free));
	obj->Set(String::NewFromUtf8(isolate,"buff"),Integer::New(isolate,log.vmstat.buff));
	obj->Set(String::NewFromUtf8(isolate,"cache"),Integer::New(isolate,log.vmstat.cache));
	obj->Set(String::NewFromUtf8(isolate,"si"),Integer::New(isolate,log.vmstat.si));
	obj->Set(String::NewFromUtf8(isolate,"so"),Integer::New(isolate,log.vmstat.so));
	obj->Set(String::NewFromUtf8(isolate,"bi"),Integer::New(isolate,log.vmstat.bi));
	obj->Set(String::NewFromUtf8(isolate,"bo"),Integer::New(isolate,log.vmstat.bo));
	obj->Set(String::NewFromUtf8(isolate,"in"),Integer::New(isolate,log.vmstat.in));
	obj->Set(String::NewFromUtf8(isolate,"cs"),Integer::New(isolate,log.vmstat.cs));
	obj->Set(String::NewFromUtf8(isolate,"us"),Integer::New(isolate,log.vmstat.us));
	obj->Set(String::NewFromUtf8(isolate,"sy"),Integer::New(isolate,log.vmstat.sy));
	obj->Set(String::NewFromUtf8(isolate,"id"),Integer::New(isolate,log.vmstat.id));
	obj->Set(String::NewFromUtf8(isolate,"wa"),Integer::New(isolate,log.vmstat.wa));
	obj->Set(String::NewFromUtf8(isolate,"st"),Integer::New(isolate,log.vmstat.st));

	args.GetReturnValue().Set(obj);
	return ;
#endif
}

//void init(Local<Object> target) {
#ifdef V8_VER_0
void Init(Handle<Object> target) {
#endif
#ifdef V8_VER_5
void Init(Local<Object> target) {
	target->GetIsolate();
#endif

	NODE_SET_METHOD(target, "get_vmstat",get_vmstat);
}

NODE_MODULE(get_vmstat,Init)

