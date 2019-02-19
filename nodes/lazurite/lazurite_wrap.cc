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

#if (V8_MAJOR_VERSION >= 6)
#define V8_VER_6
#elif (V8_MAJOR_VERSION >= 4)
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
int (*gettxrssi)(void);
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

static void dlopen(const FunctionCallbackInfo<Value>& args) {
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
			gettxrssi    = (int (*)(void))find(handle, "lazurite_getTxRssi");
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
	args.GetReturnValue().Set(Boolean::New(isolate,opened));
	return;
}

static void init(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

	printf("v8 version:: %d\n",V8_MAJOR_VERSION);

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

static void begin(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
#ifdef V8_VER_6
	Local<Context> context = isolate->GetCurrentContext();
#endif
	if(!began) {
		if(args.Length() < 4) {
			fprintf (stderr, "Wrong number of arguments\n");
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
		}
		if(!beginfunc) {
			fprintf (stderr, "lazurite_begin fail\n");
			args.GetReturnValue().Set(Boolean::New(isolate,false));
			return;
		}

#ifdef V8_VER_6
		uint8_t  ch    = args[0]->NumberValue(context).FromMaybe(0);
		uint16_t panid = args[1]->NumberValue(context).FromMaybe(0);
		uint8_t  rate  = args[2]->NumberValue(context).FromMaybe(0);
		uint8_t  pwr   = args[3]->NumberValue(context).FromMaybe(0);
#else
		uint8_t  ch    = args[0]->NumberValue();
		uint16_t panid = args[1]->NumberValue();
		uint8_t  rate  = args[2]->NumberValue();
		uint8_t  pwr   = args[3]->NumberValue();
#endif

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

static void setRxMode(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();

	latest = args[0]->BooleanValue();
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
}

static void rxEnable(const FunctionCallbackInfo<Value>& args) {
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

static void rxDisable(const FunctionCallbackInfo<Value>& args) {
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

static void read(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
	if(!readfunc) {
		fprintf (stderr, "lazurite_read fail.\n");
		args.GetReturnValue().Set(Undefined(isolate));
		return;
	}

	bool binary = args[0]->BooleanValue();;
	char tmpdata[256];
	char data[256];
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

			obj->Set(String::NewFromUtf8(isolate,"header"),Integer::New(isolate,mac.header));
			obj->Set(String::NewFromUtf8(isolate,"seq_num"),Integer::New(isolate,mac.seq_num));
			obj->Set(String::NewFromUtf8(isolate,"dst_panid"),Integer::New(isolate,mac.dst_panid));
			obj->Set(String::NewFromUtf8(isolate,"dst_addr"),dst_addr);
			obj->Set(String::NewFromUtf8(isolate,"src_panid"),Integer::New(isolate,mac.src_panid));
			obj->Set(String::NewFromUtf8(isolate,"src_addr"),src_addr);
			obj->Set(String::NewFromUtf8(isolate,"sec"),Uint32::New(isolate,sec));
			obj->Set(String::NewFromUtf8(isolate,"nsec"),Uint32::New(isolate,nsec));
			if(binary == false) {
				char str[256];
				snprintf(str,mac.payload_len+1, "%s", data+mac.payload_offset);
				obj->Set(String::NewFromUtf8(isolate,"payload"),String::NewFromUtf8(isolate,str));
			} else {
				*(data+mac.payload_offset+mac.payload_len) = 0;
				Local<ArrayBuffer> ab = ArrayBuffer::New(isolate,(size_t)mac.payload_len);
				memcpy(ab->GetContents().Data(),data+mac.payload_offset,mac.payload_len);
				obj->Set(String::NewFromUtf8(isolate,"payload"),Uint8Array::New(ab,0,ab->ByteLength()));
			}
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
			packet->Set(String::NewFromUtf8(isolate,"tag"),Integer::New(isolate,tag));
			packet->Set(String::NewFromUtf8(isolate,"header"),Integer::New(isolate,mac.header));
			packet->Set(String::NewFromUtf8(isolate,"seq_num"),Integer::New(isolate,mac.seq_num));
			packet->Set(String::NewFromUtf8(isolate,"dst_panid"),Integer::New(isolate,mac.dst_panid));
			packet->Set(String::NewFromUtf8(isolate,"dst_addr"),dst_addr);
			packet->Set(String::NewFromUtf8(isolate,"src_panid"),Integer::New(isolate,mac.src_panid));
			packet->Set(String::NewFromUtf8(isolate,"src_addr"),src_addr);
			packet->Set(String::NewFromUtf8(isolate,"sec"),Uint32::New(isolate,sec));
			packet->Set(String::NewFromUtf8(isolate,"nsec"),Uint32::New(isolate,nsec));
			if(binary == false) {
				char str[256];
				snprintf(str,mac.payload_len+1, "%s", data+mac.payload_offset);
				packet->Set(String::NewFromUtf8(isolate,"payload"),String::NewFromUtf8(isolate,str));
			} else {
				*(data+mac.payload_offset+mac.payload_len) = 0;
				Local<ArrayBuffer> ab = ArrayBuffer::New(isolate,(size_t)mac.payload_len);
				memcpy(ab->GetContents().Data(),data+mac.payload_offset,mac.payload_len);
				packet->Set(String::NewFromUtf8(isolate,"payload"),Uint8Array::New(ab,0,ab->ByteLength()));
			}
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

static void send(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
#ifdef V8_VER_6
	Local<Context> context = isolate->GetCurrentContext();
#endif
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

	int result = -1;
#ifdef V8_VER_6
	uint16_t dst_panid = args[0]->NumberValue(context).FromMaybe(0);
	uint16_t dst_addr  = args[1]->NumberValue(context).FromMaybe(0);
	if(args[2]->IsString() == true) {
		String::Utf8Value payload(isolate,args[2]->ToString(context).ToLocalChecked());
		result = sendfunc(dst_panid, dst_addr, ToCString(payload), payload.length()+1);
	} else if(args[2]->IsUint8Array() == true) {
		Local<Uint8Array> obj = Local<Uint8Array>::Cast(args[2]);
		uint8_t *data = (uint8_t*)obj->Buffer()->GetContents().Data();
		result = sendfunc(dst_panid, dst_addr,data,obj->Length());
	} else {
		result = -1;
	}
#else
	uint16_t dst_panid = args[0]->NumberValue();
	uint16_t dst_addr  = args[1]->NumberValue();
	if(args[2]->IsString() == true) {
		String::Utf8Value payload(args[2]->ToString());
		result = sendfunc(dst_panid, dst_addr, ToCString(payload), payload.length()+1);
	} else if(args[2]->IsUint8Array() == true) {
		Local<Uint8Array> obj = Local<Uint8Array>::Cast(args[2]);
		uint8_t *data = (uint8_t*)obj->Buffer()->GetContents().Data();
		result = sendfunc(dst_panid, dst_addr,data,obj->Length());
	} else {
		result = -1;
	}
#endif
	if(result >= 0) {
		result = gettxrssi();
	}
	args.GetReturnValue().Set(result);
	return;
}

static void send64le(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
#ifdef V8_VER_6
	Local<Context> context = isolate->GetCurrentContext();
#endif

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
#ifdef V8_VER_6
	dst_addr[0] = arr->Get(0)->NumberValue(context).FromMaybe(0);
	dst_addr[1] = arr->Get(1)->NumberValue(context).FromMaybe(0);
	dst_addr[2] = arr->Get(2)->NumberValue(context).FromMaybe(0);
	dst_addr[3] = arr->Get(3)->NumberValue(context).FromMaybe(0);
	dst_addr[4] = arr->Get(4)->NumberValue(context).FromMaybe(0);
	dst_addr[5] = arr->Get(5)->NumberValue(context).FromMaybe(0);
	dst_addr[6] = arr->Get(6)->NumberValue(context).FromMaybe(0);
	dst_addr[7] = arr->Get(7)->NumberValue(context).FromMaybe(0);
#else
	dst_addr[0] = arr->Get(0)->NumberValue();
	dst_addr[1] = arr->Get(1)->NumberValue();
	dst_addr[2] = arr->Get(2)->NumberValue();
	dst_addr[3] = arr->Get(3)->NumberValue();
	dst_addr[4] = arr->Get(4)->NumberValue();
	dst_addr[5] = arr->Get(5)->NumberValue();
	dst_addr[6] = arr->Get(6)->NumberValue();
	dst_addr[7] = arr->Get(7)->NumberValue();
#endif

	int result;
#ifdef V8_VER_6
	if(args[1]->IsString() == true) {
		String::Utf8Value payload(isolate,args[1]->ToString(context).ToLocalChecked());
		result = sendfunc64le(dst_addr, ToCString(payload), payload.length()+1);
	} else if(args[1]->IsUint8Array() == true) {
		Local<Uint8Array> obj = Local<Uint8Array>::Cast(args[1]);
		uint8_t *data = (uint8_t*)obj->Buffer()->GetContents().Data();
		result = sendfunc64le(dst_addr,data,obj->Length());
	} else {
		result = -1;
	} 
#else
	if(args[1]->IsString() == true) {
		String::Utf8Value payload(args[1]->ToString());
		result = sendfunc64le(dst_addr, ToCString(payload), payload.length()+1);
	} else if(args[1]->IsUint8Array() == true) {
		Local<Uint8Array> obj = Local<Uint8Array>::Cast(args[1]);
		uint8_t *data = (uint8_t*)obj->Buffer()->GetContents().Data();
		result = sendfunc64le(dst_addr,data,obj->Length());
	} else {
		result = -1;
	}
#endif
	if(result >= 0) {
		result = gettxrssi();
	}
	args.GetReturnValue().Set(result);
	return;
}


static void send64be(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
#ifdef V8_VER_6
	Local<Context> context = isolate->GetCurrentContext();
#endif

	if(args.Length() < 2) {
		fprintf (stderr, "Wrong number of arguments\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	if(!sendfunc64be) {
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
#ifdef V8_VER_6
	dst_addr[0] = arr->Get(0)->NumberValue(context).FromMaybe(0);
	dst_addr[1] = arr->Get(1)->NumberValue(context).FromMaybe(0);
	dst_addr[2] = arr->Get(2)->NumberValue(context).FromMaybe(0);
	dst_addr[3] = arr->Get(3)->NumberValue(context).FromMaybe(0);
	dst_addr[4] = arr->Get(4)->NumberValue(context).FromMaybe(0);
	dst_addr[5] = arr->Get(5)->NumberValue(context).FromMaybe(0);
	dst_addr[6] = arr->Get(6)->NumberValue(context).FromMaybe(0);
	dst_addr[7] = arr->Get(7)->NumberValue(context).FromMaybe(0);
#else
	dst_addr[0] = arr->Get(0)->NumberValue();
	dst_addr[1] = arr->Get(1)->NumberValue();
	dst_addr[2] = arr->Get(2)->NumberValue();
	dst_addr[3] = arr->Get(3)->NumberValue();
	dst_addr[4] = arr->Get(4)->NumberValue();
	dst_addr[5] = arr->Get(5)->NumberValue();
	dst_addr[6] = arr->Get(6)->NumberValue();
	dst_addr[7] = arr->Get(7)->NumberValue();
#endif

	int result;
#ifdef V8_VER_6
	if(args[1]->IsString() == true) {
		String::Utf8Value payload(isolate,args[1]->ToString(context).ToLocalChecked());
		result = sendfunc64be(dst_addr, ToCString(payload), payload.length()+1);
	} else if(args[1]->IsUint8Array() == true) {
		Local<Uint8Array> obj = Local<Uint8Array>::Cast(args[1]);
		uint8_t *data = (uint8_t*)obj->Buffer()->GetContents().Data();
		result = sendfunc64be(dst_addr,data,obj->Length());
	} else {
		result = -1;
	} 
#else
	if(args[1]->IsString() == true) {
		String::Utf8Value payload(args[1]->ToString());
		result = sendfunc64be(dst_addr, ToCString(payload), payload.length()+1);
	} else if(args[1]->IsUint8Array() == true) {
		Local<Uint8Array> obj = Local<Uint8Array>::Cast(args[1]);
		uint8_t *data = (uint8_t*)obj->Buffer()->GetContents().Data();
		result = sendfunc64be(dst_addr,data,obj->Length());
	} else {
		result = -1;
	}
#endif
	if(result < 0) {
		args.GetReturnValue().Set(result);
		return;
	} else {
		result = gettxrssi();
		args.GetReturnValue().Set(result);
	}
	return;
}

static void setAckReq(const FunctionCallbackInfo<Value>& args) {
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


static void setEnhanceAck(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
#ifdef V8_VER_6
	Local<Context> context = isolate->GetCurrentContext();
#endif

	if(args.Length() < 1) {
		fprintf (stderr, "Wrong number of arguments\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	if(!seteack) {
		fprintf (stderr, "lazurite_setEnhanceAck fail.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}

	Local<Array> payload = Local<Array>::Cast(args[0]);
#ifdef V8_VER_6
	uint16_t size = args[1]->IsUint32() ? args[1]->Uint32Value(context).FromMaybe(0) : 0;
#else
	uint16_t size  = args[1]->NumberValue();;
#endif

	uint16_t i;
	uint8_t data[size];

	//  fprintf (stderr, "DEBUG lazurite_wrap: Size:%d\n",size);
	for (i=0;i<size;i++){
#ifdef V8_VER_6
		data[i] = payload->Get(i)->NumberValue(context).FromMaybe(0);
#else
		data[i] = payload->Get(i)->NumberValue();
#endif
		//      fprintf (stderr, "DEBUG lazurite_wrap: %d:%d\n",data[i],i);
	}
	if(seteack(data,size) != 0) {
		fprintf (stderr, "lazurite_setEnhanceAck exe error.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
}

static void getEnhanceAck(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
	if(!geteack) {
		fprintf (stderr, "lazurite_getEnhanceAck fail.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}

	Local<Object> obj = Object::New(isolate);

	char data[256];
	uint16_t size=0;
	int i;
	Local<Array> str = Array::New(isolate,size);

	memset(data,0,sizeof(data));

	if(geteack(data,&size) != 0){
		fprintf (stderr, "lazurite_getEnhanceAck exe error.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}

	for (i=0; i < size; i++){
		//      fprintf (stderr, "DEBUG lazurite_wrap: Data:%x, Size:%ld\n",data[i],size);
		str->Set(i,Integer::New(isolate,data[i]));
	}

	obj->Set(String::NewFromUtf8(isolate,"payload"),str);
	obj->Set(String::NewFromUtf8(isolate,"length"),Integer::New(isolate,size));

	args.GetReturnValue().Set(obj);
	return;
}

static void setBroadcastEnb(const FunctionCallbackInfo<Value>& args) {
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

static void setMyAddress(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
#ifdef V8_VER_6
	Local<Context> context = isolate->GetCurrentContext();
#endif
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
#ifdef V8_VER_6
	uint16_t myaddress = args[0]->IsUndefined() ?
		0 : args[0]->NumberValue(context).FromMaybe(0);
	printf("setMyAddress:: %04X\n",myaddress);
#else
	uint16_t myaddress = args[0]->NumberValue();;
#endif
	if(setmyaddress(myaddress) != 0){
		fprintf (stderr, "lazurite_setMyAddress exe error.\n");
		args.GetReturnValue().Set(Boolean::New(isolate,false));
		return;
	}
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
}

void getMyAddr64(const FunctionCallbackInfo<Value>& args) {
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

static void setKey(const FunctionCallbackInfo<Value>& args) {
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
#ifdef V8_VER_6
	String::Utf8Value key(isolate,args[0]->ToString());
#else
	String::Utf8Value key(args[0]->ToString());
#endif
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

static void close(const FunctionCallbackInfo<Value>& args) {
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

static void remove(const FunctionCallbackInfo<Value>& args) {
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

static void dlclose(const FunctionCallbackInfo<Value>& args) {
	Isolate* isolate = args.GetIsolate();
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
	args.GetReturnValue().Set(Boolean::New(isolate,true));
	return;
}

static void Init(Local<Object> target) {
	target->GetIsolate();

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
