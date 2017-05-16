#ifndef _LIBLAMPDETECT_H_
#define _LIBLAMPDETECT_H_

#include <string>
#include <stdint.h>

#ifdef __cplusplus
namespace patlamp {
	extern "C" {
#endif

	int init(void);
	bool readData(std::string &result);
	void snapShot(std::string filepath);
	void setTextColor(unsigned char r, unsigned char g, unsigned char b);
	int setDisplay(bool on);
	bool getDisplay(void);
	int setMapfile(std::string str);
	int setReportInterval(int sec);
	int setDetectInterval(int msec);
	int setExpandMag(int mag);
	int remove(void);

#ifdef __cplusplus
	}
};
#endif

#endif
