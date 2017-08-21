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
//#include <v8.h>

using namespace v8;
using namespace std;

const char* ToCString(const String::Utf8Value& value) {
  return *value ? *value : "<string conversion failed>";
}

void get_ipv4(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

    String::Utf8Value str(args[0]);
    const char* str_char = ToCString(str);
	Local<Object> obj = Object::New(isolate);

	FILE *fp;
	char cmd[256];
	char buf[256];

	sprintf(cmd,"ifconfig %s | awk '/inet/{split($1,ary,\":\");if(ary[2] != \"\") {print(ary[2])}}'\n",str_char);
	printf("%s¥n",cmd);
	fp = popen(cmd,"r");
	if (fp == NULL) {
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	while(fgets(buf,sizeof(buf),fp) != NULL) {
	}
	pclose(fp);

	strtok(buf,"\r\n");
	Local<String> result = String::NewFromUtf8(isolate,buf);
	obj->Set(String::NewFromUtf8(isolate, "msg"),result);
	args.GetReturnValue().Set(obj);

	return;
}

//void init(Local<Object> target) {
void Init(Local<Object> exports, Local<Object> module) {
	NODE_SET_METHOD(module, "get_ipv4", get_ipv4);
}

NODE_MODULE(get_ipv4, Init)

