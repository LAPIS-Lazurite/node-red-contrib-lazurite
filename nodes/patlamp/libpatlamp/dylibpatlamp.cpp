#include "opencv2/objdetect/objdetect.hpp"
#include "opencv2/highgui/highgui.hpp"
#include "opencv2/imgproc/imgproc.hpp"
#include "opencv2/opencv.hpp"

#include <fcntl.h>
#include <sys/ioctl.h>
#include <sys/types.h>
#include <linux/kernel.h>
#include <unistd.h>
#include <cctype>
#include <fstream>
#include <iostream>
#include <iterator>
#include <stdio.h>
#include <vector>
#include <string.h>
#include <typeinfo>
#include <time.h>
#include <pthread.h>

// --------------------------------------------------------------
// ★raspicam対応
// --------------------------------------------------------------
#include "RaspiCamCV.h"
#include "libpatlamp.h"

using namespace std;
using namespace cv;


#ifdef __cplusplus
namespace patlamp
{
#endif

	pthread_t thread_handler = 0;		// thread handler
	pthread_mutex_t mutex;				// thread muteix

	std::string mapfile = "";			// map file name
	std::string imgfile = "";			// jpeg file name for snapshot
	bool onImage = false;				// trigger of diplay image
	bool enbDisp = false;				// display status
	bool onExpand = false;				// display status
	bool onImageWrite = false;			// trigger of imaging picture
	int expandMag = 4;				// expand display
	int reportInterval = 10;			// report interval
	int detectInterval = 500;			// imaging capture interval
	bool onExecute = false;			// trigger of imaging picture
	bool onCamera = false;			// trigger of imaging picture

	struct IMAGE_SIZE {
		int width;
		int height;
	} imgSize = {640,480},dispOrigin;
	typedef struct {
		uint8_t r;
		uint8_t g;
		uint8_t b;
	} color_table;

	struct TEXT_COLOR {
		unsigned char r;
		unsigned char g;
		unsigned char b;
	} textColor = {255,0,0};

	RNG rng;
	struct MOUSE_POINTER{
		int x;
		int y;
	} mouse ={0,0},
	expandPosition = {0,0};

	typedef struct {
		std::string name;
		std::string color;
		int x;
		int y;
		int size;
		int threshold;
	} MACHINE_MAP;

	vector <MACHINE_MAP> pat_ramp;

	int ramp_count;
	int cycle_count;
	int detected_count[128];
	bool output_valid=false;
	int total_count=0;
	int total_detect[128];

	void setOutput(void){
		if(output_valid == false) {
			total_count = cycle_count;
			memcpy(total_detect,detected_count,sizeof(total_detect));
			output_valid = true;
		}else {
			total_count += cycle_count;
			for(int i=0;i<ramp_count;i++) {
				total_detect[i] += detected_count[i];
			}
		}
		cycle_count = 0;
		memset(detected_count,0,sizeof(detected_count));
	}

	void load_mapfile()
	{
		static fstream fs_map;
		int offset_x = 0;
		int offset_y = 0;
		char *en;
		string token;

		MACHINE_MAP mmap;

		// clear vector
		pat_ramp.clear();
		// open mapfile
		fs_map.open(mapfile.c_str(),std::ios::in);
		if(!fs_map.is_open()){
			return;
		}
		string reading_buffer;

		// get 1st line as offset
		while(!fs_map.eof())
		{
			MACHINE_MAP mmap;
			istringstream stream(reading_buffer);

			getline(fs_map, reading_buffer);

			getline(stream,token,',');
			mmap.name = token;
			getline(stream,token,',');
			mmap.color = token;
			getline(stream,token,',');
			mmap.x=strtol(token.c_str(),&en,10)+offset_x;
			getline(stream,token,',');
			mmap.y=strtol(token.c_str(),&en,10)+offset_y;
			getline(stream,token,',');
			mmap.size=strtol(token.c_str(),&en,10);
			getline(stream,token,',');
			mmap.threshold=strtol(token.c_str(),&en,10);

			if(mmap.name == "offset")
			{
				offset_x = mmap.x;
				offset_y = mmap.y;
			}
			else if(mmap.name.substr(0,1)!="#") pat_ramp.push_back(mmap);
			//cout << reading_buffer << endl;
		}
		fs_map.close();
		pat_ramp.erase(pat_ramp.begin());
	}

	static void on_mouse(int event,int x, int y,int flags,void *param=NULL){
		struct IMAGE_SIZE dispEnd,expandSize;
		switch(event)
		{
			case cv::EVENT_LBUTTONDOWN:
				onExpand = !onExpand;
				if(onExpand) {
					expandSize.width = imgSize.width*expandMag;
					expandSize.height = imgSize.height*expandMag;
					expandPosition.x =x*expandMag;
					expandPosition.y =y*expandMag;
					dispOrigin.width = expandPosition.x - imgSize.width/2;
					dispOrigin.height = expandPosition.y - imgSize.height/2;
					dispEnd.width = dispOrigin.width+imgSize.width;
					dispEnd.height = dispOrigin.height+imgSize.height;
					if(dispOrigin.width<0) dispOrigin.width =0;
					if(dispOrigin.height<0) dispOrigin.height =0;
					if(dispEnd.width > expandSize.width) dispOrigin.width -= (dispEnd.width - expandSize.width);
					if(dispEnd.height > expandSize.height) dispOrigin.height -= (dispEnd.height - expandSize.height);
					
				}
				break;
			case cv::EVENT_MOUSEMOVE:
				mouse.x =x;
				mouse.y =y;
				break;
		}
	}

	void serchBlinking(Mat grayImage, Mat &cameraFeed){
		// Initialization
		Mat temp;
		vector< vector<Point> > contours;
		vector<Vec4i> hierarchy;

		// get map file
		load_mapfile();

		// buffer to print text
		char str[64];
		char mousec[64];

		// for area of change
		Rect rect;
		Scalar color;

		// initializing log
		//log = "";
		// copy original image
		cameraFeed.copyTo(temp);

		// detect of changes
		Scalar mean;

		ramp_count = pat_ramp.size();

		for(int i = 0; i < pat_ramp.size();i++) {
			//		minEnclosingCircle((Mat)contours[i],center[i],radius[i]);
			// cut image
			rect = Rect(pat_ramp[i].x-pat_ramp[i].size/2,
					pat_ramp[i].y-pat_ramp[i].size/2,
					pat_ramp[i].size,
					pat_ramp[i].size);
			Mat blinkArea(grayImage,rect);
			// averaging color
			mean = cv::mean(blinkArea);

			// generate color from mean and map
			if(mean[0]>pat_ramp[i].threshold){
				detected_count[i]++;
				//log += "1,";
				if(pat_ramp[i].color=="g") color=Scalar(0,255,0);
				else if(pat_ramp[i].color=="y") color=Scalar(0,255,255);
				else if(pat_ramp[i].color=="r") color=Scalar(0,0,255);
				else color = Scalar(255,255,255);
			} else {
				color = Scalar(255,255,255);
				//log += "0,";
			}

			// generating line in frame
			line(cameraFeed,Point(rect.x             ,rect.y             ),Point(rect.x + rect.width,rect.y             ),color,0.1);
			line(cameraFeed,Point(rect.x             ,rect.y             ),Point(rect.x             ,rect.y + rect.width),color,0.1);
			line(cameraFeed,Point(rect.x + rect.width,rect.y             ),Point(rect.x + rect.width,rect.y + rect.width),color,0.1);
			line(cameraFeed,Point(rect.x             ,rect.y + rect.width),Point(rect.x + rect.width,rect.y + rect.width),color,0.1);

			// generating strings for frame
			sprintf(str,"%d,%s,%d", i,pat_ramp[i].name.c_str(),(int)mean[0]);

			// put text
			if(rect.x<320){
				putText(cameraFeed,str,
						cv::Point(rect.x,rect.y),
						FONT_HERSHEY_TRIPLEX,0.5,color,0.1,CV_AA);
			} else {
				putText(cameraFeed,str,
						cv::Point(rect.x-50,rect.y),
						FONT_HERSHEY_TRIPLEX,0.5,color,0.1,CV_AA);
			}
		}

		return;
	}

	static void*  main_thread(void *args)
	{
		// time
		time_t current_time;
		time_t last_tx_time;
		time(&last_tx_time);
		cycle_count = 0;
		ramp_count = 0;
		memset(detected_count,0,sizeof(detected_count));

		//CvCapture* capture = 0;
		RaspiCamCvCapture* capture = 0;

		RASPIVID_CONFIG * config = (RASPIVID_CONFIG*)malloc(sizeof(RASPIVID_CONFIG));
		config->width=imgSize.width;
		config->height=imgSize.height;
		config->bitrate=0;  // zero: leave as default
		config->framerate=0;
		config->monochrome=0;

		// save 
		//VideoWriter writer("result.avi",CV_FOURCC_DEFAULT,10,Size(640,480),true);

		// --------------------------------------------------------------
		cv::Mat mainFrame,grayImage;

		// catch raspi-cam
		capture = (RaspiCamCvCapture *) raspiCamCvCreateCameraCapture2(0, config); 
		onCamera = true;

		//cvNamedWindow( "drawing", 1 );
		//cvNamedWindow( "origin", 1 );
		if( capture )
		{
			cout << "In capture ..." << endl;
			onExecute = true;
			for(;;)
			{

				// waiting mutex
				pthread_mutex_lock(&mutex);
				usleep(detectInterval*1000);
				pthread_mutex_unlock(&mutex);
				// -------------------------------------------
				// ★raspicam対応
				// -------------------------------------------
				//IplImage* iplImg = cvQueryFrame( capture );
				IplImage* iplImg1;
				iplImg1 = raspiCamCvQueryFrame( capture );
				mainFrame = iplImg1;

				// optimize frame
				cv::flip(mainFrame,mainFrame,0);

				// convert to grayImage
				cv::cvtColor(mainFrame,grayImage,COLOR_BGR2GRAY);

				serchBlinking(grayImage,mainFrame);
				cycle_count++;

				// check tx timing
				time(&current_time);
				if((current_time - last_tx_time)>reportInterval)
				{
					setOutput();
					last_tx_time = current_time;
				}
				// imageWrite
				if(onImageWrite) {
					cv::imwrite(imgfile.c_str(),mainFrame);
					onImageWrite = false;
				}
				// display Image
				if(onImage) {
					Rect rect;
					if(!enbDisp){
						cvNamedWindow( "origin", 1 );
						cvSetMouseCallback("origin",on_mouse,0);
						enbDisp=true;
					}
					// priting mouse point
					char mousePoint[16];
					if(onExpand) {
						rect = Rect(
								dispOrigin.width,
								dispOrigin.height,
								imgSize.width,
								imgSize.height);
						cv::resize(mainFrame, mainFrame, cv::Size(),expandMag, expandMag);
						cv::Mat dispImage(mainFrame,rect);
						sprintf(mousePoint,"%d,%d", 
								(dispOrigin.width + mouse.x)/expandMag,
								(dispOrigin.height + mouse.y)/expandMag);
						putText(dispImage,mousePoint,
								cv::Point(10,100),
								FONT_HERSHEY_TRIPLEX,1,CV_RGB(textColor.b,textColor.g,textColor.r),1,CV_AA);
						cv::imshow("origin", dispImage);
					} else {
						sprintf(mousePoint,"%d,%d", mouse.x,mouse.y);
						putText(mainFrame,mousePoint,
								cv::Point(10,100),
								FONT_HERSHEY_TRIPLEX,1,CV_RGB(textColor.b,textColor.g,textColor.r),1,CV_AA);
						cv::imshow("origin", mainFrame);
					}
				} else {
					if(enbDisp){
						cvDestroyWindow("origin");
						enbDisp=false;
					}
				}
				if(!onExecute) break;
				waitKey(10);
			}
_cleanup_:
			// -------------------------------------------
			// ★raspicam対応
			// -------------------------------------------
			//cvReleaseCapture( &capture );
			if(onCamera) {
				raspiCamCvReleaseCapture(&capture);
				free(config);
				config = NULL;
				onCamera = false;
			}
		}
		//cvDestroyWindow("drawing");
		if(enbDisp){
			cvDestroyWindow("origin");
			enbDisp=false;
		}
	}

	extern "C" int init(void) {

		int args = 0;
		int result = 0;

		if (!thread_handler){
			std::cout << "threadStart" << std::endl;
			pthread_mutex_init(&patlamp::mutex, NULL); // ミューテックスの初期化
			pthread_create(                           // スレッドの生成
					&thread_handler,
					NULL,
					&main_thread,         // スレッドにできるのは、static なメソッドや関数のみ
					(void *)& args 							// parameters  to throw thread
					);
		}

		return result;
	}
	extern "C" int remove(void) {
		onExecute=false;
		printf("waiting to release camera");
		while(1) {
			pthread_mutex_lock(&mutex);
			if(!onCamera) break;
			printf(".");
			pthread_mutex_unlock(&mutex);
			usleep(100*1000);
		}
		printf("\n success to release camera\n");
		std::cout << "destructor start" << std::endl;
		pthread_cancel(thread_handler);     // スレッドにキャンセル要求を投げる
		pthread_join(thread_handler, NULL); // スレッドが終了するまで待機
		std::cout << "destructor end" << std::endl;
		thread_handler = 0;
		pthread_mutex_unlock(&mutex);

		return 0;
	}

	extern "C" int setMapfile(std::string str) {

		int result = 0;
		if(str == "") result = -1;
		else {
			if(str == "") return -1;
			pthread_mutex_lock(&mutex);
			mapfile = str;
			pthread_mutex_unlock(&mutex);
		}

		return 0;
	}

	extern "C" int setDisplay(bool on) {

		pthread_mutex_lock(&mutex);
		onImage = on;
		pthread_mutex_unlock(&mutex);

		return 0;
	}

	extern "C" bool getDisplay(void) {
		bool flag;

		pthread_mutex_lock(&mutex);
		flag = onImage;
		pthread_mutex_unlock(&mutex);

		return flag;
	}

	extern "C" int setDetectInterval(int msec) {

		int result = 0;

		if(msec <= 0) result = -1;
		else {
			pthread_mutex_lock(&mutex);
			detectInterval = msec;
			pthread_mutex_unlock(&mutex);
		}
		return result;
	}

	extern "C" int setReportInterval(int sec) {

		int result = 0;

		if(sec <= 0) result = -1;
		else {
			pthread_mutex_lock(&mutex);
			reportInterval = sec;
			pthread_mutex_unlock(&mutex);
		}
		return result;
	}

	extern "C" int setExpandMag(int mag) {

		int result = 0;

		if(mag <= 0) result = -1;
		else {
			pthread_mutex_lock(&mutex);
			expandMag = mag;
			pthread_mutex_unlock(&mutex);
		}
		return result;
	}

	extern "C" bool readData(std::string &payload) {

		int result = true;
		char tmp[16];

		if(!output_valid) result = false;
		else {
			pthread_mutex_lock(&mutex);

			sprintf(tmp,"%d,",total_count);
			payload = tmp;
			for(int i=0;i<ramp_count;i++) {
				sprintf(tmp,"%d,",total_detect[i]);
				payload += tmp;
			}
			total_count = 0;
			memset(total_detect,0,sizeof(total_detect));
			output_valid = false;

			pthread_mutex_unlock(&mutex);
		}
		return result;
	}

	extern "C" void setTextColor(unsigned char r,unsigned char g,unsigned char b) {
		pthread_mutex_lock(&mutex);
		textColor.r = r;
		textColor.g = g;
		textColor.b = b;
		pthread_mutex_unlock(&mutex);
	}

	extern "C" void snapShot(std::string filepath) {
		pthread_mutex_lock(&mutex);
		imgfile = filepath;
		onImageWrite = true;
		pthread_mutex_unlock(&mutex);
	}


#ifdef __cplusplus
};
#endif

/*
using namespace patlamp;
int main(void)
{
	std:string result;
	patlamp::setInterval(10);
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
	sleep(15);
	patlamp::remove();
	return 0;
}
*/
