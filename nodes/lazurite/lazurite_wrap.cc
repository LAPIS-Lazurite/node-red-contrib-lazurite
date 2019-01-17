/*
 *  Copyright (C) 2016 Lapis Semiconductor Co., Ltd.
 *  file: lazurite_wrap.cc
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
#include "liblazurite.h"

#if (V8_MAJOR_VERSION >= 4)
	#define V8_VER_5
#else
	#define V8_VER_0
#endif

using namespace v8;
using namespace lazurite;

void *handle;

typedef void (*funcptr)(void);

int (*initfunc)(void);
int (*beginfunc)(uint8_t, uint16_t, uint8_t,uint8_t);
int (*enablefunc)(void);
int (*disablefunc)(void);
int (*readfunc)(char*, uint16_t*);
int (*decmac)(SUBGHZ_MAC*,void*, uint16_t);
int (*getrxrssi)(void);
int (*getrxtime)(time_t*, time_t*);
int (*sendfunc)(uint16_t, uint16_t, const void*, uint16_t);
int (*sendfunc64le)(uint8_t*, const void*, uint16_t);
int (*sendfunc64be)(uint8_t*, const void*, uint16_t);
int (*setackreq)(bool);
int (*seteack)(uint8_t*, uint16_t);
int (*geteack)(char*, uint16_t*);
int (*setbroadcast)(bool);
int (*setmyaddress)(uint16_t);
int (*getmyaddr64)(uint8_t*);
int (*setaeskey)(const void*);
int (*closefunc)(void);
int (*removefunc)(void);

bool opened = false;
bool initialized = false;
bool began = false;
bool enabled = false;
bool latest=false;

const char* ToCString(const String::Utf8Value& value) {
	return *value ? *value : "<string conversion failed>";
}

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

#ifdef V8_VER_0
static Handle<Value> dlopen(const Arguments& args) {
	HandleScope scope;
#endif
#ifdef V8_VER_5
static void dlopen(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
#endif

	if(!opened) {
		handle = dlopen ("liblazurite.so", RTLD_LAZY);
		if (!handle) {
			fprintf (stderr, "%s\n", dlerror());
		} else {
			initfunc     = (int (*)(void))find(handle, "lazurite_init");
			beginfunc    = (int (*)(uint8_t, uint16_t, uint8_t,uint8_t))find(handle, "lazurite_begin");
			enablefunc   = (int (*)(void))find(handle, "lazurite_rxEnable");
			disablefunc  = (int (*)(void))find(handle, "lazurite_rxDisable");
			readfunc     = (int (*)(char*, uint16_t*))find(handle, "lazurite_read");
			decmac       = (int (*)(SUBGHZ_MAC*,void*, uint16_t))find(handle, "lazurite_decMac");
			getrxtime    = (int (*)(time_t*, time_t*))find(handle, "lazurite_getRxTime");
			getrxrssi    = (int (*)(void))find(handle, "lazurite_getRxRssi");
			sendfunc     = (int (*)(uint16_t, uint16_t, const void*, uint16_t))find(handle, "lazurite_send");
			sendfunc64le = (int (*)(uint8_t*, const void*, uint16_t))find(handle, "lazurite_send64le");
			sendfunc64be = (int (*)(uint8_t*, const void*, uint16_t))find(handle, "lazurite_send64be");
			setackreq    = (int (*)(bool))find(handle, "lazurite_setAckReq");
			seteack    = (int (*)(uint8_t*, uint16_t))find(handle, "lazurite_setEnhanceAck");
			geteack    = (int (*)(char*, uint16_t*))find(handle, "lazurite_getEnhanceAck");
			setbroadcast = (int (*)(bool))find(handle, "lazurite_setBroadcastEnb");
			setmyaddress = (int (*)(uint16_t))find(handle, "lazurite_setMyAddress");
			getmyaddr64    = (int (*)(uint8_t*))find(handle, "lazurite_getMyAddr64");
			setaeskey    = (int (*)(const void*))find(handle, "lazurite_setKey");
			closefunc    = (int (*)(void))dlsym(handle, "lazurite_close");
			removefunc   = (int (*)(void))dlsym(handle, "lazurite_remove");
			opened = true;
		}
	}
#ifdef V8_VER_0
	return scope.Close(Boolean::New(opened));
#endif
#ifdef V8_VER_5
	args.GetReturnValue().Set(Boolean::New(isolate,opened));
	return;
#endif
}

#ifdef V8_VER_0
static Handle<Value> init(const Arguments& args) {
	HandleScope scope;
#endif
#ifdef V8_VER_5
static void init(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
#endif

	if(!initialized) {
		if(!initfunc) {
			fprintf (stderr, "liblzgw_open fail.\n");
#ifdef V8_VER_0
			return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
#endif
		}
		int result = initfunc();
		if(result != 0) {
			fprintf (stderr, "liblzgw_open fail = %d\n", result);
#ifdef V8_VER_0
			return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
#endif
		}
		initialized = true;
	}

#ifdef V8_VER_0
	return scope.Close(Boolean::New(true));
#endif
#ifdef V8_VER_5
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
#endif
}

#ifdef V8_VER_0
static Handle<Value> begin(const Arguments& args) {
	HandleScope scope;
#endif
#ifdef V8_VER_5
static void begin(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
#endif
	if(!began) {
		if(args.Length() < 4) {
			fprintf (stderr, "Wrong number of arguments\n");
#ifdef V8_VER_0
			return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
#endif
		}
		if(!beginfunc) {
			fprintf (stderr, "lazurite_begin fail\n");
#ifdef V8_VER_0
			return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
#endif
		}

		uint8_t  ch    = args[0]->NumberValue();;
		uint16_t panid = args[1]->NumberValue();;
		uint8_t  rate  = args[2]->NumberValue();;
		uint8_t  pwr   = args[3]->NumberValue();;

		ch = args[0]->NumberValue();
		int result = beginfunc(ch, panid, rate, pwr);
		if(result != 0) {
			fprintf (stderr, "lazurite_begin fail = %d\n",result);
#ifdef V8_VER_0
			return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
#endif
		}
		began = true;
	}
#ifdef V8_VER_0
	return scope.Close(Boolean::New(true));
#endif
#ifdef V8_VER_5
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
#endif
}

#ifdef V8_VER_0
static Handle<Value> setRxMode(const Arguments& args) {
	HandleScope scope;
#endif
#ifdef V8_VER_5
static void setRxMode(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
#endif

	latest = args[0]->BooleanValue();
#ifdef V8_VER_0
	return scope.Close(Boolean::New(true));
#endif
#ifdef V8_VER_5
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
#endif
}

#ifdef V8_VER_0
static Handle<Value> rxEnable(const Arguments& args) {
	HandleScope scope;
#endif
#ifdef V8_VER_5
static void rxEnable(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
#endif

	if(!enabled) {
		if(!enablefunc) {
			fprintf (stderr, "lazurite_rxEnable fail.\n");
#ifdef V8_VER_0
			return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
#endif
		}
		int result = enablefunc();
		if(result != 0) {
			fprintf (stderr, "lazurite_rxEnable fail = %d\n", result);
#ifdef V8_VER_0
			return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
#endif
		}
		enabled = true;
	}
#ifdef V8_VER_0
	return scope.Close(Boolean::New(true));
#endif
#ifdef V8_VER_5
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
#endif
}

#ifdef V8_VER_0
static Handle<Value> rxDisable(const Arguments& args) {
	HandleScope scope;
#endif
#ifdef V8_VER_5
static void rxDisable(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
#endif

	if(enabled) {
		if(!enablefunc) {
			fprintf (stderr, "lazurite_rxDisable fail.\n");
#ifdef V8_VER_0
			return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
#endif
		}
		int result = disablefunc();
		if(result != 0) {
			fprintf (stderr, "lazurite_rxDisable fail = %d\n", result);
#ifdef V8_VER_0
			return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
#endif
		}
		enabled = false;
	}
#ifdef V8_VER_0
	return scope.Close(Boolean::New(true));
#endif
#ifdef V8_VER_5
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
#endif
}

#ifdef V8_VER_0
static Handle<Value> read(const Arguments& args) {
	HandleScope scope;
#endif
#ifdef V8_VER_5
static void read(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
#endif
	if(!readfunc) {
		fprintf (stderr, "lazurite_read fail.\n");
#ifdef V8_VER_0
		return scope.Close(Undefined());
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(Undefined(isolate));
		return;
#endif
	}

	char tmpdata[256];
	char data[256];
	char str[256];
	SUBGHZ_MAC mac;

#ifdef V8_VER_0
	Local<Object> obj = Object::New();
#endif
#ifdef V8_VER_5
	Local<Object> obj = Object::New(isolate);
#endif
	uint16_t size=0;
	uint16_t tmpsize=0;
	bool data_valid=false;

	memset(tmpdata,0,sizeof(tmpdata));

	if(latest)
	{
		while(readfunc(tmpdata,&tmpsize)>0)
		{
			data_valid=true;
			memcpy(data,tmpdata,sizeof(data));
			memset(tmpdata,0,sizeof(tmpdata));
			size=tmpsize;
		}
		if(data_valid ) {
			int rssi;
			time_t sec,nsec;
			decmac(&mac,data,size);
			getrxtime(&sec,&nsec);
			rssi=getrxrssi();

#ifdef V8_VER_0
			Local<Array> dst_addr = Array::New(4);
			Local<Array> src_addr = Array::New(4);
#endif
#ifdef V8_VER_5
			Local<Array> dst_addr = Array::New(isolate,4);
			Local<Array> src_addr = Array::New(isolate,4);
#endif
			for(int i=0;i<4;i++)
			{
				int tmp;
				tmp = (unsigned char)mac.dst_addr[i*2+1];
				tmp = (tmp << 8) + (unsigned char)mac.dst_addr[i*2];
#ifdef V8_VER_0
				dst_addr->Set(i,Integer::New(tmp));
#endif
#ifdef V8_VER_5
				dst_addr->Set(i,Integer::New(isolate,tmp));
#endif
				tmp = (unsigned char)mac.src_addr[i*2+1];
				tmp = (tmp << 8) + (unsigned char)mac.src_addr[i*2];
#ifdef V8_VER_0
				src_addr->Set(i,Integer::New(tmp));
#endif
#ifdef V8_VER_5
				src_addr->Set(i,Integer::New(isolate,tmp));
#endif
			}

			snprintf(str,mac.payload_len+1, "%s", data+mac.payload_offset);
#ifdef V8_VER_0
			obj->Set(String::NewSymbol("header"),Integer::New(mac.header));
			obj->Set(String::NewSymbol("seq_num"),Integer::New(mac.seq_num));
			obj->Set(String::NewSymbol("dst_panid"),Integer::New(mac.dst_panid));
			obj->Set(String::NewSymbol("dst_addr"),dst_addr);
			obj->Set(String::NewSymbol("src_panid"),Integer::New(mac.src_panid));
			obj->Set(String::NewSymbol("src_addr"),src_addr);
			obj->Set(String::NewSymbol("sec"),Uint32::New(sec));
			obj->Set(String::NewSymbol("nsec"),Uint32::New(nsec));
			obj->Set(String::NewSymbol("payload"),String::New(str));
			obj->Set(String::NewSymbol("rssi"),Integer::New(rssi));
			obj->Set(String::NewSymbol("length"),Integer::New(mac.payload_len));
#endif
#ifdef V8_VER_5
			obj->Set(String::NewFromUtf8(isolate,"header"),Integer::New(isolate,mac.header));
			obj->Set(String::NewFromUtf8(isolate,"seq_num"),Integer::New(isolate,mac.seq_num));
			obj->Set(String::NewFromUtf8(isolate,"dst_panid"),Integer::New(isolate,mac.dst_panid));
			obj->Set(String::NewFromUtf8(isolate,"dst_addr"),dst_addr);
			obj->Set(String::NewFromUtf8(isolate,"src_panid"),Integer::New(isolate,mac.src_panid));
			obj->Set(String::NewFromUtf8(isolate,"src_addr"),src_addr);
			obj->Set(String::NewFromUtf8(isolate,"sec"),Uint32::New(isolate,sec));
			obj->Set(String::NewFromUtf8(isolate,"nsec"),Uint32::New(isolate,nsec));
			obj->Set(String::NewFromUtf8(isolate,"payload"),String::NewFromUtf8(isolate,str));
			obj->Set(String::NewFromUtf8(isolate,"rssi"),Integer::New(isolate,rssi));
			obj->Set(String::NewFromUtf8(isolate,"length"),Integer::New(isolate,mac.payload_len));
#endif
		} else {
#ifdef V8_VER_0
			obj->Set(String::NewSymbol("length"),Integer::New(0));
#endif
#ifdef V8_VER_5
			obj->Set(String::NewFromUtf8(isolate,"length"),Integer::New(isolate,0));
#endif
		}

	} else {
		int tag = 0;
#ifdef V8_VER_0
		Local<Array>packet_array = Array::New();
#endif
#ifdef V8_VER_5
		Local<Array>packet_array = Array::New(isolate);
#endif

		while(readfunc(data,&size)>0)
		{
			int rssi;
			time_t sec,nsec;
#ifdef V8_VER_0
			Local<Object>packet = Object::New();
#endif
#ifdef V8_VER_5
			Local<Object>packet = Object::New(isolate);
#endif
			decmac(&mac,data,size);
			getrxtime(&sec,&nsec);
			rssi=getrxrssi();

#ifdef V8_VER_0
			Local<Array> dst_addr = Array::New(4);
			Local<Array> src_addr = Array::New(4);
#endif
#ifdef V8_VER_5
			Local<Array> dst_addr = Array::New(isolate,4);
			Local<Array> src_addr = Array::New(isolate,4);
#endif
			for(int i=0;i<4;i++)
			{
				int tmp;
				tmp = (unsigned char)mac.dst_addr[i*2+1];
				tmp = (tmp << 8) + (unsigned char)mac.dst_addr[i*2];
#ifdef V8_VER_0
				dst_addr->Set(i,Integer::New(tmp));
#endif
#ifdef V8_VER_5
				dst_addr->Set(i,Integer::New(isolate,tmp));
#endif
				tmp = (unsigned char)mac.src_addr[i*2+1];
				tmp = (tmp << 8) + (unsigned char)mac.src_addr[i*2];
#ifdef V8_VER_0
				src_addr->Set(i,Integer::New(tmp));
#endif
#ifdef V8_VER_5
				src_addr->Set(i,Integer::New(isolate,tmp));
#endif
			}

			snprintf(str,mac.payload_len+1, "%s", data+mac.payload_offset);

#ifdef V8_VER_0
			packet->Set(String::NewSymbol("tag"),Integer::New(tag));
			packet->Set(String::NewSymbol("header"),Integer::New(mac.header));
			packet->Set(String::NewSymbol("seq_num"),Integer::New(mac.seq_num));
			packet->Set(String::NewSymbol("dst_panid"),Integer::New(mac.dst_panid));
			packet->Set(String::NewSymbol("dst_addr"),dst_addr);
			packet->Set(String::NewSymbol("src_panid"),Integer::New(mac.src_panid));
			packet->Set(String::NewSymbol("src_addr"),src_addr);
			packet->Set(String::NewSymbol("sec"),Uint32::New(sec));
			packet->Set(String::NewSymbol("nsec"),Uint32::New(nsec));
			packet->Set(String::NewSymbol("payload"),String::New(str));
			packet->Set(String::NewSymbol("rssi"),Integer::New(rssi));
			packet->Set(String::NewSymbol("length"),Integer::New(mac.payload_len));
#endif
#ifdef V8_VER_5
			packet->Set(String::NewFromUtf8(isolate,"tag"),Integer::New(isolate,tag));
			packet->Set(String::NewFromUtf8(isolate,"header"),Integer::New(isolate,mac.header));
			packet->Set(String::NewFromUtf8(isolate,"seq_num"),Integer::New(isolate,mac.seq_num));
			packet->Set(String::NewFromUtf8(isolate,"dst_panid"),Integer::New(isolate,mac.dst_panid));
			packet->Set(String::NewFromUtf8(isolate,"dst_addr"),dst_addr);
			packet->Set(String::NewFromUtf8(isolate,"src_panid"),Integer::New(isolate,mac.src_panid));
			packet->Set(String::NewFromUtf8(isolate,"src_addr"),src_addr);
			packet->Set(String::NewFromUtf8(isolate,"sec"),Uint32::New(isolate,sec));
			packet->Set(String::NewFromUtf8(isolate,"nsec"),Uint32::New(isolate,nsec));
			packet->Set(String::NewFromUtf8(isolate,"payload"),String::NewFromUtf8(isolate,str));
			packet->Set(String::NewFromUtf8(isolate,"rssi"),Integer::New(isolate,rssi));
			packet->Set(String::NewFromUtf8(isolate,"length"),Integer::New(isolate,mac.payload_len));
#endif
			packet_array->Set(tag,packet);
			tag++;
		}

#ifdef V8_VER_0
		obj->Set(String::NewSymbol("payload"),packet_array);
		obj->Set(String::NewSymbol("length"),Integer::New(tag));
#endif
#ifdef V8_VER_5
		obj->Set(String::NewFromUtf8(isolate,"payload"),packet_array);
		obj->Set(String::NewFromUtf8(isolate,"length"),Integer::New(isolate,tag));
#endif
	}

#ifdef V8_VER_0
	return scope.Close(obj);
#endif
#ifdef V8_VER_5
	args.GetReturnValue().Set(obj);
	return;
#endif
}

#ifdef V8_VER_0
static Handle<Value> send(const Arguments& args) {
	HandleScope scope;
#endif
#ifdef V8_VER_5
static void send(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
#endif
	if(args.Length() < 3) {
		fprintf (stderr, "Wrong number of arguments\n");
#ifdef V8_VER_0
		return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
#endif
	}
	if(!sendfunc) {
		fprintf (stderr, "lazurite_send fail.\n");
#ifdef V8_VER_0
		return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
#endif
	}

	uint16_t dst_panid = args[0]->NumberValue();;
	uint16_t dst_addr  = args[1]->NumberValue();;
	String::Utf8Value payload(args[2]->ToString());

	int result = sendfunc(dst_panid, dst_addr, ToCString(payload), payload.length()+1);
	if(result < 0) {
		fprintf (stderr, "tx error = %d\n",result);
#ifdef V8_VER_0
		return scope.Close(result);
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(result);
		return;
#endif
	}
#ifdef V8_VER_0
	return scope.Close(0);
#endif
#ifdef V8_VER_5
	args.GetReturnValue().Set(0);
	return;
#endif
}

#ifdef V8_VER_0
static Handle<Value> send64le(const Arguments& args) {
	HandleScope scope;
#endif
#ifdef V8_VER_5
static void send64le(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
#endif

	if(args.Length() < 2) {
		fprintf (stderr, "Wrong number of arguments\n");
#ifdef V8_VER_0
		return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
#endif
	}
	if(!sendfunc64le) {
		fprintf (stderr, "lazurite_send64le fail.\n");
#ifdef V8_VER_0
		return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
#endif
	}
    Local<Array> arr = Local<Array>::Cast(args[0]);
    if(arr->Length() != 8) {
		fprintf (stderr, "lazurite_send64le address.\n");
#ifdef V8_VER_0
		return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
#endif
	}
	uint8_t dst_addr[8];
	dst_addr[0] = arr->Get(0)->NumberValue();
	dst_addr[1] = arr->Get(1)->NumberValue();
	dst_addr[2] = arr->Get(2)->NumberValue();
	dst_addr[3] = arr->Get(3)->NumberValue();
	dst_addr[4] = arr->Get(4)->NumberValue();
	dst_addr[5] = arr->Get(5)->NumberValue();
	dst_addr[6] = arr->Get(6)->NumberValue();
	dst_addr[7] = arr->Get(7)->NumberValue();

	String::Utf8Value payload(args[1]->ToString());

	int result = sendfunc64le(dst_addr, ToCString(payload), payload.length()+1);
	if(result < 0) {
		fprintf (stderr, "tx64be error = %d\n",result);
#ifdef V8_VER_0
		return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
#endif
	}
#ifdef V8_VER_0
	return scope.Close(Boolean::New(true));
#endif
#ifdef V8_VER_5
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
#endif
}


#ifdef V8_VER_0
static Handle<Value> send64be(const Arguments& args) {
	HandleScope scope;
#endif
#ifdef V8_VER_5
static void send64be(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
#endif

	if(args.Length() < 2) {
		fprintf (stderr, "Wrong number of arguments\n");
#ifdef V8_VER_0
		return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
#endif
	}
	if(!sendfunc64le) {
		fprintf (stderr, "lazurite_send64be fail.\n");
#ifdef V8_VER_0
		return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
#endif
	}
    Local<Array> arr = Local<Array>::Cast(args[0]);
    if(arr->Length() != 8) {
		fprintf (stderr, "lazurite_send64be address.\n");
#ifdef V8_VER_0
		return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
#endif
	}
	uint8_t dst_addr[8];
	dst_addr[0] = arr->Get(0)->NumberValue();
	dst_addr[1] = arr->Get(1)->NumberValue();
	dst_addr[2] = arr->Get(2)->NumberValue();
	dst_addr[3] = arr->Get(3)->NumberValue();
	dst_addr[4] = arr->Get(4)->NumberValue();
	dst_addr[5] = arr->Get(5)->NumberValue();
	dst_addr[6] = arr->Get(6)->NumberValue();
	dst_addr[7] = arr->Get(7)->NumberValue();

	String::Utf8Value payload(args[1]->ToString());

	int result = sendfunc64be(dst_addr, ToCString(payload), payload.length()+1);
	if(result < 0) {
		fprintf (stderr, "tx64be error = %d\n",result);
#ifdef V8_VER_0
		return scope.Close(result);
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(result);
		return;
#endif
	}
#ifdef V8_VER_0
	return scope.Close(0);
#endif
#ifdef V8_VER_5
	args.GetReturnValue().Set(0);
	return;
#endif
}

#ifdef V8_VER_0
static Handle<Value> setAckReq(const Arguments& args) {
	HandleScope scope;
#endif
#ifdef V8_VER_5
static void setAckReq(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
#endif

	if(args.Length() < 1) {
		fprintf (stderr, "Wrong number of arguments\n");
#ifdef V8_VER_0
		return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
#endif
	}
	if(!setackreq) {
		fprintf (stderr, "lazurite_setAckReq fail.\n");
#ifdef V8_VER_0
		return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
#endif
	}
	bool ackreq = args[0]->BooleanValue();;
	if(setackreq(ackreq) != 0){
		fprintf (stderr, "lazurite_setAckReq exe error.\n");
#ifdef V8_VER_0
		return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
#endif
	}
#ifdef V8_VER_0
	return scope.Close(Boolean::New(true));
#endif
#ifdef V8_VER_5
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
#endif
}


#ifdef V8_VER_0
static Handle<Value> setEnhanceAck(const Arguments& args) {
	HandleScope scope;
#endif
#ifdef V8_VER_5
static void setEnhanceAck(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
#endif

	if(args.Length() < 1) {
		fprintf (stderr, "Wrong number of arguments\n");
#ifdef V8_VER_0
		return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
#endif
	}
	if(!seteack) {
		fprintf (stderr, "lazurite_setEnhanceAck fail.\n");
#ifdef V8_VER_0
		return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
#endif
	}

	Local<Array> payload = Local<Array>::Cast(args[0]);
	uint16_t size  = args[1]->NumberValue();;

	uint16_t i;
	uint8_t data[size];

	//  fprintf (stderr, "DEBUG lazurite_wrap: Size:%d\n",size);
	for (i=0;i<size;i++){
		data[i] = payload->Get(i)->NumberValue();
		//      fprintf (stderr, "DEBUG lazurite_wrap: %d:%d\n",data[i],i);
	}
	if(seteack(data,size) != 0) {
		fprintf (stderr, "lazurite_setEnhanceAck exe error.\n");
#ifdef V8_VER_0
		return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
#endif
	}
#ifdef V8_VER_0
	return scope.Close(Boolean::New(true));
#endif
#ifdef V8_VER_5
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
#endif
}

#ifdef V8_VER_0
static Handle<Value> getEnhanceAck(const Arguments& args) {
	HandleScope scope;
#endif
#ifdef V8_VER_5
	static void getEnhanceAck(const FunctionCallbackInfo<Value>& args) {
		Isolate* isolate = args.GetIsolate();
#endif
		if(!geteack) {
			fprintf (stderr, "lazurite_getEnhanceAck fail.\n");
#ifdef V8_VER_0
			return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
#endif
		}

#ifdef V8_VER_0
		Local<Object> obj = Object::New();
#endif
#ifdef V8_VER_5
		Local<Object> obj = Object::New(isolate);
#endif

		char data[256];
		uint16_t size=0;
		int i;
		Local<Array> str = Array::New(isolate,size);

		memset(data,0,sizeof(data));

		if(geteack(data,&size) != 0){
			fprintf (stderr, "lazurite_getEnhanceAck exe error.\n");
#ifdef V8_VER_0
			return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
#endif
		}

		for (i=0; i < size; i++){
			//      fprintf (stderr, "DEBUG lazurite_wrap: Data:%x, Size:%ld\n",data[i],size);
			str->Set(i,Integer::New(isolate,data[i]));
		}

#ifdef V8_VER_0
		obj->Set(String::NewSymbol("payload"),str);
		obj->Set(String::NewSymbol("length"),Integer::New(size));
#endif
#ifdef V8_VER_5
		obj->Set(String::NewFromUtf8(isolate,"payload"),str);
		obj->Set(String::NewFromUtf8(isolate,"length"),Integer::New(isolate,size));
#endif

#ifdef V8_VER_0
		return scope.Close(obj);
#endif
#ifdef V8_VER_5
		args.GetReturnValue().Set(obj);
		return;
#endif
	}

#ifdef V8_VER_0
	static Handle<Value> setBroadcastEnb(const Arguments& args) {
		HandleScope scope;
#endif
#ifdef V8_VER_5
		static void setBroadcastEnb(const FunctionCallbackInfo<Value>& args) {
			Isolate* isolate = args.GetIsolate();
#endif
			if(args.Length() < 1) {
				fprintf (stderr, "Wrong number of arguments\n");
#ifdef V8_VER_0
				return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
				args.GetReturnValue().Set(Boolean::New(isolate,false));
				return;
#endif
			}
			if(!setbroadcast) {
				fprintf (stderr, "lazurite_setBroadcastEnb fail.\n");
#ifdef V8_VER_0
				return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
				args.GetReturnValue().Set(Boolean::New(isolate,false));
				return;
#endif
			}
			bool broadcast = args[0]->BooleanValue();;
			if(setbroadcast(broadcast) != 0){
				fprintf (stderr, "lazurite_setBroadcastEnb exe error.\n");
#ifdef V8_VER_0
				return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
				args.GetReturnValue().Set(Boolean::New(isolate,false));
				return;
#endif
			}
#ifdef V8_VER_0
			return scope.Close(Boolean::New(true));
#endif
#ifdef V8_VER_5
			args.GetReturnValue().Set(Boolean::New(isolate,true));
			return;
#endif
		}

#ifdef V8_VER_0
		static Handle<Value> setMyAddress(const Arguments& args) {
			HandleScope scope;
#endif
#ifdef V8_VER_5
			static void setMyAddress(const FunctionCallbackInfo<Value>& args) {
				Isolate* isolate = args.GetIsolate();
#endif
				if(args.Length() < 1) {
					fprintf (stderr, "Wrong number of arguments\n");
#ifdef V8_VER_0
					return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
					args.GetReturnValue().Set(Boolean::New(isolate,false));
					return;
#endif
				}
				if(!setmyaddress) {
					fprintf (stderr, "lazurite_setMyAddress fail.\n");
#ifdef V8_VER_0
					return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
					args.GetReturnValue().Set(Boolean::New(isolate,false));
					return;
#endif
				}
				uint16_t myaddress = args[0]->NumberValue();;
				if(setmyaddress(myaddress) != 0){
					fprintf (stderr, "lazurite_setMyAddress exe error.\n");
#ifdef V8_VER_0
					return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
					args.GetReturnValue().Set(Boolean::New(isolate,false));
					return;
#endif
				}
#ifdef V8_VER_0
				return scope.Close(Boolean::New(true));
#endif
#ifdef V8_VER_5
				args.GetReturnValue().Set(Boolean::New(isolate,true));
				return;
#endif
			}

#ifdef V8_VER_0
			static Handle<Value> getMyAddr64(const Arguments& args) {
				HandleScope scope;
#endif
#ifdef V8_VER_5
				void getMyAddr64(const FunctionCallbackInfo<Value>& args) {
					Isolate* isolate = args.GetIsolate();
#endif

					uint8_t myaddr[8];
					if(!getmyaddr64) {
						fprintf (stderr, "lazurite_setMyAddress fail.\n");
#ifdef V8_VER_0
						return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
						args.GetReturnValue().Set(Boolean::New(isolate,false));
						return;
#endif
					}
					if(getmyaddr64(myaddr) != 0){
						fprintf (stderr, "lazurite_setMyAddress exe error.\n");
#ifdef V8_VER_0
						return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
						args.GetReturnValue().Set(Boolean::New(isolate,false));
						return;
#endif
					}

#ifdef V8_VER_0
					Local<Array> addr = Array::New(8);
					addr->Set(0,Integer::New(myaddr[0]));
					addr->Set(1,Integer::New(myaddr[1]));
					addr->Set(2,Integer::New(myaddr[2]));
					addr->Set(3,Integer::New(myaddr[3]));
					addr->Set(4,Integer::New(myaddr[4]));
					addr->Set(5,Integer::New(myaddr[5]));
					addr->Set(6,Integer::New(myaddr[6]));
					addr->Set(7,Integer::New(myaddr[7]));

					return scope.Close(addr);
#endif
#ifdef V8_VER_5
					Local<Array> addr = Array::New(isolate,8);
					addr->Set(0,Integer::New(isolate,myaddr[0]));
					addr->Set(1,Integer::New(isolate,myaddr[1]));
					addr->Set(2,Integer::New(isolate,myaddr[2]));
					addr->Set(3,Integer::New(isolate,myaddr[3]));
					addr->Set(4,Integer::New(isolate,myaddr[4]));
					addr->Set(5,Integer::New(isolate,myaddr[5]));
					addr->Set(6,Integer::New(isolate,myaddr[6]));
					addr->Set(7,Integer::New(isolate,myaddr[7]));

					args.GetReturnValue().Set(addr);
					return;
#endif
				}

#ifdef V8_VER_0
				static Handle<Value> setKey(const Arguments& args) {
					HandleScope scope;
#endif
#ifdef V8_VER_5
					static void setKey(const FunctionCallbackInfo<Value>& args) {
						Isolate* isolate = args.GetIsolate();
#endif
						if(args.Length() < 1) {
							fprintf (stderr, "Wrong number of arguments\n");
#ifdef V8_VER_0
							return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
							args.GetReturnValue().Set(Boolean::New(isolate,false));
							return;
#endif
						}
						if(!setaeskey) {
							fprintf (stderr, "lazurite_setKey fail.\n");
#ifdef V8_VER_0
							return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
							args.GetReturnValue().Set(Boolean::New(isolate,false));
							return;
#endif
						}
						String::Utf8Value key(args[0]->ToString());
						if(key.length() != 32) {
							fprintf (stderr, "lazurite_setKey length error.\n");
#ifdef V8_VER_0
							return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
							args.GetReturnValue().Set(Boolean::New(isolate,false));
							return;
#endif
						}
						if(setaeskey(ToCString(key)) != 0){
							fprintf (stderr, "lazurite_setKey error.\n");
#ifdef V8_VER_0
							return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
							args.GetReturnValue().Set(Boolean::New(isolate,false));
							return;
#endif
						}
#ifdef V8_VER_0
						return scope.Close(Boolean::New(true));
#endif
#ifdef V8_VER_5
						args.GetReturnValue().Set(Boolean::New(isolate,true));
						return;
#endif
					}

#ifdef V8_VER_0
					static Handle<Value> close(const Arguments& args) {
						HandleScope scope;
#endif
#ifdef V8_VER_5
						static void close(const FunctionCallbackInfo<Value>& args) {
							Isolate* isolate = args.GetIsolate();
#endif
							if(began) {
								if(!closefunc) {
									fprintf (stderr, "fail to stop RF");
#ifdef V8_VER_0
									return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
									args.GetReturnValue().Set(Boolean::New(isolate,false));
									return;
#endif
								}
								int result = closefunc();
								if(result != 0) {
									fprintf (stderr, "fail to stop RF %d", result);
#ifdef V8_VER_0
									return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
									args.GetReturnValue().Set(Boolean::New(isolate,false));
									return;
#endif
								}
								began = false;
							}
#ifdef V8_VER_0
							return scope.Close(Boolean::New(true));
#endif
#ifdef V8_VER_5
							args.GetReturnValue().Set(Boolean::New(isolate,true));
							return;
#endif
						}

#ifdef V8_VER_0
						static Handle<Value> remove(const Arguments& args) {
							HandleScope scope;
#endif
#ifdef V8_VER_5
							static void remove(const FunctionCallbackInfo<Value>& args) {
								Isolate* isolate = args.GetIsolate();
#endif
								if(initialized) {
									if(!removefunc) {
										fprintf (stderr, "remove driver from kernel");
#ifdef V8_VER_0
										return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
										args.GetReturnValue().Set(Boolean::New(isolate,false));
										return;
#endif
									}
									int result = removefunc();
									if(result != 0) {
										fprintf (stderr, "remove driver from kernel %d", result);
#ifdef V8_VER_0
										return scope.Close(Boolean::New(false));
#endif
#ifdef V8_VER_5
										args.GetReturnValue().Set(Boolean::New(isolate,false));
										return;
#endif
									}
									initialized = false;
								}
#ifdef V8_VER_0
								return scope.Close(Boolean::New(true));
#endif
#ifdef V8_VER_5
								args.GetReturnValue().Set(Boolean::New(isolate,true));
								return;
#endif
							}

#ifdef V8_VER_0
							static Handle<Value> dlclose(const Arguments& args) {
								HandleScope scope;
#endif
#ifdef V8_VER_5
								static void dlclose(const FunctionCallbackInfo<Value>& args) {
									Isolate* isolate = args.GetIsolate();
#endif
									if(opened) {
										if(handle) { dlclose(handle); }
										initfunc   = NULL;
										beginfunc  = NULL;
										enablefunc = NULL;
										readfunc   = NULL;
										closefunc  = NULL;
										removefunc = NULL;
										seteack    = NULL;
										geteack    = NULL;

										opened = false;
										initialized = false;
										began = false;
										enabled = false;
									}
#ifdef V8_VER_0
									return scope.Close(Boolean::New(true));
#endif
#ifdef V8_VER_5
									args.GetReturnValue().Set(Boolean::New(isolate,true));
									return;
#endif
								}

#ifdef V8_VER_0
								static void Init(Handle<Object> target) {
#endif
#ifdef V8_VER_5
									static void Init(Local<Object> target) {
										target->GetIsolate();
#endif

										NODE_SET_METHOD(target, "dlopen", dlopen);
										NODE_SET_METHOD(target, "init", init);
										NODE_SET_METHOD(target, "setRxMode", setRxMode);
										NODE_SET_METHOD(target, "begin", begin);
										NODE_SET_METHOD(target, "rxEnable", rxEnable);
										NODE_SET_METHOD(target, "rxDisable", rxDisable);
										NODE_SET_METHOD(target, "read", read);
										NODE_SET_METHOD(target, "send", send);
										NODE_SET_METHOD(target, "send64le", send64le);
										NODE_SET_METHOD(target, "send64be", send64be);
										NODE_SET_METHOD(target, "setAckReq", setAckReq);
										NODE_SET_METHOD(target, "setEnhanceAck", setEnhanceAck);
										NODE_SET_METHOD(target, "getEnhanceAck", getEnhanceAck);
										NODE_SET_METHOD(target, "setBroadcastEnb", setBroadcastEnb);
										NODE_SET_METHOD(target, "setMyAddress", setMyAddress);
										NODE_SET_METHOD(target, "getMyAddr64", getMyAddr64);
										NODE_SET_METHOD(target, "setKey", setKey);
										NODE_SET_METHOD(target, "close", close);
										NODE_SET_METHOD(target, "remove", remove);
										NODE_SET_METHOD(target, "dlclose", dlclose);
									}

									NODE_MODULE(lazurite_wrap, Init)
