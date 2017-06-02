/* libpatlamp.h - patlamp brightness detecter
 *
 * Copyright (c) 2017  Lapis Semiconductor Co.,Ltd
 * All rights reserved.
 *
 * This program is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public License
 * as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this program.  If not, see
 * <http://www.gnu.org/licenses/>
 */

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
