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
//#include <v8.h>
#include "liblazurite.h"
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
int (*setbroadcast)(bool);
int (*getmyaddr64)(uint8_t*);
int (*setmyaddress)(uint16_t);
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

void dlopen(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

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
			sendfunc64be = (int (*)(uint8_t*, const void*, uint16_t))find(handle, "lazurite_send64be");
			sendfunc64le = (int (*)(uint8_t*, const void*, uint16_t))find(handle, "lazurite_send64le");
			setackreq    = (int (*)(bool))find(handle, "lazurite_setAckReq");
			getmyaddr64    = (int (*)(uint8_t*))find(handle, "lazurite_getMyAddr64");
			setbroadcast = (int (*)(bool))find(handle, "lazurite_setBroadcastEnb");
			setmyaddress = (int (*)(uint16_t))find(handle, "lazurite_setMyAddress");
			setaeskey    = (int (*)(const void*))find(handle, "lazurite_setKey");
			closefunc    = (int (*)(void))dlsym(handle, "lazurite_close");
			removefunc   = (int (*)(void))dlsym(handle, "lazurite_remove");
			opened = true;
		}
	}
	args.GetReturnValue().Set(Boolean::New(isolate,opened));
	return;
}

void lazurite_init(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

	if(!initialized) {
		if(!initfunc) {
			fprintf (stderr, "liblzgw_open fail.\n");
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
		}
		int result = initfunc();
		if(result != 0) {
			fprintf (stderr, "liblzgw_open fail = %d\n", result);
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
		}
		initialized = true;
	}
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
}

void lazurite_begin(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

	if(!began) {
		if(args.Length() < 4) {
			fprintf (stderr, "Wrong number of arguments\n");
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
		}
		if(!beginfunc) {
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
		}

		uint8_t  ch    = args[0]->NumberValue();;
		uint16_t panid = args[1]->NumberValue();;
		uint8_t  rate  = args[2]->NumberValue();;
		uint8_t  pwr   = args[3]->NumberValue();;

		ch = args[0]->NumberValue();
		int result = beginfunc(ch, panid, rate, pwr);
		if(result != 0) {
			fprintf (stderr, "lazurite_begin fail = %d\n",result);
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
		}
		began = true;
	}
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
}

void lazurite_setRxMode(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

	latest = args[0]->BooleanValue();

	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
}

void lazurite_rxEnable(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

	if(!enabled) {
		if(!enablefunc) {
			fprintf (stderr, "lazurite_rxEnable fail.\n");
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
		}
		int result = enablefunc();
		if(result != 0) {
			fprintf (stderr, "lazurite_rxEnable fail = %d\n", result);
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
		}
		enabled = true;
	}
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
}

void lazurite_rxDisable(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

	if(enabled) {
		if(!enablefunc) {
			fprintf (stderr, "lazurite_rxDisable fail.\n");
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
		}
		int result = disablefunc();
		if(result != 0) {
			fprintf (stderr, "lazurite_rxDisable fail = %d\n", result);
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
		}
		enabled = false;
	}
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
}

void lazurite_read(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

	if(!readfunc) {
		fprintf (stderr, "lazurite_read fail.\n");
		args.GetReturnValue().Set(Undefined(isolate));
		return;
	}

	char tmpdata[256];
	char data[256];
	char str[256];
	SUBGHZ_MAC mac;
	Local<Object> obj = Object::New(isolate);

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

			Local<Array> dst_addr = Array::New(isolate,4);
			Local<Array> src_addr = Array::New(isolate,4);
			for(int i=0;i<4;i++)
			{
				int tmp;
				tmp = (unsigned char)mac.dst_addr[i*2+1];
				tmp = (tmp << 8) + (unsigned char)mac.dst_addr[i*2];
				dst_addr->Set(i,Integer::New(isolate,tmp));
				tmp = (unsigned char)mac.src_addr[i*2+1];
				tmp = (tmp << 8) + (unsigned char)mac.src_addr[i*2];
				src_addr->Set(i,Integer::New(isolate,tmp));
			}

			snprintf(str,mac.payload_len+1, "%s", data+mac.payload_offset);
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
		} else {
			obj->Set(String::NewFromUtf8(isolate,"length"),Integer::New(isolate,0));
		}

	} else {
		int tag = 0;
		Local<Array>packet_array = Array::New(isolate);

		while(readfunc(data,&size)>0)
		{
			int rssi;
			time_t sec,nsec;
			Local<Object>packet = Object::New(isolate);

			decmac(&mac,data,size);
			getrxtime(&sec,&nsec);
			rssi=getrxrssi();

			Local<Array> dst_addr = Array::New(isolate,4);
			Local<Array> src_addr = Array::New(isolate,4);
			for(int i=0;i<4;i++)
			{
				int tmp;
				tmp = (unsigned char)mac.dst_addr[i*2+1];
				tmp = (tmp << 8) + (unsigned char)mac.dst_addr[i*2];
				dst_addr->Set(i,Integer::New(isolate,tmp));
				tmp = (unsigned char)mac.src_addr[i*2+1];
				tmp = (tmp << 8) + (unsigned char)mac.src_addr[i*2];
				src_addr->Set(i,Integer::New(isolate,tmp));
			}

			snprintf(str,mac.payload_len+1, "%s", data+mac.payload_offset);

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

			packet_array->Set(tag,packet);
			tag++;
		}

		obj->Set(String::NewFromUtf8(isolate,"payload"),packet_array);
		obj->Set(String::NewFromUtf8(isolate,"length"),Integer::New(isolate,tag));
	}
	args.GetReturnValue().Set(obj);
	return;
}

void lazurite_send(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

	if(args.Length() < 3) {
		fprintf (stderr, "Wrong number of arguments\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	if(!sendfunc) {
		fprintf (stderr, "lazurite_send fail.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}

	uint16_t dst_panid = args[0]->NumberValue();;
	uint16_t dst_addr  = args[1]->NumberValue();;
	String::Utf8Value payload(args[2]->ToString());

	int result = sendfunc(dst_panid, dst_addr, ToCString(payload), payload.length());
	if(result < 0) {
		fprintf (stderr, "tx error = %d\n",result);
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}

	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
}

void lazurite_send64be(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

	if(args.Length() < 2) {
		fprintf (stderr, "Wrong number of arguments\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	if(!sendfunc64le) {
		fprintf (stderr, "lazurite_send64be fail.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	Local<Array> arr = Local<Array>::Cast(args[0]);
	if(arr->Length() != 8) {
		fprintf (stderr, "lazurite_send64be address.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
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

	int result = sendfunc64be(dst_addr, ToCString(payload), payload.length());
	if(result < 0) {
		fprintf (stderr, "tx64be error = %d\n",result);
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
}

void lazurite_send64le(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

	if(args.Length() < 2) {
		fprintf (stderr, "Wrong number of arguments\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	if(!sendfunc64le) {
		fprintf (stderr, "lazurite_send64le fail.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	Local<Array> arr = Local<Array>::Cast(args[0]);
	if(arr->Length() != 8) {
		fprintf (stderr, "lazurite_send64le address.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
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

	int result = sendfunc64le(dst_addr, ToCString(payload), payload.length());
	if(result < 0) {
		fprintf (stderr, "tx64le error = %d\n",result);
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
}

void lazurite_setAckReq(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

	if(args.Length() < 1) {
		fprintf (stderr, "Wrong number of arguments\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	if(!setackreq) {
		fprintf (stderr, "lazurite_setAckReq fail.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	bool ackreq = args[0]->BooleanValue();;
	if(setackreq(ackreq) != 0){
		fprintf (stderr, "lazurite_setAckReq exe error.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
}

void lazurite_setBroadcastEnb(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

	if(args.Length() < 1) {
		fprintf (stderr, "Wrong number of arguments\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	if(!setbroadcast) {
		fprintf (stderr, "lazurite_setBroadcastEnb fail.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	bool broadcast = args[0]->BooleanValue();;
	if(setbroadcast(broadcast) != 0){
		fprintf (stderr, "lazurite_setBroadcastEnb exe error.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
}

void lazurite_setMyAddress(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

	if(args.Length() < 1) {
		fprintf (stderr, "Wrong number of arguments\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	if(!setmyaddress) {
		fprintf (stderr, "lazurite_setMyAddress fail.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	uint16_t myaddress = args[0]->NumberValue();;
	if(setmyaddress(myaddress) != 0){
		fprintf (stderr, "lazurite_setMyAddress exe error.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
}

void lazurite_getMyAddr64(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

	uint8_t myaddr[8];
	if(!getmyaddr64) {
		fprintf (stderr, "lazurite_setMyAddress fail.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	if(getmyaddr64(myaddr) != 0){
		fprintf (stderr, "lazurite_setMyAddress exe error.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}

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
}

void lazurite_setKey(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

	if(args.Length() < 1) {
		fprintf (stderr, "Wrong number of arguments\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	if(!setaeskey) {
		fprintf (stderr, "lazurite_setKey fail.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	String::Utf8Value key(args[0]->ToString());
	if(key.length() != 32) {
		fprintf (stderr, "lazurite_setKey length error.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	if(setaeskey(ToCString(key)) != 0){
		fprintf (stderr, "lazurite_setKey error.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
}

void lazurite_close(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

	if(began) {
		if(!closefunc) {
			fprintf (stderr, "fail to stop RF");
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
		}
		int result = closefunc();
		if(result != 0) {
			fprintf (stderr, "fail to stop RF %d", result);
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
		}
		began = false;
	}
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
}

void lazurite_remove(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

	if(initialized) {
		if(!removefunc) {
			fprintf (stderr, "remove driver from kernel");
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
		}
		int result = removefunc();
		if(result != 0) {
			fprintf (stderr, "remove driver from kernel %d", result);
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
		}
		initialized = false;
	}
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
}

void dlclose(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

	if(opened) {
		if(handle) { dlclose(handle); }
		initfunc   = NULL;
		beginfunc  = NULL;
		enablefunc = NULL;
		readfunc   = NULL;
		closefunc  = NULL;
		removefunc = NULL;

		opened = false;
		initialized = false;
		began = false;
		enabled = false;
	}
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
}

void Init(Local<Object> exports) {
	exports->GetIsolate();
	NODE_SET_METHOD(exports, "dlopen", dlopen);
	NODE_SET_METHOD(exports, "lazurite_init", lazurite_init);
	NODE_SET_METHOD(exports, "lazurite_setRxMode", lazurite_setRxMode);
	NODE_SET_METHOD(exports, "lazurite_begin", lazurite_begin);
	NODE_SET_METHOD(exports, "lazurite_rxEnable", lazurite_rxEnable);
	NODE_SET_METHOD(exports, "lazurite_rxDisable", lazurite_rxDisable);
	NODE_SET_METHOD(exports, "lazurite_read", lazurite_read);
	NODE_SET_METHOD(exports, "lazurite_send", lazurite_send);
	NODE_SET_METHOD(exports, "lazurite_send64le", lazurite_send64le);
	NODE_SET_METHOD(exports, "lazurite_send64be", lazurite_send64be);
	NODE_SET_METHOD(exports, "lazurite_setAckReq", lazurite_setAckReq);
	NODE_SET_METHOD(exports, "lazurite_setBroadcastEnb", lazurite_setBroadcastEnb);
	NODE_SET_METHOD(exports, "lazurite_setMyAddress", lazurite_setMyAddress);
	NODE_SET_METHOD(exports, "lazurite_getMyAddr64", lazurite_getMyAddr64);
	NODE_SET_METHOD(exports, "lazurite_setKey", lazurite_setKey);
	NODE_SET_METHOD(exports, "lazurite_close", lazurite_close);
	NODE_SET_METHOD(exports, "lazurite_remove", lazurite_remove);
	NODE_SET_METHOD(exports, "dlclose", dlclose);
}

NODE_MODULE(lazurite_wrap, Init)

