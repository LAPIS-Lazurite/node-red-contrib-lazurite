
#include <stdio.h>
#include <unistd.h>
#include <iostream>
#include <string.h>

#include "libpatlamp.h"

using namespace patlamp;
using namespace std;
int main(void)
{
std:string result;
	patlamp::setReportInterval(10);
	patlamp::setMapfile("./map.txt");
	patlamp::dispImage(true);
	patlamp::init();
	for(int i=0;i<30;i++) {
		if( patlamp::readData(result) == false ) {
			std::cout << "no data" << std::endl;
		} else {
			std::cout << result << std::endl;
		}
		sleep(2);
	}
	patlamp::dispImage(false);
	patlamp::snapShot("./out.jpg");
	patlamp::remove();
	sleep(3);
	return 0;
}
