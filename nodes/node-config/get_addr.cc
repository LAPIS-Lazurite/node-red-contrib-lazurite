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

#if (V8_MAJOR_VERSION >= 4)
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
Handle<Value> get_ipv4(const Arguments& args) {
	HandleScope scope;
#endif
#ifdef V8_VER_5
void get_ipv4(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
#endif
	FILE *fp;
	char cmd[256];
	char buf[256];

	String::Utf8Value net(args[0]->ToString());

	sprintf(cmd,"ifconfig %s | awk '/inet/{split($1,ary,\":\");if(ary[2] != \"\") {print(ary[2])}}'\n",ToCString(net));
	fp = popen(cmd,"r");
	if (fp == NULL) {
#ifdef V8_VER_0
		return scope.Close(String::New("error"));
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
#endif
	}
	while(fgets(buf,sizeof(buf),fp) != NULL) {
	}
	pclose(fp);
	
	strtok(buf,"\r\n");
	
#ifdef V8_VER_0
	return scope.Close(String::New(buf));
#endif
#ifdef V8_VER_5
	args.GetReturnValue().Set(String::NewFromUtf8(isolate,buf));
	return;
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
	NODE_SET_METHOD(target, "get_ipv4", get_ipv4);
}

NODE_MODULE(get_addr,Init)

