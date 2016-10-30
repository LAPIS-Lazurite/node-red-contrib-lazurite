/*
 *  file: lazurite_wrap.cc
 *
 *  Copyright (C) 2016 Lapis Semiconductor Co., Ltd.
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
int (*closefunc)(void);
int (*removefunc)(void);

bool opened = false;
bool initialized = false;
bool began = false;
bool enabled = false;

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

Handle<Value> dlopen(const Arguments& args) {
	HandleScope scope;

	if(!opened) {
		handle = dlopen ("liblazurite.so", RTLD_LAZY);
		if (!handle) {
			fprintf (stderr, "%s\n", dlerror());
			return scope.Close(Boolean::New(false));
		}
		initfunc     = (int (*)(void))find(handle, "lazurite_init");
		beginfunc    = (int (*)(uint8_t, uint16_t, uint8_t,uint8_t))find(handle, "lazurite_begin");
		enablefunc   = (int (*)(void))find(handle, "lazurite_rxEnable");
		disablefunc  = (int (*)(void))find(handle, "lazurite_rxDisable");
		readfunc     = (int (*)(char*, uint16_t*))find(handle, "lazurite_read");
		decmac       = (int (*)(SUBGHZ_MAC*,void*, uint16_t))find(handle, "lazurite_decMac");
		getrxtime    = (int (*)(time_t*, time_t*))find(handle, "lazurite_getRxTime");
		getrxrssi    = (int (*)(void))find(handle, "lazurite_getRxRssi");
		sendfunc     = (int (*)(uint16_t, uint16_t, const void*, uint16_t))find(handle, "lazurite_send");
		closefunc    = (int (*)(void))dlsym(handle, "lazurite_close");
		removefunc   = (int (*)(void))dlsym(handle, "lazurite_remove");
		opened = true;
	}
	return scope.Close(Boolean::New(true));
}

Handle<Value> lazurite_init(const Arguments& args) {
	HandleScope scope;

	if(!initialized) {
		if(!initfunc) {
			fprintf (stderr, "liblzgw_open fail.\n");
			return scope.Close(Boolean::New(false));
		}
		int result = initfunc();
		if(result != 0) {
			fprintf (stderr, "liblzgw_open fail = %d\n", result);
			return scope.Close(Boolean::New(false));
		}
		initialized = true;
	}

	return scope.Close(Boolean::New(true));
}

Handle<Value> lazurite_begin(const Arguments& args) {
	HandleScope scope;

	if(!began) {
		if(args.Length() < 4) {
			fprintf (stderr, "Wrong number of arguments\n");
			return scope.Close(Boolean::New(false));
		}
		if(!beginfunc) {
			fprintf (stderr, "lazurite_begin fail\n");
			return scope.Close(Boolean::New(false));
		}

		uint8_t  ch    = args[0]->NumberValue();;
		uint16_t panid = args[1]->NumberValue();;
		uint8_t  rate  = args[2]->NumberValue();;
		uint8_t  pwr   = args[3]->NumberValue();;

		ch = args[0]->NumberValue();
		int result = beginfunc(ch, panid, rate, pwr);
		if(result != 0) {
			fprintf (stderr, "lazurite_begin fail = %d\n",result);
			return scope.Close(Boolean::New(false));
		}
		began = true;
	}
	return scope.Close(Boolean::New(true));
}

Handle<Value> lazurite_rxEnable(const Arguments& args) {
	HandleScope scope;

	if(!enabled) {
		if(!enablefunc) {
			fprintf (stderr, "lazurite_rxEnable fail.\n");
			return scope.Close(Boolean::New(false));
		}
		int result = enablefunc();
		if(result != 0) {
			fprintf (stderr, "lazurite_rxEnable fail = %d\n", result);
			return scope.Close(Boolean::New(false));
		}
		enabled = true;
	}
	return scope.Close(Boolean::New(true));
}

Handle<Value> lazurite_rxDisable(const Arguments& args) {
	HandleScope scope;

	if(enabled) {
		if(!enablefunc) {
			fprintf (stderr, "lazurite_rxDisable fail.\n");
			return scope.Close(Boolean::New(false));
		}
		int result = disablefunc();
		if(result != 0) {
			fprintf (stderr, "lazurite_rxDisable fail = %d\n", result);
			return scope.Close(Boolean::New(false));
		}
		enabled = false;
	}
	return scope.Close(Boolean::New(true));
}

Handle<Value> lazurite_read(const Arguments& args) {
	HandleScope scope;
	if(!readfunc) {
		fprintf (stderr, "lazurite_read fail.\n");
		return scope.Close(Undefined());
	}

	char data[256];
	char str[256];
	SUBGHZ_MAC mac;

	uint16_t size;

	memset(data,0,sizeof(data));
	memset(str,0,sizeof(str));

	Local<Object> obj = Object::New();

	if(readfunc(data,&size) > 0 ) {
		int rssi;
		time_t sec,nsec;
		decmac(&mac,data,size);
		getrxtime(&sec,&nsec);
		rssi=getrxrssi();

		Local<Array> rx_addr = Array::New(4);
		Local<Array> tx_addr = Array::New(4);
		for(int i=0;i<4;i++)
		{
			int tmp;
			tmp = (unsigned char)mac.rx_addr[i*2+1];
			tmp = (tmp << 8) + (unsigned char)mac.rx_addr[i*2];
			rx_addr->Set(i,Integer::New(tmp));
			tmp = (unsigned char)mac.tx_addr[i*2+1];
			tmp = (tmp << 8) + (unsigned char)mac.tx_addr[i*2];
			tx_addr->Set(i,Integer::New(tmp));
		}

		snprintf(str,mac.payload_len, "%s", data+mac.payload_offset);
		obj->Set(String::NewSymbol("header"),Integer::New(mac.header));
		obj->Set(String::NewSymbol("rx_panid"),Integer::New(mac.rx_panid));
		obj->Set(String::NewSymbol("rx_addr"),rx_addr);
		obj->Set(String::NewSymbol("tx_panid"),Integer::New(mac.tx_panid));
		obj->Set(String::NewSymbol("tx_addr"),tx_addr);
		obj->Set(String::NewSymbol("sec"),Uint32::New(sec));
		obj->Set(String::NewSymbol("nsec"),Uint32::New(nsec));
		obj->Set(String::NewSymbol("payload"),String::New(str));
		obj->Set(String::NewSymbol("rssi"),Integer::New(rssi));
		//return scope.Close(String::New(str));
	}
	obj->Set(String::NewSymbol("length"),Integer::New(size));
	return scope.Close(obj);
}

Handle<Value> lazurite_send(const Arguments& args) {
	HandleScope scope;
	if(args.Length() < 3) {
		fprintf (stderr, "Wrong number of arguments\n");
		return scope.Close(Boolean::New(false));
	}
	if(!sendfunc) {
		fprintf (stderr, "lazurite_send fail.\n");
		return scope.Close(Boolean::New(false));
	}

	uint16_t rxpanid = args[0]->NumberValue();;
	uint16_t rxaddr  = args[1]->NumberValue();;
	String::Utf8Value payload(args[2]->ToString());

	int result = sendfunc(rxpanid, rxaddr, ToCString(payload), payload.length());
	if(result < 0) {
		fprintf (stderr, "tx error = %d\n",result);
		return scope.Close(Boolean::New(false));
	}
	return scope.Close(Boolean::New(true));
}


Handle<Value> lazurite_close(const Arguments& args) {
	HandleScope scope;
	if(began) {
		if(!closefunc) {
			fprintf (stderr, "fail to stop RF");
			return scope.Close(Boolean::New(false));
		}
		int result = closefunc();
		if(result != 0) {
			fprintf (stderr, "fail to stop RF %d", result);
			return scope.Close(Boolean::New(false));
		}
		began = false;
	}
	return scope.Close(Boolean::New(true));
}

Handle<Value> lazurite_remove(const Arguments& args) {
	HandleScope scope;
	if(initialized) {
		if(!removefunc) {
			fprintf (stderr, "remove driver from kernel");
			return scope.Close(Boolean::New(false));
		}
		int result = removefunc();
		if(result != 0) {
			fprintf (stderr, "remove driver from kernel %d", result);
			return scope.Close(Boolean::New(false));
		}
		initialized = false;
	}
	return scope.Close(Boolean::New(true));
}

Handle<Value> dlclose(const Arguments& args) {
	HandleScope scope;
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
	return scope.Close(Boolean::New(true));
}

void init(Handle<Object> target) {
	NODE_SET_METHOD(target, "dlopen", dlopen);
	NODE_SET_METHOD(target, "lazurite_init", lazurite_init);
	NODE_SET_METHOD(target, "lazurite_begin", lazurite_begin);
	NODE_SET_METHOD(target, "lazurite_rxEnable", lazurite_rxEnable);
	NODE_SET_METHOD(target, "lazurite_rxDisable", lazurite_rxDisable);
	NODE_SET_METHOD(target, "lazurite_read", lazurite_read);
	NODE_SET_METHOD(target, "lazurite_send", lazurite_send);
	NODE_SET_METHOD(target, "lazurite_close", lazurite_close);
	NODE_SET_METHOD(target, "lazurite_remove", lazurite_remove);
	NODE_SET_METHOD(target, "dlclose", dlclose);
}

NODE_MODULE(lazurite_wrap, init)
