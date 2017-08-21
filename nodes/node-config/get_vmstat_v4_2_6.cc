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

using namespace v8;
using namespace std;

const char* ToCString(const String::Utf8Value& value) {
	return *value ? *value : "<string conversion failed>";
}
void get_vmstat(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

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
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
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
}

//void init(Local<Object> target) {
void Init(Local<Object> exports, Local<Object> module) {
	NODE_SET_METHOD(module, "get_vmstat",get_vmstat);
}

NODE_MODULE(get_vmstat,Init)

